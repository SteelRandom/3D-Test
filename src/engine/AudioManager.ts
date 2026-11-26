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
  public masterVolume = 0.8;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private engineMainOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  private noiseGain: GainNode | null = null;
  private simulatedRpm = 1100;
  private engineActive = false;

  public setMasterVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.masterVolume = clamped;
    this.muted = clamped <= 0.001;
    if (this.ctx && this.masterGain) {
      const target = this.muted ? 0.0001 : clamped * 0.85;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.04);
    }
  }

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
      this.masterGain.gain.value = this.masterVolume * 0.85;
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
    this.engineFilter.frequency.value = 180;
    this.engineFilter.Q.value = 2.6;

    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0001;

    this.engineMainOsc = ctx.createOscillator();
    this.engineMainOsc.type = 'sawtooth';
    this.engineMainOsc.frequency.value = 44;

    this.engineSubOsc = ctx.createOscillator();
    this.engineSubOsc.type = 'triangle';
    this.engineSubOsc.frequency.value = 22;

    const subGain = ctx.createGain();
    subGain.gain.value = 0.45;

    this.engineMainOsc.connect(this.engineFilter);
    this.engineSubOsc.connect(subGain);
    subGain.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    // Capa de ruido blanco para fricción mecánica y rodadura de neumáticos
    const noiseLen = Math.floor(ctx.sampleRate * 2);
    const noiseBuffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const channelData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) {
      channelData[i] = Math.random() * 2 - 1;
    }

    this.noiseSource = ctx.createBufferSource();
    this.noiseSource.buffer = noiseBuffer;
    this.noiseSource.loop = true;

    this.noiseFilter = ctx.createBiquadFilter();
    this.noiseFilter.type = 'bandpass';
    this.noiseFilter.frequency.value = 720;
    this.noiseFilter.Q.value = 0.9;

    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0.0001;

    this.noiseSource.connect(this.noiseFilter);
    this.noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.masterGain);

    this.engineMainOsc.start();
    this.engineSubOsc.start();
    this.noiseSource.start();
    this.engineActive = true;
  }

  public updateEngine(
    speedRatio: number,
    isMounted: boolean,
    isPaused: boolean,
    timeScale = 1.0,
    throttle = 0
  ): void {
    if (this.muted || !isMounted || isPaused) {
      if (this.ctx) {
        const now = this.ctx.currentTime;
        this.engineGain?.gain.setTargetAtTime(0.0001, now, 0.06);
        this.noiseGain?.gain.setTargetAtTime(0.0001, now, 0.06);
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
      !this.engineGain ||
      !this.noiseFilter ||
      !this.noiseGain
    ) {
      return;
    }

    const clampedSpeed = Math.max(0, Math.min(1, speedRatio));
    const throttleRev = Math.max(0, throttle) * 1450;
    const targetRpm = Math.min(8800, 1100 + clampedSpeed * 6250 + throttleRev);
    this.simulatedRpm += (targetRpm - this.simulatedRpm) * 0.14;

    const rpmNorm = Math.max(0, Math.min(1, (this.simulatedRpm - 1000) / 7800));
    const now = this.ctx.currentTime;
    const scalePitch = timeScale < 0.9 ? 0.65 : 1.0;

    // Oscilador de onda sierra y filtro pasa-bajos controlado por RPM simuladas
    const mainFreq = (42 + rpmNorm * 148) * scalePitch;
    const subFreq = mainFreq * 0.5;
    const cutoff = (180 + Math.pow(rpmNorm, 1.15) * 2250) * scalePitch;
    const engineVol = 0.05 + rpmNorm * 0.11;

    // Fricción de rodadura y aire proporcional a la velocidad
    const frictionNoiseVol = 0.003 + clampedSpeed * 0.032;
    const frictionCenterFreq = (480 + clampedSpeed * 1350) * scalePitch;

    this.engineMainOsc.frequency.setTargetAtTime(mainFreq, now, 0.045);
    this.engineSubOsc.frequency.setTargetAtTime(subFreq, now, 0.045);
    this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.05);
    this.engineGain.gain.setTargetAtTime(engineVol, now, 0.06);

    this.noiseFilter.frequency.setTargetAtTime(frictionCenterFreq, now, 0.06);
    this.noiseGain.gain.setTargetAtTime(frictionNoiseVol, now, 0.06);
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
    for (const node of [this.engineMainOsc, this.engineSubOsc, this.noiseSource]) {
      if (node) {
        try {
          node.stop();
        } catch {
          // noop
        }
        node.disconnect();
      }
    }
    this.engineFilter?.disconnect();
    this.engineGain?.disconnect();
    this.noiseFilter?.disconnect();
    this.noiseGain?.disconnect();
    this.masterGain?.disconnect();
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
    }
    this.ctx = null;
    this.engineActive = false;
  }
}
