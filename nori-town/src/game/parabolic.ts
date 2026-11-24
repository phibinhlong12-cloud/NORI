import * as THREE from 'three';

/**
 * Tạo hình khối parabol tròn xoay (LatheGeometry) không có góc cạnh 90 độ.
 * profileFn nhận t trong [0, 1] (từ đáy lên đỉnh) và trả về bán kính tại độ cao t.
 */
export function createParabolicLatheGeometry(
  height: number,
  maxRadius: number,
  profileFn: (t: number) => number,
  radialSegments = 20,
  heightSegments = 16,
  centerY = true,
): THREE.LatheGeometry {
  const points: THREE.Vector2[] = [];
  const yOffset = centerY ? -height * 0.5 : 0;

  for (let i = 0; i <= heightSegments; i++) {
    const t = i / heightSegments;
    const r = Math.max(0, profileFn(t) * maxRadius);
    const y = t * height + yOffset;
    points.push(new THREE.Vector2(r, y));
  }

  const geo = new THREE.LatheGeometry(points, radialSegments);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Tạo thân/chi tiết bầu parabol 3 trục (không góc 90 độ), định hướng dọc trục Y hoặc Z.
 */
export function createParabolicEllipsoidGeometry(
  width: number,
  height: number,
  depth: number,
  widthSegments = 18,
  heightSegments = 14,
): THREE.SphereGeometry {
  const geo = new THREE.SphereGeometry(0.5, widthSegments, heightSegments);
  geo.scale(width, height, depth);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Tạo mảnh vảy/giáp cong bo tròn hình hạt dẻ/parabol thay thế hoàn toàn BoxGeometry.
 */
export function createParabolicPlateGeometry(
  width: number,
  height: number,
  depth: number,
  curveSegments = 12,
): THREE.BufferGeometry {
  const hw = width * 0.44;
  const hd = depth * 0.44;
  const shape = new THREE.Shape();
  shape.moveTo(0, hd);
  shape.quadraticCurveTo(hw, hd, hw, 0);
  shape.quadraticCurveTo(hw, -hd, 0, -hd);
  shape.quadraticCurveTo(-hw, -hd, -hw, 0);
  shape.quadraticCurveTo(-hw, hd, 0, hd);

  const bevel = Math.min(height * 0.32, width * 0.12, depth * 0.12);
  const coreH = Math.max(0.02, height - bevel * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: coreH,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.85,
    bevelSegments: 3,
    curveSegments,
  });
  geo.rotateX(Math.PI / 2);
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

/**
 * Tạo ống xương/nhánh thuôn mượt dạng parabol dọc trục +X (từ x=0 đến x=length).
 */
export function createParabolicLimbXGeometry(
  length: number,
  rStart: number,
  rEnd: number,
  heightYScale = 1,
  depthZScale = 1,
  radialSegments = 14,
): THREE.BufferGeometry {
  const geo = createParabolicLatheGeometry(
    length,
    1,
    (t) => {
      if (t <= 0.001 || t >= 0.999) return 0;
      const capFactor = Math.sin(Math.min(1, t * 8) * (Math.PI / 2)) *
        Math.sin(Math.min(1, (1 - t) * 8) * (Math.PI / 2));
      const baseR = rStart + (rEnd - rStart) * (t * t * (3 - 2 * t));
      return baseR * capFactor;
    },
    radialSegments,
    14,
    false,
  );
  geo.rotateZ(-Math.PI / 2);
  geo.scale(1, heightYScale, depthZScale);
  geo.computeVertexNormals();
  return geo;
}
