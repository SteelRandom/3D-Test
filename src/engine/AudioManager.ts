export interface SoundPlayOptions {
  volume?: number;
  pitch?: number;
  loop?: boolean;
}

/**
 * AudioManager con síntesis procedural en Web Audio API:
 * - Motor continuo para motocicleta (volumen y pitch dinámicos según velocidad)
 * - Efectos puntuales para salto, aterrizaje fuerte, puerta y montar/desmontar
 */
export class AudioManager {
  public muted = false;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private engineMainOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private engineActive = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.75;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  private ensureEngineNodes(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.engineActive) return;

    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 210;
    this.engineFilter.Q.value = 2.4;

    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0001;

    this.engineMainOsc = ctx.createOscillator();
    this.engineMainOsc.type = 'sawtooth';
    this.engineMainOsc.frequency.value = 46;

    this.engineSubOsc = ctx.createOscillator();
    this.engineSubOsc.type = 'triangle';
    this.engineSubOsc.frequency.value = 23;

    const subGain = ctx.createGain();
    subGain.gain.value = 0.65;

    this.engineMainOsc.connect(this.engineFilter);
    this.engineSubOsc.connect(subGain);
    subGain.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineMainOsc.start();
    this.engineSubOsc.start();
    this.engineActive = true;
  }

  public updateEngine(
    speedRatio: number,
    isMounted: boolean,
    isPaused: boolean,
    timeScale = 1.0
  ): void {
    if (this.muted || !isMounted || isPaused) {
      if (this.ctx && this.engineGain) {
        const now = this.ctx.currentTime;
        this.engineGain.gain.setTargetAtTime(0.0001, now, 0.06);
      }
      return;
    }

    if (!this.engineActive) {
      this.ensureEngineNodes();
    }
    if (
      !this.ctx ||
      !this.engineMainOsc ||
      !this.engineSubOsc ||
      !this.engineFilter ||
      !this.engineGain
    ) {
      return;
    }

    const clamped = Math.max(0, Math.min(1, speedRatio));
    const now = this.ctx.currentTime;
    const scalePitch = timeScale < 0.9 ? 0.65 : 1.0;

    const mainFreq = (46 + clamped * 108) * scalePitch;
    const subFreq = mainFreq * 0.5;
    const cutoff = (210 + clamped * 980) * scalePitch;
    const gainVal = 0.055 + clamped * 0.11;

    this.engineMainOsc.frequency.setTargetAtTime(mainFreq, now, 0.05);
    this.engineSubOsc.frequency.setTargetAtTime(subFreq, now, 0.05);
    this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.06);
    this.engineGain.gain.setTargetAtTime(gainVal, now, 0.06);
  }

  public playSound(soundId: string, options?: SoundPlayOptions): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const vol = Math.max(0.01, Math.min(1, options?.volume ?? 0.6));
    const now = ctx.currentTime;

    if (soundId === 'jump') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(340, now + 0.11);
      gain.gain.setValueAtTime(vol * 0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.14);
      return;
    }

    if (soundId === 'land_hard') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(115, now);
      osc.frequency.exponentialRampToValueAtTime(36, now + 0.18);
      gain.gain.setValueAtTime(vol * 0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.21);
      return;
    }

    if (soundId === 'door_open' || soundId === 'door_close') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const startF = soundId === 'door_open' ? 220 : 310;
      const endF = soundId === 'door_open' ? 320 : 185;
      osc.frequency.setValueAtTime(startF, now);
      osc.frequency.exponentialRampToValueAtTime(endF, now + 0.14);
      gain.gain.setValueAtTime(vol * 0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.17);
      return;
    }

    if (soundId === 'mount') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(75, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.16);
      osc.frequency.exponentialRampToValueAtTime(52, now + 0.32);
      gain.gain.setValueAtTime(vol * 0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.35);
      return;
    }

    if (soundId === 'dismount') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.exponentialRampToValueAtTime(88, now + 0.14);
      gain.gain.setValueAtTime(vol * 0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.17);
    }
  }

  public dispose(): void {
    if (this.engineMainOsc) {
      try {
        this.engineMainOsc.stop();
      } catch {
        // noop
      }
      this.engineMainOsc.disconnect();
    }
    if (this.engineSubOsc) {
      try {
        this.engineSubOsc.stop();
      } catch {
        // noop
      }
      this.engineSubOsc.disconnect();
    }
    this.engineFilter?.disconnect();
    this.engineGain?.disconnect();
    this.masterGain?.disconnect();
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
    }
    this.ctx = null;
    this.engineActive = false;
  }
}
