"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const AREAS = ["AREA-1", "AREA-2", "AREA-3"];

const AREA_CONFIG = {
  "AREA-1": {
    name: "Sector Alpha (TR-AREA-1)",
    transformerId: "TR-AREA-1",
    color: "#2563eb", // Apple Blue
    prefix: "A1-C",
    xOffset: -50,
  },
  "AREA-2": {
    name: "Sector Beta (TR-AREA-2)",
    transformerId: "TR-AREA-2",
    color: "#059669", // Apple Emerald Green
    prefix: "A2-C",
    xOffset: 0,
  },
  "AREA-3": {
    name: "Sector Gamma (TR-AREA-3)",
    transformerId: "TR-AREA-3",
    color: "#7c3aed", // Apple Purple
    prefix: "A3-C",
    xOffset: 50,
  },
};

export default function Microgrid3DView({
  latestReadings,
  latestTransformers,
  activeArea,
  activeHouse,
  cutHouses,
  reducedHouses,
  searchFilter,
  onSelectArea,
  onSelectHouse,
  isRunning,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [labels, setLabels] = useState([]);
  const [tfLabels, setTfLabels] = useState([]);
  const [viewPreset, setViewPreset] = useState("overview");

  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const houseMeshMapRef = useRef({});
  const transformerMeshMapRef = useRef({});

  // Pre-generate list of 150 houses
  const allHousesList = useRef([]);
  if (allHousesList.current.length === 0) {
    const list = [];
    AREAS.forEach((areaKey) => {
      const config = AREA_CONFIG[areaKey];
      for (let i = 1; i <= 50; i++) {
        const consumerId = `${config.prefix}${100 + i}`;
        list.push({ consumerId, areaKey });
      }
    });
    allHousesList.current = list;
  }

  // 1. Initialize Three.js Light Scene with Environment, Roads, Trees, Light Poles, and Animated Cars
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f1f5f9"); // slate-100
    scene.fog = new THREE.FogExp2("#f1f5f9", 0.007);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 55, 95);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 10;
    controls.maxDistance = 220;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight("#ffffff", 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight("#ffffff", 1.3);
    dirLight.position.set(50, 90, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 250;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight("#e2e8f0", 0.5);
    fillLight.position.set(-50, 40, -50);
    scene.add(fillLight);

    // Ground Base
    const groundGeo = new THREE.PlaneGeometry(260, 160);
    const groundMat = new THREE.MeshStandardMaterial({
      color: "#f8fafc",
      roughness: 0.8,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    scene.add(ground);

    // Ground Grid Helper
    const gridHelper = new THREE.GridHelper(240, 60, "#cbd5e1", "#e2e8f0");
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    // ==========================================
    // --- 1. ROADS NETWORK BETWEEN ALL SECTORS ---
    // ==========================================
    const roadMat = new THREE.MeshStandardMaterial({
      color: "#334155", // Asphalt slate
      roughness: 0.7,
      metalness: 0.2,
    });
    const stripeMat = new THREE.MeshBasicMaterial({ color: "#fef08a" }); // Yellow road dashes

    // Main East-West Avenue 1 (Between Transformers & Houses: Z = -22)
    const ewRoad1 = new THREE.Mesh(new THREE.PlaneGeometry(250, 6.5), roadMat);
    ewRoad1.rotation.x = -Math.PI / 2;
    ewRoad1.position.set(0, 0.01, -22);
    ewRoad1.receiveShadow = true;
    scene.add(ewRoad1);

    // Main East-West Avenue 2 (Front Street: Z = 38)
    const ewRoad2 = new THREE.Mesh(new THREE.PlaneGeometry(250, 6.5), roadMat);
    ewRoad2.rotation.x = -Math.PI / 2;
    ewRoad2.position.set(0, 0.01, 38);
    ewRoad2.receiveShadow = true;
    scene.add(ewRoad2);

    // Yellow Lane Dash Stripes on East-West Roads
    for (let x = -120; x <= 120; x += 8) {
      const stripe1 = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.3), stripeMat);
      stripe1.rotation.x = -Math.PI / 2;
      stripe1.position.set(x, 0.02, -22);
      scene.add(stripe1);

      const stripe2 = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.3), stripeMat);
      stripe2.rotation.x = -Math.PI / 2;
      stripe2.position.set(x, 0.02, 38);
      scene.add(stripe2);
    }

    // North-South Avenues (Between Sector Alpha, Beta, & Gamma)
    const nsXPositions = [-75, -25, 25, 75];
    nsXPositions.forEach((xPos) => {
      const nsRoad = new THREE.Mesh(new THREE.PlaneGeometry(6, 95), roadMat);
      nsRoad.rotation.x = -Math.PI / 2;
      nsRoad.position.set(xPos, 0.015, 8);
      nsRoad.receiveShadow = true;
      scene.add(nsRoad);

      // Yellow Center Stripes for North-South Avenues
      for (let z = -35; z <= 48; z += 8) {
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 4), stripeMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(xPos, 0.025, z);
        scene.add(stripe);
      }
    });

    // ==========================================
    // --- 2. TREES ALONG STREETS & SECTORS ---
    // ==========================================
    const treeTrunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 2.2, 8);
    const treeTrunkMat = new THREE.MeshStandardMaterial({ color: "#78350f", roughness: 0.9 });

    const treeFoliageGeo1 = new THREE.SphereGeometry(1.5, 12, 12);
    const treeFoliageGeo2 = new THREE.SphereGeometry(1.2, 12, 12);
    const leafColors = ["#059669", "#10b981", "#047857", "#15803d"];

    function createTree(x, z) {
      const treeGroup = new THREE.Group();
      treeGroup.position.set(x, 0, z);

      // Trunk
      const trunk = new THREE.Mesh(treeTrunkGeo, treeTrunkMat);
      trunk.position.y = 1.1;
      trunk.castShadow = true;
      treeGroup.add(trunk);

      // Canopy
      const leafColor = leafColors[Math.floor(Math.random() * leafColors.length)];
      const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.6 });

      const foliage1 = new THREE.Mesh(treeFoliageGeo1, leafMat);
      foliage1.position.y = 2.8;
      foliage1.castShadow = true;
      treeGroup.add(foliage1);

      const foliage2 = new THREE.Mesh(treeFoliageGeo2, leafMat);
      foliage2.position.y = 3.8;
      foliage2.castShadow = true;
      treeGroup.add(foliage2);

      scene.add(treeGroup);
    }

    // Plant trees along North-South Avenues & Sector Dividers
    const treeXLocations = [-78, -72, -28, -22, 22, 28, 72, 78];
    treeXLocations.forEach((xPos) => {
      for (let zPos = -32; zPos <= 42; zPos += 12) {
        createTree(xPos + (Math.random() - 0.5) * 1.5, zPos + (Math.random() - 0.5) * 2);
      }
    });

    // ==========================================
    // --- 3. STREET LIGHT POLES BESIDE ROADS ---
    // ==========================================
    const polePoleGeo = new THREE.CylinderGeometry(0.12, 0.16, 5.5, 8);
    const polePoleMat = new THREE.MeshStandardMaterial({ color: "#64748b", metalness: 0.8, roughness: 0.2 });

    const poleArmGeo = new THREE.BoxGeometry(1.4, 0.12, 0.12);
    const lampHeadGeo = new THREE.BoxGeometry(0.6, 0.2, 0.4);
    const lampLensMat = new THREE.MeshBasicMaterial({ color: "#fef08a" }); // Glowing light lens

    function createLightPole(x, z, armDirX = 1) {
      const poleGroup = new THREE.Group();
      poleGroup.position.set(x, 0, z);

      // Vertical pole stem
      const stem = new THREE.Mesh(polePoleGeo, polePoleMat);
      stem.position.y = 2.75;
      stem.castShadow = true;
      poleGroup.add(stem);

      // Top curved arm
      const arm = new THREE.Mesh(poleArmGeo, polePoleMat);
      arm.position.set((armDirX * 0.7) / 2, 5.4, 0);
      poleGroup.add(arm);

      // Lamp Head Box
      const lampHead = new THREE.Mesh(lampHeadGeo, polePoleMat);
      lampHead.position.set(armDirX * 0.8, 5.3, 0);
      poleGroup.add(lampHead);

      // Glowing lens
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), lampLensMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(armDirX * 0.8, 5.18, 0);
      poleGroup.add(lens);

      // Light beam casting onto road surface
      const streetLight = new THREE.PointLight("#fef08a", 1.2, 18);
      streetLight.position.set(armDirX * 0.8, 5.0, 0);
      poleGroup.add(streetLight);

      scene.add(poleGroup);
    }

    // Place light poles along North-South avenues
    const polePositions = [
      { x: -22, armDir: -1 },
      { x: -28, armDir: 1 },
      { x: 22, armDir: -1 },
      { x: 28, armDir: 1 },
    ];
    polePositions.forEach(({ x, armDir }) => {
      for (let z = -20; z <= 35; z += 18) {
        createLightPole(x, z, armDir);
      }
    });

    // ==========================================
    // --- 4. ANIMATED CARS WITH ON HEADLIGHTS ---
    // ==========================================
    const carMeshList = [];
    const carColors = ["#2563eb", "#ef4444", "#10b981", "#f59e0b", "#0284c7", "#475569"];

    function createCar(colorHex) {
      const carGroup = new THREE.Group();

      // Chassis body
      const bodyGeo = new THREE.BoxGeometry(2.2, 1.0, 4.2);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        metalness: 0.6,
        roughness: 0.2,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.7;
      body.castShadow = true;
      carGroup.add(body);

      // Cabin / Roof
      const cabinGeo = new THREE.BoxGeometry(1.8, 0.8, 2.2);
      const cabinMat = new THREE.MeshStandardMaterial({
        color: "#0f172a",
        roughness: 0.1,
        metalness: 0.8,
      });
      const cabin = new THREE.Mesh(cabinGeo, cabinMat);
      cabin.position.set(0, 1.5, -0.2);
      cabin.castShadow = true;
      carGroup.add(cabin);

      // 4 Wheels
      const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12);
      const wheelMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.9 });

      const wheelOffsets = [
        { x: -1.15, z: 1.3 },
        { x: 1.15, z: 1.3 },
        { x: -1.15, z: -1.3 },
        { x: 1.15, z: -1.3 },
      ];
      wheelOffsets.forEach((pos) => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(pos.x, 0.4, pos.z);
        carGroup.add(wheel);
      });

      // --- DUAL ON HEADLIGHTS & SPOTLIGHT BEAMS ---
      const headlightMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
      const hlLeft = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), headlightMat);
      hlLeft.position.set(-0.7, 0.7, 2.11);
      carGroup.add(hlLeft);

      const hlRight = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), headlightMat);
      hlRight.position.set(0.7, 0.7, 2.11);
      carGroup.add(hlRight);

      // Headlight SpotLight Beams shining forward onto road
      const spotLightLeft = new THREE.SpotLight("#ffffff", 4, 22, Math.PI / 5, 0.4, 1);
      spotLightLeft.position.set(-0.7, 0.8, 2.1);
      const targetLeft = new THREE.Object3D();
      targetLeft.position.set(-0.7, 0.1, 15);
      carGroup.add(targetLeft);
      spotLightLeft.target = targetLeft;
      carGroup.add(spotLightLeft);

      const spotLightRight = new THREE.SpotLight("#ffffff", 4, 22, Math.PI / 5, 0.4, 1);
      spotLightRight.position.set(0.7, 0.8, 2.1);
      const targetRight = new THREE.Object3D();
      targetRight.position.set(0.7, 0.1, 15);
      carGroup.add(targetRight);
      spotLightRight.target = targetRight;
      carGroup.add(spotLightRight);

      // Tail lights
      const tailLightMat = new THREE.MeshBasicMaterial({ color: "#ef4444" });
      const tlLeft = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), tailLightMat);
      tlLeft.position.set(-0.7, 0.7, -2.11);
      carGroup.add(tlLeft);

      const tlRight = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), tailLightMat);
      tlRight.position.set(0.7, 0.7, -2.11);
      carGroup.add(tlRight);

      scene.add(carGroup);
      return carGroup;
    }

    // Car 1: Eastbound on Main Avenue (Z = -23.5)
    const car1 = createCar(carColors[0]);
    carMeshList.push({ mesh: car1, type: "EW", zFixed: -23.5, startX: -110, endX: 110, speed: 18, dir: 1 });

    // Car 2: Westbound on Main Avenue (Z = -20.5)
    const car2 = createCar(carColors[1]);
    carMeshList.push({ mesh: car2, type: "EW", zFixed: -20.5, startX: 110, endX: -110, speed: 22, dir: -1 });

    // Car 3: Eastbound on South Avenue (Z = 36.5)
    const car3 = createCar(carColors[2]);
    carMeshList.push({ mesh: car3, type: "EW", zFixed: 36.5, startX: -110, endX: 110, speed: 20, dir: 1 });

    // Car 4: Southbound on Avenue 1 (X = -23.5)
    const car4 = createCar(carColors[3]);
    carMeshList.push({ mesh: car4, type: "NS", xFixed: -23.5, startZ: -35, endZ: 45, speed: 16, dir: 1 });

    // Car 5: Northbound on Avenue 2 (X = 26.5)
    const car5 = createCar(carColors[4]);
    carMeshList.push({ mesh: car5, type: "NS", xFixed: 26.5, startZ: 45, endZ: -35, speed: 19, dir: -1 });

    // ==========================================
    // --- 5. HOUSES & TRANSFORMERS OBJECTS ---
    // ==========================================
    const houseBodyGeo = new THREE.BoxGeometry(3.2, 2.4, 3.2);
    const roofGeo = new THREE.ConeGeometry(2.6, 1.6, 4);
    const windowGeo = new THREE.PlaneGeometry(0.7, 0.7);
    const beaconGeo = new THREE.SphereGeometry(0.3, 12, 12);

    const houseMap = {};
    const tfMap = {};

    AREAS.forEach((areaKey) => {
      const config = AREA_CONFIG[areaKey];
      const xBase = config.xOffset;

      // Transformer Model
      const tfGroup = new THREE.Group();
      tfGroup.position.set(xBase, 0, -28);

      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(10, 0.6, 8),
        new THREE.MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.6 })
      );
      pad.position.y = 0.3;
      pad.castShadow = true;
      pad.receiveShadow = true;
      tfGroup.add(pad);

      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(2.5, 2.5, 4.5, 16),
        new THREE.MeshStandardMaterial({
          color: config.color,
          metalness: 0.5,
          roughness: 0.2,
        })
      );
      tank.position.y = 2.85;
      tank.castShadow = true;
      tfGroup.add(tank);

      for (let f = -2; f <= 2; f += 1) {
        const fin = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 3.5, 4.2),
          new THREE.MeshStandardMaterial({ color: "#94a3b8", metalness: 0.4 })
        );
        fin.position.set(f * 0.9, 2.85, 0);
        tfGroup.add(fin);
      }

      for (let b = -1.2; b <= 1.2; b += 1.2) {
        const bushing = new THREE.Mesh(
          new THREE.CylinderGeometry(0.25, 0.35, 1.6, 8),
          new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.1 })
        );
        bushing.position.set(b, 5.8, 0);
        tfGroup.add(bushing);
      }

      const tfLight = new THREE.PointLight(config.color, 1.8, 25);
      tfLight.position.set(0, 6.5, 0);
      tfGroup.add(tfLight);

      scene.add(tfGroup);

      tfMap[areaKey] = {
        mesh: tfGroup,
        light: tfLight,
        pos: new THREE.Vector3(xBase, 3, -28),
      };

      // 50 Houses per Sector
      for (let i = 1; i <= 50; i++) {
        const consumerId = `${config.prefix}${100 + i}`;
        const col = (i - 1) % 5;
        const row = Math.floor((i - 1) / 5);

        const xPos = xBase + (col - 2) * 7.2;
        const zPos = -16 + row * 5.6;

        const houseGroup = new THREE.Group();
        houseGroup.position.set(xPos, 0, zPos);

        const bodyMat = new THREE.MeshStandardMaterial({
          color: "#ffffff",
          roughness: 0.3,
          metalness: 0.1,
        });
        const body = new THREE.Mesh(houseBodyGeo, bodyMat);
        body.position.y = 1.2;
        body.castShadow = true;
        body.receiveShadow = true;
        houseGroup.add(body);

        const roofMat = new THREE.MeshStandardMaterial({
          color: "#475569",
          roughness: 0.4,
        });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = 3.2;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        houseGroup.add(roof);

        const windowMat = new THREE.MeshBasicMaterial({ color: "#f59e0b" });
        const winLeft = new THREE.Mesh(windowGeo, windowMat);
        winLeft.position.set(-0.8, 1.3, 1.61);
        houseGroup.add(winLeft);

        const winRight = new THREE.Mesh(windowGeo, windowMat);
        winRight.position.set(0.8, 1.3, 1.61);
        houseGroup.add(winRight);

        const beaconMat = new THREE.MeshBasicMaterial({ color: "#10b981" });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.set(0, 4.1, 0);
        houseGroup.add(beacon);

        houseGroup.userData = { consumerId, areaKey };
        body.userData = { consumerId, areaKey };
        roof.userData = { consumerId, areaKey };

        scene.add(houseGroup);

        houseMap[consumerId] = {
          group: houseGroup,
          bodyMat,
          roofMat,
          windowMat,
          beaconMat,
          beacon,
          pos: new THREE.Vector3(xPos, 2, zPos),
        };

        if (row === 0) {
          const points = [
            new THREE.Vector3(xBase, 5.5, -28),
            new THREE.Vector3(xPos, 4.5, -20),
            new THREE.Vector3(xPos, 4.1, zPos),
          ];
          const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
          const lineMat = new THREE.LineBasicMaterial({
            color: config.color,
            transparent: true,
            opacity: 0.45,
          });
          const line = new THREE.Line(lineGeo, lineMat);
          scene.add(line);
        }
      }
    });

    houseMeshMapRef.current = houseMap;
    transformerMeshMapRef.current = tfMap;

    // Raycaster
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleCanvasClick = (event) => {
      const rect = canvasRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj && !obj.userData?.consumerId && !obj.userData?.areaKey && obj.parent) {
          obj = obj.parent;
        }

        if (obj && obj.userData?.consumerId) {
          onSelectHouse(obj.userData.consumerId);
          if (obj.userData.areaKey) onSelectArea(obj.userData.areaKey);
        }
      }
    };

    const canvasEl = canvasRef.current;
    canvasEl.addEventListener("click", handleCanvasClick);

    // Animation Loop with Car Movement
    let animId;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      controls.update();

      // --- ANIMATE MOVING CARS WITH HEADLIGHTS ---
      carMeshList.forEach((car) => {
        if (car.type === "EW") {
          // Move along X axis
          let curX = car.mesh.position.x || car.startX;
          curX += car.speed * car.dir * delta;

          if (car.dir === 1 && curX > car.endX) curX = car.startX;
          if (car.dir === -1 && curX < car.endX) curX = car.startX;

          car.mesh.position.set(curX, 0, car.zFixed);
          car.mesh.rotation.y = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
        } else if (car.type === "NS") {
          // Move along Z axis
          let curZ = car.mesh.position.z || car.startZ;
          curZ += car.speed * car.dir * delta;

          if (car.dir === 1 && curZ > car.endZ) curZ = car.startZ;
          if (car.dir === -1 && curZ < car.endZ) curZ = car.startZ;

          car.mesh.position.set(car.xFixed, 0, curZ);
          car.mesh.rotation.y = car.dir === 1 ? 0 : Math.PI;
        }
      });

      // Pulse transformer status lights
      AREAS.forEach((areaKey) => {
        const tf = tfMap[areaKey];
        if (tf && tf.light) {
          tf.light.intensity = 1.4 + Math.sin(elapsedTime * 3) * 0.4;
        }
      });

      renderer.render(scene, camera);
      updateOverlayLabels(camera, width, height);
    };

    animate();

    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      canvasEl.removeEventListener("click", handleCanvasClick);
      renderer.dispose();
    };
  }, []);

  // Update HTML overlay label positions
  const updateOverlayLabels = (camera, width, height) => {
    const tempVec = new THREE.Vector3();

    const newTfLabels = AREAS.map((areaKey) => {
      const config = AREA_CONFIG[areaKey];
      tempVec.set(config.xOffset, 7.5, -28);
      tempVec.project(camera);

      const x = ((tempVec.x + 1) * width) / 2;
      const y = ((-tempVec.y + 1) * height) / 2;
      const visible = tempVec.z < 1.0;

      return {
        areaKey,
        name: config.transformerId,
        x,
        y,
        visible,
      };
    });
    setTfLabels(newTfLabels);

    const houseMap = houseMeshMapRef.current;
    const newLabels = [];
    const searchQ = (searchFilter || "").toLowerCase().trim();

    allHousesList.current.forEach(({ consumerId, areaKey }) => {
      const item = houseMap[consumerId];
      if (!item) return;

      tempVec.copy(item.pos);
      tempVec.y = 4.6;
      tempVec.project(camera);

      const x = ((tempVec.x + 1) * width) / 2;
      const y = ((-tempVec.y + 1) * height) / 2;
      const visible = tempVec.z < 1.0;
      const isMatch = searchQ ? consumerId.toLowerCase().includes(searchQ) : false;

      newLabels.push({
        consumerId,
        areaKey,
        x,
        y,
        visible,
        isMatch,
      });
    });

    setLabels(newLabels);
  };

  // Update mesh visuals on live simulation data changes
  useEffect(() => {
    const houseMap = houseMeshMapRef.current;
    if (!houseMap || Object.keys(houseMap).length === 0) return;

    AREAS.forEach((areaKey) => {
      const houses = latestReadings[areaKey] || {};
      for (const consumerId in houses) {
        const houseMesh = houseMap[consumerId];
        if (!houseMesh) continue;

        const data = houses[consumerId];
        const isCut = !!cutHouses[consumerId] || data.meterStatus === "POWER CUT";
        const reductionPercent = reducedHouses[consumerId] || data.reductionPercent || 0;
        const powerW = isCut ? 0 : data.powerW || 0;
        const isSelected = activeHouse === consumerId;

        if (isCut) {
          houseMesh.bodyMat.color.set("#e2e8f0");
          houseMesh.roofMat.color.set("#991b1b");
          houseMesh.windowMat.color.set("#cbd5e1");
          houseMesh.beaconMat.color.set("#ef4444");
        } else if (reductionPercent > 0) {
          houseMesh.bodyMat.color.set("#fef3c7");
          houseMesh.roofMat.color.set("#b45309");
          houseMesh.windowMat.color.set("#f59e0b");
          houseMesh.beaconMat.color.set("#f59e0b");
        } else if (powerW > 2800) {
          houseMesh.bodyMat.color.set("#ffedd5");
          houseMesh.roofMat.color.set("#c2410c");
          houseMesh.windowMat.color.set("#ea580c");
          houseMesh.beaconMat.color.set("#ea580c");
        } else {
          houseMesh.bodyMat.color.set(isSelected ? "#e0f2fe" : "#ffffff");
          houseMesh.roofMat.color.set(isSelected ? "#0284c7" : "#475569");
          houseMesh.windowMat.color.set("#f59e0b");
          houseMesh.beaconMat.color.set("#10b981");
        }

        if (isSelected) {
          houseMesh.group.scale.set(1.15, 1.15, 1.15);
        } else {
          houseMesh.group.scale.set(1, 1, 1);
        }
      }
    });
  }, [latestReadings, activeHouse, cutHouses, reducedHouses]);

  const setCameraView = (preset) => {
    setViewPreset(preset);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    if (preset === "overview") {
      camera.position.set(0, 60, 95);
      controls.target.set(0, 0, 0);
    } else if (preset === "AREA-1") {
      camera.position.set(-50, 40, 55);
      controls.target.set(-50, 0, 0);
      onSelectArea("AREA-1");
    } else if (preset === "AREA-2") {
      camera.position.set(0, 40, 55);
      controls.target.set(0, 0, 0);
      onSelectArea("AREA-2");
    } else if (preset === "AREA-3") {
      camera.position.set(50, 40, 55);
      controls.target.set(50, 0, 0);
      onSelectArea("AREA-3");
    } else if (preset === "topdown") {
      camera.position.set(0, 140, 1);
      controls.target.set(0, 0, 0);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[540px] bg-slate-100 rounded-3xl overflow-hidden border border-gray-200 shadow-xl shadow-gray-200/60"
    >
      {/* 3D WebGL Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

      {/* TOP OVERLAY CONTROL BAR */}
      <div className="absolute top-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        <div className="flex items-center space-x-2 bg-white/80 border border-gray-200 px-4 py-2 rounded-2xl backdrop-blur-md shadow-md shadow-gray-200/50 pointer-events-auto">
          <span className="text-xs font-semibold text-gray-900 tracking-tight">
            3D Smart City Grid  
          </span>
        </div>

        {/* Camera View Preset Pills */}
        <div className="flex items-center space-x-1 bg-white/80 border border-gray-200 p-1.5 rounded-2xl backdrop-blur-md shadow-md shadow-gray-200/50 pointer-events-auto">
          <button
            onClick={() => setCameraView("overview")}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
              viewPreset === "overview"
                ? "bg-gray-900 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/80"
            }`}
          >
            All 3 Sectors
          </button>
          <button
            onClick={() => setCameraView("AREA-1")}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
              viewPreset === "AREA-1"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/80"
            }`}
          >
            Sector Alpha
          </button>
          <button
            onClick={() => setCameraView("AREA-2")}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
              viewPreset === "AREA-2"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/80"
            }`}
          >
            Sector Beta
          </button>
          <button
            onClick={() => setCameraView("AREA-3")}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
              viewPreset === "AREA-3"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/80"
            }`}
          >
            Sector Gamma
          </button>
          <button
            onClick={() => setCameraView("topdown")}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
              viewPreset === "topdown"
                ? "bg-amber-600 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/80"
            }`}
          >
            Top Down
          </button>
        </div>
      </div>

      {/* 2D FLOATING TEXT LABELS OVERLAY FOR 3 TRANSFORMERS */}
      {tfLabels.map((tf) => {
        if (!tf.visible) return null;
        const config = AREA_CONFIG[tf.areaKey];
        const isSelected = activeArea === tf.areaKey;
        const trData = latestTransformers[tf.areaKey] || {};

        return (
          <div
            key={tf.areaKey}
            onClick={() => onSelectArea(tf.areaKey)}
            style={{
              position: "absolute",
              left: `${tf.x}px`,
              top: `${tf.y}px`,
              transform: "translate(-50%, -100%)",
            }}
            className={`cursor-pointer pointer-events-auto transition-transform hover:scale-105 ${
              isSelected ? "z-30" : "z-20"
            }`}
          >
            <div
              className={`px-3.5 py-1.5 rounded-2xl border backdrop-blur-md shadow-lg font-sans ${
                isSelected
                  ? "bg-white/95 border-blue-500 ring-2 ring-blue-500/30 text-gray-900"
                  : "bg-white/90 border-gray-200 text-gray-800"
              }`}
            >
              <div
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: config.color }}
              >
                ⚡ {config.transformerId}
              </div>
              <div className="text-[10px] font-semibold text-gray-600">
                {((trData.powerW || 0) / 1000).toFixed(2)} kW • {trData.voltageV || 230}V
              </div>
            </div>
          </div>
        );
      })}

      {/* 2D FLOATING TEXT LABELS OVERLAY FOR ALL 150 HOUSES */}
      {labels.map((lbl) => {
        if (!lbl.visible) return null;
        const isSelected = activeHouse === lbl.consumerId;
        const isCut = !!cutHouses[lbl.consumerId];
        const reduction = reducedHouses[lbl.consumerId] || 0;
        const isMatch = lbl.isMatch;

        const showLabelDetails = isSelected || isMatch || isCut || reduction > 0 || viewPreset !== "overview";

        return (
          <div
            key={lbl.consumerId}
            onClick={() => {
              onSelectHouse(lbl.consumerId);
              onSelectArea(lbl.areaKey);
            }}
            style={{
              position: "absolute",
              left: `${lbl.x}px`,
              top: `${lbl.y}px`,
              transform: "translate(-50%, -100%)",
            }}
            className={`cursor-pointer pointer-events-auto transition-transform ${
              isSelected ? "z-30 scale-110" : "z-10"
            }`}
          >
            {showLabelDetails ? (
              <div
                className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-tight shadow-sm backdrop-blur-md whitespace-nowrap border ${
                  isCut
                    ? "bg-rose-50 text-rose-700 border-rose-300 font-extrabold animate-pulse"
                    : reduction > 0
                    ? "bg-amber-50 text-amber-800 border-amber-300"
                    : isSelected
                    ? "bg-blue-600 text-white border-blue-500 font-extrabold shadow-md shadow-blue-500/20"
                    : isMatch
                    ? "bg-yellow-400 text-gray-900 border-yellow-300 ring-2 ring-yellow-400 font-extrabold"
                    : "bg-white/90 text-gray-800 border-gray-200"
                }`}
              >
                {lbl.consumerId}
              </div>
            ) : (
              <div
                className={`w-2 h-2 rounded-full border ${
                  isCut
                    ? "bg-rose-500 border-rose-300"
                    : reduction > 0
                    ? "bg-amber-500 border-amber-300"
                    : "bg-gray-400 border-gray-300"
                }`}
              />
            )}
          </div>
        );
      })}

       
    </div>
  );
}
