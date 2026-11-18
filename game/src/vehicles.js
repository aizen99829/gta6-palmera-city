// Cars: one factory builds every car (player, traffic, police) from boxes and
// cylinders, so the whole fleet shares one look. Driving is arcade: forward
// speed, steering that bites harder at low speed, braking and reverse, with
// building collision and a soft world edge. A car is { mesh, pos, heading,
// speed, colour, police, parked, driver }.
import * as THREE from 'three';
import { CAR, PALETTE } from './config.js';

// v2 body styles: v1 built every car as the same sedan, so traffic was one
// silhouette in different colours. Traffic now also comes as a shorter
// hatchback and a tall van; the player car and the cruisers stay sedans.
const KINDS = {
  sedan: { len: 4.4, bodyW: 2, bodyH: 0.7, bodyY: 0.55, cabLen: 2.2, cabZ: -0.2, wheelZ: 1.4, wheelR: 0.38 },
  hatch: { len: 3.6, bodyW: 2, bodyH: 0.7, bodyY: 0.55, cabLen: 2.4, cabZ: -0.05, wheelZ: 1.1, wheelR: 0.36 },
  van: { len: 4.6, bodyW: 2.1, bodyH: 1.45, bodyY: 1.0, cabLen: 0, cabZ: 0, wheelZ: 1.5, wheelR: 0.45 },
  // v3 R2 hero car: low + wide body, cabin wedged far back, big wheels.
  sport: { len: 4.7, bodyW: 2.15, bodyH: 0.52, bodyY: 0.48, cabLen: 1.9, cabZ: -0.55, wheelZ: 1.55, wheelR: 0.4 },
};

// v3 R2 glow kit: one shared radial-gradient canvas texture; every glow is
// an additive sprite (or a flat additive ellipse on the asphalt) tinted per
// use. No postprocessing, no lights — a handful of cheap transparent quads
// fake the bloom the top-10 covers wear.
let glowTextureCache = null;
function glowTexture() {
  if (glowTextureCache) return glowTextureCache;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.38)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTextureCache = new THREE.CanvasTexture(c);
  glowTextureCache.colorSpace = THREE.SRGBColorSpace;
  return glowTextureCache;
}

function addGlowSprite(group, color, x, y, z, sx, sy, opacity) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color, blending: THREE.AdditiveBlending,
    transparent: true, opacity, depthWrite: false, fog: false,
  }));
  s.position.set(x, y, z);
  s.scale.set(sx, sy, 1);
  group.add(s);
  return s;
}

export function makeCarMesh(color, police, kind = 'sedan') {
  const K = KINDS[kind] || KINDS.sedan;
  const group = new THREE.Group();
  // v3 R2: only the sport kind pays for Phong — a shiny hero paint with a
  // warm specular is what separates it from the Lambert fleet at a glance.
  const bodyMat = kind === 'sport'
    ? new THREE.MeshPhongMaterial({ color, shininess: 90, specular: 0xcc8855 })
    : new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(K.bodyW, K.bodyH, K.len), bodyMat);
  body.position.y = K.bodyY;
  group.add(body);
  if (kind === 'van') {
    // A van's body IS its cabin: it only needs a windshield, a side stripe
    // and its lights to read as a van and not a crate.
    const glassMatV = new THREE.MeshLambertMaterial({ color: 0x9fc8dd });
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
  } else {
    // v3 R2: the sport cabin sits lower and further back (wedge profile);
    // the other kinds keep the v2 glasshouse dimensions.
    const cabW = kind === 'sport' ? 1.62 : 1.7;
    const cabH = kind === 'sport' ? 0.5 : 0.6;
    const cabY = kind === 'sport' ? 1.0 : 1.15;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(cabW, cabH, K.cabLen),
      new THREE.MeshLambertMaterial({ color: police ? PALETTE.policeBlack : 0x22303c }),
    );
    cabin.position.set(0, cabY, K.cabZ);
    group.add(cabin);
    // R3: the cabin read as a plain black slab on dark traffic cars. A pale
    // roof slab + pale-blue glass front/rear give every car a two-tone
    // glasshouse, so traffic reads as cars from behind and above, not boxes.
    // v3.1: the sport slab is body-coloured (and slightly narrower than the
    // cabin, so the dark glasshouse edges frame it), so roof + body read as
    // one continuous coupe roofline from the rear-top chase angle instead
    // of a pale panel floating over the black cabin ("targa"). Other kinds
    // keep the pale slab — the R3 fix for black cabins on dark cars.
    const sportRoof = kind === 'sport' && !police;
    const roofSlab = new THREE.Mesh(
      new THREE.BoxGeometry(sportRoof ? cabW - 0.12 : cabW + 0.04, 0.08, K.cabLen - 0.2),
      new THREE.MeshLambertMaterial({
        color: police ? PALETTE.policeWhite : sportRoof ? color : 0xe8eef2,
      }),
    );
    roofSlab.position.set(0, cabY + cabH / 2 + 0.04, K.cabZ);
    group.add(roofSlab);
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fc8dd });
    const shield = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 0.06), glassMat);
    shield.position.set(0, cabY, K.cabZ + K.cabLen / 2 + 0.03);
    shield.rotation.x = -0.28;
    group.add(shield);
    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 0.06), glassMat);
    rearGlass.position.set(0, cabY, K.cabZ - K.cabLen / 2 - 0.03);
    rearGlass.rotation.x = 0.28;
    group.add(rearGlass);
    if (kind === 'sport') {
      // Rear spoiler: a thin dark plate on two short struts — the single
      // silhouette cue that reads "sports car" from the chase camera.
      const spoilerMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
      for (const sx of [-0.72, 0.72]) {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.14), spoilerMat);
        strut.position.set(sx, 0.88, -K.len / 2 + 0.35);
        group.add(strut);
      }
      const plate = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.07, 0.5), spoilerMat);
      plate.position.set(0, 1.08, -K.len / 2 + 0.35);
      plate.rotation.x = -0.12;
      group.add(plate);
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
    // v3 R2 glow kit on the cruiser: a coloured halo sprite over each
    // beacon plus a soft coloured light pool on the asphalt under each
    // side. syncCarMesh pulses them from the car's simulation clock.
    const glowL = addGlowSprite(group, 0xff2a2a, -0.43, 2.0, -0.2, 2.6, 2.6, 0.8);
    const glowR = addGlowSprite(group, 0x3366ff, 0.43, 2.0, -0.2, 2.6, 2.6, 0.15);
    const poolGeo = new THREE.CircleGeometry(1.5, 16);
    const poolL = new THREE.Mesh(poolGeo, new THREE.MeshBasicMaterial({
      color: 0xff2a2a, transparent: true, opacity: 0.2,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    poolL.rotation.x = -Math.PI / 2;
    poolL.scale.set(1.1, 1.9, 1);
    poolL.position.set(-0.9, 0.17, 0);
    group.add(poolL);
    const poolR = new THREE.Mesh(poolGeo, new THREE.MeshBasicMaterial({
      color: 0x3366ff, transparent: true, opacity: 0.05,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    poolR.rotation.x = -Math.PI / 2;
    poolR.scale.set(1.1, 1.9, 1);
    poolR.position.set(0.9, 0.17, 0);
    group.add(poolR);
    group.userData.beaconL = beaconL;
    group.userData.beaconR = beaconR;
    group.userData.glowL = glowL;
    group.userData.glowR = glowR;
    group.userData.poolL = poolL;
    group.userData.poolR = poolR;
    // Black hood + trunk lid: white body, black cabin, black ends — the
    // cruiser is a high-contrast black-and-white, not a plain white box.
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 1.1), new THREE.MeshLambertMaterial({ color: PALETTE.policeBlack }));
    hood.position.set(0, 0.92, 1.65);
    group.add(hood);
  }
  const wheelGeo = new THREE.CylinderGeometry(K.wheelR, K.wheelR, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  // (Hubcap discs were tried in R2 and cut the same round: +4 draw calls
  // per car for a detail invisible beyond a few metres — the perf probe
  // priced them, the screenshots couldn't show them.)
  const wheels = [];
  const wheelX = K.bodyW / 2 - 0.1;
  // v3 R2: the sport kind DOES get readable wheels — a bright silver rim
  // disc + dark hub per wheel. The hero car sits close to the R2 cameras,
  // where the detail finally survives the downscale; the fleet keeps the
  // plain tyre to protect the draw-call budget.
  const rimGeo = kind === 'sport' ? new THREE.CylinderGeometry(0.23, 0.23, 0.34, 12) : null;
  const rimMat = kind === 'sport' ? new THREE.MeshLambertMaterial({ color: 0xd9dee2 }) : null;
  const hubGeo = kind === 'sport' ? new THREE.CylinderGeometry(0.09, 0.09, 0.37, 8) : null;
  const hubMat = kind === 'sport' ? new THREE.MeshLambertMaterial({ color: 0x2a2d30 }) : null;
  for (const [wx, wz] of [[-wheelX, K.wheelZ], [wheelX, K.wheelZ], [-wheelX, -K.wheelZ], [wheelX, -K.wheelZ]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, K.wheelR, wz);
    group.add(w);
    wheels.push(w);
    if (rimGeo) {
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.z = Math.PI / 2;
      rim.position.set(wx, K.wheelR, wz);
      group.add(rim);
      wheels.push(rim);
      const hub = new THREE.Mesh(hubGeo, hubMat);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(wx, K.wheelR, wz);
      group.add(hub);
      wheels.push(hub);
    }
  }
  // R3 blob shadow: a soft dark ellipse under the car, so it sits on the
  // road instead of floating on it. (A real shadow map was measured and
  // rejected: −46%/−61% FPS in swiftshader — see world.js.)
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
  // v3 R2: a warm headlight halo in front of every lit car — the sprite
  // sells "lights on at dusk" for one draw call per car.
  addGlowSprite(group, 0xffd9a0, 0, 0.62, K.len / 2 + 0.4, 2.9, 1.5, 0.32);
  // Taillights mirror the headlights.
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.16, 0.1), new THREE.MeshBasicMaterial({ color: 0xcc2222 }));
  tail.position.set(0, 0.6, -K.len / 2 - 0.02);
  group.add(tail);
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
    parked: false,
    driver: null, // 'player' | 'traffic' | 'police' | null
    steer: 0,
    stuck: 0,
    t: 0, // simulation clock (accumulated dt in the step functions) — the
    // glow/beacon pulse phase reads this, never performance.now, so a
    // staged frame is identical for a given seed.
  };
}

export function syncCarMesh(car) {
  car.mesh.position.set(car.pos.x, 0, car.pos.z);
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * 0.06;
  for (const w of car.wheels) w.rotation.x += spin;
  // Alternating beacons + glow pulse, phased by the car's simulation clock
  // (car.t accumulates fixed dt in drive/stepTraffic/stepPolice; shots set
  // it explicitly). v2 read performance.now here, which made the beacon
  // phase — and now the glow — non-deterministic between identical runs.
  const u = car.mesh.userData;
  if (u.beaconL && u.beaconR) {
    const phase = Math.floor((car.t || 0) / 0.28) % 2;
    u.beaconL.material.color.setHex(phase === 0 ? 0xff2222 : 0x661111);
    u.beaconR.material.color.setHex(phase === 0 ? 0x112266 : 0x2266ff);
    if (u.glowL && u.glowR) {
      u.glowL.material.opacity = phase === 0 ? 0.85 : 0.12;
      u.glowR.material.opacity = phase === 0 ? 0.12 : 0.85;
      u.poolL.material.opacity = phase === 0 ? 0.22 : 0.04;
      u.poolR.material.opacity = phase === 0 ? 0.04 : 0.22;
    }
  }
}

// Player-driven car physics for one fixed step. Returns true on a hard hit.
export function driveCar(car, input, dt, world) {
  car.t = (car.t || 0) + dt;
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
    // Slide along the wall: try the move one axis at a time, so a glancing
    // hit glides down the facade instead of stopping the car dead. The test
    // is on the nose's direction, not the step size — a car pinned head-on
    // crawls at ~0 speed, so a step-size test would never let it slide even
    // after the nose has turned away from the wall. The 0.25 bar means the
    // nose turns ~15° off the wall before the slide starts, so the slide
    // actually carries the car along the facade instead of creeping.
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
  // Nudge-out: if the car's core is already inside a building (pushed in by
  // a ram, or spawned nose-to-wall), shove it clear and turn it away. The
  // small radius means kerb-hugging never triggers this.
  if (world.hitsBuilding(car.pos.x, car.pos.z, 1.2)) {
    const fixed = world.collide(car.pos.x, car.pos.z, 2.2);
    car.pos.x = fixed.x;
    car.pos.z = fixed.z;
    car.heading += 0.05;
    car.speed *= 0.6;
  }
  syncCarMesh(car);
  return hit;
}

export function carSpeedKmh(car) {
  return Math.abs(car.speed) * 3.6;
}
