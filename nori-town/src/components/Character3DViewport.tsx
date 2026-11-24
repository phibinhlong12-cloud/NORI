import { memo, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
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
  const draggingRef = useRef(false);
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

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 20);
    camera.position.set(0, 1.0, 3.08);
    camera.lookAt(0, 0.92, 0);

    // Ánh sáng studio: Key Light ấm + Front Fill dịu + Hemisphere lạnh + Rim Light tách nền
    const hemi = new THREE.HemisphereLight('#e2e8f0', '#1e293b', 0.95);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight('#fff4e0', 1.95);
    keyLight.position.set(2.4, 4.0, 3.4);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(512, 512);
    keyLight.shadow.camera.left = -1.6;
    keyLight.shadow.camera.right = 1.6;
    keyLight.shadow.camera.top = 2.4;
    keyLight.shadow.camera.bottom = -0.5;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const frontFillLight = new THREE.DirectionalLight('#f1f5f9', 0.65);
    frontFillLight.position.set(-0.6, 1.35, 3.6);
    scene.add(frontFillLight);

    const rimLight = new THREE.DirectionalLight(
      gender === 'male' ? '#60a5fa' : '#fb7185',
      0.95,
    );
    rimLight.position.set(-2.4, 2.6, -2.5);
    scene.add(rimLight);

    // Đĩa bệ đứng parabol tinh tế dưới chân nhân vật
    const pedestalGeo = new THREE.CylinderGeometry(0.68, 0.74, 0.05, 32);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: gender === 'male' ? '#1e293b' : '#2b1623',
      roughness: 0.32,
      metalness: 0.65,
    });
    const pedestalRimGeo = new THREE.TorusGeometry(0.68, 0.014, 10, 36);
    pedestalRimGeo.rotateX(Math.PI / 2);
    const pedestalRimMat = new THREE.MeshStandardMaterial({
      color: gender === 'male' ? '#38bdf8' : '#fb7185',
      emissive: gender === 'male' ? '#0284c7' : '#e11d48',
      emissiveIntensity: 0.85,
      roughness: 0.25,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -0.025;
    pedestal.receiveShadow = true;
    const pedestalRim = new THREE.Mesh(pedestalRimGeo, pedestalRimMat);
    pedestalRim.position.y = 0.002;
    scene.add(pedestal, pedestalRim);

    const assets: CharacterAssetHandles = {
      geometries: [],
      materials: [],
      textures: [],
    };
    const charGroup = createCharacterMeshGroup(gender, assets, optionsRef.current);
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
          8,
          dt,
        );
        const idleSway = draggingRef.current ? 0 : Math.sin(elapsed * 0.9) * 0.14;
        charGroup.rotation.y = yawCurrentRef.current + idleSway;
      }
      charGroup.position.y = Math.sin(elapsed * 2.2) * 0.014;

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
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [gender, hasKatana, hasIceKatana, hasShield, previewWeapon, interactiveRotate, initialYaw]);

  return (
    <div
      ref={mountRef}
      onPointerDown={(e) => {
        if (!interactiveRotate) return;
        draggingRef.current = true;
        lastXRef.current = e.clientX;
      }}
      onPointerMove={(e) => {
        if (!interactiveRotate || !draggingRef.current) return;
        const dx = e.clientX - lastXRef.current;
        lastXRef.current = e.clientX;
        yawTargetRef.current += dx * 0.012;
      }}
      onPointerUp={() => {
        draggingRef.current = false;
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
      }}
      onPointerLeave={() => {
        draggingRef.current = false;
      }}
      className={`relative w-full h-full select-none ${
        interactiveRotate ? 'cursor-grab active:cursor-grabbing' : ''
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
