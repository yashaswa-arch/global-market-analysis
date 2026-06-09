import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface GlobeMapProps {
  markers: { location: [number, number]; size: number; color?: [number, number, number] }[];
  theme?: "light" | "dark";
}

export function GlobeMap({ markers, theme = "dark" }: GlobeMapProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webglError, setWebglError] = useState(false);
  
  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ 
        alpha: true, 
        antialias: true,
        powerPreference: "high-performance"
      });
    } catch (e) {
      console.error("WebGL Initialization Error:", e);
      setWebglError(true);
      return;
    }

    // 1. Scene Setup
    const scene = new THREE.Scene();
    
    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(
      45,
      currentMount.clientWidth / currentMount.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 2.9;

    // 3. Renderer Setup
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    currentMount.appendChild(renderer.domElement);

    const isDark = theme === "dark";

    // 4. Geometry & Material Initialization
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, isDark ? 0.4 : 0.85);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, isDark ? 1.5 : 1.2);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);

    // Subtle blue backlight for dramatic premium effect
    const backLight = new THREE.DirectionalLight(0x3b82f6, isDark ? 0.8 : 0.4);
    backLight.position.set(-5, 3, -5);
    scene.add(backLight);

    // --- Textured Earth Sphere ---
    const textureLoader = new THREE.TextureLoader();
    const earthTextureUrl = isDark 
      ? 'https://unpkg.com/three-globe/example/img/earth-night.jpg'
      : 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';

    // Premium high-poly geometry
    const globeGeom = new THREE.SphereGeometry(1, 128, 128);
    
    // Premium material with bump and specular maps
    const globeMat = new THREE.MeshPhongMaterial({
      map: textureLoader.load(earthTextureUrl),
      bumpMap: textureLoader.load('https://unpkg.com/three-globe/example/img/earth-topology.png'),
      bumpScale: 0.04,
      specularMap: textureLoader.load('https://unpkg.com/three-globe/example/img/earth-water.png'),
      specular: new THREE.Color('grey'),
      shininess: 15
    });
    const globeSphere = new THREE.Mesh(globeGeom, globeMat);
    globeGroup.add(globeSphere);

    // --- Clouds Layer ---
    const cloudGeom = new THREE.SphereGeometry(1.015, 64, 64);
    const cloudMat = new THREE.MeshPhongMaterial({
      map: textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png'),
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const cloudSphere = new THREE.Mesh(cloudGeom, cloudMat);
    globeGroup.add(cloudSphere);

    // --- Atmosphere Glow ---
    const glowGeom = new THREE.SphereGeometry(1.04, 64, 64);
    const glowMat = new THREE.MeshBasicMaterial({
      color: isDark ? 0x1e40af : 0x60a5fa,
      transparent: true,
      opacity: isDark ? 0.15 : 0.25,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const glowSphere = new THREE.Mesh(glowGeom, glowMat);
    globeGroup.add(glowSphere);

    // --- Markers ---
    const markerGroup = new THREE.Group();
    const markerMeshes: THREE.Mesh[] = [];

    markers.forEach(marker => {
      // Convert lat/long to 3D Cartesian coordinates
      const lat = marker.location[0];
      const lng = marker.location[1];
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lng + 180) * (Math.PI / 180);

      const x = -(Math.sin(phi) * Math.cos(theta));
      const z = (Math.sin(phi) * Math.sin(theta));
      const y = (Math.cos(phi));

      const mColorArray = marker.color || [1, 0, 0];
      const mColor = new THREE.Color(mColorArray[0], mColorArray[1], mColorArray[2]);

      // Core dot
      const markerGeom = new THREE.SphereGeometry(marker.size, 16, 16);
      const markerMat = new THREE.MeshBasicMaterial({ 
        color: mColor,
        transparent: true,
        opacity: 0.9
      });
      const markerMesh = new THREE.Mesh(markerGeom, markerMat);
      
      // Position slightly above surface and clouds
      markerMesh.position.set(x * 1.02, y * 1.02, z * 1.02);
      
      // Store original scale for animation
      markerMesh.userData = { 
        baseScale: 1, 
        pulsePhase: Math.random() * Math.PI * 2 
      };
      
      markerMeshes.push(markerMesh);
      markerGroup.add(markerMesh);
      
      // Outer ring (pulsing)
      const ringGeom = new THREE.RingGeometry(marker.size * 1.2, marker.size * 1.8, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: mColor,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide
      });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.position.set(x * 1.025, y * 1.025, z * 1.025);
      ringMesh.lookAt(new THREE.Vector3(x * 2, y * 2, z * 2));
      
      ringMesh.userData = { 
        baseScale: 1, 
        pulsePhase: Math.random() * Math.PI * 2,
        isRing: true
      };
      
      markerMeshes.push(ringMesh);
      markerGroup.add(ringMesh);
    });
    
    globeGroup.add(markerGroup);

    // Initial Tilt
    globeGroup.rotation.x = 0.3;
    globeGroup.rotation.z = -0.1;

    // 5. Render Loop
    let animationFrameId: number;
    let isRendering = true;
    let time = 0;

    const render = () => {
      if (!isRendering) return;
      
      time += 0.05;

      // Rotation
      globeGroup.rotation.y += 0.001; // Slower elegant rotation
      cloudSphere.rotation.y += 0.0003; // Clouds move slightly faster

      // Animate Markers
      markerMeshes.forEach(mesh => {
        mesh.userData.pulsePhase += 0.05;
        const scale = mesh.userData.baseScale + Math.sin(mesh.userData.pulsePhase) * (mesh.userData.isRing ? 0.3 : 0.1);
        mesh.scale.set(scale, scale, scale);
        if (mesh.userData.isRing) {
          (mesh.material as THREE.MeshBasicMaterial).opacity = 0.4 - Math.sin(mesh.userData.pulsePhase) * 0.2;
        }
      });

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    // 6. Handle Resize
    const handleResize = () => {
      if (!currentMount) return;
      const width = currentMount.clientWidth;
      const height = currentMount.clientHeight;
      if (width === 0 || height === 0) return;

      const aspect = width / height;
      camera.aspect = aspect;
      
      // Dynamically adjust Z position so the globe is never cropped 
      // regardless of the container's aspect ratio.
      const baseZ = 3.5; // Increased to ensure no top/bottom clipping
      camera.position.z = aspect < 1 ? baseZ / aspect : baseZ;

      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    // Call once to ensure the initial render is perfectly framed
    handleResize();

    // Use ResizeObserver for responsive container matching
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(currentMount);

    // 7. Complete Cleanup (Crucial for React 18 StrictMode)
    return () => {
      isRendering = false;
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameId);
      
      if (currentMount && currentMount.contains(renderer.domElement)) {
        currentMount.removeChild(renderer.domElement);
      }
      
      // Dispose Geometries & Materials
      globeGeom.dispose();
      if (globeMat.map) globeMat.map.dispose();
      if (globeMat.bumpMap) globeMat.bumpMap.dispose();
      if (globeMat.specularMap) globeMat.specularMap.dispose();
      globeMat.dispose();
      
      cloudGeom.dispose();
      if (cloudMat.map) cloudMat.map.dispose();
      cloudMat.dispose();

      glowGeom.dispose();
      glowMat.dispose();
      
      markerMeshes.forEach(mesh => {
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m: THREE.Material) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      });
      
      renderer.dispose();
    };
  }, [markers, theme]);

  if (webglError) {
    return (
      <div style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)",
        borderRadius: "8px", border: "1px dashed var(--line)", padding: "20px", textAlign: "center"
      }}>
        <div style={{ color: "var(--muted)", marginBottom: "8px" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
        </div>
        <div style={{ fontSize: "0.85rem", color: "var(--text)", fontWeight: 500 }}>Globe Visualization Unavailable</div>
        <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "4px" }}>WebGL is not supported in your browser.</div>
      </div>
    );
  }

  return (
    <div 
      ref={mountRef} 
      style={{ 
        width: "100%", 
        height: "100%", 
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "visible"
      }} 
    />
  );
}

