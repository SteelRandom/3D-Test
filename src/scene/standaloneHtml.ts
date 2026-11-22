import {
  CAMERA_VIEWS,
  DOOR_CONFIG,
  MOTORCYCLE_MODEL_URL,
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
      width: 8px;
      height: 8px;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      border: 1.5px solid rgba(15, 23, 42, 0.55);
      background: rgba(255, 255, 255, 0.75);
      pointer-events: none;
      z-index: 12;
    }

    #crosshair.active {
      width: 11px;
      height: 11px;
      border-color: #d97706;
      background: #fbbf24;
    }

    #hud-top {
      position: fixed;
      top: 16px;
      left: 16px;
      z-index: 10;
      pointer-events: none;
      color: #0f172a;
      background: rgba(255, 255, 255, 0.86);
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 13px;
      line-height: 1.45;
      max-width: min(680px, calc(100vw - 32px));
    }

    #hud-top strong {
      display: block;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 2px;
    }

    #hud-top .meta {
      color: #334155;
      font-size: 12px;
    }

    #interact-prompt {
      position: fixed;
      left: 50%;
      bottom: 84px;
      transform: translateX(-50%);
      z-index: 15;
      pointer-events: none;
      padding: 9px 16px;
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.16);
      color: #ffffff;
      font-size: 13px;
      font-weight: 600;
      display: none;
    }

    #interact-prompt.visible {
      display: block;
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

  <div id="hud-top">
    <strong>Núcleo Engine 3D · Personaje + Moto + FPS</strong>
    <div class="meta" id="pc-hint">WASD mover/conducir · Shift correr · Espacio saltar · E puerta/moto · F saludar · V vista · F2 FPS/TPS · P pausa · L lenta</div>
    <div class="meta" id="state-readout">Estado: Idle · HP: 100 · Vista: Estándar · Tiempo: 1x</div>
  </div>

  <div id="interact-prompt">Presiona E para interactuar</div>

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
    <div id="loading-text">Cargando Soldier.glb (0%)...</div>
    <div class="loading-bar-track">
      <div class="loading-bar-fill" id="loading-bar"></div>
    </div>
  </div>

  <script type="module">
    import * as THREE from 'three';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
    import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
    import * as CANNON from 'cannon-es';

    const SOLDIER_URL = '${SOLDIER_MODEL_URL}';
    const MOTORCYCLE_URL = '${MOTORCYCLE_MODEL_URL}';
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
        this.engineActive = false;
      }

      ensureContext() {
        if (this.muted) return null;
        if (!this.ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) return null;
          this.ctx = new AudioCtx();
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.value = 0.75;
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

      updateEngine(speedRatio, isMounted, isPaused, scale = 1.0) {
        if (this.muted || !isMounted || isPaused) {
          if (this.ctx && this.engineGain) {
            this.engineGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.06);
          }
          return;
        }
        if (!this.engineActive) this.ensureEngineNodes();
        if (!this.ctx || !this.engineActive) return;

        const clamped = Math.max(0, Math.min(1, speedRatio));
        const now = this.ctx.currentTime;
        const scalePitch = scale < 0.9 ? 0.65 : 1.0;

        const mainFreq = (46 + clamped * 108) * scalePitch;
        this.engineMainOsc.frequency.setTargetAtTime(mainFreq, now, 0.05);
        this.engineSubOsc.frequency.setTargetAtTime(mainFreq * 0.5, now, 0.05);
        this.engineFilter.frequency.setTargetAtTime((210 + clamped * 980) * scalePitch, now, 0.06);
        this.engineGain.gain.setTargetAtTime(0.055 + clamped * 0.11, now, 0.06);
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
    const stateReadout = document.getElementById('state-readout');
    const interactPromptEl = document.getElementById('interact-prompt');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    const loadingBar = document.getElementById('loading-bar');
    const touchControls = document.getElementById('touch-controls');
    const interactButton = document.getElementById('interact-button');
    const waveButton = document.getElementById('wave-button');
    const jumpButton = document.getElementById('jump-button');

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
    dirLight.shadow.mapSize.set(2048, 2048);
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
    world.addContactMaterial(new CANNON.ContactMaterial(groundMat, playerMat, { friction: 0.0, restitution: 0.0 }));
    world.addContactMaterial(new CANNON.ContactMaterial(groundMat, vehicleMat, { friction: 0.0, restitution: 0.0 }));

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

    function dampAngle(current, target, lambda, dt) {
      let diff = (target - current) % (Math.PI * 2);
      if (diff > Math.PI) diff -= Math.PI * 2;
      if (diff < -Math.PI) diff += Math.PI * 2;
      return current + diff * (1 - Math.exp(-lambda * dt));
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

    function buildCharacterBoneRig(model) {
      model.updateMatrixWorld(true);
      const bones = [];
      model.traverse((obj) => {
        if (obj.isBone) bones.push(obj);
      });
      const findExact = (fn) => bones.find((b) => fn(b.name.toLowerCase()));
      const rig = {};
      const lu = findExact((n) => n.includes('leftupleg') || n.includes('leftthigh'));
      const ru = findExact((n) => n.includes('rightupleg') || n.includes('rightthigh'));
      const ll = findExact((n) => (n.includes('leftleg') || n.includes('leftcalf')) && !n.includes('upleg'));
      const rl = findExact((n) => (n.includes('rightleg') || n.includes('rightcalf')) && !n.includes('upleg'));
      const lf = findExact((n) => n.includes('leftfoot'));
      const rf = findExact((n) => n.includes('rightfoot'));
      const la = findExact((n) => (n.includes('leftarm') || n.includes('leftupperarm')) && !n.includes('forearm'));
      const ra = findExact((n) => (n.includes('rightarm') || n.includes('rightupperarm')) && !n.includes('forearm'));
      const lfa = findExact((n) => n.includes('leftforearm') || n.includes('leftlowerarm'));
      const rfa = findExact((n) => n.includes('rightforearm') || n.includes('rightlowerarm'));
      const lh = findExact((n) => n.endsWith('lefthand'));
      const rh = findExact((n) => n.endsWith('righthand'));
      const sp = findExact((n) => n.endsWith(':spine') || n === 'spine');
      const sp1 = findExact((n) => n.includes('spine1'));

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
      if (Math.abs(pitch) > 0.001) {
        _dq1.setFromAxisAngle(entry.pitchAxis, pitch);
        entry.bone.quaternion.multiply(_dq1);
      }
      if (Math.abs(yaw) > 0.001) {
        _dq2.setFromAxisAngle(entry.yawAxis, yaw);
        entry.bone.quaternion.multiply(_dq2);
      }
      if (Math.abs(roll) > 0.001) {
        _dq3.setFromAxisAngle(entry.rollAxis, roll);
        entry.bone.quaternion.multiply(_dq3);
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

    function applyMotorcycleSeatedPose(rig, steerAngle) {
      applyBoneEulerDelta(rig.spine, 0.2, steerAngle * 0.08, 0);
      applyBoneEulerDelta(rig.spine1, 0.12, 0, 0);
      applyBoneEulerDelta(rig.leftUpLeg, 0.92, -0.18, 0.24);
      applyBoneEulerDelta(rig.rightUpLeg, 0.92, 0.18, -0.24);
      applyBoneEulerDelta(rig.leftLeg, -1.32, 0, 0);
      applyBoneEulerDelta(rig.rightLeg, -1.32, 0, 0);
      applyBoneEulerDelta(rig.leftFoot, 0.22, 0, 0);
      applyBoneEulerDelta(rig.rightFoot, 0.22, 0, 0);
      const steerReach = steerAngle * 0.16;
      applyBoneEulerDelta(rig.leftArm, 1.12 - steerReach, -0.22, -0.14);
      applyBoneEulerDelta(rig.rightArm, 1.12 + steerReach, 0.22, 0.14);
      applyBoneEulerDelta(rig.leftForeArm, 0.36, 0.15, 0);
      applyBoneEulerDelta(rig.rightForeArm, 0.36, -0.15, 0);
      applyBoneEulerDelta(rig.leftHand, -0.22, 0, 0);
      applyBoneEulerDelta(rig.rightHand, -0.22, 0, 0);
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
      constructor(driveInput, audio) {
        super('motorcycle');
        this.driveInput = driveInput;
        this.audio = audio;
        this.isMounted = false;
        this.currentForwardSpeed = 0;
        this.smoothSteerAngle = 0;
        this.leanAngle = 0;
        this.headingYaw = VEHICLE_CONFIG.spawnYaw;
        this.wheelSpinAngle = 0;
        this.minAirborneVy = 0;
        this.isGrounded = true;

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
        this.seatAnchor = new THREE.Group();
        this.seatAnchor.position.set(0, -sy / 2 + 0.78, 0.2);
        this.group.add(this.leanGroup);
        this.leanGroup.add(this.seatAnchor);
        scene.add(this.group);

        const hitProxy = new THREE.Mesh(
          new THREE.BoxGeometry(sx * 1.35, sy * 1.35, sz * 1.12),
          new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
        );
        hitProxy.position.set(0, 0.14, 0);
        hitProxy.userData.interactType = 'motorcycle';
        this.group.add(hitProxy);

        this.proceduralRig = buildProceduralMotorcycle();
        this.leanGroup.add(this.proceduralRig.visualRoot);
        this.interactTargets = [hitProxy, ...this.proceduralRig.interactMeshes];
        this.glbRoot = null;
        this.glbFrontWheel = null;
        this.glbRearWheel = null;
        this.glbFork = null;
      }

      attachGlbModel(model) {
        model.position.set(0, 0, 0);
        model.updateMatrixWorld(true);
        const rawBox = new THREE.Box3().setFromObject(model, true);
        const rawSize = new THREE.Vector3();
        rawBox.getSize(rawSize);
        const maxHoriz = Math.max(rawSize.x, rawSize.z, 0.001);
        model.scale.setScalar(VEHICLE_CONFIG.boxSize[2] / maxHoriz);
        if (rawSize.x > rawSize.z) model.rotation.y = Math.PI / 2;
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model, true);
        const center = new THREE.Vector3();
        box.getCenter(center);
        model.position.set(-center.x, -VEHICLE_CONFIG.boxSize[1] / 2 - box.min.y, -center.z);
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.userData.interactType = 'motorcycle';
            this.interactTargets.push(child);
          }
          const n = child.name.toLowerCase();
          if (!this.glbFrontWheel && /(front.*wheel|wheel.*front|wheel_f)/i.test(n)) this.glbFrontWheel = child;
          else if (!this.glbRearWheel && /(rear.*wheel|back.*wheel|wheel.*rear|wheel_r)/i.test(n)) this.glbRearWheel = child;
          else if (!this.glbFork && /(handle|fork|steer|manubrio)/i.test(n)) this.glbFork = child;
        });
        this.glbRoot = model;
        this.proceduralRig.visualRoot.visible = false;
        this.leanGroup.add(model);
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
          const throttle = this.driveInput.throttle;
          const steer = this.driveInput.steer;
          if (throttle > 0.05) {
            vFwd = Math.min(VEHICLE_CONFIG.maxForwardSpeed * throttle, vFwd + VEHICLE_CONFIG.accel * throttle * fixedDt);
          } else if (throttle < -0.05) {
            if (vFwd > 0.35) vFwd = Math.max(0, vFwd - VEHICLE_CONFIG.brakeDecel * Math.abs(throttle) * fixedDt);
            else vFwd = Math.max(-VEHICLE_CONFIG.maxReverseSpeed * Math.abs(throttle), vFwd - VEHICLE_CONFIG.accel * 0.75 * Math.abs(throttle) * fixedDt);
          } else {
            vFwd *= Math.exp(-VEHICLE_CONFIG.rollingDamping * fixedDt);
            if (Math.abs(vFwd) < 0.04) vFwd = 0;
          }
          vLat *= Math.exp(-11.0 * fixedDt);
          this.smoothSteerAngle = THREE.MathUtils.damp(this.smoothSteerAngle, steer, 10, fixedDt);
          const speedTurnFactor = THREE.MathUtils.clamp(Math.abs(vFwd) / 3.2, 0.32, 1.0);
          const yawRate = this.smoothSteerAngle * VEHICLE_CONFIG.steerSpeed * speedTurnFactor * (vFwd < -0.25 ? -1 : 1);
          this.body.angularVelocity.y = this.isGrounded ? yawRate : yawRate * 0.35;
        } else {
          vFwd *= Math.exp(-6.0 * fixedDt);
          vLat *= Math.exp(-10.0 * fixedDt);
          this.smoothSteerAngle = THREE.MathUtils.damp(this.smoothSteerAngle, 0, 8, fixedDt);
          this.body.angularVelocity.y *= Math.exp(-8.0 * fixedDt);
        }

        this.currentForwardSpeed = vFwd;
        this.body.velocity.x = _bikeFwd.x * vFwd + _bikeRight.x * vLat;
        this.body.velocity.z = _bikeFwd.z * vFwd + _bikeRight.z * vLat;
      }

      update(dt, alpha) {
        _interpPos.lerpVectors(this.previousPosition, this.currentPosition, alpha);
        _interpQuat.slerpQuaternions(this.previousQuaternion, this.currentQuaternion, alpha);
        this.interpolatedPosition.copy(_interpPos);
        this.interpolatedQuaternion.copy(_interpQuat);
        this.group.position.copy(_interpPos);
        this.group.quaternion.copy(_interpQuat);

        _bikeEuler.setFromQuaternion(_interpQuat, 'YXZ');
        this.headingYaw = _bikeEuler.y;

        const speedRatio = THREE.MathUtils.clamp(Math.abs(this.currentForwardSpeed) / VEHICLE_CONFIG.maxForwardSpeed, 0, 1);
        const targetLean = this.isMounted ? this.smoothSteerAngle * (0.14 + speedRatio * 0.28) : 0.06;
        if (dt > 0) {
          this.leanAngle = THREE.MathUtils.damp(this.leanAngle, targetLean, 9, dt);
          this.wheelSpinAngle -= (this.currentForwardSpeed / VEHICLE_CONFIG.wheelRadius) * dt;
        }
        this.leanGroup.rotation.z = this.leanAngle;
        this.proceduralRig.frontForkPivot.rotation.y = this.smoothSteerAngle * 0.45;
        this.proceduralRig.frontWheelSpin.rotation.x = this.wheelSpinAngle;
        this.proceduralRig.rearWheelSpin.rotation.x = this.wheelSpinAngle;
        if (this.glbRoot) {
          if (this.glbFork) this.glbFork.rotation.y = this.smoothSteerAngle * 0.45;
          if (this.glbFrontWheel) this.glbFrontWheel.rotation.x = this.wheelSpinAngle;
          if (this.glbRearWheel) this.glbRearWheel.rotation.x = this.wheelSpinAngle;
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
        this.isFpsMode = false;
        this.mountedSteerAngle = 0;
        this.isGrounded = false;
        this.coyoteTimer = 0;
        this.airBlend = 0;
        this.isWaving = false;
        this.waveBlend = 0;
        this.minAirborneVy = 0;
        this.stateLabel = 'Idle';

        this.baseMixer = null;
        this.upperMixer = null;
        this.maskedUpperBones = [];
        this.actions = {};
        this.activeClipName = 'Idle';
        this.boneRig = {};
        this.headBone = null;
        this.visorMeshes = [];
      }

      mountTo(seatAnchor) {
        if (this.isMounted) return;
        this.isMounted = true;
        this.isWaving = false;
        this.waveBlend = 0;
        this.steerInput.jumpQueued = false;
        if (this.bodyInWorld) {
          world.removeBody(this.body);
          this.bodyInWorld = false;
        }
        seatAnchor.add(this.group);
        this.group.position.set(0, -0.08, 0.02);
        this.group.quaternion.identity();
        this.headingGroup.quaternion.identity();
        this.switchAnimation('Idle', 0.12);
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
        this.headingGroup.quaternion.setFromAxisAngle(_upAxis, facingYaw);
        this.minAirborneVy = 0;
        this.audio.playSound('dismount', { volume: 0.7 });
      }

      syncInterpolationBuffers() {
        this.previousPosition.set(this.body.position.x, this.body.position.y, this.body.position.z);
        this.currentPosition.copy(this.previousPosition);
        this.previousQuaternion.set(this.body.quaternion.x, this.body.quaternion.y, this.body.quaternion.z, this.body.quaternion.w);
        this.currentQuaternion.copy(this.previousQuaternion);
      }

      capturePostStep() {
        if (this.isMounted) return;
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
            this.body.applyForce(new CANNON.Vec3((dvx / dvMag) * forceScale, 0, (dvz / dvMag) * forceScale), this.body.position);
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
        if (this.isMounted) {
          this.stateLabel = 'Drive';
          this.isGrounded = true;
          this.switchAnimation('Idle', 0.14);
          if (this.baseMixer) this.baseMixer.update(dt > 0 ? dt : 0);
          applyMotorcycleSeatedPose(this.boneRig, this.mountedSteerAngle);
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
    const motorcycleEntity = entityManager.add(new MotorcycleEntity(driveState, audioManager));
    const playerEntity = entityManager.add(new PlayerEntity(LEVEL_JSON.spawn, steerState, audioManager));

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
        for (const clipName of ['Idle', 'Walk', 'Run']) {
          const clip = THREE.AnimationClip.findByName(gltf.animations, clipName);
          if (clip) playerEntity.actions[clipName] = playerEntity.baseMixer.clipAction(clip);
        }
        if (playerEntity.actions.Idle) {
          playerEntity.actions.Idle.play();
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

    gltfLoader.load(MOTORCYCLE_URL, (gltf) => motorcycleEntity.attachGlbModel(gltf.scene), undefined, () => {});

    // 6. Controles PC y Móvil
    const keys = Object.create(null);
    let jumpQueued = false;
    let cameraMode = 'TPS';
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

    function handleInteract() {
      audioManager.unlock();
      if (motorcycleEntity.isMounted) {
        _dismountOffset.set(-1.35, 0.45, 0).applyQuaternion(motorcycleEntity.interpolatedQuaternion);
        const dismountPos = new THREE.Vector3(
          motorcycleEntity.interpolatedPosition.x + _dismountOffset.x,
          Math.max(motorcycleEntity.interpolatedPosition.y + 0.45, 0.9),
          motorcycleEntity.interpolatedPosition.z + _dismountOffset.z
        );
        motorcycleEntity.isMounted = false;
        playerEntity.dismountAt(dismountPos, motorcycleEntity.headingYaw);
        return;
      }
      if (interactType === 'motorcycle') {
        motorcycleEntity.isMounted = true;
        playerEntity.mountTo(motorcycleEntity.seatAnchor);
        prevBikeYaw = motorcycleEntity.headingYaw;
        camYaw = motorcycleEntity.headingYaw;
        fpsLookYawOffset = 0;
        if (cameraMode === 'FPS') fpsPitch = -0.14;
      } else if (interactType === 'door') {
        doorEntity.toggle();
      }
    }

    window.addEventListener('keydown', (e) => {
      audioManager.unlock();
      keys[e.code] = true;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!motorcycleEntity.isMounted) jumpQueued = true;
      }
      if ((e.code === 'KeyV' || e.code === 'KeyC') && !e.repeat) {
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
      if (e.code === 'F2' && !e.repeat) {
        e.preventDefault();
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
      if (e.code === 'KeyF' && !e.repeat && !motorcycleEntity.isMounted) {
        playerEntity.isWaving = !playerEntity.isWaving;
        waveButton.classList.toggle('active', playerEntity.isWaving);
      }
      if (e.code === 'KeyE' && !e.repeat) handleInteract();
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
      if (cameraMode === 'FPS' && motorcycleEntity.isMounted) {
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
        if (cameraMode === 'TPS') zoomOffset = THREE.MathUtils.clamp(zoomOffset + e.deltaY * 0.004, -1.8, 3.8);
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
      if (!motorcycleEntity.isMounted) {
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

    function animate() {
      requestAnimationFrame(animate);
      const rawDt = Math.min(clock.getDelta(), 0.1);
      const scaledDt = rawDt * timeScale;

      let rawX = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
      let rawZ = (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) - (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0);
      if (Math.abs(joyInput.x) > 0 || Math.abs(joyInput.y) > 0) {
        rawX = joyInput.x;
        rawZ = joyInput.y;
      }

      if (motorcycleEntity.isMounted) {
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

      if (scaledDt > 0) world.step(FIXED_DT, scaledDt, 10);

      playerEntity.mountedSteerAngle = motorcycleEntity.smoothSteerAngle;
      const alpha = THREE.MathUtils.clamp(world.accumulator / FIXED_DT, 0, 1);
      entityManager.update(scaledDt, alpha);

      const speedRatio = THREE.MathUtils.clamp(Math.abs(motorcycleEntity.currentForwardSpeed) / VEHICLE_CONFIG.maxForwardSpeed, 0, 1);
      audioManager.updateEngine(speedRatio, motorcycleEntity.isMounted, TimeManager.isPaused, timeScale);

      const focusPos = motorcycleEntity.isMounted ? motorcycleEntity.interpolatedPosition : playerEntity.interpolatedPosition;
      const focusBaseY = motorcycleEntity.isMounted ? focusPos.y - VEHICLE_CONFIG.boxSize[1] / 2 : focusPos.y - playerEntity.capsuleHalfHeight;
      dirLight.position.set(focusPos.x + 12, focusBaseY + 22, focusPos.z + 10);
      dirLight.target.position.set(focusPos.x, focusBaseY, focusPos.z);

      const activePreset = CAMERA_VIEWS[currentViewIndex];
      const realHorizSpeed = motorcycleEntity.isMounted
        ? Math.abs(motorcycleEntity.currentForwardSpeed)
        : Math.hypot(playerEntity.body.velocity.x, playerEntity.body.velocity.z);

      if (motorcycleEntity.isMounted) {
        const bikeYaw = motorcycleEntity.headingYaw;
        const bikeYawDelta = bikeYaw - prevBikeYaw;
        prevBikeYaw = bikeYaw;
        if (cameraMode === 'TPS') {
          camYaw += bikeYawDelta;
          if (!isDraggingCamera && Math.abs(motorcycleEntity.currentForwardSpeed) > 0.6) {
            camYaw = dampAngle(camYaw, bikeYaw, 2.2, rawDt);
          }
        }
      }

      if (cameraMode === 'FPS') {
        playerEntity.getHeadWorldPosition(_headWorldPos);
        const targetFov = (motorcycleEntity.isMounted ? 78 : 75) + (realHorizSpeed > 6 ? 5.0 : 0);
        smoothFov = THREE.MathUtils.damp(smoothFov, targetFov, 10, rawDt);
        if (Math.abs(camera.fov - smoothFov) > 0.02) {
          camera.fov = smoothFov;
          camera.updateProjectionMatrix();
        }
        const effectiveYaw = motorcycleEntity.isMounted ? motorcycleEntity.headingYaw + fpsLookYawOffset : camYaw;
        const cosPitch = Math.cos(fpsPitch);
        const eyeFwd = motorcycleEntity.isMounted ? 0.11 : 0.08;
        _fpsForwardOffset.set(-Math.sin(effectiveYaw) * eyeFwd, motorcycleEntity.isMounted ? 0.02 : 0.01, -Math.cos(effectiveYaw) * eyeFwd);
        _currentCamPos.copy(_headWorldPos).add(_fpsForwardOffset);
        _fpsLookTarget.set(_currentCamPos.x - Math.sin(effectiveYaw) * cosPitch * 10, _currentCamPos.y + Math.sin(fpsPitch) * 10, _currentCamPos.z - Math.cos(effectiveYaw) * cosPitch * 10);
        _currentLookAt.copy(_fpsLookTarget);
      } else {
        const baseDist = motorcycleEntity.isMounted ? Math.max(activePreset.distance, 5.6) : activePreset.distance;
        smoothDistance = THREE.MathUtils.damp(smoothDistance, THREE.MathUtils.clamp(baseDist + zoomOffset, 2.2, 12.0), 7, rawDt);
        smoothPitch = THREE.MathUtils.damp(smoothPitch, THREE.MathUtils.clamp(activePreset.pitch + pitchOffset, 0.06, 1.15), 7, rawDt);
        smoothShoulderX = THREE.MathUtils.damp(smoothShoulderX, motorcycleEntity.isMounted ? 0 : activePreset.shoulderOffsetX, 7, rawDt);
        smoothTargetHeight = THREE.MathUtils.damp(smoothTargetHeight, motorcycleEntity.isMounted ? 1.25 : activePreset.targetHeight, 7, rawDt);
        const targetFov = activePreset.fov + (realHorizSpeed > 5.0 ? 6.0 * speedRatio : 0);
        smoothFov = THREE.MathUtils.damp(smoothFov, targetFov, 7, rawDt);
        if (Math.abs(camera.fov - smoothFov) > 0.02) {
          camera.fov = smoothFov;
          camera.updateProjectionMatrix();
        }
        _right.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
        _lookTarget.set(focusPos.x + _right.x * smoothShoulderX, focusBaseY + smoothTargetHeight, focusPos.z + _right.z * smoothShoulderX);
        _currentLookAt.x = THREE.MathUtils.damp(_currentLookAt.x, _lookTarget.x, 14, rawDt);
        _currentLookAt.y = THREE.MathUtils.damp(_currentLookAt.y, _lookTarget.y, 14, rawDt);
        _currentLookAt.z = THREE.MathUtils.damp(_currentLookAt.z, _lookTarget.z, 14, rawDt);

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
        const followLambda = motorcycleEntity.isMounted ? 12.0 : 9.5;
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

      if (motorcycleEntity.isMounted) {
        interactType = 'dismount';
        interactPromptText = 'Presiona E para bajar de la moto';
      } else {
        _playerRayOrigin.set(playerEntity.interpolatedPosition.x, focusBaseY + 1.15, playerEntity.interpolatedPosition.z);
        const hit = engineRaycaster.castFromCameraCenter(camera, allInteractTargets, VEHICLE_CONFIG.interactDistance, _playerRayOrigin);
        if (hit) {
          const hitType = hit.object.userData.interactType;
          const distToPlayer = hit.point.distanceTo(_playerRayOrigin);
          if (hitType === 'motorcycle' && distToPlayer <= VEHICLE_CONFIG.interactDistance) {
            interactType = 'motorcycle';
            interactPromptText = 'Presiona E para subir a la moto';
          } else if (hitType === 'door' && distToPlayer <= DOOR_CONFIG.interactDistance) {
            interactType = 'door';
            interactPromptText = doorEntity.doorOpen ? 'Presiona E para cerrar la puerta' : 'Presiona E para abrir la puerta';
          } else {
            interactType = null;
            interactPromptText = null;
          }
        } else {
          interactType = null;
          interactPromptText = null;
        }
      }

      const speedKmh = Math.round(Math.abs(motorcycleEntity.currentForwardSpeed) * 3.6);
      const viewText = cameraMode === 'FPS' ? 'Primera Persona (FPS)' : activePreset.label;
      const timeText = timeScale === 0 ? 'PAUSA' : timeScale + 'x';
      const mountText = motorcycleEntity.isMounted ? \` · Moto: \${speedKmh} km/h\` : '';
      const nextHudText = \`Estado: \${playerEntity.stateLabel}\${playerEntity.isWaving ? ' + Wave' : ''}\${mountText} · HP: \${playerEntity.health} · Vista: \${viewText} · Tiempo: \${timeText}\`;
      if (nextHudText !== lastHudText) {
        lastHudText = nextHudText;
        stateReadout.textContent = nextHudText;
      }

      const promptKey = \`\${interactType}|\${interactPromptText}|\${motorcycleEntity.isMounted}\`;
      if (promptKey !== lastPromptState) {
        lastPromptState = promptKey;
        interactPromptEl.classList.toggle('visible', Boolean(interactPromptText));
        if (interactPromptText) interactPromptEl.textContent = interactPromptText;
        crosshair.classList.toggle('active', interactType === 'door' || interactType === 'motorcycle');
        interactButton.classList.toggle('visible', Boolean(interactPromptText));
        interactButton.textContent = motorcycleEntity.isMounted ? 'BAJAR (E)' : 'USAR (E)';
        waveButton.style.display = motorcycleEntity.isMounted ? 'none' : 'flex';
        jumpButton.style.display = motorcycleEntity.isMounted ? 'none' : 'flex';
      }

      renderer.render(scene, camera);
    }

    animate();
  </script>
</body>
</html>`;
}
