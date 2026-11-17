// Cars: one factory builds every car (player, traffic, police) from boxes and
// cylinders, so the whole fleet shares one look. Driving is arcade: forward
// speed, steering that bites harder at low speed, braking and reverse, with
// building collision and a soft world edge. A car is { mesh, pos, heading,
// speed, colour, police, parked, driver }.
import * as THREE from 'three';
import { CAR, PALETTE } from './config.js';

export function makeCarMesh(color, police) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.6, 2.2),
    new THREE.MeshLambertMaterial({ color: police ? PALETTE.policeBlack : 0x22303c }),
  );
  cabin.position.set(0, 1.15, -0.2);
  group.add(cabin);
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
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    group.add(w);
    wheels.push(w);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.2), new THREE.MeshBasicMaterial({ color: 0xfff6c8 }));
  head.position.set(0, 0.6, 2.22);
  group.add(head);
  return { group, wheels };
}

export function createCar(scene, x, z, heading, color, police) {
  const { group, wheels } = makeCarMesh(color, police);
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
