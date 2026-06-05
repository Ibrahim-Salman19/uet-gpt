"use client";

import * as React from "react";
import * as THREE from "three";
import { usePreferences } from "@/components/preferences-provider";

export function WebGLBackdrop() {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const { webglEnabled } = usePreferences();

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check WebGL availability using a temporary canvas
    try {
      const tempCanvas = document.createElement("canvas");
      const gl = tempCanvas.getContext("webgl") || tempCanvas.getContext("experimental-webgl");
      if (!gl) {
        console.warn("WebGL not available, skipping 3D backdrop");
        return;
      }
    } catch (e) {
      console.warn("WebGL detection failed", e);
      return;
    }

    // Detect mobile
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
      precision: "mediump",
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.0 : 1.2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Create scene and camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    camera.position.z = 10;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.05);
    scene.add(ambientLight);

    // Generate particles
    const particleCount = isMobile ? 80 : 200;
    const positions = new Float32Array(particleCount * 3);
    const driftVelocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 15;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 15;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
      driftVelocities[i * 3] = (Math.random() - 0.5) * 0.002;
      driftVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.002;
      driftVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.002;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.035,
      color: 0x71717a,
      transparent: true,
      opacity: 0.15,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });

    const particleField = new THREE.Points(particleGeo, particleMat);
    scene.add(particleField);

    let frameId: number;
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;
    let slowFrameCount = 0;
    const TARGET_FRAME_MS = 1000 / 30; // Target 30fps

    const handleMouseMove = (event: MouseEvent) => {
      mouseX = (event.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
      mouseY = (event.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
    };

    window.addEventListener("mousemove", handleMouseMove);

    const animate = () => {
      if (!webglEnabled) {
        renderer.render(scene, camera);
        return;
      }

      const frameStart = performance.now();

      const elapsed = performance.now() * 0.001;
      const positionAttr = particleGeo.getAttribute("position") as THREE.BufferAttribute;
      if (!positionAttr) return;
      const pos = positionAttr.array as Float32Array;

      // Mouse tracking inertia
      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;

      // Update particle positions with drift and magnetic hover effect
      for (let i = 0; i < particleCount; i++) {
        const idxX = i * 3;
        const idxY = i * 3 + 1;
        const idxZ = i * 3 + 2;

        const valX = pos[idxX];
        const valY = pos[idxY];
        const valZ = pos[idxZ];
        const driftX = driftVelocities[idxX];
        const driftY = driftVelocities[idxY];
        const driftZ = driftVelocities[idxZ];

        if (
          valX !== undefined &&
          valY !== undefined &&
          valZ !== undefined &&
          driftX !== undefined &&
          driftY !== undefined &&
          driftZ !== undefined
        ) {
          const nextX = valX + driftX;
          const nextY = valY + driftY;
          const nextZ = valZ + driftZ;

          pos[idxX] = Math.abs(nextX) > 7.5 ? -nextX : nextX;
          pos[idxY] = Math.abs(nextY) > 7.5 ? -nextY : nextY;
          pos[idxZ] = Math.abs(nextZ) > 5.0 ? -nextZ : nextZ;
        }
      }

      positionAttr.needsUpdate = true;

      // Slow orbital rotate + mouse magnetic pull
      particleField.rotation.y = elapsed * 0.01 + targetX * 0.15;
      particleField.rotation.x = elapsed * 0.005 - targetY * 0.15;

      renderer.render(scene, camera);

      const frameTime = performance.now() - frameStart;
      if (frameTime > TARGET_FRAME_MS) {
        slowFrameCount++;
        if (slowFrameCount > 120) {
          // Frame rate is consistently low, disable WebGL backdrop animation
          console.warn("WebGL backdrop performance degraded, halting render loop");
          cancelAnimationFrame(frameId);
          return;
        }
      } else {
        slowFrameCount = Math.max(0, slowFrameCount - 1);
      }

      frameId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      if (!webglEnabled) renderer.render(scene, camera);
    };

    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();
      try {
        renderer.forceContextLoss();
      } catch (e) {}
    };
  }, [webglEnabled]);

  return (
    <canvas
      ref={canvasRef}
      id="webgl-canvas"
      className="fixed inset-0 z-0 pointer-events-none"
      aria-hidden="true"
    />
  );
}
