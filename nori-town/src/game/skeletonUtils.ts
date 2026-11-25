import * as THREE from 'three';

export interface AxisBoneAnchor {
  boneIndex: number;
  pos: number;
  blendWidth?: number;
}

/**
 * Gắn skinIndex & skinWeight lên BufferGeometry dọc theo một trục tọa độ (x/y/z)
 * với nội suy smoothstep tại vùng khớp để da và vải uốn cong mềm mại khi xoay xương.
 */
export function applyAxisSkinWeights(
  geometry: THREE.BufferGeometry,
  axis: 'x' | 'y' | 'z',
  anchors: AxisBoneAnchor[],
): void {
  const posAttr = geometry.attributes.position;
  if (!posAttr || anchors.length === 0) return;

  const sorted = [...anchors].sort((a, b) => a.pos - b.pos);
  const count = posAttr.count;
  const skinIndices = new Uint16Array(count * 4);
  const skinWeights = new Float32Array(count * 4);

  for (let i = 0; i < count; i++) {
    const v =
      axis === 'x' ? posAttr.getX(i) : axis === 'y' ? posAttr.getY(i) : posAttr.getZ(i);

    let b0 = sorted[0].boneIndex;
    let b1 = b0;
    let w0 = 1;
    let w1 = 0;

    if (sorted.length > 1 && v > sorted[0].pos) {
      const last = sorted[sorted.length - 1];
      if (v >= last.pos) {
        b0 = last.boneIndex;
        b1 = last.boneIndex;
        w0 = 1;
        w1 = 0;
      } else {
        for (let k = 0; k < sorted.length - 1; k++) {
          const a0 = sorted[k];
          const a1 = sorted[k + 1];
          if (v <= a1.pos || k === sorted.length - 2) {
            const span = Math.max(1e-5, a1.pos - a0.pos);
            const mid = (a0.pos + a1.pos) * 0.5;
            const band = Math.max(1e-4, Math.min(span, a0.blendWidth ?? span));
            const raw = THREE.MathUtils.clamp((v - (mid - band * 0.5)) / band, 0, 1);
            const smooth = raw * raw * (3 - 2 * raw);
            b0 = a0.boneIndex;
            b1 = a1.boneIndex;
            w0 = 1 - smooth;
            w1 = smooth;
            break;
          }
        }
      }
    }

    const base = i * 4;
    skinIndices[base] = b0;
    skinIndices[base + 1] = b1;
    skinIndices[base + 2] = 0;
    skinIndices[base + 3] = 0;

    skinWeights[base] = w0;
    skinWeights[base + 1] = w1;
    skinWeights[base + 2] = 0;
    skinWeights[base + 3] = 0;
  }

  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
}

/**
 * Tạo THREE.SkinnedMesh và gắn vào THREE.Skeleton dùng chung trong một cụm khớp xương đã đặt ở tư thế nghỉ.
 */
export function bindSkinnedMeshToSkeleton(
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  skeleton: THREE.Skeleton,
  rigParent: THREE.Object3D,
  frustumCulled = false,
): THREE.SkinnedMesh {
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.frustumCulled = frustumCulled;
  rigParent.add(mesh);
  rigParent.updateMatrixWorld(true);
  mesh.bind(skeleton);
  return mesh;
}
