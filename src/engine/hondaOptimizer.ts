import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { VEHICLE_CONFIG } from '../scene/courseConfig';

export interface HondaOptStats {
  beforeMeshes: number;
  beforeTriangles: number;
  afterDrawCalls: number;
  afterTriangles: number;
}

export interface OptimizedHondaResult {
  bikeRoot: THREE.Group;
  forkPivot: THREE.Group;
  frontWheelSpin: THREE.Group;
  rearWheelSpin: THREE.Group;
  seatPosition: THREE.Vector3;
  hasSeatMesh: boolean;
  rearAxleZ: number;
  partsList: string[];
  stats: HondaOptStats;
}

type HondaBucketKind =
  | 'chassisPainted'
  | 'chassisMetal'
  | 'chassisLights'
  | 'forkMetal'
  | 'forkLights'
  | 'frontWheel'
  | 'rearWheel';

interface HondaMasterMaterials {
  chassisPainted: THREE.MeshStandardMaterial;
  chassisMetal: THREE.MeshStandardMaterial;
  emissiveLights: THREE.MeshStandardMaterial;
  wheelHybrid: THREE.MeshStandardMaterial;
}

const _tmpBoxA = new THREE.Box3();
const _tmpBoxB = new THREE.Box3();
const _tmpVecA = new THREE.Vector3();
const _tmpVecB = new THREE.Vector3();
const _tmpVecC = new THREE.Vector3();
const _tmpVecD = new THREE.Vector3();
const _tmpMatA = new THREE.Matrix4();
const _tmpMatB = new THREE.Matrix4();
const _tmpMatC = new THREE.Matrix4();
const _tmpMatD = new THREE.Matrix4();
const _tmpMatE = new THREE.Matrix4();
const _tmpNormMat = new THREE.Matrix3();
const _tmpColor = new THREE.Color();

export function createHondaMasterMaterials(
  disposableMaterials: THREE.Material[]
): HondaMasterMaterials {
  const chassisPainted = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.42,
    metalness: 0.25,
  });
  const chassisMetal = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.24,
    metalness: 0.88,
  });
  const emissiveLights = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1.4,
    vertexColors: true,
    roughness: 0.18,
    metalness: 0.1,
  });
  const wheelHybrid = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.56,
    metalness: 0.36,
  });

  disposableMaterials.push(chassisPainted, chassisMetal, emissiveLights, wheelHybrid);
  return { chassisPainted, chassisMetal, emissiveLights, wheelHybrid };
}

export function resolveHondaPartVisual(
  meshName: string,
  matName: string
): {
  category: string;
  hex: number;
  isMetal: boolean;
  isEmissive: boolean;
} {
  const combined = `${meshName} ${matName}`.toLowerCase();

  if (combined.includes('stop') || combined.includes('tail')) {
    return { category: 'stop-emisivo', hex: 0xef4444, isMetal: false, isEmissive: true };
  }
  if (
    combined.includes('fanale') ||
    combined.includes('headlight') ||
    combined.includes('lamp')
  ) {
    return { category: 'faro-emisivo', hex: 0xfef3c7, isMetal: false, isEmissive: true };
  }
  if (combined.includes('frecc')) {
    return { category: 'intermitente', hex: 0xf59e0b, isMetal: false, isEmissive: true };
  }
  if (
    combined.includes('gomma') ||
    combined.includes('pneumatic') ||
    combined.includes('tire') ||
    combined.includes('wheel') ||
    combined.includes('ruota')
  ) {
    return { category: 'neumatico', hex: 0x151518, isMetal: false, isEmissive: false };
  }
  if (
    combined.includes('sella') ||
    combined.includes('11___default') ||
    combined.includes('seat') ||
    combined.includes('plasticanera') ||
    combined.includes('plastica_nera') ||
    combined.includes('plasticagrigia')
  ) {
    return { category: 'asiento/plastico', hex: 0x1f2229, isMetal: false, isEmissive: false };
  }
  if (
    combined.includes('cromo') ||
    combined.includes('crome') ||
    combined.includes('crhome') ||
    combined.includes('fregio') ||
    combined.includes('chrome') ||
    combined.includes('exhaust') ||
    combined.includes('scarico') ||
    combined.includes('pipe') ||
    combined.includes('fork') ||
    combined.includes('forcella') ||
    combined.includes('terminali') ||
    combined.includes('manubrio') ||
    combined.includes('specchio') ||
    combined.includes('cerchi') ||
    combined.includes('raggi') ||
    combined.includes('steel') ||
    combined.includes('bulloni') ||
    combined.includes('vetr')
  ) {
    return { category: 'cromo', hex: 0xe5e7eb, isMetal: true, isEmissive: false };
  }
  if (
    combined.includes('engine') ||
    combined.includes('carter') ||
    combined.includes('motore') ||
    combined.includes('cilind') ||
    combined.includes('block') ||
    combined.includes('testata') ||
    combined.includes('ingranaggio') ||
    combined.includes('catena') ||
    combined.includes('minuteria') ||
    combined.includes('brake') ||
    combined.includes('aria') ||
    combined.includes('pedale')
  ) {
    return { category: 'motor', hex: 0x4b5563, isMetal: true, isEmissive: false };
  }
  if (
    combined.includes('frame') ||
    combined.includes('vernice') ||
    combined.includes('telaio') ||
    combined.includes('tela') ||
    combined.includes('fender') ||
    combined.includes('parafango') ||
    combined.includes('cruscotto') ||
    combined.includes('tachimetri')
  ) {
    return { category: 'chasis-negro', hex: 0x111827, isMetal: false, isEmissive: false };
  }
  if (
    combined.includes('carrozzeria') ||
    combined.includes('tank') ||
    combined.includes('serbatoio') ||
    combined.includes('plasticabianca')
  ) {
    return { category: 'carroceria', hex: 0x991b1b, isMetal: false, isEmissive: false };
  }
  return { category: 'gris-neutro', hex: 0x525866, isMetal: false, isEmissive: false };
}

function createColoredGeometry(
  source: THREE.BufferGeometry,
  hex: number,
  transformMatrix?: THREE.Matrix4
): THREE.BufferGeometry | null {
  const geo = source.index ? source.toNonIndexed() : source.clone();
  const posAttr = geo.getAttribute('position');
  if (!posAttr || posAttr.count === 0) {
    geo.dispose();
    return null;
  }
  if (transformMatrix) {
    geo.applyMatrix4(transformMatrix);
  }
  if (!geo.getAttribute('normal')) {
    geo.computeVertexNormals();
  }
  // Elimina atributos innecesarios (UV, tangent, etc.) en mallas sin texturas
  for (const attrName of Object.keys(geo.attributes)) {
    if (attrName !== 'position' && attrName !== 'normal') {
      geo.deleteAttribute(attrName);
    }
  }
  _tmpColor.setHex(hex);
  const vCount = posAttr.count;
  const colorArr = new Float32Array(vCount * 3);
  for (let i = 0; i < vCount; i++) {
    colorArr[i * 3] = _tmpColor.r;
    colorArr[i * 3 + 1] = _tmpColor.g;
    colorArr[i * 3 + 2] = _tmpColor.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));
  return geo;
}

function buildColoredSubGeometry(
  source: THREE.BufferGeometry,
  triStarts: number[],
  hex: number,
  transformMatrix?: THREE.Matrix4
): THREE.BufferGeometry | null {
  if (triStarts.length === 0) return null;
  const srcPos = source.getAttribute('position');
  const srcNorm = source.getAttribute('normal');
  const vCount = triStarts.length * 3;
  const posArr = new Float32Array(vCount * 3);
  const normArr = srcNorm ? new Float32Array(vCount * 3) : null;
  const colorArr = new Float32Array(vCount * 3);
  const normalMat = transformMatrix ? _tmpNormMat.getNormalMatrix(transformMatrix) : null;
  _tmpColor.setHex(hex);

  for (let t = 0; t < triStarts.length; t++) {
    const base = triStarts[t];
    for (let k = 0; k < 3; k++) {
      const si = base + k;
      const di = t * 3 + k;
      _tmpVecA.fromBufferAttribute(srcPos, si);
      if (transformMatrix) _tmpVecA.applyMatrix4(transformMatrix);
      posArr[di * 3] = _tmpVecA.x;
      posArr[di * 3 + 1] = _tmpVecA.y;
      posArr[di * 3 + 2] = _tmpVecA.z;

      colorArr[di * 3] = _tmpColor.r;
      colorArr[di * 3 + 1] = _tmpColor.g;
      colorArr[di * 3 + 2] = _tmpColor.b;

      if (normArr && srcNorm) {
        _tmpVecB.fromBufferAttribute(srcNorm, si);
        if (normalMat) _tmpVecB.applyMatrix3(normalMat).normalize();
        normArr[di * 3] = _tmpVecB.x;
        normArr[di * 3 + 1] = _tmpVecB.y;
        normArr[di * 3 + 2] = _tmpVecB.z;
      }
    }
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  if (normArr) out.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
  else out.computeVertexNormals();
  out.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));
  return out;
}

export function buildOptimizedHondaRig(
  rawModel: THREE.Object3D,
  masterMats: HondaMasterMaterials,
  disposableGeometries: THREE.BufferGeometry[]
): OptimizedHondaResult {
  const bikeRoot = new THREE.Group();
  const scaleWrapper = new THREE.Group();
  bikeRoot.add(scaleWrapper);
  scaleWrapper.add(rawModel);

  rawModel.position.set(0, 0, 0);
  rawModel.rotation.set(0, 0, 0);
  rawModel.updateMatrixWorld(true);

  let headlightZ = 0;
  let tailLightZ = 0;
  const allMeshes: THREE.Mesh[] = [];
  let beforeTriangles = 0;

  rawModel.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      const n = mesh.name.toLowerCase();
      if (n.includes('fanale')) {
        _tmpBoxB.setFromObject(mesh);
        headlightZ = _tmpBoxB.getCenter(_tmpVecA).z;
      } else if (n.includes('stop')) {
        _tmpBoxB.setFromObject(mesh);
        tailLightZ = _tmpBoxB.getCenter(_tmpVecA).z;
      }
      if (mesh.geometry) {
        const idx = mesh.geometry.getIndex();
        const pos = mesh.geometry.getAttribute('position');
        if (idx) beforeTriangles += Math.floor(idx.count / 3);
        else if (pos) beforeTriangles += Math.floor(pos.count / 3);
      }
      allMeshes.push(mesh);
    }
  });

  if (headlightZ > tailLightZ) {
    rawModel.rotation.y = Math.PI;
  }

  // Cálculo único de Box3 y escala a 2.0m
  scaleWrapper.updateMatrixWorld(true);
  _tmpBoxA.setFromObject(scaleWrapper, true);
  _tmpBoxA.getSize(_tmpVecA);
  const maxHoriz = Math.max(_tmpVecA.x, _tmpVecA.z, 0.001);
  const uniformScale = VEHICLE_CONFIG.boxSize[2] / maxHoriz;
  scaleWrapper.scale.setScalar(uniformScale);
  _tmpBoxA.getCenter(_tmpVecB);
  scaleWrapper.position.set(
    -_tmpVecB.x * uniformScale,
    -VEHICLE_CONFIG.boxSize[1] / 2 - _tmpBoxA.min.y * uniformScale,
    -_tmpVecB.z * uniformScale
  );
  bikeRoot.updateMatrixWorld(true);

  const partLogMap = new Map<string, string>();
  const meshVisualInfo = new Map<
    THREE.Mesh,
    { category: string; hex: number; isMetal: boolean; isEmissive: boolean }
  >();
  const seatBox = _tmpBoxB.makeEmpty();
  let hasSeatMesh = false;
  const frontTireBox = new THREE.Box3();
  const rearTireBox = new THREE.Box3();
  _tmpMatA.copy(bikeRoot.matrixWorld).invert();

  for (let m = 0; m < allMeshes.length; m++) {
    const mesh = allMeshes[m];
    const meshLabel = mesh.name || '(sin-nombre)';
    const meshLower = meshLabel.toLowerCase();
    const oldMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const mName = oldMat?.name ?? '';
    const vis = resolveHondaPartVisual(meshLabel, mName);
    partLogMap.set(`${meshLabel} | ${mName || '(default)'}`, vis.category);
    meshVisualInfo.set(mesh, vis);

    if (Array.isArray(mesh.material)) mesh.material.forEach((om) => om?.dispose());
    else oldMat?.dispose();

    if (meshLower.includes('sella') || mName.toLowerCase().includes('11___default')) {
      seatBox.expandByObject(mesh);
      hasSeatMesh = true;
    }

    if (meshLower.includes('pneumatici')) {
      _tmpMatB.multiplyMatrices(_tmpMatA, mesh.matrixWorld);
      const posAttr = mesh.geometry.getAttribute('position');
      for (let i = 0; i < posAttr.count; i++) {
        _tmpVecA.fromBufferAttribute(posAttr, i).applyMatrix4(_tmpMatB);
        if (_tmpVecA.z < -0.15) frontTireBox.expandByPoint(_tmpVecA);
        else if (_tmpVecA.z > 0.15) rearTireBox.expandByPoint(_tmpVecA);
      }
    }
  }

  const partsList = Array.from(partLogMap.entries()).map(
    ([pair, category]) => `${pair} -> ${category}`
  );

  const seatPosition = new THREE.Vector3();
  if (hasSeatMesh && !seatBox.isEmpty()) {
    seatBox.getSize(_tmpVecA);
    seatPosition.set(
      0,
      seatBox.min.y + _tmpVecA.y * 0.38,
      seatBox.min.z + _tmpVecA.z * 0.34
    );
  } else {
    const minY = -VEHICLE_CONFIG.boxSize[1] / 2;
    const sizeY = (_tmpBoxA.max.y - _tmpBoxA.min.y) * uniformScale;
    const sizeZ = (_tmpBoxA.max.z - _tmpBoxA.min.z) * uniformScale;
    seatPosition.set(0, minY + sizeY * 0.62, -sizeZ * 0.5 + sizeZ * 0.64);
  }

  const frontAxle = frontTireBox.isEmpty()
    ? _tmpVecC.set(0, -0.221, -0.701)
    : frontTireBox.getCenter(_tmpVecC);
  const rearAxle = rearTireBox.isEmpty()
    ? _tmpVecD.set(0, -0.208, 0.622)
    : rearTireBox.getCenter(_tmpVecD);
  const rearAxleZ = rearAxle.z;

  const forkPivot = new THREE.Group();
  forkPivot.position.set(0, 0.36, -0.45);
  bikeRoot.add(forkPivot);

  const frontWheelSpin = new THREE.Group();
  frontWheelSpin.position.set(
    0,
    frontAxle.y - forkPivot.position.y,
    frontAxle.z - forkPivot.position.z
  );
  forkPivot.add(frontWheelSpin);

  const rearWheelSpin = new THREE.Group();
  rearWheelSpin.position.set(0, rearAxle.y, rearAxle.z);
  bikeRoot.add(rearWheelSpin);

  bikeRoot.updateMatrixWorld(true);
  _tmpMatA.copy(bikeRoot.matrixWorld).invert();
  _tmpMatB.copy(forkPivot.matrixWorld).invert();
  _tmpMatC.copy(frontWheelSpin.matrixWorld).invert();
  _tmpMatD.copy(rearWheelSpin.matrixWorld).invert();

  const buckets: Record<HondaBucketKind, THREE.BufferGeometry[]> = {
    chassisPainted: [],
    chassisMetal: [],
    chassisLights: [],
    forkMetal: [],
    forkLights: [],
    frontWheel: [],
    rearWheel: [],
  };

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const centroid = new THREE.Vector3();

  for (let m = 0; m < allMeshes.length; m++) {
    const mesh = allMeshes[m];
    const n = mesh.name.toLowerCase();
    const vis = meshVisualInfo.get(mesh)!;

    const isTrueWheelMesh =
      n.includes('pneumatici') ||
      n.includes('cerchi') ||
      n.includes('crhome') ||
      n.includes('brake');

    if (isTrueWheelMesh && !mesh.geometry.index) {
      const posAttr = mesh.geometry.getAttribute('position');
      _tmpMatE.multiplyMatrices(_tmpMatA, mesh.matrixWorld);
      const frontTris: number[] = [];
      const rearTris: number[] = [];
      const staticTris: number[] = [];
      const isTire = n.includes('pneumatici');
      const maxR = isTire ? 0.34 : n.includes('brake') ? 0.19 : 0.255;
      const maxX = isTire ? 0.08 : n.includes('brake') ? 0.075 : 0.068;

      for (let i = 0; i + 2 < posAttr.count; i += 3) {
        vA.fromBufferAttribute(posAttr, i).applyMatrix4(_tmpMatE);
        vB.fromBufferAttribute(posAttr, i + 1).applyMatrix4(_tmpMatE);
        vC.fromBufferAttribute(posAttr, i + 2).applyMatrix4(_tmpMatE);
        centroid.copy(vA).add(vB).add(vC).multiplyScalar(1 / 3);
        const dFront = Math.hypot(centroid.y - frontAxle.y, centroid.z - frontAxle.z);
        const dRear = Math.hypot(centroid.y - rearAxle.y, centroid.z - rearAxle.z);
        if (Math.abs(centroid.x) < maxX && dFront < maxR) frontTris.push(i);
        else if (Math.abs(centroid.x) < maxX && dRear < maxR && !n.includes('brake'))
          rearTris.push(i);
        else staticTris.push(i);
      }

      if (frontTris.length > 0) {
        _tmpMatE.multiplyMatrices(_tmpMatC, mesh.matrixWorld);
        const fg = buildColoredSubGeometry(mesh.geometry, frontTris, vis.hex, _tmpMatE);
        if (fg) buckets.frontWheel.push(fg);
      }
      if (rearTris.length > 0) {
        _tmpMatE.multiplyMatrices(_tmpMatD, mesh.matrixWorld);
        const rg = buildColoredSubGeometry(mesh.geometry, rearTris, vis.hex, _tmpMatE);
        if (rg) buckets.rearWheel.push(rg);
      }
      if (staticTris.length > 0) {
        _tmpMatE.multiplyMatrices(_tmpMatA, mesh.matrixWorld);
        const sg = buildColoredSubGeometry(mesh.geometry, staticTris, vis.hex, _tmpMatE);
        if (sg) {
          if (vis.isEmissive) buckets.chassisLights.push(sg);
          else if (vis.isMetal) buckets.chassisMetal.push(sg);
          else buckets.chassisPainted.push(sg);
        }
      }
      mesh.geometry.dispose();
      continue;
    }

    if (n.includes('manubrio') && !mesh.geometry.index) {
      const posAttr = mesh.geometry.getAttribute('position');
      _tmpMatE.multiplyMatrices(_tmpMatA, mesh.matrixWorld);
      const upperTris: number[] = [];
      const fixedTris: number[] = [];
      for (let i = 0; i + 2 < posAttr.count; i += 3) {
        vA.fromBufferAttribute(posAttr, i).applyMatrix4(_tmpMatE);
        vB.fromBufferAttribute(posAttr, i + 1).applyMatrix4(_tmpMatE);
        vC.fromBufferAttribute(posAttr, i + 2).applyMatrix4(_tmpMatE);
        centroid.copy(vA).add(vB).add(vC).multiplyScalar(1 / 3);
        if (centroid.y > 0.31 && centroid.z < -0.14) upperTris.push(i);
        else fixedTris.push(i);
      }
      if (upperTris.length > 0) {
        _tmpMatE.multiplyMatrices(_tmpMatB, mesh.matrixWorld);
        const bg = buildColoredSubGeometry(mesh.geometry, upperTris, vis.hex, _tmpMatE);
        if (bg) buckets.forkMetal.push(bg);
      }
      if (fixedTris.length > 0) {
        _tmpMatE.multiplyMatrices(_tmpMatA, mesh.matrixWorld);
        const fg = buildColoredSubGeometry(mesh.geometry, fixedTris, vis.hex, _tmpMatE);
        if (fg) buckets.chassisMetal.push(fg);
      }
      mesh.geometry.dispose();
      continue;
    }

    const isForkPart =
      n.includes('fanale') ||
      n.includes('tachimetri') ||
      n.includes('cruscotto') ||
      n.includes('vetri') ||
      n.includes('specchio');

    if (isForkPart) {
      _tmpMatE.multiplyMatrices(_tmpMatB, mesh.matrixWorld);
      const cg = createColoredGeometry(mesh.geometry, vis.hex, _tmpMatE);
      if (cg) {
        if (vis.isEmissive) buckets.forkLights.push(cg);
        else buckets.forkMetal.push(cg);
      }
    } else {
      _tmpMatE.multiplyMatrices(_tmpMatA, mesh.matrixWorld);
      const cg = createColoredGeometry(mesh.geometry, vis.hex, _tmpMatE);
      if (cg) {
        if (vis.isEmissive) buckets.chassisLights.push(cg);
        else if (vis.isMetal) buckets.chassisMetal.push(cg);
        else buckets.chassisPainted.push(cg);
      }
    }
    mesh.geometry.dispose();
  }

  bikeRoot.remove(scaleWrapper);

  let afterDrawCalls = 0;
  let afterTriangles = 0;

  const finalizeBucket = (
    geos: THREE.BufferGeometry[],
    targetGroup: THREE.Group,
    mat: THREE.Material,
    castShadow: boolean,
    receiveShadow: boolean
  ) => {
    if (geos.length === 0) return;
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (geos.length > 1) {
      for (let i = 0; i < geos.length; i++) geos[i].dispose();
    }
    if (!merged) return;
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    disposableGeometries.push(merged);
    const pos = merged.getAttribute('position');
    if (pos) afterTriangles += Math.floor(pos.count / 3);
    afterDrawCalls += 1;

    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.frustumCulled = true;
    targetGroup.add(mesh);
  };

  // Solo el chasis principal emite sombra real; piezas pequeñas/cromadas/ruedas evitan doble pase de shadow map
  finalizeBucket(buckets.chassisPainted, bikeRoot, masterMats.chassisPainted, true, true);
  finalizeBucket(buckets.chassisMetal, bikeRoot, masterMats.chassisMetal, false, true);
  finalizeBucket(buckets.chassisLights, bikeRoot, masterMats.emissiveLights, false, false);
  finalizeBucket(buckets.forkMetal, forkPivot, masterMats.chassisMetal, false, false);
  finalizeBucket(buckets.forkLights, forkPivot, masterMats.emissiveLights, false, false);
  finalizeBucket(buckets.frontWheel, frontWheelSpin, masterMats.wheelHybrid, false, false);
  finalizeBucket(buckets.rearWheel, rearWheelSpin, masterMats.wheelHybrid, false, false);

  return {
    bikeRoot,
    forkPivot,
    frontWheelSpin,
    rearWheelSpin,
    seatPosition,
    hasSeatMesh,
    rearAxleZ,
    partsList,
    stats: {
      beforeMeshes: allMeshes.length,
      beforeTriangles,
      afterDrawCalls,
      afterTriangles,
    },
  };
}
