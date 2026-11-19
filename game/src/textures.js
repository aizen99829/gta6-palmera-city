// textures.js — every texture in the game is painted on a canvas at
// runtime: asphalt with tyre polish bands, lit building facades, the
// sunset sky dome, palm fronds, billboards and small signs. No image
// files, no network. All textures get the renderer's max anisotropy.
import * as THREE from 'three';
import { SUNSET } from './config.js';
import { mulberry32 } from './random.js';

let maxAniso = 1;
const registry = [];
export function setMaxAnisotropy(n) {
  maxAniso = Math.max(1, n);
  for (const t of registry) { t.anisotropy = maxAniso; t.needsUpdate = true; }
}
function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = maxAniso;
  if (opts.repeat) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  registry.push(t);
  return t;
}
// Small deterministic LCG so texture painting never touches Math.random.
function lcg(seed) { const n = mulberry32(seed); return n; }

export function asphaltTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    const rnd = lcg(1234);
    g.fillStyle = '#e8e2e6'; g.fillRect(0, 0, w, h); // near-white: material colour tints it
    for (let i = 0; i < 5200; i += 1) { // aggregate grain + stone speckle
      const v = 205 + Math.floor(rnd() * 50);
      g.fillStyle = `rgb(${v},${v - 6},${v - 2})`;
      g.fillRect(rnd() * w, rnd() * h, 1.6, 1.6);
    }
    for (let i = 0; i < 26; i += 1) { // low-contrast repair patches
      g.fillStyle = `rgba(120,110,125,${0.05 + rnd() * 0.08})`;
      g.fillRect(rnd() * w, rnd() * h, 30 + rnd() * 90, 20 + rnd() * 60);
    }
    g.strokeStyle = 'rgba(90,84,96,0.35)'; g.lineWidth = 1; // hairline cracks
    for (let i = 0; i < 9; i += 1) {
      g.beginPath(); let x = rnd() * w; let y = rnd() * h; g.moveTo(x, y);
      for (let s = 0; s < 5; s += 1) { x += (rnd() - 0.5) * 46; y += rnd() * 30; g.lineTo(x, y); }
      g.stroke();
    }
    const band = (x0, x1) => { // dark polished tyre bands along travel direction
      const gr = g.createLinearGradient(x0, 0, x1, 0);
      gr.addColorStop(0, 'rgba(70,62,78,0)');
      gr.addColorStop(0.5, 'rgba(70,62,78,0.20)');
      gr.addColorStop(1, 'rgba(70,62,78,0)');
      g.fillStyle = gr; g.fillRect(x0, 0, x1 - x0, h);
    };
    band(w * 0.16, w * 0.38); band(w * 0.62, w * 0.84);
  }, { repeat: true });
}
export function facadeTexture(base, seed) {
  return canvasTex(256, 512, (g, w, h) => {
    const rnd = lcg(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const floors = 9; const cols = 5;
    const fw = w / cols; const fh = h / floors;
    for (let f = 0; f < floors; f += 1) {
      for (let c = 0; c < cols; c += 1) {
        const lit = rnd() < 0.45; // ±45% of windows glow warm at dusk
        g.fillStyle = lit ? (rnd() < 0.5 ? '#ffd98a' : '#ffb35c') : '#232733';
        g.fillRect(c * fw + 6, f * fh + 7, fw - 12, fh - 14);
        if (lit && rnd() < 0.4) { g.fillStyle = 'rgba(70,40,20,0.55)'; g.fillRect(c * fw + 6, f * fh + 7, fw - 12, 4); }
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, h - 26, w, 26); // ground floor shade
  });
}
export function skyTexture() {
  return canvasTex(1024, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, SUNSET.skyTop); grad.addColorStop(0.42, SUNSET.skyMid);
    grad.addColorStop(0.72, SUNSET.skyLow); grad.addColorStop(1, SUNSET.skyHorizon);
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    // Sun: baked into the dome at the azimuth the chase camera faces.
    const sx = w * 0.5; const sy = h * 0.86;
    const halo = g.createRadialGradient(sx, sy, 4, sx, sy, 210);
    halo.addColorStop(0, 'rgba(255,240,200,0.95)');
    halo.addColorStop(0.18, 'rgba(255,190,110,0.55)');
    halo.addColorStop(1, 'rgba(255,150,90,0)');
    g.fillStyle = halo; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff6da'; g.beginPath(); g.arc(sx, sy, 26, 0, Math.PI * 2); g.fill();
    try { // warm saturation grade, no-op where canvas filters unsupported
      g.filter = 'saturate(1.28) contrast(1.05)';
      g.drawImage(g.canvas, 0, 0); g.filter = 'none';
    } catch { /* keep the ungraded sky */ }
  });
}
export function radialGlowTexture(inner = 'rgba(255,255,255,1)') {
  return canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62);
    gr.addColorStop(0, inner); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}
export function streakTexture() {
  return canvasTex(64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.85)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const side = g.createLinearGradient(0, 0, w, 0);
    side.addColorStop(0, 'rgba(0,0,0,1)'); side.addColorStop(0.25, 'rgba(0,0,0,0)');
    side.addColorStop(0.75, 'rgba(0,0,0,0)'); side.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = side; g.fillRect(0, 0, w, h);
  });
}
export function frondTexture() {
  return canvasTex(128, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#2e6b34'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(w / 2, h); g.quadraticCurveTo(w / 2 + 6, h / 2, w / 2, 6); g.stroke();
    g.lineWidth = 3; g.strokeStyle = '#3f9150';
    for (let i = 0; i < 22; i += 1) { // pinnate leaflets down both sides
      const y = 14 + i * 11; const len = 44 - Math.abs(i - 9) * 2.4;
      g.beginPath(); g.moveTo(w / 2, y); g.quadraticCurveTo(w / 2 - len * 0.6, y + 8, w / 2 - len, y + 20); g.stroke();
      g.beginPath(); g.moveTo(w / 2, y); g.quadraticCurveTo(w / 2 + len * 0.6, y + 8, w / 2 + len, y + 20); g.stroke();
    }
  });
}
export function billboardTexture(lines, bg, fg) {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(12, 12, w - 24, h - 24);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    const size = lines[0].length > 14 ? 44 : 56;
    g.font = `bold ${size}px 'Segoe UI', sans-serif`;
    g.fillText(lines[0], w / 2, lines.length > 1 ? h / 2 - 34 : h / 2);
    if (lines[1]) { g.font = "bold 34px 'Segoe UI', sans-serif"; g.fillText(lines[1], w / 2, h / 2 + 36); }
  });
}
export function signTexture(text, bg, fg) {
  return canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = "bold 25px 'Segoe UI', sans-serif";
    g.fillText(text, w / 2, h / 2 + 1);
  });
}
export function doorTexture() {
  return canvasTex(256, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#101418'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = "bold 34px 'Segoe UI', sans-serif";
    g.fillText('PALMERA PD', w / 2, h / 2);
  });
}
export function sunsetCubeTexture() {
  const stops = ['#2e1a47', '#7a2d6d', '#ff6b9d', '#ffb347'];
  const face = (top, bottom) => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, top); gr.addColorStop(1, bottom);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return c;
  };
  const side = () => face(stops[1], stops[3]);
  const images = [side(), side(), face(stops[0], stops[1]), face('#241a30', '#171020'), side(), side()];
  const t = new THREE.CubeTexture(images);
  t.needsUpdate = true;
  return t;
}
