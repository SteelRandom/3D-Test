import {
  CAMERA_VIEWS,
  DOOR_CONFIG,
  HONDA_MTL_URL,
  HONDA_OBJ_URL,
  PHYSICS_CONFIG,
  SCENE_COLORS,
  SOLDIER_MODEL_URL,
  VEHICLE_CONFIG,
} from './courseConfig';
import { DEFAULT_LEVEL_JSON } from '../engine/levelData';

export function generateStandaloneHtml(): string {
  const levelJson = JSON.stringify(DEFAULT_LEVEL_JSON);
  const cameraViewsJson = JSON.stringify(CAMERA_VIEWS);
  const doorConfigJson = JSON.stringify(DOOR_CONFIG);
  const vehicleConfigJson = JSON.stringify(VEHICLE_CONFIG);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Núcleo Engine 3D · Personaje + Moto + FPS</title>
  <style>
    * {
      box-sizing: border-box;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
    }

    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: ${SCENE_COLORS.skyCss};
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      touch-action: none;
    }

    #canvas-container {
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
    }

    #crosshair {
      position: fixed;
      left: 50%;
      top: 50%;
      width: 6px;
      height: 6px;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      border: 1.5px solid rgba(15, 23, 42, 0.45);
      background: rgba(255, 255, 255, 0.75);
      pointer-events: none;
      z-index: 12;
    }

    #crosshair.active {
      width: 10px;
      height: 10px;
      border-color: #d97706;
      background: #fbbf24;
    }

    #hud-minimal {
      position: fixed;
      top: 16px;
      left: 16px;
      z-index: 15;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    #speed-card {
      display: flex;
      align-items: baseline;
      gap: 6px;
      background: rgba(2, 6, 23, 0.88);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      padding: 8px 14px;
      color: #ffffff;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.25);
    }

    #speed-value {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 24px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }

    #speed-unit {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #cbd5e1;
    }

    #interact-prompt {
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 15;
      pointer-events: none;
      padding: 6px 12px;
      border-radius: 6px;
      background: rgba(2, 6, 23, 0.9);
      border: 1px solid rgba(251, 191, 36, 0.4);
      color: #fcd34d;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.03em;
      display: none;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.25);
    }

    #interact-prompt.visible {
      display: block;
    }

    #debug-dock {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 25;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
    }

    #debug-toggle {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: rgba(2, 6, 23, 0.9);
      color: #f1f5f9;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.06em;
      box-shadow: 0 6px 18px rgba(15, 23, 42, 0.25);
    }

    #debug-panel {
      display: none;
      width: 276px;
      max-height: calc(100vh - 80px);
      overflow-y: auto;
      padding: 14px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: rgba(2, 6, 23, 0.92);
      color: #f1f5f9;
      font-size: 12px;
      line-height: 1.5;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.35);
    }

    #debug-panel.open {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    #state-readout {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      color: #cbd5e1;
      white-space: pre-line;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      padding-bottom: 8px;
    }

    #honda-parts-box {
      display: none;
      max-height: 112px;
      overflow-y: auto;
      padding: 6px;
      border-radius: 6px;
      background: rgba(15, 23, 42, 0.78);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 10px;
      line-height: 1.4;
      color: #cbd5e1;
      white-space: pre;
    }

    #honda-parts-box.visible {
      display: block;
    }

    .debug-hint {
      font-size: 11px;
      color: #94a3b8;
    }

    .debug-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }

    .debug-btn {
      cursor: pointer;
      border: 0;
      border-radius: 7px;
      padding: 6px 8px;
      background: #1e293b;
      color: #f1f5f9;
      font-size: 11px;
      font-weight: 600;
    }

    .debug-btn:hover {
      background: #334155;
    }

    .debug-btn.active {
      background: #0891b2;
      color: #ffffff;
    }

    .debug-btn.primary {
      background: #0284c7;
      color: #ffffff;
    }

    .debug-section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
    }

    #test-model-url {
      width: 100%;
      padding: 5px 8px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: #0f172a;
      color: #f1f5f9;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 10px;
      user-select: text;
      -webkit-user-select: text;
    }

    #loading-overlay {
      position: fixed;
      inset: 0;
      z-index: 30;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: ${SCENE_COLORS.skyCss};
      color: #0f172a;
      font-size: 14px;
      font-weight: 500;
      transition: opacity 240ms ease;
    }

    #loading-overlay.hidden {
      opacity: 0;
      pointer-events: none;
    }

    .loading-bar-track {
      width: 220px;
      height: 6px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.12);
      overflow: hidden;
    }

    .loading-bar-fill {
      width: 0%;
      height: 100%;
      background: #2563eb;
      transition: width 120ms linear;
    }

    /* Controles táctiles: ocultos por defecto en PC */
    #touch-controls {
      position: fixed;
      inset: 0;
      z-index: 20;
      pointer-events: none;
      display: none;
    }

    @media (hover: none) and (pointer: coarse) {
      #touch-controls {
        display: block;
      }
      #pc-hint {
        display: none;
      }
    }

    #joystick-zone {
      position: fixed;
      left: max(20px, env(safe-area-inset-left));
      bottom: max(20px, env(safe-area-inset-bottom));
      width: 132px;
      height: 132px;
      border-radius: 50%;
      background: rgba(15, 23, 42, 0.24);
      border: 2px solid rgba(255, 255, 255, 0.55);
      pointer-events: auto;
      touch-action: none;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    #joystick-knob {
      width: 54px;
      height: 54px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.35);
      transform: translate3d(0px, 0px, 0px);
      pointer-events: none;
    }

    #touch-right-cluster {
      position: fixed;
      right: max(22px, env(safe-area-inset-right));
      bottom: max(24px, env(safe-area-inset-bottom));
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 12px;
      pointer-events: none;
    }

    #touch-right-row {
      display: flex;
      align-items: flex-end;
      gap: 12px;
    }

    #interact-button {
      height: 46px;
      padding: 0 16px;
      border-radius: 999px;
      border: 2px solid rgba(255, 255, 255, 0.78);
      background: rgba(217, 119, 6, 0.94);
      color: #ffffff;
      font-size: 12px;
      font-weight: 700;
      pointer-events: auto;
      touch-action: none;
      display: none;
      cursor: pointer;
    }

    #interact-button.visible {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    #wave-button {
      width: 76px;
      height: 56px;
      border-radius: 999px;
      border: 2px solid rgba(255, 255, 255, 0.72);
      background: rgba(30, 41, 59, 0.88);
      color: #ffffff;
      font-size: 12px;
      font-weight: 700;
      pointer-events: auto;
      touch-action: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    #wave-button.active {
      background: rgba(5, 150, 105, 0.94);
    }

    #jump-button {
      width: 88px;
      height: 88px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.72);
      background: rgba(37, 99, 235, 0.88);
      color: #ffffff;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.02em;
      pointer-events: auto;
      touch-action: none;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 18px rgba(15, 23, 42, 0.32);
      cursor: pointer;
    }

    #jump-button:active,
    #jump-button.active {
      transform: scale(0.93);
      background: rgba(29, 78, 216, 0.96);
    }
  </style>

  <script type="importmap">
    {
      "imports": {
        "three": "https://unpkg.com/three@0.169.0/build/three.module.js",
        "three/addons/": "https://unpkg.com/three@0.169.0/examples/jsm/",
        "cannon-es": "https://unpkg.com/cannon-es@0.20.0/dist/cannon-es.js"
      }
    }
  </script>
</head>
<body>
  <div id="canvas-container"></div>
  <div id="crosshair" aria-hidden="true"></div>

  <div id="hud-minimal">
    <div id="speed-card">
      <span id="speed-value">0</span>
      <span id="speed-unit">km/h</span>
    </div>
  </div>
  <div id="interact-prompt">Presiona E</div>

  <aside id="debug-dock">
    <button id="debug-toggle" type="button" aria-expanded="false">DEBUG</button>
    <div id="debug-panel">
      <div id="state-readout">Animación: Idle
Suelo: En suelo
HP: 100
Vista: Estándar
Tiempo: 1x</div>
      <div id="honda-parts-box"></div>
      <div class="debug-grid">
        <button id="btn-freecam" class="debug-btn" type="button">Free-Cam (C)</button>
        <button id="btn-save" class="debug-btn" type="button">Guardar (G)</button>
        <button id="btn-load" class="debug-btn" type="button">Cargar (K)</button>
        <button id="btn-pause" class="debug-btn" type="button">Pausa (P)</button>
      </div>
      <div class="debug-section-title">
        <span>Modelos prueba (URL)</span>
        <span id="test-model-status" style="color:#7dd3fc;text-transform:none;font-weight:500;"></span>
      </div>
      <div class="debug-grid">
        <button id="btn-preset-box" class="debug-btn" type="button">BoxAnimated</button>
        <button id="btn-preset-helmet" class="debug-btn" type="button">DamagedHelmet</button>
      </div>
      <input id="test-model-url" type="url" value="https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/BoxAnimated/glTF-Binary/BoxAnimated.glb" placeholder="https://.../modelo.glb o .obj" />
      <div class="debug-grid">
        <button id="btn-load-model" class="debug-btn primary" type="button">Cargar modelo</button>
        <button id="btn-clear-model" class="debug-btn" type="button">Quitar</button>
      </div>
      <div class="debug-hint" id="pc-hint">WASD mover/conducir · Shift correr · Espacio saltar · E puerta/moto · F saludar · V vista · C free-cam · F2 FPS/TPS · P pausa · L lenta · G guardar · K cargar</div>
    </div>
  </aside>

  <div id="touch-controls">
    <div id="joystick-zone" aria-label="Joystick virtual">
      <div id="joystick-knob"></div>
    </div>
    <div id="touch-right-cluster">
      <button id="interact-button" type="button">USAR (E)</button>
      <div id="touch-right-row">
        <button id="wave-button" type="button">SALUDO</button>
        <button id="jump-button" type="button" aria-label="Saltar">SALTAR</button>
      </div>
    </div>
  </div>

  <div id="loading-overlay">
    <div id="loading-text">Cargando escena 3D (0%)...</div>
    <div class="loading-bar-track">
      <div class="loading-bar-fill" id="loading-bar"></div>
    </div>
  </div>

  <script type="module">
    import * as THREE from 'three';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
    import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
    import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
    import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
    import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
    import * as CANNON from 'cannon-es';

    const SOLDIER_URL = '${SOLDIER_MODEL_URL}';
    const HONDA_OBJ_URL = '${HONDA_OBJ_URL}';
    const HONDA_MTL_URL = '${HONDA_MTL_URL}';
    const LEVEL_JSON = ${levelJson};
    const CAMERA_VIEWS = ${cameraViewsJson};
    const DOOR_CONFIG = ${doorConfigJson};
    const VEHICLE_CONFIG = ${vehicleConfigJson};
    const FIXED_DT = ${PHYSICS_CONFIG.fixedTimeStep};
    const COYOTE_MAX = ${PHYSICS_CONFIG.coyoteMaxTime};
    const UPPER_BODY_MASK_REGEX = /spine|neck|head|shoulder|arm|forearm|hand/i;

    // =========================================================================
    // 1. Sistemas Core (Entity, EntityManager, TimeManager, AudioManager WebAudio)
    // =========================================================================
    class Entity {
      static nextIdCounter = 1;
      constructor(prefix = 'entity') {
        this.id = \`\${prefix}_\${Entity.nextIdCounter++}\`;
      }
      fixedUpdate(_fixedDt) {}
      update(_dt, _alpha) {}
      destroy() {}
    }

    class EntityManager {
      constructor() {
        this.entities = [];
      }
      add(entity) {
        this.entities.push(entity);
        return entity;
      }
      fixedUpdate(fixedDt) {
        for (let i = 0; i < this.entities.length; i++) {
          this.entities[i].fixedUpdate(fixedDt);
        }
      }
      update(dt, alpha) {
        for (let i = 0; i < this.entities.length; i++) {
          this.entities[i].update(dt, alpha);
        }
        // Espacio reservado para futuras entidades (EnemyEntity, CollectibleEntity, PhysicsPropEntity)
      }
    }

    class AudioManager {
      constructor() {
        this.muted = false;
        this.ctx = null;
        this.masterGain = null;
        this.engineMainOsc = null;
        this.engineSubOsc = null;
        this.engineFilter = null;
        this.engineGain = null;
        this.noiseSource = null;
        this.noiseFilter = null;
        this.noiseGain = null;
        this.simulatedRpm = 1100;
        this.engineActive = false;
      }

      ensureContext() {
        if (this.muted) return null;
        if (!this.ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) return null;
          this.ctx = new AudioCtx();
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.value = 0.78;
          this.masterGain.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        return this.ctx;
      }

      unlock() {
        this.ensureContext();
      }

      ensureEngineNodes() {
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

        const noiseLen = Math.floor(ctx.sampleRate * 2);
        const noiseBuffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
        const channel = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseLen; i++) channel[i] = Math.random() * 2 - 1;

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

      updateEngine(speedRatio, isMounted, isPaused, scale = 1.0, throttle = 0) {
        if (this.muted || !isMounted || isPaused) {
          if (this.ctx) {
            const now = this.ctx.currentTime;
            if (this.engineGain) this.engineGain.gain.setTargetAtTime(0.0001, now, 0.06);
            if (this.noiseGain) this.noiseGain.gain.setTargetAtTime(0.0001, now, 0.06);
          }
          return;
        }
        if (!this.engineActive) this.ensureEngineNodes();
        if (!this.ctx || !this.engineActive) return;

        const clampedSpeed = Math.max(0, Math.min(1, speedRatio));
        const throttleRev = Math.max(0, throttle) * 1450;
        const targetRpm = Math.min(8800, 1100 + clampedSpeed * 6250 + throttleRev);
        this.simulatedRpm += (targetRpm - this.simulatedRpm) * 0.14;

        const rpmNorm = Math.max(0, Math.min(1, (this.simulatedRpm - 1000) / 7800));
        const now = this.ctx.currentTime;
        const scalePitch = scale < 0.9 ? 0.65 : 1.0;

        const mainFreq = (42 + rpmNorm * 148) * scalePitch;
        const cutoff = (180 + Math.pow(rpmNorm, 1.15) * 2250) * scalePitch;
        this.engineMainOsc.frequency.setTargetAtTime(mainFreq, now, 0.045);
        this.engineSubOsc.frequency.setTargetAtTime(mainFreq * 0.5, now, 0.045);
        this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.05);
        this.engineGain.gain.setTargetAtTime(0.05 + rpmNorm * 0.11, now, 0.06);

        this.noiseFilter.frequency.setTargetAtTime((480 + clampedSpeed * 1350) * scalePitch, now, 0.06);
        this.noiseGain.gain.setTargetAtTime(0.003 + clampedSpeed * 0.032, now, 0.06);
      }

      playSound(soundId, options = {}) {
        const ctx = this.ensureContext();
        if (!ctx || !this.masterGain) return;
        const vol = Math.max(0.01, Math.min(1, options.volume ?? 0.6));
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        if (soundId === 'jump') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(160, now);
          osc.frequency.exponentialRampToValueAtTime(340, now + 0.11);
          gain.gain.setValueAtTime(vol * 0.22, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(now);
          osc.stop(now + 0.14);
        } else if (soundId === 'land_hard') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(115, now);
          osc.frequency.exponentialRampToValueAtTime(36, now + 0.18);
          gain.gain.setValueAtTime(vol * 0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(now);
          osc.stop(now + 0.21);
        } else if (soundId === 'door_open' || soundId === 'door_close') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(soundId === 'door_open' ? 220 : 310, now);
          osc.frequency.exponentialRampToValueAtTime(soundId === 'door_open' ? 320 : 185, now + 0.14);
          gain.gain.setValueAtTime(vol * 0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(now);
          osc.stop(now + 0.17);
        } else if (soundId === 'mount') {
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
        } else if (soundId === 'dismount') {
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
    }

    let timeScale = 1.0;
    const TimeManager = {
      isPaused: false,
      isSlowMotion: false,
      togglePause() {
        this.isPaused = !this.isPaused;
        this.sync();
      },
      toggleSlowMotion() {
        this.isSlowMotion = !this.isSlowMotion;
        if (this.isSlowMotion && this.isPaused) this.isPaused = false;
        this.sync();
      },
      sync() {
        timeScale = this.isPaused ? 0.0 : this.isSlowMotion ? 0.2 : 1.0;
      },
    };

    class EngineRaycaster {
      constructor() {
        this.raycaster = new THREE.Raycaster();
        this.centerNDC = new THREE.Vector2(0, 0);
      }
      castFromCameraCenter(camera, targets, maxDistance, playerOrigin) {
        this.raycaster.setFromCamera(this.centerNDC, camera);
        const hits = this.raycaster.intersectObjects(targets, true);
        if (hits.length === 0) return null;
        for (let i = 0; i < hits.length; i++) {
          const hit = hits[i];
          const distToPlayer = hit.point.distanceTo(playerOrigin);
          if (distToPlayer <= maxDistance || hit.distance <= maxDistance) {
            return hit;
          }
        }
        return null;
      }
    }

    const container = document.getElementById('canvas-container');
    const crosshair = document.getElementById('crosshair');
    const speedValueEl = document.getElementById('speed-value');
    const stateReadout = document.getElementById('state-readout');
    const hondaPartsBox = document.getElementById('honda-parts-box');
    const interactPromptEl = document.getElementById('interact-prompt');
    const debugToggle = document.getElementById('debug-toggle');
    const debugPanel = document.getElementById('debug-panel');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    const loadingBar = document.getElementById('loading-bar');
    const touchControls = document.getElementById('touch-controls');
    const interactButton = document.getElementById('interact-button');
    const waveButton = document.getElementById('wave-button');
    const jumpButton = document.getElementById('jump-button');
    const btnFreeCam = document.getElementById('btn-freecam');
    const btnSave = document.getElementById('btn-save');
    const btnLoad = document.getElementById('btn-load');
    const btnPause = document.getElementById('btn-pause');
    const btnPresetBox = document.getElementById('btn-preset-box');
    const btnPresetHelmet = document.getElementById('btn-preset-helmet');
    const testModelUrlInput = document.getElementById('test-model-url');
    const testModelStatusEl = document.getElementById('test-model-status');
    const btnLoadModel = document.getElementById('btn-load-model');
    const btnClearModel = document.getElementById('btn-clear-model');

    debugToggle.addEventListener('click', () => {
      const open = debugPanel.classList.toggle('open');
      debugToggle.setAttribute('aria-expanded', String(open));
    });

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
    if (isTouchDevice) {
      touchControls.style.display = 'block';
    }

    // 2. Escena, cámara y renderizador
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(LEVEL_JSON.skyColor);
    scene.fog = new THREE.Fog(${SCENE_COLORS.skyHex}, 28, 78);

    const camera = new THREE.PerspectiveCamera(CAMERA_VIEWS[0].fov, window.innerWidth / window.innerHeight, 0.08, 150);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // 3. Iluminación
    scene.add(new THREE.AmbientLight(0xffffff, 0.42));

    const hemiLight = new THREE.HemisphereLight(0xdde8f8, 0x9aa3ad, 0.55);
    hemiLight.position.set(0, 30, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff6ea, 1.85);
    dirLight.position.set(12, 22, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 65;
    const shadowSpan = 24;
    dirLight.shadow.camera.left = -shadowSpan;
    dirLight.shadow.camera.right = shadowSpan;
    dirLight.shadow.camera.top = shadowSpan;
    dirLight.shadow.camera.bottom = -shadowSpan;
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.02;
    scene.add(dirLight);
    scene.add(dirLight.target);

    // 4. Mundo físico Cannon-es
    const world = new CANNON.World({
      gravity: new CANNON.Vec3(0, ${PHYSICS_CONFIG.gravity}, 0),
    });
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.solver.iterations = 10;
    world.defaultContactMaterial.friction = 0;
    world.defaultContactMaterial.restitution = 0;

    const groundMat = new CANNON.Material('ground');
    const playerMat = new CANNON.Material('player');
    const vehicleMat = new CANNON.Material('vehicle');
    const ragdollMat = new CANNON.Material('ragdoll');
    world.addContactMaterial(new CANNON.ContactMaterial(groundMat, playerMat, { friction: 0.0, restitution: 0.0 }));
    world.addContactMaterial(new CANNON.ContactMaterial(groundMat, vehicleMat, { friction: 0.0, restitution: 0.0 }));
    world.addContactMaterial(new CANNON.ContactMaterial(groundMat, ragdollMat, { friction: 0.65, restitution: 0.18 }));
    world.addContactMaterial(new CANNON.ContactMaterial(vehicleMat, ragdollMat, { friction: 0.45, restitution: 0.25 }));

    const groundBody = new CANNON.Body({
      mass: 0,
      material: groundMat,
      shape: new CANNON.Plane(),
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(groundBody);

    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(LEVEL_JSON.ground.size, LEVEL_JSON.ground.size),
      new THREE.MeshStandardMaterial({
        color: LEVEL_JSON.ground.color,
        roughness: 0.92,
        metalness: 0.02,
      })
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const cameraColliders = [groundMesh];

    const obstacleMaterials = {
      block: new THREE.MeshStandardMaterial({ color: ${SCENE_COLORS.blockPrimaryHex}, roughness: 0.82, metalness: 0.05 }),
      platform: new THREE.MeshStandardMaterial({ color: ${SCENE_COLORS.blockSecondaryHex}, roughness: 0.78, metalness: 0.08 }),
      ramp: new THREE.MeshStandardMaterial({ color: ${SCENE_COLORS.rampHex}, roughness: 0.85, metalness: 0.04 }),
      cylinder: new THREE.MeshStandardMaterial({ color: ${SCENE_COLORS.cylinderHex}, roughness: 0.76, metalness: 0.1 }),
      doorFrame: new THREE.MeshStandardMaterial({ color: ${SCENE_COLORS.doorFrameHex}, roughness: 0.7, metalness: 0.2 }),
      doorLeaf: new THREE.MeshStandardMaterial({ color: ${SCENE_COLORS.doorLeafHex}, roughness: 0.55, metalness: 0.25 }),
      doorHandle: new THREE.MeshStandardMaterial({ color: ${SCENE_COLORS.doorHandleHex}, roughness: 0.25, metalness: 0.85 }),
    };

    for (const obs of LEVEL_JSON.obstacles) {
      if (obs.shape === 'box') {
        const [sx, sy, sz] = obs.size;
        const [px, py, pz] = obs.position;
        const [rx, ry, rz] = obs.rotationEuler ?? [0, 0, 0];

        const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), obstacleMaterials[obs.variant]);
        mesh.position.set(px, py, pz);
        mesh.rotation.set(rx, ry, rz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        cameraColliders.push(mesh);

        const body = new CANNON.Body({
          mass: 0,
          material: groundMat,
          shape: new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)),
        });
        body.position.set(px, py, pz);
        body.quaternion.setFromEuler(rx, ry, rz);
        world.addBody(body);
      } else {
        const segs = obs.segments ?? 24;
        const [px, py, pz] = obs.position;
        const [rx, ry, rz] = obs.rotationEuler ?? [0, 0, 0];

        const mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(obs.radiusTop, obs.radiusBottom, obs.height, segs),
          obstacleMaterials.cylinder
        );
        mesh.position.set(px, py, pz);
        mesh.rotation.set(rx, ry, rz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        cameraColliders.push(mesh);

        const body = new CANNON.Body({
          mass: 0,
          material: groundMat,
          shape: new CANNON.Cylinder(obs.radiusTop, obs.radiusBottom, obs.height, segs),
        });
        body.position.set(px, py, pz);
        body.quaternion.setFromEuler(rx, ry, rz);
        world.addBody(body);
      }
    }

    // Vectores reutilizables
    const _forward = new THREE.Vector3();
    const _right = new THREE.Vector3();
    const _moveDir = new THREE.Vector3();
    const _targetQuat = new THREE.Quaternion();
    const _upAxis = new THREE.Vector3(0, 1, 0);
    const _interpPos = new THREE.Vector3();
    const _interpQuat = new THREE.Quaternion();
    const _desiredCamPos = new THREE.Vector3();
    const _lookTarget = new THREE.Vector3();
    const _rayDir = new THREE.Vector3();
    const _playerRayOrigin = new THREE.Vector3();
    const _headWorldPos = new THREE.Vector3();
    const _fpsLookTarget = new THREE.Vector3();
    const _fpsForwardOffset = new THREE.Vector3();
    const _shakeOffset = new THREE.Vector3();
    const _bikeFwd = new THREE.Vector3();
    const _bikeRight = new THREE.Vector3();
    const _bikeQuat = new THREE.Quaternion();
    const _bikeEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    const _dismountOffset = new THREE.Vector3();
    const _cannonYAxis = new CANNON.Vec3(0, 1, 0);
    const _rayFrom = new CANNON.Vec3();
    const _rayTo = new CANNON.Vec3();
    const _dq1 = new THREE.Quaternion();
    const _dq2 = new THREE.Quaternion();
    const _dq3 = new THREE.Quaternion();
    const _forkSteerAxis = new THREE.Vector3(0, Math.cos(0.39), Math.sin(0.39)).normalize();
    const _ragInvQuat = new THREE.Quaternion();
    const _ragLocalDir = new THREE.Vector3();
    const _ragRestDir = new THREE.Vector3();
    const _ragTargetDir = new THREE.Vector3();
    const _ragDeltaQuat = new THREE.Quaternion();
    const _ragIdentityQuat = new THREE.Quaternion();
    const _wipeoutWorldPos = new THREE.Vector3();
    const _wipeoutWorldQuat = new THREE.Quaternion();
    const _wipeoutInheritVel = new THREE.Vector3();
    const _wipeoutEjectVel = new THREE.Vector3();
    const _forceVec = new CANNON.Vec3();
    const _dismountPos = new THREE.Vector3();
    const _freeCamDir = new THREE.Vector3();
    const _freeCamRight = new THREE.Vector3();
    const _freeCamEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    const _tmpVec3A = new THREE.Vector3();
    const _tmpVec3B = new THREE.Vector3();
    const _tmpVec3C = new THREE.Vector3();
    const _tmpVec3D = new THREE.Vector3();
    const _tmpBox3A = new THREE.Box3();
    const _tmpBox3B = new THREE.Box3();
    const _tmpMat4A = new THREE.Matrix4();
    const _tmpMat4B = new THREE.Matrix4();
    const _tmpMat4C = new THREE.Matrix4();
    const _tmpMat4D = new THREE.Matrix4();
    const _tmpMat4E = new THREE.Matrix4();
    const _tmpNormMat = new THREE.Matrix3();

    function dampAngle(current, target, lambda, dt) {
      let diff = (target - current) % (Math.PI * 2);
      if (diff > Math.PI) diff -= Math.PI * 2;
      if (diff < -Math.PI) diff += Math.PI * 2;
      return current + diff * (1 - Math.exp(-lambda * dt));
    }

    function normalizeBoneName(name) {
      return name
        .toLowerCase()
        .replace(/^(mixamorig|rig|bip\\d*|armature)[:_\\-.]*/i, '')
        .replace(/[^a-z0-9]/g, '');
    }

    function makeBoneRigEntry(bone) {
      const wq = new THREE.Quaternion();
      bone.getWorldQuaternion(wq);
      const inv = wq.invert();
      return {
        bone,
        pitchAxis: new THREE.Vector3(1, 0, 0).applyQuaternion(inv).normalize(),
        yawAxis: new THREE.Vector3(0, 1, 0).applyQuaternion(inv).normalize(),
        rollAxis: new THREE.Vector3(0, 0, 1).applyQuaternion(inv).normalize(),
      };
    }

    function captureTposeSnapshots(model) {
      const snaps = [];
      model.traverse((obj) => {
        if (obj.isBone) snaps.push({ bone: obj, quat: obj.quaternion.clone() });
      });
      return snaps;
    }

    function buildCharacterBoneRig(model) {
      model.updateMatrixWorld(true);
      const bones = [];
      model.traverse((obj) => {
        if (obj.isBone) bones.push({ bone: obj, norm: normalizeBoneName(obj.name) });
      });
      const findExact = (patterns) =>
        bones.find((b) => patterns.some((p) => b.norm === p))?.bone ||
        bones.find((b) => patterns.some((p) => b.norm.includes(p)))?.bone;
      const rig = {};
      const hips = findExact(['hips', 'pelvis', 'rootmotion']);
      const lu = findExact(['leftupleg', 'leftthigh', 'thighl', 'upperlegl']);
      const ru = findExact(['rightupleg', 'rightthigh', 'thighr', 'upperlegr']);
      const ll =
        bones.find((b) => b.norm === 'leftleg' || b.norm === 'leftcalf' || b.norm === 'shinl')?.bone ||
        bones.find((b) => (b.norm.includes('leftleg') || b.norm.includes('leftcalf')) && !b.norm.includes('upleg'))?.bone;
      const rl =
        bones.find((b) => b.norm === 'rightleg' || b.norm === 'rightcalf' || b.norm === 'shinr')?.bone ||
        bones.find((b) => (b.norm.includes('rightleg') || b.norm.includes('rightcalf')) && !b.norm.includes('upleg'))?.bone;
      const lf = findExact(['leftfoot', 'footl']);
      const rf = findExact(['rightfoot', 'footr']);
      const la =
        bones.find((b) => b.norm === 'leftarm' || b.norm === 'leftupperarm' || b.norm === 'upperarml')?.bone ||
        bones.find((b) => (b.norm.includes('leftarm') || b.norm.includes('leftupperarm')) && !b.norm.includes('forearm'))?.bone;
      const ra =
        bones.find((b) => b.norm === 'rightarm' || b.norm === 'rightupperarm' || b.norm === 'upperarmr')?.bone ||
        bones.find((b) => (b.norm.includes('rightarm') || b.norm.includes('rightupperarm')) && !b.norm.includes('forearm'))?.bone;
      const lfa = findExact(['leftforearm', 'leftlowerarm', 'forearml', 'lowerarml']);
      const rfa = findExact(['rightforearm', 'rightlowerarm', 'forearmr', 'lowerarmr']);
      const lh = findExact(['lefthand', 'handl']);
      const rh = findExact(['righthand', 'handr']);
      const sp = bones.find((b) => b.norm === 'spine')?.bone;
      const sp1 = bones.find((b) => b.norm === 'spine1' || b.norm === 'chest')?.bone;
      const sp2 = bones.find((b) => b.norm === 'spine2' || b.norm === 'upperchest')?.bone;
      const hd = bones.find((b) => b.norm === 'head')?.bone;

      if (hips) rig.hips = makeBoneRigEntry(hips);
      if (lu) rig.leftUpLeg = makeBoneRigEntry(lu);
      if (ru) rig.rightUpLeg = makeBoneRigEntry(ru);
      if (ll) rig.leftLeg = makeBoneRigEntry(ll);
      if (rl) rig.rightLeg = makeBoneRigEntry(rl);
      if (lf) rig.leftFoot = makeBoneRigEntry(lf);
      if (rf) rig.rightFoot = makeBoneRigEntry(rf);
      if (la) rig.leftArm = makeBoneRigEntry(la);
      if (ra) rig.rightArm = makeBoneRigEntry(ra);
      if (lfa) rig.leftForeArm = makeBoneRigEntry(lfa);
      if (rfa) rig.rightForeArm = makeBoneRigEntry(rfa);
      if (lh) rig.leftHand = makeBoneRigEntry(lh);
      if (rh) rig.rightHand = makeBoneRigEntry(rh);
      if (sp) rig.spine = makeBoneRigEntry(sp);
      if (sp1) rig.spine1 = makeBoneRigEntry(sp1);
      if (sp2) rig.spine2 = makeBoneRigEntry(sp2);
      if (hd) rig.head = makeBoneRigEntry(hd);
      return rig;
    }

    function findHeadAndVisor(model) {
      let headBone = null;
      let neckBone = null;
      const visorMeshes = [];
      model.traverse((obj) => {
        if (obj.isBone) {
          const n = obj.name.toLowerCase();
          if (!headBone && n.includes('head') && !n.includes('top_end')) {
            headBone = obj;
          } else if (!neckBone && n.includes('neck')) {
            neckBone = obj;
          }
        }
        if (obj.isMesh && obj.name.toLowerCase().includes('visor')) {
          visorMeshes.push(obj);
        }
      });
      return { headBone: headBone || neckBone, visorMeshes };
    }

    function buildUpperBodyWaveLayer(model, animations) {
      model.updateMatrixWorld(true);
      const uMixer = new THREE.AnimationMixer(model);
      const masked = [];
      const maskedSet = new Set();
      const bones = [];
      model.traverse((obj) => {
        if (obj.isBone) bones.push(obj);
      });

      const existingWave = THREE.AnimationClip.findByName(animations, 'Wave');
      if (existingWave) {
        const upperTracks = existingWave.tracks.filter((t) => UPPER_BODY_MASK_REGEX.test(t.name));
        if (upperTracks.length > 0) {
          const maskedClip = new THREE.AnimationClip('WaveMasked', existingWave.duration, upperTracks);
          for (const t of upperTracks) {
            const boneName = t.name.split('.')[0];
            const bone = bones.find((b) => b.name === boneName);
            if (bone && !maskedSet.has(bone)) {
              maskedSet.add(bone);
              masked.push({ bone, baseQuat: new THREE.Quaternion(), waveQuat: new THREE.Quaternion() });
            }
          }
          const action = uMixer.clipAction(maskedClip);
          action.loop = THREE.LoopRepeat;
          action.play();
          return { upperMixer: uMixer, maskedBones: masked };
        }
      }

      const rightArm = bones.find((b) => {
        const n = b.name.toLowerCase();
        return (n.includes('rightarm') || n.includes('rightupperarm')) && !n.includes('forearm');
      });
      const rightForeArm = bones.find((b) => {
        const n = b.name.toLowerCase();
        return n.includes('rightforearm') || n.includes('rightlowerarm');
      });
      const rightHand = bones.find((b) => b.name.toLowerCase().endsWith('righthand'));

      const tracks = [];
      const times = [0, 0.25, 0.55, 0.85, 1.1];
      const pushQuatTrack = (bone, buildQuat) => {
        if (!bone) return;
        const entry = makeBoneRigEntry(bone);
        const values = [];
        for (let i = 0; i < times.length; i++) {
          const q = buildQuat(i, entry);
          values.push(q.x, q.y, q.z, q.w);
        }
        tracks.push(new THREE.QuaternionKeyframeTrack(\`\${bone.name}.quaternion\`, times, values));
        masked.push({ bone, baseQuat: new THREE.Quaternion(), waveQuat: new THREE.Quaternion() });
      };

      pushQuatTrack(rightArm, (phase, entry) => {
        const q = entry.bone.quaternion.clone();
        const sway = phase === 1 ? -0.1 : phase === 2 ? 0.14 : phase === 3 ? -0.1 : 0.02;
        const lift = new THREE.Quaternion().setFromAxisAngle(entry.rollAxis, 2.25 + sway);
        const forward = new THREE.Quaternion().setFromAxisAngle(entry.pitchAxis, 0.32);
        return q.multiply(lift).multiply(forward);
      });
      pushQuatTrack(rightForeArm, (phase, entry) => {
        const q = entry.bone.quaternion.clone();
        const angles = [0.25, 0.65, -0.25, 0.65, 0.25];
        return q.multiply(new THREE.Quaternion().setFromAxisAngle(entry.rollAxis, angles[phase]));
      });
      pushQuatTrack(rightHand, (phase, entry) => {
        const q = entry.bone.quaternion.clone();
        const angles = [0.0, 0.28, -0.24, 0.28, 0.0];
        return q.multiply(new THREE.Quaternion().setFromAxisAngle(entry.rollAxis, angles[phase]));
      });

      if (tracks.length > 0) {
        const clip = new THREE.AnimationClip('WaveUpperBody', 1.1, tracks);
        const action = uMixer.clipAction(clip);
        action.loop = THREE.LoopRepeat;
        action.play();
      }
      return { upperMixer: uMixer, maskedBones: masked };
    }

    function applyBoneEulerDelta(entry, pitch, yaw = 0, roll = 0) {
      if (!entry) return;
      if (Math.abs(yaw) > 0.001) {
        _dq2.setFromAxisAngle(entry.yawAxis, yaw);
        entry.bone.quaternion.multiply(_dq2);
      }
      if (Math.abs(roll) > 0.001) {
        _dq3.setFromAxisAngle(entry.rollAxis, roll);
        entry.bone.quaternion.multiply(_dq3);
      }
      if (Math.abs(pitch) > 0.001) {
        _dq1.setFromAxisAngle(entry.pitchAxis, pitch);
        entry.bone.quaternion.multiply(_dq1);
      }
    }

    function applyProceduralJumpPose(rig, airBlend, verticalVel) {
      if (airBlend <= 0.005) return;
      const vyNorm = THREE.MathUtils.clamp(verticalVel / 5, -1, 1);
      const tuck = THREE.MathUtils.lerp(0.45, 1.0, (vyNorm + 1) * 0.5);
      applyBoneEulerDelta(rig.leftUpLeg, 0.78 * tuck * airBlend);
      applyBoneEulerDelta(rig.leftLeg, -1.1 * tuck * airBlend);
      applyBoneEulerDelta(rig.rightUpLeg, THREE.MathUtils.lerp(-0.12, 0.28, (vyNorm + 1) * 0.5) * airBlend);
      applyBoneEulerDelta(rig.rightLeg, -0.58 * tuck * airBlend);
      applyBoneEulerDelta(rig.spine, 0.16 * airBlend);
      applyBoneEulerDelta(rig.leftArm, 0.35 * airBlend, 0, -0.68 * airBlend);
      applyBoneEulerDelta(rig.rightArm, 0.25 * airBlend, 0, 0.68 * airBlend);
    }

    function applyMotorcycleSeatedPose(rig, steerAngle, fallbackHeadingGroup) {
      if (!rig.leftArm && !rig.rightArm && !rig.leftUpLeg && !rig.rightUpLeg) {
        if (fallbackHeadingGroup) {
          fallbackHeadingGroup.rotation.x = -0.18;
          fallbackHeadingGroup.traverse((obj) => {
            const n = obj.name.toLowerCase();
            if (n.includes('arm') || n.includes('brazo')) obj.rotation.x = 1.05;
            else if (n.includes('leg') || n.includes('pierna')) obj.rotation.x = 0.85;
          });
        }
        return;
      }
      applyBoneEulerDelta(rig.spine, -0.26, steerAngle * 0.08, 0);
      applyBoneEulerDelta(rig.spine1, -0.18, 0, 0);
      applyBoneEulerDelta(rig.spine2, -0.12, 0, 0);
      applyBoneEulerDelta(rig.head, 0.42, steerAngle * 0.08, 0);
      applyBoneEulerDelta(rig.leftUpLeg, 0.96, 0, -0.28);
      applyBoneEulerDelta(rig.rightUpLeg, 0.96, 0, 0.28);
      applyBoneEulerDelta(rig.leftLeg, -1.62, 0, 0);
      applyBoneEulerDelta(rig.rightLeg, -1.62, 0, 0);
      applyBoneEulerDelta(rig.leftFoot, 0.28, 0, 0);
      applyBoneEulerDelta(rig.rightFoot, 0.28, 0, 0);
      const steerYaw = steerAngle * 0.16;
      const steerPitch = steerAngle * 0.12;
      applyBoneEulerDelta(rig.leftArm, -steerPitch, -1.24 + steerYaw, 0.18);
      applyBoneEulerDelta(rig.rightArm, steerPitch, 1.24 + steerYaw, -0.18);
      applyBoneEulerDelta(rig.leftForeArm, 0.2, -0.24, -0.1);
      applyBoneEulerDelta(rig.rightForeArm, 0.2, 0.24, 0.1);
      applyBoneEulerDelta(rig.leftHand, 0, 0, -0.18);
      applyBoneEulerDelta(rig.rightHand, 0, 0, 0.18);
    }

    function aimRigBoneTowardLocalDir(entry, restX, restY, restZ, targetX, targetY, targetZ, blend = 0.85) {
      if (!entry) return;
      _ragRestDir.set(0, 0, 0).addScaledVector(entry.pitchAxis, restX).addScaledVector(entry.yawAxis, restY).addScaledVector(entry.rollAxis, restZ);
      _ragTargetDir.set(0, 0, 0).addScaledVector(entry.pitchAxis, targetX).addScaledVector(entry.yawAxis, targetY).addScaledVector(entry.rollAxis, targetZ);
      if (_ragRestDir.lengthSq() < 0.0001 || _ragTargetDir.lengthSq() < 0.0001) return;
      _ragRestDir.normalize();
      _ragTargetDir.normalize();
      _ragDeltaQuat.setFromUnitVectors(_ragRestDir, _ragTargetDir);
      if (blend < 0.999) _ragDeltaQuat.slerp(_ragIdentityQuat, 1 - blend);
      entry.bone.quaternion.multiply(_ragDeltaQuat);
    }

    let cachedHondaPalette = null;
    function getCachedHondaMaterialPalette() {
      if (cachedHondaPalette) return cachedHondaPalette;
      cachedHondaPalette = {
        tireMat: new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.88, metalness: 0.05 }),
        chromeMat: new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 1.0, roughness: 0.18 }),
        engineMat: new THREE.MeshStandardMaterial({ color: 0x3f3f46, metalness: 0.75, roughness: 0.42 }),
        frameMat: new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.35, roughness: 0.28 }),
        bodyworkMat: new THREE.MeshStandardMaterial({ color: 0x991b1b, metalness: 0.45, roughness: 0.24 }),
        seatMat: new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.82, metalness: 0.06 }),
        headlightMat: new THREE.MeshStandardMaterial({ color: 0xfffbeb, emissive: 0xfef3c7, emissiveIntensity: 1.8, roughness: 0.16, metalness: 0.1 }),
        tailLightMat: new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 1.8, roughness: 0.2, metalness: 0.1 }),
        indicatorMat: new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 1.15, roughness: 0.24, metalness: 0.15 }),
        neutralMat: new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.6, metalness: 0.2 }),
      };
      return cachedHondaPalette;
    }

    function resolveHondaPartMaterial(meshName, matName, palette) {
      const combined = (meshName + ' ' + matName).toLowerCase();
      if (combined.includes('stop') || combined.includes('tail') || combined.includes('rear')) return { material: palette.tailLightMat, category: 'stop-emisivo' };
      if (combined.includes('fanale') || combined.includes('headlight') || combined.includes('light') || combined.includes('lamp')) return { material: palette.headlightMat, category: 'faro-emisivo' };
      if (combined.includes('frecc')) return { material: palette.indicatorMat, category: 'intermitente' };
      if (combined.includes('gomma') || combined.includes('pneumatic') || combined.includes('tire') || combined.includes('wheel') || combined.includes('ruota')) return { material: palette.tireMat, category: 'neumatico' };
      if (combined.includes('sella') || combined.includes('seat') || combined.includes('plasticanera') || combined.includes('plastica_nera')) return { material: palette.seatMat, category: 'asiento/plastico-negro' };
      if (combined.includes('cromo') || combined.includes('crome') || combined.includes('crhome') || combined.includes('fregio') || combined.includes('chrome') || combined.includes('exhaust') || combined.includes('scarico') || combined.includes('pipe') || combined.includes('fork') || combined.includes('forcella') || combined.includes('terminali') || combined.includes('manubrio') || combined.includes('specchio') || combined.includes('cerchi') || combined.includes('raggi') || combined.includes('steel') || combined.includes('bulloni')) return { material: palette.chromeMat, category: 'cromo' };
      if (combined.includes('engine') || combined.includes('carter') || combined.includes('motore') || combined.includes('cilind') || combined.includes('block') || combined.includes('testata') || combined.includes('ingranaggio') || combined.includes('catena') || combined.includes('minuteria') || combined.includes('brake') || combined.includes('aria')) return { material: palette.engineMat, category: 'motor' };
      if (combined.includes('frame') || combined.includes('vernice') || combined.includes('telaio') || combined.includes('tank') || combined.includes('serbatoio') || combined.includes('fender') || combined.includes('parafango')) return { material: palette.frameMat, category: 'chasis-negro' };
      if (combined.includes('carrozzeria')) return { material: palette.bodyworkMat, category: 'carroceria' };
      return { material: palette.neutralMat, category: 'gris-neutro' };
    }

    function shouldHondaPartCastShadow(meshName, category, maxDim) {
      const n = meshName.toLowerCase();
      if (n.includes('bulloni') || n.includes('minuteria') || n.includes('raggi') || n.includes('vetri') || n.includes('specchio') || n.includes('cruscotto') || n.includes('tachimetri') || n.includes('fregio')) return false;
      if (category === 'stop-emisivo' || category === 'faro-emisivo' || category === 'intermitente') return false;
      return maxDim >= 0.26;
    }

    function normalizeGeometryForMerge(source, transformMatrix) {
      const geo = source.index ? source.toNonIndexed() : source.clone();
      geo.applyMatrix4(transformMatrix);
      if (!geo.getAttribute('normal')) geo.computeVertexNormals();
      for (const key of Object.keys(geo.attributes)) {
        if (key !== 'position' && key !== 'normal') geo.deleteAttribute(key);
      }
      return geo;
    }

    function mergeBucketsIntoGroup(buckets, parentGroup) {
      for (const bucket of buckets.values()) {
        if (bucket.geos.length === 0) continue;
        const merged = bucket.geos.length === 1 ? bucket.geos[0] : mergeGeometries(bucket.geos, false);
        if (bucket.geos.length > 1) {
          for (let i = 0; i < bucket.geos.length; i++) bucket.geos[i].dispose();
        }
        if (merged) {
          const mesh = new THREE.Mesh(merged, bucket.material);
          mesh.castShadow = bucket.castShadow;
          mesh.receiveShadow = bucket.castShadow;
          parentGroup.add(mesh);
        }
      }
    }

    function buildSubGeometryFromTriangles(source, triStarts, transformMatrix) {
      if (triStarts.length === 0) return null;
      const srcPos = source.getAttribute('position');
      const srcNorm = source.getAttribute('normal');
      const vCount = triStarts.length * 3;
      const posArr = new Float32Array(vCount * 3);
      const normArr = srcNorm ? new Float32Array(vCount * 3) : null;
      const normalMat = transformMatrix ? _tmpNormMat.getNormalMatrix(transformMatrix) : null;
      for (let t = 0; t < triStarts.length; t++) {
        const base = triStarts[t];
        for (let k = 0; k < 3; k++) {
          const si = base + k;
          const di = t * 3 + k;
          _tmpVec3A.fromBufferAttribute(srcPos, si);
          if (transformMatrix) _tmpVec3A.applyMatrix4(transformMatrix);
          posArr[di * 3] = _tmpVec3A.x;
          posArr[di * 3 + 1] = _tmpVec3A.y;
          posArr[di * 3 + 2] = _tmpVec3A.z;
          if (normArr && srcNorm) {
            _tmpVec3B.fromBufferAttribute(srcNorm, si);
            if (normalMat) _tmpVec3B.applyMatrix3(normalMat).normalize();
            normArr[di * 3] = _tmpVec3B.x;
            normArr[di * 3 + 1] = _tmpVec3B.y;
            normArr[di * 3 + 2] = _tmpVec3B.z;
          }
        }
      }
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
      if (normArr) out.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
      else out.computeVertexNormals();
      return out;
    }

    class TriggerSystem {
      constructor() {
        this.zones = [];
      }
      createTrigger(cfg) {
        const [px, py, pz] = cfg.position;
        const [sx, sy, sz] = cfg.size;
        if (cfg.visible) {
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(sx, sy, sz),
            new THREE.MeshBasicMaterial({ color: cfg.color ?? 0x0ea5e9, transparent: true, opacity: 0.16, depthWrite: false })
          );
          mesh.position.set(px, py, pz);
          scene.add(mesh);
        }
        const z = {
          id: cfg.id,
          label: cfg.label,
          minX: px - sx * 0.5,
          maxX: px + sx * 0.5,
          minY: py - sy * 0.5,
          maxY: py + sy * 0.5,
          minZ: pz - sz * 0.5,
          maxZ: pz + sz * 0.5,
          once: Boolean(cfg.once),
          firedOnce: false,
          inside: false,
          onEnter: cfg.onEnter,
          onStay: cfg.onStay,
          onExit: cfg.onExit,
        };
        this.zones.push(z);
        return z;
      }
      update(actorType, body, dt) {
        const ax = body.position.x, ay = body.position.y, az = body.position.z;
        for (let i = 0; i < this.zones.length; i++) {
          const z = this.zones[i];
          if (z.once && z.firedOnce) continue;
          const inside = ax >= z.minX && ax <= z.maxX && ay >= z.minY && ay <= z.maxY && az >= z.minZ && az <= z.maxZ;
          if (inside && !z.inside) {
            z.inside = true;
            if (z.once) z.firedOnce = true;
            if (z.onEnter) z.onEnter({ actorType, body });
          } else if (inside && z.inside) {
            if (z.onStay) z.onStay({ actorType, body }, dt);
          } else if (!inside && z.inside) {
            z.inside = false;
            if (z.onExit) z.onExit({ actorType });
          }
        }
      }
      reset() {
        for (let i = 0; i < this.zones.length; i++) {
          this.zones[i].inside = false;
          this.zones[i].firedOnce = false;
        }
      }
    }

    function buildProceduralMotorcycle() {
      const visualRoot = new THREE.Group();
      const interactMeshes = [];
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.65 });
      const paintMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.28, metalness: 0.48 });
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.88, metalness: 0.05 });
      const alloyMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.28, metalness: 0.82 });
      const seatMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.85, metalness: 0.05 });
      const headMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfde047, emissiveIntensity: 0.85, roughness: 0.15 });
      const tailMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.75, roughness: 0.2 });
      const dashMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x0284c7, emissiveIntensity: 0.45, roughness: 0.3 });

      const tagMesh = (m) => {
        m.castShadow = true;
        m.receiveShadow = true;
        m.userData.interactType = 'motorcycle';
        interactMeshes.push(m);
        return m;
      };

      const boxHalfY = VEHICLE_CONFIG.boxSize[1] / 2;
      const wheelR = VEHICLE_CONFIG.wheelRadius;
      const axleY = -boxHalfY + wheelR;

      const createWheel = (width) => {
        const wg = new THREE.Group();
        const tireGeo = new THREE.TorusGeometry(wheelR - 0.065, 0.068, 12, 26);
        tireGeo.rotateY(Math.PI / 2);
        wg.add(tagMesh(new THREE.Mesh(tireGeo, tireMat)));
        const rimGeo = new THREE.CylinderGeometry(wheelR - 0.11, wheelR - 0.11, width * 0.75, 16);
        rimGeo.rotateZ(Math.PI / 2);
        wg.add(tagMesh(new THREE.Mesh(rimGeo, alloyMat)));
        const spokeGeo = new THREE.BoxGeometry(width * 0.8, 0.025, (wheelR - 0.1) * 1.9);
        for (let s = 0; s < 3; s++) {
          const spoke = tagMesh(new THREE.Mesh(spokeGeo, frameMat));
          spoke.rotation.x = (s * Math.PI) / 3;
          wg.add(spoke);
        }
        return wg;
      };

      const rearWheelSpin = createWheel(0.16);
      rearWheelSpin.position.set(0, axleY, 0.7);
      visualRoot.add(rearWheelSpin);

      const engineBlock = tagMesh(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.46), frameMat));
      engineBlock.position.set(0, axleY + 0.22, -0.02);
      visualRoot.add(engineBlock);

      const swingarm = tagMesh(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.66), alloyMat));
      swingarm.position.set(0, axleY + 0.06, 0.4);
      visualRoot.add(swingarm);

      const exhaustGeo = new THREE.CylinderGeometry(0.038, 0.048, 0.84, 12);
      exhaustGeo.rotateX(Math.PI / 2);
      const exhaust = tagMesh(new THREE.Mesh(exhaustGeo, alloyMat));
      exhaust.position.set(0.21, axleY + 0.04, 0.38);
      exhaust.rotation.x = -0.12;
      visualRoot.add(exhaust);

      const tank = tagMesh(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.52), paintMat));
      tank.position.set(0, axleY + 0.48, -0.18);
      tank.rotation.x = 0.14;
      visualRoot.add(tank);

      const seat = tagMesh(new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.11, 0.54), seatMat));
      seat.position.set(0, axleY + 0.43, 0.25);
      seat.rotation.x = -0.05;
      visualRoot.add(seat);

      const tail = tagMesh(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.38), paintMat));
      tail.position.set(0, axleY + 0.46, 0.62);
      tail.rotation.x = -0.18;
      visualRoot.add(tail);

      const tailLight = tagMesh(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.05), tailMat));
      tailLight.position.set(0, axleY + 0.48, 0.81);
      visualRoot.add(tailLight);

      const frontForkPivot = new THREE.Group();
      frontForkPivot.position.set(0, axleY + 0.46, -0.46);
      visualRoot.add(frontForkPivot);

      const forkGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.66, 10);
      const lf = tagMesh(new THREE.Mesh(forkGeo, alloyMat));
      lf.position.set(-0.11, -0.22, -0.11);
      lf.rotation.x = 0.38;
      frontForkPivot.add(lf);
      const rf = tagMesh(new THREE.Mesh(forkGeo, alloyMat));
      rf.position.set(0.11, -0.22, -0.11);
      rf.rotation.x = 0.38;
      frontForkPivot.add(rf);

      const frontWheelSpin = createWheel(0.13);
      frontWheelSpin.position.set(0, -0.46, -0.24);
      frontForkPivot.add(frontWheelSpin);

      const handlebarCross = tagMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.68, 10), alloyMat));
      handlebarCross.rotation.z = Math.PI / 2;
      handlebarCross.position.set(0, 0.19, 0.05);
      frontForkPivot.add(handlebarCross);

      const gripGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.14, 10);
      gripGeo.rotateZ(Math.PI / 2);
      const leftGrip = tagMesh(new THREE.Mesh(gripGeo, seatMat));
      leftGrip.position.set(-0.3, 0.19, 0.06);
      leftGrip.rotation.y = 0.14;
      frontForkPivot.add(leftGrip);
      const rightGrip = tagMesh(new THREE.Mesh(gripGeo, seatMat));
      rightGrip.position.set(0.3, 0.19, 0.06);
      rightGrip.rotation.y = -0.14;
      frontForkPivot.add(rightGrip);

      const dashPod = tagMesh(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.08), dashMat));
      dashPod.position.set(0, 0.22, -0.06);
      dashPod.rotation.x = -0.55;
      frontForkPivot.add(dashPod);

      const headlight = tagMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.09, 16), headMat));
      headlight.rotation.x = Math.PI / 2;
      headlight.position.set(0, 0.07, -0.14);
      frontForkPivot.add(headlight);

      return { visualRoot, frontForkPivot, frontWheelSpin, rearWheelSpin, interactMeshes };
    }

    let shakeIntensity = 0;
    let shakeDuration = 0;
    let shakeTimer = 0;
    function triggerCameraShake(intensity, duration) {
      shakeIntensity = Math.max(shakeIntensity, intensity);
      shakeDuration = Math.max(duration, 0.01);
      shakeTimer = shakeDuration;
    }

    // =========================================================================
    // 5. Entidades (DoorEntity, MotorcycleEntity y PlayerEntity)
    // =========================================================================
    class DoorEntity extends Entity {
      constructor(cfg, audio) {
        super('door');
        this.audio = audio;
        this.doorOpen = false;
        this.currentAngle = 0;

        const [doorX, doorY, doorZ] = cfg.position;
        this.doorY = doorY;
        this.openW = cfg.openingWidth;
        this.openH = cfg.openingHeight;
        const frameT = cfg.frameThickness;
        const frameD = cfg.frameDepth;
        const leafT = cfg.leafThickness;

        const doorRoot = new THREE.Group();
        scene.add(doorRoot);

        const postGeo = new THREE.BoxGeometry(frameT, this.openH, frameD);
        const lintelGeo = new THREE.BoxGeometry(this.openW + frameT * 2, frameT, frameD);
        const leafGeo = new THREE.BoxGeometry(this.openW, this.openH, leafT);
        const handleGeo = new THREE.BoxGeometry(0.14, 0.04, leafT + 0.08);

        const leftPost = new THREE.Mesh(postGeo, obstacleMaterials.doorFrame);
        leftPost.position.set(doorX - this.openW / 2 - frameT / 2, doorY + this.openH / 2, doorZ);
        leftPost.castShadow = true;
        leftPost.receiveShadow = true;
        const rightPost = new THREE.Mesh(postGeo, obstacleMaterials.doorFrame);
        rightPost.position.set(doorX + this.openW / 2 + frameT / 2, doorY + this.openH / 2, doorZ);
        rightPost.castShadow = true;
        rightPost.receiveShadow = true;
        const lintel = new THREE.Mesh(lintelGeo, obstacleMaterials.doorFrame);
        lintel.position.set(doorX, doorY + this.openH + frameT / 2, doorZ);
        lintel.castShadow = true;
        lintel.receiveShadow = true;
        doorRoot.add(leftPost, rightPost, lintel);
        cameraColliders.push(leftPost, rightPost, lintel);

        const addFrameBody = (px, py, pz, sx, sy, sz) => {
          const b = new CANNON.Body({ mass: 0, material: groundMat, shape: new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)) });
          b.position.set(px, py, pz);
          world.addBody(b);
        };
        addFrameBody(leftPost.position.x, leftPost.position.y, leftPost.position.z, frameT, this.openH, frameD);
        addFrameBody(rightPost.position.x, rightPost.position.y, rightPost.position.z, frameT, this.openH, frameD);
        addFrameBody(lintel.position.x, lintel.position.y, lintel.position.z, this.openW + frameT * 2, frameT, frameD);

        this.hingeX = doorX - this.openW / 2;
        this.hingeZ = doorZ;
        this.pivot = new THREE.Group();
        this.pivot.position.set(this.hingeX, doorY, this.hingeZ);
        doorRoot.add(this.pivot);

        this.leafMesh = new THREE.Mesh(leafGeo, obstacleMaterials.doorLeaf);
        this.leafMesh.position.set(this.openW / 2, this.openH / 2, 0);
        this.leafMesh.castShadow = true;
        this.leafMesh.receiveShadow = true;
        this.leafMesh.userData.interactType = 'door';
        this.pivot.add(this.leafMesh);
        cameraColliders.push(this.leafMesh);

        this.handleMesh = new THREE.Mesh(handleGeo, obstacleMaterials.doorHandle);
        this.handleMesh.position.set(this.openW - 0.18, 1.05, 0);
        this.handleMesh.castShadow = true;
        this.handleMesh.userData.interactType = 'door';
        this.pivot.add(this.handleMesh);

        this.leafBody = new CANNON.Body({
          mass: 0,
          material: groundMat,
          shape: new CANNON.Box(new CANNON.Vec3(this.openW / 2, this.openH / 2, leafT / 2)),
        });
        this.leafBody.position.set(this.hingeX + this.openW / 2, doorY + this.openH / 2, this.hingeZ);
        world.addBody(this.leafBody);
        this.interactTargets = [this.leafMesh, this.handleMesh];
      }

      toggle() {
        this.doorOpen = !this.doorOpen;
        this.audio.playSound(this.doorOpen ? 'door_open' : 'door_close', { volume: 0.7 });
      }

      fixedUpdate(fixedDt) {
        const targetAngle = this.doorOpen ? Math.PI / 2 : 0;
        this.currentAngle = THREE.MathUtils.damp(this.currentAngle, targetAngle, 9, fixedDt);
        const halfW = this.openW / 2;
        this.leafBody.position.set(
          this.hingeX + halfW * Math.cos(this.currentAngle),
          this.doorY + this.openH / 2,
          this.hingeZ - halfW * Math.sin(this.currentAngle)
        );
        this.leafBody.quaternion.setFromAxisAngle(_cannonYAxis, this.currentAngle);
      }

      update() {
        this.pivot.rotation.y = this.currentAngle;
      }
    }

    class MotorcycleEntity extends Entity {
      constructor(driveInput, audio, onWipeout) {
        super('motorcycle');
        this.driveInput = driveInput;
        this.audio = audio;
        this.onWipeout = onWipeout;
        this.isMounted = false;
        this.currentForwardSpeed = 0;
        this.prevMountedSpeed = 0;
        this.smoothSteerAngle = 0;
        this.smoothYawRate = 0;
        this.leanAngle = 0;
        this.wheelieAngle = 0;
        this.wheeliePitchVel = 0;
        this.wasWheelieActive = false;
        this.headingYaw = VEHICLE_CONFIG.spawnYaw;
        this.wheelSpinAngle = 0;
        this.minAirborneVy = 0;
        this.isGrounded = true;
        this.rearAxleZ = 0.622;
        this.pendingWipeoutReason = null;

        const [sx, sy, sz] = VEHICLE_CONFIG.boxSize;
        const [px, py, pz] = VEHICLE_CONFIG.spawnPosition;

        this.body = new CANNON.Body({
          mass: VEHICLE_CONFIG.mass,
          material: vehicleMat,
          allowSleep: false,
          linearDamping: 0.0,
          angularDamping: 0.88,
        });
        this.body.angularFactor.set(0, 1, 0);
        this.body.addShape(new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)));
        this.body.position.set(px, py, pz);
        this.body.quaternion.setFromAxisAngle(_cannonYAxis, VEHICLE_CONFIG.spawnYaw);
        world.addBody(this.body);

        this.previousPosition = new THREE.Vector3(px, py, pz);
        this.currentPosition = new THREE.Vector3(px, py, pz);
        this.interpolatedPosition = new THREE.Vector3(px, py, pz);
        this.previousQuaternion = new THREE.Quaternion(this.body.quaternion.x, this.body.quaternion.y, this.body.quaternion.z, this.body.quaternion.w);
        this.currentQuaternion = new THREE.Quaternion().copy(this.previousQuaternion);
        this.interpolatedQuaternion = new THREE.Quaternion().copy(this.previousQuaternion);

        this.group = new THREE.Group();
        this.leanGroup = new THREE.Group();
        this.leanGroup.position.set(0, -sy / 2, 0);
        this.wheeliePivot = new THREE.Group();
        this.wheeliePivot.position.set(0, 0, this.rearAxleZ);
        this.bikeOffsetGroup = new THREE.Group();
        this.bikeOffsetGroup.position.set(0, sy / 2, -this.rearAxleZ);
        this.seatAnchor = new THREE.Group();
        this.seatAnchor.position.set(0, -sy / 2 + 0.78, 0.28);

        this.group.add(this.leanGroup);
        this.leanGroup.add(this.wheeliePivot);
        this.wheeliePivot.add(this.bikeOffsetGroup);
        this.bikeOffsetGroup.add(this.seatAnchor);
        scene.add(this.group);

        const hitProxy = new THREE.Mesh(
          new THREE.BoxGeometry(sx * 1.35, sy * 1.35, sz * 1.12),
          new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
        );
        hitProxy.position.set(0, 0.14, 0);
        hitProxy.userData.interactType = 'motorcycle';
        this.group.add(hitProxy);

        this.proceduralRig = buildProceduralMotorcycle();
        this.bikeOffsetGroup.add(this.proceduralRig.visualRoot);
        this.interactTargets = [hitProxy];
        this.modelRoot = null;
        this.modelFrontWheel = null;
        this.modelRearWheel = null;
        this.modelFork = null;
      }

      attachHondaObjModel(rawModel) {
        const palette = getCachedHondaMaterialPalette();
        const bikeRoot = new THREE.Group();
        const scaleWrapper = new THREE.Group();
        bikeRoot.add(scaleWrapper);
        scaleWrapper.add(rawModel);

        rawModel.position.set(0, 0, 0);
        rawModel.rotation.set(0, 0, 0);
        rawModel.updateMatrixWorld(true);
        let headlightZ = 0;
        let tailLightZ = 0;
        const allMeshes = [];
        const partLogMap = new Map();
        rawModel.traverse((child) => {
          if (child.isMesh) {
            const n = child.name.toLowerCase();
            if (n.includes('fanale')) {
              _tmpBox3B.setFromObject(child);
              headlightZ = _tmpBox3B.getCenter(_tmpVec3A).z;
            } else if (n.includes('stop')) {
              _tmpBox3B.setFromObject(child);
              tailLightZ = _tmpBox3B.getCenter(_tmpVec3A).z;
            }
            allMeshes.push(child);
          }
        });
        if (headlightZ > tailLightZ) rawModel.rotation.y = Math.PI;

        scaleWrapper.updateMatrixWorld(true);
        _tmpBox3A.setFromObject(scaleWrapper, true);
        _tmpBox3A.getSize(_tmpVec3A);
        const maxHoriz = Math.max(_tmpVec3A.x, _tmpVec3A.z, 0.001);
        const uniformScale = VEHICLE_CONFIG.boxSize[2] / maxHoriz;
        scaleWrapper.scale.setScalar(uniformScale);
        _tmpBox3A.getCenter(_tmpVec3B);
        scaleWrapper.position.set(
          -_tmpVec3B.x * uniformScale,
          -VEHICLE_CONFIG.boxSize[1] / 2 - _tmpBox3A.min.y * uniformScale,
          -_tmpVec3B.z * uniformScale
        );
        bikeRoot.updateMatrixWorld(true);

        const matCategories = new Map();
        const matIdMap = new Map();
        let nextMatId = 1;
        const getMatKey = (mat, castShadow) => {
          let id = matIdMap.get(mat);
          if (!id) {
            id = String(nextMatId++);
            matIdMap.set(mat, id);
          }
          return \`\${id}|\${castShadow ? 1 : 0}\`;
        };

        const seatBox = _tmpBox3B.makeEmpty();
        let hasSeatMesh = false;
        const frontTireBox = new THREE.Box3();
        const rearTireBox = new THREE.Box3();
        _tmpMat4A.copy(bikeRoot.matrixWorld).invert();

        for (let m = 0; m < allMeshes.length; m++) {
          const child = allMeshes[m];
          const meshLabel = child.name || '(sin-nombre)';
          const meshLower = meshLabel.toLowerCase();
          const oldMat = Array.isArray(child.material) ? child.material[0] : child.material;
          const mName = oldMat?.name ?? '';
          const res = resolveHondaPartMaterial(meshLabel, mName, palette);
          partLogMap.set(\`\${meshLabel} | \${mName || '(default)'}\`, res.category);
          if (Array.isArray(child.material)) child.material.forEach((om) => om?.dispose());
          else oldMat?.dispose();
          child.material = res.material;
          matCategories.set(child, res.category);

          if (meshLower.includes('sella')) {
            seatBox.expandByObject(child);
            hasSeatMesh = true;
          }
          if (meshLower.includes('pneumatici')) {
            _tmpMat4B.multiplyMatrices(_tmpMat4A, child.matrixWorld);
            const posAttr = child.geometry.getAttribute('position');
            for (let i = 0; i < posAttr.count; i++) {
              _tmpVec3A.fromBufferAttribute(posAttr, i).applyMatrix4(_tmpMat4B);
              if (_tmpVec3A.z < -0.15) frontTireBox.expandByPoint(_tmpVec3A);
              else if (_tmpVec3A.z > 0.15) rearTireBox.expandByPoint(_tmpVec3A);
            }
          }
        }

        const partsList = Array.from(partLogMap.entries()).map(([pair, cat]) => \`\${pair} -> \${cat}\`);
        console.log('[Honda CB 750] Nombres únicos mesh/material detectados:', partsList);
        hondaPartsBox.textContent = partsList.join('\\n');
        hondaPartsBox.classList.add('visible');

        if (hasSeatMesh && !seatBox.isEmpty()) {
          seatBox.getSize(_tmpVec3A);
          this.seatAnchor.position.set(0, seatBox.min.y + _tmpVec3A.y * 0.38, seatBox.min.z + _tmpVec3A.z * 0.34);
        } else {
          const minY = -VEHICLE_CONFIG.boxSize[1] / 2;
          const sizeY = (_tmpBox3A.max.y - _tmpBox3A.min.y) * uniformScale;
          const sizeZ = (_tmpBox3A.max.z - _tmpBox3A.min.z) * uniformScale;
          this.seatAnchor.position.set(0, minY + sizeY * 0.62, -sizeZ * 0.5 + sizeZ * 0.64);
        }

        const frontAxle = frontTireBox.isEmpty() ? _tmpVec3C.set(0, -0.221, -0.701) : frontTireBox.getCenter(_tmpVec3C);
        const rearAxle = rearTireBox.isEmpty() ? _tmpVec3D.set(0, -0.208, 0.622) : rearTireBox.getCenter(_tmpVec3D);

        this.rearAxleZ = rearAxle.z;
        this.wheeliePivot.position.set(0, 0, this.rearAxleZ);
        this.bikeOffsetGroup.position.set(0, VEHICLE_CONFIG.boxSize[1] / 2, -this.rearAxleZ);

        const forkPivot = new THREE.Group();
        forkPivot.position.set(0, 0.36, -0.45);
        bikeRoot.add(forkPivot);

        const frontWheelSpin = new THREE.Group();
        frontWheelSpin.position.set(0, frontAxle.y - forkPivot.position.y, frontAxle.z - forkPivot.position.z);
        forkPivot.add(frontWheelSpin);

        const rearWheelSpin = new THREE.Group();
        rearWheelSpin.position.set(0, rearAxle.y, rearAxle.z);
        bikeRoot.add(rearWheelSpin);

        bikeRoot.updateMatrixWorld(true);
        _tmpMat4A.copy(bikeRoot.matrixWorld).invert();
        _tmpMat4B.copy(forkPivot.matrixWorld).invert();
        _tmpMat4C.copy(frontWheelSpin.matrixWorld).invert();
        _tmpMat4D.copy(rearWheelSpin.matrixWorld).invert();

        const staticBuckets = new Map();
        const forkBuckets = new Map();
        const frontWheelBuckets = new Map();
        const rearWheelBuckets = new Map();
        const pushToBucket = (buckets, mat, castShadow, geo) => {
          if (!geo) return;
          const key = getMatKey(mat, castShadow);
          let entry = buckets.get(key);
          if (!entry) {
            entry = { material: mat, castShadow, geos: [] };
            buckets.set(key, entry);
          }
          entry.geos.push(geo);
        };

        const vA = new THREE.Vector3();
        const vB = new THREE.Vector3();
        const vC = new THREE.Vector3();
        const centroid = new THREE.Vector3();

        for (let m = 0; m < allMeshes.length; m++) {
          const mesh = allMeshes[m];
          const n = mesh.name.toLowerCase();
          const mat = mesh.material;
          const cat = matCategories.get(mesh) ?? 'gris-neutro';
          mesh.geometry.computeBoundingBox();
          const bb = mesh.geometry.boundingBox;
          const maxMeshDim = bb ? Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) * uniformScale : 0.4;
          const castShadow = shouldHondaPartCastShadow(mesh.name, cat, maxMeshDim);
          const isTrueWheel = n.includes('pneumatici') || n.includes('cerchi') || n.includes('crhome') || n.includes('brake');

          if (isTrueWheel && !mesh.geometry.index) {
            const posAttr = mesh.geometry.getAttribute('position');
            _tmpMat4E.multiplyMatrices(_tmpMat4A, mesh.matrixWorld);
            const frontTris = [], rearTris = [], staticTris = [];
            const isTire = n.includes('pneumatici');
            const maxR = isTire ? 0.34 : n.includes('brake') ? 0.19 : 0.255;
            const maxX = isTire ? 0.08 : n.includes('brake') ? 0.075 : 0.068;
            for (let i = 0; i + 2 < posAttr.count; i += 3) {
              vA.fromBufferAttribute(posAttr, i).applyMatrix4(_tmpMat4E);
              vB.fromBufferAttribute(posAttr, i + 1).applyMatrix4(_tmpMat4E);
              vC.fromBufferAttribute(posAttr, i + 2).applyMatrix4(_tmpMat4E);
              centroid.copy(vA).add(vB).add(vC).multiplyScalar(1 / 3);
              const dFront = Math.hypot(centroid.y - frontAxle.y, centroid.z - frontAxle.z);
              const dRear = Math.hypot(centroid.y - rearAxle.y, centroid.z - rearAxle.z);
              if (Math.abs(centroid.x) < maxX && dFront < maxR) frontTris.push(i);
              else if (Math.abs(centroid.x) < maxX && dRear < maxR && !n.includes('brake')) rearTris.push(i);
              else staticTris.push(i);
            }
            if (frontTris.length > 0) {
              _tmpMat4E.multiplyMatrices(_tmpMat4C, mesh.matrixWorld);
              pushToBucket(frontWheelBuckets, mat, isTire, buildSubGeometryFromTriangles(mesh.geometry, frontTris, _tmpMat4E));
            }
            if (rearTris.length > 0) {
              _tmpMat4E.multiplyMatrices(_tmpMat4D, mesh.matrixWorld);
              pushToBucket(rearWheelBuckets, mat, isTire, buildSubGeometryFromTriangles(mesh.geometry, rearTris, _tmpMat4E));
            }
            if (staticTris.length > 0) {
              _tmpMat4E.multiplyMatrices(_tmpMat4A, mesh.matrixWorld);
              pushToBucket(staticBuckets, mat, castShadow, buildSubGeometryFromTriangles(mesh.geometry, staticTris, _tmpMat4E));
            }
            mesh.geometry.dispose();
            continue;
          }
          if (n.includes('manubrio') && !mesh.geometry.index) {
            const posAttr = mesh.geometry.getAttribute('position');
            _tmpMat4E.multiplyMatrices(_tmpMat4A, mesh.matrixWorld);
            const upperTris = [], fixedTris = [];
            for (let i = 0; i + 2 < posAttr.count; i += 3) {
              vA.fromBufferAttribute(posAttr, i).applyMatrix4(_tmpMat4E);
              vB.fromBufferAttribute(posAttr, i + 1).applyMatrix4(_tmpMat4E);
              vC.fromBufferAttribute(posAttr, i + 2).applyMatrix4(_tmpMat4E);
              centroid.copy(vA).add(vB).add(vC).multiplyScalar(1 / 3);
              if (centroid.y > 0.31 && centroid.z < -0.14) upperTris.push(i);
              else fixedTris.push(i);
            }
            if (upperTris.length > 0) {
              _tmpMat4E.multiplyMatrices(_tmpMat4B, mesh.matrixWorld);
              pushToBucket(forkBuckets, mat, false, buildSubGeometryFromTriangles(mesh.geometry, upperTris, _tmpMat4E));
            }
            if (fixedTris.length > 0) {
              _tmpMat4E.multiplyMatrices(_tmpMat4A, mesh.matrixWorld);
              pushToBucket(staticBuckets, mat, false, buildSubGeometryFromTriangles(mesh.geometry, fixedTris, _tmpMat4E));
            }
            mesh.geometry.dispose();
            continue;
          }
          if (n.includes('fanale') || n.includes('tachimetri') || n.includes('cruscotto') || n.includes('vetri') || n.includes('specchio')) {
            _tmpMat4E.multiplyMatrices(_tmpMat4B, mesh.matrixWorld);
            pushToBucket(forkBuckets, mat, false, normalizeGeometryForMerge(mesh.geometry, _tmpMat4E));
          } else {
            _tmpMat4E.multiplyMatrices(_tmpMat4A, mesh.matrixWorld);
            pushToBucket(staticBuckets, mat, castShadow, normalizeGeometryForMerge(mesh.geometry, _tmpMat4E));
          }
          mesh.geometry.dispose();
        }

        bikeRoot.remove(scaleWrapper);
        mergeBucketsIntoGroup(staticBuckets, bikeRoot);
        mergeBucketsIntoGroup(forkBuckets, forkPivot);
        mergeBucketsIntoGroup(frontWheelBuckets, frontWheelSpin);
        mergeBucketsIntoGroup(rearWheelBuckets, rearWheelSpin);

        this.modelFork = forkPivot;
        this.modelFrontWheel = frontWheelSpin;
        this.modelRearWheel = rearWheelSpin;
        this.modelRoot = bikeRoot;
        this.proceduralRig.visualRoot.visible = false;
        this.bikeOffsetGroup.add(bikeRoot);
      }

      triggerWipeout(reason, vFwdBefore) {
        if (!this.isMounted) return;
        this.seatAnchor.updateMatrixWorld(true);
        this.seatAnchor.getWorldPosition(_wipeoutWorldPos);
        this.seatAnchor.getWorldQuaternion(_wipeoutWorldQuat);
        _bikeQuat.set(this.body.quaternion.x, this.body.quaternion.y, this.body.quaternion.z, this.body.quaternion.w);
        _bikeFwd.set(0, 0, -1).applyQuaternion(_bikeQuat);
        _bikeFwd.y = 0;
        if (_bikeFwd.lengthSq() > 0.0001) _bikeFwd.normalize();
        const baseSpeed = Math.max(vFwdBefore, this.currentForwardSpeed);
        _wipeoutInheritVel.set(_bikeFwd.x * baseSpeed, Math.max(0, this.body.velocity.y), _bikeFwd.z * baseSpeed);
        if (reason === 'wheelie') _wipeoutEjectVel.set(-_bikeFwd.x * 1.4, 3.4, -_bikeFwd.z * 1.4);
        else _wipeoutEjectVel.set(_bikeFwd.x * 3.8, 4.1, _bikeFwd.z * 3.8);
        this.isMounted = false;
        this.wasWheelieActive = false;
        this.wheeliePitchVel = -1.6;
        this.pendingWipeoutReason = reason;
      }

      capturePostStep() {
        this.currentPosition.set(this.body.position.x, this.body.position.y, this.body.position.z);
        this.currentQuaternion.set(this.body.quaternion.x, this.body.quaternion.y, this.body.quaternion.z, this.body.quaternion.w);
        if (!this.isGrounded) {
          this.minAirborneVy = Math.min(this.minAirborneVy, this.body.velocity.y);
        }
      }

      evaluateGrounded() {
        for (let i = 0; i < world.contacts.length; i++) {
          const c = world.contacts[i];
          if (c.bi === this.body && -c.ni.y > 0.4) return true;
          if (c.bj === this.body && c.ni.y > 0.4) return true;
        }
        let hit = false;
        _rayFrom.set(this.body.position.x, this.body.position.y, this.body.position.z);
        _rayTo.set(this.body.position.x, this.body.position.y - (VEHICLE_CONFIG.boxSize[1] / 2 + 0.16), this.body.position.z);
        world.raycastAll(_rayFrom, _rayTo, { skipBackfaces: true }, (res) => {
          if (res.body && res.body !== this.body && res.hitNormalWorld.y > 0.4) hit = true;
        });
        return hit;
      }

      fixedUpdate(fixedDt) {
        this.previousPosition.set(this.body.position.x, this.body.position.y, this.body.position.z);
        this.previousQuaternion.set(this.body.quaternion.x, this.body.quaternion.y, this.body.quaternion.z, this.body.quaternion.w);

        const wasGrounded = this.isGrounded;
        if (!wasGrounded) this.minAirborneVy = Math.min(this.minAirborneVy, this.body.velocity.y);
        const touchingGround = this.evaluateGrounded();
        if (touchingGround && this.body.velocity.y <= 1.2) {
          this.isGrounded = true;
          if (!wasGrounded) {
            const impactVy = Math.min(this.minAirborneVy, this.body.velocity.y);
            if (impactVy < -7.0) {
              const factor = THREE.MathUtils.clamp((-impactVy - 7) / 7, 0.4, 1.15);
              triggerCameraShake(0.12 * factor, 0.25);
              this.audio.playSound('land_hard', { volume: 0.85 });
              if (this.isMounted && impactVy < -11.5) this.triggerWipeout('crash', this.currentForwardSpeed);
            }
            this.minAirborneVy = 0;
          }
        } else {
          this.isGrounded = false;
          this.minAirborneVy = Math.min(this.minAirborneVy, this.body.velocity.y);
        }

        _bikeQuat.set(this.body.quaternion.x, this.body.quaternion.y, this.body.quaternion.z, this.body.quaternion.w);
        _bikeFwd.set(0, 0, -1).applyQuaternion(_bikeQuat);
        _bikeFwd.y = 0;
        if (_bikeFwd.lengthSq() > 0.0001) _bikeFwd.normalize();
        _bikeRight.set(1, 0, 0).applyQuaternion(_bikeQuat);
        _bikeRight.y = 0;
        if (_bikeRight.lengthSq() > 0.0001) _bikeRight.normalize();

        let vFwd = this.body.velocity.x * _bikeFwd.x + this.body.velocity.z * _bikeFwd.z;
        let vLat = this.body.velocity.x * _bikeRight.x + this.body.velocity.z * _bikeRight.z;

        if (this.isMounted) {
          if (this.prevMountedSpeed - vFwd > VEHICLE_CONFIG.crashDeltaSpeed) {
            this.triggerWipeout('crash', this.prevMountedSpeed);
            return;
          }
          const throttle = this.driveInput.throttle;
          const steer = this.driveInput.steer;
          const pullBack = throttle < -0.15 ? Math.abs(throttle) : 0;
          const canWheelie = pullBack > 0 && (this.isGrounded || this.wheelieAngle > 0.04) && (vFwd > VEHICLE_CONFIG.wheelieMinSpeed || this.wheelieAngle > 0.06);

          if (throttle > 0.05) {
            const speedNorm = THREE.MathUtils.clamp(Math.abs(vFwd) / VEHICLE_CONFIG.maxForwardSpeed, 0, 1);
            const torqueCurve = 1.15 - speedNorm * 0.45;
            vFwd = Math.min(VEHICLE_CONFIG.maxForwardSpeed * throttle, vFwd + VEHICLE_CONFIG.accel * torqueCurve * throttle * fixedDt);
          } else if (canWheelie) {
            if (!this.wasWheelieActive) vFwd = Math.min(VEHICLE_CONFIG.maxForwardSpeed, vFwd + 1.15);
            vFwd = Math.min(VEHICLE_CONFIG.maxForwardSpeed * 0.92, vFwd + 1.45 * pullBack * fixedDt);
          } else if (throttle < -0.05) {
            if (vFwd > 0.25) vFwd = Math.max(0, vFwd - VEHICLE_CONFIG.brakeDecel * Math.abs(throttle) * fixedDt);
            else vFwd = Math.max(-VEHICLE_CONFIG.maxReverseSpeed * Math.abs(throttle), vFwd - VEHICLE_CONFIG.accel * 0.55 * Math.abs(throttle) * fixedDt);
          } else {
            const rollingFactor = Math.exp(-VEHICLE_CONFIG.rollingDamping * fixedDt);
            const aeroLoss = VEHICLE_CONFIG.aeroDrag * vFwd * Math.abs(vFwd) * fixedDt;
            vFwd = vFwd * rollingFactor - aeroLoss;
            if (Math.abs(vFwd) < 0.04) vFwd = 0;
          }

          const safeWheelieRad = THREE.MathUtils.degToRad(VEHICLE_CONFIG.wheelieSafeDeg);
          const critWheelieRad = THREE.MathUtils.degToRad(VEHICLE_CONFIG.wheelieCriticalDeg);
          if (canWheelie) {
            this.wasWheelieActive = true;
            const targetPitchVel = (this.wheelieAngle >= safeWheelieRad ? 0.44 : 0.94) * pullBack;
            this.wheeliePitchVel = THREE.MathUtils.damp(this.wheeliePitchVel, targetPitchVel, 7.5, fixedDt);
            this.wheelieAngle += this.wheeliePitchVel * fixedDt;
            if (this.wheelieAngle >= critWheelieRad) {
              this.wheelieAngle = critWheelieRad;
              this.triggerWipeout('wheelie', vFwd);
              return;
            }
          } else {
            this.wasWheelieActive = false;
            if (this.wheelieAngle > 0) {
              this.wheeliePitchVel = THREE.MathUtils.damp(this.wheeliePitchVel, -2.5, 6.5, fixedDt);
              this.wheelieAngle = Math.max(0, this.wheelieAngle + this.wheeliePitchVel * fixedDt);
              if (this.wheelieAngle <= 0.001) {
                this.wheelieAngle = 0;
                this.wheeliePitchVel = 0;
              }
            }
          }

          vLat *= Math.exp(-11.0 * fixedDt);
          this.smoothSteerAngle = THREE.MathUtils.damp(this.smoothSteerAngle, steer, 7.5, fixedDt);
          const absSpeed = Math.abs(vFwd);
          const speedTurnFactor = absSpeed < 0.18 ? 0 : THREE.MathUtils.smoothstep(absSpeed, 0.18, 4.8);
          const highSpeedStabilize = 1.0 - THREE.MathUtils.clamp((absSpeed - 12) / 24, 0, 0.28);
          const wheelieTurnScale = this.wheelieAngle > 0.12 ? 0.42 : 1.0;
          const targetYawRate = this.smoothSteerAngle * VEHICLE_CONFIG.steerSpeed * speedTurnFactor * highSpeedStabilize * wheelieTurnScale * (vFwd < -0.25 ? -1 : 1);
          this.smoothYawRate = THREE.MathUtils.damp(this.smoothYawRate, targetYawRate, 8.5, fixedDt);
          this.body.angularVelocity.y = this.isGrounded ? this.smoothYawRate : this.smoothYawRate * 0.35;
          this.prevMountedSpeed = vFwd;
        } else {
          this.prevMountedSpeed = 0;
          this.wasWheelieActive = false;
          if (this.wheelieAngle > 0) {
            this.wheeliePitchVel = THREE.MathUtils.damp(this.wheeliePitchVel, -2.8, 7, fixedDt);
            this.wheelieAngle = Math.max(0, this.wheelieAngle + this.wheeliePitchVel * fixedDt);
            if (this.wheelieAngle <= 0.001) {
              this.wheelieAngle = 0;
              this.wheeliePitchVel = 0;
            }
          }
          vFwd *= Math.exp(-2.8 * fixedDt);
          vLat *= Math.exp(-10.0 * fixedDt);
          this.smoothSteerAngle = THREE.MathUtils.damp(this.smoothSteerAngle, 0, 8, fixedDt);
          this.smoothYawRate = THREE.MathUtils.damp(this.smoothYawRate, 0, 8, fixedDt);
          this.body.angularVelocity.y *= Math.exp(-8.0 * fixedDt);
        }

        this.currentForwardSpeed = vFwd;
        this.body.velocity.x = _bikeFwd.x * vFwd + _bikeRight.x * vLat;
        this.body.velocity.z = _bikeFwd.z * vFwd + _bikeRight.z * vLat;
      }

      update(dt, alpha) {
        if (this.pendingWipeoutReason) {
          const reason = this.pendingWipeoutReason;
          this.pendingWipeoutReason = null;
          this.onWipeout(reason, _wipeoutWorldPos, _wipeoutWorldQuat, _wipeoutInheritVel, _wipeoutEjectVel);
        }
        _interpPos.lerpVectors(this.previousPosition, this.currentPosition, alpha);
        _interpQuat.slerpQuaternions(this.previousQuaternion, this.currentQuaternion, alpha);
        this.interpolatedPosition.copy(_interpPos);
        this.interpolatedQuaternion.copy(_interpQuat);
        this.group.position.copy(_interpPos);
        this.group.quaternion.copy(_interpQuat);

        _bikeEuler.setFromQuaternion(_interpQuat, 'YXZ');
        this.headingYaw = _bikeEuler.y;

        const leanSpeedFactor = THREE.MathUtils.smoothstep(Math.abs(this.currentForwardSpeed), 0.45, 8.5);
        const targetLean = this.isMounted ? this.smoothSteerAngle * leanSpeedFactor * (this.currentForwardSpeed < -0.25 ? -0.18 : 0.44) : 0.05;
        if (dt > 0) {
          this.leanAngle = THREE.MathUtils.damp(this.leanAngle, targetLean, 6.5, dt);
          this.wheelSpinAngle -= (this.currentForwardSpeed / VEHICLE_CONFIG.wheelRadius) * dt;
        }
        this.leanGroup.rotation.z = this.leanAngle;
        this.wheeliePivot.rotation.x = this.wheelieAngle;
        this.proceduralRig.frontForkPivot.rotation.y = this.smoothSteerAngle * 0.36;
        this.proceduralRig.frontWheelSpin.rotation.x = this.wheelSpinAngle;
        this.proceduralRig.rearWheelSpin.rotation.x = this.wheelSpinAngle;
        if (this.modelRoot) {
          if (this.modelFork) this.modelFork.quaternion.setFromAxisAngle(_forkSteerAxis, this.smoothSteerAngle * 0.30);
          if (this.modelFrontWheel) this.modelFrontWheel.rotation.x = this.wheelSpinAngle;
          if (this.modelRearWheel) this.modelRearWheel.rotation.x = this.wheelSpinAngle;
        }
      }
    }

    class PlayerEntity extends Entity {
      constructor(spawnPos, steerInput, audio) {
        super('player');
        this.health = 100;
        this.spawnPos = spawnPos;
        this.steerInput = steerInput;
        this.audio = audio;

        const r = ${PHYSICS_CONFIG.capsuleRadius};
        const cylH = ${PHYSICS_CONFIG.capsuleCylinderHeight};
        this.capsuleHalfHeight = cylH / 2 + r;

        this.body = new CANNON.Body({
          mass: ${PHYSICS_CONFIG.playerMass},
          material: playerMat,
          fixedRotation: true,
          allowSleep: false,
          linearDamping: 0.0,
          collisionFilterGroup: 1,
          collisionFilterMask: 1 | 2,
        });
        this.body.addShape(new CANNON.Sphere(r), new CANNON.Vec3(0, -cylH / 2, 0));
        this.body.addShape(new CANNON.Cylinder(r, r, cylH, 12), new CANNON.Vec3(0, 0, 0));
        this.body.addShape(new CANNON.Sphere(r), new CANNON.Vec3(0, cylH / 2, 0));
        this.body.position.set(spawnPos[0], spawnPos[1], spawnPos[2]);
        world.addBody(this.body);
        this.bodyInWorld = true;

        this.previousPosition = new THREE.Vector3(spawnPos[0], spawnPos[1], spawnPos[2]);
        this.currentPosition = new THREE.Vector3(spawnPos[0], spawnPos[1], spawnPos[2]);
        this.previousQuaternion = new THREE.Quaternion();
        this.currentQuaternion = new THREE.Quaternion();
        this.interpolatedPosition = new THREE.Vector3().copy(this.currentPosition);

        this.group = new THREE.Group();
        this.headingGroup = new THREE.Group();
        this.group.add(this.headingGroup);
        scene.add(this.group);

        this.isMounted = false;
        this.isRagdoll = false;
        this.isFpsMode = false;
        this.mountedSteerAngle = 0;
        this.isGrounded = false;
        this.coyoteTimer = 0;
        this.airBlend = 0;
        this.isWaving = false;
        this.waveBlend = 0;
        this.minAirborneVy = 0;
        this.stateLabel = 'Idle';
        this.ragdollInWorld = false;
        this.ragdollTimer = 0;
        this.ragdollSettleTime = 0;
        this.ragdollBodies = null;
        this.ragdollAllBodies = [];
        this.ragdollConstraints = [];
        this.ragdollPrevTorsoPos = new THREE.Vector3();
        this.ragdollCurrTorsoPos = new THREE.Vector3();
        this.ragdollPrevTorsoQuat = new THREE.Quaternion();
        this.ragdollCurrTorsoQuat = new THREE.Quaternion();

        this.baseMixer = null;
        this.upperMixer = null;
        this.maskedUpperBones = [];
        this.actions = {};
        this.activeClipName = 'Idle';
        this.boneRig = {};
        this.tposeBoneRig = {};
        this.tposeSnapshots = [];
        this.headBone = null;
        this.visorMeshes = [];
      }

      mountTo(seatAnchor) {
        if (this.isMounted || this.isRagdoll) return;
        this.isMounted = true;
        this.isWaving = false;
        this.waveBlend = 0;
        this.steerInput.jumpQueued = false;
        if (this.bodyInWorld) {
          world.removeBody(this.body);
          this.bodyInWorld = false;
        }
        if (this.baseMixer) this.baseMixer.stopAllAction();
        if (this.upperMixer) this.upperMixer.stopAllAction();
        seatAnchor.add(this.group);
        this.group.position.set(0, -0.13, 0);
        this.group.quaternion.identity();
        this.headingGroup.quaternion.identity();
        this.headingGroup.rotation.set(0, 0, 0);
        this.audio.playSound('mount', { volume: 0.75 });
      }

      dismountAt(worldPos, facingYaw) {
        if (!this.isMounted) return;
        this.isMounted = false;
        scene.add(this.group);
        this.body.position.set(worldPos.x, worldPos.y, worldPos.z);
        this.body.velocity.set(0, 0, 0);
        if (!this.bodyInWorld) {
          world.addBody(this.body);
          this.bodyInWorld = true;
        }
        this.syncInterpolationBuffers();
        this.group.position.copy(worldPos);
        this.group.quaternion.identity();
        this.headingGroup.rotation.set(0, 0, 0);
        this.headingGroup.quaternion.setFromAxisAngle(_upAxis, facingYaw);
        if (this.baseMixer && this.actions.Idle) {
          this.baseMixer.stopAllAction();
          this.actions.Idle.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
          this.activeClipName = 'Idle';
          this.baseMixer.update(0);
        }
        this.minAirborneVy = 0;
        this.audio.playSound('dismount', { volume: 0.7 });
      }

      ensureRagdollPool() {
        if (this.ragdollBodies) return;
        const makePooledPart = (shape, mass) => {
          const b = new CANNON.Body({
            mass,
            material: ragdollMat,
            allowSleep: false,
            linearDamping: 0.24,
            angularDamping: 0.45,
            collisionFilterGroup: 2,
            collisionFilterMask: 1,
          });
          b.addShape(shape);
          this.ragdollAllBodies.push(b);
          return b;
        };
        const torso = makePooledPart(new CANNON.Box(new CANNON.Vec3(0.18, 0.24, 0.13)), 32);
        const head = makePooledPart(new CANNON.Sphere(0.14), 7);
        const leftArm = makePooledPart(new CANNON.Sphere(0.1), 6);
        const rightArm = makePooledPart(new CANNON.Sphere(0.1), 6);
        const leftLeg = makePooledPart(new CANNON.Sphere(0.11), 9);
        const rightLeg = makePooledPart(new CANNON.Sphere(0.11), 9);
        const createLink = (bA, pAx, pAy, pAz, bB, pBx, pBy, pBz) => {
          this.ragdollConstraints.push(new CANNON.PointToPointConstraint(bA, new CANNON.Vec3(pAx, pAy, pAz), bB, new CANNON.Vec3(pBx, pBy, pBz)));
        };
        createLink(torso, 0, 0.26, 0, head, 0, -0.16, 0);
        createLink(torso, -0.2, 0.18, 0, leftArm, 0.16, 0, 0);
        createLink(torso, 0.2, 0.18, 0, rightArm, -0.16, 0, 0);
        createLink(torso, -0.12, -0.24, 0, leftLeg, 0, 0.2, 0);
        createLink(torso, 0.12, -0.24, 0, rightLeg, 0, 0.2, 0);
        this.ragdollBodies = { torso, head, leftArm, rightArm, leftLeg, rightLeg };
      }

      cleanupRagdollBodies() {
        if (!this.ragdollInWorld) return;
        for (let i = 0; i < this.ragdollConstraints.length; i++) world.removeConstraint(this.ragdollConstraints[i]);
        for (let i = 0; i < this.ragdollAllBodies.length; i++) world.removeBody(this.ragdollAllBodies[i]);
        this.ragdollInWorld = false;
      }

      enterRagdoll(worldOrigin, worldQuat, inheritVel, ejectVel) {
        this.cleanupRagdollBodies();
        this.ensureRagdollPool();
        this.isMounted = false;
        this.isRagdoll = true;
        this.isWaving = false;
        this.waveBlend = 0;
        this.steerInput.jumpQueued = false;
        this.ragdollTimer = 0;
        this.ragdollSettleTime = 0;
        this.pendingRagdollRecovery = false;
        this.health = Math.max(15, this.health - 15);
        scene.add(this.group);
        if (this.bodyInWorld) {
          world.removeBody(this.body);
          this.bodyInWorld = false;
        }
        if (this.baseMixer) this.baseMixer.stopAllAction();
        if (this.upperMixer) this.upperMixer.stopAllAction();

        const rb = this.ragdollBodies;
        const placePart = (b, lx, ly, lz, jitter) => {
          _tmpVec3A.set(lx, ly, lz).applyQuaternion(worldQuat).add(worldOrigin);
          _tmpVec3A.y = Math.max(0.45, _tmpVec3A.y);
          b.position.set(_tmpVec3A.x, _tmpVec3A.y, _tmpVec3A.z);
          b.quaternion.set(worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w);
          b.velocity.set(
            inheritVel.x + ejectVel.x + (Math.random() - 0.5) * jitter,
            inheritVel.y + ejectVel.y + Math.random() * jitter * 0.6,
            inheritVel.z + ejectVel.z + (Math.random() - 0.5) * jitter
          );
          b.angularVelocity.set(0, 0, 0);
          b.force.set(0, 0, 0);
          b.torque.set(0, 0, 0);
        };

        placePart(rb.torso, 0, 0.22, 0, 0.4);
        rb.torso.angularVelocity.set((Math.random() - 0.5) * 4.5, (Math.random() - 0.5) * 3.0, (Math.random() - 0.5) * 4.5);
        placePart(rb.head, 0, 0.66, 0, 1.2);
        placePart(rb.leftArm, -0.34, 0.38, 0, 1.8);
        placePart(rb.rightArm, 0.34, 0.38, 0, 1.8);
        placePart(rb.leftLeg, -0.14, -0.24, 0, 1.4);
        placePart(rb.rightLeg, 0.14, -0.24, 0, 1.4);

        for (let i = 0; i < this.ragdollAllBodies.length; i++) world.addBody(this.ragdollAllBodies[i]);
        for (let i = 0; i < this.ragdollConstraints.length; i++) world.addConstraint(this.ragdollConstraints[i]);
        this.ragdollInWorld = true;

        this.ragdollPrevTorsoPos.set(rb.torso.position.x, rb.torso.position.y, rb.torso.position.z);
        this.ragdollCurrTorsoPos.copy(this.ragdollPrevTorsoPos);
        this.ragdollPrevTorsoQuat.set(rb.torso.quaternion.x, rb.torso.quaternion.y, rb.torso.quaternion.z, rb.torso.quaternion.w);
        this.ragdollCurrTorsoQuat.copy(this.ragdollPrevTorsoQuat);
        triggerCameraShake(0.2, 0.36);
        this.audio.playSound('land_hard', { volume: 0.9 });
      }

      recoverFromRagdoll(facingYaw = 0) {
        if (!this.isRagdoll) return;
        const torsoPos = this.ragdollBodies ? this.ragdollBodies.torso.position : new CANNON.Vec3(this.group.position.x, 0.9, this.group.position.z);
        const standX = torsoPos.x;
        const standY = Math.max(torsoPos.y + 0.45, this.capsuleHalfHeight + 0.05);
        const standZ = torsoPos.z;
        this.cleanupRagdollBodies();
        this.isRagdoll = false;
        this.pendingRagdollRecovery = false;
        this.body.position.set(standX, standY, standZ);
        this.body.velocity.set(0, 0, 0);
        if (!this.bodyInWorld) {
          world.addBody(this.body);
          this.bodyInWorld = true;
        }
        this.syncInterpolationBuffers();
        this.group.position.set(standX, standY, standZ);
        this.group.quaternion.identity();
        this.headingGroup.rotation.set(0, 0, 0);
        this.headingGroup.quaternion.setFromAxisAngle(_upAxis, facingYaw);
        if (this.baseMixer && this.actions.Idle) {
          this.baseMixer.stopAllAction();
          this.actions.Idle.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
          this.activeClipName = 'Idle';
          this.baseMixer.update(0);
        }
        this.minAirborneVy = 0;
        this.audio.playSound('dismount', { volume: 0.6 });
      }

      canRecoverManually() {
        return this.isRagdoll && this.ragdollTimer >= 0.85;
      }

      syncInterpolationBuffers() {
        this.previousPosition.set(this.body.position.x, this.body.position.y, this.body.position.z);
        this.currentPosition.copy(this.previousPosition);
        this.previousQuaternion.set(this.body.quaternion.x, this.body.quaternion.y, this.body.quaternion.z, this.body.quaternion.w);
        this.currentQuaternion.copy(this.previousQuaternion);
      }

      capturePostStep() {
        if (this.isMounted) return;
        if (this.isRagdoll && this.ragdollBodies) {
          const t = this.ragdollBodies.torso;
          this.ragdollCurrTorsoPos.set(t.position.x, t.position.y, t.position.z);
          this.ragdollCurrTorsoQuat.set(t.quaternion.x, t.quaternion.y, t.quaternion.z, t.quaternion.w);
          return;
        }
        this.currentPosition.set(this.body.position.x, this.body.position.y, this.body.position.z);
        this.currentQuaternion.set(this.body.quaternion.x, this.body.quaternion.y, this.body.quaternion.z, this.body.quaternion.w);
        if (!this.isGrounded) {
          this.minAirborneVy = Math.min(this.minAirborneVy, this.body.velocity.y);
        }
      }

      alignModelToCapsuleBase(model) {
        model.position.set(0, 0, 0);
        model.updateMatrixWorld(true);
        model.traverse((obj) => {
          if (obj.isSkinnedMesh && obj.skeleton) obj.skeleton.update();
        });
        const box = new THREE.Box3().setFromObject(model, true);
        const center = new THREE.Vector3();
        box.getCenter(center);
        model.position.set(-center.x, -this.capsuleHalfHeight - box.min.y, -center.z);
      }

      switchAnimation(nextName, fadeTime = 0.2) {
        if (!this.baseMixer || this.activeClipName === nextName || !this.actions[nextName]) return;
        const prevAction = this.actions[this.activeClipName];
        const nextAction = this.actions[nextName];
        if (prevAction) prevAction.fadeOut(fadeTime);
        nextAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fadeTime).play();
        this.activeClipName = nextName;
      }

      getHeadWorldPosition(out) {
        this.group.updateMatrixWorld(true);
        if (this.headBone) {
          this.headBone.getWorldPosition(out);
          out.y += 0.06;
          return out;
        }
        if (this.isMounted) {
          this.group.getWorldPosition(out);
          out.y += 0.76;
          return out;
        }
        const feetY = this.interpolatedPosition.y - this.capsuleHalfHeight;
        out.set(this.interpolatedPosition.x, feetY + 1.62, this.interpolatedPosition.z);
        return out;
      }

      applyFpsHeadMask() {
        if (this.headBone) this.headBone.scale.setScalar(this.isFpsMode ? 0.0005 : 1);
        for (let i = 0; i < this.visorMeshes.length; i++) {
          this.visorMeshes[i].visible = !this.isFpsMode;
        }
      }

      evaluateGrounded() {
        for (let i = 0; i < world.contacts.length; i++) {
          const c = world.contacts[i];
          if (c.bi === this.body && -c.ni.y > 0.45) return true;
          if (c.bj === this.body && c.ni.y > 0.45) return true;
        }
        let hit = false;
        _rayFrom.set(this.body.position.x, this.body.position.y - 0.3, this.body.position.z);
        _rayTo.set(this.body.position.x, this.body.position.y - (this.capsuleHalfHeight + 0.14), this.body.position.z);
        world.raycastAll(_rayFrom, _rayTo, { skipBackfaces: true }, (res) => {
          if (res.body && res.body !== this.body && res.hitNormalWorld.y > 0.45) hit = true;
        });
        return hit;
      }

      fixedUpdate(fixedDt) {
        if (this.isMounted) return;
        if (this.isRagdoll && this.ragdollBodies) {
          const t = this.ragdollBodies.torso;
          this.ragdollPrevTorsoPos.set(t.position.x, t.position.y, t.position.z);
          this.ragdollPrevTorsoQuat.set(t.quaternion.x, t.quaternion.y, t.quaternion.z, t.quaternion.w);
          this.ragdollTimer += fixedDt;
          const torsoSpeed = Math.hypot(t.velocity.x, t.velocity.y, t.velocity.z);
          this.ragdollSettleTime = torsoSpeed < 0.7 ? this.ragdollSettleTime + fixedDt : 0;
          if ((this.ragdollSettleTime > 1.05 && this.ragdollTimer > 1.9) || this.ragdollTimer > 3.8 || t.position.y < -8) {
            this.pendingRagdollRecovery = true;
          }
          return;
        }

        this.previousPosition.set(this.body.position.x, this.body.position.y, this.body.position.z);
        this.previousQuaternion.set(this.body.quaternion.x, this.body.quaternion.y, this.body.quaternion.z, this.body.quaternion.w);

        const wasGrounded = this.isGrounded;
        if (!wasGrounded) this.minAirborneVy = Math.min(this.minAirborneVy, this.body.velocity.y);

        const touchingGround = this.evaluateGrounded();
        if (touchingGround && this.body.velocity.y <= 1.2) {
          this.isGrounded = true;
          this.coyoteTimer = COYOTE_MAX;
          if (!wasGrounded) {
            const impactVy = Math.min(this.minAirborneVy, this.body.velocity.y);
            if (impactVy < -7) {
              const factor = THREE.MathUtils.clamp((-impactVy - 7) / 6, 0.4, 1.2);
              triggerCameraShake(0.11 * factor, 0.24);
              this.audio.playSound('land_hard', { volume: 0.85 });
            }
            this.minAirborneVy = 0;
          }
        } else {
          this.isGrounded = false;
          this.coyoteTimer = Math.max(0, this.coyoteTimer - fixedDt);
          this.minAirborneVy = Math.min(this.minAirborneVy, this.body.velocity.y);
        }

        const vx = this.body.velocity.x;
        const vz = this.body.velocity.z;
        if (this.steerInput.inputMag > 0.01) {
          const targetVx = this.steerInput.dirX * this.steerInput.maxSpeed;
          const targetVz = this.steerInput.dirZ * this.steerInput.maxSpeed;
          const accel = this.isGrounded ? ${PHYSICS_CONFIG.groundAccel} : ${PHYSICS_CONFIG.airAccel};
          const dvx = targetVx - vx;
          const dvz = targetVz - vz;
          const dvMag = Math.hypot(dvx, dvz);
          if (dvMag > 0.0001) {
            const gain = Math.min(1, (accel * fixedDt) / dvMag);
            const forceScale = (this.body.mass * dvMag * gain) / fixedDt;
            _forceVec.set((dvx / dvMag) * forceScale, 0, (dvz / dvMag) * forceScale);
            this.body.applyForce(_forceVec, this.body.position);
          }
        } else {
          const dampingRate = this.isGrounded ? ${PHYSICS_CONFIG.groundDamping} : ${PHYSICS_CONFIG.airDamping};
          const dampFactor = Math.exp(-dampingRate * fixedDt);
          this.body.velocity.x = vx * dampFactor;
          this.body.velocity.z = vz * dampFactor;
          if (Math.hypot(this.body.velocity.x, this.body.velocity.z) < 0.02) {
            this.body.velocity.x = 0;
            this.body.velocity.z = 0;
          }
        }

        if (this.steerInput.jumpQueued) {
          if (this.isGrounded || this.coyoteTimer > 0) {
            this.body.velocity.y = ${PHYSICS_CONFIG.jumpVelocity};
            this.isGrounded = false;
            this.coyoteTimer = 0;
            this.minAirborneVy = 0;
            this.audio.playSound('jump', { volume: 0.75 });
          }
          this.steerInput.jumpQueued = false;
        }
      }

      update(dt, alpha) {
        if (this.isRagdoll && this.pendingRagdollRecovery) {
          this.pendingRagdollRecovery = false;
          this.recoverFromRagdoll();
        }
        if (this.isRagdoll && this.ragdollBodies) {
          this.stateLabel = 'Ragdoll';
          this.isGrounded = false;
          this.isWaving = false;
          this.waveBlend = 0;
          const rb = this.ragdollBodies;
          _interpPos.lerpVectors(this.ragdollPrevTorsoPos, this.ragdollCurrTorsoPos, alpha);
          _interpQuat.slerpQuaternions(this.ragdollPrevTorsoQuat, this.ragdollCurrTorsoQuat, alpha);
          this.interpolatedPosition.copy(_interpPos);
          this.group.position.copy(_interpPos);
          this.group.quaternion.identity();
          this.headingGroup.quaternion.copy(_interpQuat);
          if (this.baseMixer) this.baseMixer.update(0);
          for (let i = 0; i < this.tposeSnapshots.length; i++) this.tposeSnapshots[i].bone.quaternion.copy(this.tposeSnapshots[i].quat);
          const activeRig = this.tposeBoneRig.leftArm || this.tposeBoneRig.rightArm ? this.tposeBoneRig : this.boneRig;
          _ragInvQuat.copy(_interpQuat).invert();
          const aimPart = (entry, partBody, rx, ry, rz, ox, oy, oz) => {
            _ragLocalDir.set(partBody.position.x - rb.torso.position.x, partBody.position.y - rb.torso.position.y, partBody.position.z - rb.torso.position.z).applyQuaternion(_ragInvQuat);
            _ragLocalDir.x -= ox; _ragLocalDir.y -= oy; _ragLocalDir.z -= oz;
            aimRigBoneTowardLocalDir(entry, rx, ry, rz, _ragLocalDir.x, _ragLocalDir.y, _ragLocalDir.z, 0.9);
          };
          aimPart(activeRig.head, rb.head, 0, 1, 0, 0, 0.24, 0);
          aimPart(activeRig.leftArm, rb.leftArm, -1, 0, 0, -0.18, 0.16, 0);
          aimPart(activeRig.rightArm, rb.rightArm, 1, 0, 0, 0.18, 0.16, 0);
          aimPart(activeRig.leftUpLeg, rb.leftLeg, 0, -1, 0, -0.1, -0.22, 0);
          aimPart(activeRig.rightUpLeg, rb.rightLeg, 0, -1, 0, 0.1, -0.22, 0);
          applyBoneEulerDelta(activeRig.leftLeg, -0.68, 0, 0);
          applyBoneEulerDelta(activeRig.rightLeg, -0.54, 0, 0);
          applyBoneEulerDelta(activeRig.leftForeArm, 0.25, -0.45, 0);
          applyBoneEulerDelta(activeRig.rightForeArm, 0.25, 0.45, 0);
          this.applyFpsHeadMask();
          return;
        }

        if (this.isMounted) {
          this.stateLabel = 'Drive';
          this.isGrounded = true;
          this.isWaving = false;
          this.waveBlend = 0;
          if (this.baseMixer) this.baseMixer.update(0);
          for (let i = 0; i < this.tposeSnapshots.length; i++) {
            this.tposeSnapshots[i].bone.quaternion.copy(this.tposeSnapshots[i].quat);
          }
          const activeRig = this.tposeBoneRig.leftArm || this.tposeBoneRig.rightArm ? this.tposeBoneRig : this.boneRig;
          applyMotorcycleSeatedPose(activeRig, this.mountedSteerAngle, this.headingGroup);
          this.applyFpsHeadMask();
          this.group.getWorldPosition(this.interpolatedPosition);
          return;
        }

        if (this.body.position.y < -10) {
          this.body.position.set(...this.spawnPos);
          this.body.velocity.set(0, 0, 0);
          this.syncInterpolationBuffers();
          this.minAirborneVy = 0;
        }

        _interpPos.lerpVectors(this.previousPosition, this.currentPosition, alpha);
        _interpQuat.slerpQuaternions(this.previousQuaternion, this.currentQuaternion, alpha);
        this.interpolatedPosition.copy(_interpPos);
        this.group.position.copy(_interpPos);
        this.group.quaternion.copy(_interpQuat);

        const realHorizSpeed = Math.hypot(this.body.velocity.x, this.body.velocity.z);
        if (dt > 0) {
          if (realHorizSpeed > ${PHYSICS_CONFIG.stopVelocityThreshold}) {
            const velAngle = Math.atan2(-this.body.velocity.x, -this.body.velocity.z);
            _targetQuat.setFromAxisAngle(_upAxis, velAngle);
            this.headingGroup.quaternion.slerp(_targetQuat, 1 - Math.exp(-10 * dt));
          } else if (this.steerInput.inputMag > 0.05 && _moveDir.lengthSq() > 0.001) {
            const aimAngle = Math.atan2(-_moveDir.x, -_moveDir.z);
            _targetQuat.setFromAxisAngle(_upAxis, aimAngle);
            this.headingGroup.quaternion.slerp(_targetQuat, 1 - Math.exp(-6 * dt));
          }
        }

        if (!this.isGrounded) {
          this.stateLabel = 'Jump';
          this.switchAnimation('Idle', 0.14);
          if (dt > 0) this.airBlend = THREE.MathUtils.damp(this.airBlend, 1, 15, dt);
        } else {
          if (dt > 0) this.airBlend = THREE.MathUtils.damp(this.airBlend, 0, 18, dt);
          if (realHorizSpeed < ${PHYSICS_CONFIG.stopVelocityThreshold}) {
            this.stateLabel = 'Idle';
            this.switchAnimation('Idle', 0.12);
          } else if (realHorizSpeed > 4.4) {
            this.stateLabel = 'Run';
            this.switchAnimation('Run', 0.18);
            if (this.actions.Run) this.actions.Run.timeScale = THREE.MathUtils.clamp(realHorizSpeed / ${PHYSICS_CONFIG.runSpeed}, 0.75, 1.18);
          } else {
            this.stateLabel = 'Walk';
            this.switchAnimation('Walk', 0.18);
            if (this.actions.Walk) this.actions.Walk.timeScale = THREE.MathUtils.clamp(realHorizSpeed / ${PHYSICS_CONFIG.walkSpeed}, 0.65, 1.2);
          }
        }

        if (this.baseMixer) {
          if (dt > 0) this.baseMixer.update(dt);
          if (this.airBlend > 0.005) applyProceduralJumpPose(this.boneRig, this.airBlend, this.body.velocity.y);
          if (dt > 0) this.waveBlend = THREE.MathUtils.damp(this.waveBlend, this.isWaving ? 1 : 0, 10, dt);
          if (this.upperMixer && this.maskedUpperBones.length > 0 && this.waveBlend > 0.005) {
            for (let i = 0; i < this.maskedUpperBones.length; i++) {
              this.maskedUpperBones[i].baseQuat.copy(this.maskedUpperBones[i].bone.quaternion);
            }
            if (dt > 0) this.upperMixer.update(dt);
            for (let i = 0; i < this.maskedUpperBones.length; i++) {
              const entry = this.maskedUpperBones[i];
              entry.waveQuat.copy(entry.bone.quaternion);
              entry.bone.quaternion.copy(entry.baseQuat).slerp(entry.waveQuat, this.waveBlend);
            }
          }
        }
        this.applyFpsHeadMask();
      }
    }

    const entityManager = new EntityManager();
    const audioManager = new AudioManager();
    const engineRaycaster = new EngineRaycaster();
    const steerState = { dirX: 0, dirZ: 0, inputMag: 0, maxSpeed: 0, jumpQueued: false };
    const driveState = { throttle: 0, steer: 0 };

    const doorEntity = entityManager.add(new DoorEntity(LEVEL_JSON.door, audioManager));
    let playerEntity;
    const motorcycleEntity = entityManager.add(
      new MotorcycleEntity(driveState, audioManager, (_reason, pos, quat, inheritVel, ejectVel) => {
        playerEntity.enterRagdoll(pos, quat, inheritVel, ejectVel);
      })
    );
    playerEntity = entityManager.add(new PlayerEntity(LEVEL_JSON.spawn, steerState, audioManager));

    let interactType = null;
    let interactPromptText = null;
    const allInteractTargets = [...doorEntity.interactTargets, ...motorcycleEntity.interactTargets];

    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      SOLDIER_URL,
      (gltf) => {
        const model = gltf.scene;
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        playerEntity.baseMixer = new THREE.AnimationMixer(model);
        for (const clipName of ['Idle', 'Walk', 'Run', 'TPose']) {
          const clip = THREE.AnimationClip.findByName(gltf.animations, clipName);
          if (clip) playerEntity.actions[clipName] = playerEntity.baseMixer.clipAction(clip);
        }
        if (playerEntity.actions.TPose) {
          playerEntity.actions.TPose.reset().setEffectiveWeight(1).play();
          playerEntity.baseMixer.update(0);
        }
        model.updateMatrixWorld(true);
        playerEntity.tposeSnapshots = captureTposeSnapshots(model);
        playerEntity.tposeBoneRig = buildCharacterBoneRig(model);

        if (playerEntity.actions.Idle) {
          playerEntity.baseMixer.stopAllAction();
          playerEntity.actions.Idle.reset().setEffectiveWeight(1).play();
          playerEntity.activeClipName = 'Idle';
          playerEntity.baseMixer.update(0);
        }
        playerEntity.alignModelToCapsuleBase(model);
        playerEntity.headingGroup.add(model);

        const hv = findHeadAndVisor(model);
        playerEntity.headBone = hv.headBone;
        playerEntity.visorMeshes = hv.visorMeshes;
        playerEntity.boneRig = buildCharacterBoneRig(model);

        const upperLayer = buildUpperBodyWaveLayer(model, gltf.animations);
        playerEntity.upperMixer = upperLayer.upperMixer;
        playerEntity.maskedUpperBones = upperLayer.maskedBones;

        loadingOverlay.classList.add('hidden');
      },
      (progress) => {
        if (progress.total > 0) {
          const pct = Math.min(100, Math.round((progress.loaded / progress.total) * 100));
          loadingText.textContent = \`Cargando Soldier.glb (\${pct}%)...\`;
          loadingBar.style.width = pct + '%';
        }
      },
      (err) => {
        console.error('Error cargando Soldier.glb:', err);
        loadingText.textContent = 'Error cargando Soldier.glb. Revisa tu conexión.';
      }
    );

    const hondaRawBase = 'https://raw.githubusercontent.com/SteelRandom/3D-Test/refs/heads/main/';
    const transparent1pxPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const hondaManager = new THREE.LoadingManager();
    hondaManager.setURLModifier((url) => {
      if (url === HONDA_MTL_URL || url === HONDA_OBJ_URL || url.startsWith('data:') || url.startsWith('blob:')) return url;
      return transparent1pxPng;
    });
    const mtlLoader = new MTLLoader(hondaManager);
    mtlLoader.setResourcePath(hondaRawBase);
    const loadHondaObj = (materials) => {
      const objLoader = new OBJLoader(hondaManager);
      if (materials) {
        materials.preload();
        objLoader.setMaterials(materials);
      }
      objLoader.load(HONDA_OBJ_URL, (obj) => motorcycleEntity.attachHondaObjModel(obj), undefined, () => {});
    };
    mtlLoader.load(HONDA_MTL_URL, (mats) => loadHondaObj(mats), undefined, () => loadHondaObj());

    // Triggers de prueba (rampa + checkpoint)
    const triggerSystem = new TriggerSystem();
    let lastTriggerLabel = null;
    let boostCooldown = 0;
    triggerSystem.createTrigger({
      id: 'trigger-ramp-boost',
      label: 'Impulso Rampa',
      position: [0, 0.35, -2.1],
      size: [2.6, 1.1, 1.6],
      color: 0x06b6d4,
      visible: true,
      onEnter: ({ actorType, body }) => {
        lastTriggerLabel = 'Impulso Rampa (activo)';
        if (boostCooldown <= 0) {
          boostCooldown = 0.65;
          if (actorType === 'motorcycle') {
            body.velocity.z -= 5.2;
            body.velocity.y = Math.max(body.velocity.y, 1.5);
          } else {
            body.velocity.z -= 4.2;
            body.velocity.y = Math.max(body.velocity.y, 3.6);
          }
          audioManager.playSound('jump', { volume: 0.55 });
        }
      },
      onExit: () => { lastTriggerLabel = 'Impulso Rampa (completado)'; },
    });
    triggerSystem.createTrigger({
      id: 'trigger-platform-checkpoint',
      label: 'Checkpoint Plataforma',
      position: [0, 1.9, -10.2],
      size: [3.0, 1.4, 3.0],
      color: 0x10b981,
      visible: true,
      onEnter: () => {
        lastTriggerLabel = 'Checkpoint Plataforma';
        audioManager.playSound('door_open', { volume: 0.45 });
      },
      onExit: () => { lastTriggerLabel = 'Salió de Checkpoint'; },
    });

    // Cargador rápido de modelos externos de prueba (.glb / .gltf / .obj)
    let activeTestModelRoot = null;
    let activeTestModelMixer = null;
    let activeTestModelUrl = null;
    const testModelGeos = [];
    const testModelMats = [];
    function clearTestModel() {
      if (activeTestModelMixer) {
        activeTestModelMixer.stopAllAction();
        activeTestModelMixer = null;
      }
      if (activeTestModelRoot) {
        scene.remove(activeTestModelRoot);
        activeTestModelRoot = null;
      }
      for (let i = 0; i < testModelGeos.length; i++) testModelGeos[i].dispose();
      testModelGeos.length = 0;
      for (let i = 0; i < testModelMats.length; i++) testModelMats[i].dispose();
      testModelMats.length = 0;
      activeTestModelUrl = null;
      testModelStatusEl.textContent = '';
    }
    function finalizeTestModel(loadedRoot, animations, url, options = {}) {
      if (options.replacePrevious !== false) clearTestModel();
      const pos = options.position ?? [4.8, 0, 2.2];
      const targetSize = options.targetSize ?? 1.6;
      const allowShadow = options.castShadow !== false;
      const wrapper = new THREE.Group();
      wrapper.add(loadedRoot);
      wrapper.updateMatrixWorld(true);
      _tmpBox3A.setFromObject(wrapper, true);
      _tmpBox3A.getSize(_tmpVec3A);
      const maxDim = Math.max(_tmpVec3A.x, _tmpVec3A.y, _tmpVec3A.z, 0.001);
      const scale = targetSize / maxDim;
      loadedRoot.scale.setScalar(scale);
      _tmpBox3A.getCenter(_tmpVec3B);
      loadedRoot.position.set(-_tmpVec3B.x * scale, -_tmpBox3A.min.y * scale, -_tmpVec3B.z * scale);
      wrapper.position.set(pos[0], pos[1], pos[2]);
      const palette = url.toLowerCase().includes('honda') ? getCachedHondaMaterialPalette() : null;
      loadedRoot.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) {
            testModelGeos.push(child.geometry);
            child.geometry.computeBoundingBox();
          }
          if (palette) {
            const oldMat = Array.isArray(child.material) ? child.material[0] : child.material;
            const res = resolveHondaPartMaterial(child.name, oldMat?.name ?? '', palette);
            if (Array.isArray(child.material)) child.material.forEach((m) => m?.dispose());
            else oldMat?.dispose();
            child.material = res.material;
          } else if (Array.isArray(child.material)) {
            child.material.forEach((m) => m && testModelMats.push(m));
          } else if (child.material) {
            testModelMats.push(child.material);
          }
          const bb = child.geometry?.boundingBox;
          const partMaxDim = bb ? Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) * scale : targetSize;
          const cast = allowShadow && partMaxDim >= 0.25;
          child.castShadow = cast;
          child.receiveShadow = cast;
        }
      });
      if (animations.length > 0) {
        activeTestModelMixer = new THREE.AnimationMixer(loadedRoot);
        activeTestModelMixer.clipAction(animations[0]).play();
      }
      scene.add(wrapper);
      activeTestModelRoot = wrapper;
      activeTestModelUrl = url;
      testModelStatusEl.textContent = 'Cargado: ' + (url.split('/').pop() || 'modelo');
    }
    function loadTestModel(url, options = {}) {
      const trimmed = (url || '').trim();
      if (!trimmed) return;
      testModelStatusEl.textContent = 'Cargando...';
      if (trimmed.toLowerCase().endsWith('.obj')) {
        new OBJLoader(hondaManager).load(trimmed, (obj) => finalizeTestModel(obj, [], trimmed, options), undefined, () => {
          testModelStatusEl.textContent = 'Error OBJ';
        });
      } else {
        gltfLoader.load(trimmed, (gltf) => finalizeTestModel(gltf.scene, gltf.animations ?? [], trimmed, options), undefined, () => {
          testModelStatusEl.textContent = 'Error GLB';
        });
      }
    }
    window.loadTestModel = loadTestModel;

    // 6. Controles PC y Móvil
    const QUICKSAVE_KEY = 'engine3d_quicksave_v1';
    const keys = Object.create(null);
    let jumpQueued = false;
    let cameraMode = 'TPS';
    let isFreeCam = false;
    const freeCamPos = new THREE.Vector3(0, 3.2, 6);
    let freeCamYaw = 0;
    let freeCamPitch = -0.22;
    let freeCamSpeed = 9.0;
    let saveStatus = null;
    let currentViewIndex = 0;
    let camYaw = 0;
    let prevBikeYaw = motorcycleEntity.headingYaw;
    let pitchOffset = 0;
    let fpsPitch = 0;
    let fpsLookYawOffset = 0;
    let zoomOffset = 0;
    let smoothDistance = CAMERA_VIEWS[0].distance;
    let smoothPitch = CAMERA_VIEWS[0].pitch;
    let smoothShoulderX = CAMERA_VIEWS[0].shoulderOffsetX;
    let smoothTargetHeight = CAMERA_VIEWS[0].targetHeight;
    let smoothFov = CAMERA_VIEWS[0].fov;

    let isDraggingCamera = false;
    let cameraPointerId = null;
    let lastPointerX = 0;
    let lastPointerY = 0;

    function mountMotorcycle() {
      if (playerEntity.isRagdoll) return;
      motorcycleEntity.isMounted = true;
      playerEntity.mountTo(motorcycleEntity.seatAnchor);
      prevBikeYaw = motorcycleEntity.headingYaw;
      camYaw = motorcycleEntity.headingYaw;
      fpsLookYawOffset = 0;
      if (cameraMode === 'FPS') fpsPitch = -0.14;
    }

    function dismountMotorcycle() {
      _dismountOffset.set(-1.35, 0.45, 0).applyQuaternion(motorcycleEntity.interpolatedQuaternion);
      _dismountPos.set(
        motorcycleEntity.interpolatedPosition.x + _dismountOffset.x,
        Math.max(motorcycleEntity.interpolatedPosition.y + 0.45, 0.9),
        motorcycleEntity.interpolatedPosition.z + _dismountOffset.z
      );
      motorcycleEntity.isMounted = false;
      playerEntity.dismountAt(_dismountPos, motorcycleEntity.headingYaw);
    }

    function toggleFreeCam() {
      isFreeCam = !isFreeCam;
      btnFreeCam.classList.toggle('active', isFreeCam);
      if (isFreeCam) {
        freeCamPos.copy(camera.position);
        _freeCamEuler.setFromQuaternion(camera.quaternion, 'YXZ');
        freeCamYaw = _freeCamEuler.y;
        freeCamPitch = THREE.MathUtils.clamp(_freeCamEuler.x, -1.35, 1.35);
        playerEntity.isFpsMode = false;
        camera.near = 0.08;
        camera.updateProjectionMatrix();
      } else {
        playerEntity.isFpsMode = cameraMode === 'FPS';
      }
    }

    function quickSave() {
      if (playerEntity.isRagdoll) {
        saveStatus = 'No guardado (ragdoll)';
        return false;
      }
      try {
        const snapshot = {
          version: 1,
          player: {
            pos: [playerEntity.body.position.x, playerEntity.body.position.y, playerEntity.body.position.z],
            vel: [playerEntity.body.velocity.x, playerEntity.body.velocity.y, playerEntity.body.velocity.z],
            headingQuat: [playerEntity.headingGroup.quaternion.x, playerEntity.headingGroup.quaternion.y, playerEntity.headingGroup.quaternion.z, playerEntity.headingGroup.quaternion.w],
            health: playerEntity.health,
            isWaving: playerEntity.isWaving,
            isMounted: motorcycleEntity.isMounted,
            camYaw,
          },
          motorcycle: {
            pos: [motorcycleEntity.body.position.x, motorcycleEntity.body.position.y, motorcycleEntity.body.position.z],
            quat: [motorcycleEntity.body.quaternion.x, motorcycleEntity.body.quaternion.y, motorcycleEntity.body.quaternion.z, motorcycleEntity.body.quaternion.w],
            vel: [motorcycleEntity.body.velocity.x, motorcycleEntity.body.velocity.y, motorcycleEntity.body.velocity.z],
            speed: motorcycleEntity.currentForwardSpeed,
            yaw: motorcycleEntity.headingYaw,
          },
          door: { open: doorEntity.doorOpen, angle: doorEntity.currentAngle },
          testModelUrl: activeTestModelUrl,
        };
        window.localStorage.setItem(QUICKSAVE_KEY, JSON.stringify(snapshot));
        saveStatus = 'Estado guardado';
        return true;
      } catch {
        saveStatus = 'Error al guardar';
        return false;
      }
    }

    function quickLoad() {
      try {
        const raw = window.localStorage.getItem(QUICKSAVE_KEY);
        if (!raw) {
          saveStatus = 'Sin guardado previo';
          return false;
        }
        const snap = JSON.parse(raw);
        if (playerEntity.isRagdoll) playerEntity.recoverFromRagdoll(camYaw);
        if (motorcycleEntity.isMounted && !snap.player?.isMounted) dismountMotorcycle();
        if (snap.motorcycle) {
          const mp = snap.motorcycle.pos, mq = snap.motorcycle.quat, mv = snap.motorcycle.vel;
          motorcycleEntity.body.position.set(mp[0], mp[1], mp[2]);
          motorcycleEntity.body.quaternion.set(mq[0], mq[1], mq[2], mq[3]);
          motorcycleEntity.body.velocity.set(mv[0], mv[1], mv[2]);
          motorcycleEntity.body.angularVelocity.set(0, 0, 0);
          motorcycleEntity.currentForwardSpeed = snap.motorcycle.speed ?? 0;
          motorcycleEntity.headingYaw = snap.motorcycle.yaw ?? 0;
          motorcycleEntity.wheelieAngle = 0;
          motorcycleEntity.leanAngle = 0;
          motorcycleEntity.syncInterpolationBuffers();
        }
        if (snap.player) {
          if (snap.player.isMounted) {
            if (!motorcycleEntity.isMounted) mountMotorcycle();
          } else {
            const pp = snap.player.pos, pv = snap.player.vel, hq = snap.player.headingQuat;
            playerEntity.body.position.set(pp[0], pp[1], pp[2]);
            playerEntity.body.velocity.set(pv[0], pv[1], pv[2]);
            playerEntity.syncInterpolationBuffers();
            playerEntity.group.position.set(pp[0], pp[1], pp[2]);
            if (Array.isArray(hq) && hq.length === 4) playerEntity.headingGroup.quaternion.set(hq[0], hq[1], hq[2], hq[3]);
          }
          playerEntity.health = snap.player.health ?? 100;
          playerEntity.isWaving = Boolean(snap.player.isWaving);
          waveButton.classList.toggle('active', playerEntity.isWaving);
          camYaw = snap.player.camYaw ?? 0;
          prevBikeYaw = motorcycleEntity.headingYaw;
        }
        if (snap.door) {
          doorEntity.doorOpen = Boolean(snap.door.open);
          doorEntity.currentAngle = snap.door.angle ?? (doorEntity.doorOpen ? Math.PI * 0.5 : 0);
        }
        if (snap.testModelUrl && snap.testModelUrl !== activeTestModelUrl) loadTestModel(snap.testModelUrl);
        else if (!snap.testModelUrl && activeTestModelUrl) clearTestModel();
        saveStatus = 'Estado cargado';
        return true;
      } catch {
        saveStatus = 'Error al cargar';
        return false;
      }
    }

    function handleInteract() {
      audioManager.unlock();
      if (isFreeCam) return;
      if (playerEntity.isRagdoll) {
        if (playerEntity.canRecoverManually()) playerEntity.recoverFromRagdoll(camYaw);
        return;
      }
      if (motorcycleEntity.isMounted) {
        dismountMotorcycle();
        return;
      }
      if (interactType === 'motorcycle') mountMotorcycle();
      else if (interactType === 'door') doorEntity.toggle();
    }

    btnFreeCam.addEventListener('click', toggleFreeCam);
    btnSave.addEventListener('click', quickSave);
    btnLoad.addEventListener('click', quickLoad);
    btnPause.addEventListener('click', () => TimeManager.togglePause());
    btnPresetBox.addEventListener('click', () => {
      const url = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/BoxAnimated/glTF-Binary/BoxAnimated.glb';
      testModelUrlInput.value = url;
      loadTestModel(url);
    });
    btnPresetHelmet.addEventListener('click', () => {
      const url = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb';
      testModelUrlInput.value = url;
      loadTestModel(url);
    });
    btnLoadModel.addEventListener('click', () => loadTestModel(testModelUrlInput.value));
    btnClearModel.addEventListener('click', clearTestModel);

    window.addEventListener('keydown', (e) => {
      audioManager.unlock();
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
      keys[e.code] = true;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!isFreeCam) {
          if (playerEntity.isRagdoll && playerEntity.canRecoverManually()) {
            playerEntity.recoverFromRagdoll(camYaw);
          } else if (!motorcycleEntity.isMounted && !playerEntity.isRagdoll) {
            jumpQueued = true;
          }
        }
      }
      if (e.code === 'KeyV' && !e.repeat) {
        if (isFreeCam) {
          isFreeCam = false;
          btnFreeCam.classList.remove('active');
        }
        if (cameraMode === 'FPS') {
          cameraMode = 'TPS';
          playerEntity.isFpsMode = false;
          camera.near = 0.08;
          camera.updateProjectionMatrix();
        }
        currentViewIndex = (currentViewIndex + 1) % CAMERA_VIEWS.length;
        pitchOffset = 0;
        zoomOffset = 0;
      }
      if (e.code === 'KeyC' && !e.repeat) toggleFreeCam();
      if (e.code === 'F2' && !e.repeat) {
        e.preventDefault();
        if (isFreeCam) {
          isFreeCam = false;
          btnFreeCam.classList.remove('active');
        }
        cameraMode = cameraMode === 'TPS' ? 'FPS' : 'TPS';
        playerEntity.isFpsMode = cameraMode === 'FPS';
        if (cameraMode === 'FPS') {
          fpsPitch = motorcycleEntity.isMounted ? -0.14 : 0;
          fpsLookYawOffset = 0;
          camera.near = 0.04;
        } else {
          camera.near = 0.08;
        }
        camera.updateProjectionMatrix();
      }
      if (e.code === 'KeyP' && !e.repeat) TimeManager.togglePause();
      if (e.code === 'KeyL' && !e.repeat) TimeManager.toggleSlowMotion();
      if (e.code === 'KeyF' && !e.repeat && !motorcycleEntity.isMounted && !playerEntity.isRagdoll) {
        playerEntity.isWaving = !playerEntity.isWaving;
        waveButton.classList.toggle('active', playerEntity.isWaving);
      }
      if (e.code === 'KeyE' && !e.repeat) handleInteract();
      if (e.code === 'KeyG' && !e.repeat) quickSave();
      if (e.code === 'KeyK' && !e.repeat) quickLoad();
      if (e.code === 'KeyH' && !e.repeat) {
        const open = debugPanel.classList.toggle('open');
        debugToggle.setAttribute('aria-expanded', String(open));
      }
    });

    window.addEventListener('keyup', (e) => {
      keys[e.code] = false;
    });

    renderer.domElement.addEventListener('pointerdown', (e) => {
      audioManager.unlock();
      if (cameraPointerId !== null) return;
      isDraggingCamera = true;
      cameraPointerId = e.pointerId;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
    });

    window.addEventListener('pointermove', (e) => {
      if (!isDraggingCamera || e.pointerId !== cameraPointerId) return;
      const dx = e.clientX - lastPointerX;
      const dy = e.clientY - lastPointerY;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      if (isFreeCam) {
        freeCamYaw -= dx * 0.0055;
        freeCamPitch = THREE.MathUtils.clamp(freeCamPitch - dy * 0.0045, -1.4, 1.4);
      } else if (cameraMode === 'FPS' && motorcycleEntity.isMounted) {
        fpsLookYawOffset = THREE.MathUtils.clamp(fpsLookYawOffset - dx * 0.0055, -1.25, 1.25);
        fpsPitch = THREE.MathUtils.clamp(fpsPitch - dy * 0.0045, -1.1, 1.0);
      } else if (cameraMode === 'FPS') {
        camYaw -= dx * 0.0055;
        fpsPitch = THREE.MathUtils.clamp(fpsPitch - dy * 0.0045, -1.2, 1.15);
      } else {
        camYaw -= dx * 0.0055;
        pitchOffset = THREE.MathUtils.clamp(pitchOffset + dy * 0.0045, -0.22, 0.72);
      }
    });

    const releaseCameraPointer = (e) => {
      if (e.pointerId === cameraPointerId) {
        isDraggingCamera = false;
        cameraPointerId = null;
      }
    };
    window.addEventListener('pointerup', releaseCameraPointer);
    window.addEventListener('pointercancel', releaseCameraPointer);

    renderer.domElement.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (isFreeCam) freeCamSpeed = THREE.MathUtils.clamp(freeCamSpeed - e.deltaY * 0.01, 2.5, 28);
        else if (cameraMode === 'TPS') zoomOffset = THREE.MathUtils.clamp(zoomOffset + e.deltaY * 0.004, -1.8, 3.8);
      },
      { passive: false }
    );

    const joystickZone = document.getElementById('joystick-zone');
    const joystickKnob = document.getElementById('joystick-knob');
    const joyInput = { x: 0, y: 0, active: false, pointerId: null };
    const maxJoyRadius = 40;

    function updateJoystickFromPointer(clientX, clientY) {
      const rect = joystickZone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > maxJoyRadius) {
        dx = (dx / dist) * maxJoyRadius;
        dy = (dy / dist) * maxJoyRadius;
      }
      joystickKnob.style.transform = \`translate3d(\${dx}px, \${dy}px, 0)\`;
      const normX = dx / maxJoyRadius;
      const normY = dy / maxJoyRadius;
      const mag = Math.hypot(normX, normY);
      joyInput.x = mag < 0.06 ? 0 : normX;
      joyInput.y = mag < 0.06 ? 0 : normY;
    }

    joystickZone.addEventListener('pointerdown', (e) => {
      audioManager.unlock();
      e.preventDefault();
      e.stopPropagation();
      joyInput.active = true;
      joyInput.pointerId = e.pointerId;
      joystickZone.setPointerCapture(e.pointerId);
      updateJoystickFromPointer(e.clientX, e.clientY);
    });
    joystickZone.addEventListener('pointermove', (e) => {
      if (!joyInput.active || e.pointerId !== joyInput.pointerId) return;
      e.preventDefault();
      updateJoystickFromPointer(e.clientX, e.clientY);
    });
    const resetJoystick = (e) => {
      if (e.pointerId !== joyInput.pointerId) return;
      joyInput.active = false;
      joyInput.pointerId = null;
      joyInput.x = 0;
      joyInput.y = 0;
      joystickKnob.style.transform = 'translate3d(0px, 0px, 0px)';
    };
    joystickZone.addEventListener('pointerup', resetJoystick);
    joystickZone.addEventListener('pointercancel', resetJoystick);

    jumpButton.addEventListener('pointerdown', (e) => {
      audioManager.unlock();
      e.preventDefault();
      e.stopPropagation();
      jumpButton.classList.add('active');
      if (!motorcycleEntity.isMounted) jumpQueued = true;
    });
    const releaseJump = () => jumpButton.classList.remove('active');
    jumpButton.addEventListener('pointerup', releaseJump);
    jumpButton.addEventListener('pointercancel', releaseJump);

    waveButton.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!motorcycleEntity.isMounted && !playerEntity.isRagdoll) {
        playerEntity.isWaving = !playerEntity.isWaving;
        waveButton.classList.toggle('active', playerEntity.isWaving);
      }
    });

    interactButton.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleInteract();
    });

    world.addEventListener('preStep', () => entityManager.fixedUpdate(FIXED_DT));
    world.addEventListener('postStep', () => {
      playerEntity.capturePostStep();
      motorcycleEntity.capturePostStep();
    });

    const _currentLookAt = new THREE.Vector3(0, CAMERA_VIEWS[0].targetHeight, 0);
    const _currentCamPos = new THREE.Vector3(0, 2.9, CAMERA_VIEWS[0].distance);
    const camRaycaster = new THREE.Raycaster();
    camera.position.copy(_currentCamPos);
    camera.lookAt(_currentLookAt);

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });

    const clock = new THREE.Clock();
    let lastHudText = '';
    let lastPromptState = '';
    let fpsFrames = 0;
    let fpsAccum = 0;
    let reportedFps = 60;
    let reportedDrawCalls = 0;

    function animate() {
      requestAnimationFrame(animate);
      const rawDt = Math.min(clock.getDelta(), 0.05);
      const scaledDt = rawDt * timeScale;
      fpsFrames += 1;
      fpsAccum += rawDt;
      if (fpsAccum >= 0.4) {
        reportedFps = Math.max(1, Math.round(fpsFrames / fpsAccum));
        fpsFrames = 0;
        fpsAccum = 0;
      }
      if (boostCooldown > 0) boostCooldown = Math.max(0, boostCooldown - rawDt);

      let rawX = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
      let rawZ = (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) - (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0);
      if (Math.abs(joyInput.x) > 0 || Math.abs(joyInput.y) > 0) {
        rawX = joyInput.x;
        rawZ = joyInput.y;
      }

      if (isFreeCam) {
        driveState.throttle = 0;
        driveState.steer = 0;
        steerState.inputMag = 0;
        steerState.maxSpeed = 0;
        steerState.jumpQueued = false;
        jumpQueued = false;
      } else if (playerEntity.isRagdoll) {
        driveState.throttle = 0;
        driveState.steer = 0;
        steerState.inputMag = 0;
        steerState.maxSpeed = 0;
        steerState.jumpQueued = false;
        if (jumpQueued && playerEntity.canRecoverManually()) {
          playerEntity.recoverFromRagdoll(camYaw);
        }
        jumpQueued = false;
      } else if (motorcycleEntity.isMounted) {
        driveState.throttle = THREE.MathUtils.clamp(-rawZ, -1, 1);
        driveState.steer = THREE.MathUtils.clamp(-rawX, -1, 1);
        steerState.inputMag = 0;
        steerState.maxSpeed = 0;
        steerState.jumpQueued = false;
        jumpQueued = false;
      } else {
        driveState.throttle = 0;
        driveState.steer = 0;
        const inputMag = Math.min(1, Math.hypot(rawX, rawZ));
        const isSprinting = Boolean(keys['ShiftLeft'] || keys['ShiftRight'] || (joyInput.active && inputMag > 0.78));
        _forward.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
        _right.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
        _moveDir.set(0, 0, 0);
        if (inputMag > 0.01) {
          _moveDir.addScaledVector(_right, rawX).addScaledVector(_forward, -rawZ);
          if (_moveDir.lengthSq() > 0.0001) _moveDir.normalize();
        }
        steerState.dirX = _moveDir.x;
        steerState.dirZ = _moveDir.z;
        steerState.inputMag = inputMag;
        steerState.maxSpeed = (isSprinting ? ${PHYSICS_CONFIG.runSpeed} : ${PHYSICS_CONFIG.walkSpeed}) * Math.max(0.55, inputMag);
        if (jumpQueued && !TimeManager.isPaused) {
          steerState.jumpQueued = true;
          jumpQueued = false;
        } else if (TimeManager.isPaused) {
          jumpQueued = false;
        }
      }

      if (scaledDt > 0) world.step(FIXED_DT, scaledDt, 3);

      playerEntity.mountedSteerAngle = motorcycleEntity.smoothSteerAngle;
      const alpha = THREE.MathUtils.clamp(world.accumulator / FIXED_DT, 0, 1);
      entityManager.update(scaledDt, alpha);
      if (activeTestModelMixer && scaledDt > 0) activeTestModelMixer.update(scaledDt);
      if (!playerEntity.isRagdoll && scaledDt > 0) {
        triggerSystem.update(
          motorcycleEntity.isMounted ? 'motorcycle' : 'player',
          motorcycleEntity.isMounted ? motorcycleEntity.body : playerEntity.body,
          scaledDt
        );
      }

      const speedRatio = THREE.MathUtils.clamp(Math.abs(motorcycleEntity.currentForwardSpeed) / VEHICLE_CONFIG.maxForwardSpeed, 0, 1);
      audioManager.updateEngine(speedRatio, motorcycleEntity.isMounted, TimeManager.isPaused, timeScale, driveState.throttle);

      const focusPos = motorcycleEntity.isMounted ? motorcycleEntity.interpolatedPosition : playerEntity.interpolatedPosition;
      const focusBaseY = motorcycleEntity.isMounted ? focusPos.y - VEHICLE_CONFIG.boxSize[1] / 2 : focusPos.y - playerEntity.capsuleHalfHeight;
      dirLight.position.set(focusPos.x + 12, focusBaseY + 22, focusPos.z + 10);
      dirLight.target.position.set(focusPos.x, focusBaseY, focusPos.z);

      const activePreset = CAMERA_VIEWS[currentViewIndex];
      const realHorizSpeed = motorcycleEntity.isMounted
        ? Math.abs(motorcycleEntity.currentForwardSpeed)
        : Math.hypot(playerEntity.body.velocity.x, playerEntity.body.velocity.z);

      if (isFreeCam) {
        const flySpeed = freeCamSpeed * (keys['ShiftLeft'] || keys['ShiftRight'] ? 2.1 : 1.0);
        const cosPitch = Math.cos(freeCamPitch);
        _freeCamDir.set(-Math.sin(freeCamYaw) * cosPitch, Math.sin(freeCamPitch), -Math.cos(freeCamYaw) * cosPitch).normalize();
        _freeCamRight.set(Math.cos(freeCamYaw), 0, -Math.sin(freeCamYaw));
        const vertInput = (keys['Space'] ? 1 : 0) - (keys['KeyQ'] || keys['ControlLeft'] || keys['ControlRight'] ? 1 : 0);
        freeCamPos.addScaledVector(_freeCamDir, -rawZ * flySpeed * rawDt);
        freeCamPos.addScaledVector(_freeCamRight, rawX * flySpeed * rawDt);
        freeCamPos.y = Math.max(0.25, freeCamPos.y + vertInput * flySpeed * rawDt);
        camera.position.copy(freeCamPos);
        _lookTarget.copy(freeCamPos).add(_freeCamDir);
        camera.lookAt(_lookTarget);
      } else {
        if (motorcycleEntity.isMounted) {
          const bikeYaw = motorcycleEntity.headingYaw;
          const bikeYawDelta = bikeYaw - prevBikeYaw;
          prevBikeYaw = bikeYaw;
          if (cameraMode === 'TPS') {
            camYaw += bikeYawDelta * 0.88;
            if (!isDraggingCamera && Math.abs(motorcycleEntity.currentForwardSpeed) > 0.5) {
              camYaw = dampAngle(camYaw, bikeYaw, 2.8, rawDt);
            }
          }
        }

        if (cameraMode === 'FPS') {
          playerEntity.getHeadWorldPosition(_headWorldPos);
          const targetFov = (motorcycleEntity.isMounted ? 80 : 75) + (realHorizSpeed > 6 ? 6.5 * speedRatio : 0);
          smoothFov = THREE.MathUtils.damp(smoothFov, targetFov, 10, rawDt);
          if (Math.abs(camera.fov - smoothFov) > 0.02) {
            camera.fov = smoothFov;
            camera.updateProjectionMatrix();
          }
          const effectiveYaw = motorcycleEntity.isMounted ? motorcycleEntity.headingYaw + fpsLookYawOffset : camYaw;
          const cosPitch = Math.cos(fpsPitch);
          const eyeFwd = motorcycleEntity.isMounted ? 0.14 : 0.08;
          _fpsForwardOffset.set(-Math.sin(effectiveYaw) * eyeFwd, motorcycleEntity.isMounted ? 0.04 : 0.01, -Math.cos(effectiveYaw) * eyeFwd);
          _currentCamPos.copy(_headWorldPos).add(_fpsForwardOffset);
          _fpsLookTarget.set(_currentCamPos.x - Math.sin(effectiveYaw) * cosPitch * 10, _currentCamPos.y + Math.sin(fpsPitch) * 10, _currentCamPos.z - Math.cos(effectiveYaw) * cosPitch * 10);
          _currentLookAt.copy(_fpsLookTarget);
        } else {
          let gtaLagDistOffset = 0;
          if (motorcycleEntity.isMounted) {
            if (driveState.throttle > 0.05) gtaLagDistOffset = 0.95 * driveState.throttle * (0.35 + 0.65 * speedRatio);
            else if (driveState.throttle < -0.05 && motorcycleEntity.currentForwardSpeed > 0.8) gtaLagDistOffset = -0.7 * Math.abs(driveState.throttle) * speedRatio;
          }
          const baseDist = motorcycleEntity.isMounted ? Math.max(activePreset.distance, 5.2) + gtaLagDistOffset : activePreset.distance;
          smoothDistance = THREE.MathUtils.damp(smoothDistance, THREE.MathUtils.clamp(baseDist + zoomOffset, 2.2, 12.5), 5.5, rawDt);
          smoothPitch = THREE.MathUtils.damp(smoothPitch, THREE.MathUtils.clamp(activePreset.pitch + pitchOffset, 0.06, 1.15), 7, rawDt);
          smoothShoulderX = THREE.MathUtils.damp(smoothShoulderX, motorcycleEntity.isMounted ? 0 : activePreset.shoulderOffsetX, 7, rawDt);
          smoothTargetHeight = THREE.MathUtils.damp(smoothTargetHeight, motorcycleEntity.isMounted ? 1.18 : activePreset.targetHeight, 7, rawDt);
          const targetFov = activePreset.fov + (realHorizSpeed > 4.0 ? 7.5 * speedRatio : 0);
          smoothFov = THREE.MathUtils.damp(smoothFov, targetFov, 6.5, rawDt);
          if (Math.abs(camera.fov - smoothFov) > 0.02) {
            camera.fov = smoothFov;
            camera.updateProjectionMatrix();
          }
          _right.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
          _lookTarget.set(focusPos.x + _right.x * smoothShoulderX, focusBaseY + smoothTargetHeight, focusPos.z + _right.z * smoothShoulderX);
          _currentLookAt.x = THREE.MathUtils.damp(_currentLookAt.x, _lookTarget.x, 12, rawDt);
          _currentLookAt.y = THREE.MathUtils.damp(_currentLookAt.y, _lookTarget.y, 12, rawDt);
          _currentLookAt.z = THREE.MathUtils.damp(_currentLookAt.z, _lookTarget.z, 12, rawDt);

          const horizDist = smoothDistance * Math.cos(smoothPitch);
          const vertDist = smoothDistance * Math.sin(smoothPitch);
          _desiredCamPos.set(_lookTarget.x + Math.sin(camYaw) * horizDist, _lookTarget.y + vertDist, _lookTarget.z + Math.cos(camYaw) * horizDist);

          _rayDir.subVectors(_desiredCamPos, _lookTarget);
          const desiredRayLen = _rayDir.length();
          if (desiredRayLen > 0.01) {
            _rayDir.divideScalar(desiredRayLen);
            camRaycaster.set(_lookTarget, _rayDir);
            camRaycaster.near = 0.2;
            camRaycaster.far = desiredRayLen;
            const hits = camRaycaster.intersectObjects(cameraColliders, false);
            if (hits.length > 0) {
              const safeDist = Math.max(0.8, hits[0].distance - 0.35);
              _desiredCamPos.copy(_lookTarget).addScaledVector(_rayDir, safeDist);
            }
          }
          _desiredCamPos.y = Math.max(0.38, _desiredCamPos.y);
          const followLambda = motorcycleEntity.isMounted ? 6.6 : 9.5;
          _currentCamPos.x = THREE.MathUtils.damp(_currentCamPos.x, _desiredCamPos.x, followLambda, rawDt);
          _currentCamPos.y = THREE.MathUtils.damp(_currentCamPos.y, _desiredCamPos.y, followLambda, rawDt);
          _currentCamPos.z = THREE.MathUtils.damp(_currentCamPos.z, _desiredCamPos.z, followLambda, rawDt);
          _currentCamPos.y = Math.max(0.35, _currentCamPos.y);
        }

        _shakeOffset.set(0, 0, 0);
        if (shakeTimer > 0) {
          if (!TimeManager.isPaused) shakeTimer = Math.max(0, shakeTimer - rawDt);
          const decay = shakeDuration > 0 ? shakeTimer / shakeDuration : 0;
          const mag = shakeIntensity * decay;
          _shakeOffset.set((Math.random() * 2 - 1) * mag, (Math.random() * 2 - 1) * mag * 0.85, (Math.random() * 2 - 1) * mag);
          if (shakeTimer === 0) shakeIntensity = 0;
        }

        camera.position.copy(_currentCamPos).add(_shakeOffset);
        camera.lookAt(_currentLookAt);
      }

      if (isFreeCam || playerEntity.isRagdoll) {
        interactType = null;
        interactPromptText = null;
      } else if (motorcycleEntity.isMounted) {
        interactType = 'dismount';
        interactPromptText = 'Presiona E';
      } else {
        _playerRayOrigin.set(playerEntity.interpolatedPosition.x, focusBaseY + 1.15, playerEntity.interpolatedPosition.z);
        const hit = engineRaycaster.castFromCameraCenter(camera, allInteractTargets, VEHICLE_CONFIG.interactDistance, _playerRayOrigin);
        if (hit) {
          const hitType = hit.object.userData.interactType;
          const distToPlayer = hit.point.distanceTo(_playerRayOrigin);
          if (hitType === 'motorcycle' && distToPlayer <= VEHICLE_CONFIG.interactDistance) {
            interactType = 'motorcycle';
            interactPromptText = 'Presiona E';
          } else if (hitType === 'door' && distToPlayer <= DOOR_CONFIG.interactDistance) {
            interactType = 'door';
            interactPromptText = 'Presiona E';
          } else {
            interactType = null;
            interactPromptText = null;
          }
        } else {
          interactType = null;
          interactPromptText = null;
        }
      }

      renderer.render(scene, camera);
      reportedDrawCalls = renderer.info.render.calls;

      const speedKmh = Math.round(Math.abs(motorcycleEntity.currentForwardSpeed) * 3.6);
      speedValueEl.textContent = String(speedKmh);
      const viewText = isFreeCam ? 'Free-Cam' : cameraMode === 'FPS' ? 'FPS' : activePreset.label;
      const timeText = timeScale === 0 ? 'PAUSA' : timeScale + 'x';
      const nextHudText = \`Animación: \${playerEntity.stateLabel}\${playerEntity.isWaving ? ' + Wave' : ''}\\nSuelo: \${playerEntity.isGrounded ? 'En suelo' : 'En aire'}\\nSalud: HP \${playerEntity.health}\\nMoto: \${motorcycleEntity.isMounted ? 'Montado (' + speedKmh + ' km/h)' : 'Estacionada'}\\nCámara: \${viewText}\\nTiempo: \${timeText}\\nRendimiento: \${reportedFps} FPS · \${reportedDrawCalls} draws\${lastTriggerLabel ? '\\nTrigger: ' + lastTriggerLabel : ''}\${saveStatus ? '\\nGuardado: ' + saveStatus : ''}\`;
      if (nextHudText !== lastHudText) {
        lastHudText = nextHudText;
        stateReadout.textContent = nextHudText;
      }

      const promptKey = \`\${interactType}|\${interactPromptText}|\${motorcycleEntity.isMounted}\`;
      if (promptKey !== lastPromptState) {
        lastPromptState = promptKey;
        interactPromptEl.classList.toggle('visible', Boolean(interactPromptText));
        crosshair.classList.toggle('active', interactType === 'door' || interactType === 'motorcycle');
        interactButton.classList.toggle('visible', Boolean(interactPromptText));
        interactButton.textContent = motorcycleEntity.isMounted ? 'BAJAR (E)' : 'USAR (E)';
        waveButton.style.display = motorcycleEntity.isMounted ? 'none' : 'flex';
        jumpButton.style.display = motorcycleEntity.isMounted ? 'none' : 'flex';
      }
    }

    animate();
  </script>
</body>
</html>`;
}
