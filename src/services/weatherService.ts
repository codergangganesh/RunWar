import { WeatherSnapshot } from '../types';

interface WeatherCacheEntry {
  lat: number;
  lng: number;
  timestamp: number;
  snapshot: WeatherSnapshot;
}

const WMO_CODE_MAP: Record<number, { text: string; icon: string }> = {
  0: { text: 'Clear Sky', icon: 'sun' },
  1: { text: 'Mainly Clear', icon: 'cloud-sun' },
  2: { text: 'Partly Cloudy', icon: 'cloud-sun' },
  3: { text: 'Overcast', icon: 'cloud' },
  45: { text: 'Foggy', icon: 'cloud' },
  48: { text: 'Rime Fog', icon: 'cloud' },
  51: { text: 'Light Drizzle', icon: 'cloud-rain' },
  53: { text: 'Moderate Drizzle', icon: 'cloud-rain' },
  55: { text: 'Dense Drizzle', icon: 'cloud-rain' },
  56: { text: 'Freezing Drizzle', icon: 'cloud-snow' },
  57: { text: 'Heavy Freezing Drizzle', icon: 'cloud-snow' },
  61: { text: 'Slight Rain', icon: 'cloud-rain' },
  63: { text: 'Moderate Rain', icon: 'cloud-rain' },
  65: { text: 'Heavy Rain', icon: 'cloud-rain' },
  66: { text: 'Light Freezing Rain', icon: 'cloud-snow' },
  67: { text: 'Heavy Freezing Rain', icon: 'cloud-snow' },
  71: { text: 'Slight Snow', icon: 'cloud-snow' },
  73: { text: 'Moderate Snow', icon: 'cloud-snow' },
  75: { text: 'Heavy Snow', icon: 'cloud-snow' },
  77: { text: 'Snow Grains', icon: 'cloud-snow' },
  80: { text: 'Light Showers', icon: 'cloud-rain' },
  81: { text: 'Moderate Showers', icon: 'cloud-rain' },
  82: { text: 'Violent Showers', icon: 'cloud-rain' },
  85: { text: 'Snow Showers', icon: 'cloud-snow' },
  86: { text: 'Heavy Snow Showers', icon: 'cloud-snow' },
  95: { text: 'Thunderstorm', icon: 'cloud-lightning' },
  96: { text: 'Thunderstorm with Hail', icon: 'cloud-lightning' },
  99: { text: 'Severe Thunderstorm', icon: 'cloud-lightning' },
};

class WeatherService {
  private cache: WeatherCacheEntry[] = [];
  private readonly CACHE_MAX_AGE_MS = 25 * 60 * 1000; // 25 minutes
  private readonly CACHE_DIST_KM = 3; // 3 km radius

  /**
   * Calculate distance between two lat/lng in kilometers
   */
  private getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Fetch current weather snapshot for coordinate via Open-Meteo API
   */
  public async getWeatherForLocation(lat: number, lng: number, bypassCache: boolean = false): Promise<WeatherSnapshot | null> {
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;

    // 1. Check in-memory cache if not bypassing
    const now = Date.now();
    if (!bypassCache) {
      const cached = this.cache.find(
        (c) =>
          now - c.timestamp < this.CACHE_MAX_AGE_MS &&
          this.getDistanceKm(lat, lng, c.lat, c.lng) < this.CACHE_DIST_KM
      );
      if (cached) {
        return cached.snapshot;
      }
    }

    // 2. Fetch from Open-Meteo (No API key required, 100% free open-source)
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m&timezone=auto`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Open-Meteo returned status ${res.status}`);
      }

      const data = await res.json();
      const current = data?.current;
      if (!current) return null;

      const code = current.weather_code ?? 0;
      const wmoInfo = WMO_CODE_MAP[code] || { text: 'Clear', icon: 'sun' };

      const snapshot: WeatherSnapshot = {
        temperature: Math.round(current.temperature_2m),
        apparentTemperature: Math.round(current.apparent_temperature ?? current.temperature_2m),
        conditionText: wmoInfo.text,
        conditionCode: code,
        icon: wmoInfo.icon,
        humidity: Math.round(current.relative_humidity_2m ?? 0),
        windSpeedKmh: Math.round(current.wind_speed_10m ?? 0),
        windDirectionDegrees: current.wind_direction_10m,
        isDay: current.is_day === 1,
        timestamp: now,
      };

      // Store in cache
      this.cache.push({
        lat,
        lng,
        timestamp: now,
        snapshot,
      });

      // Keep cache size trimmed
      if (this.cache.length > 10) {
        this.cache.shift();
      }

      return snapshot;
    } catch (err: any) {
      console.warn('Weather fetch failed (offline or network timeout):', err?.message || err);
      return null;
    }
  }

  /**
   * Helper to format temperature according to unit system
   */
  public formatTemp(tempC: number, unit: 'km' | 'mi' = 'km'): string {
    if (unit === 'mi') {
      const f = Math.round((tempC * 9) / 5 + 32);
      return `${f}°F`;
    }
    return `${Math.round(tempC)}°C`;
  }

  /**
   * Helper to format wind speed
   */
  public formatWind(speedKmh: number, unit: 'km' | 'mi' = 'km'): string {
    if (unit === 'mi') {
      const mph = Math.round(speedKmh * 0.621371);
      return `${mph} mph`;
    }
    return `${Math.round(speedKmh)} km/h`;
  }

  /**
   * Attempt to get current device GPS coordinates with timeout
   */
  public async getCurrentDeviceCoords(): Promise<{ lat: number; lng: number } | null> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (pos && pos.coords) {
            resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          } else {
            resolve(null);
          }
        },
        () => resolve(null),
        { timeout: 5000, enableHighAccuracy: false, maximumAge: 60000 }
      );
    });
  }

  /**
   * Helper to format observation time
   */
  public formatObservationTime(timestamp?: number): string {
    if (!timestamp) return 'Live now';
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 45) return 'Live now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

export const weatherService = new WeatherService();
