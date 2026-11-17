// Palmera City itself: a procedural sun-soaked coastal grid. Roads on a regular
// pitch, blocks of varied buildings between them, a palm-lined beach and a live
// sea to the south, a golden sun and haze. Everything is generated from the seed,
// so the same seed builds the same city. Colliders are plain AABBs the player,
// cars and AI all share; the road graph is the list of road centrelines traffic
// and police drive on.
import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';

const FACADE_WALLS = ['#d8c9b0', '#e0b890', '#c9b8a3', '#b8c4c9', '#d9a06b', '#a8b89a'];

function windowTexture(rng) {
  // One shared facade texture per wall tone: lit windows on a warm wall,
  // drawn once on canvas. Tall buildings pick one of the tones. R3: floor
  // separator lines + a darker ground floor with a door, so the slab reads
  // as stacked storeys instead of a flat dotted box.
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = rng.pick(FACADE_WALLS);
  g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 16) {
    for (let x = 6; x < 56; x += 14) {
      const r = rng.next();
      g.fillStyle = r < 0.35 ? '#ffe9a8' : r < 0.75 ? '#2e4a5a' : '#5a7a8a';
      g.fillRect(x, y, 9, 11);
    }
    // Floor line under each row of windows.
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.fillRect(0, y + 13, 64, 2);
  }
  // Ground floor: darker band + a door, so the base is not just wall.
  g.fillStyle = 'rgba(0,0,0,0.30)';
  g.fillRect(0, 110, 64, 18);
  g.fillStyle = '#2e2118';
  g.fillRect(27, 114, 10, 14);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function roadCentres() {
  const list = [];
  const half = ((CITY.roads - 1) / 2) * CITY.pitch;
  for (let i = 0; i < CITY.roads; i += 1) list.push(-half + i * CITY.pitch);
  return list;
}

export function isOnRoad(x, z) {
  const centres = roadCentres();
  for (const c of centres) {
    if (Math.abs(x - c) < CITY.roadHalf + 1.5) return true;
    if (Math.abs(z - c) < CITY.roadHalf + 1.5) return true;
  }
  return false;
}

export function createWorld(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);
  const centres = roadCentres();
  const half = centres[centres.length - 1] + CITY.roadHalf;

  // Ground: city slab, then sand, then sea.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.size * 2, CITY.size * 2),
    new THREE.MeshLambertMaterial({ color: 0x8a8f88 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.size * 2, 90),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.05, CITY.beachZ + 20);
  group.add(sand);

  const seaMat = new THREE.MeshLambertMaterial({ color: PALETTE.sea, transparent: true, opacity: 0.92 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(CITY.size * 2, 300), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.02, CITY.seaZ + 130);
  group.add(sea);

  // Roads: dark strips + centre dashes, sidewalks as pale borders.
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
  for (const c of centres) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 14, CITY.roadHalf * 2), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(horizontal ? 0 : c, 0.08, horizontal ? c : 0);
      if (!horizontal) road.rotation.z = Math.PI / 2;
      group.add(road);
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 14, CITY.roadHalf * 2 + 6), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(horizontal ? 0 : c, 0.06, horizontal ? c : 0);
      if (!horizontal) walk.rotation.z = Math.PI / 2;
      group.add(walk);
      // R3: dashes were 4 m long and read as giant yellow slabs in the
      // foreground of on-foot shots — 2.4 m, narrower, spaced 10 m apart.
      for (let d = -half; d <= half; d += 10) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.35), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(horizontal ? d : c, 0.1, horizontal ? c : d);
        if (!horizontal) dash.rotation.z = Math.PI / 2;
        group.add(dash);
      }
    }
  }

  // Buildings: 1–4 per block, varied heights and warm colours, rooftop boxes.
  const facades = [windowTexture(rng), windowTexture(rng), windowTexture(rng)];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofGeo = new THREE.BoxGeometry(1, 1, 1);
  const blockSpan = CITY.pitch - CITY.roadHalf * 2 - 4;
  for (let ix = 0; ix < centres.length - 1; ix += 1) {
    for (let iz = 0; iz < centres.length - 1; iz += 1) {
      const cx = (centres[ix] + centres[ix + 1]) / 2;
      const cz = (centres[iz] + centres[iz + 1]) / 2;
      // The marina corner stays open: a plaza with a fountain basin.
      if (ix === centres.length - 2 && iz === centres.length - 2) {
        const plaza = new THREE.Mesh(
          new THREE.CylinderGeometry(10, 10, 0.6, 24),
          new THREE.MeshLambertMaterial({ color: 0x7fb8d8 }),
        );
        plaza.position.set(cx, 0.3, cz);
        group.add(plaza);
        continue;
      }
      const count = rng.int(1, 3);
      for (let n = 0; n < count; n += 1) {
        const w = rng.range(10, 20);
        const d = rng.range(10, 20);
        const h = rng.range(8, count === 1 ? 52 : 26);
        const ox = rng.range(-blockSpan / 4, blockSpan / 4);
        const oz = rng.range(-blockSpan / 4, blockSpan / 4);
        const x = cx + ox;
        const z = cz + oz;
        const mat = new THREE.MeshLambertMaterial({ color: rng.pick(PALETTE.building), map: h > 18 ? rng.pick(facades) : null });
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(x, h / 2, z);
        group.add(b);
        const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: rng.pick(PALETTE.roofs) }));
        roof.scale.set(w * 0.4, 1.2, d * 0.4);
        roof.position.set(x, h + 0.6, z);
        group.add(roof);
        // R3 fake grounding (no shadow map: a 1024 map over the whole city
        // cost −46% start / −61% driving FPS in swiftshader, and its texels
        // would be ~0.4 m anyway). A dark plinth band at the base reads as
        // contact shadow, and a soft ground shadow falls to the north-west,
        // away from the low south-eastern sun.
        const plinth = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0x4a4038 }));
        plinth.scale.set(w + 0.5, 1.4, d + 0.5);
        plinth.position.set(x, 0.7, z);
        group.add(plinth);
        const bShadow = new THREE.Mesh(
          new THREE.PlaneGeometry(w + 8, d + 8),
          new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false }),
        );
        bShadow.rotation.x = -Math.PI / 2;
        bShadow.position.set(x - 4, 0.12, z - 3);
        group.add(bShadow);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // Palms along the beach and scattered on sidewalks.
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 7, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk });
  const leafGeo = new THREE.ConeGeometry(2.6, 3.2, 6);
  const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf });
  const palmSpots = [];
  for (let x = -half; x <= half; x += 12) palmSpots.push([x + rng.range(-3, 3), CITY.beachZ + 8 + rng.range(0, 14)]);
  for (let i = 0; i < 52; i += 1) {
    palmSpots.push([rng.range(-half, half), rng.pick(centres) + CITY.roadHalf + 3]);
  }
  for (const [x, z] of palmSpots) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 3.5, z);
    trunk.rotation.z = rng.range(-0.08, 0.08);
    group.add(trunk);
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.position.set(x, 8, z);
    group.add(leaves);
    colliders.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5 });
  }

  // Lighthouse point on the beach (mission 4 destination) + pier into the sea.
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xf2ede4 });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.6, 16, 10), lightMat);
  tower.position.set(-40, 8, CITY.beachZ + 26);
  group.add(tower);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  );
  lamp.position.set(-40, 17, CITY.beachZ + 26);
  group.add(lamp);
  colliders.push({ minX: -43, maxX: -37, minZ: CITY.beachZ + 23, maxZ: CITY.beachZ + 29 });
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(6, 0.8, 60),
    new THREE.MeshLambertMaterial({ color: 0x8a6a42 }),
  );
  pier.position.set(60, 0.4, CITY.seaZ + 10);
  group.add(pier);

  // Sun, sky and haze — a low golden sun, warm bounce light.
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.7);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffe2b8, 1.0));
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 180, 520);

  return {
    group,
    colliders,
    sea,
    lamp,
    half,
    // Push a circle (x,z,r) out of every building AABB it overlaps.
    collide(x, z, r) {
      let nx = x;
      let nz = z;
      for (const c of colliders) {
        const cx = Math.max(c.minX, Math.min(nx, c.maxX));
        const cz = Math.max(c.minZ, Math.min(nz, c.maxZ));
        const dx = nx - cx;
        const dz = nz - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 > 0.0001) {
            const d = Math.sqrt(d2);
            nx = cx + (dx / d) * r;
            nz = cz + (dz / d) * r;
          } else {
            nx = c.maxX + r;
          }
        }
      }
      return { x: Math.max(-CITY.size, Math.min(CITY.size, nx)), z: Math.max(-CITY.size, Math.min(CITY.size, nz)) };
    },
    hitsBuilding(x, z, r) {
      for (const c of colliders) {
        if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
      }
      return false;
    },
  };
}
