export class TimeManager {
  public timeScale = 1.0;
  public isPaused = false;
  public isSlowMotion = false;

  public togglePause(): number {
    this.isPaused = !this.isPaused;
    this.syncScale();
    return this.timeScale;
  }

  public toggleSlowMotion(): number {
    this.isSlowMotion = !this.isSlowMotion;
    if (this.isSlowMotion && this.isPaused) {
      this.isPaused = false;
    }
    this.syncScale();
    return this.timeScale;
  }

  public setTimeScale(scale: number): void {
    this.timeScale = Math.max(0, scale);
    this.isPaused = this.timeScale === 0;
    this.isSlowMotion = this.timeScale > 0 && this.timeScale < 1;
  }

  private syncScale(): void {
    if (this.isPaused) {
      this.timeScale = 0;
    } else if (this.isSlowMotion) {
      this.timeScale = 0.2;
    } else {
      this.timeScale = 1.0;
    }
  }
}
