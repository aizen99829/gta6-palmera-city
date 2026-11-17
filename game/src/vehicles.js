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
};

export function makeCarMesh(color, police, kind = 'sedan') {
  const K = KINDS[kind] || KINDS.sedan;
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
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
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.6, K.cabLen),
      new THREE.MeshLambertMaterial({ color: police ? PALETTE.policeBlack : 0x22303c }),
    );
    cabin.position.set(0, 1.15, K.cabZ);
    group.add(cabin);
    // R3: the cabin read as a plain black slab on dark traffic cars. A pale
    // roof slab + pale-blue glass front/rear give every car a two-tone
    // glasshouse, so traffic reads as cars from behind and above, not boxes.
    const roofSlab = new THREE.Mesh(
      new THREE.BoxGeometry(1.74, 0.08, K.cabLen - 0.2),
      new THREE.MeshLambertMaterial({ color: police ? PALETTE.policeWhite : 0xe8eef2 }),
    );
    roofSlab.position.set(0, 1.49, K.cabZ);
    group.add(roofSlab);
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fc8dd });
    const shield = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 0.06), glassMat);
    shield.position.set(0, 1.15, K.cabZ + K.cabLen / 2 + 0.03);
    shield.rotation.x = -0.28;
    group.add(shield);
    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 0.06), glassMat);
    rearGlass.position.set(0, 1.15, K.cabZ - K.cabLen / 2 - 0.03);
    rearGlass.rotation.x = 0.28;
    group.add(rearGlass);
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
  const wheelGeo = new THREE.CylinderGeometry(K.wheelR, K.wheelR, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  // (Hubcap discs were tried in R2 and cut the same round: +4 draw calls
  // per car for a detail invisible beyond a few metres — the perf probe
  // priced them, the screenshots couldn't show them.)
  const wheels = [];
  for (const [wx, wz] of [[-0.95, K.wheelZ], [0.95, K.wheelZ], [-0.95, -K.wheelZ], [0.95, -K.wheelZ]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, K.wheelR, wz);
    group.add(w);
    wheels.push(w);
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
