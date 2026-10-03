'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────
const HPT = 50; // Houses Per Transformer
const TOTAL = 150;
const TX_COLORS  = [0x00aaff, 0x00ffaa, 0xaa00ff];
const TX_NAMES   = ['Transformer 1', 'Transformer 2', 'Transformer 3'];
const TX_POS     = [{ x: -55, z: 0 }, { x: 0, z: 0 }, { x: 55, z: 0 }];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const rand  = (a, b) => a + Math.random() * (b - a);
const randI = (a, b) => Math.floor(rand(a, b + 1));

function housePositions(center) {
  const pos = [];
  const rings = [{ r: 9, n: 8 }, { r: 16, n: 14 }, { r: 23, n: 18 }, { r: 30, n: 10 }];
  let placed = 0;
  for (const ring of rings) {
    const take = Math.min(ring.n, HPT - placed);
    for (let i = 0; i < take; i++) {
      const a = (i / ring.n) * Math.PI * 2 + placed * 0.13;
      pos.push({ x: center.x + Math.cos(a) * ring.r, z: center.z + Math.sin(a) * ring.r });
    }
    placed += take;
    if (placed >= HPT) break;
  }
  while (pos.length < HPT) {
    const a = Math.random() * Math.PI * 2, r = rand(8, 32);
    pos.push({ x: center.x + Math.cos(a) * r, z: center.z + Math.sin(a) * r });
  }
  return pos;
}

function newMeter(hi, ti) {
  const v = rand(218, 242), c = rand(1.5, 12);
  return { hi, ti, voltage: v, current: c, power: +(v * c / 1000).toFixed(2),
    energy: +rand(0, 9999).toFixed(1), status: 'Normal', comm: 'Online',
    theft: false, noisy: false, theftExp: 0, theftMet: 0 };
}

// ─── CDN Loader (version-keyed, safe for React Strict Mode) ──────────────────
const PKEY = '__gg_three_r128__';
function loadTHREE() {
  if (!window[PKEY]) {
    window[PKEY] = (async () => {
      const loadScript = (src) => new Promise((ok, fail) => {
        if (document.querySelector(`script[data-gg="${src}"]`)) { ok(); return; }
        const s = document.createElement('script');
        s.setAttribute('data-gg', src);
        s.src = src;
        s.onload  = ok;
        s.onerror = () => fail(new Error(`Failed: ${src}`));
        document.head.appendChild(s);
      });
      await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js');
      await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');
    })();
  }
  return window[PKEY];
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AnimationPage() {
  const mountRef  = useRef(null);
  const threeRef  = useRef(null);
  const animRef   = useRef(null);
  const simRef    = useRef(null);

  const [loading,      setLoading]      = useState(true);
  const [stats,        setStats]        = useState({ online:150, comm:0, noise:0, theft:0, load:0 });
  const [selHouse,     setSelHouse]     = useState(null);
  const [selTx,        setSelTx]        = useState(null);
  const [running,      setRunning]      = useState(true);
  const [speed,        setSpeed]        = useState(1);
  const [noiseOn,      setNoiseOn]      = useState(true);
  const [commOn,       setCommOn]       = useState(true);
  const [theftOn,      setTheftOn]      = useState(true);
  const [focusArea,    setFocusArea]    = useState(null);

  // mutable refs for animation loop
  const rRef   = useRef(true);
  const spRef  = useRef(1);
  const noRef  = useRef(true);
  const coRef  = useRef(true);
  const thRef  = useRef(true);
  const foRef  = useRef(null);

  useEffect(() => { rRef.current  = running; },  [running]);
  useEffect(() => { spRef.current = speed; },    [speed]);
  useEffect(() => { noRef.current = noiseOn; },  [noiseOn]);
  useEffect(() => { coRef.current = commOn; },   [commOn]);
  useEffect(() => { thRef.current = theftOn; },  [theftOn]);
  useEffect(() => { foRef.current = focusArea; }, [focusArea]);

  // ── Three.js init ──────────────────────────────────────────────────────────
  useEffect(() => {
    let dead = false;
    (async () => {
      await loadTHREE();
      if (dead || !mountRef.current) return;

      const THREE = window.THREE;
      const { OrbitControls } = THREE;

      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x020a12);
      scene.fog = new THREE.FogExp2(0x020a12, 0.006);

      const W = mountRef.current.clientWidth  || 900;
      const H = mountRef.current.clientHeight || 600;
      const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 2000);
      camera.position.set(0, 80, 120);
      camera.lookAt(0, 0, 0);

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(W, H);
      renderer.shadowMap.enabled = true;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      mountRef.current.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true; controls.dampingFactor = 0.08;
      controls.minDistance = 15; controls.maxDistance = 350;
      controls.maxPolarAngle = Math.PI / 2 - 0.03;

      // ── Lights ────────────────────────────────────────────────────────────
      scene.add(new THREE.AmbientLight(0x102030, 1.0));
      const sun = new THREE.DirectionalLight(0xffe8c0, 0.6);
      sun.position.set(80, 150, 60); sun.castShadow = true; scene.add(sun);
      TX_POS.forEach((p, i) => {
        const pl = new THREE.PointLight(TX_COLORS[i], 3, 100, 2);
        pl.position.set(p.x, 22, p.z); scene.add(pl);
      });

      // ── Ground ────────────────────────────────────────────────────────────
      scene.add(new THREE.GridHelper(340, 68, 0x0a1e30, 0x07141f));
      const gnd = new THREE.Mesh(
        new THREE.PlaneGeometry(340, 340),
        new THREE.MeshStandardMaterial({ color: 0x030e1a, roughness: 1 })
      );
      gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true; scene.add(gnd);

      // Area glow circles
      TX_POS.forEach((p, i) => {
        const m = new THREE.Mesh(
          new THREE.CircleGeometry(38, 64),
          new THREE.MeshBasicMaterial({ color: TX_COLORS[i], transparent: true, opacity: 0.05, side: THREE.DoubleSide })
        );
        m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.02, p.z); scene.add(m);
      });

      // Stars
      const sArr = new Float32Array(3000 * 3);
      for (let i = 0; i < sArr.length; i++) sArr[i] = (Math.random() - 0.5) * 1000;
      const sGeo = new THREE.BufferGeometry();
      sGeo.setAttribute('position', new THREE.BufferAttribute(sArr, 3));
      scene.add(new THREE.Points(sGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.4 })));

      // ── Helper: make canvas label sprite ─────────────────────────────────
      function makeLabel(text, color = '#ffffff', size = 26) {
        const cv = Object.assign(document.createElement('canvas'), { width: 256, height: 64 });
        const cx = cv.getContext('2d');
        cx.clearRect(0, 0, 256, 64);
        cx.fillStyle = color; cx.font = `bold ${size}px Arial`; cx.textAlign = 'center';
        cx.fillText(text, 128, 42);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true }));
        return sp;
      }

      // ── INDIAN TRANSFORMER POLE ───────────────────────────────────────────
      // Looks like a street utility pole with hanging drum transformer
      const txObjects = TX_POS.map((tp, ti) => {
        const g = new THREE.Group();
        g.position.set(tp.x, 0, tp.z);
        scene.add(g);

        const concreteGray = new THREE.MeshStandardMaterial({ color: 0x9a9a8a, roughness: 0.85, metalness: 0.1 });
        const metalDark    = new THREE.MeshStandardMaterial({ color: 0x3a4a3a, roughness: 0.4, metalness: 0.8 });
        const txGreen      = new THREE.MeshStandardMaterial({
          color: 0x2d5a2d, roughness: 0.4, metalness: 0.6,
          emissive: new THREE.Color(TX_COLORS[ti]), emissiveIntensity: 0.2,
        });

        // Main pole (tapered concrete)
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.22, 12, 10), concreteGray);
        pole.position.y = 6; pole.castShadow = true;
        pole.userData = { type: 'transformer', transformerIndex: ti };
        g.add(pole);

        // Crossarm 1 (main)
        const ca1 = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.14, 0.22), metalDark);
        ca1.position.y = 12.2; g.add(ca1);

        // Crossarm 2 (secondary, slightly lower)
        const ca2 = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.12, 0.18), metalDark);
        ca2.position.set(0, 11.2, 0); g.add(ca2);

        // Insulators on crossarms (3 on main, 2 on secondary)
        const insGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.45, 8);
        const insMat = new THREE.MeshStandardMaterial({ color: 0x884422, roughness: 0.7 }); // brown ceramic
        [-2.2, 0, 2.2].forEach(x => {
          const ins = new THREE.Mesh(insGeo, insMat);
          ins.position.set(x, 11.97, 0); g.add(ins);
          // Disc rings on insulator
          for (let d = 0; d < 3; d++) {
            const disc = new THREE.Mesh(
              new THREE.TorusGeometry(0.1, 0.03, 6, 12),
              new THREE.MeshStandardMaterial({ color: 0x773311 })
            );
            disc.position.set(x, 11.85 - d * 0.12, 0); disc.rotation.x = Math.PI / 2; g.add(disc);
          }
        });

        // Transformer drum hanging from crossarm
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.6, 14), txGreen);
        drum.position.y = 10.4; drum.castShadow = true; g.add(drum);

        // Drum end caps
        const capMat = new THREE.MeshStandardMaterial({ color: 0x1a3a1a, metalness: 0.8 });
        [10.4 + 0.8, 10.4 - 0.8].forEach(y => {
          const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 14), capMat);
          cap.position.y = y; g.add(cap);
        });

        // Drum cooling fins
        for (let f = 0; f < 4; f++) {
          const fin = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 1.2, 0.2),
            new THREE.MeshStandardMaterial({ color: 0x1e3d1e, metalness: 0.7 })
          );
          const a = (f / 4) * Math.PI * 2;
          fin.position.set(Math.cos(a) * 0.58, 10.4, Math.sin(a) * 0.58);
          fin.rotation.y = a; g.add(fin);
        }

        // LT (low-tension) box at bottom of pole
        const ltBox = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.35), metalDark);
        ltBox.position.set(0, 3.5, 0.3); g.add(ltBox);

        // Status indicator LED atop pole
        const indMat = new THREE.MeshStandardMaterial({
          color: 0x00ff88, emissive: new THREE.Color(0x00ff88), emissiveIntensity: 2,
        });
        const ind = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), indMat);
        ind.position.y = 12.8; g.add(ind);

        // Wire connections from crossarm tips (3 vertical wires going down from insulators)
        [-2.2, 0, 2.2].forEach(x => {
          const wireGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(x, 11.75, 0), new THREE.Vector3(x, 9.5, 0),
          ]);
          g.add(new THREE.Line(wireGeo, new THREE.LineBasicMaterial({ color: 0x666666 })));
        });

        // Label
        const lbl = makeLabel(TX_NAMES[ti], '#dddddd', 24);
        lbl.scale.set(8, 2, 1); lbl.position.y = 14.5; g.add(lbl);

        return { group: g, pole, indMat };
      });

      // ── INDIAN HOUSES ─────────────────────────────────────────────────────
      // Flat-roofed single/double storey Indian style with parapet & water tank
      const HOUSE_PALETTE = [
        [0xf0e8d0, 0xd4c8a8],  // cream / warm yellow - Area 1
        [0xf5d5b8, 0xe0b890],  // terracotta / orange - Area 2
        [0xe8f0d8, 0xc8d8b0],  // pale green / lime   - Area 3
      ];

      // shared geometries
      const bodyGeo     = new THREE.BoxGeometry(2.4, 3.0, 2.4);
      const floorGeo    = new THREE.BoxGeometry(2.4, 0.15, 2.4); // floor slab
      const parapetGeo  = new THREE.BoxGeometry(2.85, 0.4, 2.85);
      const parapetHole = new THREE.BoxGeometry(2.4, 0.41, 2.4);
      const tankGeo     = new THREE.CylinderGeometry(0.26, 0.26, 0.55, 10);
      const tankCapGeo  = new THREE.CylinderGeometry(0.29, 0.29, 0.07, 10);
      const doorGeo     = new THREE.BoxGeometry(0.55, 0.95, 0.12);
      const windowGeo   = new THREE.BoxGeometry(0.5, 0.42, 0.1);
      const meterGeo    = new THREE.BoxGeometry(0.42, 0.55, 0.18);

      const doorMat   = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 });
      const windowMat = new THREE.MeshStandardMaterial({ color: 0x88ccee, transparent: true, opacity: 0.6, roughness: 0.1 });
      const tankMat   = new THREE.MeshStandardMaterial({ color: 0x888880, roughness: 0.8 });

      const houseData = []; // { houseMat, meterMat, elMat, commMat, bypassMat, glowMat, pGeo, pMat, offsets, hpos }

      for (let hi = 0; hi < TOTAL; hi++) {
        const ti   = Math.floor(hi / HPT);
        const tp   = TX_POS[ti];
        const hpos = housePositions(tp)[hi % HPT];

        const hg = new THREE.Group();
        hg.position.set(hpos.x, 0, hpos.z);
        scene.add(hg);

        // Vary house slightly
        const scaleY = 1 + (hi % 3) * 0.12;  // single/double storey variation
        const pal = HOUSE_PALETTE[ti];
        const [wallCol, parapetCol] = pal;

        // Building body
        const houseMat = new THREE.MeshStandardMaterial({
          color: wallCol, roughness: 0.75, metalness: 0.0,
          emissive: new THREE.Color(TX_COLORS[ti]), emissiveIntensity: 0.04,
        });
        const body = new THREE.Mesh(bodyGeo, houseMat);
        body.position.y = 1.5 * scaleY;
        body.scale.y = scaleY;
        body.castShadow = true; body.receiveShadow = true;
        body.userData = { type: 'house', houseIndex: hi, transformerIndex: ti };
        hg.add(body);

        // Roof slab
        const slabMat = new THREE.MeshStandardMaterial({ color: parapetCol, roughness: 0.8 });
        const slab = new THREE.Mesh(floorGeo, slabMat);
        slab.position.y = 3.07 * scaleY; hg.add(slab);

        // Parapet wall (thin raised wall around roof edge)
        const parapet = new THREE.Mesh(parapetGeo, new THREE.MeshStandardMaterial({ color: parapetCol, roughness: 0.8 }));
        parapet.position.y = 3.27 * scaleY; hg.add(parapet);

        // Inner cutout illusion — just a darker face on top
        const parapetTop = new THREE.Mesh(parapetHole, new THREE.MeshStandardMaterial({ color: 0x1a2020, roughness: 1 }));
        parapetTop.position.y = 3.28 * scaleY; hg.add(parapetTop);

        // Water tank (common on Indian rooftops)
        const tank = new THREE.Mesh(tankGeo, tankMat);
        tank.position.set(-0.6, 3.65 * scaleY, -0.5); hg.add(tank);
        const tcap = new THREE.Mesh(tankCapGeo, new THREE.MeshStandardMaterial({ color: 0x555550, roughness: 0.8 }));
        tcap.position.set(-0.6, 3.96 * scaleY, -0.5); hg.add(tcap);

        // Door
        const door = new THREE.Mesh(doorGeo, doorMat);
        door.position.set(0, 0.55 * scaleY, 1.2); hg.add(door);

        // Windows (2 on front)
        [-0.7, 0.7].forEach(x => {
          const win = new THREE.Mesh(windowGeo, windowMat);
          win.position.set(x, 1.3 * scaleY, 1.21); hg.add(win);
        });

        // Smart meter box on side wall
        const meterMat = new THREE.MeshStandardMaterial({
          color: 0x223322, roughness: 0.5, metalness: 0.4,
          emissive: new THREE.Color(0x00ff44), emissiveIntensity: 0.7,
        });
        const meter = new THREE.Mesh(meterGeo, meterMat);
        meter.position.set(1.21, 1.0 * scaleY, 0.3);
        meter.userData = { type: 'meter', houseIndex: hi, transformerIndex: ti };
        hg.add(meter);

        // Meter LED dot
        const ledGeo = new THREE.SphereGeometry(0.07, 6, 6);
        const ledMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: new THREE.Color(0x00ff00), emissiveIntensity: 2 });
        const led = new THREE.Mesh(ledGeo, ledMat);
        led.position.set(1.31, 1.1 * scaleY, 0.3); hg.add(led);

        // ── Electric lines ──────────────────────────────────────────────────
        const hTop = 3.2 * scaleY;

        const mkLine = (y0, y1, col, op) => {
          const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(tp.x, y0, tp.z),
            new THREE.Vector3(hpos.x, hTop + y1, hpos.z),
          ]);
          const mat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: op });
          scene.add(new THREE.Line(geo, mat));
          return mat;
        };

        const elMat   = mkLine(9.5, 0.1, TX_COLORS[ti], 0.35);
        const commMat = mkLine(9.8, 0.3, 0x00ffff, 0.12);

        // Bypass (theft) line
        const bpGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(hpos.x - 0.7, 1.2, hpos.z - 0.7),
          new THREE.Vector3(hpos.x + 1.6, 0.3, hpos.z + 1.6),
        ]);
        const bypassMat = new THREE.LineBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0 });
        scene.add(new THREE.Line(bpGeo, bypassMat));

        // ── Electricity particles (glow path + moving arc) ──────────────────
        // Layer 1: static glow path — 20 dim points along full line
        const SGLOW = 20;
        const glowArr = new Float32Array(SGLOW * 3);
        for (let k = 0; k < SGLOW; k++) {
          const t = k / (SGLOW - 1);
          glowArr[k * 3]     = tp.x  + (hpos.x - tp.x)  * t;
          glowArr[k * 3 + 1] = 9.5   + (hTop + 0.1 - 9.5) * t;
          glowArr[k * 3 + 2] = tp.z  + (hpos.z - tp.z)  * t;
        }
        const glowGeo = new THREE.BufferGeometry();
        glowGeo.setAttribute('position', new THREE.BufferAttribute(glowArr, 3));
        const glowMat = new THREE.PointsMaterial({
          color: TX_COLORS[ti], size: 0.35, transparent: true, opacity: 0.3,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        scene.add(new THREE.Points(glowGeo, glowMat));

        // Layer 2: arc bolts — 8 moving particles
        const NARC = 8;
        const arcArr = new Float32Array(NARC * 3);
        const arcGeo = new THREE.BufferGeometry();
        arcGeo.setAttribute('position', new THREE.BufferAttribute(arcArr, 3));
        const arcMat = new THREE.PointsMaterial({
          color: 0xffffff, size: 0.8, transparent: true, opacity: 0.95,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        scene.add(new THREE.Points(arcGeo, arcMat));

        // Layer 3: head bolt — 1 bright leading particle
        const headArr = new Float32Array(3);
        const headGeo = new THREE.BufferGeometry();
        headGeo.setAttribute('position', new THREE.BufferAttribute(headArr, 3));
        const headMat = new THREE.PointsMaterial({
          color: 0xffffff, size: 1.8, transparent: true, opacity: 1.0,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        scene.add(new THREE.Points(headGeo, headMat));

        const offsets = Array.from({ length: NARC }, (_, k) => k / NARC);

        houseData.push({
          houseMat, meterMat, ledMat,
          elMat, commMat, bypassMat,
          glowMat, glowGeo,
          arcGeo, arcMat,
          headGeo, headMat,
          offsets, hpos, hTop,
        });
      }

      // ── Simulation state ──────────────────────────────────────────────────
      simRef.current = {
        meters:    Array.from({ length: TOTAL }, (_, i) => newMeter(i, Math.floor(i / HPT))),
        selHouse:  null, selTx: null,
        t: 0, lastMeter: 0, lastEvent: 0,
      };
      setLoading(false);

      // ── Raycaster setup ───────────────────────────────────────────────────
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      const clickMeshes = [];
      scene.traverse(o => {
        if (o.isMesh && (o.userData.type === 'house' || o.userData.type === 'meter' || o.userData.type === 'transformer'))
          clickMeshes.push(o);
      });

      function onClick(e) {
        const r = renderer.domElement.getBoundingClientRect();
        mouse.x =  ((e.clientX - r.left) / r.width)  * 2 - 1;
        mouse.y = -((e.clientY - r.top)  / r.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(clickMeshes);
        if (!hits.length) return;
        const ud = hits[0].object.userData;
        if (ud.type === 'transformer') {
          simRef.current.selTx = ud.transformerIndex;
          simRef.current.selHouse = null;
          setSelTx(ud.transformerIndex); setSelHouse(null);
        } else {
          simRef.current.selHouse = ud.houseIndex;
          simRef.current.selTx = null;
          setSelHouse({ ...simRef.current.meters[ud.houseIndex] }); setSelTx(null);
        }
      }
      renderer.domElement.addEventListener('click', onClick);

      function onResize() {
        if (!mountRef.current) return;
        const w = mountRef.current.clientWidth, h = mountRef.current.clientHeight;
        camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
      }
      window.addEventListener('resize', onResize);

      // ── Animation loop ─────────────────────────────────────────────────────
      let last = performance.now();
      function animate(now) {
        animRef.current = requestAnimationFrame(animate);
        const rawDt = Math.min((now - last) / 1000, 0.1); last = now;
        const dt = rawDt * spRef.current;
        if (!rRef.current) { controls.update(); renderer.render(scene, camera); return; }

        const sim = simRef.current;
        sim.t += dt;

        // Meter updates
        if (sim.t - sim.lastMeter > 1.5) {
          sim.lastMeter = sim.t;
          let online = 0, cf = 0, nz = 0, th = 0, ld = 0;
          sim.meters.forEach(m => {
            m.voltage = Math.max(210, Math.min(250, m.voltage + rand(-1.5, 1.5)));
            m.current = Math.max(0.5, Math.min(15,  m.current + rand(-0.4, 0.4)));
            m.power   = +(m.voltage * m.current / 1000).toFixed(2);
            m.energy  = +(m.energy + m.power * (1.5 / 3600)).toFixed(3);
            if (m.comm === 'Online') online++; else cf++;
            if (m.noisy) nz++; if (m.theft) th++; ld += m.power;
          });
          setStats({ online, comm: cf, noise: nz, theft: th, load: +ld.toFixed(1) });
          if (sim.selHouse !== null) setSelHouse({ ...sim.meters[sim.selHouse] });
        }

        // Random events
        if (sim.t - sim.lastEvent > 3.5) {
          sim.lastEvent = sim.t;
          sim.meters.forEach(m => {
            if (Math.random() < 0.12) { m.noisy = false; if (m.status === 'Noisy') m.status = 'Normal'; }
            if (Math.random() < 0.10) m.comm = 'Online';
            if (Math.random() < 0.07) { m.theft = false; if (m.status === 'THEFT') m.status = 'Normal'; }
          });
          if (noRef.current && Math.random() < 0.45) {
            const m = sim.meters[randI(0, TOTAL - 1)]; m.noisy = true; m.status = 'Noisy';
          }
          if (coRef.current && Math.random() < 0.30) {
            const m = sim.meters[randI(0, TOTAL - 1)];
            m.comm = Math.random() < 0.5 ? 'Offline' : 'Intermittent';
          }
          if (thRef.current && Math.random() < 0.20) {
            const m = sim.meters[randI(0, TOTAL - 1)];
            m.theft = true; m.status = 'THEFT';
            m.theftExp = +(m.power * rand(1.8, 2.5)).toFixed(2);
            m.theftMet = m.power;
          }
        }

        // ── Per-house visuals ─────────────────────────────────────────────
        houseData.forEach((hd, hi) => {
          const m   = sim.meters[hi];
          const ti  = m.ti;
          const txp = TX_POS[ti];
          const sel = sim.selHouse === hi;
          const txs = sim.selTx   === ti;
          const dim = foRef.current !== null && foRef.current !== ti;

          // House emissive
          if (sel || txs) {
            hd.houseMat.emissive.setHex(0xffffff); hd.houseMat.emissiveIntensity = 0.5;
          } else if (m.theft) {
            hd.houseMat.emissive.setHex(0xff2200);
            hd.houseMat.emissiveIntensity = 0.4 + 0.3 * Math.sin(sim.t * 4 + hi);
          } else if (m.noisy) {
            hd.houseMat.emissive.setHex(0xffaa00);
            hd.houseMat.emissiveIntensity = 0.2 + 0.15 * Math.sin(sim.t * 10 + hi);
          } else if (m.comm !== 'Online') {
            hd.houseMat.emissive.setHex(0xff0044); hd.houseMat.emissiveIntensity = 0.12;
          } else {
            hd.houseMat.emissive.setHex(TX_COLORS[ti]);
            hd.houseMat.emissiveIntensity = dim ? 0.02 : 0.04;
          }
          hd.houseMat.transparent = dim; hd.houseMat.opacity = dim ? 0.15 : 1;

          // Meter LED
          const ledCol = m.comm !== 'Online' ? 0xff0000 : m.theft ? 0xff4400 : m.noisy ? 0xffaa00 : 0x00ff44;
          hd.ledMat.color.setHex(ledCol); hd.ledMat.emissive.setHex(ledCol);
          hd.ledMat.emissiveIntensity = m.noisy ? 1.5 + Math.sin(sim.t * 14 + hi) : 1.5;
          hd.meterMat.emissive.setHex(ledCol);
          hd.meterMat.emissiveIntensity = 0.6;

          // Electric line color
          hd.elMat.opacity   = dim ? 0.04 : (sel || txs) ? 0.9 : 0.3;
          hd.elMat.color.setHex(m.theft ? 0xff2200 : m.noisy ? 0xffaa00 : TX_COLORS[ti]);
          // Comm line
          hd.commMat.opacity = dim ? 0.02
            : m.comm === 'Offline' ? 0
            : m.comm === 'Intermittent' ? 0.12 * (0.5 + 0.5 * Math.sin(sim.t * 8 + hi))
            : 0.12;
          // Bypass
          hd.bypassMat.opacity = m.theft ? 0.6 + 0.3 * Math.sin(sim.t * 6 + hi) : 0;

          // ── Electricity arc animation ───────────────────────────────────
          const arcSpd = m.noisy ? 1.4 : m.theft ? 2.0 : 0.55;
          hd.offsets = hd.offsets.map(t => { let n = t + dt * arcSpd * 0.42; return n > 1 ? n - 1 : n; });

          const arcCol = m.theft ? 0xff4400 : m.noisy ? 0xffee00 : TX_COLORS[ti];
          hd.arcMat.color.setHex(arcCol);
          hd.arcMat.opacity = dim ? 0.04 : 0.95;

          const pArr = hd.arcGeo.attributes.position.array;
          const dx = hd.hpos.x - txp.x, dz = hd.hpos.z - txp.z;
          const dy = (hd.hTop + 0.1) - 9.5;
          const dist = Math.sqrt(dx * dx + dz * dz);

          hd.offsets.forEach((t, k) => {
            // Sine-wave deviation perpendicular to line (arc effect)
            const arcAmp   = m.noisy ? 0.7 : 0.25;
            const arcWaves = m.noisy ? 4 : 2;
            const perp = Math.sin(t * Math.PI * arcWaves + sim.t * 6 + hi * 0.7) * arcAmp;
            // Perpendicular direction (rotate 90°)
            const nx = -dz / dist, nz = dx / dist;
            const jitter = m.noisy ? (Math.random() - 0.5) * 0.4 : 0;

            pArr[k * 3]     = txp.x + dx * t + nx * perp + jitter;
            pArr[k * 3 + 1] = 9.5   + dy * t + Math.sin(t * Math.PI) * 0.3; // slight arc sag
            pArr[k * 3 + 2] = txp.z + dz * t + nz * perp + jitter;
          });
          hd.arcGeo.attributes.position.needsUpdate = true;

          // Head bolt — leading bright spark
          const headT = (hd.offsets.reduce((a, b) => a > b ? a : b)); // max offset = leading
          const headPerp = Math.sin(headT * Math.PI * 2 + sim.t * 8 + hi) * 0.15;
          const nx = -dz / dist, nz = dx / dist;
          hd.headGeo.attributes.position.array[0] = txp.x + dx * headT + nx * headPerp;
          hd.headGeo.attributes.position.array[1] = 9.5   + dy * headT + Math.sin(headT * Math.PI) * 0.3;
          hd.headGeo.attributes.position.array[2] = txp.z + dz * headT + nz * headPerp;
          hd.headGeo.attributes.position.needsUpdate = true;
          hd.headMat.color.setHex(m.theft ? 0xff6600 : m.noisy ? 0xffffaa : 0xffffff);
          hd.headMat.opacity = dim ? 0.04 : 0.9 + 0.1 * Math.sin(sim.t * 20 + hi);
          hd.headMat.size    = sel ? 2.5 : 1.6 + 0.4 * Math.sin(sim.t * 15 + hi);

          // Glow path pulse
          hd.glowMat.color.setHex(arcCol);
          hd.glowMat.opacity = dim ? 0.01
            : m.noisy ? 0.35 + 0.15 * Math.sin(sim.t * 12 + hi)
            : m.comm === 'Offline' ? 0.1
            : 0.22 + 0.08 * Math.sin(sim.t * 3 + hi * 0.5);
        });

        // Transformer status indicators
        txObjects.forEach((tx, ti) => {
          const sl = sim.meters.slice(ti * HPT, (ti + 1) * HPT);
          const hasT = sl.some(m => m.theft), hasN = sl.some(m => m.noisy);
          const hasC = sl.some(m => m.comm !== 'Online');
          const col = hasT ? 0xff2200 : hasN ? 0xffaa00 : hasC ? 0xff0044 : 0x00ff88;
          tx.indMat.color.setHex(col); tx.indMat.emissive.setHex(col);
          tx.indMat.emissiveIntensity = 1.5 + 0.7 * Math.sin(sim.t * 4 + ti);
        });

        controls.update();
        renderer.render(scene, camera);
      }
      animRef.current = requestAnimationFrame(animate);

      threeRef.current = { renderer, onClick, onResize };
    })().catch(err => {
      console.error('GridGuard init error:', err.message || err);
      setLoading(false);
    });

    return () => {
      dead = true;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (threeRef.current) {
        const { renderer, onClick, onResize } = threeRef.current;
        renderer.domElement.removeEventListener('click', onClick);
        window.removeEventListener('resize', onResize);
        renderer.dispose();
        if (mountRef.current?.contains(renderer.domElement))
          mountRef.current.removeChild(renderer.domElement);
      }
      threeRef.current = null;
    };
  }, []); // eslint-disable-line

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (!simRef.current) return;
    simRef.current.meters = Array.from({ length: TOTAL }, (_, i) => newMeter(i, Math.floor(i / HPT)));
    simRef.current.selHouse = simRef.current.selTx = null;
    setSelHouse(null); setSelTx(null);
    setStats({ online: 150, comm: 0, noise: 0, theft: 0, load: 0 });
  }, []);

  const handleAnomaly = useCallback(() => {
    if (!simRef.current) return;
    const m = simRef.current.meters[randI(0, TOTAL - 1)];
    const r = Math.random();
    if (r < 0.33)      { m.noisy = true; m.status = 'Noisy'; }
    else if (r < 0.66) { m.comm = 'Offline'; }
    else               { m.theft = true; m.status = 'THEFT'; m.theftExp = +(m.power * rand(1.8, 2.5)).toFixed(2); m.theftMet = m.power; }
  }, []);

  const handleFocus = useCallback((ti) => setFocusArea(prev => prev === ti ? null : ti), []);

  const handleSelTx = useCallback((ti) => {
    if (!simRef.current) return;
    simRef.current.selTx = ti; simRef.current.selHouse = null;
    setSelTx(ti); setSelHouse(null);
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const hex = (c) => '#' + c.toString(16).padStart(6, '0');
  const statusCls = s => !s || s === 'Normal' ? 'text-green-400' : s === 'THEFT' ? 'text-red-400' : 'text-yellow-400';
  const commCls   = c => c === 'Offline' ? 'text-red-500' : c === 'Intermittent' ? 'text-yellow-400' : 'text-cyan-400';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col bg-gray-950 text-gray-100 overflow-hidden" style={{ height: '100vh' }}>

      {/* Header */}
      <header className="flex-shrink-0 bg-gray-900 border-b border-blue-900/40 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          <span className="font-bold tracking-widest text-sm uppercase text-yellow-400">GridGuard</span>
          <span className="text-gray-500 text-xs">— Indian Smart Distribution Network Simulator</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="text-blue-400 font-bold">3</span> Transformers
          <span className="text-gray-700 mx-1">|</span>
          <span className="text-blue-400 font-bold">150</span> Houses
          <span className="text-gray-700 mx-1">|</span>
          <span className="text-blue-400 font-bold">150</span> Smart Meters
        </div>
      </header>

      <div className="flex min-h-0" style={{ flex: 1 }}>

        {/* Left sidebar */}
        <aside className="flex-shrink-0 w-52 bg-gray-900/80 border-r border-blue-900/30 flex flex-col gap-2 p-3 overflow-y-auto">

          <div className="bg-gray-800/60 rounded-lg p-3 space-y-1.5 text-xs">
            <div className="text-yellow-400 font-semibold uppercase tracking-wider mb-2">Network Stats</div>
            {[
              { l: 'Transformers',  v: 3,              c: 'text-blue-400' },
              { l: 'Houses',        v: 150,             c: 'text-blue-400' },
              { l: 'Meters Online', v: stats.online,   c: 'text-green-400' },
              { l: 'Comm Failures', v: stats.comm,     c: stats.comm  > 0 ? 'text-red-400'    : 'text-green-400' },
              { l: 'Noise Events',  v: stats.noise,    c: stats.noise > 0 ? 'text-yellow-400' : 'text-green-400' },
              { l: 'Theft Cases',   v: stats.theft,    c: stats.theft > 0 ? 'text-red-500'    : 'text-green-400' },
              { l: 'Total Load',    v: `${stats.load} kW`, c: 'text-cyan-400' },
            ].map(r => (
              <div key={r.l} className="flex justify-between">
                <span className="text-gray-400">{r.l}</span>
                <span className={`font-mono font-bold ${r.c}`}>{r.v}</span>
              </div>
            ))}
          </div>

          <div className="bg-gray-800/60 rounded-lg p-3 text-xs space-y-2">
            <div className="text-yellow-400 font-semibold uppercase tracking-wider mb-1">Transformers</div>
            {[0, 1, 2].map(ti => (
              <div key={ti} className="space-y-1">
                <button onClick={() => handleSelTx(ti)}
                  className={`w-full text-left px-2 py-1.5 rounded transition-colors border ${
                    selTx === ti ? 'bg-blue-600/40 border-blue-500/60' : 'bg-gray-700/40 hover:bg-gray-700 border-transparent'
                  }`}>
                  <span style={{ color: hex(TX_COLORS[ti]) }}>⚡</span>{' '}{TX_NAMES[ti]}
                </button>
                <button onClick={() => handleFocus(ti)}
                  className={`w-full text-left px-2 py-1 rounded text-[10px] transition-colors border ${
                    focusArea === ti ? 'bg-purple-600/40 text-purple-300 border-purple-500/50' : 'bg-gray-700/20 text-gray-500 hover:text-gray-300 border-transparent'
                  }`}>
                  {focusArea === ti ? '⊙ Focused' : '⊕ Focus Area'}
                </button>
              </div>
            ))}
          </div>

          <div className="bg-gray-800/60 rounded-lg p-3 text-xs space-y-1.5">
            <div className="text-yellow-400 font-semibold uppercase tracking-wider mb-2">Legend</div>
            {[
              ['bg-blue-400',   'Normal Flow (arc)'],
              ['bg-yellow-400', 'Noise / Disturbance'],
              ['bg-red-400',    'Comm Failure'],
              ['bg-red-600',    'Theft / Anomaly'],
              ['bg-cyan-400',   'Comm Link'],
              ['bg-white',      'Arc head spark'],
            ].map(([cls, lbl]) => (
              <div key={lbl} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cls}`} />
                <span className="text-gray-400">{lbl}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Canvas */}
        <main className="flex-1 relative min-w-0">
          <div ref={mountRef} className="w-full h-full" />

          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 z-10">
              <div className="w-10 h-10 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin mb-4" />
              <span className="text-yellow-400 text-sm tracking-wider">Loading 3D Grid…</span>
            </div>
          )}

          {!loading && (
            <div className="absolute top-2 left-0 right-0 flex justify-around pointer-events-none">
              {[0, 1, 2].map(ti => (
                <span key={ti} className="text-xs font-bold px-2 py-0.5 rounded border"
                  style={{ color: hex(TX_COLORS[ti]), borderColor: hex(TX_COLORS[ti]) + '44', backgroundColor: hex(TX_COLORS[ti]) + '11' }}>
                  Area {ti + 1} · Houses {ti * 50 + 1}–{(ti + 1) * 50}
                </span>
              ))}
            </div>
          )}
        </main>

        {/* Right sidebar */}
        <aside className="flex-shrink-0 w-60 bg-gray-900/80 border-l border-blue-900/30 flex flex-col gap-2 p-3 overflow-y-auto">

          <div className="bg-gray-800/60 rounded-lg p-3 text-xs space-y-3">
            <div className="text-yellow-400 font-semibold uppercase tracking-wider">Controls</div>
            <div className="flex gap-2">
              <button onClick={() => setRunning(r => !r)}
                className={`flex-1 py-1.5 rounded font-bold transition-colors ${running ? 'bg-yellow-600/70 hover:bg-yellow-600 text-yellow-100' : 'bg-green-700/70 hover:bg-green-700 text-green-100'}`}>
                {running ? '⏸ Pause' : '▶ Start'}
              </button>
              <button onClick={handleReset}
                className="flex-1 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 font-bold">
                ↺ Reset
              </button>
            </div>

            <div>
              <div className="text-gray-400 mb-1">Speed: <span className="text-white font-bold">{speed}×</span></div>
              <input type="range" min="0.25" max="5" step="0.25" value={speed}
                onChange={e => setSpeed(+e.target.value)} className="w-full accent-yellow-500" />
            </div>

            <div className="space-y-2">
              {[
                { label: '⚡ Electrical Noise', val: noiseOn, set: setNoiseOn },
                { label: '📡 Comm Failures',   val: commOn,  set: setCommOn },
                { label: '🔴 Theft Events',    val: theftOn, set: setTheftOn },
              ].map(ctrl => (
                <label key={ctrl.label} className="flex items-center justify-between cursor-pointer select-none">
                  <span className="text-gray-300">{ctrl.label}</span>
                  <div onClick={() => ctrl.set(v => !v)}
                    className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors ${ctrl.val ? 'bg-yellow-500' : 'bg-gray-600'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${ctrl.val ? 'left-4' : 'left-0.5'}`} />
                  </div>
                </label>
              ))}
            </div>

            <button onClick={handleAnomaly}
              className="w-full py-1.5 rounded bg-red-700/60 hover:bg-red-700 text-red-200 font-bold transition-colors">
              ⚠ Trigger Random Anomaly
            </button>
          </div>

          {/* Inspection */}
          <div className="bg-gray-800/60 rounded-lg p-3 text-xs space-y-2 flex-1 min-h-0 overflow-y-auto">
            <div className="text-yellow-400 font-semibold uppercase tracking-wider">Inspection</div>

            {!selHouse && selTx === null && (
              <p className="text-gray-500 italic text-[11px]">Click a house, meter, or transformer pole.</p>
            )}

            {selTx !== null && (() => {
              const ms     = simRef.current?.meters.slice(selTx * 50, (selTx + 1) * 50) ?? [];
              const load   = ms.reduce((s, m) => s + (m.power || 0), 0).toFixed(1);
              const online = ms.filter(m => m.comm === 'Online').length;
              const theft  = ms.filter(m => m.theft).length;
              const noisy  = ms.filter(m => m.noisy).length;
              return (
                <div className="space-y-1.5">
                  <div className="font-bold text-sm" style={{ color: hex(TX_COLORS[selTx]) }}>
                    {TX_NAMES[selTx]}
                  </div>
                  <div className="text-gray-400 text-[11px]">Area {selTx + 1} · Houses {selTx * 50 + 1}–{(selTx + 1) * 50}</div>
                  <div className="border-t border-gray-700 pt-2 space-y-1">
                    <Row label="Area Load"   val={`${load} kW`}    c="text-cyan-400" />
                    <Row label="Online"      val={`${online}/50`}  c="text-green-400" />
                    <Row label="Theft Cases" val={theft}           c={theft > 0 ? 'text-red-400' : 'text-green-400'} />
                    <Row label="Noise Cases" val={noisy}           c={noisy > 0 ? 'text-yellow-400' : 'text-green-400'} />
                  </div>
                </div>
              );
            })()}

            {selHouse && (
              <div className="space-y-1.5">
                <div className="font-bold text-sm text-white">House {selHouse.hi + 1}</div>
                <div className="text-gray-400 text-[11px]">{TX_NAMES[selHouse.ti]}</div>
                <div className="border-t border-gray-700 pt-2 space-y-1">
                  <Row label="Voltage" val={`${selHouse.voltage?.toFixed(1)} V`}  c="text-blue-300" />
                  <Row label="Current" val={`${selHouse.current?.toFixed(2)} A`}  c="text-blue-300" />
                  <Row label="Power"   val={`${selHouse.power?.toFixed(2)} kW`}   c="text-cyan-400" />
                  <Row label="Energy"  val={`${selHouse.energy?.toFixed(1)} kWh`} c="text-cyan-400" />
                  <Row label="Status"  val={selHouse.status} c={statusCls(selHouse.status)} />
                  <Row label="Comm"    val={selHouse.comm}   c={commCls(selHouse.comm)} />
                </div>
                {selHouse.theft && (
                  <div className="border border-red-700/50 bg-red-900/20 rounded p-2 space-y-1">
                    <div className="text-red-400 font-bold">⚠ THEFT DETECTED</div>
                    <Row label="Expected"    val={`${selHouse.theftExp} kW`} c="text-orange-400" />
                    <Row label="Metered"     val={`${selHouse.theftMet?.toFixed(2)} kW`} c="text-red-400" />
                    <Row label="Discrepancy" val={`${Math.abs(selHouse.theftExp - (selHouse.theftMet || 0)).toFixed(2)} kW`} c="text-red-500" />
                  </div>
                )}
                {selHouse.noisy && (
                  <div className="border border-yellow-700/50 bg-yellow-900/20 rounded p-2">
                    <div className="text-yellow-400 font-bold">⚡ ELECTRICAL NOISE</div>
                    <div className="text-yellow-500 text-[10px]">Voltage fluctuation on distribution line</div>
                  </div>
                )}
                {selHouse.comm !== 'Online' && (
                  <div className="border border-red-700/40 bg-red-900/10 rounded p-2">
                    <div className="text-red-400 font-bold">📡 COMM: {selHouse.comm}</div>
                    <div className="text-gray-500 text-[10px]">Power still flowing normally</div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-gray-800/40 rounded p-2 text-[10px] text-gray-600 leading-relaxed">
            Drag: Orbit · Scroll: Zoom · Right-drag: Pan · Click: Select
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, val, c }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-gray-400">{label}</span>
      <span className={`font-mono font-bold ${c}`}>{val}</span>
    </div>
  );
}
