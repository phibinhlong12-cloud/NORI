import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { VoxelAudio } from './audio';
import { getCitadelZoneAt } from './citadel';
import {
  BLOCK_NAMES,
  BlockId,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  HOTBAR_BLOCKS,
} from './constants';
import { CashierStation } from './counter';
import {
  DRAGON_LEVEL,
  DRAGON_MIN_ATTACK_LEVEL,
  DragonBossHudState,
} from './dragon';
import { CharacterGender } from './firstPersonArms';
import { KatanaViewModel } from './katana';
import { MushroomEntity } from './mushroom';
import { FirstPersonPlayer } from './player';
import { PotionViewModel } from './potion';
import { RaycastHit, voxelRaycast } from './raycast';
import { ShieldViewModel } from './shield';
import { SlimeEntity } from './slime';
import {
  DRAGON_ZONE_SPEC,
  getXpForNextLevel,
  isInsideDragonZone,
  MAX_LEVEL,
  MAX_PLAYER_HP,
} from './slimeZones';
import { createSolidVoxelMaterial } from './textures';
import { BackpackItem, DetachedLog, InteractiveTree } from './trees';
import { SHOP_ITEM_NAMES, SHOP_ITEM_PRICES, ShopItemId } from './weaponShop';
import { WorldManager } from './world';

export interface HudStats {
  x: number;
  y: number;
  z: number;
  fps: number;
  chunkCount: number;
  money: number;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpToNext: number;
  hasBackpack: boolean;
  hasKatana: boolean;
  hasIceKatana: boolean;
  hasShield: boolean;
  backpackOpen: boolean;
  shopOpen: boolean;
  characterWindowOpen: boolean;
  gender: CharacterGender;
  holdingKatana: boolean;
  holdingPotionSlot: number | null;
  holdingPotionCount: number;
  shieldRaised: boolean;
  carryingLog: boolean;
  isShopTarget: boolean;
  isConveyorTarget: boolean;
  chopProgress: number;
  backpackItems: Array<BackpackItem | null>;
  bossHud: DragonBossHudState;
  targetName: string | null;
  targetCoords: [number, number, number] | null;
}

const TREE_HAND_CHOP_DURATION = 5.0;

export interface VoxelEngineCallbacks {
  onPlayingChange: (isPlaying: boolean, hasStarted: boolean) => void;
  onSlotChange: (slotIndex: number) => void;
  onToast: (message: string) => void;
  onWebGLError?: (message: string) => void;
}

interface TreeTarget {
  tree: InteractiveTree;
  point: THREE.Vector3;
  cutLocalY: number;
}

interface DetachedLogTarget {
  log: DetachedLog;
  point: THREE.Vector3;
}

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

function createSkyDome(sunDir: THREE.Vector3): {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
} {
  const geo = new THREE.SphereGeometry(1, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSunDir: { value: sunDir.clone().normalize() },
      uZenithColor: { value: new THREE.Color(0x1f64c8) },
      uMidSkyColor: { value: new THREE.Color(0x64a8f8) },
      uHorizonColor: { value: new THREE.Color(0xbbe0ff) },
      uGroundColor: { value: new THREE.Color(0x8bb6d6) },
      uSunColor: { value: new THREE.Color(0xfff5d6) },
      uStorm: { value: 0.0 },
      uTime: { value: 0.0 },
      uLightning: { value: 0.0 },
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vWorldDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorldDir;
      uniform vec3 uSunDir;
      uniform vec3 uZenithColor;
      uniform vec3 uMidSkyColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uGroundColor;
      uniform vec3 uSunColor;
      uniform float uStorm;
      uniform float uTime;
      uniform float uLightning;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise2D(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbmClouds(vec2 p) {
        float val = 0.0;
        float amp = 0.52;
        for (int i = 0; i < 4; i++) {
          val += noise2D(p) * amp;
          p = p * 2.06 + vec2(4.7, 2.3);
          amp *= 0.5;
        }
        return val;
      }

      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = clamp(dir.y, -1.0, 1.0);

        vec3 sky = mix(uHorizonColor, uMidSkyColor, smoothstep(0.0, 0.34, max(h, 0.0)));
        sky = mix(sky, uZenithColor, smoothstep(0.28, 0.92, max(h, 0.0)));
        if (h < 0.0) {
          sky = mix(uHorizonColor, uGroundColor, smoothstep(0.0, -0.35, h));
        }

        // Bầu trời giông bão xám xịt khi bước vào Lãnh Địa Rồng Băng
        vec3 stormZenith = vec3(0.07, 0.09, 0.13);
        vec3 stormMid = vec3(0.15, 0.18, 0.23);
        vec3 stormHorizon = vec3(0.26, 0.30, 0.36);
        vec3 stormGround = vec3(0.17, 0.21, 0.27);
        vec3 stormSky = mix(stormHorizon, stormMid, smoothstep(0.0, 0.36, max(h, 0.0)));
        stormSky = mix(stormSky, stormZenith, smoothstep(0.25, 0.9, max(h, 0.0)));
        if (h < 0.0) {
          stormSky = mix(stormHorizon, stormGround, smoothstep(0.0, -0.35, h));
        }
        sky = mix(sky, stormSky, uStorm);

        // Mây mỏng nhẹ lúc trời nắng
        if (dir.y > 0.04 && uStorm < 0.99) {
          vec2 cloudUv = dir.xz / (dir.y + 0.24) * 1.45;
          float n = noise2D(cloudUv) * 0.62 + noise2D(cloudUv * 2.15 + 3.7) * 0.38;
          float cloudMask = smoothstep(0.57, 0.84, n) * smoothstep(0.04, 0.26, dir.y);
          sky = mix(sky, vec3(0.97, 0.99, 1.0), cloudMask * 0.45 * (1.0 - uStorm));
        }

        // Mây đen cuồn cuộn kéo tới khi vào vùng Rồng Băng
        if (uStorm > 0.005 && dir.y > -0.02) {
          vec2 stormUv = dir.xz / (max(dir.y, 0.02) + 0.22) * 1.25;
          vec2 wind = vec2(uTime * 0.045, uTime * 0.028);
          float c1 = fbmClouds(stormUv + wind);
          float c2 = fbmClouds(stormUv * 1.9 - wind * 1.4 + vec2(9.1, 3.4));
          float horizonFade = smoothstep(-0.02, 0.14, dir.y);
          float denseMask = smoothstep(0.26, 0.78, c1 * 0.68 + c2 * 0.32) * horizonFade;
          vec3 darkCloud = mix(vec3(0.08, 0.10, 0.14), vec3(0.28, 0.32, 0.39), smoothstep(0.35, 0.85, c2));
          sky = mix(sky, darkCloud, denseMask * uStorm * 0.94);

          // Ánh chớp lóe sáng xuyên qua tầng mây đen
          if (uLightning > 0.005) {
            float boltGlow = smoothstep(0.32, 0.82, c2) * horizonFade;
            sky += vec3(0.68, 0.85, 1.0) * uLightning * (0.28 + boltGlow * 0.95) * uStorm;
          }
        }

        // Quầng nắng ấm & đĩa mặt trời (mờ dần khi mây đen kéo tới)
        float clearFactor = 1.0 - uStorm;
        if (clearFactor > 0.01) {
          float sunDot = max(dot(dir, uSunDir), 0.0);
          float halo = pow(sunDot, 12.0) * 0.36 + pow(sunDot, 64.0) * 0.42;
          float disc = smoothstep(0.9983, 0.9994, sunDot);
          sky += uSunColor * halo * clearFactor;
          sky = mix(sky, vec3(1.0, 0.99, 0.94), disc * 0.95 * clearFactor);
        }

        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return { mesh, material: mat };
}

function createLightningBoltMesh(material: THREE.Material): THREE.Mesh {
  const segments = 9;
  const vertices: number[] = [];
  const indices: number[] = [];

  let curX = 0;
  let curZ = 0;
  const totalHeight = 42;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const y = totalHeight * (1 - t);
    if (i > 0 && i < segments) {
      curX += (Math.sin(i * 4.3) * 1.9 + (i % 2 === 0 ? 1.15 : -1.15));
      curZ += Math.cos(i * 3.1) * 1.2;
    }
    const halfW = 0.24 * (1 - t * 0.45);
    vertices.push(curX - halfW, y, curZ);
    vertices.push(curX + halfW, y, curZ);
    if (i < segments) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeBoundingSphere();

  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  return mesh;
}

export class VoxelEngine {
  private readonly container: HTMLElement;
  private readonly callbacks: VoxelEngineCallbacks;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly world: WorldManager;
  private readonly player: FirstPersonPlayer;
  private readonly audio: VoxelAudio;
  private readonly katanaView: KatanaViewModel;
  private readonly shieldView: ShieldViewModel;
  private readonly potionView: PotionViewModel;

  private readonly solidMaterial: THREE.MeshStandardMaterial;
  private readonly envRenderTarget: THREE.WebGLRenderTarget;
  private readonly skyDome: THREE.Mesh;
  private readonly skyDomeMat: THREE.ShaderMaterial;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly sunLight: THREE.DirectionalLight;
  private readonly rimLight: THREE.DirectionalLight;
  private readonly sunOffset = new THREE.Vector3(46, 78, 32);
  private readonly sunShadowHalfExtent = 38;
  private readonly sunShadowMapSize: number;
  private readonly selectionBox: THREE.LineSegments;
  private readonly treeCutIndicator: THREE.Mesh;
  private readonly treeCutRingMat: THREE.MeshBasicMaterial;
  private readonly treeRingIdleColor = new THREE.Color(0xfbbf24);
  private readonly treeRingActiveColor = new THREE.Color(0x34d399);
  private readonly skyColor = new THREE.Color(0xb6dcff);
  private readonly clearSkyBg = new THREE.Color(0xb6dcff);
  private readonly stormSkyBg = new THREE.Color(0x3a424e);
  private readonly flashSkyBg = new THREE.Color(0xdbeafe);
  private readonly clearHemiSky = new THREE.Color(0xd6ecff);
  private readonly stormHemiSky = new THREE.Color(0x6b7a8f);
  private readonly clearHemiGround = new THREE.Color(0x3b5930);
  private readonly stormHemiGround = new THREE.Color(0x283645);
  private readonly clearSunColor = new THREE.Color(0xfff1d6);
  private readonly stormSunColor = new THREE.Color(0x88a2c4);
  private readonly clearRimColor = new THREE.Color(0x93c5fd);
  private readonly stormRimColor = new THREE.Color(0x7dd3fc);
  private readonly tempSkyColor = new THREE.Color();
  private readonly lightningGroup = new THREE.Group();
  private readonly lightningBolts: THREE.Mesh[] = [];
  private readonly lightningBoltMat: THREE.MeshBasicMaterial;
  private readonly lightningPointLight: THREE.PointLight;
  private readonly stormSnowPoints: THREE.Points;
  private readonly stormSnowPositions: Float32Array;
  private readonly stormSnowMat: THREE.PointsMaterial;
  private readonly rayDir = new THREE.Vector3();
  private readonly wallCheckDir = new THREE.Vector3();
  private readonly isSoftwareGl: boolean;
  private readonly statsListeners = new Set<(stats: HudStats) => void>();

  private stormBlend = 0;
  private stormAnimTime = 0;
  private wasInDragonZone = false;
  private lightningTimer = 1.4;
  private lightningFlash = 0;
  private lightningBoltTimer = 0;

  private renderDistance = 4;
  private selectedSlotIndex = 0;
  private interactionEnabled = false;
  private isPlaying = false;
  private hasStarted = false;
  private isMouseDragging = false;
  private isLeftMouseDown = false;
  private isTouchBreakHeld = false;
  private chopTreeId: string | null = null;
  private chopCutLocalY = 0;
  private chopElapsed = 0;
  private chopSoundTimer = 0;
  private chopCompletedWaitingRelease = false;
  private lastChopHintAt = 0;
  private lastHudChopProgress = 0;
  private lookTouchId: number | null = null;
  private lastTouchX = 0;
  private lastTouchY = 0;
  private touchClientX = 0;
  private touchClientY = 0;
  private touchTotalMove = 0;
  private touchTreeHoldActive = false;
  private lastTouchTimestamp = 0;
  private readonly touchRaycaster = new THREE.Raycaster();
  private readonly touchNdc = new THREE.Vector2();
  private isDisposed = false;
  private isContextLost = false;
  private readonly isTouchDevice: boolean;

  private frameId = 0;
  private lastTime = performance.now();
  private frameCount = 0;
  private fpsTimer = 0;
  private currentFps = 60;
  private hudSyncTimer = 0;
  private money = 0;
  private hp = MAX_PLAYER_HP;
  private level = 1;
  private xp = 0;
  private hurtInvulnTimer = 0;
  private safeHealTimer = 0;
  private backpackOpen = false;
  private shopOpen = false;
  private characterWindowOpen = false;
  private playerGender: CharacterGender = 'male';
  private holdingKatana = false;
  private holdingPotionSlot: number | null = null;
  private hasIceKatana = false;
  private shieldRaised = false;
  private currentTarget: RaycastHit | null = null;
  private currentTreeTarget: TreeTarget | null = null;
  private currentLogTarget: DetachedLogTarget | null = null;
  private currentConveyorTarget: { point: THREE.Vector3 } | null = null;
  private currentShopTarget: { point: THREE.Vector3 } | null = null;
  private currentSlimeTarget: { slime: SlimeEntity; point: THREE.Vector3 } | null = null;
  private currentMushroomTarget: { mushroom: MushroomEntity; point: THREE.Vector3 } | null = null;
  private currentDragonTarget: { point: THREE.Vector3; hp: number; maxHp: number } | null = null;
  private currentIceKatanaDropTarget: { point: THREE.Vector3 } | null = null;
  private latestStats: HudStats = {
    x: 0.5,
    y: 4.05,
    z: 0.5,
    fps: 60,
    chunkCount: 0,
    money: 0,
    hp: MAX_PLAYER_HP,
    maxHp: MAX_PLAYER_HP,
    level: 1,
    xp: 0,
    xpToNext: getXpForNextLevel(1),
    hasBackpack: false,
    hasKatana: false,
    hasIceKatana: false,
    hasShield: false,
    backpackOpen: false,
    shopOpen: false,
    characterWindowOpen: false,
    gender: 'male',
    holdingKatana: false,
    holdingPotionSlot: null,
    holdingPotionCount: 0,
    shieldRaised: false,
    carryingLog: false,
    isShopTarget: false,
    isConveyorTarget: false,
    chopProgress: 0,
    backpackItems: Array.from({ length: 9 }, () => null),
    bossHud: {
      visible: false,
      alive: true,
      level: DRAGON_LEVEL,
      hp: 100,
      maxHp: 100,
      activeSkill: null,
      phase: 'idle',
      warningLabel: null,
      warningProgress: 0,
      dropAvailable: false,
    },
    targetName: null,
    targetCoords: null,
  };

  constructor(container: HTMLElement, callbacks: VoxelEngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, this.isTouchDevice ? 1.5 : 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight,
    );
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = this.skyColor.clone();
    this.scene.fog = new THREE.Fog(
      this.skyColor.getHex(),
      this.renderDistance * CHUNK_SIZE * 0.48,
      this.renderDistance * CHUNK_SIZE * 1.02,
    );

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    this.envRenderTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    roomEnv.dispose();
    pmremGenerator.dispose();
    this.scene.environment = this.envRenderTarget.texture;
    this.scene.environmentIntensity = 0.55;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(
      72,
      width / height,
      0.1,
      Math.max(140, this.renderDistance * CHUNK_SIZE * 1.45),
    );

    const skyDomeParts = createSkyDome(this.sunOffset);
    this.skyDome = skyDomeParts.mesh;
    this.skyDomeMat = skyDomeParts.material;
    this.skyDome.scale.setScalar(Math.max(105, this.renderDistance * CHUNK_SIZE * 1.2));
    this.scene.add(this.skyDome);

    this.hemiLight = new THREE.HemisphereLight(0xd6ecff, 0x3b5930, 0.92);
    this.scene.add(this.hemiLight);

    this.sunShadowMapSize = this.isTouchDevice ? 1024 : 2048;
    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 1.95);
    this.sunLight.position.copy(this.sunOffset);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(this.sunShadowMapSize, this.sunShadowMapSize);
    this.sunLight.shadow.camera.left = -this.sunShadowHalfExtent;
    this.sunLight.shadow.camera.right = this.sunShadowHalfExtent;
    this.sunLight.shadow.camera.top = this.sunShadowHalfExtent;
    this.sunLight.shadow.camera.bottom = -this.sunShadowHalfExtent;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 180;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.035;
    this.sunLight.shadow.radius = 2.5;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight(0x93c5fd, 0.48);
    this.rimLight.position.set(-50, 45, -60);
    this.scene.add(this.rimLight);

    // Tia sét 3D & ánh chớp trên bầu trời Lãnh Địa Rồng Băng
    this.lightningBoltMat = new THREE.MeshBasicMaterial({
      color: 0xe8f4ff,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < 2; i++) {
      const bolt = createLightningBoltMesh(this.lightningBoltMat);
      bolt.visible = false;
      this.lightningBolts.push(bolt);
      this.lightningGroup.add(bolt);
    }
    this.lightningPointLight = new THREE.PointLight(0xdbeafe, 0, 140, 1.0);
    this.lightningPointLight.position.set(DRAGON_ZONE_SPEC.x, 32, DRAGON_ZONE_SPEC.z);
    this.lightningGroup.add(this.lightningPointLight);
    this.scene.add(this.lightningGroup);

    // Bụi tuyết bay lạnh lẽo khi ở trong vùng bão tuyết Rồng Băng
    const snowCount = this.isSoftwareGl ? 70 : 170;
    this.stormSnowPositions = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      this.stormSnowPositions[i * 3] = (Math.random() - 0.5) * 34;
      this.stormSnowPositions[i * 3 + 1] = (Math.random() - 0.35) * 18;
      this.stormSnowPositions[i * 3 + 2] = (Math.random() - 0.5) * 34;
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(this.stormSnowPositions, 3));
    this.stormSnowMat = new THREE.PointsMaterial({
      color: 0xe0f2fe,
      size: 0.16,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.stormSnowPoints = new THREE.Points(snowGeo, this.stormSnowMat);
    this.stormSnowPoints.frustumCulled = false;
    this.stormSnowPoints.visible = false;
    this.scene.add(this.stormSnowPoints);

    this.solidMaterial = createSolidVoxelMaterial();

    const maxAnisotropy = this.isSoftwareGl
      ? 1
      : Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.world = new WorldManager(this.scene, this.solidMaterial, maxAnisotropy);
    this.player = new FirstPersonPlayer(this.camera, this.world);
    this.player.spawnAtSafeHeight(0.5, 0.5);
    this.world.prewarmAround(-46, 12, Math.min(3, this.renderDistance));
    this.world.prewarmAround(this.player.position.x, this.player.position.z, this.renderDistance);
    this.applyTitleMeadowCamera(performance.now());
    this.updateSunShadowTarget(this.camera.position.x, this.camera.position.y, this.camera.position.z);
    this.audio = new VoxelAudio();
    this.katanaView = new KatanaViewModel(this.scene);
    this.shieldView = new ShieldViewModel(this.scene);
    this.potionView = new PotionViewModel(this.scene);

    const boxGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006));
    const boxMat = new THREE.LineBasicMaterial({ color: 0x0f172a, linewidth: 2 });
    this.selectionBox = new THREE.LineSegments(boxGeo, boxMat);
    this.selectionBox.visible = false;
    this.scene.add(this.selectionBox);

    const ringGeo = new THREE.TorusGeometry(1.0, 0.06, 6, 16);
    ringGeo.rotateX(Math.PI / 2);
    this.treeCutRingMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
    this.treeCutIndicator = new THREE.Mesh(ringGeo, this.treeCutRingMat);
    this.treeCutIndicator.visible = false;
    this.scene.add(this.treeCutIndicator);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.emitStats();
    this.scheduleNextFrame();
  }

  subscribeStats(listener: (stats: HudStats) => void): () => void {
    this.statsListeners.add(listener);
    listener(this.latestStats);
    return () => {
      this.statsListeners.delete(listener);
    };
  }

  enterGame(): void {
    this.hasStarted = true;
    this.isPlaying = true;
    this.player.updateCameraTransform();
    this.world.updateChunksAroundPlayer(
      this.player.position.x,
      this.player.position.z,
      this.renderDistance,
    );
    this.updateSunShadowTarget();
    this.callbacks.onPlayingChange(true, true);

    const canvas = this.renderer.domElement;
    if (!this.isTouchDevice && canvas.requestPointerLock) {
      try {
        canvas.requestPointerLock();
      } catch {
        // Fallback nếu môi trường nhúng hạn chế Pointer Lock
      }
    }
  }

  setGender(gender: CharacterGender): void {
    this.playerGender = gender;
    this.katanaView.setGender(gender);
    this.shieldView.setGender(gender);
    this.potionView.setGender(gender);
    this.emitStats();
  }

  pauseGame(): void {
    this.isPlaying = false;
    this.shopOpen = false;
    this.characterWindowOpen = false;
    this.player.keys = {};
    this.player.setJoystickVector(0, 0);
    this.isMouseDragging = false;
    this.isLeftMouseDown = false;
    this.isTouchBreakHeld = false;
    this.touchTreeHoldActive = false;
    this.lookTouchId = null;
    this.chopCompletedWaitingRelease = false;
    this.resetChopHold();
    this.callbacks.onPlayingChange(false, this.hasStarted);

    const canvas = this.renderer.domElement;
    if (document.pointerLockElement === canvas && document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  openShop(): void {
    if (this.shopOpen) return;
    this.shopOpen = true;
    this.characterWindowOpen = false;
    this.backpackOpen = false;
    this.player.keys = {};
    this.player.setJoystickVector(0, 0);
    this.isMouseDragging = false;
    this.isLeftMouseDown = false;
    this.isTouchBreakHeld = false;
    this.touchTreeHoldActive = false;
    this.lookTouchId = null;
    this.chopCompletedWaitingRelease = false;
    this.resetChopHold();

    const canvas = this.renderer.domElement;
    if (document.pointerLockElement === canvas && document.exitPointerLock) {
      document.exitPointerLock();
    }
    this.emitStats();
  }

  closeShop(): void {
    if (!this.shopOpen) return;
    this.shopOpen = false;
    const canvas = this.renderer.domElement;
    if (!this.isTouchDevice && this.isPlaying && canvas.requestPointerLock) {
      try {
        canvas.requestPointerLock();
      } catch {
        // Fallback nếu môi trường nhúng hạn chế Pointer Lock
      }
    }
    this.emitStats();
  }

  openCharacterWindow(): void {
    if (this.characterWindowOpen || !this.isPlaying) return;
    this.characterWindowOpen = true;
    this.shopOpen = false;
    this.backpackOpen = false;
    this.player.keys = {};
    this.player.setJoystickVector(0, 0);
    this.isMouseDragging = false;
    this.isLeftMouseDown = false;
    this.isTouchBreakHeld = false;
    this.touchTreeHoldActive = false;
    this.lookTouchId = null;
    this.chopCompletedWaitingRelease = false;
    this.resetChopHold();

    const canvas = this.renderer.domElement;
    if (document.pointerLockElement === canvas && document.exitPointerLock) {
      document.exitPointerLock();
    }
    this.audio.playStowSound();
    this.emitStats();
  }

  closeCharacterWindow(): void {
    if (!this.characterWindowOpen) return;
    this.characterWindowOpen = false;
    const canvas = this.renderer.domElement;
    if (!this.isTouchDevice && this.isPlaying && canvas.requestPointerLock) {
      try {
        canvas.requestPointerLock();
      } catch {
        // Fallback nếu môi trường nhúng hạn chế Pointer Lock
      }
    }
    this.audio.playStowSound();
    this.emitStats();
  }

  toggleCharacterWindow(): void {
    if (this.characterWindowOpen) {
      this.closeCharacterWindow();
    } else {
      this.openCharacterWindow();
    }
  }

  buyShopItem(itemId: ShopItemId): void {
    if (itemId === 'potion') {
      if (!this.world.isShopItemOwned('backpack')) {
        this.callbacks.onToast('Cần mua Balo (500 VNĐ) trước để chứa Lọ thuốc hồi máu!');
        return;
      }
      const price = SHOP_ITEM_PRICES.potion;
      if (this.money < price) {
        this.callbacks.onToast(
          `Chưa đủ ${price.toLocaleString('vi-VN')} VNĐ để mua ${SHOP_ITEM_NAMES.potion}!`,
        );
        return;
      }
      const res = this.world.addPotionToBackpack();
      if (!res.added) {
        this.callbacks.onToast('Balo đã đầy (tối đa 50 lọ/ô)! Không thể mua thêm thuốc.');
        return;
      }
      this.money -= price;
      this.audio.playCashSound();
      this.emitStats();
      this.callbacks.onToast(
        `Đã mua ${SHOP_ITEM_NAMES.potion} (Ô ${res.slotIndex + 1}: ${res.count}/50 · -${price.toLocaleString('vi-VN')} VNĐ)!`,
      );
      return;
    }

    const owned = this.world.isShopItemOwned(itemId);
    if (owned) {
      this.callbacks.onToast(`Bạn đã sở hữu ${SHOP_ITEM_NAMES[itemId]}!`);
      return;
    }

    const price = SHOP_ITEM_PRICES[itemId];
    if (this.money < price) {
      this.callbacks.onToast(
        `Chưa đủ ${price.toLocaleString('vi-VN')} VNĐ để mua ${SHOP_ITEM_NAMES[itemId]}!`,
      );
      return;
    }

    this.money -= price;
    this.world.markShopItemOwned(itemId);
    this.audio.playCashSound();
    this.emitStats();
    this.callbacks.onToast(
      `Đã mua ${SHOP_ITEM_NAMES[itemId]} (-${price.toLocaleString('vi-VN')} VNĐ)!`,
    );
  }

  setRenderDistance(distance: number): void {
    this.renderDistance = distance;
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = distance * CHUNK_SIZE * 0.48;
      this.scene.fog.far = distance * CHUNK_SIZE * 1.02;
    }
    this.camera.far = Math.max(140, distance * CHUNK_SIZE * 1.45);
    this.camera.updateProjectionMatrix();
    this.skyDome.scale.setScalar(Math.max(105, distance * CHUNK_SIZE * 1.2));
  }

  private applyTitleMeadowCamera(nowMs: number): void {
    const t = nowMs * 0.00014;
    const camX = -46 + Math.sin(t) * 5.5;
    const camZ = 12 + Math.cos(t * 0.75) * 4.5;
    const groundY = this.world.getGroundHeight(camX, camZ);
    const camY = Math.max(groundY + 2.8, 6.2);
    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(camX - 24, camY + 1.9, camZ + 8);
  }

  private updateSunShadowTarget(
    targetX = this.player.position.x,
    targetY = this.player.position.y,
    targetZ = this.player.position.z,
  ): void {
    const texelWorldSize = (this.sunShadowHalfExtent * 2) / this.sunShadowMapSize;
    const snapX = Math.round(targetX / texelWorldSize) * texelWorldSize;
    const snapZ = Math.round(targetZ / texelWorldSize) * texelWorldSize;
    this.sunLight.target.position.set(snapX, targetY, snapZ);
    this.sunLight.target.updateMatrixWorld();
    this.sunLight.position.set(
      snapX + this.sunOffset.x,
      targetY + this.sunOffset.y,
      snapZ + this.sunOffset.z,
    );
  }

  setSensitivity(level: number): void {
    this.player.sensitivity = 0.0005 + level * 0.00035;
  }

  selectSlot(index: number): void {
    const total = HOTBAR_BLOCKS.length;
    this.selectedSlotIndex = ((index % total) + total) % total;
    this.callbacks.onSlotChange(this.selectedSlotIndex);
  }

  setVirtualKey(code: string, pressed: boolean): void {
    this.player.keys[code] = pressed;
  }

  setVirtualJoystick(x: number, y: number): void {
    this.player.setJoystickVector(x, y);
  }

  private resetChopHold(): void {
    const hadProgress = this.chopElapsed > 0 || this.chopTreeId !== null;
    this.chopTreeId = null;
    this.chopCutLocalY = 0;
    this.chopElapsed = 0;
    this.chopSoundTimer = 0;
    if (hadProgress) {
      this.emitStats();
    }
  }

  private handleBreakRelease(): void {
    if (
      this.chopTreeId !== null &&
      this.chopElapsed > 0 &&
      this.chopElapsed < TREE_HAND_CHOP_DURATION
    ) {
      const now = performance.now();
      if (this.chopElapsed < 0.45 && now - this.lastChopHintAt > 4000) {
        this.lastChopHintAt = now;
        this.callbacks.onToast(
          'Chưa dùng Katana: hãy giữ chuột trái tại vị trí chặt 5 giây để cây đổ!',
        );
      }
    }
    this.chopCompletedWaitingRelease = false;
    this.resetChopHold();
  }

  setBreakHeld(pressed: boolean): void {
    if (pressed) {
      if (!this.isPlaying) return;
      if (!this.isTouchBreakHeld) {
        this.isTouchBreakHeld = true;
        this.breakTargetBlock();
      }
    } else if (this.isTouchBreakHeld) {
      this.isTouchBreakHeld = false;
      this.handleBreakRelease();
    }
  }

  breakTargetBlock(): void {
    if (this.holdingKatana && !this.world.isCarryingLog()) {
      this.katanaView.triggerSlash();
      this.audio.playSlashSound();

      this.camera.getWorldDirection(this.rayDir);
      const atk = this.world.attackSlimeWithKatana(this.camera.position, this.rayDir, 3.8);
      if (atk.hit) {
        this.audio.playSlimeHitSound();
        if (atk.killed) {
          const prevLevel = this.level;
          this.grantXp(atk.xpReward);
          if (this.level === prevLevel && this.level < MAX_LEVEL) {
            this.callbacks.onToast(`Hạ Slime Lv.${atk.level} (+${atk.xpReward} XP)`);
          }
        } else {
          this.emitStats();
        }
        return;
      }

      const katanaDmg = this.hasIceKatana ? 2 : 1;
      const mushroomAtk = this.world.attackMushroomWithKatana(
        this.camera.position,
        this.rayDir,
        katanaDmg,
        4.0,
      );
      if (mushroomAtk.hit) {
        this.audio.playSlimeHitSound();
        if (mushroomAtk.killed) {
          const prevLevel = this.level;
          this.grantXp(mushroomAtk.xpReward);
          if (this.level === prevLevel && this.level < MAX_LEVEL) {
            this.callbacks.onToast(
              `Hạ Nấm Độc Lv.${mushroomAtk.level} (+${mushroomAtk.xpReward} XP)`,
            );
          }
        } else {
          this.emitStats();
        }
        return;
      }

      const dragonDmg = this.hasIceKatana ? 2 : 1;
      const dragonAtk = this.world.attackDragonWithKatana(
        this.camera.position,
        this.rayDir,
        dragonDmg,
        5.4,
        this.level,
      );
      if (dragonAtk.hit) {
        if (dragonAtk.blockedByLevel) {
          this.audio.playShieldBlockSound();
          this.callbacks.onToast(
            `Cần đạt Level ${DRAGON_MIN_ATTACK_LEVEL} trở lên mới có thể gây sát thương cho Rồng Băng!`,
          );
          return;
        }
        this.audio.playSlimeHitSound();
        if (dragonAtk.killed) {
          this.audio.playDragonDefeatSound();
          this.grantXp(dragonAtk.xpReward);
          this.callbacks.onToast(
            `Hạ Rồng Băng Lv.${DRAGON_LEVEL}! (+5.000 XP) Katana Băng đã rơi ra!`,
          );
        } else {
          this.emitStats();
        }
        return;
      }
    } else if (
      this.currentSlimeTarget &&
      this.currentSlimeTarget.point.distanceTo(this.camera.position) <= 4.2
    ) {
      this.callbacks.onToast('Cần mua và cầm Katana (phím Q) để chém Slime!');
      return;
    } else if (
      this.currentMushroomTarget &&
      this.currentMushroomTarget.point.distanceTo(this.camera.position) <= 4.4
    ) {
      this.callbacks.onToast('Cần mua và cầm Katana (phím Q) để chém Nấm Độc!');
      return;
    } else if (
      this.currentDragonTarget &&
      this.currentDragonTarget.point.distanceTo(this.camera.position) <= 5.6
    ) {
      this.callbacks.onToast('Cần mua và cầm Katana (phím Q) để chém Rồng Băng!');
      return;
    }

    if (this.currentTreeTarget) {
      const { tree, cutLocalY } = this.currentTreeTarget;
      // Dùng Katana tương tác: 1 click chuột trái chặt đổ cây ngay lập tức
      if (this.holdingKatana && !this.world.isCarryingLog()) {
        if (this.world.cutTree(tree, cutLocalY, this.player.position.x, this.player.position.z)) {
          this.audio.playBlockSound('break');
          this.currentTreeTarget = null;
          this.treeCutIndicator.visible = false;
          this.resetChopHold();
        }
        return;
      }

      // Chưa dùng Katana: bắt đầu giữ tại vị trí chặt đủ 5 giây mới đổ
      this.chopTreeId = tree.id;
      this.chopCutLocalY = cutLocalY;
      this.chopElapsed = 0;
      this.chopSoundTimer = 0;
      this.chopCompletedWaitingRelease = false;
      this.audio.playBlockSound('break');
      return;
    }

    if (!this.interactionEnabled || !this.currentTarget) return;
    const [bx, by, bz] = this.currentTarget.blockPos;
    if (by === 0) {
      this.callbacks.onToast('Không thể phá hủy Đá Nền ở đáy thế giới!');
      return;
    }
    if (this.world.setBlockAt(bx, by, bz, BlockId.AIR)) {
      this.audio.playBlockSound('break');
    }
  }

  placeTargetBlock(): void {
    if (this.currentIceKatanaDropTarget) {
      if (
        this.world.tryCollectIceKatana({
          onCollectIceKatana: () => this.handleCollectIceKatana(),
        })
      ) {
        this.currentIceKatanaDropTarget = null;
        return;
      }
    }

    if (this.currentShopTarget && !this.world.isCarryingLog()) {
      this.openShop();
      return;
    }

    if (this.holdingPotionSlot !== null && !this.world.isCarryingLog()) {
      if (this.drinkHeldPotion()) {
        return;
      }
    }

    if (this.world.isCarryingLog()) {
      if (this.currentConveyorTarget) {
        if (this.world.placeCarriedOnConveyor()) {
          this.audio.playBlockSound('place');
          this.currentConveyorTarget = null;
          this.emitStats();
        }
        return;
      }

      const fwdX = -Math.sin(this.player.yaw);
      const fwdZ = -Math.cos(this.player.yaw);
      let placeDist = 2.4;

      this.camera.getWorldDirection(this.wallCheckDir);
      const wallHit = voxelRaycast(this.world, this.camera.position, this.wallCheckDir, 3.2);
      if (wallHit) {
        const wallHorizDist = Math.hypot(
          wallHit.blockPos[0] + 0.5 - this.camera.position.x,
          wallHit.blockPos[2] + 0.5 - this.camera.position.z,
        );
        placeDist = Math.max(1.1, Math.min(placeDist, wallHorizDist - 0.8));
      }

      const placeX = this.player.position.x + fwdX * placeDist;
      const placeZ = this.player.position.z + fwdZ * placeDist;
      if (this.world.placeCarriedLog(placeX, placeZ, fwdX, fwdZ)) {
        this.audio.playBlockSound('place');
        this.currentLogTarget = null;
        this.emitStats();
      }
      return;
    }

    if (this.currentLogTarget) {
      if (this.world.pickUpLog(this.currentLogTarget.log)) {
        this.holdingKatana = false;
        this.holdingPotionSlot = null;
        this.audio.playBlockSound('place');
        this.currentLogTarget = null;
        this.emitStats();
      }
      return;
    }

    if (!this.interactionEnabled || !this.currentTarget) return;
    const [px, py, pz] = this.currentTarget.placePos;
    if (py >= CHUNK_HEIGHT) {
      this.callbacks.onToast('Đã đạt giới hạn chiều cao xây dựng!');
      return;
    }
    if (this.player.intersectsBlock(px, py, pz)) {
      return;
    }
    const blockToPlace = HOTBAR_BLOCKS[this.selectedSlotIndex].id;
    if (this.world.setBlockAt(px, py, pz, blockToPlace)) {
      this.audio.playBlockSound('place');
    }
  }

  toggleBackpack(): void {
    if (!this.world.isShopItemOwned('backpack')) {
      this.callbacks.onToast('Cần mua Balo (500 VNĐ) tại quầy vũ khí trước!');
      return;
    }
    this.backpackOpen = !this.backpackOpen;
    this.audio.playStowSound();
    this.emitStats();
  }

  interactBackpackWood(): void {
    if (!this.world.isShopItemOwned('backpack')) {
      this.callbacks.onToast('Cần mua Balo (500 VNĐ) tại quầy vũ khí trước!');
      return;
    }

    if (this.world.isCarryingLog()) {
      if (this.world.storeCarriedLogToBackpack()) {
        this.audio.playStowSound();
        this.emitStats();
      } else {
        this.callbacks.onToast('Balo đã đầy (9/9)! Không thể cất thêm gỗ.');
      }
      return;
    }

    if (this.world.retrieveLogFromBackpack()) {
      this.holdingKatana = false;
      this.holdingPotionSlot = null;
      this.audio.playStowSound();
      this.emitStats();
    } else {
      this.callbacks.onToast('Balo không có khúc gỗ nào!');
    }
  }

  retrieveBackpackSlot(slotIndex: number): void {
    if (!this.world.isShopItemOwned('backpack') || !this.backpackOpen) return;
    if (slotIndex < 0 || slotIndex >= 9) return;

    const slotKind = this.world.getBackpackSlotKind(slotIndex);
    if (slotKind === 'potion') {
      if (this.world.isCarryingLog()) {
        this.callbacks.onToast('Tay đang khiêng gỗ! Đặt xuống hoặc ấn F để cất trước.');
        return;
      }
      if (this.holdingPotionSlot === slotIndex) {
        this.holdingPotionSlot = null;
        this.audio.playStowSound();
        this.emitStats();
        return;
      }
      this.holdingKatana = false;
      this.holdingPotionSlot = slotIndex;
      this.audio.playStowSound();
      this.emitStats();
      const count = this.world.getPotionCountAtSlot(slotIndex);
      this.callbacks.onToast(
        `Đang cầm Lọ thuốc hồi máu (x${count}) · Chuột phải để uống (+2 tim)!`,
      );
      return;
    }

    if (this.world.isCarryingLog()) {
      this.callbacks.onToast('Tay đang khiêng gỗ! Đặt xuống hoặc ấn F để cất trước.');
      return;
    }

    if (this.world.retrieveLogFromBackpackSlot(slotIndex)) {
      this.holdingKatana = false;
      this.holdingPotionSlot = null;
      this.audio.playStowSound();
      this.emitStats();
    } else {
      this.callbacks.onToast(`Ô ${slotIndex + 1} đang trống!`);
    }
  }

  private drinkHeldPotion(): boolean {
    if (this.holdingPotionSlot === null) return false;
    const count = this.world.getPotionCountAtSlot(this.holdingPotionSlot);
    if (count <= 0) {
      this.holdingPotionSlot = null;
      this.emitStats();
      return false;
    }
    if (this.hp >= MAX_PLAYER_HP) {
      this.callbacks.onToast('Máu đã đầy (10/10 tim), chưa cần uống thuốc!');
      return true;
    }
    const remaining = this.world.consumePotionFromSlot(this.holdingPotionSlot);
    this.hp = Math.min(MAX_PLAYER_HP, Math.round((this.hp + 2.0) * 2) / 2);
    this.potionView.triggerDrink();
    this.audio.playPotionDrinkSound();
    if (remaining <= 0) {
      this.holdingPotionSlot = null;
    }
    this.emitStats();
    this.callbacks.onToast(
      remaining > 0
        ? `Đã uống Lọ thuốc hồi máu (+2 tim) · Còn ${remaining} lọ`
        : 'Đã uống Lọ thuốc hồi máu (+2 tim) · Đã hết lọ trong ô!',
    );
    return true;
  }

  toggleKatana(): void {
    if (!this.world.isShopItemOwned('katana')) {
      this.callbacks.onToast('Cần mua Katana (1.000 VNĐ) tại quầy vũ khí trước!');
      return;
    }

    if (this.holdingKatana) {
      this.holdingKatana = false;
      this.audio.playStowSound();
      this.emitStats();
      return;
    }

    if (this.world.isCarryingLog()) {
      if (!this.world.isShopItemOwned('backpack')) {
        this.callbacks.onToast('Cần có Balo hoặc đặt gỗ xuống trước khi đổi sang Katana!');
        return;
      }
      if (this.world.isBackpackFull()) {
        this.callbacks.onToast('Balo đã đầy (9/9), không thể cất gỗ để đổi qua Katana!');
        return;
      }
      this.world.storeCarriedLogToBackpack();
    }

    this.holdingKatana = true;
    this.holdingPotionSlot = null;
    this.audio.playStowSound();
    this.emitStats();
  }

  toggleShield(): void {
    if (!this.world.isShopItemOwned('shield')) {
      this.callbacks.onToast('Cần mua Khiên chắn (600 VNĐ) tại quầy vũ khí trước!');
      return;
    }
    this.shieldRaised = !this.shieldRaised;
    this.audio.playStowSound();
    this.emitStats();
  }

  private grantXp(amount: number): void {
    if (amount <= 0) return;
    if (this.level >= MAX_LEVEL) {
      this.xp = 0;
      this.emitStats();
      return;
    }

    this.xp += amount;
    let leveledUp = false;
    while (this.level < MAX_LEVEL) {
      const required = getXpForNextLevel(this.level);
      if (this.xp < required) break;
      this.xp -= required;
      this.level += 1;
      leveledUp = true;
    }

    if (this.level >= MAX_LEVEL) {
      this.xp = 0;
    }

    if (leveledUp) {
      this.audio.playLevelUpSound();
      this.callbacks.onToast(
        this.level >= MAX_LEVEL
          ? `Chúc mừng! Đạt cấp tối đa Level ${MAX_LEVEL}!`
          : `Lên cấp! Level ${this.level}`,
      );
    }

    this.emitStats();
  }

  private handleCollectIceKatana(): void {
    this.hasIceKatana = true;
    this.world.markShopItemOwned('katana');
    this.katanaView.setIceVariant(true);
    if (!this.world.isCarryingLog()) {
      this.holdingKatana = true;
      this.holdingPotionSlot = null;
    }
    this.audio.playLevelUpSound();
    this.emitStats();
    this.callbacks.onToast('Đã nhận Katana Băng! Đã thay thế Katana ban đầu.');
  }

  private emitStats(): void {
    this.latestStats.x = this.player.position.x;
    this.latestStats.y = this.player.position.y;
    this.latestStats.z = this.player.position.z;
    this.latestStats.fps = this.currentFps;
    this.latestStats.chunkCount = this.world.chunks.size;
    this.latestStats.money = this.money;
    this.latestStats.hp = this.hp;
    this.latestStats.maxHp = MAX_PLAYER_HP;
    this.latestStats.level = this.level;
    this.latestStats.xp = this.xp;
    this.latestStats.xpToNext = getXpForNextLevel(this.level);
    this.latestStats.hasBackpack = this.world.isShopItemOwned('backpack');
    this.latestStats.hasKatana = this.world.isShopItemOwned('katana');
    this.latestStats.hasIceKatana = this.hasIceKatana;
    this.latestStats.hasShield = this.world.isShopItemOwned('shield');
    this.latestStats.backpackOpen = this.backpackOpen;
    this.latestStats.shopOpen = this.shopOpen;
    this.latestStats.characterWindowOpen = this.characterWindowOpen;
    this.latestStats.gender = this.playerGender;
    this.latestStats.holdingKatana = this.holdingKatana;
    if (
      this.holdingPotionSlot !== null &&
      this.world.getPotionCountAtSlot(this.holdingPotionSlot) <= 0
    ) {
      this.holdingPotionSlot = null;
    }
    this.latestStats.holdingPotionSlot = this.holdingPotionSlot;
    this.latestStats.holdingPotionCount =
      this.holdingPotionSlot !== null
        ? this.world.getPotionCountAtSlot(this.holdingPotionSlot)
        : 0;
    this.latestStats.shieldRaised = this.shieldRaised;
    this.latestStats.carryingLog = this.world.isCarryingLog();
    this.latestStats.isShopTarget = Boolean(this.currentShopTarget);
    this.latestStats.isConveyorTarget =
      this.latestStats.carryingLog && Boolean(this.currentConveyorTarget);
    const chopProgress =
      this.chopTreeId !== null && !(this.holdingKatana && !this.world.isCarryingLog())
        ? Math.min(1, Math.max(0, this.chopElapsed / TREE_HAND_CHOP_DURATION))
        : 0;
    this.latestStats.chopProgress = chopProgress;
    this.lastHudChopProgress = chopProgress;
    this.latestStats.backpackItems = this.world.getBackpackItems();
    this.latestStats.bossHud = this.world.getBossHudState(
      this.player.position.x,
      this.player.position.z,
    );

    if (this.currentIceKatanaDropTarget) {
      const p = this.currentIceKatanaDropTarget.point;
      this.latestStats.targetName = 'Katana Băng · Chuột phải hoặc lại gần nhận';
      this.latestStats.targetCoords = [
        Math.round(p.x),
        Math.round(p.y * 10) / 10,
        Math.round(p.z),
      ];
    } else if (this.currentDragonTarget) {
      const { point, hp, maxHp } = this.currentDragonTarget;
      this.latestStats.targetName =
        this.level < DRAGON_MIN_ATTACK_LEVEL
          ? `Rồng Băng Lv.${DRAGON_LEVEL} (${hp}/${maxHp} · Cần Lv.${DRAGON_MIN_ATTACK_LEVEL} để gây sát thương)`
          : `Rồng Băng Lv.${DRAGON_LEVEL} (${hp}/${maxHp} · +5.000 XP)`;
      this.latestStats.targetCoords = [
        Math.round(point.x),
        Math.round(point.y * 10) / 10,
        Math.round(point.z),
      ];
    } else if (this.currentShopTarget && !this.world.isCarryingLog()) {
      const { point } = this.currentShopTarget;
      this.latestStats.targetName = 'Cửa hàng thiết yếu · Chuột phải để mở';
      this.latestStats.targetCoords = [
        Math.round(point.x),
        Math.round(point.y * 10) / 10,
        Math.round(point.z),
      ];
    } else if (this.currentSlimeTarget && this.currentSlimeTarget.slime.alive) {
      const { slime, point } = this.currentSlimeTarget;
      this.latestStats.targetName = `Slime Lv.${slime.level} (${slime.hp}/${slime.maxHp} · +${slime.xpReward} XP)`;
      this.latestStats.targetCoords = [
        Math.round(point.x),
        Math.round(point.y * 10) / 10,
        Math.round(point.z),
      ];
    } else if (this.currentMushroomTarget && this.currentMushroomTarget.mushroom.alive) {
      const { mushroom, point } = this.currentMushroomTarget;
      this.latestStats.targetName = `Nấm Độc Lv.${mushroom.level} (${mushroom.hp}/${mushroom.maxHp} · +${mushroom.xpReward} XP)`;
      this.latestStats.targetCoords = [
        Math.round(point.x),
        Math.round(point.y * 10) / 10,
        Math.round(point.z),
      ];
    } else if (this.world.isCarryingLog() && this.currentConveyorTarget) {
      const carriedLen = this.world.getCarriedLogLength() ?? 1;
      const previewVnd = CashierStation.computeWoodValue(carriedLen);
      this.latestStats.targetName = `Băng tải · Chuột phải bán (+${previewVnd.toLocaleString('vi-VN')} VNĐ)`;
      this.latestStats.targetCoords = [
        Math.round(this.currentConveyorTarget.point.x),
        Math.round(this.currentConveyorTarget.point.y * 10) / 10,
        Math.round(this.currentConveyorTarget.point.z),
      ];
    } else if (this.world.isCarryingLog()) {
      const fwdX = -Math.sin(this.player.yaw);
      const fwdZ = -Math.cos(this.player.yaw);
      const px = this.player.position.x + fwdX * 2.4;
      const pz = this.player.position.z + fwdZ * 2.4;
      const py = this.world.getGroundHeight(px, pz);
      this.latestStats.targetName = 'Đang khiêng cây · Chuột phải đặt · F cất vào balo';
      this.latestStats.targetCoords = [Math.round(px), Math.round(py * 10) / 10, Math.round(pz)];
    } else if (this.currentLogTarget) {
      this.latestStats.targetName = 'Thân Cây Rời · Chuột phải khiêng';
      this.latestStats.targetCoords = [
        Math.round(this.currentLogTarget.log.x),
        Math.round(this.currentLogTarget.point.y * 10) / 10,
        Math.round(this.currentLogTarget.log.z),
      ];
    } else if (this.currentTreeTarget) {
      this.latestStats.targetName =
        this.holdingKatana && !this.world.isCarryingLog()
          ? 'Thân Cây · Chuột trái chém chặt (1 phát)'
          : 'Thân Cây · Giữ chuột trái 5 giây tại vị trí chặt';
      this.latestStats.targetCoords = [
        Math.round(this.currentTreeTarget.tree.x),
        Math.round(
          (this.currentTreeTarget.tree.baseY + this.currentTreeTarget.cutLocalY) * 10,
        ) / 10,
        Math.round(this.currentTreeTarget.tree.z),
      ];
    } else if (this.currentTarget) {
      this.latestStats.targetName = BLOCK_NAMES[this.currentTarget.blockId];
      this.latestStats.targetCoords = this.currentTarget.blockPos;
    } else {
      this.latestStats.targetName = null;
      this.latestStats.targetCoords = null;
    }

    for (const listener of this.statsListeners) {
      listener(this.latestStats);
    }
  }

  private readonly onPointerLockChange = (): void => {
    const canvas = this.renderer.domElement;
    if (document.pointerLockElement === canvas) {
      this.hasStarted = true;
      this.isPlaying = true;
      this.callbacks.onPlayingChange(true, true);
    } else if (!this.isTouchDevice && this.isPlaying && !this.shopOpen && !this.characterWindowOpen) {
      this.pauseGame();
    }
  };

  private readonly onMouseMove = (e: MouseEvent): void => {
    if (!this.isPlaying || this.shopOpen || this.characterWindowOpen) return;
    if (document.pointerLockElement === this.renderer.domElement || this.isMouseDragging) {
      this.player.rotate(e.movementX, e.movementY);
    }
  };

  private readonly onMouseDown = (e: MouseEvent): void => {
    if (!this.isPlaying || this.shopOpen || this.characterWindowOpen) return;
    if (performance.now() - this.lastTouchTimestamp < 500) return;
    const canvas = this.renderer.domElement;
    if (document.pointerLockElement !== canvas && !this.isTouchDevice) {
      try {
        canvas.requestPointerLock();
      } catch {
        // Fallback kéo chuột
      }
      this.isMouseDragging = true;
    }
    if (e.button === 0) {
      this.isLeftMouseDown = true;
      this.breakTargetBlock();
    } else if (e.button === 2) {
      this.placeTargetBlock();
    }
  };

  private readonly onMouseUp = (e: MouseEvent): void => {
    this.isMouseDragging = false;
    if (e.button === 0 && this.isLeftMouseDown) {
      this.isLeftMouseDown = false;
      this.handleBreakRelease();
    }
  };

  private readonly onWindowBlur = (): void => {
    this.isMouseDragging = false;
    this.isLeftMouseDown = false;
    this.isTouchBreakHeld = false;
    this.touchTreeHoldActive = false;
    this.lookTouchId = null;
    this.player.setJoystickVector(0, 0);
    this.chopCompletedWaitingRelease = false;
    this.resetChopHold();
  };

  private readonly onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.shopOpen) {
      if (e.code === 'Escape' && !e.repeat) {
        e.preventDefault();
        this.closeShop();
      }
      return;
    }

    if (this.characterWindowOpen) {
      if ((e.code === 'Escape' || e.code === 'KeyB') && !e.repeat) {
        e.preventDefault();
        this.closeCharacterWindow();
      }
      return;
    }

    this.player.keys[e.code] = true;

    if (!this.backpackOpen && e.code.startsWith('Digit')) {
      const num = parseInt(e.code.replace('Digit', ''), 10);
      if (num >= 1 && num <= HOTBAR_BLOCKS.length) {
        this.selectSlot(num - 1);
      }
    }

    if (this.isPlaying && !e.repeat) {
      if (e.code === 'KeyB') {
        e.preventDefault();
        this.toggleCharacterWindow();
        return;
      } else if (e.code === 'KeyE') {
        this.toggleBackpack();
      } else if (e.code === 'KeyF') {
        this.interactBackpackWood();
      } else if (e.code === 'KeyQ') {
        this.toggleKatana();
      } else if (e.code === 'KeyR') {
        this.toggleShield();
      } else if (this.backpackOpen) {
        const digitMatch = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
        if (digitMatch) {
          this.retrieveBackpackSlot(parseInt(digitMatch[1], 10) - 1);
        }
      }
    }

    if (e.code === 'Escape' && this.isPlaying && document.pointerLockElement !== this.renderer.domElement) {
      this.pauseGame();
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.player.keys[e.code] = false;
  };

  private readonly onWheel = (e: WheelEvent): void => {
    if (!this.isPlaying || this.shopOpen || this.characterWindowOpen) return;
    if (e.deltaY > 0) {
      this.selectSlot(this.selectedSlotIndex + 1);
    } else if (e.deltaY < 0) {
      this.selectSlot(this.selectedSlotIndex - 1);
    }
  };

  private getTouchWorldRay(
    clientX: number,
    clientY: number,
  ): { origin: THREE.Vector3; direction: THREE.Vector3 } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    this.touchNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.touchNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.touchRaycaster.setFromCamera(this.touchNdc, this.camera);
    return {
      origin: this.touchRaycaster.ray.origin,
      direction: this.touchRaycaster.ray.direction,
    };
  }

  private raycastUnblockedTreeAtScreen(clientX: number, clientY: number): TreeTarget | null {
    const ray = this.getTouchWorldRay(clientX, clientY);
    if (!ray) return null;
    const hit = this.world.raycastTreeTrunk(ray.origin, ray.direction, 7.5);
    if (!hit) return null;
    const dist = hit.point.distanceTo(ray.origin);
    const wallHit = voxelRaycast(this.world, ray.origin, ray.direction, dist);
    return wallHit ? null : hit;
  }

  private performScreenTapInteract(clientX: number, clientY: number): void {
    const ray = this.getTouchWorldRay(clientX, clientY);
    if (!ray) return;

    if (this.holdingKatana && !this.world.isCarryingLog()) {
      this.katanaView.triggerSlash();
      this.audio.playSlashSound();

      this.camera.getWorldDirection(this.rayDir);
      let atk = this.world.attackSlimeWithKatana(ray.origin, ray.direction, 4.2);
      if (!atk.hit) {
        atk = this.world.attackSlimeWithKatana(this.camera.position, this.rayDir, 3.8);
      }
      if (atk.hit) {
        this.audio.playSlimeHitSound();
        if (atk.killed) {
          const prevLevel = this.level;
          this.grantXp(atk.xpReward);
          if (this.level === prevLevel && this.level < MAX_LEVEL) {
            this.callbacks.onToast(`Hạ Slime Lv.${atk.level} (+${atk.xpReward} XP)`);
          }
        } else {
          this.emitStats();
        }
        return;
      }

      const katanaDmg = this.hasIceKatana ? 2 : 1;
      let mushroomAtk = this.world.attackMushroomWithKatana(
        ray.origin,
        ray.direction,
        katanaDmg,
        4.4,
      );
      if (!mushroomAtk.hit) {
        mushroomAtk = this.world.attackMushroomWithKatana(
          this.camera.position,
          this.rayDir,
          katanaDmg,
          4.0,
        );
      }
      if (mushroomAtk.hit) {
        this.audio.playSlimeHitSound();
        if (mushroomAtk.killed) {
          const prevLevel = this.level;
          this.grantXp(mushroomAtk.xpReward);
          if (this.level === prevLevel && this.level < MAX_LEVEL) {
            this.callbacks.onToast(
              `Hạ Nấm Độc Lv.${mushroomAtk.level} (+${mushroomAtk.xpReward} XP)`,
            );
          }
        } else {
          this.emitStats();
        }
        return;
      }

      const dragonDmg = this.hasIceKatana ? 2 : 1;
      let dragonAtk = this.world.attackDragonWithKatana(
        ray.origin,
        ray.direction,
        dragonDmg,
        5.6,
        this.level,
      );
      if (!dragonAtk.hit) {
        dragonAtk = this.world.attackDragonWithKatana(
          this.camera.position,
          this.rayDir,
          dragonDmg,
          5.4,
          this.level,
        );
      }
      if (dragonAtk.hit) {
        if (dragonAtk.blockedByLevel) {
          this.audio.playShieldBlockSound();
          this.callbacks.onToast(
            `Cần đạt Level ${DRAGON_MIN_ATTACK_LEVEL} trở lên mới có thể gây sát thương cho Rồng Băng!`,
          );
          return;
        }
        this.audio.playSlimeHitSound();
        if (dragonAtk.killed) {
          this.audio.playDragonDefeatSound();
          this.grantXp(dragonAtk.xpReward);
          this.callbacks.onToast(
            `Hạ Rồng Băng Lv.${DRAGON_LEVEL}! (+5.000 XP) Katana Băng đã rơi ra!`,
          );
        } else {
          this.emitStats();
        }
        return;
      }

      const treeHit = this.raycastUnblockedTreeAtScreen(clientX, clientY);
      if (
        treeHit &&
        this.world.cutTree(
          treeHit.tree,
          treeHit.cutLocalY,
          this.player.position.x,
          this.player.position.z,
        )
      ) {
        this.audio.playBlockSound('break');
        this.currentTreeTarget = null;
        this.treeCutIndicator.visible = false;
        this.resetChopHold();
      }
      return;
    }

    const slimeTap = this.world.raycastSlime(ray.origin, ray.direction, 4.5);
    if (slimeTap) {
      this.callbacks.onToast('Cần mua và cầm Katana để chém Slime!');
      return;
    }
    const mushroomTap = this.world.raycastMushroom(ray.origin, ray.direction, 4.8);
    if (mushroomTap) {
      this.callbacks.onToast('Cần mua và cầm Katana để chém Nấm Độc!');
      return;
    }
    const dragonTap = this.world.raycastDragon(ray.origin, ray.direction, 6.0);
    if (dragonTap) {
      this.callbacks.onToast('Cần mua và cầm Katana để chém Rồng Băng!');
    }
  }

  private readonly onTouchStart = (e: TouchEvent): void => {
    this.lastTouchTimestamp = performance.now();
    if (!this.isPlaying || this.shopOpen || this.characterWindowOpen) return;
    if (this.lookTouchId === null && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      this.lookTouchId = touch.identifier;
      this.lastTouchX = touch.clientX;
      this.lastTouchY = touch.clientY;
      this.touchClientX = touch.clientX;
      this.touchClientY = touch.clientY;
      this.touchTotalMove = 0;
      this.touchTreeHoldActive = false;

      if (!(this.holdingKatana && !this.world.isCarryingLog())) {
        const treeHit = this.raycastUnblockedTreeAtScreen(touch.clientX, touch.clientY);
        if (treeHit) {
          this.touchTreeHoldActive = true;
          this.chopTreeId = treeHit.tree.id;
          this.chopCutLocalY = treeHit.cutLocalY;
          this.chopElapsed = 0;
          this.chopSoundTimer = 0;
          this.chopCompletedWaitingRelease = false;
          this.audio.playBlockSound('break');
        }
      }
    }
  };

  private readonly onTouchMove = (e: TouchEvent): void => {
    this.lastTouchTimestamp = performance.now();
    if (!this.isPlaying || this.shopOpen || this.characterWindowOpen || this.lookTouchId === null) return;
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      if (touch.identifier === this.lookTouchId) {
        const dx = touch.clientX - this.lastTouchX;
        const dy = touch.clientY - this.lastTouchY;
        this.touchTotalMove += Math.hypot(dx, dy);
        this.lastTouchX = touch.clientX;
        this.lastTouchY = touch.clientY;
        this.touchClientX = touch.clientX;
        this.touchClientY = touch.clientY;

        if (this.touchTreeHoldActive) {
          if (this.touchTotalMove <= 14) {
            break;
          }
          this.touchTreeHoldActive = false;
          this.resetChopHold();
        }

        this.player.rotate(dx * 1.65, dy * 1.65);
        break;
      }
    }
  };

  private readonly onTouchEnd = (e: TouchEvent): void => {
    this.lastTouchTimestamp = performance.now();
    if (this.lookTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.lookTouchId) {
        const wasTap = this.touchTotalMove <= 16;
        const wasTreeHold = this.touchTreeHoldActive;
        const endX = e.changedTouches[i].clientX;
        const endY = e.changedTouches[i].clientY;

        this.lookTouchId = null;
        this.touchTreeHoldActive = false;

        if (wasTreeHold) {
          this.handleBreakRelease();
        } else if (wasTap && this.isPlaying && !this.shopOpen && !this.characterWindowOpen) {
          this.performScreenTapInteract(endX, endY);
        }
        break;
      }
    }
  };

  private readonly onResize = (): void => {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private readonly onContextLost = (e: Event): void => {
    e.preventDefault();
    this.isContextLost = true;
    this.callbacks.onWebGLError?.('Ngữ cảnh đồ họa WebGL tạm thời bị gián đoạn, đang chờ khôi phục...');
  };

  private readonly onContextRestored = (): void => {
    this.isContextLost = false;
    this.callbacks.onWebGLError?.('');
  };

  private bindEvents(): void {
    const canvas = this.renderer.domElement;
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    canvas.addEventListener('touchstart', this.onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', this.onTouchMove, { passive: true });
    canvas.addEventListener('touchend', this.onTouchEnd, { passive: true });
    canvas.addEventListener('touchcancel', this.onTouchEnd, { passive: true });
    window.addEventListener('resize', this.onResize);
    document.addEventListener('fullscreenchange', this.onResize);
    document.addEventListener('webkitfullscreenchange', this.onResize);
    window.addEventListener('blur', this.onWindowBlur);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  private unbindEvents(): void {
    const canvas = this.renderer.domElement;
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    canvas.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('wheel', this.onWheel);
    canvas.removeEventListener('touchstart', this.onTouchStart);
    canvas.removeEventListener('touchmove', this.onTouchMove);
    canvas.removeEventListener('touchend', this.onTouchEnd);
    canvas.removeEventListener('touchcancel', this.onTouchEnd);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('fullscreenchange', this.onResize);
    document.removeEventListener('webkitfullscreenchange', this.onResize);
    window.removeEventListener('blur', this.onWindowBlur);
    canvas.removeEventListener('webglcontextlost', this.onContextLost);
    canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.isDisposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private scheduleNextFrame(): void {
    if (this.isDisposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private readonly tick = (): void => {
    if (this.isDisposed) return;

    const now = performance.now();
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    this.frameCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.4) {
      this.currentFps = Math.round(this.frameCount / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    if (this.isPlaying && !this.shopOpen && !this.characterWindowOpen) {
      const jumpState = this.player.update(dt);
      if (jumpState.jumped) {
        this.audio.playJumpSound();
      }
      if (jumpState.landedImpact > 0) {
        this.audio.playLandSound(jumpState.landedImpact);
      }
    }

    const clampedDt = Math.min(dt, 0.05);
    if (this.hurtInvulnTimer > 0) {
      this.hurtInvulnTimer = Math.max(0, this.hurtInvulnTimer - clampedDt);
    }

    if (
      this.isPlaying &&
      this.hp < MAX_PLAYER_HP &&
      getCitadelZoneAt(this.player.position.x, this.player.position.z) === 'inside'
    ) {
      this.safeHealTimer += clampedDt;
      if (this.safeHealTimer >= 2.5) {
        this.safeHealTimer = 0;
        this.hp = Math.min(MAX_PLAYER_HP, Math.round((this.hp + 1) * 2) / 2);
        this.emitStats();
      }
    } else {
      this.safeHealTimer = 0;
    }

    this.world.update(
      clampedDt,
      this.player.position.x,
      this.player.position.y,
      this.player.position.z,
      this.player.yaw,
      this.shieldRaised,
      () => this.audio.playBlockSound('place'),
      (earned, lengthBlocks) => {
        this.money += earned;
        this.audio.playCashSound();
        this.emitStats();
        this.callbacks.onToast(
          `+${earned.toLocaleString('vi-VN')} VNĐ (${lengthBlocks.toFixed(1)} block gỗ)`,
        );
      },
      {
        onPlayerHit: (damage, _slimeLevel, dirX, dirZ) => {
          if (!this.isPlaying || this.hurtInvulnTimer > 0) return;
          this.hurtInvulnTimer = 0.5;
          this.hp = Math.max(0, Math.round((this.hp - damage) * 2) / 2);
          this.audio.playPlayerHurtSound();
          if (this.hp <= 0) {
            this.hp = MAX_PLAYER_HP;
            this.hurtInvulnTimer = 1.2;
            this.player.respawnAtStart();
            this.callbacks.onToast(
              'Bạn đã hết máu và trở về vị trí ban đầu (đồ đạc được giữ nguyên)!',
            );
          } else {
            this.player.applyKnockback(dirX, dirZ, 1.5, 0.14);
          }
          this.emitStats();
        },
        onShieldBlocked: (slimeLevel) => {
          if (!this.isPlaying) return;
          this.audio.playShieldBlockSound();
          this.callbacks.onToast(`Khiên đã đỡ đòn Slime Lv.${slimeLevel}!`);
        },
      },
      {
        onSkillWarning: () => {
          if (!this.isPlaying) return;
          this.audio.playDragonWarningSound();
        },
        onSkillExecute: (skillId) => {
          if (!this.isPlaying) return;
          if (skillId === 1) this.audio.playDragonSlamSound();
          else if (skillId === 2) this.audio.playDragonDashSound();
          else this.audio.playDragonBreathSound();
        },
        onPlayerHit: (damage, skillId, shieldMitigated, dirX, dirZ) => {
          if (!this.isPlaying || this.hurtInvulnTimer > 0) return;
          this.hurtInvulnTimer = 0.65;
          this.hp = Math.max(0, Math.round((this.hp - damage) * 2) / 2);
          if (shieldMitigated) {
            this.audio.playShieldBlockSound();
          }
          this.audio.playPlayerHurtSound();
          if (this.hp <= 0) {
            this.hp = MAX_PLAYER_HP;
            this.hurtInvulnTimer = 1.2;
            this.player.respawnAtStart();
            this.callbacks.onToast(
              'Bạn đã hết máu trước Rồng Băng và trở về vị trí ban đầu (đồ đạc được giữ nguyên)!',
            );
          } else {
            const knockDist = skillId === 1 ? 3.0 : 1.0;
            const knockDur = skillId === 1 ? 0.2 : 0.1;
            this.player.applyKnockback(dirX, dirZ, knockDist, knockDur);
            if (skillId === 1 && shieldMitigated) {
              this.callbacks.onToast('Khiên đã giảm sát thương dậm đất (-1 tim · Đẩy lùi 3 block)!');
            } else if (skillId === 1) {
              this.callbacks.onToast('Dính dậm xung kích Rồng Băng (-3 tim · Đẩy lùi 3 block)!');
            } else if (skillId === 2) {
              this.callbacks.onToast('Bị Rồng Băng lao trúng (-2 tim · Khiên vô hiệu)!');
            } else {
              this.callbacks.onToast('Dính lửa băng Rồng (-2 tim · Khiên vô hiệu)!');
            }
          }
          this.emitStats();
        },
        onCollectIceKatana: () => {
          this.handleCollectIceKatana();
        },
      },
      {
        onPoisonWarning: () => {
          if (!this.isPlaying) return;
          this.audio.playPoisonWarningSound();
        },
        onPoisonSpray: () => {
          if (!this.isPlaying) return;
          this.audio.playPoisonSpraySound();
        },
        onPlayerHit: (damage, mushroomLevel, dirX, dirZ) => {
          if (!this.isPlaying || this.hurtInvulnTimer > 0) return;
          this.hurtInvulnTimer = 0.55;
          this.hp = Math.max(0, Math.round((this.hp - damage) * 2) / 2);
          this.audio.playPlayerHurtSound();
          if (this.hp <= 0) {
            this.hp = MAX_PLAYER_HP;
            this.hurtInvulnTimer = 1.2;
            this.player.respawnAtStart();
            this.callbacks.onToast(
              'Bạn đã hết máu vì khí độc và trở về vị trí ban đầu (đồ đạc được giữ nguyên)!',
            );
          } else {
            this.player.applyKnockback(dirX, dirZ, 0.9, 0.12);
            this.callbacks.onToast(
              `Trúng khí độc Nấm Độc Lv.${mushroomLevel} (-${damage} tim)!`,
            );
          }
          this.emitStats();
        },
        onShieldBlocked: (mushroomLevel) => {
          if (!this.isPlaying) return;
          this.audio.playShieldBlockSound();
          this.callbacks.onToast(
            `Khiên đã đỡ đòn phun độc của Nấm Độc Lv.${mushroomLevel}!`,
          );
        },
      },
    );
    if (!this.hasStarted && !this.isPlaying) {
      this.applyTitleMeadowCamera(now);
      this.world.updateChunksAroundPlayer(
        this.camera.position.x,
        this.camera.position.z,
        this.renderDistance,
      );
    } else {
      this.world.updateCarried(this.camera);
      const viewMotion = this.player.getViewmodelMotion();
      this.katanaView.update(
        this.camera,
        clampedDt,
        this.holdingKatana && !this.world.isCarryingLog(),
        viewMotion,
      );
      this.shieldView.update(
        this.camera,
        clampedDt,
        this.world.isShopItemOwned('shield'),
        this.shieldRaised,
        viewMotion,
      );
      this.potionView.update(
        this.camera,
        clampedDt,
        this.holdingPotionSlot !== null && !this.holdingKatana && !this.world.isCarryingLog(),
        viewMotion,
      );

      this.world.updateChunksAroundPlayer(
        this.player.position.x,
        this.player.position.z,
        this.renderDistance,
      );
    }

    this.camera.getWorldDirection(this.rayDir);
    const dropHit = this.world.raycastDroppedIceKatana(this.camera.position, this.rayDir, 6.5);
    const shopHit = this.world.raycastShop(this.camera.position, this.rayDir, 7.0);
    const shopDist = shopHit ? shopHit.point.distanceTo(this.camera.position) : Infinity;

    if (dropHit) {
      this.currentIceKatanaDropTarget = dropHit;
      this.currentDragonTarget = null;
      this.currentShopTarget = null;
      this.currentSlimeTarget = null;
      this.currentMushroomTarget = null;
      this.currentTreeTarget = null;
      this.currentLogTarget = null;
      this.currentConveyorTarget = null;
    } else if (!this.world.isCarryingLog()) {
      this.currentIceKatanaDropTarget = null;
      this.currentConveyorTarget = null;
      const dragonHit = this.world.raycastDragon(this.camera.position, this.rayDir, 8.0);
      const slimeHit = this.world.raycastSlime(this.camera.position, this.rayDir, 6.5);
      const mushroomHit = this.world.raycastMushroom(this.camera.position, this.rayDir, 6.5);
      const treeHit = this.world.raycastTreeTrunk(this.camera.position, this.rayDir, 7.0);
      const logHit = this.world.raycastDetachedLog(this.camera.position, this.rayDir, 7.0);

      const dragonDist = dragonHit ? dragonHit.point.distanceTo(this.camera.position) : Infinity;
      const slimeDist = slimeHit ? slimeHit.point.distanceTo(this.camera.position) : Infinity;
      const mushroomDist = mushroomHit
        ? mushroomHit.point.distanceTo(this.camera.position)
        : Infinity;
      const treeDist = treeHit ? treeHit.point.distanceTo(this.camera.position) : Infinity;
      const logDist = logHit ? logHit.point.distanceTo(this.camera.position) : Infinity;

      if (
        shopHit &&
        shopDist <= dragonDist &&
        shopDist <= slimeDist &&
        shopDist <= mushroomDist &&
        shopDist <= treeDist &&
        shopDist <= logDist
      ) {
        const wallHit = voxelRaycast(this.world, this.camera.position, this.rayDir, shopDist);
        this.currentShopTarget = wallHit ? null : shopHit;
        this.currentDragonTarget = null;
        this.currentSlimeTarget = null;
        this.currentMushroomTarget = null;
        this.currentTreeTarget = null;
        this.currentLogTarget = null;
      } else if (
        dragonHit &&
        dragonDist <= slimeDist &&
        dragonDist <= mushroomDist &&
        dragonDist <= treeDist &&
        dragonDist <= logDist
      ) {
        const wallHit = voxelRaycast(this.world, this.camera.position, this.rayDir, dragonDist);
        this.currentDragonTarget = wallHit ? null : dragonHit;
        this.currentSlimeTarget = null;
        this.currentMushroomTarget = null;
        this.currentTreeTarget = null;
        this.currentLogTarget = null;
        this.currentShopTarget = null;
      } else if (
        slimeHit &&
        slimeDist <= mushroomDist &&
        slimeDist <= treeDist &&
        slimeDist <= logDist
      ) {
        const wallHit = voxelRaycast(this.world, this.camera.position, this.rayDir, slimeDist);
        this.currentSlimeTarget = wallHit ? null : slimeHit;
        this.currentMushroomTarget = null;
        this.currentDragonTarget = null;
        this.currentTreeTarget = null;
        this.currentLogTarget = null;
        this.currentShopTarget = null;
      } else if (mushroomHit && mushroomDist <= treeDist && mushroomDist <= logDist) {
        const wallHit = voxelRaycast(this.world, this.camera.position, this.rayDir, mushroomDist);
        this.currentMushroomTarget = wallHit ? null : mushroomHit;
        this.currentSlimeTarget = null;
        this.currentDragonTarget = null;
        this.currentTreeTarget = null;
        this.currentLogTarget = null;
        this.currentShopTarget = null;
      } else if (treeHit && treeDist <= logDist) {
        const wallHit = voxelRaycast(this.world, this.camera.position, this.rayDir, treeDist);
        this.currentTreeTarget = wallHit ? null : treeHit;
        this.currentDragonTarget = null;
        this.currentSlimeTarget = null;
        this.currentMushroomTarget = null;
        this.currentLogTarget = null;
        this.currentShopTarget = null;
      } else if (logHit) {
        const wallHit = voxelRaycast(this.world, this.camera.position, this.rayDir, logDist);
        this.currentLogTarget = wallHit ? null : logHit;
        this.currentDragonTarget = null;
        this.currentSlimeTarget = null;
        this.currentMushroomTarget = null;
        this.currentTreeTarget = null;
        this.currentShopTarget = null;
      } else {
        this.currentDragonTarget = null;
        this.currentSlimeTarget = null;
        this.currentMushroomTarget = null;
        this.currentTreeTarget = null;
        this.currentLogTarget = null;
        this.currentShopTarget = null;
      }
    } else {
      this.currentIceKatanaDropTarget = null;
      this.currentDragonTarget = null;
      this.currentSlimeTarget = null;
      this.currentMushroomTarget = null;
      this.currentTreeTarget = null;
      this.currentLogTarget = null;
      const convHit = this.world.raycastConveyor(this.camera.position, this.rayDir, 7.0);
      const convDist = convHit ? convHit.point.distanceTo(this.camera.position) : Infinity;

      if (convHit) {
        const wallHit = voxelRaycast(this.world, this.camera.position, this.rayDir, convDist);
        this.currentConveyorTarget = wallHit ? null : convHit;
        this.currentShopTarget = null;
      } else {
        this.currentConveyorTarget = null;
        this.currentShopTarget = null;
      }
    }

    const touchChopTreeTarget =
      this.isPlaying && this.touchTreeHoldActive && !this.holdingKatana
        ? this.raycastUnblockedTreeAtScreen(this.touchClientX, this.touchClientY)
        : null;
    const activeChopTreeTarget = touchChopTreeTarget ?? this.currentTreeTarget;

    const breakHeld =
      this.isPlaying &&
      (this.isLeftMouseDown || this.isTouchBreakHeld || this.touchTreeHoldActive);
    if (breakHeld && !(this.holdingKatana && !this.world.isCarryingLog())) {
      if (activeChopTreeTarget) {
        if (!this.chopCompletedWaitingRelease) {
          const sameSpot =
            this.chopTreeId === activeChopTreeTarget.tree.id &&
            Math.abs(activeChopTreeTarget.cutLocalY - this.chopCutLocalY) <= 0.6;
          if (sameSpot) {
            this.chopElapsed += clampedDt;
            this.chopSoundTimer += clampedDt;
            if (this.chopSoundTimer >= 0.48) {
              this.chopSoundTimer = 0;
              this.audio.playBlockSound('break');
            }
            if (this.chopElapsed >= TREE_HAND_CHOP_DURATION) {
              if (
                this.world.cutTree(
                  activeChopTreeTarget.tree,
                  this.chopCutLocalY,
                  this.player.position.x,
                  this.player.position.z,
                )
              ) {
                this.audio.playBlockSound('break');
                this.currentTreeTarget = null;
                this.touchTreeHoldActive = false;
              }
              this.chopCompletedWaitingRelease = true;
              this.resetChopHold();
            }
          } else {
            this.chopTreeId = activeChopTreeTarget.tree.id;
            this.chopCutLocalY = activeChopTreeTarget.cutLocalY;
            this.chopElapsed = 0;
            this.chopSoundTimer = 0;
          }
        }
      } else {
        this.touchTreeHoldActive = false;
        this.resetChopHold();
      }
    } else if (this.chopTreeId !== null || this.chopElapsed > 0) {
      this.resetChopHold();
    }

    if (activeChopTreeTarget) {
      const { tree, cutLocalY } = activeChopTreeTarget;
      const isChoppingThis =
        this.chopTreeId === tree.id && !(this.holdingKatana && !this.world.isCarryingLog());
      const displayCutY = isChoppingThis ? this.chopCutLocalY : cutLocalY;
      const chopRatio = isChoppingThis
        ? Math.min(1, this.chopElapsed / TREE_HAND_CHOP_DURATION)
        : 0;
      const pulse = chopRatio > 0 ? 1 + Math.sin(this.chopElapsed * 14) * 0.07 : 1;
      const r = tree.trunkRadius * 1.08 * pulse;
      this.treeCutRingMat.color
        .copy(this.treeRingIdleColor)
        .lerp(this.treeRingActiveColor, chopRatio);
      this.treeCutIndicator.position.set(tree.x, tree.baseY + Math.max(0.06, displayCutY), tree.z);
      this.treeCutIndicator.scale.set(r, 1, r);
      this.treeCutIndicator.visible = true;
    } else {
      this.treeCutRingMat.color.copy(this.treeRingIdleColor);
      this.treeCutIndicator.visible = false;
    }

    if (this.interactionEnabled) {
      this.currentTarget = voxelRaycast(this.world, this.camera.position, this.rayDir, 6.5);

      if (this.currentTarget) {
        const [bx, by, bz] = this.currentTarget.blockPos;
        this.selectionBox.position.set(bx + 0.5, by + 0.5, bz + 0.5);
        this.selectionBox.visible = true;
      } else {
        this.selectionBox.visible = false;
      }
    } else if (this.selectionBox.visible) {
      this.currentTarget = null;
      this.selectionBox.visible = false;
    }

    const currentChopProgress =
      this.chopTreeId !== null && !(this.holdingKatana && !this.world.isCarryingLog())
        ? Math.min(1, Math.max(0, this.chopElapsed / TREE_HAND_CHOP_DURATION))
        : 0;
    const chopProgressChanged =
      Math.abs(currentChopProgress - this.lastHudChopProgress) >= 0.015 ||
      (currentChopProgress === 0 && this.lastHudChopProgress !== 0);

    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.1 || chopProgressChanged) {
      this.hudSyncTimer = 0;
      this.emitStats();
    }

    this.updateDragonZoneStormWeather(clampedDt);

    if (!this.hasStarted && !this.isPlaying) {
      this.updateSunShadowTarget(
        this.camera.position.x,
        this.camera.position.y,
        this.camera.position.z,
      );
    } else {
      this.updateSunShadowTarget();
    }
    this.skyDome.position.copy(this.camera.position);

    if (!this.isContextLost) {
      this.renderer.render(this.scene, this.camera);
    }

    this.scheduleNextFrame();
  };

  private updateDragonZoneStormWeather(dt: number): void {
    const inDragonZone =
      this.isPlaying && isInsideDragonZone(this.player.position.x, this.player.position.z);

    if (inDragonZone && !this.wasInDragonZone) {
      this.callbacks.onToast(
        'Mây đen ầm ầm kéo tới! Bạn đã bước vào Lãnh Địa Băng Giá của Rồng Băng!',
      );
      this.lightningTimer = 0.25;
    }
    this.wasInDragonZone = inDragonZone;

    this.stormAnimTime += dt;
    this.stormBlend = THREE.MathUtils.damp(
      this.stormBlend,
      inDragonZone ? 1 : 0,
      inDragonZone ? 1.85 : 2.1,
      dt,
    );

    if (inDragonZone && this.stormBlend > 0.28) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningFlash = 1.0;
        this.lightningBoltTimer = 0.26;
        this.lightningTimer = 2.4 + Math.random() * 3.0;

        for (let i = 0; i < this.lightningBolts.length; i++) {
          const bolt = this.lightningBolts[i];
          const angle = Math.random() * Math.PI * 2;
          const dist = 14 + Math.random() * 24;
          const bx = DRAGON_ZONE_SPEC.x + Math.cos(angle) * dist;
          const bz = DRAGON_ZONE_SPEC.z + Math.sin(angle) * dist;
          bolt.position.set(bx, 11 + Math.random() * 4, bz);
          bolt.rotation.y = Math.random() * Math.PI * 2;
          const s = 0.85 + Math.random() * 0.5;
          bolt.scale.set(s, 0.9 + Math.random() * 0.35, s);
          bolt.visible = i === 0 || Math.random() > 0.35;
        }
        this.lightningPointLight.position.set(
          this.lightningBolts[0].position.x,
          28,
          this.lightningBolts[0].position.z,
        );
        this.audio.playThunderSound(0.75 + Math.random() * 0.35);
      }
    }

    if (this.lightningBoltTimer > 0) {
      this.lightningBoltTimer -= dt;
      const flicker =
        this.lightningBoltTimer > 0.16 ||
        (this.lightningBoltTimer < 0.1 && this.lightningBoltTimer > 0.03);
      for (const bolt of this.lightningBolts) {
        if (bolt.position.y > 0) {
          bolt.visible = flicker && this.lightningBoltTimer > 0;
        }
      }
      this.lightningBoltMat.opacity = flicker ? 0.95 : 0.28;
      if (this.lightningBoltTimer <= 0) {
        for (const bolt of this.lightningBolts) {
          bolt.visible = false;
        }
      }
    }

    if (this.lightningFlash > 0) {
      this.lightningFlash = Math.max(0, this.lightningFlash - dt * 3.8);
    }

    const storm = this.stormBlend;
    const flash = this.lightningFlash * storm;

    this.skyDomeMat.uniforms.uStorm.value = storm;
    this.skyDomeMat.uniforms.uTime.value = this.stormAnimTime;
    this.skyDomeMat.uniforms.uLightning.value = flash;

    this.tempSkyColor.copy(this.clearSkyBg).lerp(this.stormSkyBg, storm);
    if (flash > 0.01) {
      this.tempSkyColor.lerp(this.flashSkyBg, flash * 0.42);
    }
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(this.tempSkyColor);
    }
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(this.tempSkyColor);
      const baseNear = this.renderDistance * CHUNK_SIZE * 0.48;
      const baseFar = this.renderDistance * CHUNK_SIZE * 1.02;
      this.scene.fog.near = baseNear * (1 - storm * 0.46);
      this.scene.fog.far = baseFar * (1 - storm * 0.34);
    }

    this.hemiLight.color.copy(this.clearHemiSky).lerp(this.stormHemiSky, storm);
    this.hemiLight.groundColor.copy(this.clearHemiGround).lerp(this.stormHemiGround, storm);
    this.hemiLight.intensity = 0.92 * (1 - storm * 0.38) + flash * 0.85;

    this.sunLight.color.copy(this.clearSunColor).lerp(this.stormSunColor, storm);
    this.sunLight.intensity = 1.95 * (1 - storm * 0.62) + flash * 1.4;

    this.rimLight.color.copy(this.clearRimColor).lerp(this.stormRimColor, storm);
    this.rimLight.intensity = 0.48 + storm * 0.25 + flash * 0.9;

    this.scene.environmentIntensity = 0.55 * (1 - storm * 0.32) + flash * 0.25;
    this.lightningPointLight.intensity = flash * 12;

    if (storm > 0.06) {
      this.stormSnowPoints.visible = true;
      this.stormSnowMat.opacity = Math.min(0.75, storm * 0.72);
      const posAttr = this.stormSnowPoints.geometry.getAttribute(
        'position',
      ) as THREE.BufferAttribute;
      const arr = this.stormSnowPositions;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] += (1.9 + Math.sin(this.stormAnimTime * 1.4 + i) * 0.65) * dt;
        arr[i + 1] -= (3.6 + (i % 5) * 0.35) * dt;
        arr[i + 2] += 1.25 * dt;
        if (arr[i] > 17) arr[i] -= 34;
        if (arr[i + 1] < -6) arr[i + 1] += 18;
        if (arr[i + 2] > 17) arr[i + 2] -= 34;
      }
      posAttr.needsUpdate = true;
      this.stormSnowPoints.position.copy(this.camera.position);
    } else if (this.stormSnowPoints.visible) {
      this.stormSnowPoints.visible = false;
    }
  }

  dispose(): void {
    this.isDisposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.statsListeners.clear();
    this.unbindEvents();
    this.world.disposeAll();
    this.katanaView.dispose();
    this.shieldView.dispose();
    this.potionView.dispose();
    this.selectionBox.geometry.dispose();
    (this.selectionBox.material as THREE.Material).dispose();
    this.treeCutIndicator.geometry.dispose();
    (this.treeCutIndicator.material as THREE.Material).dispose();
    this.skyDome.geometry.dispose();
    (this.skyDome.material as THREE.Material).dispose();
    for (const bolt of this.lightningBolts) {
      bolt.geometry.dispose();
    }
    this.lightningBoltMat.dispose();
    this.stormSnowPoints.geometry.dispose();
    this.stormSnowMat.dispose();
    this.envRenderTarget.dispose();
    this.solidMaterial.dispose();
    this.audio.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
