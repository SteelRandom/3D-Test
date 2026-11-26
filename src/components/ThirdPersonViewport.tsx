import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as CANNON from 'cannon-es';
import {
  CAMERA_VIEWS,
  DOOR_CONFIG,
  HONDA_MTL_URL,
  HONDA_OBJ_URL,
  PHYSICS_CONFIG,
  SCENE_COLORS,
  SOLDIER_MODEL_URL,
  VEHICLE_CONFIG,
} from '../scene/courseConfig';
import { Entity, EntityManager } from '../engine/EntityManager';
import { TimeManager } from '../engine/TimeManager';
import { AudioManager } from '../engine/AudioManager';
import { modelCacheManager } from '../engine/ModelCacheManager';
import {
  buildOptimizedHondaRig,
  createHondaMasterMaterials,
  HondaOptStats,
  resolveHondaPartVisual,
} from '../engine/hondaOptimizer';
import {
  BUILTIN_MAPS,
  MapDoorJSON,
  normalizeMapJSON,
  NormalizedMapJSON,
} from '../engine/levelData';

export type CharacterAnimState = 'Idle' | 'Walk' | 'Run' | 'Jump' | 'Drive' | 'Ragdoll';
export type CameraMode = 'TPS' | 'FPS';
export type InteractTargetType = 'door' | 'motorcycle' | 'dismount' | null;
export type QualityPreset = 'low' | 'medium' | 'high';

export interface TestModelLoadOptions {
  position?: [number, number, number];
  targetSize?: number;
  castShadow?: boolean;
  replacePrevious?: boolean;
}

export interface TriggerConfig {
  id: string;
  label: string;
  position: [number, number, number];
  size: [number, number, number];
  color?: number | string;
  once?: boolean;
  visible?: boolean;
  onEnter?: (ctx: { actorType: 'player' | 'motorcycle'; body: CANNON.Body }) => void;
  onStay?: (ctx: { actorType: 'player' | 'motorcycle'; body: CANNON.Body }, dt: number) => void;
  onExit?: (ctx: { actorType: 'player' | 'motorcycle' }) => void;
}

export interface ViewportStateSnapshot {
  animState: CharacterAnimState;
  grounded: boolean;
  viewLabel: string;
  cameraMode: CameraMode;
  freeCam: boolean;
  timeScale: number;
  health: number;
  isWaving: boolean;
  isMounted: boolean;
  vehicleSpeedKmh: number;
  interactPrompt: string | null;
  interactType: InteractTargetType;
  doorOpen: boolean;
  hondaParts: string[];
  fps: number;
  drawCalls: number;
  triangles: number;
  hondaOptStats: HondaOptStats | null;
  modelCacheStatus: string;
  qualityPreset: QualityPreset;
  activeMapName: string;
  playerXYZ: [number, number, number];
  camXYZ: [number, number, number];
  lastTrigger: string | null;
  saveStatus: string | null;
  testModelStatus: string | null;
}

export interface ThirdPersonViewportHandle {
  resetPlayer: () => void;
  triggerJump: () => void;
  setJoystick: (x: number, y: number, active: boolean) => void;
  cycleCameraView: () => void;
  toggleWave: () => void;
  interact: () => void;
  toggleCameraMode: () => void;
  toggleFreeCam: () => void;
  togglePause: () => void;
  toggleSlowMotion: () => void;
  quickSave: () => boolean;
  quickLoad: () => boolean;
  loadTestModel: (url: string, options?: TestModelLoadOptions) => void;
  clearTestModel: () => void;
  loadMapFromJSON: (mapData: unknown) => { ok: boolean; error?: string; name?: string };
  setQualityPreset: (preset: QualityPreset) => void;
  clearModelCache: () => Promise<void>;
  getPositionCopyPayload: () => {
    playerPos: [number, number, number];
    camPos: [number, number, number];
    colliderJson: string;
  };
}

interface ThirdPersonViewportProps {
  onLoadProgress: (progress: number, loaded: boolean, error: string | null) => void;
  onStateChange: (state: ViewportStateSnapshot) => void;
  onContextLostChange?: (lost: boolean) => void;
  initialMap?: unknown;
  initialQuality?: QualityPreset;
  cameraSensitivity?: number;
  audioVolume?: number;
}

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
const _bikeUp = new THREE.Vector3();
const _bikeFwdHoriz = new THREE.Vector3();
const _bikeRightHoriz = new THREE.Vector3();
const _bikeQuat = new THREE.Quaternion();
const _bikeEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _dismountOffset = new THREE.Vector3();
const _rayFrom = new CANNON.Vec3();
const _rayTo = new CANNON.Vec3();
const _cannonYAxis = new CANNON.Vec3(0, 1, 0);
const _forceVec = new CANNON.Vec3();
const _torqueVec = new CANNON.Vec3();
const _hubLocal = new THREE.Vector3();
const _hubWorld = new THREE.Vector3();
const _hubRel = new CANNON.Vec3();
const _wheelPt = new CANNON.Vec3();
const _wheelVel = new CANNON.Vec3();
const _zeroRelVec = new CANNON.Vec3(0, 0, 0);
const _hitNormal = new THREE.Vector3();
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
const _dismountPos = new THREE.Vector3();
const _tmpBox3A = new THREE.Box3();
const _tmpVec3A = new THREE.Vector3();
const _tmpVec3B = new THREE.Vector3();
const _freeCamDir = new THREE.Vector3();
const _freeCamRight = new THREE.Vector3();
const _freeCamEuler = new THREE.Euler(0, 0, 0, 'YXZ');

const QUICKSAVE_STORAGE_KEY = 'engine3d_quicksave_v1';
const UPPER_BODY_MASK_REGEX = /spine|neck|head|shoulder|arm|forearm|hand/i;

interface BoneRigEntry {
  bone: THREE.Bone;
  pitchAxis: THREE.Vector3;
  rollAxis: THREE.Vector3;
  yawAxis: THREE.Vector3;
}

interface CharacterBoneRig {
  hips?: BoneRigEntry;
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
  spine2?: BoneRigEntry;
  head?: BoneRigEntry;
}

interface TposeBoneSnapshot {
  bone: THREE.Bone;
  quat: THREE.Quaternion;
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

function detectTouchCapable(): boolean {
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
  );
}

function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  let diff = (target - current) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * (1 - Math.exp(-lambda * dt));
}

function normalizeBoneName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(mixamorig|rig|bip\d*|armature)[:_\-.]*/i, '')
    .replace(/[^a-z0-9]/g, '');
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

function captureTposeSnapshots(model: THREE.Object3D): TposeBoneSnapshot[] {
  const snaps: TposeBoneSnapshot[] = [];
  model.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) {
      const bone = obj as THREE.Bone;
      snaps.push({ bone, quat: bone.quaternion.clone() });
    }
  });
  return snaps;
}

function buildCharacterBoneRig(model: THREE.Object3D): CharacterBoneRig {
  model.updateMatrixWorld(true);
  const rig: CharacterBoneRig = {};
  const bones: Array<{ bone: THREE.Bone; norm: string }> = [];
  model.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) {
      const bone = obj as THREE.Bone;
      bones.push({ bone, norm: normalizeBoneName(bone.name) });
    }
  });

  const findExact = (patterns: string[]) =>
    bones.find((b) => patterns.some((p) => b.norm === p))?.bone ??
    bones.find((b) => patterns.some((p) => b.norm.includes(p)))?.bone;

  const hips = findExact(['hips', 'pelvis', 'rootmotion']);
  const leftUpLeg = findExact(['leftupleg', 'leftthigh', 'thighl', 'upperlegl']);
  const rightUpLeg = findExact(['rightupleg', 'rightthigh', 'thighr', 'upperlegr']);
  const leftLeg =
    bones.find((b) => b.norm === 'leftleg' || b.norm === 'leftcalf' || b.norm === 'shinl')?.bone ??
    bones.find((b) => (b.norm.includes('leftleg') || b.norm.includes('leftcalf')) && !b.norm.includes('upleg'))?.bone;
  const rightLeg =
    bones.find((b) => b.norm === 'rightleg' || b.norm === 'rightcalf' || b.norm === 'shinr')?.bone ??
    bones.find((b) => (b.norm.includes('rightleg') || b.norm.includes('rightcalf')) && !b.norm.includes('upleg'))?.bone;
  const leftFoot = findExact(['leftfoot', 'footl']);
  const rightFoot = findExact(['rightfoot', 'footr']);

  const leftArm =
    bones.find((b) => b.norm === 'leftarm' || b.norm === 'leftupperarm' || b.norm === 'upperarml')?.bone ??
    bones.find((b) => (b.norm.includes('leftarm') || b.norm.includes('leftupperarm')) && !b.norm.includes('forearm'))?.bone;
  const rightArm =
    bones.find((b) => b.norm === 'rightarm' || b.norm === 'rightupperarm' || b.norm === 'upperarmr')?.bone ??
    bones.find((b) => (b.norm.includes('rightarm') || b.norm.includes('rightupperarm')) && !b.norm.includes('forearm'))?.bone;
  const leftForeArm = findExact(['leftforearm', 'leftlowerarm', 'forearml', 'lowerarml']);
  const rightForeArm = findExact(['rightforearm', 'rightlowerarm', 'forearmr', 'lowerarmr']);
  const leftHand = findExact(['lefthand', 'handl']);
  const rightHand = findExact(['righthand', 'handr']);

  const spine = bones.find((b) => b.norm === 'spine')?.bone;
  const spine1 = bones.find((b) => b.norm === 'spine1' || b.norm === 'chest')?.bone;
  const spine2 = bones.find((b) => b.norm === 'spine2' || b.norm === 'upperchest')?.bone;
  const head = bones.find((b) => b.norm === 'head')?.bone;

  if (hips) rig.hips = makeBoneRigEntry(hips);
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
  if (spine2) rig.spine2 = makeBoneRigEntry(spine2);
  if (head) rig.head = makeBoneRigEntry(head);

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
  if (Math.abs(yaw) > 0.001) {
    _deltaQuat2.setFromAxisAngle(entry.yawAxis, yaw);
    entry.bone.quaternion.multiply(_deltaQuat2);
  }
  if (Math.abs(roll) > 0.001) {
    _deltaQuat3.setFromAxisAngle(entry.rollAxis, roll);
    entry.bone.quaternion.multiply(_deltaQuat3);
  }
  if (Math.abs(pitch) > 0.001) {
    _deltaQuat.setFromAxisAngle(entry.pitchAxis, pitch);
    entry.bone.quaternion.multiply(_deltaQuat);
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
  steerAngle: number,
  fallbackHeadingGroup?: THREE.Group
) {
  if (!rig.leftArm && !rig.rightArm && !rig.leftUpLeg && !rig.rightUpLeg) {
    if (fallbackHeadingGroup) {
      fallbackHeadingGroup.rotation.x = -0.18;
      fallbackHeadingGroup.traverse((obj) => {
        const n = obj.name.toLowerCase();
        if (n.includes('arm') || n.includes('brazo')) {
          obj.rotation.x = 1.05;
        } else if (n.includes('leg') || n.includes('pierna')) {
          obj.rotation.x = 0.85;
        }
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

function aimRigBoneTowardLocalDir(
  entry: BoneRigEntry | undefined,
  restX: number,
  restY: number,
  restZ: number,
  targetX: number,
  targetY: number,
  targetZ: number,
  blend = 0.85
) {
  if (!entry) return;
  _ragRestDir
    .set(0, 0, 0)
    .addScaledVector(entry.pitchAxis, restX)
    .addScaledVector(entry.yawAxis, restY)
    .addScaledVector(entry.rollAxis, restZ);
  _ragTargetDir
    .set(0, 0, 0)
    .addScaledVector(entry.pitchAxis, targetX)
    .addScaledVector(entry.yawAxis, targetY)
    .addScaledVector(entry.rollAxis, targetZ);
  if (_ragRestDir.lengthSq() < 0.0001 || _ragTargetDir.lengthSq() < 0.0001) return;
  _ragRestDir.normalize();
  _ragTargetDir.normalize();
  _ragDeltaQuat.setFromUnitVectors(_ragRestDir, _ragTargetDir);
  if (blend < 0.999) {
    _ragDeltaQuat.slerp(_ragIdentityQuat, 1 - blend);
  }
  entry.bone.quaternion.multiply(_ragDeltaQuat);
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
}

function buildProceduralMotorcycle(
  disposableGeometries: THREE.BufferGeometry[],
  disposableMaterials: THREE.Material[]
): ProceduralMotorcycleRig {
  const visualRoot = new THREE.Group();

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

  const tagMesh = (mesh: THREE.Mesh, cast = false) => {
    mesh.castShadow = cast;
    mesh.receiveShadow = cast;
    mesh.userData.interactType = 'motorcycle';
    return mesh;
  };

  const boxHalfY = VEHICLE_CONFIG.boxSize[1] / 2;
  const wheelR = VEHICLE_CONFIG.wheelRadius;
  const axleY = -boxHalfY + wheelR;

  const createWheel = (width: number) => {
    const wheelGroup = new THREE.Group();
    const tireGeo = trackGeo(new THREE.TorusGeometry(wheelR - 0.065, 0.068, 12, 26));
    tireGeo.rotateY(Math.PI / 2);
    wheelGroup.add(tagMesh(new THREE.Mesh(tireGeo, tireMat), false));

    const rimGeo = trackGeo(new THREE.CylinderGeometry(wheelR - 0.11, wheelR - 0.11, width * 0.75, 16));
    rimGeo.rotateZ(Math.PI / 2);
    wheelGroup.add(tagMesh(new THREE.Mesh(rimGeo, alloyMat), false));

    const spokeGeo = trackGeo(new THREE.BoxGeometry(width * 0.8, 0.025, (wheelR - 0.1) * 1.9));
    for (let s = 0; s < 3; s++) {
      const spoke = tagMesh(new THREE.Mesh(spokeGeo, frameMat), false);
      spoke.rotation.x = (s * Math.PI) / 3;
      wheelGroup.add(spoke);
    }
    return wheelGroup;
  };

  const rearWheelSpin = createWheel(0.16);
  rearWheelSpin.position.set(0, axleY, 0.7);
  visualRoot.add(rearWheelSpin);

  const engineBlock = tagMesh(new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.34, 0.46)), frameMat), true);
  engineBlock.position.set(0, axleY + 0.22, -0.02);
  visualRoot.add(engineBlock);

  const swingarm = tagMesh(new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.07, 0.66)), alloyMat));
  swingarm.position.set(0, axleY + 0.06, 0.4);
  visualRoot.add(swingarm);

  const exhaustGeo = trackGeo(new THREE.CylinderGeometry(0.038, 0.048, 0.84, 12));
  exhaustGeo.rotateX(Math.PI / 2);
  const exhaust = tagMesh(new THREE.Mesh(exhaustGeo, alloyMat));
  exhaust.position.set(0.21, axleY + 0.04, 0.38);
  exhaust.rotation.x = -0.12;
  visualRoot.add(exhaust);

  const tank = tagMesh(new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.36, 0.24, 0.52)), bodyPaintMat), true);
  tank.position.set(0, axleY + 0.48, -0.18);
  tank.rotation.x = 0.14;
  visualRoot.add(tank);

  const seat = tagMesh(new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.29, 0.11, 0.54)), seatMat), true);
  seat.position.set(0, axleY + 0.43, 0.25);
  seat.rotation.x = -0.05;
  visualRoot.add(seat);

  const tailBody = tagMesh(new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.12, 0.38)), bodyPaintMat));
  tailBody.position.set(0, axleY + 0.46, 0.62);
  tailBody.rotation.x = -0.18;
  visualRoot.add(tailBody);

  const tailLight = tagMesh(new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.05, 0.05)), tailLightMat));
  tailLight.position.set(0, axleY + 0.48, 0.81);
  visualRoot.add(tailLight);

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

  const frontWheelSpin = createWheel(0.13);
  frontWheelSpin.position.set(0, -0.46, -0.24);
  frontForkPivot.add(frontWheelSpin);

  const handlebarCross = tagMesh(new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.018, 0.018, 0.68, 10)), alloyMat));
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

  const dashPod = tagMesh(new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.07, 0.08)), dashMat));
  dashPod.position.set(0, 0.22, -0.06);
  dashPod.rotation.x = -0.55;
  frontForkPivot.add(dashPod);

  const headlight = tagMesh(new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.09, 0.09, 0.09, 16)), headlightMat));
  headlight.rotation.x = Math.PI / 2;
  headlight.position.set(0, 0.07, -0.14);
  frontForkPivot.add(headlight);

  return {
    visualRoot,
    frontForkPivot,
    frontWheelSpin,
    rearWheelSpin,
  };
}

interface InternalTriggerZone {
  id: string;
  label: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  once: boolean;
  firedOnce: boolean;
  inside: boolean;
  onEnter?: TriggerConfig['onEnter'];
  onStay?: TriggerConfig['onStay'];
  onExit?: TriggerConfig['onExit'];
  mesh?: THREE.Mesh;
}

class TriggerSystem {
  private readonly zones: InternalTriggerZone[] = [];
  private readonly targetGroup: THREE.Group;
  private readonly disposableGeometries: THREE.BufferGeometry[];
  private readonly disposableMaterials: THREE.Material[];

  constructor(
    targetGroup: THREE.Group,
    disposableGeometries: THREE.BufferGeometry[],
    disposableMaterials: THREE.Material[]
  ) {
    this.targetGroup = targetGroup;
    this.disposableGeometries = disposableGeometries;
    this.disposableMaterials = disposableMaterials;
  }

  public createTrigger(cfg: TriggerConfig): InternalTriggerZone {
    const [px, py, pz] = cfg.position;
    const [sx, sy, sz] = cfg.size;
    let mesh: THREE.Mesh | undefined;
    if (cfg.visible) {
      const geo = new THREE.BoxGeometry(sx, sy, sz);
      const mat = new THREE.MeshBasicMaterial({
        color: cfg.color ?? 0x0ea5e9,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      });
      this.disposableGeometries.push(geo);
      this.disposableMaterials.push(mat);
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(px, py, pz);
      this.targetGroup.add(mesh);
    }

    const zone: InternalTriggerZone = {
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
      mesh,
    };
    this.zones.push(zone);
    return zone;
  }

  public clear(): void {
    this.zones.length = 0;
  }

  public update(
    actorType: 'player' | 'motorcycle',
    body: CANNON.Body,
    dt: number
  ): void {
    const ax = body.position.x;
    const ay = body.position.y;
    const az = body.position.z;
    for (let i = 0; i < this.zones.length; i++) {
      const z = this.zones[i];
      if (z.once && z.firedOnce) continue;
      const isInside =
        ax >= z.minX &&
        ax <= z.maxX &&
        ay >= z.minY &&
        ay <= z.maxY &&
        az >= z.minZ &&
        az <= z.maxZ;
      if (isInside && !z.inside) {
        z.inside = true;
        if (z.once) z.firedOnce = true;
        z.onEnter?.({ actorType, body });
      } else if (isInside && z.inside) {
        z.onStay?.({ actorType, body }, dt);
      } else if (!isInside && z.inside) {
        z.inside = false;
        z.onExit?.({ actorType });
      }
    }
  }

  public reset(): void {
    for (let i = 0; i < this.zones.length; i++) {
      this.zones[i].inside = false;
      this.zones[i].firedOnce = false;
    }
  }
}

class DoorEntity extends Entity {
  public doorOpen = false;
  public currentAngle = 0;
  public readonly doorRoot: THREE.Group;
  public readonly pivot: THREE.Group;
  public readonly leafMesh: THREE.Mesh;
  public readonly handleMesh: THREE.Mesh;
  public readonly leafBody: CANNON.Body;
  public readonly interactTargets: THREE.Object3D[];

  private readonly world: CANNON.World;
  private readonly parentGroup: THREE.Group;
  private readonly frameBodies: CANNON.Body[] = [];
  private readonly doorX: number;
  private readonly doorY: number;
  private readonly doorZ: number;
  private readonly rotY: number;
  private readonly openW: number;
  private readonly openH: number;
  private readonly audio: AudioManager;

  constructor(
    cfg: MapDoorJSON,
    parentGroup: THREE.Group,
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
    this.world = world;
    this.parentGroup = parentGroup;
    this.audio = audio;

    const [doorX, doorY, doorZ] = cfg.pos;
    const [sizeW, sizeH, sizeT] = cfg.size ?? [
      DOOR_CONFIG.openingWidth,
      DOOR_CONFIG.openingHeight,
      DOOR_CONFIG.leafThickness,
    ];
    this.rotY = Array.isArray(cfg.rot) ? cfg.rot[1] : cfg.rot ?? 0;

    this.doorX = doorX;
    this.doorY = doorY;
    this.doorZ = doorZ;
    this.openW = sizeW;
    this.openH = sizeH;
    const frameT = DOOR_CONFIG.frameThickness;
    const frameD = DOOR_CONFIG.frameDepth;
    const leafT = sizeT;

    this.doorRoot = new THREE.Group();
    this.doorRoot.position.set(doorX, doorY, doorZ);
    this.doorRoot.rotation.y = this.rotY;
    parentGroup.add(this.doorRoot);

    const postGeo = new THREE.BoxGeometry(frameT, this.openH, frameD);
    const lintelGeo = new THREE.BoxGeometry(this.openW + frameT * 2, frameT, frameD);
    const leafGeo = new THREE.BoxGeometry(this.openW, this.openH, leafT);
    const handleGeo = new THREE.BoxGeometry(0.14, 0.04, leafT + 0.08);
    disposableGeometries.push(postGeo, lintelGeo, leafGeo, handleGeo);

    const leftPostMesh = new THREE.Mesh(postGeo, materials.doorFrame);
    leftPostMesh.position.set(-this.openW / 2 - frameT / 2, this.openH / 2, 0);
    leftPostMesh.castShadow = true;
    leftPostMesh.receiveShadow = true;

    const rightPostMesh = new THREE.Mesh(postGeo, materials.doorFrame);
    rightPostMesh.position.set(this.openW / 2 + frameT / 2, this.openH / 2, 0);
    rightPostMesh.castShadow = true;
    rightPostMesh.receiveShadow = true;

    const lintelMesh = new THREE.Mesh(lintelGeo, materials.doorFrame);
    lintelMesh.position.set(0, this.openH + frameT / 2, 0);
    lintelMesh.castShadow = true;
    lintelMesh.receiveShadow = true;

    this.doorRoot.add(leftPostMesh, rightPostMesh, lintelMesh);
    cameraColliders.push(leftPostMesh, rightPostMesh, lintelMesh);

    const cosY = Math.cos(this.rotY);
    const sinY = Math.sin(this.rotY);
    const addFrameBody = (lx: number, ly: number, lz: number, sx: number, sy: number, sz: number) => {
      const b = new CANNON.Body({
        mass: 0,
        material: groundPhysMat,
        shape: new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)),
      });
      b.position.set(
        doorX + lx * cosY + lz * sinY,
        doorY + ly,
        doorZ - lx * sinY + lz * cosY
      );
      b.quaternion.setFromAxisAngle(_cannonYAxis, this.rotY);
      world.addBody(b);
      this.frameBodies.push(b);
    };
    addFrameBody(-this.openW / 2 - frameT / 2, this.openH / 2, 0, frameT, this.openH, frameD);
    addFrameBody(this.openW / 2 + frameT / 2, this.openH / 2, 0, frameT, this.openH, frameD);
    addFrameBody(0, this.openH + frameT / 2, 0, this.openW + frameT * 2, frameT, frameD);

    this.pivot = new THREE.Group();
    this.pivot.position.set(-this.openW / 2, 0, 0);
    this.doorRoot.add(this.pivot);

    this.leafMesh = new THREE.Mesh(leafGeo, materials.doorLeaf);
    this.leafMesh.position.set(this.openW / 2, this.openH / 2, 0);
    this.leafMesh.castShadow = true;
    this.leafMesh.receiveShadow = true;
    this.leafMesh.userData.interactType = 'door';
    this.leafMesh.userData.doorEntity = this;
    this.pivot.add(this.leafMesh);
    cameraColliders.push(this.leafMesh);

    this.handleMesh = new THREE.Mesh(handleGeo, materials.doorHandle);
    this.handleMesh.position.set(this.openW - 0.18, 1.05, 0);
    this.handleMesh.castShadow = false;
    this.handleMesh.userData.interactType = 'door';
    this.handleMesh.userData.doorEntity = this;
    this.pivot.add(this.handleMesh);

    this.leafBody = new CANNON.Body({
      mass: 0,
      material: groundPhysMat,
      shape: new CANNON.Box(new CANNON.Vec3(this.openW / 2, this.openH / 2, leafT / 2)),
    });
    this.syncBodyTransform(0);
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

  public override destroy(): void {
    this.parentGroup.remove(this.doorRoot);
    this.world.removeBody(this.leafBody);
    for (let i = 0; i < this.frameBodies.length; i++) {
      this.world.removeBody(this.frameBodies[i]);
    }
    this.frameBodies.length = 0;
  }

  private syncBodyTransform(angle: number): void {
    const totalYaw = this.rotY + angle;
    const hingeWx = this.doorX - (this.openW / 2) * Math.cos(this.rotY);
    const hingeWz = this.doorZ + (this.openW / 2) * Math.sin(this.rotY);
    const halfW = this.openW / 2;
    this.leafBody.position.set(
      hingeWx + halfW * Math.cos(totalYaw),
      this.doorY + this.openH / 2,
      hingeWz - halfW * Math.sin(totalYaw)
    );
    this.leafBody.quaternion.setFromAxisAngle(_cannonYAxis, totalYaw);
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
  throttle: number;
  steer: number;
}

class MotorcycleEntity extends Entity {
  public readonly body: CANNON.Body;
  public readonly group: THREE.Group;
  public readonly leanGroup: THREE.Group;
  public readonly wheeliePivot: THREE.Group;
  public readonly bikeOffsetGroup: THREE.Group;
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
  public smoothYawRate = 0;
  public leanAngle = 0;
  public wheelieAngle = 0;
  public headingYaw: number = VEHICLE_CONFIG.spawnYaw;
  public detectedParts: string[] = [];
  public optStats: HondaOptStats | null = null;

  private spawnPos: [number, number, number] = [...VEHICLE_CONFIG.spawnPosition];
  private spawnYaw: number = VEHICLE_CONFIG.spawnYaw;
  private wheelSpinAngle = 0;
  private frontWheelSpinAngle = 0;
  private minAirborneVy = 0;
  private prevMountedSpeed = 0;
  private wasWheelieActive = false;
  private wheelieTargetPitch = 0;
  private isGrounded = true;
  private frontGrounded = true;
  private rearGrounded = true;
  private frontCompression = 0.075;
  private rearCompression = 0.075;
  private rearAxleZ = 0.622;
  private pendingWipeoutReason: 'wheelie' | 'crash' | null = null;

  private proceduralRig: ProceduralMotorcycleRig;
  private modelRoot: THREE.Object3D | null = null;
  private modelFrontWheel: THREE.Object3D | null = null;
  private modelRearWheel: THREE.Object3D | null = null;
  private modelFork: THREE.Object3D | null = null;
  private frontWheelBaseY = 0;
  private rearWheelBaseY = 0;
  private procFrontWheelBaseY = 0;
  private procRearWheelBaseY = 0;

  private readonly world: CANNON.World;
  private readonly driveInput: VehicleDriveInput;
  private readonly onHardLanding: (impactVy: number) => void;
  private readonly onWipeout: (
    reason: 'wheelie' | 'crash',
    riderWorldPos: THREE.Vector3,
    riderWorldQuat: THREE.Quaternion,
    inheritVel: THREE.Vector3,
    ejectVel: THREE.Vector3
  ) => void;
  private readonly audio: AudioManager;

  // Parámetros de suspensión de 2 ruedas
  private readonly wheelRestLength = 0.54;
  private readonly suspStiffness = 13800;
  private readonly suspDampCompress = 1850;
  private readonly suspDampRelax = 2150;
  private readonly eqCompression = 0.075;

  constructor(
    scene: THREE.Scene,
    world: CANNON.World,
    vehiclePhysMat: CANNON.Material,
    driveInput: VehicleDriveInput,
    disposableGeometries: THREE.BufferGeometry[],
    disposableMaterials: THREE.Material[],
    onHardLanding: (impactVy: number) => void,
    onWipeout: (
      reason: 'wheelie' | 'crash',
      riderWorldPos: THREE.Vector3,
      riderWorldQuat: THREE.Quaternion,
      inheritVel: THREE.Vector3,
      ejectVel: THREE.Vector3
    ) => void,
    audio: AudioManager
  ) {
    super('motorcycle');
    this.world = world;
    this.driveInput = driveInput;
    this.onHardLanding = onHardLanding;
    this.onWipeout = onWipeout;
    this.audio = audio;

    const [sx, sy, sz] = VEHICLE_CONFIG.boxSize;
    const [px, py, pz] = this.spawnPos;

    // Caja protectora de chasis elevada +0.14m + topes esféricos de rueda sin fricción para evitar incrustación en suelo
    this.body = new CANNON.Body({
      mass: VEHICLE_CONFIG.mass,
      material: vehiclePhysMat,
      allowSleep: false,
      linearDamping: 0.01,
      angularDamping: 0.16,
    });
    this.body.angularFactor.set(1, 1, 1);
    this.body.addShape(
      new CANNON.Box(new CANNON.Vec3(sx * 0.44, sy * 0.27, sz * 0.47)),
      new CANNON.Vec3(0, 0.14, 0)
    );
    const wheelGuardShape = new CANNON.Sphere(0.24);
    this.body.addShape(wheelGuardShape, new CANNON.Vec3(0, -0.22, -0.65));
    this.body.addShape(wheelGuardShape, new CANNON.Vec3(0, -0.22, 0.65));
    this.body.position.set(px, py, pz);
    this.body.quaternion.setFromAxisAngle(_cannonYAxis, this.spawnYaw);
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
    this.leanGroup.position.set(0, -0.484, 0);
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

    this.proceduralRig = buildProceduralMotorcycle(
      disposableGeometries,
      disposableMaterials
    );
    this.procFrontWheelBaseY = this.proceduralRig.frontWheelSpin.position.y;
    this.procRearWheelBaseY = this.proceduralRig.rearWheelSpin.position.y;
    this.bikeOffsetGroup.add(this.proceduralRig.visualRoot);
  }

  public setSpawn(pos: [number, number, number], yaw: number): void {
    this.spawnPos = [pos[0], pos[1], pos[2]];
    this.spawnYaw = yaw;
  }

  public attachHondaObjModel(
    rawModel: THREE.Object3D,
    disposableGeometries: THREE.BufferGeometry[],
    disposableMaterials: THREE.Material[]
  ): void {
    const masterMats = createHondaMasterMaterials(disposableMaterials);
    const result = buildOptimizedHondaRig(rawModel, masterMats, disposableGeometries);

    this.detectedParts = result.partsList;
    this.optStats = result.stats;
    console.log('[Honda CB 750] Nombres únicos mesh/material:', result.partsList);
    console.log(
      `[Honda CB 750] Optimización: ${result.stats.beforeMeshes} meshes (${result.stats.beforeTriangles} tris) -> ${result.stats.afterDrawCalls} draw calls (${result.stats.afterTriangles} tris)`
    );

    this.seatAnchor.position.copy(result.seatPosition);
    this.rearAxleZ = result.rearAxleZ;
    this.wheeliePivot.position.set(0, 0, this.rearAxleZ);
    this.bikeOffsetGroup.position.set(0, VEHICLE_CONFIG.boxSize[1] / 2, -this.rearAxleZ);

    this.modelFork = result.forkPivot;
    this.modelFrontWheel = result.frontWheelSpin;
    this.modelRearWheel = result.rearWheelSpin;
    this.frontWheelBaseY = result.frontWheelSpin.position.y;
    this.rearWheelBaseY = result.rearWheelSpin.position.y;
    this.modelRoot = result.bikeRoot;
    this.proceduralRig.visualRoot.visible = false;
    this.bikeOffsetGroup.add(result.bikeRoot);
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

  public reset(pos?: [number, number, number], yaw?: number): void {
    const [px, py, pz] = pos ?? this.spawnPos;
    const yRot = yaw ?? this.spawnYaw;
    this.body.position.set(px, py, pz);
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    this.body.force.set(0, 0, 0);
    this.body.torque.set(0, 0, 0);
    this.body.quaternion.setFromAxisAngle(_cannonYAxis, yRot);
    this.currentForwardSpeed = 0;
    this.prevMountedSpeed = 0;
    this.smoothSteerAngle = 0;
    this.smoothYawRate = 0;
    this.leanAngle = 0;
    this.wheelieAngle = 0;
    this.wheelieTargetPitch = 0;
    this.wasWheelieActive = false;
    this.frontCompression = this.eqCompression;
    this.rearCompression = this.eqCompression;
    this.pendingWipeoutReason = null;
    this.headingYaw = yRot;
    this.minAirborneVy = 0;
    this.syncInterpolationBuffers();
  }

  private triggerWipeout(reason: 'wheelie' | 'crash', vFwdBefore: number): void {
    if (!this.isMounted) return;
    this.seatAnchor.updateMatrixWorld(true);
    this.seatAnchor.getWorldPosition(_wipeoutWorldPos);
    this.seatAnchor.getWorldQuaternion(_wipeoutWorldQuat);

    _bikeQuat.set(
      this.body.quaternion.x,
      this.body.quaternion.y,
      this.body.quaternion.z,
      this.body.quaternion.w
    );
    _bikeFwd.set(0, 0, -1).applyQuaternion(_bikeQuat);
    _bikeFwd.y = 0;
    if (_bikeFwd.lengthSq() > 0.0001) _bikeFwd.normalize();

    const baseSpeed = Math.max(vFwdBefore, this.currentForwardSpeed);
    _wipeoutInheritVel.set(
      _bikeFwd.x * baseSpeed,
      Math.max(0, this.body.velocity.y),
      _bikeFwd.z * baseSpeed
    );
    if (reason === 'wheelie') {
      _wipeoutEjectVel.set(-_bikeFwd.x * 1.4, 3.4, -_bikeFwd.z * 1.4);
    } else {
      _wipeoutEjectVel.set(_bikeFwd.x * 3.8, 4.1, _bikeFwd.z * 3.8);
    }

    this.isMounted = false;
    this.wasWheelieActive = false;
    this.wheelieTargetPitch = 0;
    this.pendingWipeoutReason = reason;
  }

  private applyWheelSuspension(
    localZ: number,
    prevComp: number,
    fixedDt: number,
    disableContact: boolean
  ): { hit: boolean; compression: number; normalY: number } {
    if (disableContact) {
      return { hit: false, compression: 0, normalY: 1 };
    }
    _hubLocal.set(0, -0.02, localZ).applyQuaternion(_bikeQuat);
    _hubWorld.set(
      this.body.position.x + _hubLocal.x,
      this.body.position.y + _hubLocal.y,
      this.body.position.z + _hubLocal.z
    );

    const probeMargin = 0.28;
    _rayDir.set(-_bikeUp.x * 0.16, -0.84 - _bikeUp.y * 0.16, -_bikeUp.z * 0.16).normalize();
    _rayFrom.set(
      _hubWorld.x - _rayDir.x * probeMargin,
      _hubWorld.y - _rayDir.y * probeMargin,
      _hubWorld.z - _rayDir.z * probeMargin
    );
    const castReach = this.wheelRestLength + 0.06;
    _rayTo.set(
      _hubWorld.x + _rayDir.x * castReach,
      _hubWorld.y + _rayDir.y * castReach,
      _hubWorld.z + _rayDir.z * castReach
    );

    let closestDist = Infinity;
    let hitNormalX = 0;
    let hitNormalY = 1;
    let hitNormalZ = 0;
    const totalRayLen = probeMargin + castReach;

    this.world.raycastAll(_rayFrom, _rayTo, { skipBackfaces: true }, (res) => {
      if (
        res.body &&
        res.body !== this.body &&
        res.body.collisionFilterGroup !== 2 &&
        res.hitNormalWorld.y > 0.25 &&
        res.distance < closestDist
      ) {
        closestDist = res.distance;
        hitNormalX = res.hitNormalWorld.x;
        hitNormalY = res.hitNormalWorld.y;
        hitNormalZ = res.hitNormalWorld.z;
      }
    });

    if (!Number.isFinite(closestDist) || closestDist > totalRayLen) {
      return { hit: false, compression: 0, normalY: 1 };
    }

    const groundDist = Math.max(0, closestDist - probeMargin);
    const compression = THREE.MathUtils.clamp(
      this.wheelRestLength - groundDist,
      0,
      this.wheelRestLength
    );

    _wheelPt.set(_hubWorld.x, _hubWorld.y, _hubWorld.z);
    this.body.getVelocityAtWorldPoint(_wheelPt, _wheelVel);
    const compRate =
      fixedDt > 0 ? (compression - prevComp) / fixedDt : -_wheelVel.y;
    const vVert = _wheelVel.y;
    const dampingCoeff =
      vVert < 0 || compRate > 0 ? this.suspDampCompress : this.suspDampRelax;

    const springForce = THREE.MathUtils.clamp(
      this.suspStiffness * compression - dampingCoeff * vVert,
      0,
      6500
    );

    // Mezcla vertical estable con normal de rampa para absorber baches sin deslizamiento lateral falso
    _hitNormal.set(hitNormalX * 0.3, hitNormalY * 0.3 + 0.7, hitNormalZ * 0.3).normalize();
    _forceVec.set(
      _hitNormal.x * springForce,
      _hitNormal.y * springForce,
      _hitNormal.z * springForce
    );
    _hubRel.set(_hubLocal.x, _hubLocal.y, _hubLocal.z);
    this.body.applyForce(_forceVec, _hubRel);

    return { hit: true, compression, normalY: hitNormalY };
  }

  public fixedUpdate(fixedDt: number): void {
    this.previousPosition.set(this.body.position.x, this.body.position.y, this.body.position.z);
    this.previousQuaternion.set(
      this.body.quaternion.x,
      this.body.quaternion.y,
      this.body.quaternion.z,
      this.body.quaternion.w
    );

    _bikeQuat.set(
      this.body.quaternion.x,
      this.body.quaternion.y,
      this.body.quaternion.z,
      this.body.quaternion.w
    );
    _bikeFwd.set(0, 0, -1).applyQuaternion(_bikeQuat).normalize();
    _bikeRight.set(1, 0, 0).applyQuaternion(_bikeQuat).normalize();
    _bikeUp.set(0, 1, 0).applyQuaternion(_bikeQuat).normalize();

    const currentPitch = Math.asin(THREE.MathUtils.clamp(_bikeFwd.y, -1, 1));
    const currentRoll = Math.atan2(_bikeRight.y, _bikeUp.y);

    if (this.isMounted && Math.abs(currentRoll) > 1.18) {
      this.triggerWipeout('crash', Math.abs(this.currentForwardSpeed));
      return;
    }

    // 1. Suspensión independiente delantera y trasera simétrica respecto al centro de masa
    const rearRes = this.applyWheelSuspension(
      0.65,
      this.rearCompression,
      fixedDt,
      false
    );
    // Si hace caballito pronunciado, despega la suspensión delantera
    const frontRes = this.applyWheelSuspension(
      -0.65,
      this.frontCompression,
      fixedDt,
      currentPitch > 0.24
    );

    this.frontCompression = frontRes.compression;
    this.rearCompression = rearRes.compression;
    this.frontGrounded = frontRes.hit;
    this.rearGrounded = rearRes.hit;

    const wasGrounded = this.isGrounded;
    if (!wasGrounded) {
      this.minAirborneVy = Math.min(this.minAirborneVy, this.body.velocity.y);
    }

    let contactGrounded = false;
    for (let i = 0; i < this.world.contacts.length; i++) {
      const c = this.world.contacts[i];
      if (c.bi === this.body && -c.ni.y > 0.4) {
        contactGrounded = true;
        break;
      }
      if (c.bj === this.body && c.ni.y > 0.4) {
        contactGrounded = true;
        break;
      }
    }

    const touchingGround = rearRes.hit || frontRes.hit || contactGrounded;
    if (touchingGround && this.body.velocity.y <= 2.2) {
      this.isGrounded = true;
      if (!wasGrounded) {
        const impactVy = Math.min(this.minAirborneVy, this.body.velocity.y);
        if (impactVy < -7.2) {
          this.onHardLanding(impactVy);
          this.audio.playSound('land_hard', { volume: 0.85 });
          if (this.isMounted && impactVy < -12.5) {
            this.triggerWipeout('crash', this.currentForwardSpeed);
          }
        }
        this.minAirborneVy = 0;
      }
    } else {
      this.isGrounded = false;
      this.minAirborneVy = Math.min(this.minAirborneVy, this.body.velocity.y);
    }

    _bikeFwdHoriz.set(_bikeFwd.x, 0, _bikeFwd.z);
    if (_bikeFwdHoriz.lengthSq() > 0.0001) _bikeFwdHoriz.normalize();
    _bikeRightHoriz.set(_bikeRight.x, 0, _bikeRight.z);
    if (_bikeRightHoriz.lengthSq() > 0.0001) _bikeRightHoriz.normalize();

    const vx = this.body.velocity.x;
    const vz = this.body.velocity.z;
    let vFwd = vx * _bikeFwdHoriz.x + vz * _bikeFwdHoriz.z;
    let vLat = vx * _bikeRightHoriz.x + vz * _bikeRightHoriz.z;

    let pitchTorque = 0;
    let targetLeanAngle = 0.04;

    if (this.isMounted) {
      if (this.prevMountedSpeed - vFwd > VEHICLE_CONFIG.crashDeltaSpeed) {
        this.triggerWipeout('crash', this.prevMountedSpeed);
        return;
      }

      const throttle = this.driveInput.throttle;
      const steer = this.driveInput.steer;
      const pullBack = throttle < -0.15 ? Math.abs(throttle) : 0;
      const canWheelie =
        pullBack > 0 &&
        (this.rearGrounded || currentPitch > 0.08) &&
        (vFwd > VEHICLE_CONFIG.wheelieMinSpeed || currentPitch > 0.14);

      const driveContact = this.rearGrounded || this.frontGrounded || contactGrounded;
      if (driveContact) {
        const tractionMult = this.rearGrounded ? 1.0 : 0.78;
        if (throttle > 0.05) {
          const targetMax = VEHICLE_CONFIG.maxForwardSpeed * throttle;
          const speedNorm = THREE.MathUtils.clamp(
            Math.abs(vFwd) / VEHICLE_CONFIG.maxForwardSpeed,
            0,
            1
          );
          const torqueCurve = 1.18 - speedNorm * 0.48;
          vFwd = Math.min(
            targetMax,
            vFwd + VEHICLE_CONFIG.accel * torqueCurve * tractionMult * throttle * fixedDt
          );
          // Transferencia de peso (squat) al acelerar fuerte
          pitchTorque += throttle * 240 * tractionMult * (1.0 - speedNorm * 0.4);
        } else if (canWheelie) {
          if (!this.wasWheelieActive) {
            vFwd = Math.min(VEHICLE_CONFIG.maxForwardSpeed, vFwd + 1.0);
            this.wheelieTargetPitch = Math.max(currentPitch, 0.14);
          }
          vFwd = Math.min(
            VEHICLE_CONFIG.maxForwardSpeed * 0.92,
            vFwd + 1.55 * pullBack * fixedDt
          );
        } else if (throttle < -0.05) {
          if (vFwd > 0.25) {
            vFwd = Math.max(0, vFwd - VEHICLE_CONFIG.brakeDecel * Math.abs(throttle) * fixedDt);
            // Hundimiento de horquilla delantera al frenar (brake dive)
            pitchTorque -= Math.abs(throttle) * 380;
          } else {
            const targetMin = -VEHICLE_CONFIG.maxReverseSpeed * Math.abs(throttle);
            vFwd = Math.max(
              targetMin,
              vFwd - VEHICLE_CONFIG.accel * 0.55 * tractionMult * Math.abs(throttle) * fixedDt
            );
          }
        } else {
          const rollingFactor = Math.exp(-VEHICLE_CONFIG.rollingDamping * fixedDt);
          const aeroLoss = VEHICLE_CONFIG.aeroDrag * vFwd * Math.abs(vFwd) * fixedDt;
          vFwd = vFwd * rollingFactor - aeroLoss;
          if (Math.abs(vFwd) < 0.04) vFwd = 0;
        }
      } else {
        // Resistencia aérea mínima durante saltos
        vFwd *= Math.exp(-0.08 * fixedDt);
      }

      // Dinámica física del caballito (despegue real de rueda delantera alrededor del eje trasero)
      const safeWheelieRad = THREE.MathUtils.degToRad(VEHICLE_CONFIG.wheelieSafeDeg);
      const critWheelieRad = THREE.MathUtils.degToRad(VEHICLE_CONFIG.wheelieCriticalDeg);
      const pitchVel =
        this.body.angularVelocity.x * _bikeRight.x +
        this.body.angularVelocity.y * _bikeRight.y +
        this.body.angularVelocity.z * _bikeRight.z;

      if (canWheelie) {
        this.wasWheelieActive = true;
        const rate = this.wheelieTargetPitch >= safeWheelieRad ? 0.56 : 1.05;
        this.wheelieTargetPitch = Math.min(
          critWheelieRad + 0.05,
          this.wheelieTargetPitch + rate * pullBack * fixedDt
        );
        const pitchErr = this.wheelieTargetPitch - currentPitch;
        // Compensación gravitatoria + control PD para levantar físicamente la rueda delantera
        pitchTorque +=
          1320 * Math.cos(currentPitch) + pitchErr * 1950 - pitchVel * 240;

        if (currentPitch >= critWheelieRad) {
          this.triggerWipeout('wheelie', vFwd);
          return;
        }
      } else {
        this.wasWheelieActive = false;
        this.wheelieTargetPitch = 0;
        if (!this.isGrounded) {
          // Ligero control de pitch en el aire + estabilización suave
          pitchTorque += throttle * 165 - currentPitch * 320 - pitchVel * 145;
        } else {
          // Amortiguación de cabeceo sin anular la respuesta natural de la suspensión en rampas
          pitchTorque -= pitchVel * 220;
        }
      }

      // Agarre lateral del neumático (permite derrape controlado al frenar girando)
      if (this.isGrounded) {
        const isDrifting =
          throttle < -0.1 && vFwd > 3.5 && Math.abs(steer) > 0.35;
        const latGrip = isDrifting ? 5.2 : 11.2;
        vLat *= Math.exp(-latGrip * fixedDt);
      } else {
        vLat *= Math.exp(-1.5 * fixedDt);
      }

      // Dirección progresiva dependiente de la velocidad
      this.smoothSteerAngle = THREE.MathUtils.damp(this.smoothSteerAngle, steer, 7.8, fixedDt);
      const absSpeed = Math.abs(vFwd);
      const speedTurnFactor =
        absSpeed < 0.16 ? 0 : THREE.MathUtils.smoothstep(absSpeed, 0.16, 4.4);
      const highSpeedStabilize =
        1.0 - THREE.MathUtils.clamp((absSpeed - 9.5) / 20.0, 0, 0.44);
      const wheelieTurnScale = currentPitch > 0.2 ? 0.45 : 1.0;
      const reverseInvert = vFwd < -0.25 ? -1 : 1;
      const targetYawRate =
        this.smoothSteerAngle *
        2.45 *
        speedTurnFactor *
        highSpeedStabilize *
        wheelieTurnScale *
        reverseInvert;
      this.smoothYawRate = THREE.MathUtils.damp(this.smoothYawRate, targetYawRate, 8.8, fixedDt);

      // Inclinación lateral física (roll) en curvas hasta ~34°
      const leanSpeedFactor = THREE.MathUtils.smoothstep(absSpeed, 0.5, 8.5);
      const leanCoeff = vFwd < -0.25 ? -0.18 : 0.58;
      targetLeanAngle = this.smoothSteerAngle * leanSpeedFactor * leanCoeff;

      this.prevMountedSpeed = vFwd;
    } else {
      this.prevMountedSpeed = 0;
      this.wasWheelieActive = false;
      this.wheelieTargetPitch = 0;
      if (this.isGrounded) {
        vFwd *= Math.exp(-3.0 * fixedDt);
        vLat *= Math.exp(-10.5 * fixedDt);
      }
      this.smoothSteerAngle = THREE.MathUtils.damp(this.smoothSteerAngle, 0, 8, fixedDt);
      this.smoothYawRate = THREE.MathUtils.damp(this.smoothYawRate, 0, 8, fixedDt);
      const pitchVel =
        this.body.angularVelocity.x * _bikeRight.x +
        this.body.angularVelocity.y * _bikeRight.y +
        this.body.angularVelocity.z * _bikeRight.z;
      pitchTorque -= pitchVel * 260;
      targetLeanAngle = 0.05;
    }

    // 2. Estabilizador giroscópico PD de Roll + aplicación de torques en los 3 ejes
    const rollVel = -(
      this.body.angularVelocity.x * _bikeFwd.x +
      this.body.angularVelocity.y * _bikeFwd.y +
      this.body.angularVelocity.z * _bikeFwd.z
    );
    const rollTorque = (targetLeanAngle - currentRoll) * 2850 - rollVel * 340;

    // Torque total = pitchTorque alrededor de _bikeRight + rollTorque alrededor de -_bikeFwd (eje +Z local)
    _torqueVec.set(
      _bikeRight.x * pitchTorque - _bikeFwd.x * rollTorque,
      _bikeRight.y * pitchTorque - _bikeFwd.y * rollTorque,
      _bikeRight.z * pitchTorque - _bikeFwd.z * rollTorque
    );
    this.body.torque.x += _torqueVec.x;
    this.body.torque.y += _torqueVec.y;
    this.body.torque.z += _torqueVec.z;

    // Ajuste suave de velocidad angular de giro en Y y límites anti-glitch
    const yawAuthority = this.isGrounded ? 1.0 : 0.32;
    this.body.angularVelocity.y = THREE.MathUtils.damp(
      this.body.angularVelocity.y,
      this.smoothYawRate * yawAuthority,
      10,
      fixedDt
    );
    this.body.angularVelocity.x = THREE.MathUtils.clamp(this.body.angularVelocity.x, -5.5, 5.5);
    this.body.angularVelocity.z = THREE.MathUtils.clamp(this.body.angularVelocity.z, -5.5, 5.5);

    this.currentForwardSpeed = vFwd;
    this.wheelieAngle = Math.max(0, currentPitch);
    this.leanAngle = currentRoll;
    this.body.velocity.x = _bikeFwdHoriz.x * vFwd + _bikeRightHoriz.x * vLat;
    this.body.velocity.z = _bikeFwdHoriz.z * vFwd + _bikeRightHoriz.z * vLat;
  }

  public update(dt: number, alpha: number): void {
    if (this.pendingWipeoutReason) {
      const reason = this.pendingWipeoutReason;
      this.pendingWipeoutReason = null;
      this.onWipeout(
        reason,
        _wipeoutWorldPos,
        _wipeoutWorldQuat,
        _wipeoutInheritVel,
        _wipeoutEjectVel
      );
    }

    if (this.body.position.y < -15) {
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

    if (dt > 0) {
      const rearSpinSpeed = this.currentForwardSpeed / VEHICLE_CONFIG.wheelRadius;
      const frontSpinSpeed =
        this.frontGrounded || Math.abs(this.currentForwardSpeed) > 0.2
          ? rearSpinSpeed
          : rearSpinSpeed * 0.65;
      this.wheelSpinAngle -= rearSpinSpeed * dt;
      this.frontWheelSpinAngle -= frontSpinSpeed * dt;
    }

    // Recorrido visual de los amortiguadores en ruedas
    const fTravel = THREE.MathUtils.clamp((this.frontCompression - this.eqCompression) * 0.52, -0.08, 0.11);
    const rTravel = THREE.MathUtils.clamp((this.rearCompression - this.eqCompression) * 0.52, -0.08, 0.11);

    this.proceduralRig.frontForkPivot.rotation.y = this.smoothSteerAngle * 0.36;
    this.proceduralRig.frontWheelSpin.position.y = this.procFrontWheelBaseY + fTravel;
    this.proceduralRig.rearWheelSpin.position.y = this.procRearWheelBaseY + rTravel;
    this.proceduralRig.frontWheelSpin.rotation.x = this.frontWheelSpinAngle;
    this.proceduralRig.rearWheelSpin.rotation.x = this.wheelSpinAngle;

    if (this.modelRoot) {
      if (this.modelFork) {
        this.modelFork.quaternion.setFromAxisAngle(_forkSteerAxis, this.smoothSteerAngle * 0.32);
      }
      if (this.modelFrontWheel) {
        this.modelFrontWheel.position.y = this.frontWheelBaseY + fTravel;
        this.modelFrontWheel.rotation.x = this.frontWheelSpinAngle;
      }
      if (this.modelRearWheel) {
        this.modelRearWheel.position.y = this.rearWheelBaseY + rTravel;
        this.modelRearWheel.rotation.x = this.wheelSpinAngle;
      }
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
  public isRagdoll = false;
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
  public tposeBoneRig: CharacterBoneRig = {};
  public tposeSnapshots: TposeBoneSnapshot[] = [];
  public headBone: THREE.Bone | null = null;
  public visorMeshes: THREE.Mesh[] = [];
  public readonly actions: Partial<Record<'Idle' | 'Walk' | 'Run' | 'TPose', THREE.AnimationAction>> = {};
  public activeClipName: 'Idle' | 'Walk' | 'Run' | 'TPose' = 'Idle';

  private spawnPosition: [number, number, number];
  private minAirborneVy = 0;
  private mountedSteerAngle = 0;
  private bodyInWorld = true;
  private ragdollInWorld = false;
  private ragdollTimer = 0;
  private ragdollSettleTime = 0;
  private pendingRagdollRecovery = false;
  private ragdollBodies: {
    torso: CANNON.Body;
    head: CANNON.Body;
    leftArm: CANNON.Body;
    rightArm: CANNON.Body;
    leftLeg: CANNON.Body;
    rightLeg: CANNON.Body;
  } | null = null;
  private readonly ragdollAllBodies: CANNON.Body[] = [];
  private readonly ragdollConstraints: CANNON.Constraint[] = [];
  private readonly ragdollPrevTorsoPos = new THREE.Vector3();
  private readonly ragdollCurrTorsoPos = new THREE.Vector3();
  private readonly ragdollPrevTorsoQuat = new THREE.Quaternion();
  private readonly ragdollCurrTorsoQuat = new THREE.Quaternion();
  private readonly scene: THREE.Scene;
  private readonly world: CANNON.World;
  private readonly ragdollPhysMat: CANNON.Material;
  private readonly steerInput: PlayerSteerInput;
  private readonly onHardLanding: (impactSpeed: number) => void;
  private readonly audio: AudioManager;

  constructor(
    spawnPosition: readonly [number, number, number],
    scene: THREE.Scene,
    world: CANNON.World,
    playerPhysMat: CANNON.Material,
    ragdollPhysMat: CANNON.Material,
    steerInput: PlayerSteerInput,
    onHardLanding: (impactSpeed: number) => void,
    audio: AudioManager
  ) {
    super('player');
    this.spawnPosition = [spawnPosition[0], spawnPosition[1], spawnPosition[2]];
    this.scene = scene;
    this.world = world;
    this.ragdollPhysMat = ragdollPhysMat;
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
      collisionFilterGroup: 1,
      collisionFilterMask: 1 | 2,
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

  public setSpawn(pos: [number, number, number]): void {
    this.spawnPosition = [pos[0], pos[1], pos[2]];
  }

  public mountTo(seatAnchor: THREE.Group): void {
    if (this.isMounted || this.isRagdoll) return;
    this.isMounted = true;
    this.isWaving = false;
    this.waveBlend = 0;
    this.steerInput.jumpQueued = false;

    if (this.bodyInWorld) {
      this.world.removeBody(this.body);
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

  private ensureRagdollPool(): void {
    if (this.ragdollBodies) return;
    const makePooledPart = (shape: CANNON.Shape, mass: number): CANNON.Body => {
      const b = new CANNON.Body({
        mass,
        material: this.ragdollPhysMat,
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

    const createLink = (
      bA: CANNON.Body,
      pAx: number,
      pAy: number,
      pAz: number,
      bB: CANNON.Body,
      pBx: number,
      pBy: number,
      pBz: number
    ) => {
      this.ragdollConstraints.push(
        new CANNON.PointToPointConstraint(
          bA,
          new CANNON.Vec3(pAx, pAy, pAz),
          bB,
          new CANNON.Vec3(pBx, pBy, pBz)
        )
      );
    };

    createLink(torso, 0, 0.26, 0, head, 0, -0.16, 0);
    createLink(torso, -0.20, 0.18, 0, leftArm, 0.16, 0, 0);
    createLink(torso, 0.20, 0.18, 0, rightArm, -0.16, 0, 0);
    createLink(torso, -0.12, -0.24, 0, leftLeg, 0, 0.20, 0);
    createLink(torso, 0.12, -0.24, 0, rightLeg, 0, 0.20, 0);

    this.ragdollBodies = { torso, head, leftArm, rightArm, leftLeg, rightLeg };
  }

  public cleanupRagdollBodies(): void {
    if (!this.ragdollInWorld) return;
    for (let i = 0; i < this.ragdollConstraints.length; i++) {
      this.world.removeConstraint(this.ragdollConstraints[i]);
    }
    for (let i = 0; i < this.ragdollAllBodies.length; i++) {
      this.world.removeBody(this.ragdollAllBodies[i]);
    }
    this.ragdollInWorld = false;
  }

  public enterRagdoll(
    worldOrigin: THREE.Vector3,
    worldQuat: THREE.Quaternion,
    inheritVel: THREE.Vector3,
    ejectVel: THREE.Vector3
  ): void {
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

    this.scene.add(this.group);
    if (this.bodyInWorld) {
      this.world.removeBody(this.body);
      this.bodyInWorld = false;
    }
    if (this.baseMixer) this.baseMixer.stopAllAction();
    if (this.upperMixer) this.upperMixer.stopAllAction();

    const rb = this.ragdollBodies!;
    const placePart = (
      b: CANNON.Body,
      lx: number,
      ly: number,
      lz: number,
      jitter: number
    ) => {
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
    rb.torso.angularVelocity.set(
      (Math.random() - 0.5) * 4.5,
      (Math.random() - 0.5) * 3.0,
      (Math.random() - 0.5) * 4.5
    );
    placePart(rb.head, 0, 0.66, 0, 1.2);
    placePart(rb.leftArm, -0.34, 0.38, 0, 1.8);
    placePart(rb.rightArm, 0.34, 0.38, 0, 1.8);
    placePart(rb.leftLeg, -0.14, -0.24, 0, 1.4);
    placePart(rb.rightLeg, 0.14, -0.24, 0, 1.4);

    for (let i = 0; i < this.ragdollAllBodies.length; i++) {
      this.world.addBody(this.ragdollAllBodies[i]);
    }
    for (let i = 0; i < this.ragdollConstraints.length; i++) {
      this.world.addConstraint(this.ragdollConstraints[i]);
    }
    this.ragdollInWorld = true;

    this.ragdollPrevTorsoPos.set(rb.torso.position.x, rb.torso.position.y, rb.torso.position.z);
    this.ragdollCurrTorsoPos.copy(this.ragdollPrevTorsoPos);
    this.ragdollPrevTorsoQuat.set(
      rb.torso.quaternion.x,
      rb.torso.quaternion.y,
      rb.torso.quaternion.z,
      rb.torso.quaternion.w
    );
    this.ragdollCurrTorsoQuat.copy(this.ragdollPrevTorsoQuat);

    this.onHardLanding(-11);
    this.audio.playSound('land_hard', { volume: 0.9 });
  }

  public recoverFromRagdoll(facingYaw = 0): void {
    if (!this.isRagdoll) return;
    const torsoPos = this.ragdollBodies
      ? this.ragdollBodies.torso.position
      : new CANNON.Vec3(this.group.position.x, 0.9, this.group.position.z);
    const standX = torsoPos.x;
    const standY = Math.max(torsoPos.y + 0.45, this.capsuleHalfHeight + 0.05);
    const standZ = torsoPos.z;

    this.cleanupRagdollBodies();
    this.isRagdoll = false;
    this.pendingRagdollRecovery = false;

    this.body.position.set(standX, standY, standZ);
    this.body.velocity.set(0, 0, 0);
    if (!this.bodyInWorld) {
      this.world.addBody(this.body);
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

  public canRecoverManually(): boolean {
    return this.isRagdoll && this.ragdollTimer >= 0.85;
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
    if (this.isRagdoll && this.ragdollBodies) {
      const t = this.ragdollBodies.torso;
      this.ragdollCurrTorsoPos.set(t.position.x, t.position.y, t.position.z);
      this.ragdollCurrTorsoQuat.set(t.quaternion.x, t.quaternion.y, t.quaternion.z, t.quaternion.w);
      return;
    }
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

  public reset(pos?: [number, number, number]): void {
    const target = pos ?? this.spawnPosition;
    this.cleanupRagdollBodies();
    this.isRagdoll = false;
    this.pendingRagdollRecovery = false;
    if (this.isMounted) {
      this.scene.add(this.group);
      this.isMounted = false;
    }
    if (!this.bodyInWorld) {
      this.world.addBody(this.body);
      this.bodyInWorld = true;
    }
    this.body.position.set(target[0], target[1], target[2]);
    this.body.velocity.set(0, 0, 0);
    this.syncInterpolationBuffers();
    this.group.position.set(target[0], target[1], target[2]);
    this.group.quaternion.identity();
    this.headingGroup.rotation.set(0, 0, 0);
    this.headingGroup.quaternion.identity();
    if (this.baseMixer && this.actions.Idle) {
      this.baseMixer.stopAllAction();
      this.actions.Idle.reset().setEffectiveWeight(1).play();
      this.activeClipName = 'Idle';
      this.baseMixer.update(0);
    }
    this.isWaving = false;
    this.minAirborneVy = 0;
    this.health = 100;
  }

  public override destroy(): void {
    this.cleanupRagdollBodies();
    this.ragdollConstraints.length = 0;
    this.ragdollAllBodies.length = 0;
    this.ragdollBodies = null;
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

    if (this.isRagdoll && this.ragdollBodies) {
      const t = this.ragdollBodies.torso;
      this.ragdollPrevTorsoPos.set(t.position.x, t.position.y, t.position.z);
      this.ragdollPrevTorsoQuat.set(t.quaternion.x, t.quaternion.y, t.quaternion.z, t.quaternion.w);
      this.ragdollTimer += fixedDt;
      const torsoSpeed = Math.hypot(t.velocity.x, t.velocity.y, t.velocity.z);
      this.ragdollSettleTime = torsoSpeed < 0.7 ? this.ragdollSettleTime + fixedDt : 0;
      if (
        (this.ragdollSettleTime > 1.05 && this.ragdollTimer > 1.9) ||
        this.ragdollTimer > 3.8 ||
        t.position.y < -8
      ) {
        this.pendingRagdollRecovery = true;
      }
      return;
    }

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
        this.body.applyForce(_forceVec, _zeroRelVec);
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
    if (this.isRagdoll && this.pendingRagdollRecovery) {
      this.pendingRagdollRecovery = false;
      this.recoverFromRagdoll();
    }

    if (this.isRagdoll && this.ragdollBodies) {
      this.reportedAnim = 'Ragdoll';
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
      for (let i = 0; i < this.tposeSnapshots.length; i++) {
        this.tposeSnapshots[i].bone.quaternion.copy(this.tposeSnapshots[i].quat);
      }

      const activeRig =
        this.tposeBoneRig.leftArm || this.tposeBoneRig.rightArm
          ? this.tposeBoneRig
          : this.boneRig;
      _ragInvQuat.copy(_interpQuat).invert();

      const aimBodyPart = (
        entry: BoneRigEntry | undefined,
        partBody: CANNON.Body,
        rx: number,
        ry: number,
        rz: number,
        ox: number,
        oy: number,
        oz: number
      ) => {
        _ragLocalDir
          .set(
            partBody.position.x - rb.torso.position.x,
            partBody.position.y - rb.torso.position.y,
            partBody.position.z - rb.torso.position.z
          )
          .applyQuaternion(_ragInvQuat);
        _ragLocalDir.x -= ox;
        _ragLocalDir.y -= oy;
        _ragLocalDir.z -= oz;
        aimRigBoneTowardLocalDir(
          entry,
          rx,
          ry,
          rz,
          _ragLocalDir.x,
          _ragLocalDir.y,
          _ragLocalDir.z,
          0.9
        );
      };

      aimBodyPart(activeRig.head, rb.head, 0, 1, 0, 0, 0.24, 0);
      aimBodyPart(activeRig.leftArm, rb.leftArm, -1, 0, 0, -0.18, 0.16, 0);
      aimBodyPart(activeRig.rightArm, rb.rightArm, 1, 0, 0, 0.18, 0.16, 0);
      aimBodyPart(activeRig.leftUpLeg, rb.leftLeg, 0, -1, 0, -0.1, -0.22, 0);
      aimBodyPart(activeRig.rightUpLeg, rb.rightLeg, 0, -1, 0, 0.1, -0.22, 0);
      applyBoneEulerDelta(activeRig.leftLeg, -0.68, 0, 0);
      applyBoneEulerDelta(activeRig.rightLeg, -0.54, 0, 0);
      applyBoneEulerDelta(activeRig.leftForeArm, 0.25, -0.45, 0);
      applyBoneEulerDelta(activeRig.rightForeArm, 0.25, 0.45, 0);

      this.applyFpsHeadMask();
      return;
    }

    if (this.isMounted) {
      this.reportedAnim = 'Drive';
      this.isGrounded = true;
      this.isWaving = false;
      this.waveBlend = 0;
      if (this.baseMixer) this.baseMixer.update(0);
      for (let i = 0; i < this.tposeSnapshots.length; i++) {
        this.tposeSnapshots[i].bone.quaternion.copy(this.tposeSnapshots[i].quat);
      }
      const activeRig =
        this.tposeBoneRig.leftArm || this.tposeBoneRig.rightArm
          ? this.tposeBoneRig
          : this.boneRig;
      applyMotorcycleSeatedPose(activeRig, this.mountedSteerAngle, this.headingGroup);
      this.applyFpsHeadMask();
      this.group.getWorldPosition(this.interpolatedPosition);
      return;
    }

    if (this.body.position.y < -15) {
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
      if (dt > 0) this.baseMixer.update(dt);
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
  {
    onLoadProgress,
    onStateChange,
    onContextLostChange,
    initialMap,
    initialQuality,
    cameraSensitivity = 1.0,
    audioVolume = 0.8,
  },
  ref
) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const onLoadProgressRef = useRef(onLoadProgress);
  onLoadProgressRef.current = onLoadProgress;
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;
  const onContextLostRef = useRef(onContextLostChange);
  onContextLostRef.current = onContextLostChange;
  const initialMapRef = useRef(initialMap);
  const initialQualityRef = useRef(initialQuality);
  const cameraSensitivityRef = useRef(cameraSensitivity);
  cameraSensitivityRef.current = cameraSensitivity;
  const audioVolumeRef = useRef(audioVolume);
  const audioManagerRef = useRef<AudioManager | null>(null);

  useEffect(() => {
    audioVolumeRef.current = audioVolume;
    audioManagerRef.current?.setMasterVolume(audioVolume);
  }, [audioVolume]);

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
  const toggleFreeCamFnRef = useRef<(() => void) | null>(null);
  const togglePauseFnRef = useRef<(() => void) | null>(null);
  const toggleSlowMotionFnRef = useRef<(() => void) | null>(null);
  const quickSaveFnRef = useRef<(() => boolean) | null>(null);
  const quickLoadFnRef = useRef<(() => boolean) | null>(null);
  const loadTestModelFnRef = useRef<((url: string, options?: TestModelLoadOptions) => void) | null>(null);
  const clearTestModelFnRef = useRef<(() => void) | null>(null);
  const loadMapFnRef = useRef<
    ((mapData: unknown) => { ok: boolean; error?: string; name?: string }) | null
  >(null);
  const setQualityFnRef = useRef<((preset: QualityPreset) => void) | null>(null);
  const clearCacheFnRef = useRef<(() => Promise<void>) | null>(null);
  const getCopyPosFnRef = useRef<
    | (() => {
        playerPos: [number, number, number];
        camPos: [number, number, number];
        colliderJson: string;
      })
    | null
  >(null);

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
    toggleFreeCam: () => toggleFreeCamFnRef.current?.(),
    togglePause: () => togglePauseFnRef.current?.(),
    toggleSlowMotion: () => toggleSlowMotionFnRef.current?.(),
    quickSave: () => quickSaveFnRef.current?.() ?? false,
    quickLoad: () => quickLoadFnRef.current?.() ?? false,
    loadTestModel: (url: string, options?: TestModelLoadOptions) => {
      loadTestModelFnRef.current?.(url, options);
    },
    clearTestModel: () => {
      clearTestModelFnRef.current?.();
    },
    loadMapFromJSON: (mapData: unknown) =>
      loadMapFnRef.current?.(mapData) ?? { ok: false, error: 'Motor no inicializado' },
    setQualityPreset: (preset: QualityPreset) => setQualityFnRef.current?.(preset),
    clearModelCache: () => clearCacheFnRef.current?.() ?? Promise.resolve(),
    getPositionCopyPayload: () =>
      getCopyPosFnRef.current?.() ?? {
        playerPos: [0, 0, 0],
        camPos: [0, 0, 0],
        colliderJson: '{}',
      },
  }));

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let disposed = false;
    let frameId = 0;

    const isSoftwareGl = detectSoftwareWebGL();
    const isTouch = detectTouchCapable();
    let qualityPreset: QualityPreset =
      initialQualityRef.current ?? (isSoftwareGl || isTouch ? 'low' : 'medium');
    let baseFogNear = 28;
    let baseFogFar = 92;

    const entityManager = new EntityManager();
    const timeManager = new TimeManager();
    const audioManager = new AudioManager();
    audioManager.setMasterVolume(audioVolumeRef.current);
    audioManagerRef.current = audioManager;
    const engineRaycaster = new EngineRaycaster();

    // 1. Scene, Camera & Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SCENE_COLORS.skyCss);
    scene.fog = new THREE.Fog(SCENE_COLORS.skyHex, baseFogNear, baseFogFar);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const camera = new THREE.PerspectiveCamera(
      CAMERA_VIEWS[0].fov,
      width / height,
      0.08,
      165
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
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
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.44);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xdde8f8, 0x9aa3ad, 0.55);
    hemiLight.position.set(0, 30, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff6ea, 1.85);
    dirLight.position.set(12, 22, 10);
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 75;
    const shadowSpan = 22;
    dirLight.shadow.camera.left = -shadowSpan;
    dirLight.shadow.camera.right = shadowSpan;
    dirLight.shadow.camera.top = shadowSpan;
    dirLight.shadow.camera.bottom = -shadowSpan;
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.02;
    scene.add(dirLight);
    scene.add(dirLight.target);

    const applyQualityPreset = (preset: QualityPreset) => {
      qualityPreset = preset;
      const fogScale = preset === 'low' ? 0.72 : preset === 'high' ? 1.32 : 1.0;
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.near = baseFogNear * (preset === 'low' ? 0.85 : 1.0);
        scene.fog.far = baseFogFar * fogScale;
      }
      const dpr = window.devicePixelRatio || 1;
      if (isSoftwareGl) {
        renderer.setPixelRatio(1);
        renderer.shadowMap.enabled = false;
        dirLight.castShadow = false;
        return;
      }
      if (preset === 'low') {
        renderer.setPixelRatio(1.0);
        renderer.shadowMap.enabled = false;
        dirLight.castShadow = false;
      } else if (preset === 'medium') {
        renderer.setPixelRatio(Math.min(dpr, 1.35));
        renderer.shadowMap.enabled = true;
        dirLight.castShadow = true;
        if (dirLight.shadow.mapSize.x !== 1024) {
          dirLight.shadow.mapSize.set(1024, 1024);
          dirLight.shadow.map?.dispose();
          dirLight.shadow.map = null;
        }
      } else {
        renderer.setPixelRatio(Math.min(dpr, 1.5));
        renderer.shadowMap.enabled = true;
        dirLight.castShadow = true;
        if (dirLight.shadow.mapSize.x !== 2048) {
          dirLight.shadow.mapSize.set(2048, 2048);
          dirLight.shadow.map?.dispose();
          dirLight.shadow.map = null;
        }
      }
    };
    applyQualityPreset(qualityPreset);
    setQualityFnRef.current = applyQualityPreset;

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
    const ragdollPhysMat = new CANNON.Material('ragdoll');
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
    world.addContactMaterial(
      new CANNON.ContactMaterial(groundPhysMat, ragdollPhysMat, {
        friction: 0.65,
        restitution: 0.18,
      })
    );
    world.addContactMaterial(
      new CANNON.ContactMaterial(vehiclePhysMat, ragdollPhysMat, {
        friction: 0.45,
        restitution: 0.25,
      })
    );

    const sharedCoreGeometries: THREE.BufferGeometry[] = [];
    const sharedCoreMaterials: THREE.Material[] = [];

    const doorMaterials = {
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
    sharedCoreMaterials.push(
      doorMaterials.doorFrame,
      doorMaterials.doorLeaf,
      doorMaterials.doorHandle
    );

    // Camera Shake
    let shakeIntensity = 0;
    let shakeDuration = 0;
    let shakeTimer = 0;
    function triggerCameraShake(intensity: number, duration: number) {
      shakeIntensity = Math.max(shakeIntensity, intensity);
      shakeDuration = Math.max(duration, 0.01);
      shakeTimer = shakeDuration;
    }

    // 4. Entidades permanentes (Motocicleta + Jugador)
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

    let playerEntity: PlayerEntity;

    const motorcycleEntity = entityManager.add(
      new MotorcycleEntity(
        scene,
        world,
        vehiclePhysMat,
        driveState,
        sharedCoreGeometries,
        sharedCoreMaterials,
        (impactVy) => {
          const factor = THREE.MathUtils.clamp((-impactVy - 7) / 7, 0.4, 1.15);
          triggerCameraShake(0.12 * factor, 0.25);
        },
        (_reason, riderWorldPos, riderWorldQuat, inheritVel, ejectVel) => {
          playerEntity.enterRagdoll(
            riderWorldPos,
            riderWorldQuat,
            inheritVel,
            ejectVel
          );
          triggerCameraShake(0.2, 0.36);
        },
        audioManager
      )
    );

    playerEntity = entityManager.add(
      new PlayerEntity(
        PHYSICS_CONFIG.spawnPosition,
        scene,
        world,
        playerPhysMat,
        ragdollPhysMat,
        steerState,
        (impactVy) => {
          const factor = THREE.MathUtils.clamp((-impactVy - 7) / 6, 0.4, 1.2);
          triggerCameraShake(0.11 * factor, 0.24);
        },
        audioManager
      )
    );

    // 5. Contenedores dinámicos de Mapas JSON
    const mapGroup = new THREE.Group();
    scene.add(mapGroup);
    const mapGeos: THREE.BufferGeometry[] = [];
    const mapMats: THREE.Material[] = [];
    const mapMaterialCache = new Map<string, THREE.MeshStandardMaterial>();
    const mapBodies: CANNON.Body[] = [];
    const mapDoors: DoorEntity[] = [];
    const mapDynamicObjects: Array<{ mesh: THREE.Object3D; body: CANNON.Body }> = [];
    const cameraColliders: THREE.Object3D[] = [];
    const allInteractTargets: THREE.Object3D[] = [...motorcycleEntity.interactTargets];
    const triggerSystem = new TriggerSystem(mapGroup, mapGeos, mapMats);

    let activeMapName = BUILTIN_MAPS.barrio_urbana.name ?? 'Barrio Urbano';
    let mapLoadGeneration = 0;
    let lastTriggerLabel: string | null = null;
    let boostCooldown = 0;
    let activeCheckpoint: [number, number, number] = [...PHYSICS_CONFIG.spawnPosition];

    const getCachedMapMaterial = (
      color: string | number,
      roughness = 0.82,
      metalness = 0.06
    ) => {
      const key = `${String(color)}|${roughness}|${metalness}`;
      const existing = mapMaterialCache.get(key);
      if (existing) return existing;
      const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
      mapMaterialCache.set(key, mat);
      mapMats.push(mat);
      return mat;
    };

    // Loaders + Gestión de Caché IndexedDB
    const gltfLoader = new GLTFLoader();
    const hondaLoadingManager = new THREE.LoadingManager();
    const transparent1pxPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    hondaLoadingManager.setURLModifier((url) => {
      if (
        url === HONDA_MTL_URL ||
        url === HONDA_OBJ_URL ||
        url.startsWith('data:') ||
        url.startsWith('blob:')
      ) {
        return url;
      }
      return transparent1pxPng;
    });

    const loadModelCached = async (
      url: string,
      typeHint?: 'glb' | 'obj'
    ): Promise<{ object: THREE.Object3D; animations: THREE.AnimationClip[] }> => {
      const isObj = typeHint === 'obj' || url.toLowerCase().endsWith('.obj');
      if (isObj) {
        const { text } = await modelCacheManager.fetchText(url);
        const loader = new OBJLoader(hondaLoadingManager);
        const obj = loader.parse(text);
        return { object: obj, animations: [] };
      }

      const cachedProto = modelCacheManager.getClonedObject(url);
      if (cachedProto) {
        return { object: cachedProto, animations: [] };
      }
      const { buffer } = await modelCacheManager.fetchArrayBuffer(url);
      const gltf = await new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>(
        (resolve, reject) => {
          gltfLoader.parse(buffer, '', resolve, reject);
        }
      );
      if ((gltf.animations?.length ?? 0) === 0) {
        modelCacheManager.storeObjectPrototype(url, gltf.scene);
        return { object: gltf.scene.clone(true), animations: [] };
      }
      return { object: gltf.scene, animations: gltf.animations ?? [] };
    };

    let modelCacheStatus = 'Cargando...';

    // Carga de Soldier.glb con caché IndexedDB
    (async () => {
      try {
        onLoadProgressRef.current(25, false, null);
        const { buffer } = await modelCacheManager.fetchArrayBuffer(SOLDIER_MODEL_URL);
        if (disposed) return;
        onLoadProgressRef.current(75, false, null);
        const gltf = await new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>(
          (resolve, reject) => gltfLoader.parse(buffer, '', resolve, reject)
        );
        if (disposed) return;
        const model = gltf.scene;
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.frustumCulled = true;
          }
        });

        const baseMixer = new THREE.AnimationMixer(model);
        playerEntity.baseMixer = baseMixer;
        (['Idle', 'Walk', 'Run', 'TPose'] as const).forEach((clipName) => {
          const clip = THREE.AnimationClip.findByName(gltf.animations, clipName);
          if (clip) playerEntity.actions[clipName] = baseMixer.clipAction(clip);
        });

        if (playerEntity.actions.TPose) {
          playerEntity.actions.TPose.reset().setEffectiveWeight(1).play();
          baseMixer.update(0);
        }
        model.updateMatrixWorld(true);
        playerEntity.tposeSnapshots = captureTposeSnapshots(model);
        playerEntity.tposeBoneRig = buildCharacterBoneRig(model);

        if (playerEntity.actions.Idle) {
          baseMixer.stopAllAction();
          playerEntity.actions.Idle.reset().setEffectiveWeight(1).play();
          playerEntity.activeClipName = 'Idle';
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
      } catch {
        if (disposed) return;
        const fallback = createProceduralFallbackCharacter();
        playerEntity.alignModelToCapsuleBase(fallback);
        playerEntity.headingGroup.add(fallback);
        const { visorMeshes } = findHeadAndVisor(fallback);
        playerEntity.visorMeshes = visorMeshes;
        onLoadProgressRef.current(
          100,
          true,
          'No se pudo descargar Soldier.glb; usando modelo de respaldo.'
        );
      }
    })();

    // Carga de Honda CB 750 OBJ/MTL con caché persistente IndexedDB + fusión agresiva de geometría
    const loadHondaFromCacheOrNetwork = async () => {
      try {
        const [mtlRes, objRes] = await Promise.all([
          modelCacheManager.fetchText(HONDA_MTL_URL).catch(() => null),
          modelCacheManager.fetchText(HONDA_OBJ_URL),
        ]);
        if (disposed) return;

        const objLoader = new OBJLoader(hondaLoadingManager);
        if (mtlRes) {
          const mtlLoader = new MTLLoader(hondaLoadingManager);
          const mats = mtlLoader.parse(mtlRes.text, '');
          mats.preload();
          objLoader.setMaterials(mats);
        }
        const parsedObj = objLoader.parse(objRes.text);
        motorcycleEntity.attachHondaObjModel(
          parsedObj,
          sharedCoreGeometries,
          sharedCoreMaterials
        );
        modelCacheStatus = `Honda: ${modelCacheManager.getSourceLabel(HONDA_OBJ_URL)}`;
      } catch {
        modelCacheStatus = 'Honda: respaldo procedural';
      }
    };
    loadHondaFromCacheOrNetwork();

    clearCacheFnRef.current = async () => {
      await modelCacheManager.clearAll();
      modelCacheStatus = 'Caché limpiada (próxima carga de red)';
    };

    // 6. Estado de cámara y controles
    const keys: Record<string, boolean> = Object.create(null);

    let cameraMode: CameraMode = 'TPS';
    let isFreeCam = false;
    const freeCamPos = new THREE.Vector3(0, 3.2, 6);
    let freeCamYaw = 0;
    let freeCamPitch = -0.22;
    let freeCamSpeed = 9.0;

    let currentViewIndex = 0;
    let camYaw = 0;
    let prevBikeYaw = motorcycleEntity.headingYaw;
    let pitchOffset = 0;
    let fpsPitch = 0;
    let fpsLookYawOffset = 0;
    let zoomOffset = 0;
    let saveStatus: string | null = null;

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

    // =========================================================================
    // Lector de Mapas JSON (`loadMapFromJSON`)
    // =========================================================================
    const clearCurrentMap = () => {
      mapLoadGeneration += 1;
      for (let i = 0; i < mapDoors.length; i++) {
        entityManager.remove(mapDoors[i].id);
      }
      mapDoors.length = 0;

      for (let i = 0; i < mapBodies.length; i++) {
        world.removeBody(mapBodies[i]);
      }
      mapBodies.length = 0;
      mapDynamicObjects.length = 0;

      triggerSystem.clear();

      while (mapGroup.children.length > 0) {
        mapGroup.remove(mapGroup.children[0]);
      }
      for (let i = 0; i < mapGeos.length; i++) {
        mapGeos[i].dispose();
      }
      mapGeos.length = 0;
      for (let i = 0; i < mapMats.length; i++) {
        mapMats[i].dispose();
      }
      mapMats.length = 0;
      mapMaterialCache.clear();

      cameraColliders.length = 0;
      allInteractTargets.length = 0;
      allInteractTargets.push(...motorcycleEntity.interactTargets);
      lastTriggerLabel = null;
    };

    const loadMapFromJSON = (
      rawMapData: unknown
    ): { ok: boolean; error?: string; name?: string } => {
      let parsedData = rawMapData;
      if (typeof rawMapData === 'string') {
        try {
          parsedData = JSON.parse(rawMapData);
        } catch (err) {
          return {
            ok: false,
            error: `JSON inválido: ${(err as Error).message}`,
          };
        }
      }

      let mapData: NormalizedMapJSON;
      try {
        mapData = normalizeMapJSON(parsedData);
      } catch (err) {
        return {
          ok: false,
          error: (err as Error).message,
        };
      }

      clearCurrentMap();
      const generationToken = mapLoadGeneration;
      activeMapName = mapData.name;

      // 1. Entorno
      scene.background = new THREE.Color(mapData.environment.bgColor);
      baseFogNear = mapData.environment.fogNear;
      baseFogFar = mapData.environment.fogFar;
      const fogScale =
        qualityPreset === 'low' ? 0.72 : qualityPreset === 'high' ? 1.32 : 1.0;
      scene.fog = new THREE.Fog(
        mapData.environment.fogColor,
        baseFogNear * (qualityPreset === 'low' ? 0.85 : 1.0),
        baseFogFar * fogScale
      );
      ambientLight.intensity = mapData.environment.ambientIntensity;
      dirLight.intensity = mapData.environment.dirIntensity;

      // 2. Suelo
      if (mapData.ground.physics) {
        const groundBody = new CANNON.Body({
          mass: 0,
          material: groundPhysMat,
          shape: new CANNON.Plane(),
        });
        groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        world.addBody(groundBody);
        mapBodies.push(groundBody);
      }

      if (mapData.ground.visible) {
        const gGeo = new THREE.PlaneGeometry(mapData.ground.size, mapData.ground.size);
        mapGeos.push(gGeo);
        const gMat = getCachedMapMaterial(mapData.ground.color, 0.92, 0.02);
        const gMesh = new THREE.Mesh(gGeo, gMat);
        gMesh.rotation.x = -Math.PI / 2;
        gMesh.receiveShadow = true;
        mapGroup.add(gMesh);
        cameraColliders.push(gMesh);
      }

      // 3. Colliders (visibles o invisibles para mapModel)
      for (const col of mapData.colliders) {
        const [px, py, pz] = col.pos;
        const [rx, ry, rz] = col.rot ?? [0, 0, 0];
        const [sx, sy, sz] = col.scale;
        const mass = col.mass ?? 0;

        if (col.type === 'cylinder') {
          const radius = Math.max(0.1, sx * 0.5);
          const height = Math.max(0.1, sy);
          const body = new CANNON.Body({
            mass,
            material: groundPhysMat,
            shape: new CANNON.Cylinder(radius, radius, height, 20),
          });
          body.position.set(px, py, pz);
          body.quaternion.setFromEuler(rx, ry, rz);
          world.addBody(body);
          mapBodies.push(body);

          if (col.visible !== false) {
            const geo = new THREE.CylinderGeometry(radius, radius, height, 20);
            mapGeos.push(geo);
            const mat = getCachedMapMaterial(
              col.color ?? SCENE_COLORS.cylinderHex,
              0.78,
              0.08
            );
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(px, py, pz);
            mesh.rotation.set(rx, ry, rz);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mapGroup.add(mesh);
            cameraColliders.push(mesh);
            if (mass > 0) mapDynamicObjects.push({ mesh, body });
          }
        } else {
          const body = new CANNON.Body({
            mass,
            material: groundPhysMat,
            shape: new CANNON.Box(new CANNON.Vec3(sx * 0.5, sy * 0.5, sz * 0.5)),
          });
          body.position.set(px, py, pz);
          body.quaternion.setFromEuler(rx, ry, rz);
          world.addBody(body);
          mapBodies.push(body);

          if (col.visible !== false) {
            const geo = new THREE.BoxGeometry(sx, sy, sz);
            mapGeos.push(geo);
            const mat = getCachedMapMaterial(
              col.color ??
                (col.type === 'ramp'
                  ? SCENE_COLORS.rampHex
                  : SCENE_COLORS.blockPrimaryHex),
              0.82,
              0.06
            );
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(px, py, pz);
            mesh.rotation.set(rx, ry, rz);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mapGroup.add(mesh);
            cameraColliders.push(mesh);
            if (mass > 0) mapDynamicObjects.push({ mesh, body });
          }
        }
      }

      // 4. Objetos y Props (primitivos o modelos externos con frustumCulling + caché)
      for (const obj of mapData.objects) {
        const [px, py, pz] = obj.pos;
        const [rx, ry, rz] = obj.rot ?? [0, 0, 0];
        const scaleVec: [number, number, number] =
          typeof obj.scale === 'number'
            ? [obj.scale, obj.scale, obj.scale]
            : obj.scale ?? [1, 1, 1];
        const [sx, sy, sz] = scaleVec;

        if (obj.type === 'model' && obj.url) {
          const modelUrl = obj.url;
          loadModelCached(modelUrl)
            .then(({ object: loaded }) => {
              if (disposed || generationToken !== mapLoadGeneration) return;
              loaded.position.set(px, py, pz);
              loaded.rotation.set(rx, ry, rz);
              loaded.scale.set(sx, sy, sz);
              const allowCast = obj.castShadow !== false;
              loaded.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                  const m = child as THREE.Mesh;
                  m.frustumCulled = true;
                  m.castShadow = allowCast;
                  m.receiveShadow = true;
                }
              });
              mapGroup.add(loaded);
              cameraColliders.push(loaded);
              if (obj.physics) {
                _tmpBox3A.setFromObject(loaded);
                _tmpBox3A.getSize(_tmpVec3A);
                const b = new CANNON.Body({
                  mass: obj.mass ?? 15,
                  material: groundPhysMat,
                  shape: new CANNON.Box(
                    new CANNON.Vec3(
                      Math.max(0.15, _tmpVec3A.x * 0.5),
                      Math.max(0.15, _tmpVec3A.y * 0.5),
                      Math.max(0.15, _tmpVec3A.z * 0.5)
                    )
                  ),
                });
                b.position.set(px, py, pz);
                b.quaternion.setFromEuler(rx, ry, rz);
                world.addBody(b);
                mapBodies.push(b);
                if ((obj.mass ?? 15) > 0) mapDynamicObjects.push({ mesh: loaded, body: b });
              }
            })
            .catch(() => {});
          continue;
        }

        const geo =
          obj.type === 'cylinder'
            ? new THREE.CylinderGeometry(sx * 0.5, sx * 0.5, sy, 20)
            : new THREE.BoxGeometry(sx, sy, sz);
        mapGeos.push(geo);
        const mat = getCachedMapMaterial(
          obj.color ?? SCENE_COLORS.blockSecondaryHex,
          0.72,
          0.12
        );
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(px, py, pz);
        mesh.rotation.set(rx, ry, rz);
        mesh.castShadow = obj.castShadow !== false;
        mesh.receiveShadow = true;
        mesh.frustumCulled = true;
        mapGroup.add(mesh);
        cameraColliders.push(mesh);

        if (obj.physics) {
          const mass = obj.mass ?? 15;
          const shape =
            obj.type === 'cylinder'
              ? new CANNON.Cylinder(sx * 0.5, sx * 0.5, sy, 20)
              : new CANNON.Box(new CANNON.Vec3(sx * 0.5, sy * 0.5, sz * 0.5));
          const body = new CANNON.Body({
            mass,
            material: groundPhysMat,
            shape,
          });
          body.position.set(px, py, pz);
          body.quaternion.setFromEuler(rx, ry, rz);
          world.addBody(body);
          mapBodies.push(body);
          if (mass > 0) {
            mapDynamicObjects.push({ mesh, body });
          }
        }
      }

      // 5. Modelo visual completo de mapa externo (sin colisionadores pesados de triángulos)
      if (mapData.mapModel) {
        const mm = mapData.mapModel;
        loadModelCached(mm.url, mm.type)
          .then(({ object: loaded }) => {
            if (disposed || generationToken !== mapLoadGeneration) return;
            const [px, py, pz] = mm.pos ?? [0, 0, 0];
            const [rx, ry, rz] = mm.rot ?? [0, 0, 0];
            const sc =
              typeof mm.scale === 'number'
                ? ([mm.scale, mm.scale, mm.scale] as [number, number, number])
                : mm.scale ?? [1, 1, 1];
            loaded.position.set(px, py, pz);
            loaded.rotation.set(rx, ry, rz);
            loaded.scale.set(sc[0], sc[1], sc[2]);

            const cachedMatMap = new Map<string, THREE.Material>();
            loaded.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const m = child as THREE.Mesh;
                m.frustumCulled = true;
                m.receiveShadow = mm.receiveShadow !== false;
                if (m.geometry) {
                  m.geometry.computeBoundingBox();
                  m.geometry.computeBoundingSphere();
                  mapGeos.push(m.geometry);
                }
                const bb = m.geometry?.boundingBox;
                const maxDim = bb
                  ? Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) *
                    Math.max(sc[0], sc[1], sc[2])
                  : 1;
                m.castShadow = Boolean(mm.castShadow) && maxDim >= 0.45;
                if (mm.type === 'obj' && m.material && !Array.isArray(m.material)) {
                  const orig = m.material as THREE.MeshStandardMaterial;
                  const matKey = `${orig.name}|${orig.color?.getHexString?.() ?? 'fff'}`;
                  if (cachedMatMap.has(matKey)) {
                    orig.dispose();
                    m.material = cachedMatMap.get(matKey)!;
                  } else {
                    cachedMatMap.set(matKey, orig);
                    mapMats.push(orig);
                  }
                }
              }
            });
            mapGroup.add(loaded);
          })
          .catch(() => {});
      }

      // 6. Puertas
      for (const doorCfg of mapData.doors) {
        const door = entityManager.add(
          new DoorEntity(
            doorCfg,
            mapGroup,
            world,
            groundPhysMat,
            doorMaterials,
            cameraColliders,
            mapGeos,
            audioManager
          )
        );
        mapDoors.push(door);
        allInteractTargets.push(...door.interactTargets);
      }

      // 7. Triggers
      for (let i = 0; i < mapData.triggers.length; i++) {
        const trg = mapData.triggers[i];
        triggerSystem.createTrigger({
          id: trg.id ?? `trigger_${i + 1}`,
          label: trg.label ?? trg.action,
          position: trg.pos,
          size: trg.size,
          color: trg.color ?? 0x0ea5e9,
          visible: trg.visible !== false,
          onEnter: ({ actorType, body }) => {
            if (trg.action === 'boost') {
              const boostAmt = typeof trg.value === 'number' ? trg.value : 6.5;
              lastTriggerLabel = trg.label ?? 'Impulso';
              if (boostCooldown <= 0) {
                boostCooldown = 0.55;
                if (actorType === 'motorcycle') {
                  _bikeQuat.set(
                    body.quaternion.x,
                    body.quaternion.y,
                    body.quaternion.z,
                    body.quaternion.w
                  );
                  _bikeFwd.set(0, 0, -1).applyQuaternion(_bikeQuat);
                  _bikeFwd.y = 0;
                  if (_bikeFwd.lengthSq() > 0.001) _bikeFwd.normalize();
                  body.velocity.x += _bikeFwd.x * boostAmt;
                  body.velocity.z += _bikeFwd.z * boostAmt;
                  body.velocity.y = Math.max(body.velocity.y, 1.5);
                } else {
                  body.velocity.z -= boostAmt * 0.7;
                  body.velocity.y = Math.max(body.velocity.y, 3.6);
                }
                audioManager.playSound('jump', { volume: 0.55 });
              }
            } else if (trg.action === 'checkpoint') {
              activeCheckpoint = [trg.pos[0], Math.max(trg.pos[1], 1.1), trg.pos[2]];
              lastTriggerLabel = trg.label ?? 'Checkpoint activado';
              audioManager.playSound('door_open', { volume: 0.45 });
            } else if (trg.action === 'teleport') {
              const dest =
                trg.target ??
                (Array.isArray(trg.value) ? trg.value : mapData.spawn.player);
              lastTriggerLabel = trg.label ?? 'Teletransporte';
              if (actorType === 'motorcycle') {
                motorcycleEntity.reset([dest[0], Math.max(dest[1], 0.6), dest[2]], motorcycleEntity.headingYaw);
              } else {
                body.position.set(dest[0], Math.max(dest[1], 1.0), dest[2]);
                body.velocity.set(0, 0, 0);
                playerEntity.syncInterpolationBuffers();
              }
              audioManager.playSound('mount', { volume: 0.55 });
            }
          },
          onExit: () => {
            if (trg.action === 'boost') {
              lastTriggerLabel = `${trg.label ?? 'Impulso'} (ok)`;
            }
          },
        });
      }

      // 8. Reubicar jugador y moto al spawn del mapa (desmontar/salir de ragdoll si aplica)
      if (playerEntity.isRagdoll) {
        playerEntity.recoverFromRagdoll(mapData.spawn.bikeRotY);
      }
      if (motorcycleEntity.isMounted) {
        motorcycleEntity.isMounted = false;
        playerEntity.dismountAt(
          new THREE.Vector3(
            mapData.spawn.player[0],
            mapData.spawn.player[1],
            mapData.spawn.player[2]
          ),
          mapData.spawn.bikeRotY
        );
      }
      activeCheckpoint = [...mapData.spawn.player];
      playerEntity.setSpawn(mapData.spawn.player);
      motorcycleEntity.setSpawn(mapData.spawn.bike, mapData.spawn.bikeRotY);
      playerEntity.reset(mapData.spawn.player);
      motorcycleEntity.reset(mapData.spawn.bike, mapData.spawn.bikeRotY);
      prevBikeYaw = mapData.spawn.bikeRotY;
      camYaw = 0;
      pitchOffset = 0;
      fpsPitch = 0;
      fpsLookYawOffset = 0;

      return { ok: true, name: mapData.name };
    };

    loadMapFnRef.current = loadMapFromJSON;
    (window as unknown as { loadMapFromJSON?: typeof loadMapFromJSON }).loadMapFromJSON =
      loadMapFromJSON;

    // Carga mapa inicial por defecto o mapa elegido desde el Menú
    loadMapFromJSON(initialMapRef.current ?? BUILTIN_MAPS.barrio_urbana);

    // Cargador rápido de modelos externos de prueba (.glb / .gltf / .obj)
    let activeTestModelRoot: THREE.Object3D | null = null;
    let activeTestModelMixer: THREE.AnimationMixer | null = null;
    let activeTestModelUrl: string | null = null;
    let testModelStatus: string | null = null;
    const testModelGeos: THREE.BufferGeometry[] = [];
    const testModelMats: THREE.Material[] = [];

    const clearTestModel = () => {
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
      testModelStatus = null;
    };
    clearTestModelFnRef.current = clearTestModel;

    const finalizeTestModel = (
      loadedRoot: THREE.Object3D,
      animations: THREE.AnimationClip[],
      url: string,
      options: TestModelLoadOptions
    ) => {
      if (disposed) return;
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
      loadedRoot.position.set(
        -_tmpVec3B.x * scale,
        -_tmpBox3A.min.y * scale,
        -_tmpVec3B.z * scale
      );
      wrapper.position.set(pos[0], pos[1], pos[2]);

      const isHonda = url.toLowerCase().includes('honda');
      const testMatCache = new Map<number, THREE.MeshStandardMaterial>();

      loadedRoot.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.frustumCulled = true;
          if (mesh.geometry) {
            testModelGeos.push(mesh.geometry);
            mesh.geometry.computeBoundingBox();
            mesh.geometry.computeBoundingSphere();
          }
          if (isHonda) {
            const oldMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
            const vis = resolveHondaPartVisual(mesh.name, oldMat?.name ?? '');
            if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m?.dispose());
            else oldMat?.dispose();
            let cached = testMatCache.get(vis.hex);
            if (!cached) {
              cached = new THREE.MeshStandardMaterial({
                color: vis.hex,
                metalness: vis.isMetal ? 0.85 : 0.2,
                roughness: vis.isMetal ? 0.25 : 0.55,
              });
              testMatCache.set(vis.hex, cached);
              testModelMats.push(cached);
            }
            mesh.material = cached;
          } else if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m && testModelMats.push(m));
          } else if (mesh.material) {
            testModelMats.push(mesh.material);
          }
          const bb = mesh.geometry?.boundingBox;
          const partMaxDim = bb
            ? Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) * scale
            : targetSize;
          const cast = allowShadow && partMaxDim >= 0.28;
          mesh.castShadow = cast;
          mesh.receiveShadow = cast;
        }
      });

      if (animations.length > 0) {
        activeTestModelMixer = new THREE.AnimationMixer(loadedRoot);
        activeTestModelMixer.clipAction(animations[0]).play();
      }
      scene.add(wrapper);
      activeTestModelRoot = wrapper;
      activeTestModelUrl = url;
      const shortName = url.split('/').pop() || 'modelo';
      testModelStatus = `${shortName} (${modelCacheManager.getSourceLabel(url)})`;
    };

    const loadTestModel = (url: string, options: TestModelLoadOptions = {}) => {
      const trimmed = url.trim();
      if (!trimmed) return;
      testModelStatus = 'Cargando...';
      loadModelCached(trimmed)
        .then(({ object, animations }) => finalizeTestModel(object, animations, trimmed, options))
        .catch(() => {
          if (!disposed) testModelStatus = 'Error al cargar modelo';
        });
    };
    loadTestModelFnRef.current = loadTestModel;
    (window as unknown as { loadTestModel?: typeof loadTestModel }).loadTestModel = loadTestModel;

    // 7. World physics step hooks
    world.addEventListener('preStep', () => {
      entityManager.fixedUpdate(PHYSICS_CONFIG.fixedTimeStep);
    });
    world.addEventListener('postStep', () => {
      playerEntity.capturePostStep();
      motorcycleEntity.capturePostStep();
    });

    const cycleView = () => {
      if (isFreeCam) isFreeCam = false;
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
      if (isFreeCam) isFreeCam = false;
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

    const toggleFreeCam = () => {
      isFreeCam = !isFreeCam;
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
    };
    toggleFreeCamFnRef.current = toggleFreeCam;

    const togglePause = () => timeManager.togglePause();
    togglePauseFnRef.current = togglePause;

    const toggleSlowMotion = () => timeManager.toggleSlowMotion();
    toggleSlowMotionFnRef.current = toggleSlowMotion;

    const toggleWave = () => {
      if (!motorcycleEntity.isMounted && !playerEntity.isRagdoll) {
        playerEntity.isWaving = !playerEntity.isWaving;
      }
    };
    toggleWaveFnRef.current = toggleWave;

    const mountMotorcycle = () => {
      if (playerEntity.isRagdoll) return;
      motorcycleEntity.isMounted = true;
      playerEntity.mountTo(motorcycleEntity.seatAnchor);
      prevBikeYaw = motorcycleEntity.headingYaw;
      camYaw = motorcycleEntity.headingYaw;
      fpsLookYawOffset = 0;
      if (cameraMode === 'FPS') fpsPitch = -0.14;
    };

    const dismountMotorcycle = () => {
      _dismountOffset.set(-1.35, 0.45, 0).applyQuaternion(motorcycleEntity.interpolatedQuaternion);
      _dismountPos.set(
        motorcycleEntity.interpolatedPosition.x + _dismountOffset.x,
        Math.max(motorcycleEntity.interpolatedPosition.y + 0.45, 0.9),
        motorcycleEntity.interpolatedPosition.z + _dismountOffset.z
      );
      motorcycleEntity.isMounted = false;
      playerEntity.dismountAt(_dismountPos, motorcycleEntity.headingYaw);
    };

    const quickSave = (): boolean => {
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
            headingQuat: [
              playerEntity.headingGroup.quaternion.x,
              playerEntity.headingGroup.quaternion.y,
              playerEntity.headingGroup.quaternion.z,
              playerEntity.headingGroup.quaternion.w,
            ],
            health: playerEntity.health,
            isWaving: playerEntity.isWaving,
            isMounted: motorcycleEntity.isMounted,
            camYaw,
          },
          motorcycle: {
            pos: [motorcycleEntity.body.position.x, motorcycleEntity.body.position.y, motorcycleEntity.body.position.z],
            quat: [
              motorcycleEntity.body.quaternion.x,
              motorcycleEntity.body.quaternion.y,
              motorcycleEntity.body.quaternion.z,
              motorcycleEntity.body.quaternion.w,
            ],
            vel: [motorcycleEntity.body.velocity.x, motorcycleEntity.body.velocity.y, motorcycleEntity.body.velocity.z],
            speed: motorcycleEntity.currentForwardSpeed,
            yaw: motorcycleEntity.headingYaw,
          },
          doors: mapDoors.map((d) => ({ open: d.doorOpen, angle: d.currentAngle })),
          testModelUrl: activeTestModelUrl,
        };
        window.localStorage.setItem(QUICKSAVE_STORAGE_KEY, JSON.stringify(snapshot));
        saveStatus = 'Estado guardado';
        return true;
      } catch {
        saveStatus = 'Error al guardar';
        return false;
      }
    };
    quickSaveFnRef.current = quickSave;

    const quickLoad = (): boolean => {
      try {
        const raw = window.localStorage.getItem(QUICKSAVE_STORAGE_KEY);
        if (!raw) {
          saveStatus = 'Sin guardado previo';
          return false;
        }
        const snap = JSON.parse(raw);
        if (playerEntity.isRagdoll) {
          playerEntity.recoverFromRagdoll(camYaw);
        }
        if (motorcycleEntity.isMounted && !snap.player?.isMounted) {
          dismountMotorcycle();
        }
        if (snap.motorcycle) {
          const mp = snap.motorcycle.pos;
          const mq = snap.motorcycle.quat;
          const mv = snap.motorcycle.vel;
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
            const pp = snap.player.pos;
            const pv = snap.player.vel;
            const hq = snap.player.headingQuat;
            playerEntity.body.position.set(pp[0], pp[1], pp[2]);
            playerEntity.body.velocity.set(pv[0], pv[1], pv[2]);
            playerEntity.syncInterpolationBuffers();
            playerEntity.group.position.set(pp[0], pp[1], pp[2]);
            if (Array.isArray(hq) && hq.length === 4) {
              playerEntity.headingGroup.quaternion.set(hq[0], hq[1], hq[2], hq[3]);
            }
          }
          playerEntity.health = snap.player.health ?? 100;
          playerEntity.isWaving = Boolean(snap.player.isWaving);
          camYaw = snap.player.camYaw ?? 0;
          prevBikeYaw = motorcycleEntity.headingYaw;
        }
        if (Array.isArray(snap.doors)) {
          for (let i = 0; i < Math.min(snap.doors.length, mapDoors.length); i++) {
            mapDoors[i].doorOpen = Boolean(snap.doors[i].open);
            mapDoors[i].currentAngle =
              snap.doors[i].angle ?? (mapDoors[i].doorOpen ? Math.PI * 0.5 : 0);
          }
        }
        if (snap.testModelUrl && snap.testModelUrl !== activeTestModelUrl) {
          loadTestModel(snap.testModelUrl);
        } else if (!snap.testModelUrl && activeTestModelUrl) {
          clearTestModel();
        }
        saveStatus = 'Estado cargado';
        return true;
      } catch {
        saveStatus = 'Error al cargar';
        return false;
      }
    };
    quickLoadFnRef.current = quickLoad;

    let interactTargetType: InteractTargetType = null;
    let interactTargetDoor: DoorEntity | null = null;
    let interactPrompt: string | null = null;
    let lastReportedKey = '';

    const interact = () => {
      audioManager.unlock();
      if (isFreeCam) return;
      if (playerEntity.isRagdoll) {
        if (playerEntity.canRecoverManually()) {
          playerEntity.recoverFromRagdoll(camYaw);
        }
        return;
      }
      if (motorcycleEntity.isMounted) {
        dismountMotorcycle();
        return;
      }
      if (interactTargetType === 'motorcycle') {
        mountMotorcycle();
      } else if (interactTargetType === 'door' && interactTargetDoor) {
        interactTargetDoor.toggle();
      }
    };
    interactFnRef.current = interact;

    resetFnRef.current = () => {
      playerEntity.reset(activeCheckpoint);
      motorcycleEntity.reset();
      motorcycleEntity.isMounted = false;
      for (let i = 0; i < mapDoors.length; i++) mapDoors[i].reset();
      triggerSystem.reset();
      lastTriggerLabel = null;
      saveStatus = null;
      timeManager.setTimeScale(1.0);
      isFreeCam = false;
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

    getCopyPosFnRef.current = () => {
      const pPos = motorcycleEntity.isMounted
        ? motorcycleEntity.interpolatedPosition
        : playerEntity.interpolatedPosition;
      const r1 = (n: number) => Number(n.toFixed(2));
      const pArr: [number, number, number] = [r1(pPos.x), r1(pPos.y), r1(pPos.z)];
      const cArr: [number, number, number] = [
        r1(camera.position.x),
        r1(camera.position.y),
        r1(camera.position.z),
      ];
      const colliderObj = {
        type: 'box',
        pos: [pArr[0], r1(Math.max(0.5, pArr[1] - 0.35)), pArr[2]],
        rot: [0, 0, 0],
        scale: [2.2, 1.0, 2.2],
        visible: true,
        color: '#94a3b8',
      };
      return {
        playerPos: pArr,
        camPos: cArr,
        colliderJson: JSON.stringify(colliderObj, null, 2),
      };
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      audioManager.unlock();
      const tag = (e.target as HTMLElement | null)?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'SELECT';
      if (inInput) return;
      keys[e.code] = true;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!isFreeCam) {
          if (playerEntity.isRagdoll && playerEntity.canRecoverManually()) {
            playerEntity.recoverFromRagdoll(camYaw);
          } else if (!motorcycleEntity.isMounted && !playerEntity.isRagdoll) {
            jumpQueueRef.current = true;
          }
        }
      }
      if (e.code === 'KeyV' && !e.repeat) cycleView();
      if (e.code === 'KeyC' && !e.repeat) toggleFreeCam();
      if (e.code === 'F2' && !e.repeat) {
        e.preventDefault();
        toggleCameraMode();
      }
      if (e.code === 'KeyP' && !e.repeat) togglePause();
      if (e.code === 'KeyL' && !e.repeat) toggleSlowMotion();
      if (e.code === 'KeyF' && !e.repeat) toggleWave();
      if (e.code === 'KeyE' && !e.repeat) interact();
      if (e.code === 'KeyG' && !e.repeat) quickSave();
      if (e.code === 'KeyK' && !e.repeat) quickLoad();
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
      const sens = cameraSensitivityRef.current;
      const dx = (e.clientX - lastPointerX) * sens;
      const dy = (e.clientY - lastPointerY) * sens;
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
    };
    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerId === cameraPointerId) {
        isDraggingCamera = false;
        cameraPointerId = null;
      }
    };
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (isFreeCam) {
        freeCamSpeed = THREE.MathUtils.clamp(freeCamSpeed - e.deltaY * 0.01, 2.5, 28);
      } else if (cameraMode === 'TPS') {
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
      applyQualityPreset(qualityPreset);
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
    renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('resize', handleResize);
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

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
    let fpsFrames = 0;
    let fpsAccum = 0;
    let reportedFps = 60;
    let reportedDrawCalls = 0;
    let reportedTriangles = 0;

    function tick() {
      if (disposed) return;

      const rawDt = Math.min(clock.getDelta(), 0.05);
      const scaledDt = rawDt * timeManager.timeScale;
      fpsFrames += 1;
      fpsAccum += rawDt;
      if (fpsAccum >= 0.4) {
        reportedFps = Math.max(1, Math.round(fpsFrames / fpsAccum));
        fpsFrames = 0;
        fpsAccum = 0;
      }
      if (boostCooldown > 0) boostCooldown = Math.max(0, boostCooldown - rawDt);

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

      if (isFreeCam) {
        driveState.throttle = 0;
        driveState.steer = 0;
        steerState.inputMag = 0;
        steerState.maxSpeed = 0;
        steerState.jumpQueued = false;
        jumpQueueRef.current = false;
      } else if (playerEntity.isRagdoll) {
        driveState.throttle = 0;
        driveState.steer = 0;
        steerState.inputMag = 0;
        steerState.maxSpeed = 0;
        steerState.jumpQueued = false;
        if (jumpQueueRef.current && playerEntity.canRecoverManually()) {
          playerEntity.recoverFromRagdoll(camYaw);
        }
        jumpQueueRef.current = false;
      } else if (motorcycleEntity.isMounted) {
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

      if (scaledDt > 0) {
        world.step(PHYSICS_CONFIG.fixedTimeStep, scaledDt, 3);
      }

      // Sincronizar objetos dinámicos del mapa JSON
      for (let i = 0; i < mapDynamicObjects.length; i++) {
        const dyn = mapDynamicObjects[i];
        dyn.mesh.position.set(dyn.body.position.x, dyn.body.position.y, dyn.body.position.z);
        dyn.mesh.quaternion.set(
          dyn.body.quaternion.x,
          dyn.body.quaternion.y,
          dyn.body.quaternion.z,
          dyn.body.quaternion.w
        );
      }

      playerEntity.setMountedSteer(motorcycleEntity.smoothSteerAngle);
      const alpha = THREE.MathUtils.clamp(
        world.accumulator / PHYSICS_CONFIG.fixedTimeStep,
        0,
        1
      );
      entityManager.update(scaledDt, alpha);
      if (activeTestModelMixer && scaledDt > 0) {
        activeTestModelMixer.update(scaledDt);
      }
      if (!playerEntity.isRagdoll && scaledDt > 0) {
        triggerSystem.update(
          motorcycleEntity.isMounted ? 'motorcycle' : 'player',
          motorcycleEntity.isMounted ? motorcycleEntity.body : playerEntity.body,
          scaledDt
        );
      }

      const speedRatio = THREE.MathUtils.clamp(
        Math.abs(motorcycleEntity.currentForwardSpeed) / VEHICLE_CONFIG.maxForwardSpeed,
        0,
        1
      );
      audioManager.updateEngine(
        speedRatio,
        motorcycleEntity.isMounted,
        timeManager.isPaused,
        timeManager.timeScale,
        driveState.throttle
      );

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

      const activePreset = CAMERA_VIEWS[currentViewIndex];
      const realHorizSpeed = motorcycleEntity.isMounted
        ? Math.abs(motorcycleEntity.currentForwardSpeed)
        : Math.hypot(playerEntity.body.velocity.x, playerEntity.body.velocity.z);

      if (isFreeCam) {
        const flySpeed =
          freeCamSpeed * (keys['ShiftLeft'] || keys['ShiftRight'] ? 2.1 : 1.0);
        const cosPitch = Math.cos(freeCamPitch);
        _freeCamDir
          .set(
            -Math.sin(freeCamYaw) * cosPitch,
            Math.sin(freeCamPitch),
            -Math.cos(freeCamYaw) * cosPitch
          )
          .normalize();
        _freeCamRight.set(Math.cos(freeCamYaw), 0, -Math.sin(freeCamYaw));
        const vertInput =
          (keys['Space'] ? 1 : 0) -
          (keys['KeyQ'] || keys['ControlLeft'] || keys['ControlRight'] ? 1 : 0);

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
          const targetFov =
            (motorcycleEntity.isMounted ? 80 : 75) + (realHorizSpeed > 6 ? 6.5 * speedRatio : 0);
          smoothFov = THREE.MathUtils.damp(smoothFov, targetFov, 10, rawDt);
          if (Math.abs(camera.fov - smoothFov) > 0.02) {
            camera.fov = smoothFov;
            camera.updateProjectionMatrix();
          }

          const effectiveYaw = motorcycleEntity.isMounted
            ? motorcycleEntity.headingYaw + fpsLookYawOffset
            : camYaw;

          const cosPitch = Math.cos(fpsPitch);
          const eyeForwardDist = motorcycleEntity.isMounted ? 0.14 : 0.08;
          _fpsForwardOffset.set(
            -Math.sin(effectiveYaw) * eyeForwardDist,
            motorcycleEntity.isMounted ? 0.04 : 0.01,
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
          let gtaLagDistOffset = 0;
          if (motorcycleEntity.isMounted) {
            if (driveState.throttle > 0.05) {
              gtaLagDistOffset =
                0.95 * driveState.throttle * (0.35 + 0.65 * speedRatio);
            } else if (
              driveState.throttle < -0.05 &&
              motorcycleEntity.currentForwardSpeed > 0.8
            ) {
              gtaLagDistOffset = -0.7 * Math.abs(driveState.throttle) * speedRatio;
            }
          }
          const baseDist = motorcycleEntity.isMounted
            ? Math.max(activePreset.distance, 5.2) + gtaLagDistOffset
            : activePreset.distance;
          smoothDistance = THREE.MathUtils.damp(
            smoothDistance,
            THREE.MathUtils.clamp(baseDist + zoomOffset, 2.2, 12.5),
            5.5,
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
            motorcycleEntity.isMounted ? 1.18 : activePreset.targetHeight,
            7,
            rawDt
          );
          const targetFov = activePreset.fov + (realHorizSpeed > 4.0 ? 7.5 * speedRatio : 0);
          smoothFov = THREE.MathUtils.damp(smoothFov, targetFov, 6.5, rawDt);
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
          currentLookAt.x = THREE.MathUtils.damp(currentLookAt.x, _lookTarget.x, 12, rawDt);
          currentLookAt.y = THREE.MathUtils.damp(currentLookAt.y, _lookTarget.y, 12, rawDt);
          currentLookAt.z = THREE.MathUtils.damp(currentLookAt.z, _lookTarget.z, 12, rawDt);

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
              _desiredCamPos.copy(_lookTarget).addScaledVector(_rayDir, safeDist);
            }
          }
          _desiredCamPos.y = Math.max(0.38, _desiredCamPos.y);

          const followLambda = motorcycleEntity.isMounted ? 6.6 : 9.5;
          currentCamPos.x = THREE.MathUtils.damp(currentCamPos.x, _desiredCamPos.x, followLambda, rawDt);
          currentCamPos.y = THREE.MathUtils.damp(currentCamPos.y, _desiredCamPos.y, followLambda, rawDt);
          currentCamPos.z = THREE.MathUtils.damp(currentCamPos.z, _desiredCamPos.z, followLambda, rawDt);
          currentCamPos.y = Math.max(0.35, currentCamPos.y);
        }

        _shakeOffset.set(0, 0, 0);
        if (shakeTimer > 0) {
          if (!timeManager.isPaused) shakeTimer = Math.max(0, shakeTimer - rawDt);
          const decay = shakeDuration > 0 ? shakeTimer / shakeDuration : 0;
          const mag = shakeIntensity * decay;
          _shakeOffset.set(
            (Math.random() * 2 - 1) * mag,
            (Math.random() * 2 - 1) * mag * 0.85,
            (Math.random() * 2 - 1) * mag
          );
          if (shakeTimer === 0) shakeIntensity = 0;
        }

        camera.position.copy(currentCamPos).add(_shakeOffset);
        camera.lookAt(currentLookAt);
      }

      // EngineRaycaster unificado
      if (isFreeCam || playerEntity.isRagdoll) {
        interactTargetType = null;
        interactTargetDoor = null;
        interactPrompt = null;
      } else if (motorcycleEntity.isMounted) {
        interactTargetType = 'dismount';
        interactTargetDoor = null;
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
            interactTargetDoor = null;
            interactPrompt = 'Presiona E para subir a la moto';
          } else if (hitType === 'door' && distToPlayer <= DOOR_CONFIG.interactDistance) {
            interactTargetType = 'door';
            interactTargetDoor = (hit.object.userData.doorEntity as DoorEntity | undefined) ?? mapDoors[0] ?? null;
            interactPrompt = interactTargetDoor?.doorOpen
              ? 'Presiona E para cerrar la puerta'
              : 'Presiona E para abrir la puerta';
          } else {
            interactTargetType = null;
            interactTargetDoor = null;
            interactPrompt = null;
          }
        } else {
          interactTargetType = null;
          interactTargetDoor = null;
          interactPrompt = null;
        }
      }

      renderer.render(scene, camera);
      reportedDrawCalls = renderer.info.render.calls;
      reportedTriangles = renderer.info.render.triangles;

      const speedKmh = Math.round(Math.abs(motorcycleEntity.currentForwardSpeed) * 3.6);
      const viewLabel = isFreeCam
        ? 'Free-Cam'
        : cameraMode === 'FPS'
        ? 'Primera Persona'
        : activePreset.label;
      const anyDoorOpen = mapDoors.some((d) => d.doorOpen);
      const px = Number(focusPos.x.toFixed(1));
      const py = Number(focusPos.y.toFixed(1));
      const pz = Number(focusPos.z.toFixed(1));
      const cx = Number(camera.position.x.toFixed(1));
      const cy = Number(camera.position.y.toFixed(1));
      const cz = Number(camera.position.z.toFixed(1));
      const optKey = motorcycleEntity.optStats
        ? `${motorcycleEntity.optStats.beforeMeshes}-${motorcycleEntity.optStats.afterDrawCalls}`
        : '0';

      const stateKey = `${playerEntity.reportedAnim}|${playerEntity.isGrounded}|${viewLabel}|${cameraMode}|${isFreeCam}|${timeManager.timeScale}|${playerEntity.health}|${playerEntity.isWaving}|${motorcycleEntity.isMounted}|${speedKmh}|${interactTargetType}|${anyDoorOpen}|${motorcycleEntity.detectedParts.length}|${reportedFps}|${reportedDrawCalls}|${reportedTriangles}|${optKey}|${modelCacheStatus}|${qualityPreset}|${activeMapName}|${px},${py},${pz}|${cx},${cy},${cz}|${lastTriggerLabel}|${saveStatus}|${testModelStatus}`;
      if (stateKey !== lastReportedKey) {
        lastReportedKey = stateKey;
        onStateChangeRef.current({
          animState: playerEntity.reportedAnim,
          grounded: playerEntity.isGrounded,
          viewLabel,
          cameraMode,
          freeCam: isFreeCam,
          timeScale: timeManager.timeScale,
          health: playerEntity.health,
          isWaving: playerEntity.isWaving,
          isMounted: motorcycleEntity.isMounted,
          vehicleSpeedKmh: speedKmh,
          interactPrompt,
          interactType: interactTargetType,
          doorOpen: anyDoorOpen,
          hondaParts: motorcycleEntity.detectedParts,
          fps: reportedFps,
          drawCalls: reportedDrawCalls,
          triangles: reportedTriangles,
          hondaOptStats: motorcycleEntity.optStats,
          modelCacheStatus,
          qualityPreset,
          activeMapName,
          playerXYZ: [px, py, pz],
          camXYZ: [cx, cy, cz],
          lastTrigger: lastTriggerLabel,
          saveStatus,
          testModelStatus,
        });
      }

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
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      clearCurrentMap();
      clearTestModel();
      audioManager.dispose();
      audioManagerRef.current = null;
      entityManager.clear();
      sharedCoreGeometries.forEach((g) => g.dispose());
      sharedCoreMaterials.forEach((m) => m.dispose());
      envTexture.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="h-full w-full" />;
});
