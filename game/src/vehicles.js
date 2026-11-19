import * as THREE from 'three';
import { CAR, PALETTE } from './config.js';
import { cruiserStreakTexture, doorTexture, radialGlowTexture, streakTexture, sunsetCubeTexture } from './textures.js';

const KINDS = {
  sedan: { len: 4.4, bodyW: 2, bodyH: 0.7, bodyY: 0.55, cabLen: 2.2, cabZ: -0.2, wheelZ: 1.4, wheelR: 0.38 },
  hatch: { len: 3.6, bodyW: 2, bodyH: 0.7, bodyY: 0.55, cabLen: 2.4, cabZ: -0.05, wheelZ: 1.1, wheelR: 0.36 },
  van: { len: 4.6, bodyW: 2.1, bodyH: 1.45, bodyY: 1.0, cabLen: 0, cabZ: 0, wheelZ: 1.5, wheelR: 0.45 },
  sport: { len: 4.6, bodyW: 2.1, bodyH: 0.52, bodyY: 0.48, cabLen: 1.9, cabZ: -0.35, wheelZ: 1.5, wheelR: 0.4 },
};

// v5 shared glossy materials (c1): one sunset cube envMap for the fleet.
let sharedGlowTex = null;
let sharedDoorTexR = null;
let sharedDoorTexL = null;
function glowTex() {
  if (!sharedGlowTex) sharedGlowTex = radialGlowTexture();
  return sharedGlowTex;
}
function doorTex(flipped) {
  if (flipped) {
    if (!sharedDoorTexL) {
      sharedDoorTexL = doorTexture();
      sharedDoorTexL.wrapS = THREE.RepeatWrapping;
      sharedDoorTexL.repeat.x = -1; // left flank would otherwise read mirrored
    }
    return sharedDoorTexL;
  }
  if (!sharedDoorTexR) sharedDoorTexR = doorTexture();
  return sharedDoorTexR;
}
function makeGlassMat() {
  return new THREE.MeshPhongMaterial({ color: 0x2a3a4d, shininess: 120, specular: 0xffffff, envMap: sunsetCubeTexture(), reflectivity: 0.8 });
}
// v5.3 (car remodel): shared trim + hubcap materials — one instance for
// the whole fleet, so the richer silhouette costs meshes, not materials.
let sharedTrimMat = null;
let sharedHubMat = null;
function trimMat() {
  if (!sharedTrimMat) sharedTrimMat = new THREE.MeshPhongMaterial({ color: 0x1a1620, shininess: 60, specular: 0x777777, envMap: sunsetCubeTexture(), reflectivity: 0.35 });
  return sharedTrimMat;
}
function hubMat() {
  if (!sharedHubMat) sharedHubMat = new THREE.MeshLambertMaterial({ color: 0xaab2bc });
  return sharedHubMat;
}

export function makeCarMesh(color, police, kind = 'sedan') {
  const K = KINDS[kind] || KINDS.sedan;
  const group = new THREE.Group();
  // v5 (c1): glossy paint — Phong with the shared sunset cube as envMap.
  const bodyMat = new THREE.MeshPhongMaterial({ color, shininess: 90, specular: 0xbbbbbb, envMap: sunsetCubeTexture(), reflectivity: 0.55 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(K.bodyW, K.bodyH, K.len), bodyMat);
  body.position.y = K.bodyY;
  group.add(body);
  // v5.3 (car remodel): cheap silhouette kit shared by every kind —
  // bumpers, a dark grille slot and side skirts break the single-slab
  // read; mirrors sit at the cabin front (van: at its windshield base).
  {
    const trim = trimMat();
    for (const sz of [-1, 1]) {
      const bumper = new THREE.Mesh(new THREE.BoxGeometry(K.bodyW + 0.06, 0.18, 0.22), trim);
      bumper.position.set(0, 0.30, sz * (K.len / 2 + 0.02));
      group.add(bumper);
    }
    const grille = new THREE.Mesh(new THREE.BoxGeometry(K.bodyW - 0.55, 0.2, 0.08), trim);
    grille.position.set(0, K.bodyY + 0.02, K.len / 2 + 0.03);
    group.add(grille);
    if (kind !== 'sport') { // sport already wears its own skirt kit
      for (const sx of [-1, 1]) {
        const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.17, K.len - 1.5), trim);
        skirt.position.set(sx * (K.bodyW / 2 + 0.02), 0.29, 0);
        group.add(skirt);
      }
    }
    const mirrorY = kind === 'van' ? 1.52 : 1.24;
    const mirrorZ = kind === 'van' ? K.len / 2 - 0.35 : K.cabZ + K.cabLen / 2 - 0.12;
    for (const sx of [-1, 1]) {
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.11, 0.09), trim);
      mirror.position.set(sx * (K.bodyW / 2 + 0.1), mirrorY, mirrorZ);
      group.add(mirror);
    }
  }
  if (kind === 'van') {
    // A van's body IS its cabin: it only needs a windshield, a side stripe
    // and its lights to read as a van and not a crate.
    const glassMatV = makeGlassMat();
    const shieldV = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.62, 0.07), glassMatV);
    shieldV.position.set(0, 1.42, K.len / 2 - 0.02);
    shieldV.rotation.x = -0.18;
    group.add(shieldV);
    const stripeV = new THREE.Mesh(
      new THREE.BoxGeometry(K.bodyW + 0.04, 0.28, K.len - 0.7),
      new THREE.MeshLambertMaterial({ color: 0x22303c }),
    );
    stripeV.position.y = 0.62;
    group.add(stripeV);
    // v5.1 (P4): cargo detail — recessed side panels in a darker shade of
    // the body colour, a rear door split, and a roof pod, so the focal van
    // reads as panels and doors, not one crate.
    const panelMat = new THREE.MeshPhongMaterial({
      color: new THREE.Color(color).multiplyScalar(0.72),
      shininess: 60, specular: 0x999999, envMap: sunsetCubeTexture(), reflectivity: 0.4,
    });
    for (const sx of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.95, K.len - 1.5), panelMat);
      panel.position.set(sx * (K.bodyW / 2 + 0.01), 1.15, -0.25);
      group.add(panel);
    }
    const doorSplit = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.3, 0.08), panelMat);
    doorSplit.position.set(0, 1.05, -K.len / 2 - 0.01);
    group.add(doorSplit);
    const pod = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 1.6), panelMat);
    pod.position.set(0, K.bodyY + K.bodyH / 2 + 0.11, -0.4);
    group.add(pod);
  } else {
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.6, K.cabLen),
      police ? new THREE.MeshPhongMaterial({ color: PALETTE.policeBlack, shininess: 90, specular: 0xbbbbbb, envMap: sunsetCubeTexture(), reflectivity: 0.5 }) : makeGlassMat(),
    );
    cabin.position.set(0, 1.15, K.cabZ);
    group.add(cabin);
    const roofSlab = new THREE.Mesh(
      new THREE.BoxGeometry(1.74, 0.08, K.cabLen - 0.2),
      new THREE.MeshLambertMaterial({ color: police ? PALETTE.policeWhite : 0xe8eef2 }),
    );
    roofSlab.position.set(0, 1.49, K.cabZ);
    group.add(roofSlab);
    const glassMat = new THREE.MeshPhongMaterial({ color: 0x9fc8dd, shininess: 120, specular: 0xffffff, envMap: sunsetCubeTexture(), reflectivity: 0.7 });
    const shield = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 0.06), glassMat);
    shield.position.set(0, 1.15, K.cabZ + K.cabLen / 2 + 0.03);
    shield.rotation.x = -0.28;
    group.add(shield);
    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 0.06), glassMat);
    rearGlass.position.set(0, 1.15, K.cabZ - K.cabLen / 2 - 0.03);
    rearGlass.rotation.x = 0.28;
    group.add(rearGlass);
    // v5.3 (car remodel): sloped hood + trunk panels in body paint, so
    // the profile rakes instead of stepping; a glass band wraps the
    // cabin sides and two dark pillar strips split it, so the glasshouse
    // reads as windows between pillars, not a solid block.
    const topY = K.bodyY + K.bodyH / 2;
    const cabFront = K.cabZ + K.cabLen / 2;
    const cabRear = K.cabZ - K.cabLen / 2;
    const hoodLen = K.len / 2 - cabFront;
    if (hoodLen > 0.35) {
      const hoodPanel = new THREE.Mesh(new THREE.BoxGeometry(K.bodyW - 0.1, 0.13, hoodLen + 0.25), bodyMat);
      hoodPanel.position.set(0, topY - 0.01, cabFront + hoodLen / 2);
      hoodPanel.rotation.x = kind === 'sport' ? 0.17 : 0.11;
      group.add(hoodPanel);
    }
    const trunkLen = K.len / 2 + cabRear;
    if (trunkLen > 0.3) {
      const trunkPanel = new THREE.Mesh(new THREE.BoxGeometry(K.bodyW - 0.1, 0.13, trunkLen + 0.25), bodyMat);
      trunkPanel.position.set(0, topY - 0.01, cabRear - trunkLen / 2);
      trunkPanel.rotation.x = kind === 'hatch' ? -0.34 : -0.11;
      group.add(trunkPanel);
    }
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.4, K.cabLen - 0.18), makeGlassMat());
    band.position.set(0, 1.17, K.cabZ);
    group.add(band);
    for (const pz of [cabFront - 0.1, cabRear + 0.1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.44, 0.09), trimMat());
      pillar.position.set(0, 1.17, pz);
      group.add(pillar);
    }
  }
  if (police) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.25, 4.42), new THREE.MeshLambertMaterial({ color: PALETTE.policeBlack }));
    stripe.position.y = 0.62;
    group.add(stripe);
    // Big split light bar: red beacon left, blue beacon right, flashing
    // alternately so a cruiser reads as police from across the street.
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 0.6), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    barBase.position.set(0, 1.56, -0.2);
    group.add(barBase);
    const beaconGeo = new THREE.BoxGeometry(0.78, 0.34, 0.55);
    const beaconL = new THREE.Mesh(beaconGeo, new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    beaconL.position.set(-0.43, 1.78, -0.2);
    beaconL.name = 'beaconL';
    group.add(beaconL);
    const beaconR = new THREE.Mesh(beaconGeo, new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    beaconR.position.set(0.43, 1.78, -0.2);
    beaconR.name = 'beaconR';
    group.add(beaconR);
    // Black hood + trunk lid: white body, black cabin, black ends — the
    // cruiser is a high-contrast black-and-white, not a plain white box.
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 1.1), new THREE.MeshLambertMaterial({ color: PALETTE.policeBlack }));
    hood.position.set(0, 0.92, 1.65);
    group.add(hood);
  }
  if (kind === 'sport') {
    // v5 hero kit (c2): rear wing on two posts, side skirts, a front
    // splitter, twin exhausts and a pink underglow plane. All boxes — the
    // silhouette does the work.
    const kitMat = new THREE.MeshPhongMaterial({ color: 0x1c1420, shininess: 70, specular: 0x888888, envMap: sunsetCubeTexture(), reflectivity: 0.4 });
    for (const px of [-0.7, 0.7]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.12), kitMat);
      post.position.set(px, 1.0, -K.len / 2 + 0.35);
      group.add(post);
    }
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.09, 0.55), kitMat);
    wing.position.set(0, 1.24, -K.len / 2 + 0.35);
    wing.rotation.x = 0.12;
    group.add(wing);
    for (const sx of [-1, 1]) {
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, K.len - 1.2), kitMat);
      skirt.position.set(sx * (K.bodyW / 2 + 0.03), 0.28, 0);
      group.add(skirt);
    }
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(K.bodyW + 0.1, 0.1, 0.5), kitMat);
    splitter.position.set(0, 0.22, K.len / 2 + 0.1);
    group.add(splitter);
    const exhaustMat = new THREE.MeshBasicMaterial({ color: 0xd8dee6 });
    for (const ex of [-0.55, 0.55]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.25, 8), exhaustMat);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(ex, 0.35, -K.len / 2 - 0.08);
      group.add(pipe);
    }
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.3, K.len + 1.1),
      new THREE.MeshBasicMaterial({ map: streakTexture(), color: 0xff2e88, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.13;
    glow.name = 'underglow';
    group.add(glow);
  }
  if (police) {
    for (const [name, color, bx] of [['glowL', 0xff3040, -0.43], ['glowR', 0x3060ff, 0.43]]) {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex(), color, transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      spr.position.set(bx, 1.85, -0.2);
      spr.scale.set(1.7, 1.7, 1);
      spr.name = name;
      group.add(spr);
    }
    for (const side of [1, -1]) {
      const door = new THREE.Mesh(
        new THREE.PlaneGeometry(2.1, 0.52),
        new THREE.MeshBasicMaterial({ map: doorTex(side < 0), transparent: true }),
      );
      door.position.set(side * (K.bodyW / 2 + 0.02), 0.6, 0);
      door.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      group.add(door);
    }
    const refl = new THREE.Mesh(new THREE.BoxGeometry(K.bodyW + 0.05, 0.1, K.len - 0.7), new THREE.MeshBasicMaterial({ color: 0xdfe9ef }));
    refl.position.y = 0.34;
    group.add(refl);
    const streak = new THREE.Mesh(
      new THREE.PlaneGeometry(2.9, K.len + 1.6),
      new THREE.MeshBasicMaterial({ map: cruiserStreakTexture(), transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false }), // v5.2: red/blue pools read on the asphalt (was 0.3)
    );
    streak.rotation.x = -Math.PI / 2;
    streak.position.y = 0.13;
    streak.name = 'streak';
    group.add(streak);
    // Headlight glow sprites (c5) — cruisers and the hero only; ambient
    // traffic keeps plain lamp boxes (draw-call budget, PLAN §5.2).
    for (const hx of [-0.6, 0.6]) {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex(), color: 0xfff2c0, transparent: true, opacity: 0.45,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      spr.position.set(hx, 0.6, K.len / 2 + 0.15);
      spr.scale.set(0.8, 0.8, 1);
      group.add(spr);
    }
  }
  if (kind === 'sport') {
    for (const hx of [-0.6, 0.6]) {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex(), color: 0xfff2c0, transparent: true, opacity: 0.45,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      spr.position.set(hx, 0.55, K.len / 2 + 0.15);
      spr.scale.set(0.8, 0.8, 1);
      group.add(spr);
    }
  }
  const wheelGeo = new THREE.CylinderGeometry(K.wheelR, K.wheelR, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  const spokeMat = kind === 'sport' ? new THREE.MeshLambertMaterial({ color: 0xc8ccd4 }) : null;
  for (const [wx, wz] of [[-0.95, K.wheelZ], [0.95, K.wheelZ], [-0.95, -K.wheelZ], [0.95, -K.wheelZ]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, K.wheelR, wz);
    // v5.3: a light hubcap disc on every wheel (child of the wheel, so
    // it spins with it) — plain black cylinders read as holes at hero
    // distance; the disc gives the wheel a centre and a highlight.
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(K.wheelR * 0.55, K.wheelR * 0.55, 0.34, 10), hubMat());
    w.add(hub);
    if (spokeMat) {
      for (let s = 0; s < 3; s += 1) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(K.wheelR * 1.8, 0.1, 0.13), spokeMat);
        spoke.rotation.y = (s * Math.PI) / 3;
        w.add(spoke);
      }
    }
    group.add(w);
    wheels.push(w);
  }
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(2.7, K.len + 0.6),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.12;
  group.add(blob);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.2), new THREE.MeshBasicMaterial({ color: 0xfff6c8 }));
  head.position.set(0, 0.6, K.len / 2 + 0.02);
  group.add(head);
  // Taillights mirror the headlights.
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.16, 0.1), new THREE.MeshBasicMaterial({ color: 0xcc2222 }));
  tail.position.set(0, 0.6, -K.len / 2 - 0.02);
  group.add(tail);
  // v5.2 (visual): brake-light glow for the whole fleet — one wide sprite
  // so the rear lamps read as lit at hero-frame distance, not a dark slab.
  const tailGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex(), color: 0xff2a30, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  tailGlow.position.set(0, 0.62, -K.len / 2 - 0.16);
  tailGlow.scale.set(2.2, 0.65, 1);
  tailGlow.name = 'tailGlow';
  group.add(tailGlow);
  return { group, wheels };
}

export function createCar(scene, x, z, heading, color, police, kind = 'sedan') {
  const { group, wheels } = makeCarMesh(color, police, kind);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  return {
    mesh: group,
    wheels,
    pos: { x, z },
    heading,
    speed: 0,
    color,
    kind,
    police: !!police,
    // v5 (g7): body condition for the vehicle panel. Presentation only —
    // it drops on real impacts (driveCar / ram) and NEVER disables the car.
    condition: 100,
    parked: false,
    driver: null, // 'player' | 'traffic' | 'police' | null
    steer: 0,
    stuck: 0,
  };
}

export function syncCarMesh(car) {
  car.mesh.position.set(car.pos.x, 0, car.pos.z);
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * 0.06;
  for (const w of car.wheels) w.rotation.x += spin;
  const bar = car.mesh.getObjectByName('lightbar');
  if (bar) {
    const t = Math.floor(performance.now() / 280) % 2;
    bar.material.color.setHex(t === 0 ? 0xff2222 : 0x2266ff);
  }
  // Alternating beacons: one side blazes while the other dims.
  const beaconL = car.mesh.getObjectByName('beaconL');
  const beaconR = car.mesh.getObjectByName('beaconR');
  if (beaconL && beaconR) {
    const t = Math.floor(performance.now() / 280) % 2;
    beaconL.material.color.setHex(t === 0 ? 0xff2222 : 0x661111);
    beaconR.material.color.setHex(t === 0 ? 0x112266 : 0x2266ff);
    // v5 (c4): the glow sprites pulse on the same phase.
    const glowL = car.mesh.getObjectByName('glowL');
    const glowR = car.mesh.getObjectByName('glowR');
    if (glowL && glowR) {
      glowL.material.opacity = t === 0 ? 0.85 : 0.12;
      glowR.material.opacity = t === 0 ? 0.12 : 0.85;
      const s = t === 0 ? 1.9 : 1.4;
      glowL.scale.set(s, s, 1);
      glowR.scale.set(t === 0 ? 1.4 : 1.9, t === 0 ? 1.4 : 1.9, 1);
    }
  }
}

export function attachPlayerStreak(car) {
  if (car.mesh.getObjectByName('playerStreak')) return;
  const K = KINDS[car.kind] || KINDS.sedan;
  const streak = new THREE.Mesh(
    new THREE.PlaneGeometry(2.9, K.len + 1.6),
    new THREE.MeshBasicMaterial({ map: streakTexture(), color: 0xff6b9d, transparent: true, opacity: 0.36, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  streak.rotation.x = -Math.PI / 2;
  streak.position.y = 0.13;
  streak.name = 'playerStreak';
  car.mesh.add(streak);
  const beam = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 7),
    new THREE.MeshBasicMaterial({ map: streakTexture(), color: 0xfff2c0, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  beam.rotation.x = -Math.PI / 2;
  beam.position.set(0, 0.13, K.len / 2 + 3.4);
  beam.name = 'playerBeam';
  car.mesh.add(beam);
}

export function detachPlayerStreak(car) {
  for (const name of ['playerStreak', 'playerBeam']) {
    const m = car.mesh.getObjectByName(name);
    if (m) car.mesh.remove(m);
  }
}

// Player-driven car physics for one fixed step. Returns true on a hard hit.
export function driveCar(car, input, dt, world) {
  const fwd = input.held.forward ? 1 : 0;
  const back = input.held.back ? 1 : 0;
  const steerIn = (input.held.left ? 1 : 0) - (input.held.right ? 1 : 0);
  if (fwd) car.speed += CAR.accel * dt;
  if (back) car.speed -= car.speed > 0.5 ? CAR.brake * dt : CAR.accel * 0.6 * dt;
  car.speed -= car.speed * 0.35 * dt; // rolling drag
  car.speed = Math.max(-CAR.reverseMax, Math.min(CAR.forwardMax, car.speed));
  const dir = car.speed >= 0 ? 1 : -1;
  car.steer += (steerIn - car.steer) * Math.min(1, dt * 8);
  car.heading += car.steer * CAR.steer * dt * Math.min(1, Math.abs(car.speed) / 8) * dir;
  const dx = Math.sin(car.heading) * car.speed * dt;
  const dz = Math.cos(car.heading) * car.speed * dt;
  const nx = car.pos.x + dx;
  const nz = car.pos.z + dz;
  let hit = false;
  if (world.hitsBuilding(nx, nz, 2.2)) {
    hit = true;
    const slideX = Math.abs(Math.sin(car.heading)) > 0.25 && !world.hitsBuilding(nx, car.pos.z, 2.2);
    const slideZ = Math.abs(Math.cos(car.heading)) > 0.25 && !world.hitsBuilding(car.pos.x, nz, 2.2);
    if (slideX || slideZ) {
      const fixed = world.collide(
        slideX ? nx : car.pos.x,
        slideZ ? nz : car.pos.z,
        2.2,
      );
      car.pos.x = fixed.x;
      car.pos.z = fixed.z;
      car.speed *= 0.98; // scrape: keep most of the speed, lose a little
      hit = false;
    } else {
      // Dead head-on into the wall: bounce back a little and nudge the nose
      // away, so holding the throttle turns the car along the wall instead
      // of pinning it nose-first forever.
      car.speed *= -0.25;
      car.heading += 0.02;
    }
  } else {
    const fixed = world.collide(nx, nz, 2.2);
    car.pos.x = fixed.x;
    car.pos.z = fixed.z;
  }
  if (world.hitsBuilding(car.pos.x, car.pos.z, 1.2)) {
    const fixed = world.collide(car.pos.x, car.pos.z, 2.2);
    car.pos.x = fixed.x;
    car.pos.z = fixed.z;
    car.heading += 0.05;
    car.speed *= 0.6;
  }
  // v5 (g7): a hard hit dents the condition readout (−6). Presentation
  // only — condition never slows or disables the car (PLAN §5.3).
  if (hit) car.condition = Math.max(5, (car.condition ?? 100) - 6);
  syncCarMesh(car);
  return hit;
}

export function carSpeedKmh(car) {
  return Math.abs(car.speed) * 3.6;
}
