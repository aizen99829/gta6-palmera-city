// The Palmera PD helicopter: a low-poly visual pursuer (v3 R2). It carries
// NO gameplay weight — no heat, no busts, no damage; the cruiser economy in
// police.js is untouched. It appears once the wanted level reaches 3 stars,
// hovers behind-above the player, and throws a searchlight cone + ground
// spot onto them. Everything moves on accumulated fixed dt (heli.t), never
// on wall-clock time, so staged frames stay deterministic for a seed.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _dir = new THREE.Vector3();

export function createHeli(scene) {
  const group = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: 0xdfe5ea });
  const dark = new THREE.MeshLambertMaterial({ color: 0x232830 });
  // Two-tone body: white shell, dark belly, PD blue cheatline — it has to
  // read against an orange sky, so a dark-only body would go silhouette.
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.5, 3.6), white);
  group.add(body);
  const belly = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.5, 3.2), dark);
  belly.position.y = -0.55;
  group.add(belly);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.32, 2.6), new THREE.MeshLambertMaterial({ color: 0x2a5aa8 }));
  stripe.position.set(0, 0.05, -0.2);
  group.add(stripe);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.8, 0.9), new THREE.MeshLambertMaterial({ color: 0x9fc8dd }));
  glass.position.set(0, 0.15, 1.85);
  group.add(glass);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 3.4), white);
  boom.position.set(0, 0.25, -3.3);
  group.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.7), dark);
  fin.position.set(0, 0.6, -5.0);
  group.add(fin);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.05, 0.16), dark);
  tailRotor.position.set(0.16, 0.6, -5.0);
  group.add(tailRotor);
  // Skids: two rails on four short struts.
  const skidGeo = new THREE.BoxGeometry(0.14, 0.12, 3.2);
  const strutGeo = new THREE.BoxGeometry(0.1, 0.5, 0.1);
  for (const sx of [-0.95, 0.95]) {
    const skid = new THREE.Mesh(skidGeo, dark);
    skid.position.set(sx, -1.3, 0);
    group.add(skid);
    for (const sz of [-0.9, 0.9]) {
      const strut = new THREE.Mesh(strutGeo, dark);
      strut.position.set(sx, -1.0, sz);
      group.add(strut);
    }
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 6), dark);
  mast.position.y = 0.95;
  group.add(mast);
  // Main rotor: two crossed blades over a faint translucent blur disc —
  // the disc is what reads as "spinning rotor" in a still frame.
  const rotor = new THREE.Group();
  rotor.position.y = 1.22;
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const bladeA = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.05, 0.38), bladeMat);
  rotor.add(bladeA);
  const bladeB = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 7.4), bladeMat);
  rotor.add(bladeB);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(3.7, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide }),
  );
  disc.rotation.x = -Math.PI / 2;
  rotor.add(disc);
  group.add(rotor);
  group.visible = false;
  scene.add(group);
  // Searchlight: a unit-height open cone (scaled per aim) + a bright
  // ellipse where it lands. Both additive, both fog:false — at dusk the
  // beam must stay luminous across the frame.
  const cone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 2.3, 1, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffeeb0, transparent: true, opacity: 0.11, // v3 R3: eased down — at 0.15 the cone washed the sea band out of the cover
      blending: THREE.AdditiveBlending, depthWrite: false,
      side: THREE.DoubleSide, fog: false,
    }),
  );
  cone.visible = false;
  scene.add(cone);
  const spot = new THREE.Mesh(
    new THREE.CircleGeometry(2.7, 20),
    new THREE.MeshBasicMaterial({
      color: 0xffedb5, transparent: true, opacity: 0.38,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }),
  );
  spot.rotation.x = -Math.PI / 2;
  spot.visible = false;
  scene.add(spot);
  return {
    group, rotor, tailRotor, cone, spot,
    pos: { x: 0, z: 0 },
    heading: 0,
    alt: 16,
    t: 0,
    active: false,
  };
}

// Aim the cone from the heli's belly to a ground point and park the light
// ellipse there. The cone's +Y (narrow end) belongs at the heli.
function aimLight(heli, tx, tz) {
  _from.set(heli.pos.x, heli.alt - 0.8, heli.pos.z);
  _to.set(tx, 0.2, tz);
  _dir.subVectors(_from, _to);
  const len = Math.max(1, _dir.length());
  heli.cone.position.copy(_from).add(_to).multiplyScalar(0.5);
  heli.cone.scale.set(1, len, 1);
  heli.cone.quaternion.setFromUnitVectors(UP, _dir.normalize());
  heli.spot.position.set(tx, 0.18, tz);
}

function setVisible(heli, v) {
  heli.group.visible = v;
  heli.cone.visible = v;
  heli.spot.visible = v;
  heli.active = v;
}

// Deterministic staging for screenshots: exact spot, exact rotor angle,
// searchlight already on the target. No stepping required afterwards.
export function placeHeli(heli, x, alt, z, heading, lightX, lightZ, rotorAngle = 0.6) {
  heli.pos.x = x;
  heli.pos.z = z;
  heli.alt = alt;
  heli.heading = heading;
  heli.group.position.set(x, alt, z);
  heli.group.rotation.y = heading;
  heli.rotor.rotation.y = rotorAngle;
  heli.tailRotor.rotation.x = 0.8;
  setVisible(heli, true);
  aimLight(heli, lightX, lightZ);
}

// Live behaviour for one fixed step: at wanted >= 3 the heli fades in
// behind-above the target and tracks it; below that it leaves the frame.
// target = { x, z, heading }.
export function stepHeli(heli, dt, target, wanted) {
  heli.t += dt;
  if (wanted < 3 || !target) {
    if (heli.active) setVisible(heli, false);
    return;
  }
  const hx = target.heading || 0;
  const wantX = target.x - Math.sin(hx) * 11;
  const wantZ = target.z - Math.cos(hx) * 11;
  if (!heli.active) {
    // First appearance: snap to the hover point instead of flying in from
    // the world origin across half the city.
    heli.pos.x = wantX;
    heli.pos.z = wantZ;
    heli.heading = hx;
    setVisible(heli, true);
  }
  const k = Math.min(1, dt * 1.6);
  heli.pos.x += (wantX - heli.pos.x) * k;
  heli.pos.z += (wantZ - heli.pos.z) * k;
  let diff = hx - heli.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  heli.heading += diff * k;
  heli.alt = 16 + Math.sin(heli.t * 0.9) * 0.8; // gentle hover bob
  heli.group.position.set(heli.pos.x, heli.alt, heli.pos.z);
  heli.group.rotation.y = heli.heading;
  heli.rotor.rotation.y += dt * 22;
  heli.tailRotor.rotation.x += dt * 28;
  aimLight(heli, target.x, target.z);
}
