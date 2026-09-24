import { GearItem } from '../types';
import { insforge } from '../lib/insforge';
import { toDeterministicUUID } from '../utils/uuid';

const GEAR_CACHE_KEY_PREFIX = 'runwar_cached_gear_';

/**
 * Filter out any mock, placeholder, or default sample shoes
 */
function isRealUserGear(g: any): boolean {
  if (!g || typeof g !== 'object') return false;
  const idStr = String(g.id || '');
  const nameStr = String(g.name || '');
  if (idStr === 'gear_default_1' || idStr.startsWith('gear_default') || idStr.startsWith('mock_')) {
    return false;
  }
  if (nameStr === 'Road Runners') {
    return false;
  }
  if (nameStr.includes('Pegasus 40') && (g.current_distance_meters === 142300 || g.current_distance_meters === 142.3)) {
    return false;
  }
  return true;
}

export const gearService = {
  /**
   * Get cached gear from localStorage, ensuring sample/fake mock shoes are stripped out
   */
  getCachedGear(userId: string): GearItem[] {
    try {
      const raw = localStorage.getItem(`${GEAR_CACHE_KEY_PREFIX}${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter(isRealUserGear);
          // If clean list is different, update localStorage immediately to purge mock data
          if (clean.length !== parsed.length) {
            this.setCachedGear(userId, clean);
          }
          return clean;
        }
      }
    } catch {
      // Ignored
    }
    return [];
  },

  setCachedGear(userId: string, gear: GearItem[]) {
    try {
      const clean = gear.filter(isRealUserGear);
      localStorage.setItem(`${GEAR_CACHE_KEY_PREFIX}${userId}`, JSON.stringify(clean));
    } catch (e) {
      console.warn('Failed to cache gear:', e);
    }
  },

  /**
   * Upload shoe photo to InsForge storage with base64 Data URL fallback
   */
  async uploadGearImage(userId: string, file: File): Promise<string> {
    const normalizedId = toDeterministicUUID(userId);
    const fileExt = file.name.split('.').pop() || 'jpg';
    const filePath = `gear_${normalizedId}_${Date.now()}.${fileExt}`;

    try {
      const { data, error } = await insforge.storage
        .from('avatars')
        .upload(filePath, file);

      if (!error && data?.url) {
        return data.url;
      }
    } catch (err) {
      console.warn('InsForge storage upload notice, using local data URL fallback:', err);
    }

    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  },

  /**
   * Fetch real user gear from database with cache fallback
   */
  async getGear(userId: string): Promise<GearItem[]> {
    if (!userId || userId === 'guest_user' || userId === 'usr_guest_demo') {
      return this.getCachedGear(userId);
    }

    const normalizedId = toDeterministicUUID(userId);
    try {
      const { data, error } = await insforge.database
        .from('user_gear')
        .select('*')
        .eq('user_id', normalizedId)
        .order('created_at', { ascending: false });

      if (error) {
        // Table may not exist yet or connection issue, use real local cached gear
        return this.getCachedGear(userId);
      }

      if (data) {
        const realData = (data as GearItem[]).filter(isRealUserGear);
        this.setCachedGear(userId, realData);
        return realData;
      }

      return this.getCachedGear(userId);
    } catch (err) {
      console.warn('Failed to fetch gear from server, using cache:', err);
      return this.getCachedGear(userId);
    }
  },

  /**
   * Add a new pair of shoes to the user's closet
   */
  async addGear(
    userId: string,
    gear: Omit<GearItem, 'id' | 'user_id' | 'created_at'>
  ): Promise<GearItem> {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, '0')}`;

    const newGear: GearItem = {
      ...gear,
      id,
      user_id: userId,
      image_url: gear.image_url || null,
      created_at: new Date().toISOString(),
    };

    const currentList = this.getCachedGear(userId);
    let updatedList = [...currentList];

    // If new item is active, deactivate others
    if (newGear.is_active) {
      updatedList = updatedList.map((g) => ({ ...g, is_active: false }));
    }

    updatedList.unshift(newGear);
    this.setCachedGear(userId, updatedList);

    if (userId && userId !== 'guest_user' && userId !== 'usr_guest_demo') {
      try {
        const normalizedId = toDeterministicUUID(userId);
        await insforge.database.from('user_gear').insert([
          {
            id: newGear.id,
            user_id: normalizedId,
            name: newGear.name,
            brand: newGear.brand,
            model: newGear.model,
            max_distance_meters: newGear.max_distance_meters,
            current_distance_meters: newGear.current_distance_meters,
            is_active: newGear.is_active,
            image_url: newGear.image_url || null,
            notes: newGear.notes || null,
          },
        ]);
      } catch (err) {
        console.warn('Failed to persist new gear to db:', err);
      }
    }

    return newGear;
  },

  async setActiveGear(userId: string, gearId: string): Promise<GearItem[]> {
    const list = this.getCachedGear(userId).map((g) => ({
      ...g,
      is_active: g.id === gearId,
    }));
    this.setCachedGear(userId, list);

    if (userId && userId !== 'guest_user' && userId !== 'usr_guest_demo') {
      try {
        const normalizedId = toDeterministicUUID(userId);
        await insforge.database
          .from('user_gear')
          .update({ is_active: false })
          .eq('user_id', normalizedId);

        await insforge.database
          .from('user_gear')
          .update({ is_active: true })
          .eq('id', gearId);
      } catch (err) {
        console.warn('Failed to set active gear on server:', err);
      }
    }

    return list;
  },

  async addDistanceToActiveGear(userId: string, distanceMeters: number): Promise<void> {
    if (distanceMeters <= 0) return;
    const list = this.getCachedGear(userId);
    const activeIndex = list.findIndex((g) => g.is_active);
    if (activeIndex === -1) return;

    list[activeIndex].current_distance_meters += Math.round(distanceMeters);
    this.setCachedGear(userId, list);

    if (userId && userId !== 'guest_user' && userId !== 'usr_guest_demo') {
      try {
        await insforge.database
          .from('user_gear')
          .update({ current_distance_meters: list[activeIndex].current_distance_meters })
          .eq('id', list[activeIndex].id);
      } catch (err) {
        console.warn('Failed to update gear distance on server:', err);
      }
    }
  },

  async deleteGear(userId: string, gearId: string): Promise<GearItem[]> {
    const list = this.getCachedGear(userId).filter((g) => g.id !== gearId);
    this.setCachedGear(userId, list);

    if (userId && userId !== 'guest_user' && userId !== 'usr_guest_demo') {
      try {
        await insforge.database.from('user_gear').delete().eq('id', gearId);
      } catch (err) {
        console.warn('Failed to delete gear from db:', err);
      }
    }

    return list;
  },

  async updateGearImage(userId: string, gearId: string, imageUrl: string): Promise<void> {
    const list = this.getCachedGear(userId);
    const updated = list.map((g) => (g.id === gearId ? { ...g, image_url: imageUrl } : g));
    this.setCachedGear(userId, updated);

    if (userId && userId !== 'guest_user' && userId !== 'usr_guest_demo') {
      try {
        const normalizedId = toDeterministicUUID(userId);
        await insforge.database
          .from('user_gear')
          .update({ image_url: imageUrl })
          .eq('id', gearId)
          .eq('user_id', normalizedId);
      } catch (err) {
        console.warn('Failed to update gear image in db:', err);
      }
    }
  },

  async setGearDistance(userId: string, gearId: string, distanceMeters: number): Promise<GearItem[]> {
    const list = this.getCachedGear(userId);
    const updated = list.map((g) =>
      g.id === gearId ? { ...g, current_distance_meters: Math.max(0, Math.round(distanceMeters)) } : g
    );
    this.setCachedGear(userId, updated);

    if (userId && userId !== 'guest_user' && userId !== 'usr_guest_demo') {
      try {
        const normalizedId = toDeterministicUUID(userId);
        await insforge.database
          .from('user_gear')
          .update({ current_distance_meters: Math.max(0, Math.round(distanceMeters)) })
          .eq('id', gearId)
          .eq('user_id', normalizedId);
      } catch (err) {
        console.warn('Failed to set gear distance in db:', err);
      }
    }

    return updated;
  },
};

