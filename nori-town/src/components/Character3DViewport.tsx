import { memo, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  animateCharacterIdle,
  CharacterAssetHandles,
  CharacterBuildOptions,
  createCharacterMeshGroup,
  disposeCharacterAssets,
} from '../game/characterModel';
import { CharacterGender } from '../game/firstPersonArms';

interface Character3DViewportProps {
  gender: CharacterGender;
  hasKatana?: boolean;
  hasIceKatana?: boolean;
  hasShield?: boolean;
  previewWeapon?: boolean;
  interactiveRotate?: boolean;
  initialYaw?: number;
  className?: string;
}

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
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

export const Character3DViewport = memo(function Character3DViewport({
  gender,
  hasKatana = false,
  hasIceKatana = false,
  hasShield = false,
  previewWeapon = false,
  interactiveRotate = true,
  initialYaw = 0.24,
  className = '',
}: Character3DViewportProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [contextError, setContextError] = useState(false);

  const yawTargetRef = useRef(initialYaw);
  const yawCurrentRef = useRef(initialYaw);
  const swayWeightRef = useRef(1);
  const lastSwayOffsetRef = useRef(0);
  const draggingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const lastXRef = useRef(0);

  const optionsRef = useRef<CharacterBuildOptions>({
    hasKatana,
    hasIceKatana,
    hasShield,
    previewWeapon,
  });
  optionsRef.current = { hasKatana, hasIceKatana, hasShield, previewWeapon };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setContextError(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = Math.max(160, container.clientWidth || 260);
    const height = Math.max(220, container.clientHeight || 340);
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    roomEnv.dispose();
    pmrem.dispose();
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.7;

    const camera = new THREE.PerspectiveCamera(29, width / height, 0.1, 20);
    camera.position.set(0, 1.02, 3.48);
    camera.lookAt(0, 0.94, 0);

    // Ánh sáng studio 3 điểm tương phản đẹp mắt: Key Light ấm chếch bên + Fill dịu + Rim Light viền sáng nổi bật
    const hemi = new THREE.HemisphereLight('#e2e8f0', '#1e293b', 0.78);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight('#fff2dc', 2.15);
    keyLight.position.set(3.0, 4.2, 2.7);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(512, 512);
    keyLight.shadow.camera.left = -1.6;
    keyLight.shadow.camera.right = 1.6;
    keyLight.shadow.camera.top = 2.4;
    keyLight.shadow.camera.bottom = -0.5;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const frontFillLight = new THREE.DirectionalLight('#e2e8f0', 0.36);
    frontFillLight.position.set(-0.9, 1.2, 3.5);
    scene.add(frontFillLight);

    const rimLight = new THREE.DirectionalLight(
      gender === 'male' ? '#60a5fa' : '#fb7185',
      1.5,
    );
    rimLight.position.set(-2.5, 2.7, -2.3);
    scene.add(rimLight);

    const backAccentLight = new THREE.DirectionalLight(
      gender === 'male' ? '#93c5fd' : '#fda4af',
      0.48,
    );
    backAccentLight.position.set(2.2, 1.4, -2.0);
    scene.add(backAccentLight);

    // Đĩa bệ đứng parabol tinh tế + vòng hào quang dưới chân nhân vật
    const pedestalGeo = new THREE.CylinderGeometry(0.68, 0.75, 0.055, 36);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: gender === 'male' ? '#172234' : '#281422',
      roughness: 0.28,
      metalness: 0.72,
    });
    const pedestalRimGeo = new THREE.TorusGeometry(0.68, 0.015, 10, 40);
    pedestalRimGeo.rotateX(Math.PI / 2);
    const pedestalRimMat = new THREE.MeshStandardMaterial({
      color: gender === 'male' ? '#38bdf8' : '#fb7185',
      emissive: gender === 'male' ? '#0284c7' : '#e11d48',
      emissiveIntensity: 0.95,
      roughness: 0.22,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -0.027;
    pedestal.receiveShadow = true;
    const pedestalRim = new THREE.Mesh(pedestalRimGeo, pedestalRimMat);
    pedestalRim.position.y = 0.002;
    scene.add(pedestal, pedestalRim);

    // Các hạt ánh sáng / cánh hoa anh đào bay lơ lửng quanh bệ đứng
    const particleCount = isSoftwareGl ? 16 : 28;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleAngles = new Float32Array(particleCount);
    const particleRadii = new Float32Array(particleCount);
    const particleSpeeds = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      const a = (i / particleCount) * Math.PI * 2 + (i % 3) * 0.4;
      const r = 0.56 + (i % 5) * 0.12;
      particleAngles[i] = a;
      particleRadii[i] = r;
      particleSpeeds[i] = 0.18 + (i % 4) * 0.06;
      particlePositions[i * 3] = Math.cos(a) * r;
      particlePositions[i * 3 + 1] = 0.08 + ((i * 0.37) % 1.75);
      particlePositions[i * 3 + 2] = Math.sin(a) * r;
    }
    const particleGeo = new THREE.BufferGeometry();
    const particlePosAttr = new THREE.BufferAttribute(particlePositions, 3);
    particleGeo.setAttribute('position', particlePosAttr);
    const particleMat = new THREE.PointsMaterial({
      color: gender === 'male' ? '#bae6fd' : '#fbcfe8',
      size: gender === 'male' ? 0.028 : 0.034,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ambientParticles = new THREE.Points(particleGeo, particleMat);
    scene.add(ambientParticles);

    const maxAnisotropy = isSoftwareGl
      ? 1
      : Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const assets: CharacterAssetHandles = {
      geometries: [],
      materials: [],
      textures: [],
      skeletons: [],
    };
    const charGroup = createCharacterMeshGroup(gender, assets, {
      ...optionsRef.current,
      maxAnisotropy,
    });
    charGroup.rotation.y = yawCurrentRef.current;
    scene.add(charGroup);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let disposed = false;
    let contextLost = false;
    let frameId = 0;
    const startTime = performance.now();
    let lastTime = startTime;
    yawTargetRef.current = initialYaw;
    yawCurrentRef.current = initialYaw;
    swayWeightRef.current = 1;
    lastSwayOffsetRef.current = 0;

    const handleResize = () => {
      if (disposed) return;
      const w = Math.max(160, container.clientWidth);
      const h = Math.max(220, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleResize) : null;
    resizeObserver?.observe(container);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
    };
    const onContextRestored = () => {
      contextLost = false;
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
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
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      const elapsed = (now - startTime) * 0.001;
      lastTime = now;

      if (!interactiveRotate) {
        // Luôn hướng mặt về phía người chơi với nhịp xoay nhẹ tự nhiên
        yawCurrentRef.current = initialYaw + Math.sin(elapsed * 1.1) * 0.24;
        charGroup.rotation.y = yawCurrentRef.current;
      } else {
        yawCurrentRef.current = THREE.MathUtils.damp(
          yawCurrentRef.current,
          yawTargetRef.current,
          draggingRef.current ? 24 : 12,
          dt,
        );
        swayWeightRef.current = THREE.MathUtils.damp(
          swayWeightRef.current,
          draggingRef.current ? 0 : 1,
          8,
          dt,
        );
        const swayOffset = Math.sin(elapsed * 0.9) * 0.08 * swayWeightRef.current;
        lastSwayOffsetRef.current = swayOffset;
        charGroup.rotation.y = yawCurrentRef.current + swayOffset;
      }
      charGroup.position.y = Math.sin(elapsed * 2.2) * 0.012;
      animateCharacterIdle(charGroup, elapsed);

      for (let i = 0; i < particleCount; i++) {
        const a = particleAngles[i] + elapsed * particleSpeeds[i];
        const r = particleRadii[i] + Math.sin(elapsed * 1.3 + i) * 0.04;
        let y = particlePositions[i * 3 + 1] + dt * (0.14 + (i % 3) * 0.05);
        if (y > 1.85) y = 0.05;
        particlePositions[i * 3] = Math.cos(a) * r;
        particlePositions[i * 3 + 1] = y;
        particlePositions[i * 3 + 2] = Math.sin(a) * r;
      }
      particlePosAttr.needsUpdate = true;

      if (!contextLost) {
        renderer.render(scene, camera);
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver?.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      scene.remove(charGroup);
      disposeCharacterAssets(assets);
      pedestalGeo.dispose();
      pedestalMat.dispose();
      pedestalRimGeo.dispose();
      pedestalRimMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [gender, hasKatana, hasIceKatana, hasShield, previewWeapon, interactiveRotate, initialYaw]);

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    activePointerIdRef.current = null;
    draggingRef.current = false;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Bỏ qua nếu trình duyệt đã tự giải phóng pointer capture
    }
  };

  return (
    <div
      ref={mountRef}
      onPointerDown={(e) => {
        if (!interactiveRotate) return;
        if (activePointerIdRef.current !== null) return;
        e.preventDefault();
        e.stopPropagation();
        activePointerIdRef.current = e.pointerId;
        draggingRef.current = true;
        lastXRef.current = e.clientX;
        // Gộp độ lệch đung đưa hiện tại vào góc xoay để không bị giật khi vừa chạm tay
        const offset = lastSwayOffsetRef.current;
        if (offset !== 0) {
          yawCurrentRef.current += offset;
          yawTargetRef.current = yawCurrentRef.current;
          lastSwayOffsetRef.current = 0;
          swayWeightRef.current = 0;
        }
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Bỏ qua nếu trình duyệt không hỗ trợ capture
        }
      }}
      onPointerMove={(e) => {
        if (!interactiveRotate || !draggingRef.current) return;
        if (activePointerIdRef.current !== e.pointerId) return;
        e.preventDefault();
        e.stopPropagation();
        const dx = e.clientX - lastXRef.current;
        lastXRef.current = e.clientX;
        yawTargetRef.current += dx * 0.014;
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={() => {
        activePointerIdRef.current = null;
        draggingRef.current = false;
      }}
      className={`relative w-full h-full select-none ${
        interactiveRotate ? 'touch-none cursor-grab active:cursor-grabbing' : ''
      } ${className}`}
    >
      {contextError && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-300 bg-slate-900/75 rounded-2xl p-4 text-center">
          Mô hình 3D ({gender === 'male' ? 'Nam' : 'Nữ'})
        </div>
      )}
    </div>
  );
});
