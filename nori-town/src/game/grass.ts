import * as THREE from 'three';
import { CHUNK_SIZE } from './constants';
import { OutsideGenerator } from './outside';
import { isInsideDragonZone, isInsideSlimeZone } from './slimeZones';

interface ChunkGrassBatch {
  tuftMesh: THREE.InstancedMesh | null;
  flowerMesh: THREE.InstancedMesh | null;
  cx: number;
  cz: number;
}

function seededRand(x: number, z: number, seed: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7 + seed * 31.73) * 43758.5453123;
  return n - Math.floor(n);
}

function createGrassTuftGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const rootColor = new THREE.Color('#235416');
  const midColor = new THREE.Color('#57b231');
  const tipColor = new THREE.Color('#9be854');
  const tmpColor = new THREE.Color();

  // 5 ngọn cỏ uốn cong tỏa nhẹ ra xung quanh thành khóm cỏ sắc nét
  const bladeConfigs = [
    { angle: 0.0, offsetR: 0.04, height: 0.54, width: 0.075, lean: 0.14 },
    { angle: 1.25, offsetR: 0.07, height: 0.46, width: 0.068, lean: 0.18 },
    { angle: 2.52, offsetR: 0.06, height: 0.58, width: 0.078, lean: 0.16 },
    { angle: 3.85, offsetR: 0.08, height: 0.44, width: 0.065, lean: 0.2 },
    { angle: 5.05, offsetR: 0.05, height: 0.5, width: 0.072, lean: 0.15 },
  ];

  let vBase = 0;

  for (const b of bladeConfigs) {
    const dirX = Math.cos(b.angle);
    const dirZ = Math.sin(b.angle);
    const perpX = -dirZ;
    const perpZ = dirX;
    const ox = dirX * b.offsetR;
    const oz = dirZ * b.offsetR;

    const hw0 = b.width * 0.5;
    const hw1 = b.width * 0.34;
    const y1 = b.height * 0.52;
    const lean1 = b.lean * 0.38;
    const lean2 = b.lean;

    const nx = dirX * 0.25;
    const ny = 0.94;
    const nz = dirZ * 0.25;

    // 0: root-left, 1: root-right
    positions.push(ox - perpX * hw0, -0.03, oz - perpZ * hw0);
    positions.push(ox + perpX * hw0, -0.03, oz + perpZ * hw0);
    // 2: mid-left, 3: mid-right
    positions.push(ox + dirX * lean1 - perpX * hw1, y1, oz + dirZ * lean1 - perpZ * hw1);
    positions.push(ox + dirX * lean1 + perpX * hw1, y1, oz + dirZ * lean1 + perpZ * hw1);
    // 4: sharp tip
    positions.push(ox + dirX * lean2, b.height, oz + dirZ * lean2);

    for (let i = 0; i < 5; i++) {
      normals.push(nx, ny, nz);
    }

    uvs.push(0, 0, 1, 0, 0, 0.52, 1, 0.52, 0.5, 1.0);

    colors.push(
      rootColor.r, rootColor.g, rootColor.b,
      rootColor.r, rootColor.g, rootColor.b,
    );
    tmpColor.copy(midColor);
    colors.push(
      tmpColor.r, tmpColor.g, tmpColor.b,
      tmpColor.r, tmpColor.g, tmpColor.b,
    );
    colors.push(tipColor.r, tipColor.g, tipColor.b);

    indices.push(
      vBase, vBase + 1, vBase + 2,
      vBase + 1, vBase + 3, vBase + 2,
      vBase + 2, vBase + 3, vBase + 4,
    );

    vBase += 5;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

function createWildflowerGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // Thân hoa xanh mảnh + cụm bông hoa 4 cánh nhỏ ở ngọn
  const stemColor = new THREE.Color('#3b8a24');
  const blossomColor = new THREE.Color('#ffffff');

  // Thân chéo 2 mặt (4 đỉnh mỗi mặt)
  let vBase = 0;
  for (let p = 0; p < 2; p++) {
    const angle = (p * Math.PI) / 2;
    const px = Math.cos(angle) * 0.022;
    const pz = Math.sin(angle) * 0.022;
    positions.push(-px, -0.02, -pz, px, -0.02, pz, px, 0.42, pz, -px, 0.42, -pz);
    for (let i = 0; i < 4; i++) {
      normals.push(0, 1, 0);
      colors.push(stemColor.r, stemColor.g, stemColor.b);
    }
    uvs.push(0, 0, 1, 0, 1, 0.88, 0, 0.88);
    indices.push(vBase, vBase + 1, vBase + 2, vBase, vBase + 2, vBase + 3);
    vBase += 4;
  }

  // Bông hoa 4 cánh hơi nghiêng hướng lên trời (để setColorAt nhuộm màu hoa)
  const petalAngles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
  for (const a of petalAngles) {
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const rx = -dz;
    const rz = dx;
    const cy = 0.43;
    positions.push(
      dx * 0.015, cy, dz * 0.015,
      dx * 0.095 - rx * 0.045, cy + 0.035, dz * 0.095 - rz * 0.045,
      dx * 0.13, cy + 0.055, dz * 0.13,
      dx * 0.095 + rx * 0.045, cy + 0.035, dz * 0.095 + rz * 0.045,
    );
    for (let i = 0; i < 4; i++) {
      normals.push(0, 1, 0);
      colors.push(blossomColor.r, blossomColor.g, blossomColor.b);
    }
    uvs.push(0.5, 0.92, 0, 1.0, 0.5, 1.0, 1, 1.0);
    indices.push(vBase, vBase + 1, vBase + 2, vBase, vBase + 2, vBase + 3);
    vBase += 4;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

export class GrassManager {
  private readonly scene: THREE.Scene;
  private readonly outside: OutsideGenerator;
  private readonly seed: number;

  private readonly tuftGeo: THREE.BufferGeometry;
  private readonly flowerGeo: THREE.BufferGeometry;
  private readonly grassMat: THREE.MeshStandardMaterial;
  private readonly flowerMat: THREE.MeshStandardMaterial;
  private readonly timeUniform = { value: 0 };

  private readonly chunkBatches = new Map<string, ChunkGrassBatch>();
  private readonly tempDummy = new THREE.Object3D();
  private readonly tempColor = new THREE.Color();

  private readonly flowerPalette = [
    new THREE.Color('#fef08a'), // Vàng nắng
    new THREE.Color('#ffffff'), // Trắng cúc dại
    new THREE.Color('#bae6fd'), // Xanh lưu ly
    new THREE.Color('#fbcfe8'), // Hồng phấn
  ];

  constructor(scene: THREE.Scene, outside: OutsideGenerator, seed: number) {
    this.scene = scene;
    this.outside = outside;
    this.seed = seed;

    this.tuftGeo = createGrassTuftGeometry();
    this.flowerGeo = createWildflowerGeometry();

    const applyWindShader = (mat: THREE.MeshStandardMaterial, amplitude: number, cacheKey: string) => {
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uGrassTime = this.timeUniform;
        shader.vertexShader =
          `uniform float uGrassTime;\n` +
          shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            #ifdef USE_INSTANCING
              vec4 grassWorldBase = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            #else
              vec4 grassWorldBase = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            #endif
            float tipWeight = pow(clamp(position.y / 0.52, 0.0, 1.0), 1.45);
            float windWave = sin(uGrassTime * 2.15 + grassWorldBase.x * 0.28 + grassWorldBase.z * 0.22);
            float windGust = cos(uGrassTime * 3.65 + grassWorldBase.x * 0.64 - grassWorldBase.z * 0.51) * 0.36;
            float swayAmount = (windWave + windGust) * ${amplitude.toFixed(3)} * tipWeight;
            transformed.x += swayAmount;
            transformed.z += swayAmount * 0.62;
            transformed.y -= abs(swayAmount) * 0.24 * tipWeight;`,
          );
      };
      mat.customProgramCacheKey = () => cacheKey;
    };

    this.grassMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.74,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    applyWindShader(this.grassMat, 0.165, 'meadow-grass-wind-v1');

    this.flowerMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.65,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    applyWindShader(this.flowerMat, 0.145, 'meadow-flower-wind-v1');
  }

  generateGrassForChunk(cx: number, cz: number, chunkKey: string): void {
    if (this.chunkBatches.has(chunkKey)) return;

    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;

    const tuftTransforms: Array<{
      x: number;
      y: number;
      z: number;
      rotY: number;
      scaleXZ: number;
      scaleY: number;
      tintR: number;
      tintG: number;
      tintB: number;
    }> = [];

    const flowerTransforms: Array<{
      x: number;
      y: number;
      z: number;
      rotY: number;
      scale: number;
      colorIdx: number;
    }> = [];

    // Lưới 14x14 điểm trên mỗi chunk 16x16 để thảm cỏ phủ đều đẹp mắt
    const gridCount = 14;
    const cellSpan = CHUNK_SIZE / gridCount;

    for (let gz = 0; gz < gridCount; gz++) {
      for (let gx = 0; gx < gridCount; gx++) {
        const cellX = baseX + gx * cellSpan;
        const cellZ = baseZ + gz * cellSpan;

        const rSpawn = seededRand(cellX * 1.3, cellZ * 1.3, this.seed + 109);
        const rx = seededRand(cellX + 7, cellZ + 13, this.seed + 223);
        const rz = seededRand(cellX + 31, cellZ + 47, this.seed + 349);

        const wx = cellX + rx * cellSpan;
        const wz = cellZ + rz * cellSpan;

        if (!this.outside.isGrassAllowedAt(wx, wz)) continue;
        if (isInsideDragonZone(wx, wz, 2.2)) continue;

        const inZone = isInsideSlimeZone(wx, wz, 0.4);
        const spawnThreshold = inZone ? 0.56 : 0.14;
        if (rSpawn < spawnThreshold) continue;

        const wy = this.outside.getHeightAt(wx, wz);
        const rVar = seededRand(wx * 3.1, wz * 3.1, this.seed + 577);
        const rScale = seededRand(wx * 5.7, wz * 2.3, this.seed + 733);

        // Chừa vài bông hoa dại xen kẽ trên thảm cỏ ngoài thành
        if (!inZone && rVar > 0.935) {
          flowerTransforms.push({
            x: wx,
            y: wy,
            z: wz,
            rotY: rVar * Math.PI * 2,
            scale: 0.85 + rScale * 0.45,
            colorIdx: Math.floor(rScale * this.flowerPalette.length) % this.flowerPalette.length,
          });
        }

        // Biến thiên sắc xanh nhẹ cho từng khóm cỏ
        this.tempColor.setHSL(
          0.255 + (rVar - 0.5) * 0.045,
          0.56 + rScale * 0.14,
          0.48 + (rScale - 0.5) * 0.12,
        );

        tuftTransforms.push({
          x: wx,
          y: wy,
          z: wz,
          rotY: rVar * Math.PI * 2,
          scaleXZ: 0.82 + rScale * 0.55,
          scaleY: 0.72 + rVar * 0.68,
          tintR: this.tempColor.r,
          tintG: this.tempColor.g,
          tintB: this.tempColor.b,
        });
      }
    }

    let tuftMesh: THREE.InstancedMesh | null = null;
    if (tuftTransforms.length > 0) {
      tuftMesh = new THREE.InstancedMesh(this.tuftGeo, this.grassMat, tuftTransforms.length);
      tuftMesh.receiveShadow = true;
      tuftMesh.castShadow = false;
      tuftMesh.matrixAutoUpdate = false;
      tuftMesh.updateMatrix();

      for (let i = 0; i < tuftTransforms.length; i++) {
        const t = tuftTransforms[i];
        this.tempDummy.position.set(t.x, t.y, t.z);
        this.tempDummy.rotation.set(0, t.rotY, 0);
        this.tempDummy.scale.set(t.scaleXZ, t.scaleY, t.scaleXZ);
        this.tempDummy.updateMatrix();
        tuftMesh.setMatrixAt(i, this.tempDummy.matrix);
        this.tempColor.setRGB(t.tintR, t.tintG, t.tintB);
        tuftMesh.setColorAt(i, this.tempColor);
      }
      tuftMesh.instanceMatrix.needsUpdate = true;
      if (tuftMesh.instanceColor) tuftMesh.instanceColor.needsUpdate = true;
      tuftMesh.computeBoundingSphere();
      this.scene.add(tuftMesh);
    }

    let flowerMesh: THREE.InstancedMesh | null = null;
    if (flowerTransforms.length > 0) {
      flowerMesh = new THREE.InstancedMesh(
        this.flowerGeo,
        this.flowerMat,
        flowerTransforms.length,
      );
      flowerMesh.receiveShadow = true;
      flowerMesh.castShadow = false;
      flowerMesh.matrixAutoUpdate = false;
      flowerMesh.updateMatrix();

      for (let i = 0; i < flowerTransforms.length; i++) {
        const f = flowerTransforms[i];
        this.tempDummy.position.set(f.x, f.y, f.z);
        this.tempDummy.rotation.set(0, f.rotY, 0);
        this.tempDummy.scale.setScalar(f.scale);
        this.tempDummy.updateMatrix();
        flowerMesh.setMatrixAt(i, this.tempDummy.matrix);
        flowerMesh.setColorAt(i, this.flowerPalette[f.colorIdx]);
      }
      flowerMesh.instanceMatrix.needsUpdate = true;
      if (flowerMesh.instanceColor) flowerMesh.instanceColor.needsUpdate = true;
      flowerMesh.computeBoundingSphere();
      this.scene.add(flowerMesh);
    }

    this.chunkBatches.set(chunkKey, { tuftMesh, flowerMesh, cx, cz });
  }

  removeGrassForChunk(chunkKey: string): void {
    const batch = this.chunkBatches.get(chunkKey);
    if (!batch) return;
    if (batch.tuftMesh) {
      this.scene.remove(batch.tuftMesh);
      batch.tuftMesh.dispose();
    }
    if (batch.flowerMesh) {
      this.scene.remove(batch.flowerMesh);
      batch.flowerMesh.dispose();
    }
    this.chunkBatches.delete(chunkKey);
  }

  update(dt: number, playerX: number, playerZ: number): void {
    this.timeUniform.value += dt;

    const playerCx = Math.floor(playerX / CHUNK_SIZE);
    const playerCz = Math.floor(playerZ / CHUNK_SIZE);
    const maxGrassDistSq = 12; // ~3.4 chunks bán kính cỏ lú để giữ FPS mượt mà

    for (const batch of this.chunkBatches.values()) {
      const dx = batch.cx - playerCx;
      const dz = batch.cz - playerCz;
      const show = dx * dx + dz * dz <= maxGrassDistSq;
      if (batch.tuftMesh) batch.tuftMesh.visible = show;
      if (batch.flowerMesh) batch.flowerMesh.visible = show;
    }
  }

  disposeAll(): void {
    for (const key of Array.from(this.chunkBatches.keys())) {
      this.removeGrassForChunk(key);
    }
    this.tuftGeo.dispose();
    this.flowerGeo.dispose();
    this.grassMat.dispose();
    this.flowerMat.dispose();
  }
}
