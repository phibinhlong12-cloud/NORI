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
  jumpForce = 8.4;
  gravity = 24.0;
  onGround = false;

  keys: Record<string, boolean> = {};
  sensitivity = 0.00225;

  private knockRemX = 0;
  private knockRemZ = 0;
  private knockTimer = 0;

  constructor(camera: THREE.PerspectiveCamera, world: WorldManager) {
    this.camera = camera;
    this.world = world;
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

  applyKnockback(dirX: number, dirZ: number, distance = 0.5): void {
    const len = Math.hypot(dirX, dirZ);
    if (len < 0.0001 || distance <= 0) return;
    this.knockRemX = (dirX / len) * distance;
    this.knockRemZ = (dirZ / len) * distance;
    this.knockTimer = 0.1;
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

  update(dt: number): void {
    const clampedDt = Math.min(dt, 0.05);

    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    let moveForward = 0;
    let moveRight = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) moveForward += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) moveForward -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) moveRight += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveRight -= 1;

    let wishX = forwardX * moveForward + rightX * moveRight;
    let wishZ = forwardZ * moveForward + rightZ * moveRight;
    const wishLen = Math.hypot(wishX, wishZ);
    if (wishLen > 0) {
      wishX /= wishLen;
      wishZ /= wishLen;
    }

    const isSprinting = Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    const targetSpeed = isSprinting ? this.sprintSpeed : this.walkSpeed;

    const accel = this.onGround ? 14.0 : 5.5;
    const blend = Math.min(1, accel * clampedDt);
    this.velocity.x += (wishX * targetSpeed - this.velocity.x) * blend;
    this.velocity.z += (wishZ * targetSpeed - this.velocity.z) * blend;

    this.velocity.y -= this.gravity * clampedDt;
    if (this.keys['Space'] && this.onGround) {
      this.velocity.y = this.jumpForce;
      this.onGround = false;
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
    const groundY = this.world.getMaxGroundHeightInBox(
      this.position.x,
      this.position.z,
      this.halfWidth,
    );
    let nextY = this.position.y + this.velocity.y * clampedDt;
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

    if (this.position.y < -10) {
      this.spawnAtSafeHeight(this.position.x, this.position.z);
    }

    this.updateCameraTransform();
  }

  updateCameraTransform(): void {
    this.camera.position.set(
      this.position.x,
      this.position.y + this.eyeHeight,
      this.position.z,
    );
    this.tempEuler.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this.tempEuler);
  }
}
