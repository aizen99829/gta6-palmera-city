// v5 procedural canvas textures — every texture in the overhaul is drawn
// here on a 2D canvas (PLAN §5.3: no external assets, nothing over 1024 px).
// A tiny fixed-seed LCG provides the anti-banding dither so the sky gradient
// renders identically on every load (deterministic screenshots).
import * as THREE from 'three';
import { SUNSET } from './config.js';

function ditherNoise() {
  let a = 123456789;
  return () => {
    a = (Math.imul(a, 1103515245) + 12345) | 0;
    return ((a >>> 9) & 0xffff) / 0xffff;
  };
}

// v5.2 (sharpness): anisotropic filtering budget, set once from the
// renderer's capabilities in main.js before the world is built. Textures
// sampled at grazing angles (facades, road streaks, signs) stay legible
// instead of smearing; untextured materials are unaffected.
let maxAnisotropy = 1;
export function setMaxAnisotropy(n) {
  maxAnisotropy = Math.max(1, Math.floor(n) || 1);
}
export function getMaxAnisotropy() {
  return maxAnisotropy;
}

function canvasTex(c) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function skyTexture() {
  const W = 512;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, SUNSET.skyTop);
  grad.addColorStop(0.26, SUNSET.skyMid);
  grad.addColorStop(0.4, SUNSET.skyPink);
  grad.addColorStop(0.5, SUNSET.skyOrange);
  grad.addColorStop(0.58, '#e88ca0');
  grad.addColorStop(1, SUNSET.skyBelow);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  const [sx, sy, sz] = SUNSET.sunPos;
  const len = Math.hypot(sx, sy, sz);
  const u = Math.atan2(sz / len, -sx / len) / (Math.PI * 2);
  const px = ((u % 1) + 1) % 1 * W;
  const py = Math.acos(Math.min(1, Math.max(-1, sy / len))) / Math.PI * H;
  // v5.2 (visual): a sun that reads at street distance — wider halo,
  // bigger disc, white-hot centre. The old 17px core inside a 150px glow
  // was the rejected frame's flat-gradient sky.
  const glow = g.createRadialGradient(px, py, 4, px, py, 210);
  glow.addColorStop(0, 'rgba(255,246,210,0.95)');
  glow.addColorStop(0.25, 'rgba(255,190,110,0.6)');
  glow.addColorStop(1, 'rgba(255,140,80,0)');
  g.fillStyle = glow;
  g.fillRect(px - 220, py - 220, 440, 440);
  g.fillStyle = SUNSET.sunCore;
  g.beginPath();
  g.arc(px, py, 30, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,252,238,0.95)';
  g.beginPath();
  g.arc(px, py, 15, 0, Math.PI * 2);
  g.fill();
  // ±2 dither against gradient banding (PLAN §5.2) — fixed seed, so the
  // texture is byte-stable between loads.
  const rnd = ditherNoise();
  const img = g.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 4;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  // v5.2 (visual): warm saturated grade on the sky itself, guarded —
  // where canvas filters are unavailable the drawn grade stands as-is.
  try {
    if (typeof g.filter === 'string') {
      g.filter = 'saturate(1.28) contrast(1.05)';
      g.drawImage(c, 0, 0);
      g.filter = 'none';
    }
  } catch { /* filter unsupported: keep the ungraded sky */ }
  const tex = canvasTex(c);
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

// Soft radial glow sprite texture (sun halo, beacon glows, headlight glow).
export function radialGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return canvasTex(c);
}

let cubeCache = null;
export function sunsetCubeTexture() {
  if (cubeCache) return cubeCache;
  const face = (top, mid, bot) => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, top);
    grad.addColorStop(0.55, mid);
    grad.addColorStop(1, bot);
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return c;
  };
  const side = () => face('#5a2d6d', '#ff8c5a', '#241a30');
  const images = [
    side(), side(),
    face('#ff9ec6', '#ffb347', '#ff8c5a'), // up: bright sky
    face('#1c1428', '#241a30', '#120c1c'), // down: dark street
    side(), side(),
  ];
  cubeCache = new THREE.CubeTexture(images);
  cubeCache.colorSpace = THREE.SRGBColorSpace;
  cubeCache.needsUpdate = true;
  return cubeCache;
}

// Palm frond texture (d1): pinnate leaflets drawn along a spine, alpha-tested.
export function frondTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 256);
  const leaf = g.createLinearGradient(0, 256, 0, 0);
  leaf.addColorStop(0, '#2c7a34');
  leaf.addColorStop(1, '#3fa34d');
  g.fillStyle = leaf;
  g.beginPath();
  g.moveTo(64, 252);
  g.quadraticCurveTo(14, 150, 64, 6);
  g.quadraticCurveTo(114, 150, 64, 252);
  g.fill();
  g.strokeStyle = 'rgba(20,60,24,0.55)';
  g.lineWidth = 3;
  for (let i = 0; i < 16; i += 1) {
    const y = 240 - i * 14;
    const len = 44 * (1 - i / 22) + 6;
    g.beginPath();
    g.moveTo(64, y);
    g.lineTo(64 - len, y - 16);
    g.stroke();
    g.beginPath();
    g.moveTo(64, y);
    g.lineTo(64 + len, y - 16);
    g.stroke();
  }
  g.strokeStyle = '#256b2c';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(64, 252);
  g.lineTo(64, 8);
  g.stroke();
  const tex = canvasTex(c);
  tex.wrapS = THREE.RepeatWrapping; // d4 sway animates map.offset.x
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function streakTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 256);
  const side = g.createLinearGradient(0, 0, 64, 0);
  side.addColorStop(0, 'rgba(0,0,0,1)');
  side.addColorStop(0.5, 'rgba(0,0,0,0)');
  side.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = side;
  g.fillRect(0, 0, 64, 256);
  return canvasTex(c);
}

// Two-colour cruiser streak (b3): red half, blue half, same soft falloff.
export function cruiserStreakTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.75, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = '#ff3040';
  g.fillRect(0, 0, 64, 256);
  g.fillStyle = '#3060ff';
  g.fillRect(64, 0, 64, 256);
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 256);
  return canvasTex(c);
}

export function billboardTexture(lines, bg, fg, accent) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 256);
  const parts = lines.split(' — ');
  g.textAlign = 'center';
  g.fillStyle = fg;
  g.font = '900 44px system-ui, sans-serif';
  const main = parts[0];
  // Shrink to fit long names.
  let size = 44;
  while (g.measureText(main).width > 470 && size > 20) {
    size -= 4;
    g.font = `900 ${size}px system-ui, sans-serif`;
  }
  g.fillText(main, 256, parts.length > 1 ? 108 : 138);
  if (parts.length > 1) {
    g.font = '700 30px system-ui, sans-serif';
    g.fillStyle = accent;
    g.fillText(parts.slice(1).join(' — '), 256, 162);
  }
  g.fillStyle = accent;
  g.fillRect(56, 196, 400, 8);
  return canvasTex(c);
}

// Small lit shop sign (e2): one line of neon text on dark glass.
export function shopSignTexture(name, fg) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#14101f';
  g.fillRect(0, 0, 256, 64);
  g.textAlign = 'center';
  g.fillStyle = fg;
  let size = 30;
  g.font = `800 ${size}px system-ui, sans-serif`;
  while (g.measureText(name).width > 240 && size > 14) {
    size -= 2;
    g.font = `800 ${size}px system-ui, sans-serif`;
  }
  g.fillText(name, 128, 42);
  return canvasTex(c);
}

// v5.3 (wet road): procedural asphalt — the road planes used to be flat
// colour with no map, so the near-camera field read matte and anisotropy
// had nothing to sharpen. The canvas is drawn near-white on purpose: the
// road material's colour multiplies it, so the tint stays PALETTE.asphalt
// while grain, patches and fine cracks ride on top. Deterministic LCG
// noise (same helper family as the sky dither) — byte-stable per load.
export function asphaltTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  const rnd = ditherNoise();
  g.fillStyle = '#eae5ec';
  g.fillRect(0, 0, S, S);
  // Large soft patches (repairs / wear) — low contrast so they read as
  // surface variation, never as stains over the lane markings.
  for (let i = 0; i < 26; i += 1) {
    const x = rnd() * S;
    const y = rnd() * S;
    const r = 40 + rnd() * 110;
    const grad = g.createRadialGradient(x, y, 2, x, y, r);
    const dark = rnd() < 0.55;
    grad.addColorStop(0, dark ? 'rgba(70,62,80,0.10)' : 'rgba(255,246,235,0.08)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Fine aggregate grain.
  const img = g.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 18;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  // Speckle stones: sparse light/dark dots.
  for (let i = 0; i < 2600; i += 1) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(255,250,240,0.20)' : 'rgba(30,24,38,0.20)';
    g.fillRect(rnd() * S, rnd() * S, 1.6, 1.6);
  }
  // Hairline cracks — thin, broken, low alpha.
  g.strokeStyle = 'rgba(38,32,46,0.28)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 9; i += 1) {
    let x = rnd() * S;
    let y = rnd() * S;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 6; s += 1) {
      x += (rnd() - 0.5) * 46;
      y += (rnd() - 0.5) * 46;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // Faint tyre-polish bands along the driving direction (v axis): the
  // two wheel tracks are slightly smoother/darker — the wet look's base.
  for (const u of [0.30, 0.70]) {
    const grad = g.createLinearGradient((u - 0.09) * S, 0, (u + 0.09) * S, 0);
    grad.addColorStop(0, 'rgba(52,44,62,0)');
    grad.addColorStop(0.5, 'rgba(52,44,62,0.13)');
    grad.addColorStop(1, 'rgba(52,44,62,0)');
    g.fillStyle = grad;
    g.fillRect((u - 0.09) * S, 0, 0.18 * S, S);
  }
  const tex = canvasTex(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Cruiser door lettering (c4): transparent canvas, drawn once, applied to
// thin planes on both cruiser flanks.
export function doorTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 64);
  g.textAlign = 'center';
  g.fillStyle = '#10131a';
  g.font = '900 34px system-ui, sans-serif';
  g.fillText('PALMERA PD', 128, 43);
  const tex = canvasTex(c);
  return tex;
}
