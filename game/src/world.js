import * as THREE from 'three';
import { CITY, NAMES, PALETTE, SUNSET } from './config.js';
import { asphaltTexture, billboardTexture, frondTexture, getMaxAnisotropy, radialGlowTexture, shopSignTexture, skyTexture, streakTexture, sunsetCubeTexture } from './textures.js';

function buildSky(scene) {
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  scene.add(dome);
  const glowTex = radialGlowTexture();
  const dir = new THREE.Vector3(...SUNSET.sunPos).normalize();
  // v5.1 (P1): the sun halo sprites were staged but never enabled (empty
  // list) — the bright flooded horizon needs the glow disc behind the sky.
  // v5.2 (visual): a third, hotter core disc and a wider wash — the sun
  // must be FELT at the end of the main street, not inferred.
  for (const [scale, opacity] of [[720, 0.42], [400, 0.68], [180, 0.9]]) {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffc98a, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    spr.position.copy(dir).multiplyScalar(820);
    spr.scale.set(scale, scale, 1);
    scene.add(spr);
  }
}

const FACADE_WALLS = ['#d8c9b0', '#e0b890', '#c9b8a3', '#b8c4c9', '#d9a06b', '#a8b89a'];
const FACADE_TINTS = [0xffffff, 0xf5e9d2, 0xe4ecef, 0xf7ddba, 0xe9e4da, 0xdfe9dc];

function windowTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 60;
  const g = c.getContext('2d');
  g.fillStyle = rng.pick(FACADE_WALLS);
  g.fillRect(0, 0, 64, 60);
  // Two windows per 3.2 m tile (1.6 m pitch): four read as graph paper at
  // contact-sheet scale, two read as windows.
  for (const x of [8, 37]) {
    const r = rng.next();
    g.fillStyle = r < 0.35 ? '#ffe9a8' : r < 0.75 ? '#2e4a5a' : '#5a7a8a';
    g.fillRect(x, 13, 17, 27);
  }
  // Floor line under the row of windows.
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.fillRect(0, 55, 64, 5);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // v5.2 (sharpness): facades are the most grazing-angle surface in the
  // game; clones in facadeMaterial inherit this via Texture.copy.
  tex.anisotropy = getMaxAnisotropy();
  return tex;
}

const facadeCache = new Map();

function facadeMaterial(rng, bases, w, d, h) {
  const base = rng.pick(bases);
  const rx = Math.max(1, Math.round(Math.max(w, d) / 3.2));
  const ry = Math.max(1, Math.round(h / 3));
  const tint = rng.pick(FACADE_TINTS);
  const key = `${bases.indexOf(base)}|${rx}|${ry}|${tint}`;
  let mat = facadeCache.get(key);
  if (!mat) {
    const tex = base.clone();
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(rx, ry);
    tex.needsUpdate = true;
    mat = new THREE.MeshLambertMaterial({ color: tint, map: tex, emissive: 0x662200, emissiveIntensity: 0.34 }); // v5.1 (P1): lit windows warmer
    facadeCache.set(key, mat);
  }
  return mat;
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
    new THREE.MeshLambertMaterial({ color: 0x979c90 }), // v5.1 (P1): slab lifted with the road pass
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

  const wet = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.size * 2, 11),
    new THREE.MeshLambertMaterial({ color: 0xc9ac72, transparent: true, opacity: 0.6 }),
  );
  wet.rotation.x = -Math.PI / 2;
  wet.position.set(0, 0.06, CITY.seaZ - 24);
  group.add(wet);
  const foamGeo = new THREE.PlaneGeometry(CITY.size * 2, 2.6, 96, 1);
  const foamPos = foamGeo.attributes.position;
  for (let i = 0; i < foamPos.count; i += 1) {
    foamPos.setY(i, foamPos.getY(i) + Math.sin(foamPos.getX(i) * 0.045) * 0.9);
  }
  foamGeo.computeVertexNormals();
  const foam = new THREE.Mesh(
    foamGeo,
    new THREE.MeshBasicMaterial({ color: 0xffd9e2, transparent: true, opacity: 0.5, depthWrite: false }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.08, CITY.seaZ - 19);
  group.add(foam);

  // v2 beach life: umbrellas + towels on the sand (the cover shot looks
  // straight down this beach). Kept clear of the pier and the lighthouse.
  const UMBRELLAS = [0xe74c3c, 0xf39c12, 0x2a9d8f, 0xe67e22, 0xecf0f1, 0x4a90d9];
  const umbPoleGeo = new THREE.CylinderGeometry(0.06, 0.08, 2.3, 6);
  const umbPoleMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const umbTopGeo = new THREE.ConeGeometry(1.7, 0.75, 8);
  const towelGeo = new THREE.PlaneGeometry(1.9, 0.95);
  for (let i = 0; i < 10; i += 1) {
    const ux = rng.range(-320, 320);
    if (Math.abs(ux - 60) < 10 || Math.abs(ux + 40) < 9) continue;
    const uz = CITY.beachZ + rng.range(2, 15);
    const pole = new THREE.Mesh(umbPoleGeo, umbPoleMat);
    pole.position.set(ux, 1.15, uz);
    pole.rotation.z = rng.range(-0.07, 0.07);
    group.add(pole);
    const top = new THREE.Mesh(umbTopGeo, new THREE.MeshLambertMaterial({ color: rng.pick(UMBRELLAS) }));
    top.position.set(ux, 2.35, uz);
    group.add(top);
    const towel = new THREE.Mesh(towelGeo, new THREE.MeshLambertMaterial({ color: rng.pick(UMBRELLAS) }));
    towel.rotation.x = -Math.PI / 2;
    towel.rotation.z = rng.range(0, Math.PI);
    towel.position.set(ux + rng.range(1.6, 2.6), 0.09, uz + rng.range(-0.5, 1.5));
    group.add(towel);
  }

  // v5.1 (P1): the gloss pass — hotter specular plus the shared sunset cube
  // as an envMap, so the low sun streaks across the asphalt instead of the
  // road reading as flat dark paint.
  // v5.3 (wet road): the road finally carries a real map — procedural
  // asphalt (grain, patches, cracks, tyre-polish bands) tiled ~14 m per
  // repeat along the plane, with max anisotropy so the near-camera field
  // stays textured at grazing angles instead of smearing matte. The map
  // is near-white, so PALETTE.asphalt still sets the tint.
  const roadTex = asphaltTexture();
  roadTex.repeat.set(30, 1);
  // The map multiplies the tint (mean texel ≈0.9), so the material colour
  // is PALETTE.asphalt pre-lightened ×1.22 per channel to land the road
  // at — or a touch above — the v5.2 flat brightness while the grain,
  // patches and polish bands stay visible.
  const roadMat = new THREE.MeshPhongMaterial({ color: 0x5a4d60, map: roadTex, shininess: 110, specular: 0xe8a0b4, envMap: sunsetCubeTexture(), reflectivity: 0.62 }); // v5.3: wetter still (was shininess 90 / refl 0.5)
  const walkMat = new THREE.MeshPhongMaterial({ color: PALETTE.sidewalk, shininess: 40, specular: 0x776655 });

  const streakGeo = new THREE.PlaneGeometry(1, 1);
  streakGeo.rotateX(-Math.PI / 2);
  const streakTexShared = streakTexture();
  function addReflectionStreak(x, z, color, len, w, opacity = 0.2, alongX = false) {
    const m = new THREE.Mesh(streakGeo, new THREE.MeshBasicMaterial({
      map: streakTexShared, color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    m.rotation.y = alongX ? Math.PI / 2 : 0;
    m.scale.set(w, 1, len);
    m.position.set(x, 0.09, z);
    group.add(m);
    return m;
  }

  // v5 (b4): puddles — dark glossy ellipses on the southern roads.
  const puddleGeo = new THREE.CircleGeometry(1, 14);
  puddleGeo.rotateX(-Math.PI / 2);
  const puddleMat = new THREE.MeshPhongMaterial({ color: 0x1c1626, shininess: 120, specular: 0xff9ec6, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 14; i += 1) {
    const onVertical = rng.next() < 0.5;
    const c = rng.pick(centres);
    const p = new THREE.Mesh(puddleGeo, puddleMat);
    p.scale.set(rng.range(1.2, 2.4), 1, rng.range(2, 4.2));
    p.position.set(onVertical ? c + rng.range(-3, 3) : rng.range(-half, half), 0.095, onVertical ? rng.range(40, half) : c + rng.range(-3, 3));
    group.add(p);
  }
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
  const facades = [windowTexture(rng), windowTexture(rng), windowTexture(rng), windowTexture(rng), windowTexture(rng), windowTexture(rng)];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofGeo = new THREE.BoxGeometry(1, 1, 1);
  // Shared trim materials (v2): plinth + balconies + AC units reuse these
  // instead of one material per building.
  const plinthMat = new THREE.MeshLambertMaterial({ color: 0x4a4038 });
  const acMat = new THREE.MeshLambertMaterial({ color: 0x8f979c });
  const AWNINGS = [0xd94f3d, 0x2a9d8f, 0xf4a261, 0x3a7ca5];
  const blockSpan = CITY.pitch - CITY.roadHalf * 2 - 4;
  let signCount = 0; // v5 (e2) shop-sign budget
  const SIGN_NEONS = ['#ff6b9d', '#ffb347', '#5ee6ff', '#b28dff', '#7dff9a'];
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
        // v2: EVERY building wears the tiled facade (v1 left h ≤ 18 bare).
        const b = new THREE.Mesh(boxGeo, facadeMaterial(rng, facades, w, d, h));
        b.scale.set(w, h, d);
        b.position.set(x, h / 2, z);
        group.add(b);
        const roofMat = new THREE.MeshLambertMaterial({ color: rng.pick(PALETTE.roofs) });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.scale.set(w * 0.4, 1.2, d * 0.4);
        roof.position.set(x, h + 0.6, z);
        group.add(roof);
        const rim = new THREE.Mesh(roofGeo, roofMat);
        rim.scale.set(w + 0.5, 0.55, d + 0.5);
        rim.position.set(x, h + 0.28, z);
        group.add(rim);
        // v2 rooftop clutter: 0–2 AC boxes at seeded spots (v1 always had
        // exactly the one centre box, now kept only sometimes).
        const acCount = rng.int(0, 2);
        for (let a = 0; a < acCount; a += 1) {
          const ac = new THREE.Mesh(roofGeo, acMat);
          ac.scale.set(rng.range(1.2, 2.6), 0.8, rng.range(1.2, 2.2));
          ac.position.set(
            x + rng.range(-w / 4, w / 4),
            h + 0.4,
            z + rng.range(-d / 4, d / 4),
          );
          group.add(ac);
        }
        const plinth = new THREE.Mesh(roofGeo, plinthMat);
        plinth.scale.set(w + 0.5, 1.4, d + 0.5);
        plinth.position.set(x, 0.7, z);
        group.add(plinth);
        // v2 balconies + awning, on the face that looks OUT of the block
        // (toward the nearest road), so slabs never clip a neighbour.
        const faceX = Math.abs(ox) >= Math.abs(oz);
        const dir = faceX ? Math.sign(ox || 1) : Math.sign(oz || 1);
        const faceLen = faceX ? d : w;
        const faceOff = (faceX ? w : d) / 2;
        if (h >= 14 && h <= 30) {
          let slabs = 0;
          for (let by = 8; by < h - 2.5 && slabs < 2; by += 5) {
            const slab = new THREE.Mesh(roofGeo, plinthMat);
            const len = Math.min(faceLen - 2, 9);
            if (faceX) slab.scale.set(1.1, 0.25, len);
            else slab.scale.set(len, 0.25, 1.1);
            slab.position.set(
              faceX ? x + dir * (faceOff + 0.55) : x,
              by,
              faceX ? z : z + dir * (faceOff + 0.55),
            );
            group.add(slab);
            slabs += 1;
          }
        }
        const hasAwning = h >= 10 && rng.next() < 0.4;
        if (hasAwning) {
          // Ground-floor awning: a bright tilted slab over the street face.
          const awn = new THREE.Mesh(
            roofGeo,
            new THREE.MeshLambertMaterial({ color: rng.pick(AWNINGS) }),
          );
          const len = Math.min(faceLen - 3, 8);
          if (faceX) {
            awn.scale.set(1.7, 0.16, len);
            awn.position.set(x + dir * (faceOff + 0.8), 3.2, z);
            awn.rotation.z = -dir * 0.32;
          } else {
            awn.scale.set(len, 0.16, 1.7);
            awn.position.set(x, 3.2, z + dir * (faceOff + 0.8));
            awn.rotation.x = dir * 0.32;
          }
          group.add(awn);
          if (signCount < 18) {
            signCount += 1;
            const signTex = shopSignTexture(NAMES.shops[signCount % NAMES.shops.length], SIGN_NEONS[signCount % SIGN_NEONS.length]);
            const sign = new THREE.Mesh(
              new THREE.PlaneGeometry(Math.min(faceLen - 3, 8) * 0.92, 1.15),
              new THREE.MeshBasicMaterial({ map: signTex }),
            );
            if (faceX) {
              sign.position.set(x + dir * (faceOff + 0.14), 4.7, z);
              sign.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
            } else {
              sign.position.set(x, 4.7, z + dir * (faceOff + 0.14));
              sign.rotation.y = dir > 0 ? 0 : Math.PI;
            }
            group.add(sign);
          }
        }
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

  function mergeGeoms(geoms) {
    const parts = geoms.map((g) => g.toNonIndexed());
    let total = 0;
    for (const p of parts) total += p.attributes.position.count;
    const pos = new Float32Array(total * 3);
    const norm = new Float32Array(total * 3);
    const uv = new Float32Array(total * 2);
    let o = 0;
    for (const p of parts) {
      pos.set(p.attributes.position.array, o * 3);
      norm.set(p.attributes.normal.array, o * 3);
      if (p.attributes.uv) uv.set(p.attributes.uv.array, o * 2);
      o += p.attributes.position.count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return geo;
  }
  const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk });
  const trunkLow = new THREE.CylinderGeometry(0.27, 0.42, 4.2, 6);
  trunkLow.translate(0, 2.1, 0);
  trunkLow.rotateZ(0.07);
  const trunkHigh = new THREE.CylinderGeometry(0.19, 0.27, 3.4, 6);
  trunkHigh.translate(0, 1.7, 0);
  trunkHigh.rotateZ(-0.13);
  trunkHigh.translate(-0.55, 3.9, 0);
  const trunkGeoMerged = mergeGeoms([trunkLow, trunkHigh]);
  // Crown: fronds, each a subdivided plane bent into a droop (tip falls
  // parabolically), fanned around the trunk top; 2 coconuts underneath.
  // v5.1 (P4): 9 wider fronds (was 6) — the crowns read full at the focal
  // boulevard instead of thin fans. Still one instanced geometry.
  const frondParts = [];
  for (let i = 0; i < 9; i += 1) {
    const frond = new THREE.PlaneGeometry(1.5, 3.5, 1, 3);
    frond.translate(0, 1.75, 0); // base at the origin
    const fp = frond.attributes.position;
    for (let v = 0; v < fp.count; v += 1) {
      const t = fp.getY(v) / 3.5;
      fp.setZ(v, -t * t * 1.4);
    }
    frond.computeVertexNormals();
    frond.rotateX(-1.05); // tilt outward; the bend becomes the droop
    frond.rotateY((i / 9) * Math.PI * 2 + 0.4);
    frond.translate(-0.85, 7.35, 0);
    frondParts.push(frond);
  }
  for (const [cx, cz] of [[-0.55, 0.25], [-1.15, -0.2]]) {
    const nut = new THREE.SphereGeometry(0.27, 6, 5);
    nut.translate(cx, 6.95, cz);
    frondParts.push(nut);
  }
  const crownGeo = mergeGeoms(frondParts);
  const crownMat = new THREE.MeshLambertMaterial({ map: frondTexture(), alphaTest: 0.45, side: THREE.DoubleSide });
  const palmSpots = [];
  // Beach row thinned 12 m → 18 m spacing in Tahap 8 (perf); the boulevard
  // rows below are D1-critical and stay dense.
  for (let x = -half; x <= half; x += 18) palmSpots.push([x + rng.range(-3, 3), CITY.beachZ + 8 + rng.range(0, 14)]);
  for (let z = 56; z <= 196; z += 9) { // v5.1 (P4): boulevard rows denser (was 11)
    palmSpots.push([-9.6, z + rng.range(-1, 1), 1]); // v5.2: third field = lean toward the road
    palmSpots.push([9.6, z + rng.range(-1, 1), 1]);
  }
  for (let x = -160; x <= 160; x += 24) palmSpots.push([x + rng.range(-2, 2), 158.6]);
  // Scattered sidewalk palms elsewhere: 52 → 18, so the instancing saving is
  // not spent straight back on raw palm count (d2 budget note).
  for (let i = 0; i < 18; i += 1) {
    palmSpots.push([rng.range(-half, half), rng.pick(centres) + CITY.roadHalf + 3]);
  }
  const trunkInst = new THREE.InstancedMesh(trunkGeoMerged, trunkMat, palmSpots.length);
  const crownInst = new THREE.InstancedMesh(crownGeo, crownMat, palmSpots.length);
  {
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const leanQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.13);
    palmSpots.forEach(([x, z, lean], i) => {
      // v5.2 (visual): boulevard palms lean over the kerb toward the road —
      // the yaw faces the trunk's built-in lean at the street and leanQ
      // carries the crown a further ~1 m over the lane edge. The collider
      // below stays at the trunk base, exactly where it always was.
      const yaw = lean ? (x > 0 ? 0 : Math.PI) + rng.range(-0.25, 0.25) : rng.range(0, Math.PI * 2);
      e.set(0, yaw, 0);
      q.setFromEuler(e);
      if (lean) q.multiply(leanQ);
      const sc = rng.range(0.9, 1.15);
      s.set(sc, sc, sc);
      p.set(x, 0, z);
      m4.compose(p, q, s);
      trunkInst.setMatrixAt(i, m4);
      crownInst.setMatrixAt(i, m4);
      colliders.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5 });
    });
  }
  group.add(trunkInst);
  group.add(crownInst);

  const lampPoleGeo = new THREE.CylinderGeometry(0.09, 0.13, 5.6, 6);
  const lampPoleMat = new THREE.MeshLambertMaterial({ color: 0x3c4147 });
  const lampHeadGeo = new THREE.BoxGeometry(1.5, 0.18, 0.5);
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const planterGeo = new THREE.BoxGeometry(1.8, 0.65, 1.8);
  const planterMat = new THREE.MeshLambertMaterial({ color: 0xa8573a });
  const miniTrunkGeo = new THREE.CylinderGeometry(0.1, 0.15, 1.7, 6);
  for (let ix = 0; ix < centres.length; ix += 1) {
    for (let iz = 0; iz < centres.length; iz += 1) {
      if ((ix + iz) % 2 === 0) {
        const lx = centres[ix] + CITY.roadHalf + 1.3;
        const lz = centres[iz] + CITY.roadHalf + 1.3;
        const pole = new THREE.Mesh(lampPoleGeo, lampPoleMat);
        pole.position.set(lx, 2.8, lz);
        group.add(pole);
        const headBar = new THREE.Mesh(lampHeadGeo, lampHeadMat);
        headBar.position.set(lx - 0.5, 5.6, lz - 0.5);
        headBar.rotation.y = Math.PI / 4;
        group.add(headBar);
        // v5 (b2): lamps on the two centre avenues pool a warm streak on the
        // wet asphalt at their intersection. v5.1 (P1): EVERY lamp
        // intersection pools a streak now — the centre avenues keep the
        // longer, stronger ones.
        const mid = (centres.length - 1) / 2;
        if (ix === mid || iz === mid) addReflectionStreak(centres[ix], centres[iz], 0xffb347, 8, 2, 0.18);
        else addReflectionStreak(centres[ix], centres[iz], 0xffb347, 6, 1.8, 0.14);
        colliders.push({ minX: lx - 0.3, maxX: lx + 0.3, minZ: lz - 0.3, maxZ: lz + 0.3 });
      } else if (ix >= 1 && ix <= 5 && iz >= 1 && iz <= 5) {
        const px = centres[ix] - CITY.roadHalf - 1.7;
        const pz = centres[iz] - CITY.roadHalf - 1.7;
        const box = new THREE.Mesh(planterGeo, planterMat);
        box.position.set(px, 0.33, pz);
        group.add(box);
        const trunk = new THREE.Mesh(miniTrunkGeo, trunkMat);
        trunk.position.set(px, 1.4, pz);
        group.add(trunk);
        // v5: planter palms reuse the real crown geometry at 0.45 scale
        // (d3) instead of the deleted cone.
        const leaves = new THREE.Mesh(crownGeo, crownMat);
        leaves.scale.set(0.45, 0.45, 0.45);
        leaves.position.set(px + 0.38, -1.0, pz);
        group.add(leaves);
        colliders.push({ minX: px - 0.95, maxX: px + 0.95, minZ: pz - 0.95, maxZ: pz + 0.95 });
      }
    }
  }

  const glowTexShared = radialGlowTexture();
  const BB_STYLES = [
    { bg: '#2a1440', fg: '#ffd9ec', accent: '#ff6b9d' },
    { bg: '#12303f', fg: '#eafcff', accent: '#5ee6ff' },
    { bg: '#3d1030', fg: '#ffe9f4', accent: '#ff2e88' },
    { bg: '#40260f', fg: '#fff3d6', accent: '#ffb347' },
    { bg: '#0f2f2a', fg: '#eafff6', accent: '#3ddc97' },
    { bg: '#2e1a47', fg: '#ffffff', accent: '#ffb347' },
  ];
  function makeBillboard(x, z, rotY, texIndex) {
    const style = BB_STYLES[texIndex % BB_STYLES.length];
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 8, 8), lampPoleMat);
    pole.position.y = 4;
    g.add(pole);
    const W = 10.5;
    const H = 5.2;
    const plain = new THREE.MeshLambertMaterial({ color: 0x241a30 });
    // v5.1 (P4): the board is two-sided — the same artwork faces both ways
    // down the street; the back is no longer a black slab.
    const face = new THREE.MeshBasicMaterial({ map: billboardTexture(NAMES.billboards[texIndex], style.bg, style.fg, style.accent) });
    const board = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.4), [plain, plain, plain, plain, face, face]);
    board.position.y = 11;
    g.add(board);
    const frameMat = new THREE.MeshBasicMaterial({ color: style.accent });
    for (const [w, h, fx, fy] of [[W + 0.5, 0.28, 0, H / 2 + 0.14], [W + 0.5, 0.28, 0, -H / 2 - 0.14], [0.28, H + 0.5, -W / 2 - 0.14, 0], [0.28, H + 0.5, W / 2 + 0.14, 0]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), frameMat);
      bar.position.set(fx, 11 + fy, 0.22);
      g.add(bar);
    }
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.5, H * 1.9), new THREE.MeshBasicMaterial({
      map: glowTexShared, color: style.accent, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    halo.position.set(0, 11, -0.35);
    g.add(halo);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    group.add(g);
    colliders.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5 });
    return g;
  }
  makeBillboard(-13.5, 168, Math.PI, 0);
  makeBillboard(13.5, 192, Math.PI, 2);
  makeBillboard(-24, 150, 0, 1);
  makeBillboard(26, 158, 0, 5);
  makeBillboard(34, -13.5, -Math.PI / 2, 3);
  makeBillboard(62, 13.5, -Math.PI / 2, 4);
  // Their light pools on the boulevard asphalt (b2).
  addReflectionStreak(-2.2, 170, 0xff6b9d, 13, 2.4, 0.25);
  addReflectionStreak(2.2, 194, 0xff2e88, 13, 2.4, 0.25);
  // Neon wash down the boulevard itself: alternating pink/orange pools.
  for (let i = 0; i < 6; i += 1) {
    addReflectionStreak(i % 2 ? 1.8 : -1.8, 70 + i * 22, i % 2 ? 0xffb347 : 0xff6b9d, 10, 2.2, 0.18);
  }
  // v5.2 (visual): continuous neon wash down the hero roads — the centre
  // avenue, the centre cross-street and the beach road (the CH1 route):
  // long coloured pools along the lanes, not only at intersections.
  const WASH = [0xffb347, 0xff6b9d, 0x5ee6ff, 0xff2e88];
  let wi = 0;
  for (let t = -168; t <= 168; t += 24) {
    const side = wi % 2 ? 1.8 : -1.8;
    addReflectionStreak(side, t, WASH[wi % 4], 15, 2.3, 0.15);
    addReflectionStreak(t, -side, WASH[(wi + 1) % 4], 15, 2.3, 0.15, true);
    wi += 1;
  }
  for (let t = -144; t <= 144; t += 24) {
    const side = wi % 2 ? 1.8 : -1.8;
    addReflectionStreak(t, 168 + side, WASH[(wi + 2) % 4], 15, 2.3, 0.15, true);
    wi += 1;
  }
  // v5.3 (wet road): LONG pale sunset streaks down the wheel tracks of
  // the hero roads — the "wet mirror" read the flat colour never gave.
  // Warm white-pink, low opacity, stretched 34–44 m so they smear along
  // the driving direction like light on standing water. Kept off the
  // lane centre so the yellow dashes stay clean.
  for (let t = -150; t <= 150; t += 50) {
    addReflectionStreak(-3.4, t, 0xffd9b0, 40, 1.5, 0.13);
    addReflectionStreak(3.4, t + 25, 0xffc4d6, 40, 1.5, 0.13);
    addReflectionStreak(t, 168 - 3.4, 0xffd9b0, 40, 1.5, 0.13, true);
    addReflectionStreak(t + 25, 168 + 3.4, 0xffc4d6, 40, 1.5, 0.13, true);
    addReflectionStreak(t + 12, -3.4, 0xffe2c0, 36, 1.5, 0.11, true);
  }
  // v5.3: extra glossy puddle patches ON the hero roads (the b4 set only
  // covered southern roads) — same shared geometry/material, elongated
  // along the road so they read as standing water, not decals.
  for (let i = 0; i < 12; i += 1) {
    const p = new THREE.Mesh(puddleGeo, puddleMat);
    const onBeach = i % 2 === 0;
    p.scale.set(rng.range(1.1, 1.9), 1, rng.range(3.2, 5.6));
    if (onBeach) {
      p.rotation.y = Math.PI / 2;
      p.position.set(rng.range(-150, 150), 0.096, 168 + rng.range(-3.4, 3.4));
    } else {
      p.position.set(rng.range(-3.4, 3.4), 0.096, rng.range(-160, 160));
    }
    group.add(p);
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

  // v5.2 (visual): kerbside parked cars on the hero roads — instanced
  // bodies/cabins/wheels (3 draw calls for the whole fleet). Pure
  // decoration: no colliders, not traffic, nothing enterable. They sit
  // on the sidewalk strip (roadHalf..roadHalf+2) so the lanes stay clear
  // and the hero streets never read as empty.
  {
    const KERB = CITY.roadHalf + 1.05;
    const spots = [];
    for (let i = 0; i < 7; i += 1) spots.push([(i % 2 ? 1 : -1) * KERB, 64 + i * 20, 0]); // boulevard (x=0 road)
    for (let i = 0; i < 9; i += 1) spots.push([-144 + i * 36, 168 + (i % 2 ? 1 : -1) * KERB, Math.PI / 2]); // beach road (CH1 route)
    for (let i = 0; i < 6; i += 1) spots.push([-140 + i * 52, (i % 2 ? 1 : -1) * KERB, Math.PI / 2]); // centre cross-street
    const bodyIM = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.9, 0.62, 4.3),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      spots.length,
    );
    const cabinIM = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.7, 0.55, 2.1),
      new THREE.MeshLambertMaterial({ color: 0x2a3a4d }),
      spots.length,
    );
    const wheelGeoP = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10);
    wheelGeoP.rotateZ(Math.PI / 2);
    const wheelIM = new THREE.InstancedMesh(wheelGeoP, new THREE.MeshLambertMaterial({ color: 0x141414 }), spots.length * 4);
    // v5.3: hubcap discs for the parked fleet too — same matrices as the
    // wheels, one extra draw call for all 22 cars.
    const hubGeoP = new THREE.CylinderGeometry(0.19, 0.19, 0.28, 10);
    hubGeoP.rotateZ(Math.PI / 2);
    const hubIM = new THREE.InstancedMesh(hubGeoP, new THREE.MeshLambertMaterial({ color: 0xaab2bc }), spots.length * 4);
    const PARK_COLORS = [0xff5964, 0xffb347, 0x5ee6ff, 0xf1c40f, 0x9b5de5, 0x3ddc97, 0xe8eef2, 0xff2e88, 0x2e86c1];
    const m4 = new THREE.Matrix4();
    const off = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const one = new THREE.Vector3(1, 1, 1);
    let w = 0;
    spots.forEach(([x, z, yaw], i) => {
      q.setFromAxisAngle(up, yaw + (i % 3 - 1) * 0.04);
      const base = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), q, one);
      m4.copy(base).multiply(off.makeTranslation(0, 0.58, 0));
      bodyIM.setMatrixAt(i, m4);
      bodyIM.setColorAt(i, new THREE.Color(PARK_COLORS[i % PARK_COLORS.length]));
      m4.copy(base).multiply(off.makeTranslation(0, 1.12, -0.25));
      cabinIM.setMatrixAt(i, m4);
      for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
        m4.copy(base).multiply(off.makeTranslation(wx, 0.36, wz));
        wheelIM.setMatrixAt(w, m4);
        hubIM.setMatrixAt(w, m4);
        w += 1;
      }
    });
    bodyIM.frustumCulled = false;
    cabinIM.frustumCulled = false;
    wheelIM.frustumCulled = false;
    hubIM.frustumCulled = false;
    group.add(bodyIM);
    group.add(cabinIM);
    group.add(wheelIM);
    group.add(hubIM);
  }

  const cloudMat = new THREE.MeshBasicMaterial({
    color: SUNSET.cloud, transparent: true, opacity: SUNSET.cloudOpacity, depthWrite: false,
    side: THREE.DoubleSide, fog: false,
  });
  for (let i = 0; i < 8; i += 1) {
    const cloud = new THREE.Mesh(
      new THREE.PlaneGeometry(rng.range(60, 130), rng.range(13, 24)),
      cloudMat,
    );
    cloud.rotation.x = -Math.PI / 2 + rng.range(-0.15, 0.15);
    cloud.position.set(rng.range(-420, 420), rng.range(95, 135), rng.range(-420, 420));
    group.add(cloud);
  }

  const sun = new THREE.DirectionalLight(SUNSET.sunColor, SUNSET.sunIntensity);
  sun.position.set(...SUNSET.sunPos);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(SUNSET.ambient, SUNSET.ambientIntensity));
  scene.add(new THREE.HemisphereLight(SUNSET.hemiSky, SUNSET.hemiGround, SUNSET.hemiIntensity));
  buildSky(scene);
  scene.fog = new THREE.FogExp2(SUNSET.fog, SUNSET.fogDensity);

  return {
    group,
    colliders,
    sea,
    lamp,
    half,
    palmCrownMat: crownMat, // d4: main.js sways the fronds via its map offset
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
