import { GearItem } from '../types';
import { insforge } from '../lib/insforge';
import { toDeterministicUUID } from '../utils/uuid';

const GEAR_CACHE_KEY_PREFIX = 'runwar_cached_gear_';

const DEFAULT_SAMPLE_GEAR: GearItem[] = [
  {
    id: 'gear_default_1',
    user_id: 'guest_user',
    name: 'Road Runners',
    brand: 'Nike',
    model: 'Air Zoom Pegasus 40',
    max_distance_meters: 500000, // 500 km
    current_distance_meters: 142300, // 142.3 km
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

export const gearService = {
  getCachedGear(userId: string): GearItem[] {
    try {
      const raw = localStorage.getItem(`${GEAR_CACHE_KEY_PREFIX}${userId}`);
      if (raw) return JSON.parse(raw);
    } catch {
      // Ignored
    }
    return DEFAULT_SAMPLE_GEAR.map((g) => ({ ...g, user_id: userId }));
  },

  setCachedGear(userId: string, gear: GearItem[]) {
    try {
      localStorage.setItem(`${GEAR_CACHE_KEY_PREFIX}${userId}`, JSON.stringify(gear));
    } catch (e) {
      console.warn('Failed to cache gear:', e);
    }
  },

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

      if (error || !data || data.length === 0) {
        return this.getCachedGear(userId);
      }

      this.setCachedGear(userId, data as GearItem[]);
      return data as GearItem[];
    } catch (err) {
      console.warn('Failed to fetch gear from server, using cache:', err);
      return this.getCachedGear(userId);
    }
  },

  async addGear(userId: string, gear: Omit<GearItem, 'id' | 'user_id' | 'created_at'>): Promise<GearItem> {
    const newGear: GearItem = {
      ...gear,
      id: `gear_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      user_id: userId,
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
};
