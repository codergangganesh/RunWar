import { GPSCoordinate } from '../types';

export interface SmoothedGPSResult {
  coordinate: GPSCoordinate;
  justReady: boolean;
}

/**
 * A small, stateful filter for browser GPS updates.
 *
 * It waits for a short high-quality GPS lock, then uses an adaptive exponential
 * filter. Low-accuracy points are damped more heavily while faster movement is
 * allowed to respond quickly, so the route stays smooth without rounding turns.
 */
export class GPSSmoother {
  private static readonly WARMUP_SAMPLES = 3;
  // Match the tracker acceptance limit so an otherwise valid "GPS Weak" lock
  // can still begin a workout after it has stabilised across several samples.
  private static readonly WARMUP_MAX_ACCURACY_METERS = 35;

  private warmupPoints: GPSCoordinate[] = [];
  private smoothedPoint: GPSCoordinate | null = null;

  public reset(): void {
    this.warmupPoints = [];
    this.smoothedPoint = null;
  }

  public smooth(point: GPSCoordinate): SmoothedGPSResult | null {
    if (!this.smoothedPoint) {
      if ((point.accuracy ?? Number.POSITIVE_INFINITY) > GPSSmoother.WARMUP_MAX_ACCURACY_METERS) {
        return null;
      }

      this.warmupPoints.push(point);
      if (this.warmupPoints.length < GPSSmoother.WARMUP_SAMPLES) {
        return null;
      }

      this.smoothedPoint = this.createWarmupBaseline();
      this.warmupPoints = [];
      return { coordinate: this.smoothedPoint, justReady: true };
    }

    const previous = this.smoothedPoint;
    const timeDeltaSeconds = Math.max(1, (point.timestamp - previous.timestamp) / 1000);
    const reportedSpeedKmh = point.speed != null && point.speed > 0 ? point.speed * 3.6 : 0;
    const accuracy = point.accuracy ?? 35;

    // Favor recent positions for movement/turns, while damping less accurate fixes.
    const accuracyWeight = Math.min(0.78, Math.max(0.3, 1 - accuracy / 50));
    const motionWeight = Math.min(0.16, reportedSpeedKmh / 75);
    const timeWeight = timeDeltaSeconds > 5 ? 0.12 : 0;
    const alpha = Math.min(0.9, Math.max(0.32, 0.28 + accuracyWeight * 0.48 + motionWeight + timeWeight));

    this.smoothedPoint = {
      ...point,
      latitude: previous.latitude + (point.latitude - previous.latitude) * alpha,
      longitude: previous.longitude + (point.longitude - previous.longitude) * alpha,
      altitude: point.altitude ?? previous.altitude ?? null,
    };

    return { coordinate: this.smoothedPoint, justReady: false };
  }

  private createWarmupBaseline(): GPSCoordinate {
    const totalWeight = this.warmupPoints.reduce((sum, point) => sum + this.getWeight(point), 0);
    const latitude = this.warmupPoints.reduce((sum, point) => sum + point.latitude * this.getWeight(point), 0) / totalWeight;
    const longitude = this.warmupPoints.reduce((sum, point) => sum + point.longitude * this.getWeight(point), 0) / totalWeight;
    const latest = this.warmupPoints[this.warmupPoints.length - 1];

    return { ...latest, latitude, longitude };
  }

  private getWeight(point: GPSCoordinate): number {
    const accuracy = Math.max(point.accuracy ?? GPSSmoother.WARMUP_MAX_ACCURACY_METERS, 3);
    return 1 / (accuracy * accuracy);
  }
}
