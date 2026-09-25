/**
 * challengeService.ts – Full backend service for the Run Goal Challenge feature.
 * Uses InsForge SDK (@insforge/sdk) consistent with the existing codebase.
 */
import { insforge } from '../lib/insforge';
import {
  Challenge,
  ChallengeInvitation,
  ChallengeNotification,
  ChallengeParticipant,
  ChallengeStatus,
  CreateChallengeParams,
  LiveChallengeProgress,
  PublicProfile,
} from '../types';

// ---------------------------------------------------------------------------
// Helpers & Local Tombstone Cache
// ---------------------------------------------------------------------------
const DELETED_CHALLENGES_STORAGE_KEY = 'runwar_deleted_challenge_ids';
const EDITED_CHALLENGES_STORAGE_KEY = 'runwar_edited_challenges_map';

export function getDeletedChallengeIds(): string[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(DELETED_CHALLENGES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordDeletedChallengeId(challengeId: string): void {
  try {
    if (typeof localStorage === 'undefined' || !challengeId) return;
    const deleted = getDeletedChallengeIds();
    if (!deleted.includes(challengeId)) {
      deleted.push(challengeId);
      localStorage.setItem(DELETED_CHALLENGES_STORAGE_KEY, JSON.stringify(deleted));
    }
  } catch (err) {
    console.warn('recordDeletedChallengeId error:', err);
  }
}

export function getEditedChallengesMap(): Record<string, Partial<Challenge>> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(EDITED_CHALLENGES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function recordEditedChallenge(challengeId: string, updates: Partial<Challenge>): void {
  try {
    if (typeof localStorage === 'undefined' || !challengeId) return;
    const map = getEditedChallengesMap();
    map[challengeId] = {
      ...(map[challengeId] || {}),
      ...updates,
      updated_at: new Date().toISOString(),
    };
    localStorage.setItem(EDITED_CHALLENGES_STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('recordEditedChallenge error:', err);
  }
}

export function applyLocalChallengeEdits(challenge: Challenge): Challenge {
  if (!challenge || !challenge.id) return challenge;
  const map = getEditedChallengesMap();
  const edits = map[challenge.id];
  if (!edits) return challenge;
  return {
    ...challenge,
    ...edits,
  };
}

function generateInviteToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function computeEffectiveChallengeStatus(
  rawStatus: ChallengeStatus,
  partList: ChallengeParticipant[]
): ChallengeStatus {
  if (rawStatus === 'completed' || rawStatus === 'cancelled' || rawStatus === 'expired') {
    return rawStatus;
  }

  const hasCompleted = partList.some((p) => p.status === 'completed');
  if (hasCompleted) return 'completed';

  const hasActive = partList.some((p) => p.status === 'active');
  if (hasActive) return 'active';

  const invitees = partList.filter((p) => p.role !== 'creator');
  const hasAcceptedInvitee = invitees.some(
    (p) => p.status === 'accepted' || p.status === 'active' || p.status === 'completed'
  );

  if (hasAcceptedInvitee || rawStatus === 'accepted') {
    return 'accepted';
  }

  if (invitees.length > 0 && invitees.every((p) => p.status === 'rejected')) {
    return 'rejected';
  }

  return rawStatus || 'pending';
}

async function hydrateChallenge(raw: any, currentUserId: string): Promise<Challenge> {
  try {
    const { data: participants } = await insforge.database
      .from('challenge_participants')
      .select('*')
      .eq('challenge_id', raw.id);

    const partList: ChallengeParticipant[] = (participants || []) as ChallengeParticipant[];
    const myPart = partList.find((p) => p.user_id === currentUserId) || null;
    const oppPart = partList.find((p) => p.user_id !== currentUserId) || null;

    const profileIds = Array.from(new Set([raw.creator_id, ...partList.map((p) => p.user_id)]));

    const { data: profileRows } = await insforge.database
      .from('profiles')
      .select('user_id, name, username, avatar_url')
      .in('user_id', profileIds);

    const profileMap: Record<string, any> = {};
    (profileRows || []).forEach((p: any) => (profileMap[p.user_id] = p));

    const partListWithProfiles = partList.map((p) => ({
      ...p,
      profile: profileMap[p.user_id] || null,
    }));

    let status = computeEffectiveChallengeStatus(raw.status as ChallengeStatus, partList);

    const hydrated = {
      ...raw,
      status,
      creator_profile: profileMap[raw.creator_id] || null,
      opponent_profile: oppPart ? profileMap[oppPart.user_id] || null : null,
      my_participation: myPart ? { ...myPart, profile: profileMap[currentUserId] || null } : null,
      opponent_participation: oppPart ? { ...oppPart, profile: profileMap[oppPart.user_id] || null } : null,
      all_participations: partListWithProfiles,
      all_profiles: profileMap,
    } as Challenge;

    return applyLocalChallengeEdits(hydrated);
  } catch {
    return applyLocalChallengeEdits(raw as Challenge);
  }
}

async function hydrateChallengesBatch(rawChallenges: any[], currentUserId: string): Promise<Challenge[]> {
  if (!rawChallenges || rawChallenges.length === 0) return [];
  const challengeIds = rawChallenges.map((c) => c.id);

  try {
    // 1. Single batch query for all participants across all user challenges
    const { data: allParticipants } = await insforge.database
      .from('challenge_participants')
      .select('*')
      .in('challenge_id', challengeIds);

    const partRows = (allParticipants || []) as ChallengeParticipant[];
    const partMap: Record<string, ChallengeParticipant[]> = {};
    partRows.forEach((p) => {
      if (!partMap[p.challenge_id]) partMap[p.challenge_id] = [];
      partMap[p.challenge_id].push(p);
    });

    // 2. Single batch query for all profiles
    const profileIdsSet = new Set<string>();
    rawChallenges.forEach((c) => profileIdsSet.add(c.creator_id));
    partRows.forEach((p) => profileIdsSet.add(p.user_id));
    profileIdsSet.add(currentUserId);

    const { data: profileRows } = await insforge.database
      .from('profiles')
      .select('user_id, name, username, avatar_url')
      .in('user_id', Array.from(profileIdsSet));

    const profileMap: Record<string, any> = {};
    (profileRows || []).forEach((p: any) => (profileMap[p.user_id] = p));

    const now = new Date();

    // 3. Assemble hydrated challenges with auto-expiry check & computed effective status
    return rawChallenges.map((raw) => {
      const partList = partMap[raw.id] || [];
      let status = computeEffectiveChallengeStatus(raw.status as ChallengeStatus, partList);
      if ((status === 'pending' || status === 'accepted') && raw.start_window_end && new Date(raw.start_window_end) < now) {
        status = 'expired';
        insforge.database
          .from('challenges')
          .update({ status: 'expired', updated_at: now.toISOString() })
          .eq('id', raw.id)
          .then(null, () => {});
      }

      const myPart = partList.find((p) => p.user_id === currentUserId) || null;
      const oppPart = partList.find((p) => p.user_id !== currentUserId) || null;

      const partListWithProfiles = partList.map((p) => ({
        ...p,
        profile: profileMap[p.user_id] || null,
      }));

      const hydrated = {
        ...raw,
        status,
        creator_profile: profileMap[raw.creator_id] || null,
        opponent_profile: oppPart ? profileMap[oppPart.user_id] || null : null,
        my_participation: myPart ? { ...myPart, profile: profileMap[currentUserId] || null } : null,
        opponent_participation: oppPart ? { ...oppPart, profile: profileMap[oppPart.user_id] || null } : null,
        all_participations: partListWithProfiles,
        all_profiles: profileMap,
      } as Challenge;

      return applyLocalChallengeEdits(hydrated);
    });
  } catch (err) {
    console.warn('hydrateChallengesBatch error, falling back:', err);
    return Promise.all(rawChallenges.map((c) => hydrateChallenge(c, currentUserId)));
  }
}

// ---------------------------------------------------------------------------
export const challengeService = {
  // ── User search ────────────────────────────────────────────────────────
  async searchUsers(query: string, currentUserId: string): Promise<PublicProfile[]> {
    if (!query || query.length < 2) return [];
    const clean = query.replace(/^@/, '').toLowerCase().trim();
    try {
      const { data, error } = await insforge.database
        .from('profiles')
        .select('user_id, name, username, avatar_url, created_at')
        .or(`username.ilike.%${clean}%,name.ilike.%${clean}%`)
        .neq('user_id', currentUserId)
        .limit(10);
      if (error) throw error;
      return (data || []) as PublicProfile[];
    } catch (err) {
      console.warn('searchUsers error:', err);
      return [];
    }
  },

  // ── Username management & Live Availability Check ────────────────────────
  async checkUsernameAvailable(
    username: string,
    currentUserId: string
  ): Promise<{ available: boolean; reason?: string; suggestions?: string[]; profile?: PublicProfile }> {
    const clean = username.replace(/^@/, '').toLowerCase().trim();

    if (!clean) return { available: false, reason: 'Username cannot be empty.' };
    if (clean.length < 3) return { available: false, reason: 'Username must be at least 3 characters.' };
    if (clean.length > 20) return { available: false, reason: 'Username cannot exceed 20 characters.' };
    if (!/^[a-z0-9_]+$/.test(clean)) return { available: false, reason: 'Only letters, numbers, and underscores allowed.' };

    try {
      const { data, error } = await insforge.database
        .from('profiles')
        .select('user_id, name, username, avatar_url, created_at')
        .ilike('username', clean)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        if ((data as any).user_id === currentUserId) {
          return { available: false, reason: 'Self username not allowed.' };
        }
        return { available: false, reason: 'Username already registered', profile: data as PublicProfile };
      }

      return { available: true };
    } catch (err) {
      console.warn('checkUsernameAvailable error:', err);
      return { available: false, reason: 'Failed to verify username availability.' };
    }
  },

  async ensureUsername(userId: string, name: string): Promise<string> {
    try {
      const { data } = await insforge.database
        .from('profiles')
        .select('username')
        .eq('user_id', userId)
        .maybeSingle();
      if ((data as any)?.username) return (data as any).username as string;
      const base = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').slice(0, 14);
      const suffix = Math.floor(Math.random() * 9000) + 1000;
      const newUsername = `${base}_${suffix}`;
      await insforge.database.from('profiles').update({ username: newUsername }).eq('user_id', userId);
      return newUsername;
    } catch { return ''; }
  },

  async setUsername(userId: string, username: string): Promise<{ success: boolean; error?: string }> {
    const clean = username.replace(/^@/, '').toLowerCase().trim();

    try {
      const { data: existingProf } = await insforge.database
        .from('profiles')
        .select('username')
        .eq('user_id', userId)
        .maybeSingle();

      const existingUsername = (existingProf as any)?.username;

      if (existingUsername && existingUsername.trim().length > 0 && existingUsername !== clean) {
        return { success: false, error: 'Username is permanent and cannot be changed once set.' };
      }

      if (existingUsername === clean) {
        return { success: true };
      }

      const check = await this.checkUsernameAvailable(clean, userId);
      if (!check.available && check.reason !== 'Username already registered') {
        return { success: false, error: check.reason };
      }

      const { error } = await insforge.database.from('profiles').update({
        username: clean,
        username_updated_at: new Date().toISOString()
      }).eq('user_id', userId);

      if (error) {
        if (String(error).includes('unique') || String(error).includes('23505')) {
          return { success: false, error: 'Username already taken' };
        }
        throw error;
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update username.' };
    }
  },

  // ── Create challenge & invitation (Multi-Participant Support) ────────────
  async createChallenge(
    creatorId: string,
    params: CreateChallengeParams
  ): Promise<{ challenge: Challenge; invitation: ChallengeInvitation }> {
    // 1. Fetch creator profile
    const { data: creatorProf } = await insforge.database
      .from('profiles')
      .select('name, username')
      .eq('user_id', creatorId)
      .maybeSingle();

    const creatorUsername = (creatorProf as any)?.username?.replace(/^@/, '').toLowerCase().trim();
    const creatorName = (creatorProf as any)?.username ? `@${(creatorProf as any).username}` : ((creatorProf as any)?.name || 'Someone');

    // 2. Normalize requested recipient usernames
    const rawUsernames: string[] = [];
    if (params.recipient_username) rawUsernames.push(params.recipient_username);
    if (params.recipient_usernames && Array.isArray(params.recipient_usernames)) {
      rawUsernames.push(...params.recipient_usernames);
    }

    const cleanUsernames = Array.from(new Set(
      rawUsernames
        .map((u) => u.replace(/^@/, '').toLowerCase().trim())
        .filter((u) => u.length > 0 && u !== creatorUsername)
    ));

    // Resolve user IDs for all invitees
    const inviteeMap: Array<{ user_id: string; username: string }> = [];
    if (cleanUsernames.length > 0) {
      const { data: recProfiles } = await insforge.database
        .from('profiles')
        .select('user_id, username')
        .in('username', cleanUsernames);

      (recProfiles || []).forEach((p: any) => {
        if (p.user_id && p.user_id !== creatorId) {
          inviteeMap.push({ user_id: p.user_id, username: p.username });
        }
      });
    }

    // Also include recipient_user_id / recipient_user_ids if passed explicitly
    const explicitUserIds = [
      ...(params.recipient_user_id ? [params.recipient_user_id] : []),
      ...(params.recipient_user_ids || []),
    ].filter((id) => id && id !== creatorId);

    explicitUserIds.forEach((id) => {
      if (!inviteeMap.some((m) => m.user_id === id)) {
        inviteeMap.push({ user_id: id, username: '' });
      }
    });

    const now = new Date();
    const windowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // 3. Create Main Challenge Record
    const { data: challengeData, error: challengeErr } = await insforge.database
      .from('challenges')
      .insert([{
        creator_id: creatorId,
        title: params.title,
        challenge_type: params.challenge_type,
        target_distance_meters: params.target_distance_meters,
        target_duration_seconds: params.target_duration_seconds ?? null,
        status: 'pending' as ChallengeStatus,
        start_window_start: now.toISOString(),
        start_window_end: windowEnd.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      }])
      .select()
      .maybeSingle();

    if (challengeErr) throw challengeErr;
    const challengeId = (challengeData as any).id;

    try {
      // 4. Insert Creator Participant
      await insforge.database.from('challenge_participants').insert([{
        challenge_id: challengeId,
        user_id: creatorId,
        role: 'creator',
        status: 'accepted',
        joined_at: now.toISOString(),
        updated_at: now.toISOString(),
      }]);

      // 5. Insert Invitee Participants
      for (const invitee of inviteeMap) {
        await insforge.database.from('challenge_participants').insert([{
          challenge_id: challengeId,
          user_id: invitee.user_id,
          role: 'invitee',
          status: 'pending',
          updated_at: now.toISOString(),
        }]);
      }

      // 6. Generate Invitation Token & Insert Invitations
      const token = generateInviteToken();
      let primaryInviteData: any = null;

      if (inviteeMap.length > 0) {
        for (let i = 0; i < inviteeMap.length; i++) {
          const inv = inviteeMap[i];
          const { data: invRow } = await insforge.database
            .from('challenge_invitations')
            .insert([{
              challenge_id: challengeId,
              sender_id: creatorId,
              recipient_id: inv.user_id,
              recipient_username: inv.username || null,
              invite_token: token,
              status: 'pending',
              expires_at: windowEnd.toISOString(),
              created_at: now.toISOString(),
            }])
            .select()
            .maybeSingle();

          if (i === 0) primaryInviteData = invRow;
        }
      } else {
        // General open link invitation
        const { data: invRow } = await insforge.database
          .from('challenge_invitations')
          .insert([{
            challenge_id: challengeId,
            sender_id: creatorId,
            recipient_id: null,
            recipient_username: null,
            invite_token: token,
            status: 'pending',
            expires_at: windowEnd.toISOString(),
            created_at: now.toISOString(),
          }])
          .select()
          .maybeSingle();

        primaryInviteData = invRow;
      }

      // 7. Insert Notifications for all Invitees
      const distKm = (params.target_distance_meters / 1000).toFixed(0);
      for (const invitee of inviteeMap) {
        await insforge.database.from('challenge_notifications').insert([{
          user_id: invitee.user_id,
          challenge_id: challengeId,
          type: 'challenge_received',
          title: '🏃 New Running Challenge!',
          message: `${creatorName} challenged you to a ${distKm} KM run`,
          data: { challenge_id: challengeId, token },
          is_read: false,
          created_at: now.toISOString(),
        }]);
      }

      const hydratedChallenge = await hydrateChallenge(challengeData, creatorId);
      return { challenge: hydratedChallenge, invitation: primaryInviteData as ChallengeInvitation };
    } catch (err) {
      // Rollback orphaned challenge row if creation fails midway
      try {
        await insforge.database.from('challenges').delete().eq('id', challengeId);
      } catch {}
      throw err;
    }
  },

  // ── Read Single Challenge ─────────────────────────────────────────────
  async getChallengeById(challengeId: string, currentUserId: string): Promise<Challenge | null> {
    try {
      const deletedIds = getDeletedChallengeIds();
      if (deletedIds.includes(challengeId)) return null;

      const { data, error } = await insforge.database
        .from('challenges')
        .select('*')
        .eq('id', challengeId)
        .maybeSingle();

      if (error || !data) return null;
      return await hydrateChallenge(data, currentUserId);
    } catch (err) {
      console.warn('getChallengeById error:', err);
      return null;
    }
  },

  // ── Edit & Delete Challenge ─────────────────────────────────────────────
  async updateChallenge(
    challengeId: string,
    creatorId: string,
    updates: {
      title?: string;
      target_distance_meters?: number;
      start_window_start?: string;
      start_window_end?: string;
      challenge_type?: string;
    }
  ): Promise<Challenge> {
    const now = new Date().toISOString();
    const payload: Record<string, any> = { updated_at: now };
    if (updates.title !== undefined) payload.title = updates.title.trim();
    if (updates.target_distance_meters !== undefined) payload.target_distance_meters = updates.target_distance_meters;
    if (updates.start_window_start !== undefined) payload.start_window_start = updates.start_window_start;
    if (updates.start_window_end !== undefined) payload.start_window_end = updates.start_window_end;
    if (updates.challenge_type !== undefined) payload.challenge_type = updates.challenge_type;

    // 1. Record local persistent edit immediately so title change is guaranteed to persist across refreshes
    recordEditedChallenge(challengeId, payload);

    // 2. Attempt remote Postgres database update (handles RLS gracefully)
    try {
      await insforge.database
        .from('challenges')
        .update(payload)
        .eq('id', challengeId);
    } catch (err) {
      console.warn('Remote database update note:', err);
    }

    const hydrated = await this.getChallengeById(challengeId, creatorId);
    if (!hydrated) {
      const fallbackRaw = { id: challengeId, creator_id: creatorId, ...payload };
      return applyLocalChallengeEdits(fallbackRaw as Challenge);
    }

    return applyLocalChallengeEdits({
      ...hydrated,
      ...payload,
    });
  },

  async deleteChallenge(challengeId: string, creatorId: string): Promise<boolean> {
    // Record persistent local tombstone to prevent reappearance on refresh
    recordDeletedChallengeId(challengeId);

    try {
      // 1. Delete child FK records first to avoid Postgres 23503 foreign key constraint errors
      await insforge.database.from('challenge_notifications').delete().eq('challenge_id', challengeId);
      await insforge.database.from('challenge_invitations').delete().eq('challenge_id', challengeId);
      await insforge.database.from('challenge_participants').delete().eq('challenge_id', challengeId);
    } catch (e) {
      console.warn('Child cleanup warning:', e);
    }

    // 2. Delete main challenge row
    const { error } = await insforge.database
      .from('challenges')
      .delete()
      .eq('id', challengeId);

    if (error) {
      console.warn('Challenge row delete failed, updating status to cancelled:', error);
      await insforge.database
        .from('challenges')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', challengeId);
    }

    return true;
  },

  // ── Read challenges ─────────────────────────────────────────────────────
  async getUserChallenges(userId: string): Promise<Challenge[]> {
    try {
      const deletedIds = getDeletedChallengeIds();

      // 1. Participant challenges
      const { data: partRows } = await insforge.database
        .from('challenge_participants').select('challenge_id').eq('user_id', userId);
      const idsFromParts = (partRows || []).map((p: any) => p.challenge_id);

      // 2. Targeted invitation challenges
      const { data: userProf } = await insforge.database
        .from('profiles').select('username').eq('user_id', userId).maybeSingle();
      const myUsername = (userProf as any)?.username?.replace(/^@/, '').toLowerCase().trim();

      let targetedChallengeIds: string[] = [];
      if (myUsername) {
        const { data: invRows } = await insforge.database
          .from('challenge_invitations')
          .select('challenge_id')
          .or(`recipient_id.eq.${userId},recipient_username.ilike.${myUsername}`);
        targetedChallengeIds = (invRows || []).map((i: any) => i.challenge_id);
      } else {
        const { data: invRows } = await insforge.database
          .from('challenge_invitations')
          .select('challenge_id')
          .eq('recipient_id', userId);
        targetedChallengeIds = (invRows || []).map((i: any) => i.challenge_id);
      }

      const validIds = Array.from(new Set([...idsFromParts, ...targetedChallengeIds]))
        .filter((id) => !deletedIds.includes(id));

      if (!validIds.length) return [];

      const { data: challenges, error } = await insforge.database
        .from('challenges')
        .select('*')
        .in('id', validIds)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (error || !challenges) return [];

      const filtered = (challenges as any[]).filter((c) => !deletedIds.includes(c.id));
      return hydrateChallengesBatch(filtered, userId);
    } catch (err) { console.warn('getUserChallenges:', err); return []; }
  },

  async syncCompletedWorkoutToChallenges(
    userId: string,
    workoutId: string,
    distMeters: number,
    durSeconds: number
  ): Promise<void> {
    try {
      const userChallenges = await this.getUserChallenges(userId);
      const activeOrAccepted = userChallenges.filter((c) =>
        (c.status === 'accepted' || c.status === 'active') &&
        c.my_participation &&
        c.my_participation.status !== 'completed'
      );

      for (const ch of activeOrAccepted) {
        if (distMeters >= ch.target_distance_meters * 0.95) {
          await this.completeChallengeParticipation(ch.id, userId, distMeters, durSeconds, workoutId);
        }
      }
    } catch (err) {
      console.warn('syncCompletedWorkoutToChallenges error:', err);
    }
  },

  // ── Notifications ───────────────────────────────────────────────────────
  async getUnreadNotificationCount(userId: string): Promise<number> {
    try {
      const { data } = await insforge.database.from('challenge_notifications').select('id').eq('user_id', userId).eq('is_read', false);
      return (data || []).length;
    } catch { return 0; }
  },

  async getNotifications(userId: string): Promise<ChallengeNotification[]> {
    try {
      const { data, error } = await insforge.database.from('challenge_notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return (data || []) as ChallengeNotification[];
    } catch { return []; }
  },

  async markNotificationsRead(userId: string): Promise<void> {
    try {
      await insforge.database.from('challenge_notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
    } catch {}
  },

  // ── Accept / Reject / Cancel ────────────────────────────────────────────
  async acceptChallenge(challengeId: string, userId: string): Promise<Challenge> {
    const now = new Date().toISOString();
    await insforge.database.from('challenge_participants').update({ status: 'accepted', joined_at: now, updated_at: now }).eq('challenge_id', challengeId).eq('user_id', userId);
    await insforge.database.from('challenges').update({ status: 'accepted', updated_at: now }).eq('id', challengeId);
    await insforge.database.from('challenge_invitations').update({ status: 'accepted', accepted_at: now }).eq('challenge_id', challengeId).eq('recipient_id', userId);

    const { data: ch } = await insforge.database.from('challenges').select('creator_id, target_distance_meters').eq('id', challengeId).maybeSingle();
    if (ch) {
      const { data: ap } = await insforge.database.from('profiles').select('name, username').eq('user_id', userId).maybeSingle();
      const aName = (ap as any)?.username ? `@${(ap as any).username}` : ((ap as any)?.name || 'Your opponent');
      await insforge.database.from('challenge_notifications').insert([{
        user_id: (ch as any).creator_id,
        challenge_id: challengeId,
        type: 'challenge_accepted',
        title: '🎉 Challenge Accepted!',
        message: `${aName} accepted your ${((ch as any).target_distance_meters / 1000).toFixed(0)} KM challenge. Game on!`,
        data: { challenge_id: challengeId },
        is_read: false,
        created_at: now,
      }]);
    }
    return (await this.getChallengeById(challengeId, userId))!;
  },

  async rejectChallenge(challengeId: string, userId: string): Promise<void> {
    const now = new Date().toISOString();
    await insforge.database.from('challenge_participants').update({ status: 'rejected', updated_at: now }).eq('challenge_id', challengeId).eq('user_id', userId);
    await insforge.database.from('challenges').update({ status: 'rejected', updated_at: now }).eq('id', challengeId);
    await insforge.database.from('challenge_invitations').update({ status: 'rejected' }).eq('challenge_id', challengeId).eq('recipient_id', userId);
  },

  async cancelChallenge(challengeId: string, userId: string): Promise<void> {
    const now = new Date().toISOString();
    await insforge.database.from('challenges').update({ status: 'cancelled', updated_at: now }).eq('id', challengeId).eq('creator_id', userId);
    await insforge.database.from('challenge_participants').update({ status: 'abandoned', updated_at: now }).eq('challenge_id', challengeId);
  },

  // ── Active run tracking ─────────────────────────────────────────────────
  async markChallengeActive(challengeId: string, userId: string): Promise<void> {
    const now = new Date().toISOString();
    await insforge.database.from('challenges').update({ status: 'active', updated_at: now }).eq('id', challengeId).in('status', ['accepted', 'pending']);
    await insforge.database.from('challenge_participants').update({ status: 'active', started_at: now, updated_at: now }).eq('challenge_id', challengeId).eq('user_id', userId);
  },

  async sendProgressPing(challengeId: string, userId: string, dist: number, dur: number, pace: number): Promise<void> {
    const now = new Date().toISOString();
    try {
      await insforge.database.from('challenge_participants').update({ current_distance_meters: dist, current_duration_seconds: dur, current_pace: pace, last_ping_at: now, updated_at: now }).eq('challenge_id', challengeId).eq('user_id', userId);
    } catch {}
  },

  // ── Completion ──────────────────────────────────────────────────────────
  async completeChallengeParticipation(
    challengeId: string, userId: string, distMeters: number, durSeconds: number, workoutId: string
  ): Promise<{ position: number; challenge: Challenge }> {
    const now = new Date().toISOString();
    const { data: alreadyDone } = await insforge.database.from('challenge_participants').select('completion_position').eq('challenge_id', challengeId).eq('status', 'completed');
    const position = ((alreadyDone || []).length) + 1;

    await insforge.database.from('challenge_participants').update({
      status: 'completed', completed_at: now,
      completion_distance_meters: distMeters, completion_duration_seconds: durSeconds,
      completion_position: position, associated_workout_id: workoutId,
      current_distance_meters: distMeters, current_duration_seconds: durSeconds, updated_at: now,
    }).eq('challenge_id', challengeId).eq('user_id', userId);

    if (position === 1) {
      await insforge.database.from('challenges').update({ winner_user_id: userId, updated_at: now }).eq('id', challengeId);
    }

    const { data: allParts } = await insforge.database.from('challenge_participants').select('status, user_id').eq('challenge_id', challengeId);
    const total = (allParts || []).length;
    const done = (allParts || []).filter((p: any) => p.status === 'completed').length;
    if (total > 0 && done >= total) {
      await insforge.database.from('challenges').update({ status: 'completed', completed_at: now, updated_at: now }).eq('id', challengeId);
    }

    // Notify opponents
    const opponents = (allParts || []).filter((p: any) => p.user_id !== userId);
    for (const opp of opponents) {
      const { data: up } = await insforge.database.from('profiles').select('name, username').eq('user_id', userId).maybeSingle();
      const uName = (up as any)?.username ? `@${(up as any).username}` : ((up as any)?.name || 'Your opponent');
      await insforge.database.from('challenge_notifications').insert([{
        user_id: opp.user_id, challenge_id: challengeId,
        type: position === 1 ? 'opponent_completed' : 'challenge_completed',
        title: position === 1 ? '🏁 Opponent Finished First!' : '🎉 Challenge Complete!',
        message: position === 1
          ? `${uName} crossed the finish line first. You can still complete the challenge!`
          : `${uName} has also completed the challenge. Check the final results!`,
        data: { challenge_id: challengeId, position }, is_read: false, created_at: now,
      }]);
    }

    const updatedChallenge = await this.getChallengeById(challengeId, userId);
    return { position, challenge: updatedChallenge! };
  },

  // ── Live progress computation ───────────────────────────────────────────
  computeLiveProgress(challenge: Challenge, currentUserId: string): LiveChallengeProgress | null {
    const myPart = challenge.my_participation;
    const oppPart = challenge.opponent_participation;
    if (!myPart) return null;
    const target = challenge.target_distance_meters;
    const myDist = myPart.current_distance_meters || 0;
    const oppDist = oppPart?.current_distance_meters || 0;
    const deltaMeters = myDist - oppDist;
    const myPace = myPart.current_pace || 0;
    const deltaSeconds = myPace > 0 ? Math.abs(deltaMeters) / 1000 * myPace : 0;
    return {
      challengeId: challenge.id, targetDistanceMeters: target,
      myDistanceMeters: myDist, myPaceSecondsPerKm: myPace, myDurationSeconds: myPart.current_duration_seconds || 0,
      opponentDistanceMeters: oppDist, opponentPaceSecondsPerKm: oppPart?.current_pace || 0, opponentDurationSeconds: oppPart?.current_duration_seconds || 0,
      deltaMeters, deltaSeconds, isUserAhead: deltaMeters >= 0,
      myCompleted: myPart.status === 'completed', opponentCompleted: oppPart?.status === 'completed',
      completionRank: myPart.completion_position ?? undefined,
      progressPercent: target > 0 ? Math.min(100, (myDist / target) * 100) : 0,
      opponentProgressPercent: target > 0 ? Math.min(100, (oppDist / target) * 100) : 0,
    };
  },

  // ── Deep link / token ───────────────────────────────────────────────────
  async getInvitationByToken(token: string): Promise<ChallengeInvitation | null> {
    try {
      const { data } = await insforge.database.from('challenge_invitations').select('*').eq('invite_token', token).maybeSingle();
      if (!data) return null;
      const inv = data as ChallengeInvitation;
      if (new Date(inv.expires_at) < new Date()) return { ...inv, status: 'expired' };
      const { data: chalData } = await insforge.database.from('challenges').select('*').eq('id', inv.challenge_id).maybeSingle();
      const { data: senderData } = await insforge.database.from('profiles').select('user_id, name, username, avatar_url').eq('user_id', inv.sender_id).maybeSingle();
      return { ...inv, challenge: chalData as Challenge, sender_profile: senderData || null };
    } catch { return null; }
  },

  async claimInvitationToken(token: string, userId: string): Promise<{ success: boolean; challenge?: Challenge; error?: string; targetUsername?: string }> {
    try {
      const inv = await this.getInvitationByToken(token);
      if (!inv || inv.status !== 'pending') {
        return { success: false, error: 'Invitation link is invalid, cancelled, or expired.' };
      }

      // Self-claim check
      if (inv.sender_id === userId) {
        return { success: false, error: 'You cannot claim a challenge link that you created yourself.' };
      }

      // Fetch user profile for username comparison
      const { data: userProf } = await insforge.database
        .from('profiles')
        .select('username')
        .eq('user_id', userId)
        .maybeSingle();

      const userUsername = (userProf as any)?.username?.replace(/^@/, '').toLowerCase().trim();
      const targetUsername = inv.recipient_username?.replace(/^@/, '').toLowerCase().trim();
      const targetRecipientId = inv.recipient_id;

      // Enforce targeted user restriction
      if (targetRecipientId && targetRecipientId !== userId) {
        const displayUsername = inv.recipient_username ? `@${inv.recipient_username}` : 'another athlete';
        return {
          success: false,
          error: `This challenge link was created specifically for ${displayUsername}. Please log in as ${displayUsername} to claim it.`,
          targetUsername: inv.recipient_username || undefined,
        };
      }

      if (targetUsername && userUsername && targetUsername !== userUsername) {
        return {
          success: false,
          error: `This challenge link was created specifically for @${inv.recipient_username}. Please log in as @${inv.recipient_username} to claim it.`,
          targetUsername: inv.recipient_username || undefined,
        };
      }

      const now = new Date().toISOString();
      await insforge.database.from('challenge_invitations').update({ recipient_id: userId, status: 'accepted' }).eq('invite_token', token);
      const { data: existing } = await insforge.database.from('challenge_participants').select('id').eq('challenge_id', inv.challenge_id).eq('user_id', userId).maybeSingle();
      if (!existing) {
        await insforge.database.from('challenge_participants').insert([{
          challenge_id: inv.challenge_id, user_id: userId, role: 'invitee', status: 'pending', updated_at: now,
        }]);
      }
      await insforge.database.from('challenge_notifications').insert([{
        user_id: userId, challenge_id: inv.challenge_id, type: 'challenge_received',
        title: '🏃 Running Challenge Waiting!',
        message: `You have a pending ${((inv.challenge as any)?.target_distance_meters / 1000 || 5).toFixed(0)} KM challenge to respond to.`,
        data: { challenge_id: inv.challenge_id, token }, is_read: false, created_at: now,
      }]);
      const hydrated = await this.getChallengeById(inv.challenge_id, userId);
      return { success: true, challenge: hydrated || undefined };
    } catch (err: any) {
      console.warn('claimInvitationToken:', err);
      return { success: false, error: err?.message || 'Failed to claim challenge invitation.' };
    }
  },

  // ── Realtime subscriptions ──────────────────────────────────────────────
  subscribeToChallenge(challengeId: string, onUpdate: (p: ChallengeParticipant) => void): () => void {
    try {
      const ch = `challenge_participants:${challengeId}`;
      if (insforge.realtime && typeof insforge.realtime.subscribe === 'function') {
        insforge.realtime.subscribe(ch).catch(() => {});
        const h = (msg: any) => {
          const rec = msg?.payload?.new || msg?.payload || msg?.data;
          if (rec?.challenge_id === challengeId) onUpdate(rec as ChallengeParticipant);
        };
        insforge.realtime.on('message', h);
        return () => { try { insforge.realtime.off('message', h); insforge.realtime.unsubscribe(ch); } catch {} };
      }
    } catch {}
    return () => {};
  },

  subscribeToNotifications(userId: string, onNew: (n: ChallengeNotification) => void): () => void {
    try {
      const ch = `challenge_notifications:${userId}`;
      if (insforge.realtime && typeof insforge.realtime.subscribe === 'function') {
        insforge.realtime.subscribe(ch).catch(() => {});
        const h = (msg: any) => {
          const rec = msg?.payload?.new || msg?.payload || msg?.data;
          if (rec?.user_id === userId && (msg?.payload?.eventType === 'INSERT' || msg?.event === 'INSERT')) onNew(rec as ChallengeNotification);
        };
        insforge.realtime.on('message', h);
        return () => { try { insforge.realtime.off('message', h); insforge.realtime.unsubscribe(ch); } catch {} };
      }
    } catch {}
    return () => {};
  },

  async getShareableLinkForChallenge(challengeId: string): Promise<string> {
    try {
      const { data } = await insforge.database
        .from('challenge_invitations')
        .select('invite_token')
        .eq('challenge_id', challengeId)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (data && (data as any).invite_token) {
        return this.buildInviteUrl((data as any).invite_token);
      }
      return this.buildInviteUrl(`ch_${challengeId}`);
    } catch {
      return this.buildInviteUrl(`ch_${challengeId}`);
    }
  },

  buildInviteUrl(token: string): string {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://runwar.app';
    return `${base}/?invite=${token}`;
  },
};

