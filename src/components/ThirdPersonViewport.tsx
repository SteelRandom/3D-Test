import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as CANNON from 'cannon-es';
import {
  CAMERA_VIEWS,
  DOOR_CONFIG,
  MOTORCYCLE_MODEL_URL,
  PHYSICS_CONFIG,
  SCENE_COLORS,
  SOLDIER_MODEL_URL,
  VEHICLE_CONFIG,
} from '../scene/courseConfig';
import { Entity, EntityManager } from '../engine/EntityManager';
import { TimeManager } from '../engine/TimeManager';
import { AudioManager } from '../engine/AudioManager';
import { DEFAULT_LEVEL_JSON, LevelJSON } from '../engine/levelData';

export type CharacterAnimState = 'Idle' | 'Walk' | 'Run' | 'Jump' | 'Drive';
export type CameraMode = 'TPS' | 'FPS';
export type InteractTargetType = 'door' | 'motorcycle' | 'dismount' | null;

export interface ThirdPersonViewportHandle {
  resetPlayer: () => void;
  triggerJump: () => void;
  setJoystick: (x: number, y: number, active: boolean) => void;
  cycleCameraView: () => void;
  toggleWave: () => void;
  interact: () => void;
  toggleCameraMode: () => void;
  togglePause: () => void;
  toggleSlowMotion: () => void;
}

interface ThirdPersonViewportProps {
  onLoadProgress: (progress: number, loaded: boolean, error: string | null) => void;
  onStateChange: (state: {
    animState: CharacterAnimState;
    grounded: boolean;
    viewLabel: string;
    cameraMode: CameraMode;
    timeScale: number;
    health: number;
    isWaving: boolean;
    isMounted: boolean;
    vehicleSpeedKmh: number;
    interactPrompt: string | null;
    interactType: InteractTargetType;
    doorOpen: boolean;
  }) => void;
  onContextLostChange?: (lost: boolean) => void;
}

// Unified EngineRaycaster casting from the center of the camera
class EngineRaycaster {
  private raycaster = new THREE.Raycaster();
  private centerNDC = new THREE.Vector2(0, 0);

  castFromCameraCenter(
    camera: THREE.Camera,
    targets: THREE.Object3D[],
    maxDistance: number,
    playerOrigin: THREE.Vector3
  ): THREE.Intersection | null {
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

// Scratch math objects pre-allocated outside render loop (zero GC per frame)
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _targetQuat = new THREE.Quaternion();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _desiredCamPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _deltaQuat = new THREE.Quaternion();
const _deltaQuat2 = new THREE.Quaternion();
const _deltaQuat3 = new THREE.Quaternion();
const _interpPos = new THREE.Vector3();
const _interpQuat = new THREE.Quaternion();
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
const _rayFrom = new CANNON.Vec3();
const _rayTo = new CANNON.Vec3();
const _cannonYAxis = new CANNON.Vec3(0, 1, 0);
const _forceVec = new CANNON.Vec3();

const UPPER_BODY_MASK_REGEX = /spine|neck|head|shoulder|arm|forearm|hand/i;

interface BoneRigEntry {
  bone: THREE.Bone;
  pitchAxis: THREE.Vector3;
  rollAxis: THREE.Vector3;
  yawAxis: THREE.Vector3;
}

interface CharacterBoneRig {
  leftUpLeg?: BoneRigEntry;
  rightUpLeg?: BoneRigEntry;
  leftLeg?: BoneRigEntry;
  rightLeg?: BoneRigEntry;
  leftFoot?: BoneRigEntry;
  rightFoot?: BoneRigEntry;
  leftArm?: BoneRigEntry;
  rightArm?: BoneRigEntry;
  leftForeArm?: BoneRigEntry;
  rightForeArm?: BoneRigEntry;
  leftHand?: BoneRigEntry;
  rightHand?: BoneRigEntry;
  spine?: BoneRigEntry;
  spine1?: BoneRigEntry;
}

interface MaskedBoneEntry {
  bone: THREE.Bone;
  baseQuat: THREE.Quaternion;
  waveQuat: THREE.Quaternion;
}

function detectSoftwareWebGL(): boolean {
  const probeCanvas = document.createElement('canvas');
  const gl = probeCanvas.getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
}

function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  let diff = (target - current) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * (1 - Math.exp(-lambda * dt));
}

function makeBoneRigEntry(bone: THREE.Bone): BoneRigEntry {
  const worldQuat = new THREE.Quaternion();
  bone.getWorldQuaternion(worldQuat);
  const invQuat = worldQuat.invert();
  return {
    bone,
    pitchAxis: new THREE.Vector3(1, 0, 0).applyQuaternion(invQuat).normalize(),
    yawAxis: new THREE.Vector3(0, 1, 0).applyQuaternion(invQuat).normalize(),
    rollAxis: new THREE.Vector3(0, 0, 1).applyQuaternion(invQuat).normalize(),
  };
}

function buildCharacterBoneRig(model: THREE.Object3D): CharacterBoneRig {
  model.updateMatrixWorld(true);
  const rig: CharacterBoneRig = {};
  const bones: THREE.Bone[] = [];
  model.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) {
      bones.push(obj as THREE.Bone);
    }
  });

  const findExact = (patterns: string[]) =>
    bones.find((b) => {
      const n = b.name.toLowerCase();
      return patterns.some((p) => n.includes(p));
    });

  const leftUpLeg = findExact(['leftupleg', 'leftthigh', 'thigh_l']);
  const rightUpLeg = findExact(['rightupleg', 'rightthigh', 'thigh_r']);
  const leftLeg = bones.find((b) => {
    const n = b.name.toLowerCase();
    return (n.includes('leftleg') || n.includes('leftcalf') || n.includes('shin_l')) && !n.includes('upleg');
  });
  const rightLeg = bones.find((b) => {
    const n = b.name.toLowerCase();
    return (n.includes('rightleg') || n.includes('rightcalf') || n.includes('shin_r')) && !n.includes('upleg');
  });
  const leftFoot = findExact(['leftfoot']);
  const rightFoot = findExact(['rightfoot']);

  const leftArm = bones.find((b) => {
    const n = b.name.toLowerCase();
    return (n.includes('leftarm') || n.includes('leftupperarm')) && !n.includes('forearm');
  });
  const rightArm = bones.find((b) => {
    const n = b.name.toLowerCase();
    return (n.includes('rightarm') || n.includes('rightupperarm')) && !n.includes('forearm');
  });
  const leftForeArm = bones.find((b) => {
    const n = b.name.toLowerCase();
    return n.includes('leftforearm') || n.includes('leftlowerarm');
  });
  const rightForeArm = bones.find((b) => {
    const n = b.name.toLowerCase();
    return n.includes('rightforearm') || n.includes('rightlowerarm');
  });
  const leftHand = bones.find((b) => {
    const n = b.name.toLowerCase();
    return n.endsWith('lefthand');
  });
  const rightHand = bones.find((b) => {
    const n = b.name.toLowerCase();
    return n.endsWith('righthand');
  });

  const spine = bones.find((b) => b.name.toLowerCase().endsWith(':spine') || b.name.toLowerCase() === 'spine');
  const spine1 = bones.find((b) => b.name.toLowerCase().includes('spine1'));

  if (leftUpLeg) rig.leftUpLeg = makeBoneRigEntry(leftUpLeg);
  if (rightUpLeg) rig.rightUpLeg = makeBoneRigEntry(rightUpLeg);
  if (leftLeg) rig.leftLeg = makeBoneRigEntry(leftLeg);
  if (rightLeg) rig.rightLeg = makeBoneRigEntry(rightLeg);
  if (leftFoot) rig.leftFoot = makeBoneRigEntry(leftFoot);
  if (rightFoot) rig.rightFoot = makeBoneRigEntry(rightFoot);
  if (leftArm) rig.leftArm = makeBoneRigEntry(leftArm);
  if (rightArm) rig.rightArm = makeBoneRigEntry(rightArm);
  if (leftForeArm) rig.leftForeArm = makeBoneRigEntry(leftForeArm);
  if (rightForeArm) rig.rightForeArm = makeBoneRigEntry(rightForeArm);
  if (leftHand) rig.leftHand = makeBoneRigEntry(leftHand);
  if (rightHand) rig.rightHand = makeBoneRigEntry(rightHand);
  if (spine) rig.spine = makeBoneRigEntry(spine);
  if (spine1) rig.spine1 = makeBoneRigEntry(spine1);

  return rig;
}

function findHeadAndVisor(model: THREE.Object3D): {
  headBone: THREE.Bone | null;
  visorMeshes: THREE.Mesh[];
} {
  let headBone: THREE.Bone | null = null;
  let neckBone: THREE.Bone | null = null;
  const visorMeshes: THREE.Mesh[] = [];

  model.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) {
      const n = obj.name.toLowerCase();
      if (!headBone && n.includes('head') && !n.includes('top_end')) {
        headBone = obj as THREE.Bone;
      } else if (!neckBone && n.includes('neck')) {
        neckBone = obj as THREE.Bone;
      }
    }
    if ((obj as THREE.Mesh).isMesh) {
      const n = obj.name.toLowerCase();
      if (n.includes('visor')) {
        visorMeshes.push(obj as THREE.Mesh);
      }
    }
  });
  return { headBone: headBone ?? neckBone, visorMeshes };
}

function buildUpperBodyWaveLayer(
  model: THREE.Object3D,
  animations: THREE.AnimationClip[]
): {
  upperMixer: THREE.AnimationMixer;
  waveAction: THREE.AnimationAction | null;
  maskedBones: MaskedBoneEntry[];
} {
  model.updateMatrixWorld(true);
  const upperMixer = new THREE.AnimationMixer(model);
  const maskedBones: MaskedBoneEntry[] = [];
  const maskedBoneSet = new Set<THREE.Bone>();

  const bones: THREE.Bone[] = [];
  model.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) {
      bones.push(obj as THREE.Bone);
    }
  });

  const existingWave = THREE.AnimationClip.findByName(animations, 'Wave');
  if (existingWave) {
    const upperTracks = existingWave.tracks.filter((t) =>
      UPPER_BODY_MASK_REGEX.test(t.name)
    );
    if (upperTracks.length > 0) {
      const maskedClip = new THREE.AnimationClip(
        'WaveMasked',
        existingWave.duration,
        upperTracks
      );
      for (const t of upperTracks) {
        const boneName = t.name.split('.')[0];
        const bone = bones.find((b) => b.name === boneName);
        if (bone && !maskedBoneSet.has(bone)) {
          maskedBoneSet.add(bone);
          maskedBones.push({
            bone,
            baseQuat: new THREE.Quaternion(),
            waveQuat: new THREE.Quaternion(),
          });
        }
      }
      const action = upperMixer.clipAction(maskedClip);
      action.loop = THREE.LoopRepeat;
      action.play();
      return { upperMixer, waveAction: action, maskedBones };
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

  const tracks: THREE.QuaternionKeyframeTrack[] = [];
  const times = [0, 0.25, 0.55, 0.85, 1.1];

  const pushQuatTrack = (
    bone: THREE.Bone | undefined,
    buildQuat: (phase: number, entry: BoneRigEntry) => THREE.Quaternion
  ) => {
    if (!bone) return;
    const entry = makeBoneRigEntry(bone);
    const values: number[] = [];
    for (let i = 0; i < times.length; i++) {
      const q = buildQuat(i, entry);
      values.push(q.x, q.y, q.z, q.w);
    }
    tracks.push(
      new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, values)
    );
    maskedBones.push({
      bone,
      baseQuat: new THREE.Quaternion(),
      waveQuat: new THREE.Quaternion(),
    });
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
    const waveAngles = [0.25, 0.65, -0.25, 0.65, 0.25];
    const bend = new THREE.Quaternion().setFromAxisAngle(
      entry.rollAxis,
      waveAngles[phase]
    );
    return q.multiply(bend);
  });

  pushQuatTrack(rightHand, (phase, entry) => {
    const q = entry.bone.quaternion.clone();
    const wristAngles = [0.0, 0.28, -0.24, 0.28, 0.0];
    const twist = new THREE.Quaternion().setFromAxisAngle(
      entry.rollAxis,
      wristAngles[phase]
    );
    return q.multiply(twist);
  });

  if (tracks.length === 0) {
    return { upperMixer, waveAction: null, maskedBones };
  }

  const waveClip = new THREE.AnimationClip('WaveUpperBody', 1.1, tracks);
  const action = upperMixer.clipAction(waveClip);
  action.loop = THREE.LoopRepeat;
  action.play();
  return { upperMixer, waveAction: action, maskedBones };
}

function applyBoneEulerDelta(
  entry: BoneRigEntry | undefined,
  pitch: number,
  yaw = 0,
  roll = 0
) {
  if (!entry) return;
  if (Math.abs(pitch) > 0.001) {
    _deltaQuat.setFromAxisAngle(entry.pitchAxis, pitch);
    entry.bone.quaternion.multiply(_deltaQuat);
  }
  if (Math.abs(yaw) > 0.001) {
    _deltaQuat2.setFromAxisAngle(entry.yawAxis, yaw);
    entry.bone.quaternion.multiply(_deltaQuat2);
  }
  if (Math.abs(roll) > 0.001) {
    _deltaQuat3.setFromAxisAngle(entry.rollAxis, roll);
    entry.bone.quaternion.multiply(_deltaQuat3);
  }
}

function applyProceduralJumpPose(
  rig: CharacterBoneRig,
  airBlend: number,
  verticalVel: number
) {
  if (airBlend <= 0.005) return;
  const vyNorm = THREE.MathUtils.clamp(verticalVel / 5, -1, 1);
  const tuck = THREE.MathUtils.lerp(0.45, 1.0, (vyNorm + 1) * 0.5);

  applyBoneEulerDelta(rig.leftUpLeg, 0.78 * tuck * airBlend);
  applyBoneEulerDelta(rig.leftLeg, -1.1 * tuck * airBlend);
  applyBoneEulerDelta(
    rig.rightUpLeg,
    THREE.MathUtils.lerp(-0.12, 0.28, (vyNorm + 1) * 0.5) * airBlend
  );
  applyBoneEulerDelta(rig.rightLeg, -0.58 * tuck * airBlend);
  applyBoneEulerDelta(rig.spine, 0.16 * airBlend);
  applyBoneEulerDelta(rig.leftArm, 0.35 * airBlend, 0, -0.68 * airBlend);
  applyBoneEulerDelta(rig.rightArm, 0.25 * airBlend, 0, 0.68 * airBlend);
}

function applyMotorcycleSeatedPose(
  rig: CharacterBoneRig,
  steerAngle: number
) {
  // Postura sentada deportiva sobre la moto: piernas abrazando el tanque, rodillas flexionadas y manos en el manubrio
  applyBoneEulerDelta(rig.spine, 0.2, steerAngle * 0.08, 0);
  applyBoneEulerDelta(rig.spine1, 0.12, 0, 0);

  applyBoneEulerDelta(rig.leftUpLeg, 0.92, -0.18, 0.24);
  applyBoneEulerDelta(rig.rightUpLeg, 0.92, 0.18, -0.24);
  applyBoneEulerDelta(rig.leftLeg, -1.32, 0, 0);
  applyBoneEulerDelta(rig.rightLeg, -1.32, 0, 0);
  applyBoneEulerDelta(rig.leftFoot, 0.22, 0, 0);
  applyBoneEulerDelta(rig.rightFoot, 0.22, 0, 0);

  // Brazos extendidos hacia adelante sujetando los puños del manubrio (con ligero giro al doblar)
  const steerReach = steerAngle * 0.16;
  applyBoneEulerDelta(rig.leftArm, 1.12 - steerReach, -0.22, -0.14);
  applyBoneEulerDelta(rig.rightArm, 1.12 + steerReach, 0.22, 0.14);
  applyBoneEulerDelta(rig.leftForeArm, 0.36, 0.15, 0);
  applyBoneEulerDelta(rig.rightForeArm, 0.36, -0.15, 0);
  applyBoneEulerDelta(rig.leftHand, -0.22, 0, 0);
  applyBoneEulerDelta(rig.rightHand, -0.22, 0, 0);
}

function createProceduralFallbackCharacter(): THREE.Group {
  const group = new THREE.Group();
  const suitMat = new THREE.MeshStandardMaterial({
    color: 0x4b5563,
    roughness: 0.72,
    metalness: 0.12,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.45,
    metalness: 0.35,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x60a5fa,
    roughness: 0.2,
    metalness: 0.85,
  });

  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.2), accentMat);
  leftLeg.position.set(-0.14, 0.36, 0);
  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.2), accentMat);
  rightLeg.position.set(0.14, 0.36, 0);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.64, 0.26), suitMat);
  torso.position.set(0, 1.04, 0);
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.56, 0.16), suitMat);
  leftArm.position.set(-0.34, 1.02, 0);
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.56, 0.16), suitMat);
  rightArm.position.set(0.34, 1.02, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), suitMat);
  head.name = 'fallback_head';
  head.position.set(0, 1.56, 0);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.12), visorMat);
  visor.name = 'vanguard_visor';
  visor.position.set(0, 1.57, -0.14);

  [leftLeg, rightLeg, torso, leftArm, rightArm, head, visor].forEach((part) => {
    part.castShadow = true;
    part.receiveShadow = true;
    group.add(part);
  });
  return group;
}

interface ProceduralMotorcycleRig {
  visualRoot: THREE.Group;
  frontForkPivot: THREE.Group;
  frontWheelSpin: THREE.Group;
  rearWheelSpin: THREE.Group;
  interactMeshes: THREE.Object3D[];
}

function buildProceduralMotorcycle(
  disposableGeometries: THREE.BufferGeometry[],
  disposableMaterials: THREE.Material[]
): ProceduralMotorcycleRig {
  const visualRoot = new THREE.Group();
  const interactMeshes: THREE.Object3D[] = [];

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.45,
    metalness: 0.65,
  });
  const bodyPaintMat = new THREE.MeshStandardMaterial({
    color: 0x2563eb,
    roughness: 0.28,
    metalness: 0.48,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.88,
    metalness: 0.05,
  });
  const alloyMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.28,
    metalness: 0.82,
  });
  const seatMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.85,
    metalness: 0.05,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfde047,
    emissiveIntensity: 0.85,
    roughness: 0.15,
  });
  const tailLightMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 0.75,
    roughness: 0.2,
  });
  const dashMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: 0x0284c7,
    emissiveIntensity: 0.45,
    roughness: 0.3,
  });

  disposableMaterials.push(
    frameMat,
    bodyPaintMat,
    tireMat,
    alloyMat,
    seatMat,
    headlightMat,
    tailLightMat,
    dashMat
  );

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposableGeometries.push(g);
    return g;
  };

  const tagMesh = (mesh: THREE.Mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.interactType = 'motorcycle';
    interactMeshes.push(mesh);
    return mesh;
  };

  const boxHalfY = VEHICLE_CONFIG.boxSize[1] / 2; // 0.47
  const wheelR = VEHICLE_CONFIG.wheelRadius; // 0.31
  const axleY = -boxHalfY + wheelR; // -0.16 (tires touch -0.47 exactly)

  const createWheel = (width: number) => {
    const wheelGroup = new THREE.Group();
    const tireGeo = trackGeo(new THREE.TorusGeometry(wheelR - 0.065, 0.068, 12, 26));
    tireGeo.rotateY(Math.PI / 2);
    const tire = tagMesh(new THREE.Mesh(tireGeo, tireMat));
    wheelGroup.add(tire);

    const rimGeo = trackGeo(new THREE.CylinderGeometry(wheelR - 0.11, wheelR - 0.11, width * 0.75, 16));
    rimGeo.rotateZ(Math.PI / 2);
    const rim = tagMesh(new THREE.Mesh(rimGeo, alloyMat));
    wheelGroup.add(rim);

    // Radios visibles para apreciar el giro de la rueda
    const spokeGeo = trackGeo(new THREE.BoxGeometry(width * 0.8, 0.025, (wheelR - 0.1) * 1.9));
    for (let s = 0; s < 3; s++) {
      const spoke = tagMesh(new THREE.Mesh(spokeGeo, frameMat));
      spoke.rotation.x = (s * Math.PI) / 3;
      wheelGroup.add(spoke);
    }

    const discGeo = trackGeo(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 16));
    discGeo.rotateZ(Math.PI / 2);
    const disc = tagMesh(new THREE.Mesh(discGeo, alloyMat));
    disc.position.x = width * 0.44;
    wheelGroup.add(disc);

    return wheelGroup;
  };

  // Rueda trasera (+Z)
  const rearWheelSpin = createWheel(0.16);
  rearWheelSpin.position.set(0, axleY, 0.7);
  visualRoot.add(rearWheelSpin);

  // Chasis, motor y basculante trasero
  const engineBlock = tagMesh(
    new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.34, 0.46)), frameMat)
  );
  engineBlock.position.set(0, axleY + 0.22, -0.02);
  visualRoot.add(engineBlock);

  const swingarm = tagMesh(
    new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.07, 0.66)), alloyMat)
  );
  swingarm.position.set(0, axleY + 0.06, 0.4);
  visualRoot.add(swingarm);

  const rearShock = tagMesh(
    new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.032, 0.032, 0.34, 10)), bodyPaintMat)
  );
  rearShock.position.set(0, axleY + 0.24, 0.34);
  rearShock.rotation.x = 0.55;
  visualRoot.add(rearShock);

  // Escape lateral cromado
  const exhaustGeo = trackGeo(new THREE.CylinderGeometry(0.038, 0.048, 0.84, 12));
  exhaustGeo.rotateX(Math.PI / 2);
  const exhaust = tagMesh(new THREE.Mesh(exhaustGeo, alloyMat));
  exhaust.position.set(0.21, axleY + 0.04, 0.38);
  exhaust.rotation.x = -0.12;
  visualRoot.add(exhaust);

  // Depósito de combustible esculpido
  const tank = tagMesh(
    new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.36, 0.24, 0.52)), bodyPaintMat)
  );
  tank.position.set(0, axleY + 0.48, -0.18);
  tank.rotation.x = 0.14;
  visualRoot.add(tank);

  // Asiento ergonómico
  const seat = tagMesh(
    new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.29, 0.11, 0.54)), seatMat)
  );
  seat.position.set(0, axleY + 0.43, 0.25);
  seat.rotation.x = -0.05;
  visualRoot.add(seat);

  // Colín y luz trasera
  const tailBody = tagMesh(
    new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.12, 0.38)), bodyPaintMat)
  );
  tailBody.position.set(0, axleY + 0.46, 0.62);
  tailBody.rotation.x = -0.18;
  visualRoot.add(tailBody);

  const tailLight = tagMesh(
    new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.05, 0.05)), tailLightMat)
  );
  tailLight.position.set(0, axleY + 0.48, 0.81);
  visualRoot.add(tailLight);

  // Estriberas (footpegs)
  const pegGeo = trackGeo(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 8));
  pegGeo.rotateZ(Math.PI / 2);
  const footPegs = tagMesh(new THREE.Mesh(pegGeo, alloyMat));
  footPegs.position.set(0, axleY + 0.08, 0.12);
  visualRoot.add(footPegs);

  // Conjunto delantero dirigible (horquilla + manubrio + faro + rueda delantera)
  const frontForkPivot = new THREE.Group();
  frontForkPivot.position.set(0, axleY + 0.46, -0.46);
  visualRoot.add(frontForkPivot);

  const forkTubeGeo = trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 0.66, 10));
  const leftFork = tagMesh(new THREE.Mesh(forkTubeGeo, alloyMat));
  leftFork.position.set(-0.11, -0.22, -0.11);
  leftFork.rotation.x = 0.38;
  frontForkPivot.add(leftFork);

  const rightFork = tagMesh(new THREE.Mesh(forkTubeGeo, alloyMat));
  rightFork.position.set(0.11, -0.22, -0.11);
  rightFork.rotation.x = 0.38;
  frontForkPivot.add(rightFork);

  const frontFender = tagMesh(
    new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.05, 0.36)), bodyPaintMat)
  );
  frontFender.position.set(0, -0.24, -0.25);
  frontFender.rotation.x = 0.25;
  frontForkPivot.add(frontFender);

  // Rueda delantera relativa al pivote de horquilla
  const frontWheelSpin = createWheel(0.13);
  frontWheelSpin.position.set(0, -0.46, -0.24);
  frontForkPivot.add(frontWheelSpin);

  // Manubrio ancho + puños + tablero digital (visible en FPS)
  const handlebarCross = tagMesh(
    new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.018, 0.018, 0.68, 10)), alloyMat)
  );
  handlebarCross.rotation.z = Math.PI / 2;
  handlebarCross.position.set(0, 0.19, 0.05);
  frontForkPivot.add(handlebarCross);

  const gripGeo = trackGeo(new THREE.CylinderGeometry(0.024, 0.024, 0.14, 10));
  gripGeo.rotateZ(Math.PI / 2);
  const leftGrip = tagMesh(new THREE.Mesh(gripGeo, seatMat));
  leftGrip.position.set(-0.3, 0.19, 0.06);
  leftGrip.rotation.y = 0.14;
  frontForkPivot.add(leftGrip);

  const rightGrip = tagMesh(new THREE.Mesh(gripGeo, seatMat));
  rightGrip.position.set(0.3, 0.19, 0.06);
  rightGrip.rotation.y = -0.14;
  frontForkPivot.add(rightGrip);

  const dashPod = tagMesh(
    new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.07, 0.08)), dashMat)
  );
  dashPod.position.set(0, 0.22, -0.06);
  dashPod.rotation.x = -0.55;
  frontForkPivot.add(dashPod);

  const headlight = tagMesh(
    new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.09, 0.09, 0.09, 16)), headlightMat)
  );
  headlight.rotation.x = Math.PI / 2;
  headlight.position.set(0, 0.07, -0.14);
  frontForkPivot.add(headlight);

  return {
    visualRoot,
    frontForkPivot,
    frontWheelSpin,
    rearWheelSpin,
    interactMeshes,
  };
}

// ============================================================================
// Entidades Escalables del Motor (heredan de Entity)
// ============================================================================

class DoorEntity extends Entity {
  public doorOpen = false;
  public currentAngle = 0;
  public readonly pivot: THREE.Group;
  public readonly leafMesh: THREE.Mesh;
  public readonly handleMesh: THREE.Mesh;
  public readonly leafBody: CANNON.Body;
  public readonly interactTargets: THREE.Object3D[];

  private readonly hingeX: number;
  private readonly hingeZ: number;
  private readonly doorY: number;
  private readonly openW: number;
  private readonly openH: number;
  private readonly audio: AudioManager;

  constructor(
    cfg: LevelJSON['door'],
    scene: THREE.Scene,
    world: CANNON.World,
    groundPhysMat: CANNON.Material,
    materials: {
      doorFrame: THREE.Material;
      doorLeaf: THREE.Material;
      doorHandle: THREE.Material;
    },
    cameraColliders: THREE.Object3D[],
    disposableGeometries: THREE.BufferGeometry[],
    audio: AudioManager
  ) {
    super('door');
    this.audio = audio;

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
    disposableGeometries.push(postGeo, lintelGeo, leafGeo, handleGeo);

    const leftPostMesh = new THREE.Mesh(postGeo, materials.doorFrame);
    leftPostMesh.position.set(
      doorX - this.openW / 2 - frameT / 2,
      doorY + this.openH / 2,
      doorZ
    );
    leftPostMesh.castShadow = true;
    leftPostMesh.receiveShadow = true;

    const rightPostMesh = new THREE.Mesh(postGeo, materials.doorFrame);
    rightPostMesh.position.set(
      doorX + this.openW / 2 + frameT / 2,
      doorY + this.openH / 2,
      doorZ
    );
    rightPostMesh.castShadow = true;
    rightPostMesh.receiveShadow = true;

    const lintelMesh = new THREE.Mesh(lintelGeo, materials.doorFrame);
    lintelMesh.position.set(doorX, doorY + this.openH + frameT / 2, doorZ);
    lintelMesh.castShadow = true;
    lintelMesh.receiveShadow = true;

    doorRoot.add(leftPostMesh, rightPostMesh, lintelMesh);
    cameraColliders.push(leftPostMesh, rightPostMesh, lintelMesh);

    const addFrameBody = (
      px: number,
      py: number,
      pz: number,
      sx: number,
      sy: number,
      sz: number
    ) => {
      const b = new CANNON.Body({
        mass: 0,
        material: groundPhysMat,
        shape: new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)),
      });
      b.position.set(px, py, pz);
      world.addBody(b);
    };
    addFrameBody(leftPostMesh.position.x, leftPostMesh.position.y, leftPostMesh.position.z, frameT, this.openH, frameD);
    addFrameBody(rightPostMesh.position.x, rightPostMesh.position.y, rightPostMesh.position.z, frameT, this.openH, frameD);
    addFrameBody(lintelMesh.position.x, lintelMesh.position.y, lintelMesh.position.z, this.openW + frameT * 2, frameT, frameD);

    this.hingeX = doorX - this.openW / 2;
    this.hingeZ = doorZ;
    this.pivot = new THREE.Group();
    this.pivot.position.set(this.hingeX, doorY, this.hingeZ);
    doorRoot.add(this.pivot);

    this.leafMesh = new THREE.Mesh(leafGeo, materials.doorLeaf);
    this.leafMesh.position.set(this.openW / 2, this.openH / 2, 0);
    this.leafMesh.castShadow = true;
    this.leafMesh.receiveShadow = true;
    this.leafMesh.userData.interactType = 'door';
    this.pivot.add(this.leafMesh);
    cameraColliders.push(this.leafMesh);

    this.handleMesh = new THREE.Mesh(handleGeo, materials.doorHandle);
    this.handleMesh.position.set(this.openW - 0.18, 1.05, 0);
    this.handleMesh.castShadow = true;
    this.handleMesh.userData.interactType = 'door';
    this.pivot.add(this.handleMesh);

    this.leafBody = new CANNON.Body({
      mass: 0,
      material: groundPhysMat,
      shape: new CANNON.Box(new CANNON.Vec3(this.openW / 2, this.openH / 2, leafT / 2)),
    });
    this.leafBody.position.set(this.hingeX + this.openW / 2, doorY + this.openH / 2, this.hingeZ);
    world.addBody(this.leafBody);

    this.interactTargets = [this.leafMesh, this.handleMesh];
  }

  public toggle(): void {
    this.doorOpen = !this.doorOpen;
    this.audio.playSound(this.doorOpen ? 'door_open' : 'door_close', { volume: 0.7 });
  }

  public reset(): void {
    this.doorOpen = false;
    this.currentAngle = 0;
    this.syncBodyTransform(0);
    this.pivot.rotation.y = 0;
  }

  private syncBodyTransform(angle: number): void {
    const halfW = this.openW / 2;
    this.leafBody.position.set(
      this.hingeX + halfW * Math.cos(angle),
      this.doorY + this.openH / 2,
      this.hingeZ - halfW * Math.sin(angle)
    );
    this.leafBody.quaternion.setFromAxisAngle(_cannonYAxis, angle);
  }

  public fixedUpdate(fixedDt: number): void {
    const targetAngle = this.doorOpen ? Math.PI / 2 : 0;
    this.currentAngle = THREE.MathUtils.damp(this.currentAngle, targetAngle, 9, fixedDt);
    this.syncBodyTransform(this.currentAngle);
  }

  public update(_dt: number, _alpha: number): void {
    this.pivot.rotation.y = this.currentAngle;
  }
}

interface VehicleDriveInput {
  throttle: number; // -1 (reversa/freno) .. 1 (acelerar)
  steer: number;    // -1 (derecha) .. 1 (izquierda)
}

class MotorcycleEntity extends Entity {
  public readonly body: CANNON.Body;
  public readonly group: THREE.Group;
  public readonly leanGroup: THREE.Group;
  public readonly seatAnchor: THREE.Group;
  public readonly interactTargets: THREE.Object3D[] = [];
  public readonly previousPosition = new THREE.Vector3();
  public readonly currentPosition = new THREE.Vector3();
  public readonly previousQuaternion = new THREE.Quaternion();
  public readonly currentQuaternion = new THREE.Quaternion();
  public readonly interpolatedPosition = new THREE.Vector3();
  public readonly interpolatedQuaternion = new THREE.Quaternion();

  public isMounted = false;
  public currentForwardSpeed = 0;
  public smoothSteerAngle = 0;
  public leanAngle = 0;
  public headingYaw: number = VEHICLE_CONFIG.spawnYaw;

  private wheelSpinAngle = 0;
  private minAirborneVy = 0;
  private isGrounded = true;

  private proceduralRig: ProceduralMotorcycleRig;
  private glbRoot: THREE.Object3D | null = null;
  private glbFrontWheel: THREE.Object3D | null = null;
  private glbRearWheel: THREE.Object3D | null = null;
  private glbFork: THREE.Object3D | null = null;

  private readonly world: CANNON.World;
  private readonly driveInput: VehicleDriveInput;
  private readonly onHardLanding: (impactVy: number) => void;
  private readonly audio: AudioManager;

  constructor(
    scene: THREE.Scene,
    world: CANNON.World,
    vehiclePhysMat: CANNON.Material,
    driveInput: VehicleDriveInput,
    disposableGeometries: THREE.BufferGeometry[],
    disposableMaterials: THREE.Material[],
    onHardLanding: (impactVy: number) => void,
    audio: AudioManager
  ) {
    super('motorcycle');
    this.world = world;
    this.driveInput = driveInput;
    this.onHardLanding = onHardLanding;
    this.audio = audio;

    const [sx, sy, sz] = VEHICLE_CONFIG.boxSize;
    const [px, py, pz] = VEHICLE_CONFIG.spawnPosition;

    this.body = new CANNON.Body({
      mass: VEHICLE_CONFIG.mass,
      material: vehiclePhysMat,
      allowSleep: false,
      linearDamping: 0.0,
      angularDamping: 0.88,
    });
    // Evita vuelcos laterales manteniendo el giro libre alrededor de Y
    this.body.angularFactor.set(0, 1, 0);
    this.body.addShape(new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)));
    this.body.position.set(px, py, pz);
    this.body.quaternion.setFromAxisAngle(_cannonYAxis, VEHICLE_CONFIG.spawnYaw);
    this.world.addBody(this.body);

    this.previousPosition.set(px, py, pz);
    this.currentPosition.set(px, py, pz);
    this.interpolatedPosition.set(px, py, pz);
    this.previousQuaternion.set(
      this.body.quaternion.x,
      this.body.quaternion.y,
      this.body.quaternion.z,
      this.body.quaternion.w
    );
    this.currentQuaternion.copy(this.previousQuaternion);
    this.interpolatedQuaternion.copy(this.previousQuaternion);

    this.group = new THREE.Group();
    this.leanGroup = new THREE.Group();
    this.seatAnchor = new THREE.Group();
    // Altura exacta del asiento para encajar con la pelvis del soldado
    this.seatAnchor.position.set(0, -sy / 2 + 0.78, 0.2);

    this.group.add(this.leanGroup);
    this.leanGroup.add(this.seatAnchor);
    scene.add(this.group);

    // Hitbox invisible para que EngineRaycaster apunte con comodidad en TPS/FPS
    const hitProxyGeo = new THREE.BoxGeometry(sx * 1.35, sy * 1.35, sz * 1.12);
    const hitProxyMat = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
    });
    disposableGeometries.push(hitProxyGeo);
    disposableMaterials.push(hitProxyMat);
    const hitProxy = new THREE.Mesh(hitProxyGeo, hitProxyMat);
    hitProxy.position.set(0, 0.14, 0);
    hitProxy.userData.interactType = 'motorcycle';
    this.group.add(hitProxy);
    this.interactTargets.push(hitProxy);

    // Modelo visual de respaldo procedural (inmediato y fiable si Motorcycle.glb da 404)
    this.proceduralRig = buildProceduralMotorcycle(
      disposableGeometries,
      disposableMaterials
    );
    this.leanGroup.add(this.proceduralRig.visualRoot);
    this.interactTargets.push(...this.proceduralRig.interactMeshes);
  }

  public attachGlbModel(model: THREE.Object3D): void {
    model.position.set(0, 0, 0);
    model.updateMatrixWorld(true);
    const rawBox = new THREE.Box3().setFromObject(model, true);
    const rawSize = new THREE.Vector3();
    rawBox.getSize(rawSize);
    const maxHoriz = Math.max(rawSize.x, rawSize.z, 0.001);
    const scale = VEHICLE_CONFIG.boxSize[2] / maxHoriz;
    model.scale.setScalar(scale);

    // Orientar eje largo a lo largo de -Z si viniera rotada en X
    if (rawSize.x > rawSize.z) {
      model.rotation.y = Math.PI / 2;
    }

    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model, true);
    const center = new THREE.Vector3();
    box.getCenter(center);

    model.position.set(
      -center.x,
      -VEHICLE_CONFIG.boxSize[1] / 2 - box.min.y,
      -center.z
    );

    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
        m.userData.interactType = 'motorcycle';
        this.interactTargets.push(m);
      }
      const n = child.name.toLowerCase();
      if (!this.glbFrontWheel && /(front.*wheel|wheel.*front|wheel_f)/i.test(n)) {
        this.glbFrontWheel = child;
      } else if (!this.glbRearWheel && /(rear.*wheel|back.*wheel|wheel.*rear|wheel_r)/i.test(n)) {
        this.glbRearWheel = child;
      } else if (!this.glbFork && /(handle|fork|steer|manubrio)/i.test(n)) {
        this.glbFork = child;
      }
    });

    this.glbRoot = model;
    this.proceduralRig.visualRoot.visible = false;
    this.leanGroup.add(model);
  }

  public syncInterpolationBuffers(): void {
    this.previousPosition.set(this.body.position.x, this.body.position.y, this.body.position.z);
    this.currentPosition.copy(this.previousPosition);
    this.previousQuaternion.set(
      this.body.quaternion.x,
      this.body.quaternion.y,
      this.body.quaternion.z,
      this.body.quaternion.w
    );
    this.currentQuaternion.copy(this.previousQuaternion);
  }

  public capturePostStep(): void {
    this.currentPosition.set(this.body.position.x, this.body.position.y, this.body.position.z);
    this.currentQuaternion.set(
      this.body.quaternion.x,
      this.body.quaternion.y,
      this.body.quaternion.z,
      this.body.quaternion.w
    );
    if (!this.isGrounded) {
      this.minAirborneVy = Math.min(this.minAirborneVy, this.body.velocity.y);
    }
  }

  public reset(): void {
    const [px, py, pz] = VEHICLE_CONFIG.spawnPosition;
    this.body.position.set(px, py, pz);
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    this.body.quaternion.setFromAxisAngle(_cannonYAxis, VEHICLE_CONFIG.spawnYaw);
    this.currentForwardSpeed = 0;
    this.smoothSteerAngle = 0;
    this.leanAngle = 0;
    this.headingYaw = VEHICLE_CONFIG.spawnYaw;
    this.minAirborneVy = 0;
    this.syncInterpolationBuffers();
  }

  private evaluateGrounded(): boolean {
    for (let i = 0; i < this.world.contacts.length; i++) {
      const c = this.world.contacts[i];
      if (c.bi === this.body && -c.ni.y > 0.4) return true;
      if (c.bj === this.body && c.ni.y > 0.4) return true;
    }
    let hit = false;
    _rayFrom.set(this.body.position.x, this.body.position.y, this.body.position.z);
    _rayTo.set(
      this.body.position.x,
      this.body.position.y - (VEHICLE_CONFIG.boxSize[1] / 2 + 0.16),
      this.body.position.z
    );
    this.world.raycastAll(_rayFrom, _rayTo, { skipBackfaces: true }, (res) => {
      if (res.body && res.body !== this.body && res.hitNormalWorld.y > 0.4) {
        hit = true;
      }
    });
    return hit;
  }

  public fixedUpdate(fixedDt: number): void {
    this.previousPosition.set(this.body.position.x, this.body.position.y, this.body.position.z);
    this.previousQuaternion.set(
      this.body.quaternion.x,
      this.body.quaternion.y,
      this.body.quaternion.z,
      this.body.quaternion.w
    );

    const wasGrounded = this.isGrounded;
    if (!wasGrounded) {
      this.minAirborneVy = Math.min(this.minAirborneVy, this.body.velocity.y);
    }
    const touchingGround = this.evaluateGrounded();
    if (touchingGround && this.body.velocity.y <= 1.2) {
      this.isGrounded = true;
      if (!wasGrounded) {
        const impactVy = Math.min(this.minAirborneVy, this.body.velocity.y);
        if (impactVy < -7.0) {
          this.onHardLanding(impactVy);
          this.audio.playSound('land_hard', { volume: 0.85 });
        }
        this.minAirborneVy = 0;
      }
    } else {
      this.isGrounded = false;
      this.minAirborneVy = Math.min(this.minAirborneVy, this.body.velocity.y);
    }

    _bikeQuat.set(
      this.body.quaternion.x,
      this.body.quaternion.y,
      this.body.quaternion.z,
      this.body.quaternion.w
    );
    _bikeFwd.set(0, 0, -1).applyQuaternion(_bikeQuat);
    _bikeFwd.y = 0;
    if (_bikeFwd.lengthSq() > 0.0001) _bikeFwd.normalize();

    _bikeRight.set(1, 0, 0).applyQuaternion(_bikeQuat);
    _bikeRight.y = 0;
    if (_bikeRight.lengthSq() > 0.0001) _bikeRight.normalize();

    const vx = this.body.velocity.x;
    const vz = this.body.velocity.z;
    let vFwd = vx * _bikeFwd.x + vz * _bikeFwd.z;
    let vLat = vx * _bikeRight.x + vz * _bikeRight.z;

    if (this.isMounted) {
      const throttle = this.driveInput.throttle;
      const steer = this.driveInput.steer;

      if (throttle > 0.05) {
        const targetMax = VEHICLE_CONFIG.maxForwardSpeed * throttle;
        vFwd = Math.min(targetMax, vFwd + VEHICLE_CONFIG.accel * throttle * fixedDt);
      } else if (throttle < -0.05) {
        if (vFwd > 0.35) {
          vFwd = Math.max(0, vFwd - VEHICLE_CONFIG.brakeDecel * Math.abs(throttle) * fixedDt);
        } else {
          const targetMin = -VEHICLE_CONFIG.maxReverseSpeed * Math.abs(throttle);
          vFwd = Math.max(targetMin, vFwd - VEHICLE_CONFIG.accel * 0.75 * Math.abs(throttle) * fixedDt);
        }
      } else {
        vFwd *= Math.exp(-VEHICLE_CONFIG.rollingDamping * fixedDt);
        if (Math.abs(vFwd) < 0.04) vFwd = 0;
      }

      // Fricción lateral alta para agarre limpio de neumáticos en curva
      vLat *= Math.exp(-11.0 * fixedDt);

      this.smoothSteerAngle = THREE.MathUtils.damp(this.smoothSteerAngle, steer, 10, fixedDt);
      const speedTurnFactor = THREE.MathUtils.clamp(Math.abs(vFwd) / 3.2, 0.32, 1.0);
      const reverseInvert = vFwd < -0.25 ? -1 : 1;
      const yawRate =
        this.smoothSteerAngle * VEHICLE_CONFIG.steerSpeed * speedTurnFactor * reverseInvert;
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

  public update(dt: number, alpha: number): void {
    if (this.body.position.y < -12) {
      this.reset();
    }

    _interpPos.lerpVectors(this.previousPosition, this.currentPosition, alpha);
    _interpQuat.slerpQuaternions(this.previousQuaternion, this.currentQuaternion, alpha);
    this.interpolatedPosition.copy(_interpPos);
    this.interpolatedQuaternion.copy(_interpQuat);

    this.group.position.copy(_interpPos);
    this.group.quaternion.copy(_interpQuat);

    _bikeEuler.setFromQuaternion(_interpQuat, 'YXZ');
    this.headingYaw = _bikeEuler.y;

    // Inclinación dinámica (lean) al girar y rotación de ruedas + manubrio
    const speedRatio = THREE.MathUtils.clamp(
      Math.abs(this.currentForwardSpeed) / VEHICLE_CONFIG.maxForwardSpeed,
      0,
      1
    );
    const targetLean = this.isMounted
      ? this.smoothSteerAngle * (0.14 + speedRatio * 0.28)
      : 0.06; // Ligero apoyo lateral cuando está estacionada
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

interface PlayerSteerInput {
  dirX: number;
  dirZ: number;
  inputMag: number;
  maxSpeed: number;
  jumpQueued: boolean;
}

class PlayerEntity extends Entity {
  public health = 100;
  public readonly body: CANNON.Body;
  public readonly group: THREE.Group;
  public readonly headingGroup: THREE.Group;
  public readonly capsuleHalfHeight: number;
  public readonly previousPosition: THREE.Vector3;
  public readonly currentPosition: THREE.Vector3;
  public readonly previousQuaternion = new THREE.Quaternion();
  public readonly currentQuaternion = new THREE.Quaternion();
  public readonly interpolatedPosition = new THREE.Vector3();

  public isMounted = false;
  public isFpsMode = false;
  public isGrounded = false;
  public coyoteTimer = 0;
  public airBlend = 0;
  public isWaving = false;
  public waveBlend = 0;
  public reportedAnim: CharacterAnimState = 'Idle';

  public baseMixer: THREE.AnimationMixer | null = null;
  public upperMixer: THREE.AnimationMixer | null = null;
  public maskedUpperBones: MaskedBoneEntry[] = [];
  public boneRig: CharacterBoneRig = {};
  public headBone: THREE.Bone | null = null;
  public visorMeshes: THREE.Mesh[] = [];
  public readonly actions: Partial<Record<'Idle' | 'Walk' | 'Run', THREE.AnimationAction>> = {};
  public activeClipName: 'Idle' | 'Walk' | 'Run' = 'Idle';

  private minAirborneVy = 0;
  private mountedSteerAngle = 0;
  private bodyInWorld = true;
  private readonly spawnPosition: readonly [number, number, number];
  private readonly scene: THREE.Scene;
  private readonly world: CANNON.World;
  private readonly steerInput: PlayerSteerInput;
  private readonly onHardLanding: (impactSpeed: number) => void;
  private readonly audio: AudioManager;

  constructor(
    spawnPosition: readonly [number, number, number],
    scene: THREE.Scene,
    world: CANNON.World,
    playerPhysMat: CANNON.Material,
    steerInput: PlayerSteerInput,
    onHardLanding: (impactSpeed: number) => void,
    audio: AudioManager
  ) {
    super('player');
    this.spawnPosition = spawnPosition;
    this.scene = scene;
    this.world = world;
    this.steerInput = steerInput;
    this.onHardLanding = onHardLanding;
    this.audio = audio;

    const r = PHYSICS_CONFIG.capsuleRadius;
    const cylH = PHYSICS_CONFIG.capsuleCylinderHeight;
    this.capsuleHalfHeight = cylH / 2 + r;

    this.body = new CANNON.Body({
      mass: PHYSICS_CONFIG.playerMass,
      material: playerPhysMat,
      fixedRotation: true,
      allowSleep: false,
      linearDamping: 0.0,
    });
    this.body.addShape(new CANNON.Sphere(r), new CANNON.Vec3(0, -cylH / 2, 0));
    this.body.addShape(new CANNON.Cylinder(r, r, cylH, 12), new CANNON.Vec3(0, 0, 0));
    this.body.addShape(new CANNON.Sphere(r), new CANNON.Vec3(0, cylH / 2, 0));
    this.body.position.set(spawnPosition[0], spawnPosition[1], spawnPosition[2]);
    this.world.addBody(this.body);

    this.previousPosition = new THREE.Vector3(spawnPosition[0], spawnPosition[1], spawnPosition[2]);
    this.currentPosition = new THREE.Vector3(spawnPosition[0], spawnPosition[1], spawnPosition[2]);
    this.interpolatedPosition.copy(this.currentPosition);

    this.group = new THREE.Group();
    this.headingGroup = new THREE.Group();
    this.group.add(this.headingGroup);
    this.scene.add(this.group);
  }

  public mountTo(seatAnchor: THREE.Group): void {
    if (this.isMounted) return;
    this.isMounted = true;
    this.isWaving = false;
    this.waveBlend = 0;
    this.steerInput.jumpQueued = false;

    if (this.bodyInWorld) {
      this.world.removeBody(this.body);
      this.bodyInWorld = false;
    }

    // Attachment visual directo al asiento de la moto
    seatAnchor.add(this.group);
    this.group.position.set(0, -0.08, 0.02);
    this.group.quaternion.identity();
    this.headingGroup.quaternion.identity();
    this.switchAnimation('Idle', 0.12);
    this.audio.playSound('mount', { volume: 0.75 });
  }

  public dismountAt(worldPos: THREE.Vector3, facingYaw: number): void {
    if (!this.isMounted) return;
    this.isMounted = false;

    this.scene.add(this.group);
    this.body.position.set(worldPos.x, worldPos.y, worldPos.z);
    this.body.velocity.set(0, 0, 0);
    if (!this.bodyInWorld) {
      this.world.addBody(this.body);
      this.bodyInWorld = true;
    }
    this.syncInterpolationBuffers();
    this.group.position.copy(worldPos);
    this.group.quaternion.identity();
    this.headingGroup.quaternion.setFromAxisAngle(_upAxis, facingYaw);
    this.minAirborneVy = 0;
    this.audio.playSound('dismount', { volume: 0.7 });
  }

  public setMountedSteer(steerAngle: number): void {
    this.mountedSteerAngle = steerAngle;
  }

  public syncInterpolationBuffers(): void {
    this.previousPosition.set(this.body.position.x, this.body.position.y, this.body.position.z);
    this.currentPosition.copy(this.previousPosition);
    this.previousQuaternion.set(
      this.body.quaternion.x,
      this.body.quaternion.y,
      this.body.quaternion.z,
      this.body.quaternion.w
    );
    this.currentQuaternion.copy(this.previousQuaternion);
  }

  public capturePostStep(): void {
    if (this.isMounted) return;
    this.currentPosition.set(this.body.position.x, this.body.position.y, this.body.position.z);
    this.currentQuaternion.set(
      this.body.quaternion.x,
      this.body.quaternion.y,
      this.body.quaternion.z,
      this.body.quaternion.w
    );
    if (!this.isGrounded) {
      this.minAirborneVy = Math.min(this.minAirborneVy, this.body.velocity.y);
    }
  }

  public alignModelToCapsuleBase(model: THREE.Object3D): void {
    model.position.set(0, 0, 0);
    model.updateMatrixWorld(true);
    model.traverse((obj) => {
      const skinned = obj as THREE.SkinnedMesh;
      if (skinned.isSkinnedMesh && skinned.skeleton) {
        skinned.skeleton.update();
      }
    });

    const box = new THREE.Box3().setFromObject(model, true);
    const center = new THREE.Vector3();
    box.getCenter(center);

    model.position.set(
      -center.x,
      -this.capsuleHalfHeight - box.min.y,
      -center.z
    );
  }

  public switchAnimation(nextName: 'Idle' | 'Walk' | 'Run', fadeTime = 0.2): void {
    if (!this.baseMixer || this.activeClipName === nextName) return;
    const nextAction = this.actions[nextName];
    if (!nextAction) return;
    const prevAction = this.actions[this.activeClipName];
    if (prevAction) prevAction.fadeOut(fadeTime);
    nextAction
      .reset()
      .setEffectiveTimeScale(1)
      .setEffectiveWeight(1)
      .fadeIn(fadeTime)
      .play();
    this.activeClipName = nextName;
  }

  public reset(): void {
    if (this.isMounted) {
      this.scene.add(this.group);
      this.isMounted = false;
    }
    if (!this.bodyInWorld) {
      this.world.addBody(this.body);
      this.bodyInWorld = true;
    }
    this.body.position.set(this.spawnPosition[0], this.spawnPosition[1], this.spawnPosition[2]);
    this.body.velocity.set(0, 0, 0);
    this.syncInterpolationBuffers();
    this.group.position.set(this.spawnPosition[0], this.spawnPosition[1], this.spawnPosition[2]);
    this.group.quaternion.identity();
    this.headingGroup.quaternion.identity();
    this.isWaving = false;
    this.minAirborneVy = 0;
    this.health = 100;
  }

  public getHeadWorldPosition(out: THREE.Vector3): THREE.Vector3 {
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

  private applyFpsHeadMask(): void {
    // Mantiene visible el resto del cuerpo y los brazos en FPS, ocultando solo visor y cabeza
    if (this.headBone) {
      this.headBone.scale.setScalar(this.isFpsMode ? 0.0005 : 1);
    }
    for (let i = 0; i < this.visorMeshes.length; i++) {
      this.visorMeshes[i].visible = !this.isFpsMode;
    }
  }

  private evaluateGrounded(): boolean {
    for (let i = 0; i < this.world.contacts.length; i++) {
      const c = this.world.contacts[i];
      if (c.bi === this.body && -c.ni.y > 0.45) return true;
      if (c.bj === this.body && c.ni.y > 0.45) return true;
    }
    let rayHitGround = false;
    _rayFrom.set(this.body.position.x, this.body.position.y - 0.3, this.body.position.z);
    _rayTo.set(
      this.body.position.x,
      this.body.position.y - (this.capsuleHalfHeight + 0.14),
      this.body.position.z
    );
    this.world.raycastAll(_rayFrom, _rayTo, { skipBackfaces: true }, (res) => {
      if (res.body && res.body !== this.body && res.hitNormalWorld.y > 0.45) {
        rayHitGround = true;
      }
    });
    return rayHitGround;
  }

  public fixedUpdate(fixedDt: number): void {
    if (this.isMounted) return;

    this.previousPosition.set(this.body.position.x, this.body.position.y, this.body.position.z);
    this.previousQuaternion.set(
      this.body.quaternion.x,
      this.body.quaternion.y,
      this.body.quaternion.z,
      this.body.quaternion.w
    );

    const wasGrounded = this.isGrounded;
    if (!wasGrounded) {
      this.minAirborneVy = Math.min(this.minAirborneVy, this.body.velocity.y);
    }

    const touchingGround = this.evaluateGrounded();
    if (touchingGround && this.body.velocity.y <= 1.2) {
      this.isGrounded = true;
      this.coyoteTimer = PHYSICS_CONFIG.coyoteMaxTime;
      if (!wasGrounded) {
        const impactVy = Math.min(this.minAirborneVy, this.body.velocity.y);
        if (impactVy < -7) {
          this.onHardLanding(impactVy);
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
      const accel = this.isGrounded ? PHYSICS_CONFIG.groundAccel : PHYSICS_CONFIG.airAccel;

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
      const dampingRate = this.isGrounded ? PHYSICS_CONFIG.groundDamping : PHYSICS_CONFIG.airDamping;
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
        this.body.velocity.y = PHYSICS_CONFIG.jumpVelocity;
        this.isGrounded = false;
        this.coyoteTimer = 0;
        this.minAirborneVy = 0;
        this.audio.playSound('jump', { volume: 0.75 });
      }
      this.steerInput.jumpQueued = false;
    }
  }

  public update(dt: number, alpha: number): void {
    // Modo montado: el grupo visual está acoplado a seatAnchor de la motocicleta
    if (this.isMounted) {
      this.reportedAnim = 'Drive';
      this.isGrounded = true;
      this.switchAnimation('Idle', 0.14);
      if (this.baseMixer && dt > 0) {
        this.baseMixer.update(dt);
      } else if (this.baseMixer) {
        this.baseMixer.update(0);
      }
      applyMotorcycleSeatedPose(this.boneRig, this.mountedSteerAngle);
      this.applyFpsHeadMask();
      this.group.getWorldPosition(this.interpolatedPosition);
      return;
    }

    if (this.body.position.y < -10) {
      this.body.position.set(this.spawnPosition[0], this.spawnPosition[1], this.spawnPosition[2]);
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
      if (realHorizSpeed > PHYSICS_CONFIG.stopVelocityThreshold) {
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
      this.reportedAnim = 'Jump';
      this.switchAnimation('Idle', 0.14);
      if (dt > 0) this.airBlend = THREE.MathUtils.damp(this.airBlend, 1, 15, dt);
    } else {
      if (dt > 0) this.airBlend = THREE.MathUtils.damp(this.airBlend, 0, 18, dt);
      if (realHorizSpeed < PHYSICS_CONFIG.stopVelocityThreshold) {
        this.reportedAnim = 'Idle';
        this.switchAnimation('Idle', 0.12);
      } else if (realHorizSpeed > 4.4) {
        this.reportedAnim = 'Run';
        this.switchAnimation('Run', 0.18);
        if (this.actions.Run) {
          this.actions.Run.timeScale = THREE.MathUtils.clamp(
            realHorizSpeed / PHYSICS_CONFIG.runSpeed,
            0.75,
            1.18
          );
        }
      } else {
        this.reportedAnim = 'Walk';
        this.switchAnimation('Walk', 0.18);
        if (this.actions.Walk) {
          this.actions.Walk.timeScale = THREE.MathUtils.clamp(
            realHorizSpeed / PHYSICS_CONFIG.walkSpeed,
            0.65,
            1.2
          );
        }
      }
    }

    if (this.baseMixer) {
      if (dt > 0) {
        this.baseMixer.update(dt);
      }
      if (this.airBlend > 0.005) {
        applyProceduralJumpPose(this.boneRig, this.airBlend, this.body.velocity.y);
      }

      if (dt > 0) {
        this.waveBlend = THREE.MathUtils.damp(this.waveBlend, this.isWaving ? 1 : 0, 10, dt);
      }
      if (this.upperMixer && this.maskedUpperBones.length > 0 && this.waveBlend > 0.005) {
        for (let i = 0; i < this.maskedUpperBones.length; i++) {
          this.maskedUpperBones[i].baseQuat.copy(this.maskedUpperBones[i].bone.quaternion);
        }
        if (dt > 0) this.upperMixer.update(dt);
        for (let i = 0; i < this.maskedUpperBones.length; i++) {
          const entry = this.maskedUpperBones[i];
          entry.waveQuat.copy(entry.bone.quaternion);
          entry.bone.quaternion
            .copy(entry.baseQuat)
            .slerp(entry.waveQuat, this.waveBlend);
        }
      }
    }

    this.applyFpsHeadMask();
  }
}

export const ThirdPersonViewport = forwardRef<
  ThirdPersonViewportHandle,
  ThirdPersonViewportProps
>(function ThirdPersonViewport(
  { onLoadProgress, onStateChange, onContextLostChange },
  ref
) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const onLoadProgressRef = useRef(onLoadProgress);
  onLoadProgressRef.current = onLoadProgress;
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;
  const onContextLostRef = useRef(onContextLostChange);
  onContextLostRef.current = onContextLostChange;

  const joyInputRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });
  const jumpQueueRef = useRef(false);
  const resetFnRef = useRef<(() => void) | null>(null);
  const cycleViewFnRef = useRef<(() => void) | null>(null);
  const toggleWaveFnRef = useRef<(() => void) | null>(null);
  const interactFnRef = useRef<(() => void) | null>(null);
  const toggleCameraModeFnRef = useRef<(() => void) | null>(null);
  const togglePauseFnRef = useRef<(() => void) | null>(null);
  const toggleSlowMotionFnRef = useRef<(() => void) | null>(null);

  useImperativeHandle(ref, () => ({
    resetPlayer: () => resetFnRef.current?.(),
    triggerJump: () => {
      jumpQueueRef.current = true;
    },
    setJoystick: (x: number, y: number, active: boolean) => {
      joyInputRef.current.x = x;
      joyInputRef.current.y = y;
      joyInputRef.current.active = active;
    },
    cycleCameraView: () => cycleViewFnRef.current?.(),
    toggleWave: () => toggleWaveFnRef.current?.(),
    interact: () => interactFnRef.current?.(),
    toggleCameraMode: () => toggleCameraModeFnRef.current?.(),
    togglePause: () => togglePauseFnRef.current?.(),
    toggleSlowMotion: () => toggleSlowMotionFnRef.current?.(),
  }));

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let disposed = false;
    let frameId = 0;

    const isSoftwareGl = detectSoftwareWebGL();
    const levelData: LevelJSON = DEFAULT_LEVEL_JSON;

    // Sistemas centrales del motor
    const entityManager = new EntityManager();
    const timeManager = new TimeManager();
    const audioManager = new AudioManager();

    // 1. Scene, Camera & Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(levelData.skyColor);
    scene.fog = new THREE.Fog(SCENE_COLORS.skyHex, 28, 78);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const camera = new THREE.PerspectiveCamera(
      CAMERA_VIEWS[0].fov,
      width / height,
      0.08,
      150
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    // 2. Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.42));

    const hemiLight = new THREE.HemisphereLight(0xdde8f8, 0x9aa3ad, 0.55);
    hemiLight.position.set(0, 30, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff6ea, 1.85);
    dirLight.position.set(12, 22, 10);
    dirLight.castShadow = !isSoftwareGl;
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

    // 3. Cannon-es Physics World
    const world = new CANNON.World({
      gravity: new CANNON.Vec3(0, PHYSICS_CONFIG.gravity, 0),
    });
    world.broadphase = new CANNON.SAPBroadphase(world);
    (world.solver as CANNON.GSSolver).iterations = 10;
    world.defaultContactMaterial.friction = 0;
    world.defaultContactMaterial.restitution = 0;

    const groundPhysMat = new CANNON.Material('ground');
    const playerPhysMat = new CANNON.Material('player');
    const vehiclePhysMat = new CANNON.Material('vehicle');
    world.addContactMaterial(
      new CANNON.ContactMaterial(groundPhysMat, playerPhysMat, {
        friction: 0.0,
        restitution: 0.0,
      })
    );
    world.addContactMaterial(
      new CANNON.ContactMaterial(groundPhysMat, vehiclePhysMat, {
        friction: 0.0,
        restitution: 0.0,
      })
    );

    const groundBody = new CANNON.Body({
      mass: 0,
      material: groundPhysMat,
      shape: new CANNON.Plane(),
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(groundBody);

    const groundGeo = new THREE.PlaneGeometry(levelData.ground.size, levelData.ground.size);
    const groundMeshMat = new THREE.MeshStandardMaterial({
      color: levelData.ground.color,
      roughness: 0.92,
      metalness: 0.02,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMeshMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const cameraColliders: THREE.Object3D[] = [groundMesh];

    const obstacleMaterials = {
      block: new THREE.MeshStandardMaterial({
        color: SCENE_COLORS.blockPrimaryHex,
        roughness: 0.82,
        metalness: 0.05,
      }),
      platform: new THREE.MeshStandardMaterial({
        color: SCENE_COLORS.blockSecondaryHex,
        roughness: 0.78,
        metalness: 0.08,
      }),
      ramp: new THREE.MeshStandardMaterial({
        color: SCENE_COLORS.rampHex,
        roughness: 0.85,
        metalness: 0.04,
      }),
      cylinder: new THREE.MeshStandardMaterial({
        color: SCENE_COLORS.cylinderHex,
        roughness: 0.76,
        metalness: 0.1,
      }),
      doorFrame: new THREE.MeshStandardMaterial({
        color: SCENE_COLORS.doorFrameHex,
        roughness: 0.7,
        metalness: 0.2,
      }),
      doorLeaf: new THREE.MeshStandardMaterial({
        color: SCENE_COLORS.doorLeafHex,
        roughness: 0.55,
        metalness: 0.25,
      }),
      doorHandle: new THREE.MeshStandardMaterial({
        color: SCENE_COLORS.doorHandleHex,
        roughness: 0.25,
        metalness: 0.85,
      }),
    };

    const disposableGeometries: THREE.BufferGeometry[] = [groundGeo];
    const disposableMaterials: THREE.Material[] = [
      groundMeshMat,
      obstacleMaterials.block,
      obstacleMaterials.platform,
      obstacleMaterials.ramp,
      obstacleMaterials.cylinder,
      obstacleMaterials.doorFrame,
      obstacleMaterials.doorLeaf,
      obstacleMaterials.doorHandle,
    ];

    for (const obs of levelData.obstacles) {
      if (obs.shape === 'box') {
        const [sx, sy, sz] = obs.size;
        const [px, py, pz] = obs.position;
        const [rx, ry, rz] = obs.rotationEuler ?? [0, 0, 0];

        const boxGeo = new THREE.BoxGeometry(sx, sy, sz);
        disposableGeometries.push(boxGeo);
        const boxMesh = new THREE.Mesh(boxGeo, obstacleMaterials[obs.variant]);
        boxMesh.position.set(px, py, pz);
        boxMesh.rotation.set(rx, ry, rz);
        boxMesh.castShadow = true;
        boxMesh.receiveShadow = true;
        scene.add(boxMesh);
        cameraColliders.push(boxMesh);

        const obsBody = new CANNON.Body({
          mass: 0,
          material: groundPhysMat,
          shape: new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)),
        });
        obsBody.position.set(px, py, pz);
        obsBody.quaternion.setFromEuler(rx, ry, rz);
        world.addBody(obsBody);
      } else {
        const segs = obs.segments ?? 24;
        const [px, py, pz] = obs.position;
        const [rx, ry, rz] = obs.rotationEuler ?? [0, 0, 0];

        const cylGeo = new THREE.CylinderGeometry(
          obs.radiusTop,
          obs.radiusBottom,
          obs.height,
          segs
        );
        disposableGeometries.push(cylGeo);
        const cylMesh = new THREE.Mesh(cylGeo, obstacleMaterials.cylinder);
        cylMesh.position.set(px, py, pz);
        cylMesh.rotation.set(rx, ry, rz);
        cylMesh.castShadow = true;
        cylMesh.receiveShadow = true;
        scene.add(cylMesh);
        cameraColliders.push(cylMesh);

        const cylBody = new CANNON.Body({
          mass: 0,
          material: groundPhysMat,
          shape: new CANNON.Cylinder(
            obs.radiusTop,
            obs.radiusBottom,
            obs.height,
            segs
          ),
        });
        cylBody.position.set(px, py, pz);
        cylBody.quaternion.setFromEuler(rx, ry, rz);
        world.addBody(cylBody);
      }
    }

    // Sistema de Camera Shake
    let shakeIntensity = 0;
    let shakeDuration = 0;
    let shakeTimer = 0;

    function triggerCameraShake(intensity: number, duration: number) {
      shakeIntensity = Math.max(shakeIntensity, intensity);
      shakeDuration = Math.max(duration, 0.01);
      shakeTimer = shakeDuration;
    }

    // 4. Entidades registradas en EntityManager (Puerta + Motocicleta + Jugador)
    const steerState: PlayerSteerInput = {
      dirX: 0,
      dirZ: 0,
      inputMag: 0,
      maxSpeed: 0,
      jumpQueued: false,
    };
    const driveState: VehicleDriveInput = {
      throttle: 0,
      steer: 0,
    };

    const doorEntity = entityManager.add(
      new DoorEntity(
        levelData.door,
        scene,
        world,
        groundPhysMat,
        {
          doorFrame: obstacleMaterials.doorFrame,
          doorLeaf: obstacleMaterials.doorLeaf,
          doorHandle: obstacleMaterials.doorHandle,
        },
        cameraColliders,
        disposableGeometries,
        audioManager
      )
    );

    const motorcycleEntity = entityManager.add(
      new MotorcycleEntity(
        scene,
        world,
        vehiclePhysMat,
        driveState,
        disposableGeometries,
        disposableMaterials,
        (impactVy) => {
          const factor = THREE.MathUtils.clamp((-impactVy - 7) / 7, 0.4, 1.15);
          triggerCameraShake(0.12 * factor, 0.25);
        },
        audioManager
      )
    );

    const playerEntity = entityManager.add(
      new PlayerEntity(
        levelData.spawn,
        scene,
        world,
        playerPhysMat,
        steerState,
        (impactVy) => {
          const factor = THREE.MathUtils.clamp((-impactVy - 7) / 6, 0.4, 1.2);
          triggerCameraShake(0.11 * factor, 0.24);
        },
        audioManager
      )
    );

    // Espacio reservado en EntityManager para registrar futuras entidades desde levelData.entities
    const engineRaycaster = new EngineRaycaster();
    let interactTargetType: InteractTargetType = null;
    let interactPrompt: string | null = null;
    let lastReportedKey = '';

    // 5. Carga de Soldier.glb y Motorcycle.glb (con respaldo procedural si la URL de moto no está disponible)
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      SOLDIER_MODEL_URL,
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });

        const baseMixer = new THREE.AnimationMixer(model);
        playerEntity.baseMixer = baseMixer;
        (['Idle', 'Walk', 'Run'] as const).forEach((clipName) => {
          const clip = THREE.AnimationClip.findByName(
            gltf.animations,
            clipName
          );
          if (clip) {
            playerEntity.actions[clipName] = baseMixer.clipAction(clip);
          }
        });
        if (playerEntity.actions.Idle) {
          playerEntity.actions.Idle.play();
          baseMixer.update(0);
        }

        playerEntity.alignModelToCapsuleBase(model);
        playerEntity.headingGroup.add(model);

        const { headBone, visorMeshes } = findHeadAndVisor(model);
        playerEntity.headBone = headBone;
        playerEntity.visorMeshes = visorMeshes;
        playerEntity.boneRig = buildCharacterBoneRig(model);

        const upperLayer = buildUpperBodyWaveLayer(model, gltf.animations);
        playerEntity.upperMixer = upperLayer.upperMixer;
        playerEntity.maskedUpperBones = upperLayer.maskedBones;

        onLoadProgressRef.current(100, true, null);
      },
      (progress) => {
        if (disposed) return;
        if (progress.total > 0) {
          const pct = Math.min(
            99,
            Math.round((progress.loaded / progress.total) * 100)
          );
          onLoadProgressRef.current(pct, false, null);
        }
      },
      () => {
        if (disposed) return;
        const fallback = createProceduralFallbackCharacter();
        playerEntity.alignModelToCapsuleBase(fallback);
        playerEntity.headingGroup.add(fallback);
        const { visorMeshes } = findHeadAndVisor(fallback);
        playerEntity.visorMeshes = visorMeshes;
        onLoadProgressRef.current(
          100,
          true,
          'No se pudo descargar Soldier.glb desde GitHub; usando modelo de respaldo.'
        );
      }
    );

    // Intento de carga de Motorcycle.glb desde URL oficial (si da 404 usa el modelo procedural articulado)
    gltfLoader.load(
      MOTORCYCLE_MODEL_URL,
      (gltf) => {
        if (disposed) return;
        motorcycleEntity.attachGlbModel(gltf.scene);
      },
      undefined,
      () => {
        // Fallback procedural ya activo en MotorcycleEntity
      }
    );

    // 6. Estado de cámara (TPS + FPS real con brazos visibles) e inputs
    const keys: Record<string, boolean> = Object.create(null);

    let cameraMode: CameraMode = 'TPS';
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
    let cameraPointerId: number | null = null;
    let lastPointerX = 0;
    let lastPointerY = 0;

    const currentLookAt = new THREE.Vector3(0, CAMERA_VIEWS[0].targetHeight, 0);
    const currentCamPos = new THREE.Vector3(0, 2.9, CAMERA_VIEWS[0].distance);
    const camRaycaster = new THREE.Raycaster();

    camera.position.copy(currentCamPos);
    camera.lookAt(currentLookAt);

    world.addEventListener('preStep', () => {
      entityManager.fixedUpdate(PHYSICS_CONFIG.fixedTimeStep);
    });

    world.addEventListener('postStep', () => {
      playerEntity.capturePostStep();
      motorcycleEntity.capturePostStep();
    });

    const cycleView = () => {
      if (cameraMode === 'FPS') {
        cameraMode = 'TPS';
        playerEntity.isFpsMode = false;
      }
      currentViewIndex = (currentViewIndex + 1) % CAMERA_VIEWS.length;
      pitchOffset = 0;
      zoomOffset = 0;
    };
    cycleViewFnRef.current = cycleView;

    const toggleCameraMode = () => {
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
    };
    toggleCameraModeFnRef.current = toggleCameraMode;

    const togglePause = () => {
      timeManager.togglePause();
    };
    togglePauseFnRef.current = togglePause;

    const toggleSlowMotion = () => {
      timeManager.toggleSlowMotion();
    };
    toggleSlowMotionFnRef.current = toggleSlowMotion;

    const toggleWave = () => {
      if (!motorcycleEntity.isMounted) {
        playerEntity.isWaving = !playerEntity.isWaving;
      }
    };
    toggleWaveFnRef.current = toggleWave;

    const mountMotorcycle = () => {
      motorcycleEntity.isMounted = true;
      playerEntity.mountTo(motorcycleEntity.seatAnchor);
      prevBikeYaw = motorcycleEntity.headingYaw;
      camYaw = motorcycleEntity.headingYaw;
      fpsLookYawOffset = 0;
      if (cameraMode === 'FPS') {
        fpsPitch = -0.14;
      }
    };

    const dismountMotorcycle = () => {
      _dismountOffset.set(-1.35, 0.45, 0).applyQuaternion(motorcycleEntity.interpolatedQuaternion);
      const dismountPos = new THREE.Vector3(
        motorcycleEntity.interpolatedPosition.x + _dismountOffset.x,
        Math.max(motorcycleEntity.interpolatedPosition.y + 0.45, 0.9),
        motorcycleEntity.interpolatedPosition.z + _dismountOffset.z
      );
      motorcycleEntity.isMounted = false;
      playerEntity.dismountAt(dismountPos, motorcycleEntity.headingYaw);
    };

    const interact = () => {
      audioManager.unlock();
      if (motorcycleEntity.isMounted) {
        dismountMotorcycle();
        return;
      }
      if (interactTargetType === 'motorcycle') {
        mountMotorcycle();
      } else if (interactTargetType === 'door') {
        doorEntity.toggle();
      }
    };
    interactFnRef.current = interact;

    resetFnRef.current = () => {
      playerEntity.reset();
      motorcycleEntity.reset();
      motorcycleEntity.isMounted = false;
      doorEntity.reset();
      timeManager.setTimeScale(1.0);
      cameraMode = 'TPS';
      playerEntity.isFpsMode = false;
      camera.near = 0.08;
      camera.updateProjectionMatrix();
      camYaw = 0;
      pitchOffset = 0;
      fpsPitch = 0;
      fpsLookYawOffset = 0;
      zoomOffset = 0;
      shakeTimer = 0;
      shakeIntensity = 0;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      audioManager.unlock();
      keys[e.code] = true;
      const tag = (e.target as HTMLElement | null)?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON';
      if (e.code === 'Space' && !inInput) {
        e.preventDefault();
        if (!motorcycleEntity.isMounted) {
          jumpQueueRef.current = true;
        }
      }
      if ((e.code === 'KeyV' || e.code === 'KeyC') && !e.repeat && !inInput) {
        cycleView();
      }
      if (e.code === 'F2' && !e.repeat) {
        e.preventDefault();
        toggleCameraMode();
      }
      if (e.code === 'KeyP' && !e.repeat && !inInput) {
        togglePause();
      }
      if (e.code === 'KeyL' && !e.repeat && !inInput) {
        toggleSlowMotion();
      }
      if (e.code === 'KeyF' && !e.repeat && !inInput) {
        toggleWave();
      }
      if (e.code === 'KeyE' && !e.repeat && !inInput) {
        interact();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };

    const handlePointerDown = (e: PointerEvent) => {
      audioManager.unlock();
      if (cameraPointerId !== null) return;
      isDraggingCamera = true;
      cameraPointerId = e.pointerId;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
    };
    const handlePointerMove = (e: PointerEvent) => {
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
    };
    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerId === cameraPointerId) {
        isDraggingCamera = false;
        cameraPointerId = null;
      }
    };
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (cameraMode === 'TPS') {
        zoomOffset = THREE.MathUtils.clamp(zoomOffset + e.deltaY * 0.004, -1.8, 3.8);
      }
    };

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(
        isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
      );
    };

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      onContextLostRef.current?.(true);
    };
    const handleContextRestored = () => {
      onContextLostRef.current?.(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    renderer.domElement.addEventListener('wheel', handleWheel, {
      passive: false,
    });
    window.addEventListener('resize', handleResize);
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener(
      'webglcontextrestored',
      handleContextRestored
    );

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const clock = new THREE.Clock();
    const allInteractTargets: THREE.Object3D[] = [
      ...doorEntity.interactTargets,
      ...motorcycleEntity.interactTargets,
    ];

    function tick() {
      if (disposed) return;

      const rawDt = Math.min(clock.getDelta(), 0.1);
      const scaledDt = rawDt * timeManager.timeScale;

      // 1. Leer inputs PC + Joystick móvil
      let rawX =
        (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) -
        (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
      let rawZ =
        (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) -
        (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0);

      const joy = joyInputRef.current;
      if (Math.abs(joy.x) > 0 || Math.abs(joy.y) > 0) {
        rawX = joy.x;
        rawZ = joy.y;
      }

      if (motorcycleEntity.isMounted) {
        // Controles de moto: W/S (o eje Y joystick) aceleran/frenan; A/D (o eje X) giran
        driveState.throttle = THREE.MathUtils.clamp(-rawZ, -1, 1);
        driveState.steer = THREE.MathUtils.clamp(-rawX, -1, 1);
        steerState.inputMag = 0;
        steerState.maxSpeed = 0;
        steerState.jumpQueued = false;
        jumpQueueRef.current = false;
      } else {
        driveState.throttle = 0;
        driveState.steer = 0;

        const inputMag = Math.min(1, Math.hypot(rawX, rawZ));
        const isSprinting = Boolean(
          keys['ShiftLeft'] ||
            keys['ShiftRight'] ||
            (joy.active && inputMag > 0.78)
        );

        _forward.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
        _right.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
        _moveDir.set(0, 0, 0);
        if (inputMag > 0.01) {
          _moveDir.addScaledVector(_right, rawX).addScaledVector(_forward, -rawZ);
          if (_moveDir.lengthSq() > 0.0001) {
            _moveDir.normalize();
          }
        }

        steerState.dirX = _moveDir.x;
        steerState.dirZ = _moveDir.z;
        steerState.inputMag = inputMag;
        steerState.maxSpeed =
          (isSprinting ? PHYSICS_CONFIG.runSpeed : PHYSICS_CONFIG.walkSpeed) *
          Math.max(0.55, inputMag);
        if (jumpQueueRef.current && !timeManager.isPaused) {
          steerState.jumpQueued = true;
          jumpQueueRef.current = false;
        } else if (timeManager.isPaused) {
          jumpQueueRef.current = false;
        }
      }

      // 2. Paso de físicas escalado por TimeManager
      if (scaledDt > 0) {
        world.step(PHYSICS_CONFIG.fixedTimeStep, scaledDt, 10);
      }

      // Sincroniza ángulo de dirección hacia la postura de los brazos del soldado
      playerEntity.setMountedSteer(motorcycleEntity.smoothSteerAngle);

      // 3. Actualizar todas las entidades mediante EntityManager
      const alpha = THREE.MathUtils.clamp(
        world.accumulator / PHYSICS_CONFIG.fixedTimeStep,
        0,
        1
      );
      entityManager.update(scaledDt, alpha);

      // 4. Audio continuo del motor de la moto
      const speedRatio = THREE.MathUtils.clamp(
        Math.abs(motorcycleEntity.currentForwardSpeed) / VEHICLE_CONFIG.maxForwardSpeed,
        0,
        1
      );
      audioManager.updateEngine(
        speedRatio,
        motorcycleEntity.isMounted,
        timeManager.isPaused,
        timeManager.timeScale
      );

      // 5. Luz direccional siguiendo al jugador/vehículo
      const focusPos = motorcycleEntity.isMounted
        ? motorcycleEntity.interpolatedPosition
        : playerEntity.interpolatedPosition;
      const focusBaseY = motorcycleEntity.isMounted
        ? focusPos.y - VEHICLE_CONFIG.boxSize[1] / 2
        : focusPos.y - playerEntity.capsuleHalfHeight;
      dirLight.position.set(
        focusPos.x + 12,
        focusBaseY + 22,
        focusPos.z + 10
      );
      dirLight.target.position.set(focusPos.x, focusBaseY, focusPos.z);

      // 6. Cámara TPS / FPS (con brazos visibles y manubrio en moto) + Camera Shake
      const activePreset = CAMERA_VIEWS[currentViewIndex];
      const realHorizSpeed = motorcycleEntity.isMounted
        ? Math.abs(motorcycleEntity.currentForwardSpeed)
        : Math.hypot(playerEntity.body.velocity.x, playerEntity.body.velocity.z);

      // Seguimiento suave de orientación cuando conduce la moto
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
        const targetFov =
          (motorcycleEntity.isMounted ? 78 : 75) + (realHorizSpeed > 6 ? 5.0 : 0);
        smoothFov = THREE.MathUtils.damp(smoothFov, targetFov, 10, rawDt);
        if (Math.abs(camera.fov - smoothFov) > 0.02) {
          camera.fov = smoothFov;
          camera.updateProjectionMatrix();
        }

        const effectiveYaw = motorcycleEntity.isMounted
          ? motorcycleEntity.headingYaw + fpsLookYawOffset
          : camYaw;

        const cosPitch = Math.cos(fpsPitch);
        // Adelantar ligeramente el ojo dentro del casco para ver brazos, manos y manubrio sin clipping
        const eyeForwardDist = motorcycleEntity.isMounted ? 0.11 : 0.08;
        _fpsForwardOffset.set(
          -Math.sin(effectiveYaw) * eyeForwardDist,
          motorcycleEntity.isMounted ? 0.02 : 0.01,
          -Math.cos(effectiveYaw) * eyeForwardDist
        );
        currentCamPos.copy(_headWorldPos).add(_fpsForwardOffset);

        _fpsLookTarget.set(
          currentCamPos.x - Math.sin(effectiveYaw) * cosPitch * 10,
          currentCamPos.y + Math.sin(fpsPitch) * 10,
          currentCamPos.z - Math.cos(effectiveYaw) * cosPitch * 10
        );
        currentLookAt.copy(_fpsLookTarget);
      } else {
        const baseDist = motorcycleEntity.isMounted
          ? Math.max(activePreset.distance, 5.6)
          : activePreset.distance;
        smoothDistance = THREE.MathUtils.damp(
          smoothDistance,
          THREE.MathUtils.clamp(baseDist + zoomOffset, 2.2, 12.0),
          7,
          rawDt
        );
        smoothPitch = THREE.MathUtils.damp(
          smoothPitch,
          THREE.MathUtils.clamp(activePreset.pitch + pitchOffset, 0.06, 1.15),
          7,
          rawDt
        );
        smoothShoulderX = THREE.MathUtils.damp(
          smoothShoulderX,
          motorcycleEntity.isMounted ? 0 : activePreset.shoulderOffsetX,
          7,
          rawDt
        );
        smoothTargetHeight = THREE.MathUtils.damp(
          smoothTargetHeight,
          motorcycleEntity.isMounted ? 1.25 : activePreset.targetHeight,
          7,
          rawDt
        );
        const targetFov = activePreset.fov + (realHorizSpeed > 5.0 ? 6.0 * speedRatio : 0);
        smoothFov = THREE.MathUtils.damp(smoothFov, targetFov, 7, rawDt);
        if (Math.abs(camera.fov - smoothFov) > 0.02) {
          camera.fov = smoothFov;
          camera.updateProjectionMatrix();
        }

        _right.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
        _lookTarget.set(
          focusPos.x + _right.x * smoothShoulderX,
          focusBaseY + smoothTargetHeight,
          focusPos.z + _right.z * smoothShoulderX
        );
        currentLookAt.x = THREE.MathUtils.damp(currentLookAt.x, _lookTarget.x, 14, rawDt);
        currentLookAt.y = THREE.MathUtils.damp(currentLookAt.y, _lookTarget.y, 14, rawDt);
        currentLookAt.z = THREE.MathUtils.damp(currentLookAt.z, _lookTarget.z, 14, rawDt);

        const horizDist = smoothDistance * Math.cos(smoothPitch);
        const vertDist = smoothDistance * Math.sin(smoothPitch);
        _desiredCamPos.set(
          _lookTarget.x + Math.sin(camYaw) * horizDist,
          _lookTarget.y + vertDist,
          _lookTarget.z + Math.cos(camYaw) * horizDist
        );

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
            _desiredCamPos
              .copy(_lookTarget)
              .addScaledVector(_rayDir, safeDist);
          }
        }
        _desiredCamPos.y = Math.max(0.38, _desiredCamPos.y);

        const followLambda = motorcycleEntity.isMounted ? 12.0 : 9.5;
        currentCamPos.x = THREE.MathUtils.damp(currentCamPos.x, _desiredCamPos.x, followLambda, rawDt);
        currentCamPos.y = THREE.MathUtils.damp(currentCamPos.y, _desiredCamPos.y, followLambda, rawDt);
        currentCamPos.z = THREE.MathUtils.damp(currentCamPos.z, _desiredCamPos.z, followLambda, rawDt);
        currentCamPos.y = Math.max(0.35, currentCamPos.y);
      }

      // Aplicar ruido de Camera Shake si está activo
      _shakeOffset.set(0, 0, 0);
      if (shakeTimer > 0) {
        if (!timeManager.isPaused) {
          shakeTimer = Math.max(0, shakeTimer - rawDt);
        }
        const decay = shakeDuration > 0 ? shakeTimer / shakeDuration : 0;
        const mag = shakeIntensity * decay;
        _shakeOffset.set(
          (Math.random() * 2 - 1) * mag,
          (Math.random() * 2 - 1) * mag * 0.85,
          (Math.random() * 2 - 1) * mag
        );
        if (shakeTimer === 0) {
          shakeIntensity = 0;
        }
      }

      camera.position.copy(currentCamPos).add(_shakeOffset);
      camera.lookAt(currentLookAt);

      // 7. EngineRaycaster unificado: Puerta o Motocicleta (o desmontar si está montado)
      if (motorcycleEntity.isMounted) {
        interactTargetType = 'dismount';
        interactPrompt = 'Presiona E para bajar de la moto';
      } else {
        _playerRayOrigin.set(
          playerEntity.interpolatedPosition.x,
          focusBaseY + 1.15,
          playerEntity.interpolatedPosition.z
        );
        const hit = engineRaycaster.castFromCameraCenter(
          camera,
          allInteractTargets,
          VEHICLE_CONFIG.interactDistance,
          _playerRayOrigin
        );
        if (hit) {
          const hitType = hit.object.userData.interactType as InteractTargetType;
          const distToPlayer = hit.point.distanceTo(_playerRayOrigin);
          if (hitType === 'motorcycle' && distToPlayer <= VEHICLE_CONFIG.interactDistance) {
            interactTargetType = 'motorcycle';
            interactPrompt = 'Presiona E para subir a la moto';
          } else if (hitType === 'door' && distToPlayer <= DOOR_CONFIG.interactDistance) {
            interactTargetType = 'door';
            interactPrompt = doorEntity.doorOpen
              ? 'Presiona E para cerrar la puerta'
              : 'Presiona E para abrir la puerta';
          } else {
            interactTargetType = null;
            interactPrompt = null;
          }
        } else {
          interactTargetType = null;
          interactPrompt = null;
        }
      }

      const speedKmh = Math.round(Math.abs(motorcycleEntity.currentForwardSpeed) * 3.6);
      const viewLabel = cameraMode === 'FPS' ? 'Primera Persona' : activePreset.label;
      const stateKey = `${playerEntity.reportedAnim}|${playerEntity.isGrounded}|${viewLabel}|${cameraMode}|${timeManager.timeScale}|${playerEntity.health}|${playerEntity.isWaving}|${motorcycleEntity.isMounted}|${speedKmh}|${interactTargetType}|${doorEntity.doorOpen}`;
      if (stateKey !== lastReportedKey) {
        lastReportedKey = stateKey;
        onStateChangeRef.current({
          animState: playerEntity.reportedAnim,
          grounded: playerEntity.isGrounded,
          viewLabel,
          cameraMode,
          timeScale: timeManager.timeScale,
          health: playerEntity.health,
          isWaving: playerEntity.isWaving,
          isMounted: motorcycleEntity.isMounted,
          vehicleSpeedKmh: speedKmh,
          interactPrompt,
          interactType: interactTargetType,
          doorOpen: doorEntity.doorOpen,
        });
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (isSoftwareGl) {
      tick();
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);

      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener(
        'webglcontextlost',
        handleContextLost
      );
      renderer.domElement.removeEventListener(
        'webglcontextrestored',
        handleContextRestored
      );

      audioManager.dispose();
      entityManager.clear();
      disposableGeometries.forEach((g) => g.dispose());
      disposableMaterials.forEach((m) => m.dispose());
      envTexture.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="h-full w-full" />;
});
