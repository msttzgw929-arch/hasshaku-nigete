import * as THREE from 'three';

// ====================================================================
//  八尺様からにげて！  — first-person escape game (three.js)
// ====================================================================
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
if (isTouch) document.body.classList.add('touchUI');

const META = await fetch('assets/img/meta.json').then(r => r.json());

// ------------------------------------------------------------ renderer
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
const scene = new THREE.Scene();
const FOG = new THREE.Color(0x0c1226);
scene.background = FOG.clone();
scene.fog = new THREE.FogExp2(FOG, 0.026);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 600);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

scene.add(new THREE.HemisphereLight(0x7080b8, 0x1a1a28, 0.75));
const moon = new THREE.DirectionalLight(0x9aaee0, 0.55); moon.position.set(-40, 80, -30); scene.add(moon);

// ------------------------------------------------------------ textures
const loader = new THREE.TextureLoader();
const loadTex = url => new Promise((res, rej) => loader.load(url, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; res(t); }, undefined, rej));
const loadImg = url => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
// building facade: 8x8 bays, each bay = 4m x 3m
function facadeTex(lit) {
  return canvasTex(512, 512, (g, w, h) => {
    const bw = w / 8, bh = h / 8;
    g.fillStyle = lit ? '#000' : '#e8e4dc'; g.fillRect(0, 0, w, h);
    if (!lit) { for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); } }
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const on = ((x * 7 + y * 13) * 2654435761 % 1000) / 1000;
      const X = x * bw + bw * 0.2, Y = y * bh + bh * 0.25, W = bw * 0.6, H = bh * 0.45;
      if (lit) {
        if (on < 0.33) { const warm = on < 0.22; g.fillStyle = warm ? '#ffcf7a' : '#bfe3ff'; g.fillRect(X, Y, W, H); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(X + W / 2 - 1, Y, 2, H); }
      } else {
        g.fillStyle = '#2a3140'; g.fillRect(X, Y, W, H);
        g.strokeStyle = '#777'; g.lineWidth = 3; g.strokeRect(X, Y, W, H);
        g.fillStyle = '#999'; g.fillRect(X - 4, Y + H, W + 8, 5);
      }
    }
  }, true);
}
const facadeMap = facadeTex(false), facadeEmi = facadeTex(true);
const asphalt = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#2a2c33'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { const v = 30 + Math.random() * 40 | 0; g.fillStyle = `rgb(${v},${v},${v + 6})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
}, true);
asphalt.repeat.set(60, 60);
const concrete = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#4a4c52'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 3000; i++) { const v = 60 + Math.random() * 30 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  g.strokeStyle = '#3a3c40'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
}, true);
function signTex(text, bg, fg, vertical) {
  const W = vertical ? 128 : 512, H = vertical ? 512 : 128;
  return canvasTex(W, H, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, W, H); g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(6, 6, W - 12, H - 12);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${vertical ? 88 : 80}px sans-serif`;
    if (vertical) { const cs = [...text]; const step = (H - 40) / cs.length; cs.forEach((ch, i) => g.fillText(ch, W / 2, 20 + step * (i + 0.5))); }
    else g.fillText(text, W / 2, H / 2 + 4);
  });
}
const SIGNS = [['居酒屋', '#7a1010', '#ffe9a8'], ['ラーメン', '#c41a1a', '#fff'], ['薬', '#0d4fa8', '#fff'], ['たばこ', '#1a6b2a', '#fff'], ['スナック', '#4a0f5a', '#ff9de0'], ['銭湯', '#123a6a', '#fff'], ['そば', '#2a1a0a', '#ffd27a'], ['質', '#111', '#ffcc33'], ['ホテル', '#5a0030', '#ff7ab8'], ['カラオケ', '#0a3a5a', '#7af']]
  .map(([t, b, f]) => [signTex(t, b, f, true), signTex(t, b, f, false)]);
const glowTex = canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.25, 'rgba(255,210,140,.5)'); gr.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
const shadowTex = canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(0.6, 'rgba(0,0,0,.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
const vendTex = canvasTex(128, 256, (g, w, h) => {
  g.fillStyle = '#e8f4ff'; g.fillRect(0, 0, w, h); g.fillStyle = '#0a5ad0'; g.fillRect(0, 0, w, 30); g.fillRect(0, h - 70, w, 70);
  const cols = ['#e33', '#fa0', '#3a3', '#33f', '#a3f', '#eee', '#f6c'];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) { g.fillStyle = cols[(r * 5 + c) % cols.length]; g.fillRect(8 + c * 23, 40 + r * 36, 14, 26); }
  g.fillStyle = '#222'; g.fillRect(20, h - 50, 88, 26);
});

// ------------------------------------------------------------ sky
{
  const n = 1200, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const th = Math.random() * Math.PI * 2, ph = Math.random() * 1.3; const r = 450; pos[i * 3] = r * Math.cos(th) * Math.cos(ph); pos[i * 3 + 1] = r * Math.sin(ph) + 30; pos[i * 3 + 2] = r * Math.sin(th) * Math.cos(ph); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbfd0ff, size: 1.6, sizeAttenuation: false, fog: false }));
  scene.add(stars);
  const moonS = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xdfe8ff, fog: false, depthWrite: false }));
  moonS.position.set(-200, 260, -300); moonS.scale.set(90, 90, 1); scene.add(moonS);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ color: 0xf4f6ff, fog: false }));
  disc.position.copy(moonS.position); disc.lookAt(0, 0, 0); scene.add(disc);
}

// ------------------------------------------------------------ town
const ROAD = 9, BLOCK = 26, NB = 7, CELL = ROAD + BLOCK, HALF = NB * CELL / 2;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 60, HALF * 2 + 60), new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.92, color: 0x9aa0b0 }));
ground.rotation.x = -Math.PI / 2; scene.add(ground);
const buildings = []; // {box:{x0,x1,z0,z1}, h, group, alive, color, kind}
const lamps = [];
const wallColors = [0xe8dccb, 0xc9c3b8, 0xa89a88, 0xd6d0c4, 0x8f7a64, 0xb8c0c4].map(c => new THREE.MeshStandardMaterial({ color: c, map: facadeMap, emissive: 0xffffff, emissiveMap: facadeEmi, emissiveIntensity: 0.9, roughness: 0.9 }));
const roofMats = [0x2b3242, 0x33302e, 0x47322a, 0x23272f].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0.1 }));
const flatRoofMat = new THREE.MeshStandardMaterial({ color: 0x55575c, roughness: 0.95 });
const blockMat = new THREE.MeshStandardMaterial({ map: concrete, color: 0x9a9ca4, roughness: 0.95 });
const poleMat = new THREE.MeshStandardMaterial({ color: 0x5a5a5e, roughness: 0.7 });
const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff1cf });
const vendMat = new THREE.MeshStandardMaterial({ map: vendTex, emissive: 0xffffff, emissiveMap: vendTex, emissiveIntensity: 0.8 });
const vendBody = new THREE.MeshStandardMaterial({ color: 0x1a4fb0 });
const lineMat = new THREE.MeshBasicMaterial({ color: 0x8f9098 });
const blockGeo = new THREE.BoxGeometry(1, 1, 1);

function boxWithUV(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, n = g.attributes.normal;
  const off = [Math.random(), Math.random()];
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    const sx = ny > 0.5 ? 0 : (nx > 0.5 ? d : w) / 32, sy = ny > 0.5 ? 0 : h / 24;
    uv.setXY(i, uv.getX(i) * sx + off[0], uv.getY(i) * sy + off[1]);
  }
  return g;
}
function prismRoof(w, d, rh, mat) {
  const s = new THREE.Shape(); s.moveTo(-w / 2 - 0.4, 0); s.lineTo(w / 2 + 0.4, 0); s.lineTo(0, rh); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d + 0.8, bevelEnabled: false }); g.translate(0, 0, -(d + 0.8) / 2);
  return new THREE.Mesh(g, mat);
}
function addBuilding(cx, cz, w, d, kind) {
  const grp = new THREE.Group();
  let h, color;
  const wm = wallColors[(Math.random() * wallColors.length) | 0];
  if (kind === 'house') h = rand(4.5, 7);
  else if (kind === 'shop') h = rand(5.5, 9);
  else h = rand(9, 16);
  h = Math.round(h / 3) * 3 + 0.2;
  const body = new THREE.Mesh(boxWithUV(w, h, d), wm); body.position.y = h / 2; grp.add(body);
  color = wm.color.getHex();
  let topH = h;
  if (kind === 'house') { const rh = Math.min(w, d) * 0.35; const r = prismRoof(w, d, rh, roofMats[(Math.random() * roofMats.length) | 0]); r.position.y = h; if (w < d) r.rotation.y = Math.PI / 2, r.geometry = prismRoofGeo(d, w, rh); grp.add(r); topH = h + rh; }
  else { const r = new THREE.Mesh(blockGeo, flatRoofMat); r.scale.set(w + 0.3, 0.5, d + 0.3); r.position.y = h + 0.25; grp.add(r); topH = h + 0.5; }
  if (kind === 'shop' || Math.random() < 0.25) {
    const [vt, ht] = SIGNS[(Math.random() * SIGNS.length) | 0];
    const sm = new THREE.MeshBasicMaterial({ map: ht });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.8, 6), 1.3), sm);
    // face toward the nearest road side
    const side = facing(cx, cz, w, d);
    s.position.set(side.x * (w / 2 + 0.05), 3.4, side.z * (d / 2 + 0.05)); s.rotation.y = Math.atan2(side.x, side.z); grp.add(s);
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.6, 1.0), [sm, sm, sm, sm, new THREE.MeshBasicMaterial({ map: vt }), new THREE.MeshBasicMaterial({ map: vt })]);
    v.position.set(side.x * (w / 2 + 0.6) + side.z * (w / 2 - 0.6), 5.8, side.z * (d / 2 + 0.6) + side.x * (d / 2 - 0.6)); v.rotation.y = Math.atan2(side.x, side.z) + Math.PI / 2; grp.add(v);
  }
  grp.position.set(cx, 0, cz);
  grp.traverse(o => { o.matrixAutoUpdate = false; o.updateMatrix(); });
  grp.updateMatrixWorld(true);
  scene.add(grp);
  buildings.push({ box: { x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 }, h: topH, w, d, cx, cz, group: grp, alive: true, color, kind });
}
function prismRoofGeo(w, d, rh) {
  const s = new THREE.Shape(); s.moveTo(-w / 2 - 0.4, 0); s.lineTo(w / 2 + 0.4, 0); s.lineTo(0, rh); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d + 0.8, bevelEnabled: false }); g.translate(0, 0, -(d + 0.8) / 2); return g;
}
function facing(cx, cz, w, d) {
  // direction to nearest road from building center
  const lx = ((cx + HALF) % CELL + CELL) % CELL, lz = ((cz + HALF) % CELL + CELL) % CELL;
  const opts = [[-1, 0, lx - ROAD / 2], [1, 0, CELL - ROAD / 2 - lx], [0, -1, lz - ROAD / 2], [0, 1, CELL - ROAD / 2 - lz]];
  opts.sort((a, b) => a[2] - b[2]); return { x: opts[0][0], z: opts[0][1] };
}
function addSmall(cx, cz, w, d, h, build, color, kind) {
  const grp = new THREE.Group(); build(grp); grp.position.set(cx, 0, cz);
  grp.traverse(o => { o.matrixAutoUpdate = false; o.updateMatrix(); }); grp.updateMatrixWorld(true); scene.add(grp);
  const b = { box: { x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 }, h, w, d, cx, cz, group: grp, alive: true, color, kind, small: true };
  buildings.push(b); return b;
}
function genTown() {
  for (let bi = 0; bi < NB; bi++) for (let bj = 0; bj < NB; bj++) {
    const x0 = -HALF + bi * CELL + ROAD / 2, z0 = -HALF + bj * CELL + ROAD / 2;
    const pad = new THREE.Mesh(blockGeo, blockMat); pad.scale.set(BLOCK, 0.12, BLOCK); pad.position.set(x0 + BLOCK / 2, 0.06, z0 + BLOCK / 2); scene.add(pad);
    if (bi === 3 && bj === 3) { // central park / open square
      continue;
    }
    // split block into lots with narrow alleys
    const nx = Math.random() < 0.5 ? 2 : 3, nz = Math.random() < 0.5 ? 2 : 3, alley = 2.2;
    const lw = (BLOCK - alley * (nx - 1)) / nx, ld = (BLOCK - alley * (nz - 1)) / nz;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      if (Math.random() < 0.1) continue; // empty lot
      const cx = x0 + i * (lw + alley) + lw / 2, cz = z0 + j * (ld + alley) + ld / 2;
      const r = Math.random(); const kind = r < 0.5 ? 'house' : r < 0.78 ? 'shop' : 'apt';
      addBuilding(cx + rand(-0.4, 0.4), cz + rand(-0.4, 0.4), lw - rand(0.6, 1.4), ld - rand(0.6, 1.4), kind);
    }
  }
  // road center lines
  for (let i = 0; i <= NB; i++) {
    const p = -HALF + i * CELL;
    for (let s = -HALF; s < HALF; s += 6) {
      const a = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 2.6), lineMat); a.rotation.x = -Math.PI / 2; a.position.set(p, 0.02, s + 3); scene.add(a);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.18), lineMat); b.rotation.x = -Math.PI / 2; b.position.set(s + 3, 0.02, p); scene.add(b);
    }
  }
  // street lamps & vending machines & poles along roads
  const lampGeo = new THREE.CylinderGeometry(0.08, 0.1, 5.2, 6), headGeo = new THREE.SphereGeometry(0.28, 10, 8);
  for (let i = 0; i <= NB; i++) for (let k = 0; k < NB; k++) {
    for (const along of [0.3, 0.75]) {
      const p = -HALF + i * CELL, s = -HALF + k * CELL + ROAD / 2 + BLOCK * along;
      for (const [x, z] of [[p + ROAD / 2 - 0.5, s], [s, p - ROAD / 2 + 0.5]]) {
        if (Math.abs(x) > HALF - 1 || Math.abs(z) > HALF - 1) continue;
        if (Math.random() < 0.35) continue;
        const b = addSmall(x, z, 0.5, 0.5, 5.6, g => {
          const pole = new THREE.Mesh(lampGeo, poleMat); pole.position.y = 2.6; g.add(pole);
          const head = new THREE.Mesh(headGeo, lampMat); head.position.y = 5.3; g.add(head);
          const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd9a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
          glow.position.y = 5.3; glow.scale.set(4, 4, 1); g.add(glow);
        }, 0x5a5a5e, 'lamp');
        lamps.push(b);
      }
    }
    // vending machines
    for (let n = 0; n < 2; n++) {
      if (Math.random() < 0.5) continue;
      const p = -HALF + i * CELL, s = -HALF + k * CELL + ROAD / 2 + rand(3, BLOCK - 3);
      const vert = Math.random() < 0.5; const x = vert ? p + ROAD / 2 - 0.7 : s, z = vert ? s : p - ROAD / 2 + 0.7;
      if (Math.abs(x) > HALF - 1 || Math.abs(z) > HALF - 1) continue;
      const b = addSmall(x, z, 1.0, 1.0, 1.9, g => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1.85, 0.8), [vendBody, vendBody, vendBody, vendBody, vendMat, vendBody]);
        m.position.y = 0.93; m.rotation.y = vert ? Math.PI / 2 : 0; g.add(m);
        const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x9fd0ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }));
        gl.position.y = 1.1; gl.scale.set(3, 3, 1); g.add(gl);
      }, 0x1a4fb0, 'vend');
      b.light = 0x9fd0ff;
    }
  }
  // boundary fences
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.9 });
  for (const [x, z, w, d] of [[0, -HALF - 1, HALF * 2 + 4, 1], [0, HALF + 1, HALF * 2 + 4, 1], [-HALF - 1, 0, 1, HALF * 2 + 4], [HALF + 1, 0, 1, HALF * 2 + 4]]) {
    const f = new THREE.Mesh(blockGeo, fenceMat); f.scale.set(w, 3, d); f.position.set(x, 1.5, z); scene.add(f);
  }
}
genTown();
// real point lights reassigned to nearest lamps
const lightPool = [];
for (let i = 0; i < 6; i++) { const l = new THREE.PointLight(0xffc88a, 0, 22, 1.6); scene.add(l); lightPool.push(l); }
function updateLights(p) {
  const near = lamps.filter(l => l.alive).map(l => [l, (l.cx - p.x) ** 2 + (l.cz - p.z) ** 2]).sort((a, b) => a[1] - b[1]);
  lightPool.forEach((L, i) => { const e = near[i]; if (e) { L.position.set(e[0].cx, 5.0, e[0].cz); L.intensity = 28; } else L.intensity = 0; });
}

// ------------------------------------------------------------ debris (instanced)
const MAXD = 2600;
const debrisMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9 }), MAXD);
debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
debrisMesh.frustumCulled = false; scene.add(debrisMesh);
const deb = []; let debHead = 0;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
for (let i = 0; i < MAXD; i++) { deb.push({ on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Vector3(), w: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), sleep: true }); _m.makeScale(0, 0, 0); debrisMesh.setMatrixAt(i, _m); debrisMesh.setColorAt(i, _c.set(0xffffff)); }
const activeDeb = new Set();
function spawnDebris(pos, size, vel, color) {
  const i = debHead; debHead = (debHead + 1) % MAXD; const d = deb[i];
  d.on = true; d.sleep = false; d.p.copy(pos); d.s.copy(size); d.v.copy(vel); d.r.set(rand(0, 6), rand(0, 6), rand(0, 6)); d.w.set(rand(-4, 4), rand(-4, 4), rand(-4, 4));
  _c.setHex(color).multiplyScalar(rand(0.55, 1.0)); debrisMesh.setColorAt(i, _c); debrisMesh.instanceColor.needsUpdate = true;
  activeDeb.add(i);
}
function updateDebris(dt) {
  for (const i of activeDeb) {
    const d = deb[i];
    d.v.y -= 22 * dt; d.p.addScaledVector(d.v, dt); d.r.addScaledVector(d.w, dt);
    const hy = Math.min(d.s.x, d.s.y, d.s.z) / 2;
    if (d.p.y < hy) { d.p.y = hy; d.v.y *= -0.3; d.v.x *= 0.6; d.v.z *= 0.6; d.w.multiplyScalar(0.6); if (Math.abs(d.v.y) < 1 && d.v.lengthSq() < 0.6) { d.sleep = true; activeDeb.delete(i); } }
    _e.set(d.r.x, d.r.y, d.r.z); _q.setFromEuler(_e); _m.compose(d.p, _q, d.s); debrisMesh.setMatrixAt(i, _m);
  }
  if (activeDeb.size) debrisMesh.instanceMatrix.needsUpdate = true;
}
// dust particles
const DUSTN = 700; const dustPos = new Float32Array(DUSTN * 3), dustVel = [], dustLife = new Float32Array(DUSTN); let dustHead = 0;
for (let i = 0; i < DUSTN; i++) { dustVel.push(new THREE.Vector3()); dustPos[i * 3 + 1] = -100; }
const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dustTex = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(200,195,190,.55)'); gr.addColorStop(1, 'rgba(200,195,190,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: dustTex, size: 5, transparent: true, depthWrite: false, color: 0x8a8890 }));
dust.frustumCulled = false; scene.add(dust);
function puff(x, y, z, n, spread) { for (let k = 0; k < n; k++) { const i = dustHead; dustHead = (dustHead + 1) % DUSTN; dustPos[i * 3] = x + rand(-spread, spread); dustPos[i * 3 + 1] = y + rand(0, spread); dustPos[i * 3 + 2] = z + rand(-spread, spread); dustVel[i].set(rand(-3, 3), rand(0.5, 4), rand(-3, 3)); dustLife[i] = rand(1.5, 3.5); } }
function updateDust(dt) { for (let i = 0; i < DUSTN; i++) { if (dustLife[i] <= 0) continue; dustLife[i] -= dt; dustPos[i * 3] += dustVel[i].x * dt; dustPos[i * 3 + 1] += dustVel[i].y * dt; dustPos[i * 3 + 2] += dustVel[i].z * dt; dustVel[i].multiplyScalar(1 - dt * 0.8); if (dustLife[i] <= 0) dustPos[i * 3 + 1] = -100; } dustGeo.attributes.position.needsUpdate = true; }

function destroyBuilding(b, from) {
  if (!b.alive) return; b.alive = false; b.group.visible = false; markGridDirty();
  const n = b.small ? 8 : clamp(Math.round((b.w * b.d * b.h) / 18), 25, 90);
  const cs = Math.cbrt((b.w * b.d * b.h) / n);
  for (let k = 0; k < n; k++) {
    _p.set(rand(b.box.x0, b.box.x1), rand(0.3, b.h), rand(b.box.z0, b.box.z1));
    const dir = new THREE.Vector3(_p.x - from.x, 0, _p.z - from.z).normalize();
    const push = rand(3, 11) * (b.small ? 1.4 : 1);
    _s.set(cs * rand(0.5, 1.2), cs * rand(0.3, 0.9), cs * rand(0.5, 1.2));
    spawnDebris(_p, _s, new THREE.Vector3(dir.x * push + rand(-2, 2), rand(1, 8), dir.z * push + rand(-2, 2)), Math.random() < 0.25 ? 0x3a3e48 : b.color);
  }
  puff(b.cx, 1, b.cz, b.small ? 10 : 60, Math.max(b.w, b.d) / 2);
  const dist = Math.hypot(b.cx - player.pos.x, b.cz - player.pos.z);
  SFX.crash(b.small ? 0.4 : 1, dist);
  addShake(clamp((b.small ? 0.15 : 0.7) * (1 - dist / 70), 0, 0.7));
}

// ------------------------------------------------------------ nav grid (for small-belly stage)
const GS = 2, GN = Math.ceil((HALF * 2) / GS);
const blocked = new Uint8Array(GN * GN), flow = new Int32Array(GN * GN);
let gridDirty = true; function markGridDirty() { gridDirty = true; }
const cellOf = (x, z) => [clamp(Math.floor((x + HALF) / GS), 0, GN - 1), clamp(Math.floor((z + HALF) / GS), 0, GN - 1)];
function rebuildGrid() {
  blocked.fill(0);
  for (const b of buildings) {
    if (!b.alive || b.small) continue;
    const [i0, j0] = cellOf(b.box.x0 - 1.2, b.box.z0 - 1.2), [i1, j1] = cellOf(b.box.x1 + 1.2, b.box.z1 + 1.2);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) blocked[i * GN + j] = 1;
  }
  gridDirty = false;
}
const bfsQ = new Int32Array(GN * GN);
function computeFlow(px, pz) {
  if (gridDirty) rebuildGrid();
  flow.fill(-1); const [pi, pj] = cellOf(px, pz); let h = 0, t = 0; const s = pi * GN + pj; flow[s] = 0; bfsQ[t++] = s;
  while (h < t) { const c = bfsQ[h++], ci = (c / GN) | 0, cj = c % GN, dv = flow[c] + 1;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= GN || nj >= GN) continue; const nc = ni * GN + nj; if (flow[nc] >= 0 || (blocked[nc] && nc !== s)) continue; flow[nc] = dv; bfsQ[t++] = nc; } }
}
function flowTarget(x, z) {
  let [i, j] = cellOf(x, z);
  if (flow[i * GN + j] < 0) return null;
  for (let step = 0; step < 3; step++) {
    let best = flow[i * GN + j], bi = i, bj = j;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= GN || nj >= GN) continue; const f = flow[ni * GN + nj]; if (f >= 0 && f < best && !(di && dj && (blocked[ni * GN + j] || blocked[i * GN + nj]))) { best = f; bi = ni; bj = nj; } }
    if (bi === i && bj === j) break; i = bi; j = bj;
  }
  return { x: -HALF + (i + 0.5) * GS, z: -HALF + (j + 0.5) * GS };
}
function collideCircle(pos, r, onlyAlive = true, ignoreSmall = false) {
  for (const b of buildings) {
    if (onlyAlive && !b.alive) continue; if (ignoreSmall && b.small) continue;
    const bx = b.box; if (pos.x < bx.x0 - r - 1 || pos.x > bx.x1 + r + 1 || pos.z < bx.z0 - r - 1 || pos.z > bx.z1 + r + 1) continue;
    const qx = clamp(pos.x, bx.x0, bx.x1), qz = clamp(pos.z, bx.z0, bx.z1); let dx = pos.x - qx, dz = pos.z - qz; const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) { const d = Math.sqrt(d2); pos.x = qx + dx / d * r; pos.z = qz + dz / d * r; }
      else { const ex = [pos.x - bx.x0, bx.x1 - pos.x, pos.z - bx.z0, bx.z1 - pos.z]; const m = Math.min(...ex); if (m === ex[0]) pos.x = bx.x0 - r; else if (m === ex[1]) pos.x = bx.x1 + r; else if (m === ex[2]) pos.z = bx.z0 - r; else pos.z = bx.z1 + r; }
    }
  }
  pos.x = clamp(pos.x, -HALF + r, HALF - r); pos.z = clamp(pos.z, -HALF + r, HALF - r);
}

// ------------------------------------------------------------ Hasshaku-sama (image-based layered billboard)
const IMG = {}; const TEX = {};
const FACES = ['smile', 'irritated', 'angry', 'pain', 'joy'];
const imgList = ['body', 'belly', 'upper', 'face_blink', 'face_irritated_blink', ...FACES.flatMap(f => ['face_' + f, 'face_' + f + '_talk'])];
const PX = 1 / META.H; // fraction per pixel; character height in local units = 1 (group scaled)
const toL = (x, y) => [(x - META.W / 2) * PX, (META.H - y) * PX];
function rectGeo(x0, y0, x1, y1, sx, sy) {
  const [ax, ay] = toL(x0, y1), [bx, by] = toL(x1, y0);
  const g = new THREE.PlaneGeometry(bx - ax, by - ay, sx, sy); g.translate((ax + bx) / 2, (ay + by) / 2, 0); return g;
}
const charCommonV = `
  uniform float uFogDensity; varying float vFogDepth; varying vec2 vUv;`;
const charCommonF = `
  uniform vec3 fogColor; uniform float uFogDensity; uniform vec3 uTint; varying float vFogDepth; varying vec2 vUv;
  vec4 finish(vec4 c){ float f = 1.0 - exp(-uFogDensity*uFogDensity*vFogDepth*vFogDepth); c.rgb = mix(c.rgb*uTint, fogColor, clamp(f,0.,1.)); return c; }`;
function charMaterial(vertBody, fragBody, uniforms) {
  const m = new THREE.ShaderMaterial({
    uniforms: Object.assign({ fogColor: { value: FOG }, uFogDensity: { value: 0.016 }, uTint: { value: new THREE.Color(1, 1, 1) } }, uniforms),
    vertexShader: `${charCommonV}
      ${vertBody.head || ''}
      void main(){ vUv = uv; vec3 p = position; ${vertBody.main || ''}
        vec4 mv = modelViewMatrix * vec4(p,1.0); vFogDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `${charCommonF}
      ${fragBody}`,
    transparent: true, depthWrite: true,
  });
  return m;
}
const H = {
  pos: new THREE.Vector3(0, 0, -45), vel: new THREE.Vector3(), group: new THREE.Group(), upperG: new THREE.Group(),
  height: 6.6, bodyS: 1, bodyT: 1, bellyS: 1, bellyV: 0, bellyT: 1,
  jig: { y: 0, vy: 0, x: 0, vx: 0, rip: 0 }, phase: 0, walk: 0, stage: 0, irr: 0, state: 'chase', stateT: 0, speed: 0,
  expr: { a: 'smile', b: 'smile', m: 1, hold: 0, override: null }, talk: 0, blink: 0, blinkT: 2,
};
let bodyMat, bellyMat, upperMat, faceMat, shadowMesh, angerSprite;
function buildHasshaku() {
  const u = { uPhase: { value: 0 }, uWalk: { value: 0 }, uTime: { value: 0 } };
  bodyMat = charMaterial({
    head: `uniform float uPhase, uWalk, uTime;`,
    main: `
      float sk = 1.0 - smoothstep(0.0, 0.46, uv.y);           // 1 at hem, 0 above skirt
      float side = (uv.x - 0.5) * 2.0;
      float l = sin(uPhase), r = -l;
      float legL = exp(-pow((side + 0.36) / 0.34, 2.0)), legR = exp(-pow((side - 0.36) / 0.34, 2.0));
      float s2 = sk*sk;
      p.x += (l*legL + r*legR) * s2 * 0.035 * uWalk;                       // knees push fabric
      p.y += (max(0.0,l)*legL + max(0.0,r)*legR) * s2*sk * 0.045 * uWalk;  // hem lifts with the stepping leg
      p.x += sin(uPhase + 0.6) * s2 * 0.018 * uWalk;                      // skirt sway lag
      p.x *= 1.0 + 0.012*sin(uTime*1.3)*(1.0-sk)*0.0;
    `}, `uniform sampler2D map; void main(){ if (vUv.y > 0.772) discard; vec4 c = texture2D(map, vUv); if(c.a < 0.04) discard; gl_FragColor = finish(c);
#include <colorspace_fragment>

    }`, Object.assign({ map: { value: TEX.body } }, u));
  bodyMat.uniforms.uPhase = u.uPhase; bodyMat.uniforms.uWalk = u.uWalk; bodyMat.uniforms.uTime = u.uTime;
  const [pvx, pvy] = toL(META.bellyPivot[0], META.bellyPivot[1]);
  const bellyH = (META.bellyBottom - META.bellyPivot[1]) * PX;
  bellyMat = charMaterial({
    head: `uniform float uScale, uJigY, uJigX, uRip, uTime, uGround, uLift; uniform vec2 uPivot; uniform float uBH;`,
    main: `
      vec2 d = p.xy - uPivot;
      float t = clamp(-d.y / uBH, 0.0, 1.6);
      float g = 1.0 + (uScale - 1.0) * smoothstep(0.0, 0.34, t);
      d.x *= g; d.y *= 1.0 + (g - 1.0) * 0.72;
      float w = smoothstep(0.04, 0.55, t);
      vec2 cen = vec2(0.0, -uBH*0.55*(1.0+(uScale-1.0)*0.72));
      vec2 rc = d - cen;
      d.x *= 1.0 + uJigX * w;
      d.y = d.y * (1.0 - uJigX * 0.75 * w) + uJigY * uBH * uScale * w;
      float rl = length(rc) / (uBH*uScale);
      d += normalize(rc + 1e-5) * uRip * sin(rl*12.0 - uTime*16.0) * w * 0.012 * uBH * uScale;
      p.xy = uPivot + d; p.y += uLift;
      // flatten onto the ground when the belly is huge
      float fl = 0.10 * uScale;
      if (p.y < uGround + fl) { float pen = uGround + fl - p.y; p.y = uGround + fl * exp(-pen / fl) ; p.x = uPivot.x + (p.x - uPivot.x) * (1.0 + min(pen / (uBH*uScale), 0.4) * 0.35); }
    `}, `uniform sampler2D map; uniform float uFlash; void main(){ vec4 c = texture2D(map, vUv); if(c.a < 0.04) discard; c.rgb += uFlash*vec3(0.25,0.08,0.1)*c.a; gl_FragColor = finish(c);
#include <colorspace_fragment>

    }`, { map: { value: TEX.belly }, uScale: { value: 1 }, uJigY: { value: 0 }, uJigX: { value: 0 }, uRip: { value: 0 }, uTime: u.uTime, uGround: { value: 0 }, uLift: { value: 0 }, uPivot: { value: new THREE.Vector2(pvx, pvy) }, uBH: { value: bellyH }, uFlash: { value: 0 } });
  upperMat = charMaterial({ head: `uniform float uBreath;`, main: `p.y += uBreath * smoothstep(0.80, 0.95, p.y) * 0.004;` },
    `uniform sampler2D map; void main(){ vec4 c = texture2D(map, vUv); if(c.a < 0.04) discard; gl_FragColor = finish(c);
#include <colorspace_fragment>

    }`, { map: { value: TEX.upper }, uBreath: { value: 0 } });
  faceMat = charMaterial({}, `uniform sampler2D tA, tAt, tB, tBt, tBl; uniform float uMix, uTalk, uBlink;
      vec4 pm(vec4 c){ return vec4(c.rgb*c.a, c.a); }
      void main(){
        vec4 a = mix(pm(texture2D(tA, vUv)), pm(texture2D(tAt, vUv)), uTalk);
        vec4 b = mix(pm(texture2D(tB, vUv)), pm(texture2D(tBt, vUv)), uTalk);
        vec4 c = mix(a, b, uMix);
        vec4 bl = pm(texture2D(tBl, vUv)); c = c*(1.0-bl.a*uBlink) + bl*uBlink;
        if (c.a < 0.01) discard; c.rgb /= c.a; gl_FragColor = finish(c);
#include <colorspace_fragment>

      }`, { tA: { value: TEX.face_smile }, tAt: { value: TEX.face_smile_talk }, tB: { value: TEX.face_smile }, tBt: { value: TEX.face_smile_talk }, tBl: { value: TEX.face_blink }, uMix: { value: 0 }, uTalk: { value: 0 }, uBlink: { value: 0 } });
  faceMat.depthWrite = false;
  const body = new THREE.Mesh(rectGeo(0, 0, META.W, META.H, 24, 60), bodyMat); body.renderOrder = 10;
  const belly = new THREE.Mesh(rectGeo(...META.belly, 48, 48), bellyMat); belly.position.z = 0.004; belly.renderOrder = 11;
  const upper = new THREE.Mesh(rectGeo(...META.upper, 8, 8), upperMat); upper.renderOrder = 12;
  const face = new THREE.Mesh(rectGeo(...META.face, 1, 1), faceMat); face.renderOrder = 13;
  // upper body sways around the waist
  const [wx, wy] = toL(META.bellyPivot[0], META.bellyPivot[1]);
  H.upperG.position.set(wx, wy, 0.008); upper.position.set(-wx, -wy, 0); face.position.set(-wx, -wy, 0.002);
  H.upperG.add(upper, face);
  H.group.add(body, belly, H.upperG);
  [body, belly, upper, face].forEach(m => m.frustumCulled = false);
  scene.add(H.group);
  shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadowMesh.rotation.x = -Math.PI / 2; shadowMesh.position.y = 0.05; scene.add(shadowMesh);
  const aTex = canvasTex(128, 128, (g) => { g.translate(64, 64); g.strokeStyle = '#ff2a4a'; g.lineWidth = 13; g.lineCap = 'round'; for (let k = 0; k < 4; k++) { g.save(); g.rotate(k * Math.PI / 2 + Math.PI / 4); g.beginPath(); g.moveTo(14, -30); g.quadraticCurveTo(14, -14, 30, -14); g.stroke(); g.restore(); } });
  angerSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: aTex, transparent: true, depthWrite: false, fog: false, opacity: 0 }));
  scene.add(angerSprite);
}
function bellyRadius() { return META.bellyHalfW * PX * H.height * H.bodyS * H.bellyS * 0.92; }
function setExpr(e, hold = 0) {
  const X = H.expr; if (hold) { X.override = e; X.hold = hold; }
  const target = X.override || e;
  if (target === X.b) return;
  if (X.m < 0.5) { X.b = target; } else { X.a = X.b; X.b = target; X.m = 0; }
}
function updateFace(dt) {
  const X = H.expr;
  if (X.hold > 0) { X.hold -= dt; if (X.hold <= 0) X.override = null; }
  X.m = Math.min(1, X.m + dt * 5);
  const u = faceMat.uniforms; u.tA.value = TEX['face_' + X.a]; u.tAt.value = TEX['face_' + X.a + '_talk']; u.tB.value = TEX['face_' + X.b]; u.tBt.value = TEX['face_' + X.b + '_talk'];
  const sm = X.m * X.m * (3 - 2 * X.m); u.uMix.value = sm;
  H.talk = lerp(H.talk, clamp(AUD.level() * 9 - 0.08, 0, 1), 1 - Math.exp(-dt * 25)); u.uTalk.value = H.talk;
  // blink only with relaxed/irritated eyes
  H.blinkT -= dt; if (H.blinkT < 0) { H.blink = 0.14; H.blinkT = rand(2, 5); }
  const canBlink = (X.b === 'smile' || X.b === 'irritated');
  u.tBl.value = X.b === 'irritated' ? TEX.face_irritated_blink : TEX.face_blink;
  let bv = 0; if (H.blink > 0) { H.blink -= dt; bv = Math.sin((1 - H.blink / 0.14) * Math.PI); }
  u.uBlink.value = canBlink ? bv * sm : 0;
}

// ------------------------------------------------------------ audio
const AUD = (() => {
  let ac = null, master, voiceBus, sfxBus, analyser, data, ambience = null, cur = null, curPri = 0, heart = null;
  const buf = {};
  function init() {
    if (ac) return; ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
    const comp = ac.createDynamicsCompressor(); comp.connect(master);
    voiceBus = ac.createGain(); voiceBus.gain.value = 1.2; analyser = ac.createAnalyser(); analyser.fftSize = 512; data = new Float32Array(analyser.fftSize);
    voiceBus.connect(analyser); analyser.connect(comp);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(comp);
  }
  async function load(names, onEach) {
    init();
    await Promise.all(names.map(async n => { try { const r = await fetch(`assets/voice/${n}.mp3`); const a = await r.arrayBuffer(); buf[n] = await ac.decodeAudioData(a); } catch (e) { console.warn('voice load failed', n, e); } onEach && onEach(); }));
  }
  function level() { if (!analyser || !cur) return 0; analyser.getFloatTimeDomainData(data); let s = 0; for (let i = 0; i < data.length; i++) s += data[i] * data[i]; return Math.sqrt(s / data.length); }
  function voice(name, pri = 1, pan = 0, vol = 1) {
    if (!ac) return false;
    if (cur && pri <= curPri) return false;
    if (cur) { try { cur.stop(); } catch (e) { } }
    const line = LINES[name];
    if (!buf[name]) { // fallback: Web Speech API
      if (window.speechSynthesis && line) { const u = new SpeechSynthesisUtterance(line.t.replace(/[♪♡]/g, '')); u.lang = 'ja-JP'; u.pitch = 1.3; u.rate = 1.05; speechSynthesis.cancel(); speechSynthesis.speak(u); }
      showSub(line ? line.t : ''); return true;
    }
    const s = ac.createBufferSource(); s.buffer = buf[name];
    const g = ac.createGain(); g.gain.value = vol; const p = ac.createStereoPanner(); p.pan.value = clamp(pan, -0.8, 0.8);
    s.connect(g); g.connect(p); p.connect(voiceBus); s.start();
    cur = s; curPri = pri; s.onended = () => { if (cur === s) { cur = null; curPri = 0; } };
    if (line) showSub(line.t, buf[name].duration);
    return true;
  }
  function busy() { return !!cur; }
  function noiseBuf(sec) { const b = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
  let nb = null;
  function noise(dur, f0, f1, q, vol, type = 'lowpass', when = 0) {
    if (!ac) return; nb = nb || noiseBuf(2); const t = ac.currentTime + when;
    const s = ac.createBufferSource(); s.buffer = nb; const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function tone(f0, f1, dur, vol, type = 'sine', when = 0) {
    if (!ac) return; const t = ac.currentTime + when; const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function startAmbience() {
    if (!ac || ambience) return;
    // low drone + wind
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(); o1.frequency.value = 55; o2.frequency.value = 55.7; o1.type = o2.type = 'sawtooth';
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180; const g = ac.createGain(); g.gain.value = 0.05;
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.07; const lg = ac.createGain(); lg.gain.value = 90; lfo.connect(lg); lg.connect(f.frequency);
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(sfxBus); o1.start(); o2.start(); lfo.start();
    nb = nb || noiseBuf(2); const w = ac.createBufferSource(); w.buffer = nb; w.loop = true; const wf = ac.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 400; wf.Q.value = 0.6; const wg = ac.createGain(); wg.gain.value = 0.035; w.connect(wf); wf.connect(wg); wg.connect(sfxBus); w.start();
    ambience = { g };
  }
  function heartbeat(rate, vol) { // called each beat by game loop timing
    tone(70, 40, 0.12, vol, 'sine'); tone(60, 35, 0.12, vol * 0.8, 'sine', 0.18);
  }
  return { init, load, voice, busy, level, noise, tone, startAmbience, heartbeat, get ctx() { return ac; } };
})();
const SFX = {
  step(intensity) { AUD.tone(60, 28, 0.35, 0.5 * intensity, 'sine'); AUD.noise(0.25, 400, 60, 0.7, 0.35 * intensity); },
  slap() { AUD.noise(0.12, 4200, 900, 0.8, 0.9, 'bandpass'); AUD.noise(0.06, 9000, 3000, 0.5, 0.5, 'highpass'); AUD.tone(180, 90, 0.12, 0.35, 'sine'); },
  boing() { AUD.tone(220, 120, 0.35, 0.18, 'sine'); AUD.tone(330, 160, 0.3, 0.08, 'triangle', 0.05); },
  crash(sz, dist) { const v = clamp(1.1 - dist / 80, 0.08, 1) * sz; AUD.noise(1.6, 1800, 80, 0.6, 0.9 * v); AUD.noise(0.5, 3000, 600, 1, 0.5 * v, 'bandpass', 0.05); AUD.tone(50, 25, 0.9, 0.6 * v, 'sine'); for (let i = 0; i < 5; i++) AUD.noise(0.15, rand(1500, 4000), 500, 2, 0.25 * v, 'bandpass', rand(0.1, 0.9)); },
  grow() { AUD.tone(40, 90, 1.6, 0.4, 'sawtooth'); AUD.tone(80, 160, 1.6, 0.15, 'sine'); AUD.noise(1.5, 200, 900, 1, 0.25, 'bandpass'); },
  grab() { AUD.tone(300, 120, 0.4, 0.3, 'triangle'); AUD.noise(0.3, 1200, 200, 1, 0.3); },
  escape() { AUD.tone(200, 600, 0.3, 0.25, 'triangle'); AUD.noise(0.4, 800, 3000, 1, 0.2, 'bandpass'); },
};
const LINES = {
  start1: { t: 'ぽ、ぽ、ぽ…。あら、かわいいぼうや。お姉さんと、鬼ごっこしましょ？' },
  call1: { t: 'ねぇ〜、どこいくのぉ？　お姉さんと遊びましょ♪' }, call2: { t: 'うふふっ、みーつけたっ♪' }, call3: { t: 'ほらほら、もっと早く逃げないと、つかまえちゃうわよぉ？' },
  call4: { t: 'ちっちゃくて、かわいいわねぇ。うふふっ。' }, call5: { t: 'まってぇ〜？　逃げちゃ、いやぁん。' },
  laugh1: { t: 'ぽ、ぽ、ぽ、ぽ……♪' }, laugh2: { t: 'ぽぽぽぽぽっ♪　うふふふっ！' }, laugh3: { t: 'あははっ！　鬼ごっこ、たのしいわねぇ！' },
  irr1: { t: 'むぅ〜……ちょこまかと……！' }, irr2: { t: 'なんで捕まらないのよぉ！　イライラするぅっ！' },
  grow1: { t: 'あぁんもうっ！　イライラして、お腹がふくらんじゃうっ！' }, grow2: { t: '見なさいよ、このお腹！　ぜーんぶ、あなたのせいなんだからっ！' },
  grow3: { t: 'もう許さないっ！　まだまだ大きくなるわよぉっ！' }, grow4: { t: 'ふぅ、ふぅ……！　お腹が、とまらないのぉっ！' },
  smash1: { t: 'どいてよぉっ！　じゃまぁっ！' }, smash2: { t: 'あらぁ、ごめんなさい？　お腹がぶつかっちゃった♪' }, smash3: { t: 'おうちなんて、お腹でぺちゃんこよっ！' },
  catch1: { t: 'つーかまえたっ♡' }, catch2: { t: 'うふふっ、もう、はなさないわよぉ？' }, catch3: { t: 'はぁい、つかまえた♪　いい子ねぇ。' },
  slap1: { t: 'ひゃんっ！' }, slap2: { t: 'あんっ！　お腹、たたかないでぇ！' }, slap3: { t: 'やぁんっ！' }, slap4: { t: 'いたぁいっ！' }, slap5: { t: 'ちょ、ちょっとぉ！　ぷるぷるしちゃうでしょっ！' },
  esc1: { t: 'きゃあっ！　もう〜っ！' }, esc2: { t: 'あぁん……にげられちゃった……。' }, esc3: { t: 'もうっ！　ひどいじゃないっ！　まちなさーいっ！' },
  over1: { t: 'うふふ……これで、ずぅっと、お姉さんと一緒ね♡' },
};
const pick = pre => { const ks = Object.keys(LINES).filter(k => k.startsWith(pre)); return ks[(Math.random() * ks.length) | 0]; };
let subT = null;
function showSub(t, dur = 2.5) { const s = $('sub'); s.textContent = '八尺様「' + t + '」'; s.style.opacity = 1; clearTimeout(subT); subT = setTimeout(() => s.style.opacity = 0, (dur + 0.6) * 1000); }
function hVoice(prefixOrName, pri = 1, exact = false) {
  const n = exact ? prefixOrName : pick(prefixOrName);
  const rel = new THREE.Vector3().subVectors(H.pos, player.pos); const yawRel = Math.atan2(rel.x, rel.z) - player.yaw;
  const pan = -Math.sin(yawRel + Math.PI) ;
  const dist = rel.length(); const vol = clamp(1.25 - dist / 70, 0.45, 1.1);
  return AUD.voice(n, pri, pan * 0.6, vol);
}

// ------------------------------------------------------------ player & input
const player = { pos: new THREE.Vector3(0, 0, 4), yaw: 0, pitch: 0.12, eye: 1.0, bob: 0, speed: 5.6, inv: 0 };
const keys = {};
addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'Space') { e.preventDefault(); slap(); } });
addEventListener('keyup', e => { keys[e.code] = false; });
document.addEventListener('pointerdown', e => { if (game.state === 'grab' && e.button === 0 && !e.target.closest('.stick')) slap(e.clientX, e.clientY); });
// mouse look (optional, desktop): drag on the screen outside the sticks
let mdrag = null;
canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && game.state === 'play') mdrag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointermove', e => { if (mdrag && e.pointerType === 'mouse') { player.yaw -= (e.clientX - mdrag.x) * 0.004; player.pitch = clamp(player.pitch - (e.clientY - mdrag.y) * 0.003, -1.0, 1.35); mdrag.x = e.clientX; mdrag.y = e.clientY; } });
addEventListener('pointerup', e => { if (e.pointerType === 'mouse') mdrag = null; });
// on-screen virtual joysticks (touch & mouse): left = move, right = fast turn
function makeStick(el) {
  const kn = el.querySelector('.knob'); const st = { id: null, x: 0, y: 0 }; const M = 52;
  const upd = e => { const r = el.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const l = Math.hypot(dx, dy); if (l > M) { dx *= M / l; dy *= M / l; } st.x = dx / M; st.y = dy / M; kn.style.transform = `translate(${dx}px,${dy}px)`; };
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (game.state === 'grab') { slap(e.clientX, e.clientY); return; } st.id = e.pointerId; el.setPointerCapture(e.pointerId); upd(e); });
  el.addEventListener('pointermove', e => { if (e.pointerId === st.id) upd(e); });
  const end = e => { if (e.pointerId === st.id) { st.id = null; st.x = st.y = 0; kn.style.transform = ''; } };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
  return st;
}
const stickL = makeStick($('stickL')), stickR = makeStick($('stickR'));
let shake = 0; function addShake(v) { shake = Math.min(1.2, shake + v); }

// ------------------------------------------------------------ game state
const game = { state: 'title', t: 0, catches: 0, grabHits: 0, grabNeed: 10, grabT: 0, nextCall: 6, flowT: 0, lightT: 0, smashCd: 0, heartT: 0, best: +(localStorage.getItem('hs_best') || 0), lastVoiceIrr: 0 };
function banner(text, ms = 2200) { const b = $('banner'); b.innerHTML = text; b.classList.add('show'); clearTimeout(banner.t); banner.t = setTimeout(() => b.classList.remove('show'), ms); }
function fmt(t) { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; }
function resetGame() {
  // rebuild buildings that were destroyed
  for (const b of buildings) { b.alive = true; b.group.visible = true; }
  for (let i = 0; i < MAXD; i++) { deb[i].on = false; _m.makeScale(0, 0, 0); debrisMesh.setMatrixAt(i, _m); } activeDeb.clear(); debrisMesh.instanceMatrix.needsUpdate = true;
  markGridDirty();
  player.pos.set(-HALF + 3 * CELL, 0, -HALF + 3 * CELL + CELL / 2); player.yaw = 0; player.pitch = 0.15; player.inv = 2;
  H.pos.set(player.pos.x, 0, player.pos.z - 42); H.vel.set(0, 0, 0);
  H.stage = 0; H.irr = 0; H.bodyS = H.bodyT = 1; H.bellyS = H.bellyT = 1; H.bellyV = 0; H.state = 'chase'; H.stateT = 0;
  H.expr = { a: 'smile', b: 'smile', m: 1, hold: 0, override: null };
  Object.assign(game, { t: 0, catches: 0, nextCall: 7, smashCd: 0, lastVoiceIrr: 0 });
  player.yaw = Math.atan2(-(H.pos.x - player.pos.x), -(H.pos.z - player.pos.z));
}
function startGame() {
  AUD.init(); AUD.ctx.resume(); AUD.startAmbience();
  $('title').style.display = 'none'; $('over').style.display = 'none';
  resetGame(); game.state = 'play';
  document.body.classList.add('playing');
  setTimeout(() => hVoice('start1', 3, true), 600);
  banner('八尺様から にげて！', 2000);
}
$('startBtn').onclick = startGame; $('retryBtn').onclick = startGame;

function catchPlayer() {
  game.state = 'grab'; H.state = 'grab'; game.catches++;
  game.grabHits = 0; game.grabNeed = Math.min(10 + game.catches + Math.floor(H.stage * 0.7), 24); game.grabT = 7;
  $('grab').style.display = 'block'; document.body.classList.add('grabbing'); $('portrait').classList.add('big');
  setExpr('joy', 1.2); SFX.grab(); hVoice('catch', 3); addShake(0.4); jiggle(0.08, 0.06);
  H.irr = Math.max(0, H.irr - 0.25);
}
function slap(x, y) {
  if (game.state !== 'grab') return;
  game.grabHits++; SFX.slap(); if (Math.random() < 0.5) SFX.boing();
  jiggle(rand(0.05, 0.09) * (Math.random() < 0.5 ? 1 : -1), 0.14); bellyMat.uniforms.uFlash.value = 1;
  setExpr('pain', 0.45);
  if (!AUD.busy() && Math.random() < 0.6) hVoice('slap', 2);
  const h = $('hand'); h.animate([{ transform: 'rotate(35deg) translateY(40px)' }, { transform: 'rotate(-20deg) translateY(-60px)' }, { transform: 'rotate(25deg)' }], { duration: 160 });
  const p = document.createElement('div'); p.className = 'pop'; p.textContent = ['ペチン！', 'ぽよん！', 'パァン！', 'ぷるん！', 'ペシッ！'][(Math.random() * 5) | 0];
  p.style.left = (x ?? innerWidth / 2 + rand(-120, 120)) + 'px'; p.style.top = (y ?? innerHeight * 0.55 + rand(-80, 80)) + 'px'; document.body.appendChild(p); setTimeout(() => p.remove(), 650);
  addShake(0.08);
  if (game.grabHits >= game.grabNeed) escape();
}
function escape() {
  game.state = 'play'; $('grab').style.display = 'none'; document.body.classList.remove('grabbing'); $('portrait').classList.remove('big');
  H.state = 'stun'; H.stateT = 2.6; player.inv = 3.2;
  const dir = new THREE.Vector3().subVectors(H.pos, player.pos).setY(0).normalize();
  H.vel.copy(dir).multiplyScalar(14);
  jiggle(0.16, 0.25); SFX.escape(); setExpr('pain', 1.0);
  setTimeout(() => { AUD.busy() || true; hVoice('esc', 3); }, 150);
  banner('脱出成功！ にげて！', 1500);
}
function gameOver() {
  game.state = 'over'; $('grab').style.display = 'none'; document.body.classList.remove('grabbing'); $('portrait').classList.remove('big');
  document.body.classList.remove('playing'); setExpr('joy', 99); hVoice('over1', 9, true);
  const best = Math.max(game.best, game.t); const nb = game.t >= game.best && game.t > 0; game.best = best; localStorage.setItem('hs_best', best.toFixed(1));
  $('overText').innerHTML = `逃げ切った時間：<b style="font-size:26px">${fmt(game.t)}</b>${nb ? ' 🎉 新記録！' : ''}<br>お腹レベル：${H.stage + 1}　／　ベスト：${fmt(best)}<br><span style="opacity:.75">お腹の中…じゃなくて、お腹にぎゅ〜っと抱きしめられてしまった。</span>`;
  setTimeout(() => $('over').style.display = 'flex', 1400);
}
function jiggle(vy, sq) { H.jig.vy += vy * 18; H.jig.vx += sq * 14; H.jig.rip = Math.min(1.5, H.jig.rip + sq * 4); }
function stageUp() {
  H.stage++; H.irr = 0; H.state = 'grow'; H.stateT = 2.4;
  H.bellyT = 1 + 0.32 * H.stage; H.bodyT = 1 + 0.12 * H.stage;
  setExpr('angry', 2.6); SFX.grow(); addShake(0.6);
  hVoice(H.stage === 1 ? 'grow1' : pick('grow'), 4, true);
  banner(`💢 お腹レベル ${H.stage + 1}！<br><span style="font-size:20px">八尺様のお腹がさらに大きくなった！${H.stage >= 1 ? '（建物もこわせる）' : ''}</span>`, 2600);
}

// ------------------------------------------------------------ update loop
const clock = new THREE.Clock(); let time = 0;
const fwd = new THREE.Vector3(), right = new THREE.Vector3();
function updatePlayer(dt) {
  let mx = 0, mz = 0;
  if (keys.KeyW || keys.ArrowUp) mz += 1; if (keys.KeyS || keys.ArrowDown) mz -= 1;
  if (keys.KeyA) mx -= 1; if (keys.KeyD) mx += 1;
  if (keys.ArrowLeft) player.yaw += 2.4 * dt; if (keys.ArrowRight) player.yaw -= 2.4 * dt;
  if (keys.KeyQ) player.pitch = clamp(player.pitch + 1.5 * dt, -1, 1.35); if (keys.KeyE) player.pitch = clamp(player.pitch - 1.5 * dt, -1, 1.35);
  if (stickL.id !== null) { mx += stickL.x; mz -= stickL.y; }
  if (stickR.id !== null) { // fast turn: response curve, up to ~4.2 rad/s
    const tx = Math.sign(stickR.x) * Math.pow(Math.abs(stickR.x), 1.5), ty = Math.sign(stickR.y) * Math.pow(Math.abs(stickR.y), 1.5);
    player.yaw -= tx * 4.2 * dt; player.pitch = clamp(player.pitch - ty * 1.8 * dt, -1.0, 1.35);
  }
  const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
  fwd.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)); right.set(-fwd.z, 0, fwd.x);
  const sp = player.speed * (game.state === 'play' ? 1 : 0);
  player.pos.addScaledVector(fwd, mz * sp * dt).addScaledVector(right, mx * sp * dt);
  collideCircle(player.pos, 0.32);
  const moving = Math.hypot(mx, mz) > 0.1 && game.state === 'play';
  player.bob += dt * (moving ? 11 : 0);
  player.inv = Math.max(0, player.inv - dt);
}
function updateHasshaku(dt) {
  const R = bellyRadius();
  const to = new THREE.Vector3().subVectors(player.pos, H.pos).setY(0); const dist = to.length(); to.normalize();
  let want = 0;
  if (H.state === 'chase') {
    const vmax = player.speed * 0.65;              // never faster than 65% of the player
    want = Math.min(player.speed * 0.5 + 0.1 * H.stage, vmax);
    if (dist < R + 5) want = Math.min(want * 1.15, vmax); // slight lunge, still capped
    let target = player.pos;
    if (H.stage === 0) { // small belly: follow the streets (flow field)
      game.flowT -= dt; if (game.flowT <= 0) { computeFlow(player.pos.x, player.pos.z); game.flowT = 0.35; }
      if (dist > 9) { const ft = flowTarget(H.pos.x, H.pos.z); if (ft) target = new THREE.Vector3(ft.x, 0, ft.z); }
    }
    const dir = new THREE.Vector3().subVectors(target, H.pos).setY(0).normalize();
    H.vel.lerp(dir.multiplyScalar(want), 1 - Math.exp(-dt * 2.5));
    const hv = Math.hypot(H.vel.x, H.vel.z), cap = player.speed * 0.65; if (hv > cap) H.vel.multiplyScalar(cap / hv);
    // irritation grows when she can't catch the player
    H.irr += dt * (0.05 + 0.006 * H.stage + (dist > 30 ? 0.03 : 0));
    if (H.irr >= 1) stageUp();
    else if (H.irr > 0.55 && game.lastVoiceIrr !== H.stage) { game.lastVoiceIrr = H.stage; hVoice('irr', 2); setExpr('irritated', 1.5); }
    if (dist < R * 0.92 + 0.9 && player.inv <= 0 && game.state === 'play') catchPlayer();
  } else if (H.state === 'grow' || H.state === 'stun') {
    H.vel.multiplyScalar(Math.exp(-dt * 3)); H.stateT -= dt; if (H.stateT <= 0) H.state = 'chase';
  } else if (H.state === 'grab') {
    H.vel.set(0, 0, 0);
  }
  H.pos.addScaledVector(H.vel, dt);
  // collisions with the town
  if (H.stage === 0) collideCircle(H.pos, 1.3, true, true);
  else {
    for (const b of buildings) { if (!b.alive) continue; const bx = b.box; const qx = clamp(H.pos.x, bx.x0, bx.x1), qz = clamp(H.pos.z, bx.z0, bx.z1); if ((H.pos.x - qx) ** 2 + (H.pos.z - qz) ** 2 < R * R) { destroyBuilding(b, H.pos); jiggle(0.04, 0.08); if (game.smashCd <= 0 && !b.small) { game.smashCd = 7; hVoice('smash', 2); } } }
    H.pos.x = clamp(H.pos.x, -HALF + 1, HALF - 1); H.pos.z = clamp(H.pos.z, -HALF + 1, HALF - 1);
  }
  // small belly still knocks over lamps & vending machines
  if (H.stage === 0) for (const b of buildings) { if (b.alive && b.small) { const qx = clamp(H.pos.x, b.box.x0, b.box.x1), qz = clamp(H.pos.z, b.box.z0, b.box.z1); if ((H.pos.x - qx) ** 2 + (H.pos.z - qz) ** 2 < R * R * 0.8) destroyBuilding(b, H.pos); } }
  game.smashCd -= dt;
  // gait
  H.speed = Math.hypot(H.vel.x, H.vel.z);
  H.walk = lerp(H.walk, clamp(H.speed / 3, 0, 1), 1 - Math.exp(-dt * 4));
  const stride = 1.5 * H.bodyS;
  const prev = H.phase; H.phase += dt * Math.max(H.speed, 0.0) / stride * Math.PI;
  if (Math.floor(prev / Math.PI) !== Math.floor(H.phase / Math.PI) && H.walk > 0.2) { // footfall
    const d = dist; const it = clamp((1.4 - d / 45) * (0.6 + H.stage * 0.12), 0.05, 1.6);
    SFX.step(Math.min(it, 1)); addShake(0.12 * it); jiggle(0.03 + 0.006 * H.stage, 0.035); puff(H.pos.x, 0.2, H.pos.z, 2, R * 0.6);
  }
  // growth springs
  H.bellyV += ((H.bellyT - H.bellyS) * 30 - H.bellyV * 5) * dt; H.bellyS += H.bellyV * dt;
  H.bodyS = lerp(H.bodyS, H.bodyT, 1 - Math.exp(-dt * 2));
  // belly jiggle spring (bigger belly = slower, heavier wobble)
  const k = 70 / Math.sqrt(H.bellyS * H.bodyS), c = 3.2;
  const J = H.jig; J.vy += (-J.y * k - J.vy * c) * dt; J.y += J.vy * dt; J.vx += (-J.x * k - J.vx * c) * dt; J.x += J.vx * dt; J.rip *= Math.exp(-dt * 2.2);
  J.y = clamp(J.y, -0.12, 0.12); J.x = clamp(J.x, -0.2, 0.2);
  // expression by mood
  const mood = H.stage + H.irr;
  if (H.state === 'chase') setExpr(mood < 0.55 ? 'smile' : mood < 2.6 ? 'irritated' : 'angry');
  if (H.state === 'stun') setExpr('irritated');
  // calls
  game.nextCall -= dt;
  if (game.nextCall <= 0 && H.state === 'chase') { game.nextCall = rand(7, 12); if (!AUD.busy()) { const p = H.stage === 0 ? (Math.random() < 0.6 ? 'call' : 'laugh') : (Math.random() < 0.5 ? 'irr' : Math.random() < 0.5 ? 'laugh' : 'call'); if (hVoice(p, 1) && p === 'laugh') setExpr('joy', 1.6); } }
  // apply to scene
  const S = H.height * H.bodyS;
  const bob = Math.abs(Math.sin(H.phase)) * 0.012 * H.walk;
  H.group.position.set(H.pos.x, bob * S - 0.0, H.pos.z);
  H.group.scale.setScalar(S);
  H.group.rotation.y = Math.atan2(camera.position.x - H.pos.x, camera.position.z - H.pos.z);
  H.group.rotation.z = Math.sin(H.phase) * 0.012 * H.walk;
  { // lift belly + upper body so a huge belly rests on the ground instead of sinking into it
    const pv = bellyMat.uniforms.uPivot.value.y, bh = bellyMat.uniforms.uBH.value;
    const bottom = pv - bh * (1 + (H.bellyS - 1) * 0.72); const lift = Math.max(0, 0.05 - bottom) * 0.9;
    bellyMat.uniforms.uLift.value = lift; H.upperG.position.y = pv + lift;
  }
  H.upperG.rotation.z = Math.sin(H.phase - 0.5) * 0.02 * H.walk + Math.sin(time * 0.9) * 0.006;
  bodyMat.uniforms.uPhase.value = H.phase; bodyMat.uniforms.uWalk.value = H.walk; bodyMat.uniforms.uTime.value = time;
  const bu = bellyMat.uniforms; bu.uScale.value = H.bellyS; bu.uJigY.value = J.y; bu.uJigX.value = J.x; bu.uRip.value = J.rip; bu.uGround.value = -bob;
  bu.uFlash.value *= Math.exp(-dt * 10);
  upperMat.uniforms.uBreath.value = Math.sin(time * 1.6);
  // angry tint when irritated
  const red = clamp(mood / 6, 0, 0.35); [bodyMat, bellyMat, upperMat, faceMat].forEach(m => m.uniforms.uTint.value.setRGB(1 + red * 0.25, 1 - red * 0.35, 1 - red * 0.35));
  shadowMesh.position.set(H.pos.x, 0.05, H.pos.z); shadowMesh.scale.setScalar(R * 2.6);
  // anger mark
  const am = angerSprite.material; am.opacity = lerp(am.opacity, mood > 0.6 ? 1 : 0, 1 - Math.exp(-dt * 4));
  const camRight = new THREE.Vector3(Math.cos(H.group.rotation.y), 0, -Math.sin(H.group.rotation.y));
  angerSprite.position.copy(H.pos).addScaledVector(camRight, 0.17 * S).setY(S * 0.95);
  const pulse = 1 + 0.15 * Math.sin(time * 9); angerSprite.scale.setScalar(S * 0.07 * pulse);
  updateFace(dt);
}
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  shake *= Math.exp(-dt * 5);
  const sx = (Math.random() - 0.5) * shake * 0.25, sy = (Math.random() - 0.5) * shake * 0.25;
  if (game.state === 'grab' || (game.state === 'over')) {
    // pressed against her belly, looking up at her
    const R = bellyRadius();
    const dir = new THREE.Vector3().subVectors(player.pos, H.pos).setY(0).normalize();
    const want = H.pos.clone().addScaledVector(dir, R * 0.55 + 0.9); want.y = player.eye;
    camera.position.lerp(want, 1 - Math.exp(-dt * 6));
    player.pos.x = camera.position.x; player.pos.z = camera.position.z;
    const S = H.height * H.bodyS;
    camTarget.set(H.pos.x, Math.min(S * 0.45, 3 + R * 0.4), H.pos.z);
    camera.lookAt(camTarget); camera.rotateX(sy); camera.rotateY(sx);
    player.yaw = Math.atan2(-(H.pos.x - player.pos.x), -(H.pos.z - player.pos.z));
    player.pitch = Math.atan2(camTarget.y - player.eye, R);
    return;
  }
  const bobY = Math.sin(player.bob) * 0.04, bobX = Math.cos(player.bob * 0.5) * 0.025;
  camera.position.set(player.pos.x + bobX * Math.cos(player.yaw), player.eye + bobY + sy, player.pos.z - bobX * Math.sin(player.yaw));
  camera.rotation.set(0, 0, 0, 'YXZ'); camera.rotation.order = 'YXZ';
  camera.rotation.y = player.yaw + sx * 0.3; camera.rotation.x = player.pitch + sy * 0.3; camera.rotation.z = sx * 0.2;
}
// HUD: portrait (face from the original art + current expression) and radar
const pc = $('pc').getContext('2d'), rc = $('radar').getContext('2d');
function drawPortrait() {
  const [fx0, fy0, fx1, fy1] = META.face; const cx = (fx0 + fx1) / 2, cy = (fy0 + fy1) / 2 + 4; const w = 104, h = 76;
  const sx = cx - w / 2, sy = cy - h / 2; const W = pc.canvas.width, Hh = pc.canvas.height;
  pc.fillStyle = '#0c1226'; pc.fillRect(0, 0, W, Hh);
  pc.drawImage(IMG.upper, sx, sy, w, h, 0, 0, W, Hh);
  const X = H.expr; const sm = X.m * X.m * (3 - 2 * X.m); const k = W / w;
  const dx = (fx0 - sx) * k, dy = (fy0 - sy) * k, dw = (fx1 - fx0) * k, dh = (fy1 - fy0) * k;
  const lay = (name, a) => { if (a > 0.01) { pc.globalAlpha = a; pc.drawImage(IMG['face_' + name], dx, dy, dw, dh); } };
  const t = H.talk;
  lay(X.a, (1 - sm) * (1 - t)); lay(X.a + '_talk', (1 - sm) * t); lay(X.b, sm * (1 - t)); lay(X.b + '_talk', sm * t);
  const bl = faceMat.uniforms.uBlink.value; if (bl > 0.01) lay(X.b === 'irritated' ? 'irritated_blink' : 'blink', bl);
  pc.globalAlpha = 1;
  const red = clamp((H.stage + H.irr) / 6, 0, 0.35); if (red > 0) { pc.fillStyle = `rgba(255,0,40,${red * 0.35})`; pc.fillRect(0, 0, W, Hh); }
}
function drawRadar() {
  const W = rc.canvas.width, c = W / 2, sc = c / 60; rc.clearRect(0, 0, W, W);
  rc.strokeStyle = '#fff3'; rc.lineWidth = 2; rc.beginPath(); rc.arc(c, c, c * 0.5, 0, Math.PI * 2); rc.stroke();
  const rel = new THREE.Vector3().subVectors(H.pos, player.pos);
  const ang = Math.atan2(rel.x, rel.z) - Math.atan2(-Math.sin(player.yaw), -Math.cos(player.yaw));
  const d = Math.min(rel.length(), 58) * sc; const x = c + Math.sin(ang) * d, y = c - Math.cos(ang) * d;
  rc.fillStyle = `rgba(255,40,80,${0.6 + 0.4 * Math.sin(time * 8)})`; rc.beginPath(); rc.arc(x, y, clamp(bellyRadius() * sc, 7, c * 0.8), 0, Math.PI * 2); rc.fill();
  rc.fillStyle = '#fff'; rc.beginPath(); rc.moveTo(c, c - 9); rc.lineTo(c - 6, c + 6); rc.lineTo(c + 6, c + 6); rc.fill();
}
function updateHUD() {
  $('time').textContent = fmt(game.t);
  $('stage').textContent = `お腹レベル ${H.stage + 1}`;
  $('irr').style.width = (H.irr * 100).toFixed(1) + '%';
  const dist = Math.hypot(H.pos.x - player.pos.x, H.pos.z - player.pos.z) - bellyRadius();
  $('vign').style.opacity = clamp(1 - dist / 14, 0, 1) * (game.state === 'play' ? 1 : 0.6);
  if (game.state === 'grab') { $('grabFill').style.width = (game.grabHits / game.grabNeed * 100) + '%'; $('grabTl').textContent = `連打！ ${game.grabHits} / ${game.grabNeed}　（のこり ${game.grabT.toFixed(1)} 秒）`; }
  drawPortrait(); drawRadar();
}
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05); time += dt;
  if (game.state === 'play' || game.state === 'grab') {
    if (game.state === 'play') game.t += dt;
    updatePlayer(dt); updateHasshaku(dt);
    if (game.state === 'grab') { game.grabT -= dt; if (game.grabT <= 0) gameOver(); }
    // heartbeat when close
    const d = Math.hypot(H.pos.x - player.pos.x, H.pos.z - player.pos.z) - bellyRadius();
    game.heartT -= dt; if (d < 25 && game.heartT <= 0) { AUD.heartbeat(0, clamp(0.5 - d / 50, 0.05, 0.5)); game.heartT = clamp(d / 25, 0.35, 1.0); }
    game.lightT -= dt; if (game.lightT <= 0) { updateLights(player.pos); game.lightT = 0.5; }
  } else if (game.state === 'over') {
    updateHasshaku(dt);
  } else { // title: idle camera orbit
    const a = time * 0.08; player.pos.set(Math.sin(a) * 14, 0, Math.cos(a) * 14 + H.pos.z + 26); player.yaw = Math.atan2(-(H.pos.x - player.pos.x), -(H.pos.z - player.pos.z)); player.pitch = 0.32;
    H.vel.set(0, 0, 0); updateHasshaku(dt); H.state = 'idle';
    game.lightT -= dt; if (game.lightT <= 0) { updateLights(player.pos); game.lightT = 0.5; }
  }
  updateDebris(dt); updateDust(dt); updateCamera(dt); updateHUD();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

// ------------------------------------------------------------ boot
(async () => {
  const total = imgList.length + Object.keys(LINES).length; let done = 0;
  const prog = () => { done++; $('loading').textContent = `読み込み中… ${Math.round(done / total * 100)}%`; };
  await Promise.all(imgList.map(async n => { const url = `assets/img/${n}.png`; IMG[n] = await loadImg(url); TEX[n] = await loadTex(url); prog(); }));
  buildHasshaku();
  resetGame(); H.pos.set(0, 0, -HALF + 3 * CELL + CELL / 2 - 10 + 0); H.pos.x = -HALF + 3 * CELL;
  AUD.init();
  await AUD.load(Object.keys(LINES), prog);
  $('loading').textContent = '';
  const b = $('startBtn'); b.disabled = false; b.textContent = 'にげる！';
  window.__ready = true;
  loop();
})();
// debug hooks for automated testing
window.__dbg = { game, H, player, stageUp, catchPlayer, slap, startGame, buildings };
