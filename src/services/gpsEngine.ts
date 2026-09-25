import { GPSCoordinate, LiveWorkoutState, WorkoutSplit, WorkoutType } from '../types';
import { workoutEngine } from './workoutEngine';

/**
 * GPSEngine facade delegating to production WorkoutEngine
 */
export class GPSEngineFacade {
  public get isSimulationMode(): boolean {
    return workoutEngine.isSimulationMode;
  }

  public set isSimulationMode(val: boolean) {
    workoutEngine.isSimulationMode = val;
  }

  public setSimulationMode(enabled: boolean) {
    workoutEngine.setSimulationMode(enabled);
  }

  public subscribe(callback: (state: LiveWorkoutState) => void) {
    return workoutEngine.subscribe(callback);
  }

  public setOptions(weightKg: number, autoPause: boolean, autoPauseThreshold: number, userId?: string, distanceUnit: 'km' | 'mi' = 'km') {
    workoutEngine.setConfig(userId || 'guest_user', weightKg, autoPause, autoPauseThreshold, distanceUnit);
  }

  public getState(): LiveWorkoutState {
    return workoutEngine.getState();
  }

  public async startTracking(type: WorkoutType = 'run', initialCoordinates: GPSCoordinate[] = []) {
    return workoutEngine.startWorkout(type);
  }

  public pauseTracking(isAuto: boolean = false) {
    workoutEngine.pauseWorkout(isAuto);
  }

  public resumeTracking() {
    workoutEngine.resumeWorkout();
  }

  public finishTracking(): LiveWorkoutState {
    return workoutEngine.finishWorkout();
  }

  public discardWorkout() {
    workoutEngine.discardWorkout();
  }

  public reset() {
    workoutEngine.reset();
  }

  public restoreWorkout(savedState: LiveWorkoutState, autoResume?: boolean) {
    workoutEngine.restoreWorkout(savedState, autoResume);
  }

  public processNewCoordinate(coord: GPSCoordinate) {
    workoutEngine.processCoordinate(coord);
  }

  public setActiveCourse(course: any) {
    workoutEngine.setActiveCourse(course);
  }

  public startSimulation() {
    workoutEngine.startSimulation();
  }

  public stopSimulation() {
    workoutEngine.stopSimulation();
  }
}

export const gpsEngine = new GPSEngineFacade();
