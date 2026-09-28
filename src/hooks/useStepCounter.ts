import { useState, useEffect, useCallback } from 'react';
import { StepCounterState, StepCounterOptions } from '../types/stepCounter';
import { stepCounterService } from '../services/stepCounterService';

/**
 * useStepCounter Hook
 * 
 * Provides reactive access to the StepCounterService:
 * - Real-time session steps during active workouts
 * - Today's cumulative daily steps
 * - Instantaneous and average cadence (SPM)
 * - Sensor permission status and user request trigger
 */
export function useStepCounter(options?: StepCounterOptions) {
  const [stepState, setStepState] = useState<StepCounterState>(() =>
    stepCounterService.getState()
  );

  useEffect(() => {
    const unsubscribe = stepCounterService.subscribe((newState) => {
      setStepState(newState);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const requestPermission = useCallback(async () => {
    return await stepCounterService.requestPermission();
  }, []);

  const startTracking = useCallback(
    async (workoutId: string) => {
      await stepCounterService.startSessionTracking(workoutId, options);
    },
    [options]
  );

  const pauseTracking = useCallback(() => {
    stepCounterService.pauseSessionTracking();
  }, []);

  const resumeTracking = useCallback(() => {
    stepCounterService.resumeSessionTracking();
  }, []);

  const stopTracking = useCallback(() => {
    return stepCounterService.stopSessionTracking();
  }, []);

  return {
    ...stepState,
    requestPermission,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
  };
}
