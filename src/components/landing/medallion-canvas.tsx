"use client";

import { useEffect, useRef } from "react";

export function MedallionCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    import("three").then((THREE) => {
      if (!isMounted) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        0.1,
        1000,
      );
      camera.position.z = 5;

      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const geometry = new THREE.IcosahedronGeometry(1.6, 1);
      const material = new THREE.MeshStandardMaterial({
        color: 0xd9b451,
        wireframe: true,
        transparent: true,
        opacity: 0.18,
      });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);
      const pointLight = new THREE.PointLight(0xd9b451, 1.5);
      pointLight.position.set(2, 3, 4);
      scene.add(pointLight);

      let animId: number;
      const animate = () => {
        animId = requestAnimationFrame(animate);
        mesh.rotation.x += 0.0015;
        mesh.rotation.y += 0.0025;
        renderer.render(scene, camera);
      };
      animate();

      const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
        cancelAnimationFrame(animId);
        renderer.dispose();
      };
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0 opacity-40 transition-opacity duration-1000"
    />
  );
}
