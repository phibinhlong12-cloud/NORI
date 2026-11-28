import * as THREE from 'three';
import { CHUNK_SIZE } from './constants';
import { WorldManager } from './world';

export class FirstPersonPlayer {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly world: WorldManager;
  private readonly tempEuler = new THREE.Euler(0, 0, 0, 'YXZ');

  readonly halfWidth = 0.3;
  readonly height = 1.75;
  readonly eyeHeight = 1.6;

  readonly position = new THREE.Vector3(0.5, 4.05, 0.5);
  readonly velocity = new THREE.Vector3(0, 0, 0);

  yaw = 0;
  pitch = -0.06;

  walkSpeed = 5.4;
  sprintSpeed = 8.6;
  moveSpeedMultiplier = 1.0;
  // Thời gian nhảy lên + rớt xuống trên mặt phẳng = ~0.70 giây (t_up ≈ 0.365s, t_down ≈ 0.335s, cao ~1.50 block)
  jumpForce = 8.22;
  upGravity = 22.52;
  fallGravity = 26.73;
  onGround = false;

  keys: Record<string, boolean> = {};
  sensitivity = 0.00225;
  private joystickMoveX = 0;
  private joystickMoveY = 0;

  private knockRemX = 0;
  private knockRemZ = 0;
  private knockTimer = 0;

  // Hỗ trợ nhạy nút nhảy & hoạt ảnh camera khi nhảy/tiếp đất/chạy
  private wasSpaceDown = false;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;

  private eyeOffsetY = 0;
  private eyeOffsetVel = 0;
  private jumpPitchOffset = 0;
  private jumpPitchVel = 0;
  private strideBobPhase = 0;
  private strideBobWeight = 0;
  private currentFov = 72;
  private readonly baseFov = 72;

  private smoothViewmodelLagY = 0;
  private viewmodelStrideX = 0;
  private viewmodelStrideY = 0;

  constructor(camera: THREE.PerspectiveCamera, world: WorldManager) {
    this.camera = camera;
    this.world = world;
  }

  getViewmodelMotion(): { lagY: number; strideX: number; strideY: number } {
    return {
      lagY: this.smoothViewmodelLagY,
      strideX: this.viewmodelStrideX,
      strideY: this.viewmodelStrideY,
    };
  }

  private resetMotionEffects(): void {
    this.wasSpaceDown = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.eyeOffsetY = 0;
    this.eyeOffsetVel = 0;
    this.jumpPitchOffset = 0;
    this.jumpPitchVel = 0;
    this.strideBobPhase = 0;
    this.strideBobWeight = 0;
    this.smoothViewmodelLagY = 0;
    this.viewmodelStrideX = 0;
    this.viewmodelStrideY = 0;
    if (Math.abs(this.currentFov - this.baseFov) > 0.01) {
      this.currentFov = this.baseFov;
      this.camera.fov = this.baseFov;
      this.camera.updateProjectionMatrix();
    }
  }

  spawnAtSafeHeight(x = 0.5, z = 0.5): void {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        this.world.generateChunkData(cx + dx, cz + dz, false);
      }
    }

    for (const key of Array.from(this.world.dirtyChunks)) {
      const ch = this.world.chunks.get(key);
      if (ch) this.world.buildChunkMesh(ch);
      this.world.dirtyChunks.delete(key);
    }

    const groundY = this.world.getMaxGroundHeightInBox(x, z, this.halfWidth);
    const spawnY = Math.max(groundY, 4.0) + 0.05;

    this.position.set(x, spawnY, z);
    this.velocity.set(0, 0, 0);
    this.onGround = true;
    this.resetMotionEffects();
    this.updateCameraTransform();
  }

  respawnAtStart(): void {
    this.yaw = 0;
    this.pitch = -0.06;
    this.knockRemX = 0;
    this.knockRemZ = 0;
    this.knockTimer = 0;
    this.spawnAtSafeHeight(0.5, 0.5);
  }

  teleportTo(x: number, y: number, z: number, yaw: number, pitch: number): void {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        this.world.generateChunkData(cx + dx, cz + dz, false);
      }
    }

    for (const key of Array.from(this.world.dirtyChunks)) {
      const ch = this.world.chunks.get(key);
      if (ch) this.world.buildChunkMesh(ch);
      this.world.dirtyChunks.delete(key);
    }

    const groundY = this.world.getMaxGroundHeightInBox(x, z, this.halfWidth);
    const safeY = Math.max(y, groundY + 0.02);

    this.yaw = yaw;
    this.pitch = pitch;
    this.knockRemX = 0;
    this.knockRemZ = 0;
    this.knockTimer = 0;
    this.position.set(x, safeY, z);
    this.velocity.set(0, 0, 0);
    this.onGround = safeY <= groundY + 0.05;
    this.resetMotionEffects();
    this.updateCameraTransform();
  }

  applyKnockback(dirX: number, dirZ: number, distance = 0.5, duration = 0.1): void {
    const len = Math.hypot(dirX, dirZ);
    if (len < 0.0001 || distance <= 0) return;
    this.knockRemX = (dirX / len) * distance;
    this.knockRemZ = (dirZ / len) * distance;
    this.knockTimer = Math.max(0.05, duration);
  }

  setJoystickVector(x: number, y: number): void {
    const len = Math.hypot(x, y);
    if (len > 1) {
      this.joystickMoveX = x / len;
      this.joystickMoveY = y / len;
    } else {
      this.joystickMoveX = x;
      this.joystickMoveY = y;
    }
  }

  rotate(dx: number, dy: number): void {
    this.yaw -= dx * this.sensitivity;
    this.pitch -= dy * this.sensitivity;
    const maxPitch = Math.PI / 2 - 0.02;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
  }

  private getObstacleTopY(
    px: number,
    py: number,
    pz: number,
    prevX?: number,
    prevZ?: number,
  ): number | null {
    let highestTop = this.world.getTreeObstacleTopY(
      px,
      py,
      pz,
      this.halfWidth,
      this.height,
      prevX,
      prevZ,
    );

    const minX = Math.floor(px - this.halfWidth);
    const maxX = Math.floor(px + this.halfWidth);
    const minY = Math.floor(py + 0.02);
    const maxY = Math.floor(py + this.height);
    const minZ = Math.floor(pz - this.halfWidth);
    const maxZ = Math.floor(pz + this.halfWidth);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (this.world.isSolidBlock(x, y, z)) {
            const blockTop = y + 1;
            if (highestTop === null || blockTop > highestTop) {
              highestTop = blockTop;
            }
          }
        }
      }
    }

    return highestTop;
  }

  intersectsBlock(bx: number, by: number, bz: number): boolean {
    const pMinX = this.position.x - this.halfWidth;
    const pMaxX = this.position.x + this.halfWidth;
    const pMinY = this.position.y;
    const pMaxY = this.position.y + this.height;
    const pMinZ = this.position.z - this.halfWidth;
    const pMaxZ = this.position.z + this.halfWidth;

    return (
      pMaxX > bx &&
      pMinX < bx + 1 &&
      pMaxY > by &&
      pMinY < by + 1 &&
      pMaxZ > bz &&
      pMinZ < bz + 1
    );
  }

  update(dt: number): { jumped: boolean; landedImpact: number } {
    const clampedDt = Math.min(dt, 0.05);
    let jumped = false;
    let landedImpact = 0;

    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    let moveForward = this.joystickMoveY;
    let moveRight = this.joystickMoveX;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) moveForward += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) moveForward -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) moveRight += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveRight -= 1;

    const rawMag = Math.hypot(moveForward, moveRight);
    let wishX = 0;
    let wishZ = 0;
    if (rawMag > 0.001) {
      const throttle = Math.min(1, rawMag);
      const normForward = moveForward / rawMag;
      const normRight = moveRight / rawMag;
      wishX = (forwardX * normForward + rightX * normRight) * throttle;
      wishZ = (forwardZ * normForward + rightZ * normRight) * throttle;
    }

    const isSprinting = Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    const targetSpeed =
      (isSprinting ? this.sprintSpeed : this.walkSpeed) * this.moveSpeedMultiplier;

    const accel = this.onGround ? 14.0 : 5.5;
    const blend = Math.min(1, accel * clampedDt);
    this.velocity.x += (wishX * targetSpeed - this.velocity.x) * blend;
    this.velocity.z += (wishZ * targetSpeed - this.velocity.z) * blend;

    // Coyote time & jump buffer giúp nhảy mượt, không bị khựng khi vừa chạm hoặc vừa rời mép đất
    if (this.onGround) {
      this.coyoteTimer = 0.1;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - clampedDt);
    }

    const spaceDown = Boolean(this.keys['Space']);
    if (spaceDown && !this.wasSpaceDown) {
      this.jumpBufferTimer = 0.12;
    } else if (spaceDown && this.onGround) {
      this.jumpBufferTimer = 0.05;
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - clampedDt);
    }
    this.wasSpaceDown = spaceDown;

    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.velocity.y = this.jumpForce;
      this.onGround = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      jumped = true;

      // Nhún nhẹ lúc bật nhảy để hoạt ảnh góc nhìn thứ nhất có lực đẩy tự nhiên
      this.eyeOffsetY = Math.max(this.eyeOffsetY, -0.025);
      this.eyeOffsetVel += 0.35;
      this.jumpPitchVel += 0.14;
    }

    // Tích phân parabol chính xác theo điểm đỉnh (không phụ thuộc FPS) -> đúng 0.70 giây lên & xuống
    const prevVelY = this.velocity.y;
    let verticalDeltaY: number;
    if (prevVelY > 0 && prevVelY - this.upGravity * clampedDt <= 0) {
      const tCross = prevVelY / this.upGravity;
      const tRem = clampedDt - tCross;
      verticalDeltaY = 0.5 * prevVelY * tCross - 0.5 * this.fallGravity * tRem * tRem;
      this.velocity.y = -this.fallGravity * tRem;
    } else {
      const g = prevVelY > 0 ? this.upGravity : this.fallGravity;
      this.velocity.y = prevVelY - g * clampedDt;
      verticalDeltaY = 0.5 * (prevVelY + this.velocity.y) * clampedDt;
    }

    let knockStepX = 0;
    let knockStepZ = 0;
    if (this.knockTimer > 0) {
      const frac = Math.min(1, clampedDt / this.knockTimer);
      knockStepX = this.knockRemX * frac;
      knockStepZ = this.knockRemZ * frac;
      this.knockRemX -= knockStepX;
      this.knockRemZ -= knockStepZ;
      this.knockTimer = Math.max(0, this.knockTimer - clampedDt);
    }

    // Di chuyển theo trục X, hỗ trợ leo mượt theo độ dốc parabol nhưng bị chặn bởi tường và thân gỗ
    const nextX = this.position.x + this.velocity.x * clampedDt + knockStepX;
    const groundAtNextX = this.world.getMaxGroundHeightInBox(
      nextX,
      this.position.z,
      this.halfWidth,
    );
    const slopeStepYForX =
      groundAtNextX > this.position.y && groundAtNextX - this.position.y <= 0.65
        ? groundAtNextX
        : this.position.y;
    const obsX = this.getObstacleTopY(
      nextX,
      slopeStepYForX,
      this.position.z,
      this.position.x,
      this.position.z,
    );
    if (obsX === null) {
      this.position.x = nextX;
    } else if (this.onGround && obsX > this.position.y && obsX - this.position.y <= 0.12) {
      this.position.x = nextX;
      this.position.y = obsX + 0.001;
    } else {
      this.velocity.x = 0;
    }

    // Di chuyển theo trục Z, hỗ trợ leo mượt theo độ dốc parabol nhưng bị chặn bởi tường và thân gỗ
    const nextZ = this.position.z + this.velocity.z * clampedDt + knockStepZ;
    const groundAtNextZ = this.world.getMaxGroundHeightInBox(
      this.position.x,
      nextZ,
      this.halfWidth,
    );
    const slopeStepYForZ =
      groundAtNextZ > this.position.y && groundAtNextZ - this.position.y <= 0.65
        ? groundAtNextZ
        : this.position.y;
    const obsZ = this.getObstacleTopY(
      this.position.x,
      slopeStepYForZ,
      nextZ,
      this.position.x,
      this.position.z,
    );
    if (obsZ === null) {
      this.position.z = nextZ;
    } else if (this.onGround && obsZ > this.position.y && obsZ - this.position.y <= 0.12) {
      this.position.z = nextZ;
      this.position.y = obsZ + 0.001;
    } else {
      this.velocity.z = 0;
    }

    // Giải quyết độ cao mặt đất liên tục + va chạm tường thành và thân gỗ nằm trên đất
    const wasOnGround = this.onGround;
    const groundY = this.world.getMaxGroundHeightInBox(
      this.position.x,
      this.position.z,
      this.halfWidth,
    );
    let nextY = this.position.y + verticalDeltaY;
    const obsY = this.getObstacleTopY(this.position.x, nextY, this.position.z);

    if (
      obsY === null &&
      this.onGround &&
      this.velocity.y <= 0 &&
      nextY > groundY &&
      nextY - groundY < 0.32
    ) {
      nextY = groundY;
    }

    if (nextY <= groundY) {
      this.position.y = groundY;
      if (this.velocity.y < 0) {
        this.onGround = true;
      }
      this.velocity.y = 0;
    } else if (obsY === null) {
      this.position.y = nextY;
      this.onGround = false;
    } else {
      if (this.velocity.y <= 0 && this.position.y >= obsY - 0.18) {
        this.onGround = true;
        this.position.y = obsY + 0.001;
      }
      this.velocity.y = 0;
    }

    // Tạo độ nhún êm ái khi vừa tiếp đất sau cú nhảy
    if (!wasOnGround && this.onGround) {
      const impact = Math.abs(prevVelY);
      if (impact > 2.2) {
        landedImpact = Math.min(1, impact / 10.5);
        this.eyeOffsetVel -= 0.85 + 0.75 * landedImpact;
        this.jumpPitchVel -= 0.13 + 0.11 * landedImpact;
      }
    }

    if (this.position.y < -10) {
      this.spawnAtSafeHeight(this.position.x, this.position.z);
    }

    this.updateCameraEffects(clampedDt, isSprinting);
    this.updateCameraTransform();

    return { jumped, landedImpact };
  }

  private updateCameraEffects(dt: number, isSprinting: boolean): void {
    // Lò xo giảm chấn cho tầm mắt khi bật nhảy / tiếp đất
    const eyeForce = -210 * this.eyeOffsetY - 24 * this.eyeOffsetVel;
    this.eyeOffsetVel += eyeForce * dt;
    this.eyeOffsetY = Math.max(-0.14, Math.min(0.08, this.eyeOffsetY + this.eyeOffsetVel * dt));

    const pitchForce = -170 * this.jumpPitchOffset - 22 * this.jumpPitchVel;
    this.jumpPitchVel += pitchForce * dt;
    this.jumpPitchOffset = Math.max(
      -0.045,
      Math.min(0.035, this.jumpPitchOffset + this.jumpPitchVel * dt),
    );

    // Nhịp bước chân tự nhiên khi chạy trên mặt đất, tắt mượt khi đang bay giữa không trung
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const targetBobWeight = this.onGround && horizSpeed > 0.45 ? Math.min(1, horizSpeed / 5.4) : 0;
    const bobBlend = 1 - Math.exp(-12 * dt);
    this.strideBobWeight += (targetBobWeight - this.strideBobWeight) * bobBlend;
    if (this.strideBobWeight > 0.01) {
      this.strideBobPhase += dt * (isSprinting ? 12.2 : 9.2);
    }

    // Quán tính cho kiếm Katana & Khiên khi nhảy lên / rớt xuống
    const targetLagY = this.onGround
      ? this.eyeOffsetY * 0.45
      : Math.max(-0.045, Math.min(0.045, -this.velocity.y * 0.005));
    const lagBlend = 1 - Math.exp(-14 * dt);
    this.smoothViewmodelLagY += (targetLagY - this.smoothViewmodelLagY) * lagBlend;
    this.viewmodelStrideX = Math.cos(this.strideBobPhase * 0.5) * 0.01 * this.strideBobWeight;
    this.viewmodelStrideY = Math.abs(Math.sin(this.strideBobPhase)) * -0.012 * this.strideBobWeight;

    // Mở rộng nhẹ góc nhìn (FOV) khi đang bay hoặc chạy nhanh
    const targetFov =
      this.baseFov +
      (this.onGround ? 0 : 1.35) +
      (isSprinting && horizSpeed > 5.5 ? 1.1 : 0);
    this.currentFov += (targetFov - this.currentFov) * (1 - Math.exp(-9 * dt));
    if (Math.abs(this.camera.fov - this.currentFov) > 0.01) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }
  }

  updateCameraTransform(): void {
    const strideY =
      (Math.sin(this.strideBobPhase * 2) * 0.016 - 0.008) * this.strideBobWeight;
    const strideRoll = Math.cos(this.strideBobPhase) * 0.0045 * this.strideBobWeight;

    this.camera.position.set(
      this.position.x,
      this.position.y + this.eyeHeight + this.eyeOffsetY + strideY,
      this.position.z,
    );
    const effectivePitch = Math.max(
      -Math.PI / 2 + 0.02,
      Math.min(Math.PI / 2 - 0.02, this.pitch + this.jumpPitchOffset),
    );
    this.tempEuler.set(effectivePitch, this.yaw, strideRoll, 'YXZ');
    this.camera.quaternion.setFromEuler(this.tempEuler);
  }
}
