// vehicles.js — low-poly paneled cars and their arcade physics. One
// factory builds every kind (sedan, hatch, van, taxi, sport, police)
// from shared trim materials: sloped hood/trunk panels, a glass cabin
// band with dark pillars, mirrors, bumpers, spinning hubcap wheels and
// glowing brake lights. driveCar() is the only physics: acceleration,
// brake-then-reverse, speed-sensitive steering and wall push-out.
import * as THREE from 'three';
import { KINDS, CAR_TOP_SPEED, CAR_REVERSE_MAX } from './config.js';
import { radialGlowTexture, doorTexture } from './textures.js';
import { clamp, wrapAngle } from './random.js';

let shared = null;
function sharedMats() {
  if (shared) return shared;
  // Lambert everywhere on cars: flat sunset shading keeps the paneled
  // low-poly look and stays cheap to shade — no per-fragment specular
  // or environment sampling on dozens of small body panels.
  shared = {
    glass: new THREE.MeshLambertMaterial({ color: 0x2a3a4d, emissive: 0x0a1622 }),
    trim: new THREE.MeshLambertMaterial({ color: 0x1c1e26 }),
    chrome: new THREE.MeshLambertMaterial({ color: 0xd8dde6, emissive: 0x333a44 }),
    tyre: new THREE.MeshLambertMaterial({ color: 0x14151a }),
    white: new THREE.MeshLambertMaterial({ color: 0xf2f3f5 }),
    black: new THREE.MeshLambertMaterial({ color: 0x17181d }),
    glowTex: radialGlowTexture('rgba(255,255,255,1)'),
    doorTex: doorTexture(),
  };
  return shared;
}
function box(w, h, d, mat, x, y, z, rx = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.x = rx;
  return m;
}
function glowSprite(color, scale, opacity) {
  const s = sharedMats();
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: s.glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  sp.scale.setScalar(scale);
  return sp;
}

// ---- merged-geometry painting -------------------------------------
// Every static panel of a car is baked into ONE vertex-coloured
// geometry, so a whole car costs a single draw call instead of one
// per panel. Only wheels (which spin), glow sprites and the police
// light bar stay separate.
const paintedMat = new THREE.MeshLambertMaterial({ vertexColors: true });
function paintGeo(list, geo, colorHex, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (colorHex !== null && colorHex !== undefined) {
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    const c = new THREE.Color(colorHex);
    for (let i = 0; i < n; i += 1) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
  m.setPosition(x, y, z);
  g.applyMatrix4(m);
  list.push(g);
}
function pBox(list, w, h, d, color, x, y, z, rx = 0) {
  paintGeo(list, new THREE.BoxGeometry(w, h, d), color, x, y, z, rx, 0, 0);
}
function mergeGeos(list) {
  let total = 0;
  for (const g of list) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let o = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
let wheelGeoShared = null;
function sharedWheelGeo() {
  if (wheelGeoShared) return wheelGeoShared;
  const parts = [];
  paintGeo(parts, new THREE.CylinderGeometry(0.36, 0.36, 0.24, 12), 0x14151a, 0, 0, 0, 0, 0, Math.PI / 2);
  paintGeo(parts, new THREE.CylinderGeometry(0.2, 0.2, 0.26, 10), 0xd8dde6, 0, 0, 0, 0, 0, Math.PI / 2);
  wheelGeoShared = mergeGeos(parts);
  return wheelGeoShared;
}
const COL = { glass: 0x2a3a4d, trim: 0x1c1e26, chrome: 0xd8dde6, white: 0xf2f3f5, black: 0x17181d };

export function makeCarMesh(kind, color, opts = {}) {
  const s = sharedMats();
  const K = KINDS[kind];
  const g = new THREE.Group();
  const paint = kind === 'police' ? COL.white : color;
  const darkPaint = kind === 'police' ? COL.black : paint;
  const w = K.w; const l = K.l; const bodyY = 0.42 + K.h / 2;
  const parts = [];
  pBox(parts, w, K.h, l, paint, 0, bodyY, 0);                                   // main body
  pBox(parts, w * 0.94, 0.16, l * 0.3, paint, 0, bodyY + K.h / 2 + 0.02, l * 0.3, kind === 'sport' ? -0.17 : -0.11); // sloped hood
  pBox(parts, w * 0.94, 0.16, l * 0.26, paint, 0, bodyY + K.h / 2 + 0.02, -l * 0.32, kind === 'hatch' ? 0.34 : 0.11); // sloped trunk
  const cabL = kind === 'van' ? l * 0.62 : l * 0.48;
  const cabZ = kind === 'van' ? l * 0.1 : -l * 0.04;
  pBox(parts, w * 0.86, K.cabinH, cabL, paint, 0, bodyY + K.h / 2 + K.cabinH / 2, cabZ); // cabin shell
  pBox(parts, w * 0.88, K.cabinH * 0.52, cabL * 0.94, COL.glass, 0, bodyY + K.h / 2 + K.cabinH * 0.55, cabZ); // glass band
  for (const pz of [-1, 1]) // dark pillars at both ends of the glass band
    pBox(parts, w * 0.88, K.cabinH * 0.6, 0.09, COL.trim, 0, bodyY + K.h / 2 + K.cabinH * 0.5, cabZ + pz * cabL * 0.44);
  for (const mx of [-1, 1]) // mirrors
    pBox(parts, 0.16, 0.1, 0.08, COL.trim, mx * (w / 2 + 0.08), bodyY + K.h / 2 + K.cabinH * 0.45, cabZ + cabL * 0.42);
  pBox(parts, w * 0.98, 0.22, 0.18, COL.trim, 0, 0.42, l / 2 + 0.04);             // front bumper
  pBox(parts, w * 0.98, 0.22, 0.18, COL.trim, 0, 0.42, -l / 2 - 0.04);            // rear bumper
  pBox(parts, w * 0.5, 0.14, 0.06, COL.trim, 0, 0.62, l / 2 + 0.12);              // grille slot
  if (kind !== 'sport') pBox(parts, w * 0.96, 0.14, l * 0.8, COL.trim, 0, 0.3, 0); // side skirts base
  else { // sport kit: skirts, splitter, spoiler, twin exhausts
    for (const mx of [-1, 1]) pBox(parts, 0.08, 0.16, l * 0.7, COL.trim, mx * (w / 2 + 0.02), 0.3, 0);
    pBox(parts, w * 1.02, 0.1, 0.3, COL.trim, 0, 0.3, l / 2 + 0.1);
    for (const mx of [-1, 1]) pBox(parts, 0.09, 0.34, 0.09, COL.trim, mx * w * 0.32, bodyY + K.h / 2 + 0.2, -l / 2 + 0.14);
    pBox(parts, w * 0.92, 0.07, 0.42, darkPaint, 0, bodyY + K.h / 2 + 0.4, -l / 2 + 0.14);
    for (const mx of [-1, 1])
      paintGeo(parts, new THREE.CylinderGeometry(0.055, 0.055, 0.22, 8), COL.chrome, mx * 0.4, 0.3, -l / 2 - 0.1, Math.PI / 2, 0, 0);
  }
  if (kind === 'van') { // recessed cargo panels + rear door split + roof pod
    const shade = new THREE.Color(color).multiplyScalar(0.72).getHex();
    for (const mx of [-1, 1]) pBox(parts, 0.04, K.h * 0.62, l * 0.5, shade, mx * (w / 2 + 0.01), bodyY + 0.05, -l * 0.16);
    pBox(parts, 0.05, K.h * 0.9, 0.05, COL.trim, 0, bodyY, -l / 2 - 0.01);
    pBox(parts, w * 0.5, 0.18, l * 0.3, shade, 0, bodyY + K.h / 2 + K.cabinH + 0.32, -l * 0.1);
  }
  if (kind === 'taxi') pBox(parts, 0.7, 0.2, 0.3, 0xffd76a, 0, bodyY + K.h / 2 + K.cabinH + 0.12, cabZ);
  if (kind === 'police') pBox(parts, w * 0.7, 0.13, 0.34, COL.trim, 0, bodyY + K.h / 2 + K.cabinH + 0.1, cabZ); // light bar base
  // Wheels: baked into the body geometry for parked cars (they never
  // spin), separate spinning meshes for cars that drive themselves.
  const wheels = [];
  const wheelAt = [[-w / 2, l * 0.32], [w / 2, l * 0.32], [-w / 2, -l * 0.32], [w / 2, -l * 0.32]];
  if (opts.static) {
    for (const [wx, wz] of wheelAt) paintGeo(parts, sharedWheelGeo(), null, wx, 0.36, wz);
  }
  g.add(new THREE.Mesh(mergeGeos(parts), paintedMat));
  if (!opts.static) {
    for (const [wx, wz] of wheelAt) {
      const holder = new THREE.Group();
      holder.add(new THREE.Mesh(sharedWheelGeo(), paintedMat));
      holder.position.set(wx, 0.36, wz);
      g.add(holder); wheels.push(holder);
    }
  }
  // Headlight + brake glow sprites (moving cars only).
  let tailGlow = null;
  if (!opts.static) {
    tailGlow = glowSprite(0xff2a2a, 1.5, 0.0);
    tailGlow.position.set(0, 0.72, -l / 2 - 0.25); g.add(tailGlow);
    const headGlow = glowSprite(0xffe9b0, 1.7, 0.35);
    headGlow.position.set(0, 0.72, l / 2 + 0.25); g.add(headGlow);
  }
  if (kind === 'sport' && !opts.static) { // neon underglow, kept small
    const ug = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, l * 0.7),
      new THREE.MeshBasicMaterial({ map: s.glowTex, color: 0xff2d95, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
    ug.rotation.x = -Math.PI / 2; ug.position.y = 0.13; g.add(ug);
  }
  let beaconL = null; let beaconR = null;
  if (kind === 'police') {
    beaconL = box(0.42, 0.12, 0.3, new THREE.MeshBasicMaterial({ color: 0xff2040 }), -w * 0.18, bodyY + K.h / 2 + K.cabinH + 0.2, cabZ);
    beaconR = box(0.42, 0.12, 0.3, new THREE.MeshBasicMaterial({ color: 0x2266ff }), w * 0.18, bodyY + K.h / 2 + K.cabinH + 0.2, cabZ);
    g.add(beaconL); g.add(beaconR);
    const gl = glowSprite(0xff3050, 2.6, 0.5); gl.position.copy(beaconL.position); g.add(gl);
    const gr = glowSprite(0x3377ff, 2.6, 0.5); gr.position.copy(beaconR.position); g.add(gr);
    beaconL.userData.glow = gl; beaconR.userData.glow = gr;
    for (const mx of [-1, 1]) { // PALMERA PD door lettering
      const door = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.48),
        new THREE.MeshBasicMaterial({ map: s.doorTex, transparent: true }));
      door.position.set(mx * (w / 2 + 0.012), bodyY, 0.1);
      door.rotation.y = mx > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(door);
    }
    // Red/blue reflection streak on the asphalt under the cruiser.
    const streak = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 6),
      new THREE.MeshBasicMaterial({ map: s.glowTex, color: 0xb050ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    streak.rotation.x = -Math.PI / 2; streak.position.y = 0.12; g.add(streak);
  }
  return { group: g, wheels, tailGlow, beaconL, beaconR };
}

export function createCar(scene, kind, color, x, z, heading = 0, opts = {}) {
  const mesh = makeCarMesh(kind, color, opts);
  scene.add(mesh.group);
  return {
    kind, color, pos: { x, z }, heading, speed: 0, steerVis: 0,
    condition: 100, parked: false, stolen: false, playerDriven: false,
    callsign: null, role: 'chase', mesh: mesh.group, wheels: mesh.wheels,
    tailGlow: mesh.tailGlow, beaconL: mesh.beaconL, beaconR: mesh.beaconR,
    hitCooldown: 0, wheelSpin: 0,
  };
}

// Arcade drive step. input: {forward, back, left, right, brake}.
// Returns true on a hard wall hit this step.
export function driveCar(car, input, dt, world) {
  const K = KINDS[car.kind];
  const throttle = input.forward ? 1 : 0;
  if (throttle) { // taper only in the last stretch, with a floor so the
    // car genuinely reaches (and clamps at) the 38.00 top speed
    const taper = clamp((CAR_TOP_SPEED - Math.max(0, car.speed)) / 3, 0.25, 1);
    car.speed += K.accel * dt * taper;
  }
  if (input.back) {
    if (car.speed > 0.4) { // brake first…
      car.speed -= 30 * dt;
      car.reverseHold = 0;
    } else { // …then reverse, but only once the pedal has been held
      // continuously at a standstill for a beat — a short brake tap
      // stops the car and leaves it stopped instead of blowing
      // through zero into a runaway reverse.
      if (car.speed > 0) car.speed = 0;
      car.reverseHold = (car.reverseHold || 0) + dt;
      if (car.reverseHold >= 0.8) car.speed = Math.max(-CAR_REVERSE_MAX, car.speed - 9 * dt);
    }
  } else car.reverseHold = 0;
  if (input.brake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 34 * dt);
  if (!throttle && !input.back) { // gentle rolling drag: a coasting car
    // keeps its speed for a while instead of dying in two seconds
    car.speed -= car.speed * 0.22 * dt;
    if (Math.abs(car.speed) < 0.04) car.speed = 0;
  }
  car.speed = clamp(car.speed, -CAR_REVERSE_MAX, CAR_TOP_SPEED);
  const steerIn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  // Steering bite scales with speed but keeps a floor while rolling, so
  // a car nosed into an obstacle can still pivot away at a crawl
  // instead of grinding straight into it forever. The turn rate itself
  // is deliberately gentle: a held steer input must curve the car,
  // never whip it around inside one input sample.
  let bite = clamp(car.speed / 11, -1, 1);
  if ((input.forward || input.back) && Math.abs(car.speed) > 0.05 && Math.abs(bite) < 0.5) {
    bite = Math.sign(car.speed) * 0.5;
  }
  car.heading = wrapAngle(car.heading + steerIn * 0.95 * dt * bite);
  car.steerVis = steerIn;
  const nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
  const probe = { x: nx, z: nz };
  const hit = world.collide(probe, 1.55);
  if (hit) {
    const hard = Math.abs(car.speed) > 7;
    car.pos.x = probe.x; car.pos.z = probe.z;
    car.speed *= hard ? 0.3 : 0.55;
    if (hard) car.condition = Math.max(5, car.condition - 6);
    return hard;
  }
  car.pos.x = nx; car.pos.z = nz;
  return false;
}

export function syncCarMesh(car, time) {
  car.mesh.position.set(car.pos.x, 0, car.pos.z);
  car.mesh.rotation.y = car.heading;
  car.wheelSpin += car.speed * 0.045;
  for (const w of car.wheels) w.rotation.x = car.wheelSpin;
  if (car.tailGlow) car.tailGlow.material.opacity = car.speed > 0.2 ? 0.35 : 0.55;
  if (car.beaconL && car.beaconR) { // alternating light-bar flash
    const phase = Math.floor(time * 3.6) % 2 === 0;
    car.beaconL.material.color.setHex(phase ? 0xff2040 : 0x5a0f1c);
    car.beaconR.material.color.setHex(phase ? 0x112a66 : 0x2266ff);
    car.beaconL.userData.glow.material.opacity = phase ? 0.75 : 0.12;
    car.beaconR.userData.glow.material.opacity = phase ? 0.12 : 0.75;
  }
}
