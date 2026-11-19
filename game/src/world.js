// world.js — builds the whole city into one scene group: sunset sky,
// road grid, sidewalks, instanced palms, buildings with lit facades,
// billboards, beach and sea. Also owns the collision data every other
// module shares: a flat list of AABBs plus circle push-out helpers.
import * as THREE from 'three';
import { CITY, PALETTE, SUNSET, NAMES, SPAWN } from './config.js';
import { asphaltTexture, facadeTexture, skyTexture, radialGlowTexture,
  streakTexture, frondTexture, billboardTexture, signTexture } from './textures.js';
import { clamp } from './random.js';

const WAYPOINT_CLEAR = [[150, 150], [-140, -140], [140, -140], [-150, 150],
  [0, 210], [-150, -150], [SPAWN.x, SPAWN.z]];
// True when the building AABB (centre x,z, size w,d) would intrude into
// the clear disc of radius r around any mission waypoint or the spawn —
// the approach corridor into a waypoint disc must stay physically open.
function intrudesWaypoint(x, z, w, d, r) {
  return WAYPOINT_CLEAR.some(([wx, wz]) => {
    const dx = Math.max(Math.abs(wx - x) - w / 2, 0);
    const dz = Math.max(Math.abs(wz - z) - d / 2, 0);
    return Math.hypot(dx, dz) < r;
  });
}
// Concatenate several geometries into one non-indexed BufferGeometry.
function mergeGeoms(geoms) {
  let total = 0;
  const parts = geoms.map((g) => { const n = g.toNonIndexed(); total += n.attributes.position.count; return n; });
  const pos = new Float32Array(total * 3); const nor = new Float32Array(total * 3); const uv = new Float32Array(total * 2);
  let o3 = 0; let o2 = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o3);
    nor.set(g.attributes.normal.array, o3);
    uv.set(g.attributes.uv.array, o2);
    o3 += g.attributes.position.count * 3; o2 += g.attributes.position.count * 2;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}
function frondCrownGeometry() {
  const parts = [];
  for (let i = 0; i < 9; i += 1) {
    const p = new THREE.PlaneGeometry(1.5, 3.4, 1, 3);
    const pa = p.attributes.position;
    for (let v = 0; v < pa.count; v += 1) { // bend the tip downward
      const y = pa.getY(v); const t = (y + 1.7) / 3.4;
      pa.setZ(v, -Math.pow(t, 2) * 1.5);
    }
    p.translate(0, 1.2, 1.1);
    const m = new THREE.Matrix4().makeRotationY((i / 9) * Math.PI * 2);
    m.multiply(new THREE.Matrix4().makeRotationX(-0.5));
    p.applyMatrix4(m);
    parts.push(p);
  }
  return mergeGeoms(parts);
}

export function createWorld(scene, rng) {
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];
  const addCollider = (x, z, w, d) => {
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  };
  // ---- sky, fog, lights ----
  scene.fog = new THREE.FogExp2(SUNSET.fog, SUNSET.fogDensity);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false }));
  group.add(sky);
  const glowTex = radialGlowTexture('rgba(255,214,150,1)');
  const sunDir = new THREE.Vector3(...SUNSET.sunPos).normalize();
  for (const [scale, op] of [[720, 0.42], [400, 0.68], [180, 0.9]]) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    s.position.copy(sunDir).multiplyScalar(820); s.scale.setScalar(scale);
    group.add(s);
  }
  const sun = new THREE.DirectionalLight(SUNSET.sunColor, SUNSET.sunIntensity);
  sun.position.set(...SUNSET.sunPos); scene.add(sun);
  scene.add(new THREE.HemisphereLight(SUNSET.hemiSky, SUNSET.hemiGround, SUNSET.hemiIntensity));
  scene.add(new THREE.AmbientLight(SUNSET.ambColor, SUNSET.ambIntensity));
  for (let i = 0; i < 6; i += 1) { // dusk-tinted flat clouds
    const c = new THREE.Mesh(new THREE.PlaneGeometry(rng.range(90, 170), rng.range(18, 30)),
      new THREE.MeshBasicMaterial({ color: 0xffc4b8, transparent: true, opacity: 0.38, fog: false, depthWrite: false }));
    c.rotation.x = -Math.PI / 2;
    c.position.set(rng.range(-500, 500), rng.range(120, 170), rng.range(-400, 400));
    group.add(c);
  }
  // ---- ground, beach, sea ----
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; group.add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(560, CITY.seaZ - CITY.beachZ + 8),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.0, (CITY.beachZ + CITY.seaZ) / 2 + 2); group.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 320),
    new THREE.MeshPhongMaterial({ color: PALETTE.sea, shininess: 90, specular: 0xff9ec6, transparent: true, opacity: 0.94 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.02, CITY.seaZ + 150); group.add(sea);
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(560, 1.6),
    new THREE.MeshBasicMaterial({ color: 0xffe9f2, transparent: true, opacity: 0.7 }));
  foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.06, CITY.seaZ); group.add(foam);
  // ---- roads & sidewalks ----
  const asphalt = asphaltTexture();
  const roadMatV = new THREE.MeshPhongMaterial({ color: PALETTE.asphalt, map: asphalt, shininess: 110, specular: 0xe8a0b4 });
  roadMatV.map = asphalt.clone(); roadMatV.map.repeat.set(1, 30); roadMatV.map.needsUpdate = true;
  const roadMatH = roadMatV.clone();
  roadMatH.map = asphalt.clone(); roadMatH.map.repeat.set(30, 1); roadMatH.map.needsUpdate = true;
  const walkMat = new THREE.MeshPhongMaterial({ color: PALETTE.sidewalk, shininess: 40, specular: 0x886655 });
  const roadLen = CITY.extent * 2 + 60;
  for (const c of CITY.roadCentres) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadWidth, roadLen), roadMatV);
    v.rotation.x = -Math.PI / 2; v.position.set(c, 0.08, 10); group.add(v);
    const hz = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, CITY.roadWidth), roadMatH);
    hz.rotation.x = -Math.PI / 2; hz.position.set(0, 0.08, c); group.add(hz);
    for (const s of [-1, 1]) { // sidewalks hug both edges of every road
      const wv = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, roadLen), walkMat);
      wv.position.set(c + s * (CITY.roadWidth / 2 + 1.1), 0.07, 10); group.add(wv);
      const wh = new THREE.Mesh(new THREE.BoxGeometry(roadLen, 0.14, 2.2), walkMat);
      wh.position.set(0, 0.07, c + s * (CITY.roadWidth / 2 + 1.1)); group.add(wh);
    }
  }
  // Centre dashes, instanced.
  {
    const dashGeo = new THREE.PlaneGeometry(0.35, 2.6);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xffd76a });
    const spots = [];
    for (const c of CITY.roadCentres) {
      for (let t = -CITY.extent; t <= CITY.extent + 30; t += 7) { spots.push([c, t, 0]); spots.push([t, c, 1]); }
    }
    const inst = new THREE.InstancedMesh(dashGeo, dashMat, spots.length);
    const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion();
    const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    spots.forEach(([x, z, horiz], i) => {
      q.copy(flat);
      if (horiz) q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)));
      m4.compose(new THREE.Vector3(x, 0.1, z), q, new THREE.Vector3(1, 1, 1));
      inst.setMatrixAt(i, m4);
    });
    group.add(inst);
  }
  // Wet-look streaks & washes on the hero roads, puddles on top.
  const streakTex = streakTexture();
  const addStreak = (x, z, color, len, wdt, op, rotY = 0) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(wdt, len),
      new THREE.MeshBasicMaterial({ map: streakTex, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
    p.rotation.x = -Math.PI / 2; p.rotation.z = rotY; p.position.set(x, 0.09, z); group.add(p);
  };
  const washColors = [0xff9a5c, 0xff6b9d, 0x53d8e8, 0xe879f9];
  let wi = 0;
  for (let t = -168; t <= 168; t += 24) {
    addStreak(-2.8, t, washColors[wi++ % 4], 20, 3.4, 0.13);
    addStreak(2.8, t + 12, washColors[wi++ % 4], 20, 3.4, 0.13);
    addStreak(t, 165.2, washColors[wi++ % 4], 3.4, 20, 0.13, Math.PI / 2);
    addStreak(t + 12, -2.8, washColors[wi++ % 4], 3.4, 20, 0.11, Math.PI / 2);
  }
  const puddleMat = new THREE.MeshPhongMaterial({ color: 0x1c1626, shininess: 120, specular: 0xff9ec6, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 12; i += 1) {
    const onBoulevard = i % 2 === 0;
    const p = new THREE.Mesh(new THREE.CircleGeometry(1, 18), puddleMat);
    p.rotation.x = -Math.PI / 2;
    p.scale.set(rng.range(1.6, 3.2), rng.range(3.5, 6), 1);
    p.position.set(onBoulevard ? rng.range(-5, 5) : rng.range(-160, 160), 0.095,
      onBoulevard ? rng.range(-40, 190) : 168 + rng.range(-4, 4));
    group.add(p);
  }
  // ---- buildings ----
  const facadeBases = ['#8a6a58', '#7a5a6e', '#6e6258', '#94755f', '#5f6e7a', '#86647e'];
  const signBgs = ['#3b1050', '#0d2b45', '#4a0f2e', '#083038'];
  const signFgs = ['#ffb3d9', '#aee6ff', '#ffd9a0', '#b0ffe9'];
  let shopIdx = 0;
  const edges = [-CITY.extent, ...CITY.roadCentres, CITY.extent];
  for (let bi = 0; bi < edges.length - 1; bi += 1) {
    for (let bj = 0; bj < edges.length - 1; bj += 1) {
      const x0 = edges[bi] + CITY.roadWidth / 2 + 2.4; const x1 = edges[bi + 1] - CITY.roadWidth / 2 - 2.4;
      const z0 = edges[bj] + CITY.roadWidth / 2 + 2.4; const z1 = edges[bj + 1] - CITY.roadWidth / 2 - 2.4;
      if (x1 - x0 < 14 || z1 - z0 < 14) continue;
      // One main tower per block, centred, so every side keeps a
      // wide drivable margin of open ground plus sidewalk; sometimes
      // a smaller annex stands in one corner. A block is a place
      // with lanes around its towers, not a solid wall of boxes.
      const bcx = (x0 + x1) / 2; const bcz = (z0 + z1) / 2;
      const placements = [{ x: bcx, z: bcz, w: rng.range(15, 23), d: rng.range(15, 23) }];
      if (rng.chance(0.45)) {
        placements.push({
          x: bcx + rng.pick([-1, 1]) * rng.range(9, 12), z: bcz + rng.pick([-1, 1]) * rng.range(9, 12),
          w: rng.range(8, 11), d: rng.range(8, 11),
        });
      }
      for (const P of placements) {
        const w = P.w; const d = P.d;
        const x = P.x; const z = P.z;
        if (intrudesWaypoint(x, z, w, d, 12)) continue;
        const hgt = rng.range(9, 34);
        const tex = facadeTexture(rng.pick(facadeBases), rng.int(1, 99999));
        const side = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xff9a3c, emissiveMap: tex, emissiveIntensity: 0.30 });
        const top = new THREE.MeshLambertMaterial({ color: 0x4a3550 });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), [side, side, top, top, side, side]);
        b.position.set(x, hgt / 2, z); group.add(b);
        addCollider(x, z, w, d);
        if (rng.chance(0.4)) { // lit ground-floor shop sign facing the nearest road
          const sTex = signTexture(NAMES.shops[shopIdx % NAMES.shops.length],
            signBgs[shopIdx % 4], signFgs[shopIdx % 4]); shopIdx += 1;
          const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(9, w - 2), 2),
            new THREE.MeshBasicMaterial({ map: sTex }));
          const faceSouth = Math.abs(z - z1) < Math.abs(z - z0);
          sign.position.set(x, 3.1, faceSouth ? z + d / 2 + 0.06 : z - d / 2 - 0.06);
          if (!faceSouth) sign.rotation.y = Math.PI;
          group.add(sign);
        }
      }
    }
  }
  // ---- palms (instanced trunk + crown, one collider list) ----
  const palmSpots = [];
  for (let z = 56; z <= 190; z += 9) { palmSpots.push({ x: -9.6, z, lean: 0.13 }); palmSpots.push({ x: 9.6, z, lean: -0.13 }); }
  for (let x = -160; x <= 160; x += 11) { palmSpots.push({ x, z: 158.4, lean: 0 }); palmSpots.push({ x: x + 5, z: 181, lean: 0 }); }
  for (let i = 0; i < 26; i += 1) {
    const c = rng.pick(CITY.roadCentres); const t = rng.range(-185, 185);
    palmSpots.push(rng.chance(0.5) ? { x: c + 8.6, z: t, lean: 0 } : { x: t, z: c + 8.6, lean: 0 });
  }
  // The spawn forecourt stays palm-free in a 20 m radius: Luz's first
  // car sits in a small plaza, not in a pocket fenced by trunks.
  for (let i = palmSpots.length - 1; i >= 0; i -= 1) {
    if (Math.hypot(palmSpots[i].x - SPAWN.x, palmSpots[i].z - SPAWN.z) < 20) palmSpots.splice(i, 1);
  }
  {
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 5.6, 6);
    trunkGeo.translate(0, 2.8, 0);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
    const crownMat = new THREE.MeshLambertMaterial({ map: frondTexture(), alphaTest: 0.45, side: THREE.DoubleSide });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
    const crowns = new THREE.InstancedMesh(frondCrownGeometry(), crownMat, palmSpots.length);
    const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler();
    palmSpots.forEach((p, i) => {
      e.set(0, rng.range(0, Math.PI * 2), p.lean || 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(1, 1, 1));
      trunks.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(p.x - Math.sin(p.lean || 0) * 5.4, 5.6, p.z), q, new THREE.Vector3(1.15, 1.15, 1.15));
      crowns.setMatrixAt(i, m4);
      addCollider(p.x, p.z, 0.5, 0.5);
    });
    group.add(trunks); group.add(crowns);
  }
  // ---- street lamps at intersections ----
  {
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.09, 5.4, 5);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
    const spots = [];
    for (const cx of CITY.roadCentres) for (const cz of CITY.roadCentres) {
      spots.push([cx + 8.4, cz + 8.4]); spots.push([cx - 8.4, cz - 8.4]);
    }
    const inst = new THREE.InstancedMesh(poleGeo, poleMat, spots.length);
    const m4 = new THREE.Matrix4();
    spots.forEach(([x, z], i) => {
      m4.makeTranslation(x, 2.7, z); inst.setMatrixAt(i, m4);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc98a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      gl.position.set(x, 5.5, z); gl.scale.setScalar(3.4); group.add(gl);
      addCollider(x, z, 0.36, 0.36);
    });
    group.add(inst);
  }
  // ---- billboards (two-sided) + HOTEL MIRAMAR ----
  const bbSpots = [
    { x: -17, z: 122, rotY: Math.PI }, { x: 17, z: 96, rotY: Math.PI },
    { x: -60, z: 178, rotY: 0 }, { x: 84, z: 178, rotY: 0 },
    { x: -64, z: -12, rotY: Math.PI / 2 }, { x: 64, z: 12, rotY: -Math.PI / 2 },
  ];
  bbSpots.forEach((s, i) => {
    const def = NAMES.billboards[i % NAMES.billboards.length];
    const tex = billboardTexture(def.lines, def.bg, def.fg);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 9, 6),
      new THREE.MeshLambertMaterial({ color: 0x2c2f38 }));
    pole.position.set(s.x, 4.5, s.z); group.add(pole);
    const face = new THREE.MeshBasicMaterial({ map: tex });
    const back = new THREE.MeshBasicMaterial({ map: tex, color: 0x9a8a96 });
    const frame = new THREE.MeshLambertMaterial({ color: 0x241f2c });
    const board = new THREE.Mesh(new THREE.BoxGeometry(13, 6.4, 0.4), [frame, frame, frame, frame, face, back]);
    board.position.set(s.x, 11, s.z); board.rotation.y = s.rotY; group.add(board);
    addCollider(s.x, s.z, 0.8, 0.8);
    addStreak(s.x, s.z + (i < 2 ? -8 : 8), 0xff6b9d, 16, 5, 0.16);
  });
  { // HOTEL MIRAMAR: a real building by the beach road with its name lit up
    const tex = facadeTexture('#7a5a6e', 777);
    const side = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xff9a3c, emissiveMap: tex, emissiveIntensity: 0.3 });
    const hotel = new THREE.Mesh(new THREE.BoxGeometry(22, 26, 14),
      [side, side, new THREE.MeshLambertMaterial({ color: 0x4a3550 }), side, side, side]);
    hotel.position.set(34, 13, 188); group.add(hotel);
    addCollider(34, 188, 22, 14);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(19, 3.6),
      new THREE.MeshBasicMaterial({ map: signTexture('HOTEL MIRAMAR', '#0d2b45', '#aee6ff') }));
    sign.position.set(34, 24, 180.9); sign.rotation.y = Math.PI; group.add(sign);
    const sign2 = sign.clone(); sign2.position.z = 195.1; sign2.rotation.y = 0; group.add(sign2);
  }
  // ---- lighthouse at the CH4 drop point, marina crates at (150,150) ----
  {
    const lh = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.1, 11, 10),
      new THREE.MeshLambertMaterial({ color: 0xf2e8e0 }));
    base.position.y = 5.5; lh.add(base);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.85, 2.4, 10),
      new THREE.MeshLambertMaterial({ color: 0xd84040 }));
    band.position.y = 7.6; lh.add(band);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
    lamp.position.y = 11.6; lh.add(lamp);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff2b0, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    gl.position.y = 11.6; gl.scale.setScalar(9); lh.add(gl);
    lh.position.set(0, 0, 222); group.add(lh);
    addCollider(0, 222, 3.6, 3.6);
    const crateMat = new THREE.MeshLambertMaterial({ color: 0x9a7448 });
    [[143, 138], [158, 140], [140, 160], [-140, 140], [-138, -158], [152, -160]].forEach(([x, z]) => {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), crateMat);
      crate.position.set(x, 1.2, z); crate.rotation.y = rng.range(0, 3); group.add(crate);
      addCollider(x, z, 2.4, 2.4);
    });
    for (let i = 0; i < 8; i += 1) { // beach umbrellas
      const u = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1, 8),
        new THREE.MeshLambertMaterial({ color: rng.pick([0xff6b9d, 0xffb347, 0x53d8e8]) }));
      u.position.set(rng.range(-180, 180), 2.2, rng.range(202, 218)); group.add(u);
    }
  }
  // ---- collision helpers ----
  function hitsBuilding(pos, r) {
    for (const c of colliders) {
      const nx = clamp(pos.x, c.minX, c.maxX); const nz = clamp(pos.z, c.minZ, c.maxZ);
      if (Math.hypot(pos.x - nx, pos.z - nz) < r) return true;
    }
    return false;
  }
  function collide(pos, r) {
    let hit = false;
    for (const c of colliders) {
      const nx = clamp(pos.x, c.minX, c.maxX); const nz = clamp(pos.z, c.minZ, c.maxZ);
      const dx = pos.x - nx; const dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * r; pos.z = nz + (dz / d) * r;
      } else { // centre inside the box: push out along the smallest exit
        const exits = [pos.x - c.minX + r, c.maxX - pos.x + r, pos.z - c.minZ + r, c.maxZ - pos.z + r];
        const m = Math.min(...exits);
        if (m === exits[0]) pos.x = c.minX - r; else if (m === exits[1]) pos.x = c.maxX + r;
        else if (m === exits[2]) pos.z = c.minZ - r; else pos.z = c.maxZ + r;
      }
    }
    pos.x = clamp(pos.x, -CITY.worldEdge, CITY.worldEdge);
    pos.z = clamp(pos.z, -CITY.worldEdge, CITY.worldEdge + 30);
    return hit;
  }
  return {
    group, colliders, roadCentres: CITY.roadCentres, beachZ: CITY.beachZ,
    seaZ: CITY.seaZ, extent: CITY.extent, spawn: { ...SPAWN }, hitsBuilding, collide,
    seaMesh: sea,
  };
}
