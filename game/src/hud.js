// HUD: all DOM overlays plus the 2D minimap canvas.
// v5 (PLAN §2-g): layered sunset panels — mission panel + Palmera PD
// response panel top-left, DAY/clock/money/stars/seen + weapon slots
// top-right, a pictured minimap bottom-left with district + status bars,
// a dialog bar, a radio widget and a vehicle panel bottom-right.
// Panel language: rgba(10,12,26,.78) + blur, 10px radius, 3px accent edge.
import { CITY, FONT, NAMES, RADIO } from './config.js';
import { roadCentres } from './world.js';

function el(tag, id, parent, css) {
  const e = document.createElement(tag);
  if (id) e.id = id;
  e.style.cssText = css;
  parent.appendChild(e);
  return e;
}

const BASE = 'position:absolute;color:#fff;font-family:' + FONT + ';text-shadow:0 2px 4px rgba(0,0,0,.7);pointer-events:none;user-select:none;';
const PANEL = 'background:rgba(10,12,26,.78);border-radius:10px;border-left:3px solid #ff6b9d;padding:10px 12px;backdrop-filter:blur(6px);box-shadow:0 4px 18px rgba(0,0,0,.45);';

const STATUS_COLORS = { RAMMING: '#ff4040', ROADBLOCK: '#ffd94a', PURSUIT: '#ff9a3c' };
const PORTRAIT_COLORS = { Marco: '#ffb347', Rosa: '#ff6b9d', 'Luz Vega': '#5ee6ff' };

export function createHud(world) {
  const root = el('div', 'hud', document.body, 'position:fixed;inset:0;pointer-events:none;z-index:5;');
  const mq = document.createElement('style');
  mq.textContent = '@media (max-width:600px){'
    + '#hud-leftcol{width:196px!important;top:8px!important;left:8px!important}'
    + '#hud-mtitle{font-size:14px!important}#hud-mobj{font-size:12.5px!important}#hud-mnext{font-size:11px!important}'
    + '#hud-pd{max-height:88px!important;overflow:hidden!important}'
    + '#hud-topright{top:8px!important;right:8px!important}'
    + '#hud-dayclock{font-size:11px!important}#hud-money{font-size:22px!important}#hud-stars{font-size:19px!important;letter-spacing:2px!important}'
    + '#hud-slots{top:400px!important;right:8px!important}'
    + '#hud-slotlabel{display:none!important}'
    + '#hud-leftbottom{left:auto!important;right:8px!important;top:150px!important;bottom:auto!important;width:118px!important}'
    + '#hud-minimap{width:118px!important;height:118px!important}'
    + '#hud-rightbottom{right:8px!important;bottom:190px!important;width:196px!important}'
    + '#hud-radio{display:none!important}'
    + '#hud-mtitle,#hud-mnext{white-space:normal!important}'
    + '#hud-dialog{left:8px!important;transform:none!important;width:60vw!important;bottom:250px!important}'
    + 'body.incar #hud-dialog{bottom:310px!important}'
    + 'body.incar #hud-slots{display:none!important}'
    + '#hud-message{bottom:410px!important;font-size:15px!important}'
    + '#hud-hint{display:none!important}'
    + '#screen-start>div>div:first-of-type{font-size:36px!important}'
    + '}'
    + '@media (max-height:500px){'
    + '#hud-leftcol{width:296px!important;top:8px!important;left:8px!important}'
    + '#hud-mnext,#hud-msub{display:none!important}'
    + '#hud-pd{max-height:80px!important;overflow:hidden!important}'
    + '#hud-topright{top:8px!important;right:8px!important}'
    + '#hud-slots{left:312px!important;right:auto!important;top:8px!important}'
    + '#hud-slotlabel{display:none!important}'
    + '#hud-leftbottom{left:8px!important;bottom:8px!important;width:88px!important}'
    + '#hud-minimap{width:88px!important;height:88px!important}'
    + '#hud-rightbottom{left:252px!important;right:auto!important;bottom:8px!important;width:220px!important}'
    + '#hud-radio{display:none!important}'
    + '#hud-dialog{bottom:150px!important;width:56vw!important}'
    + 'body.incar #hud-dialog{left:330px!important;transform:none!important;width:48vw!important;bottom:126px!important}'
    + '#hud-message{bottom:250px!important;font-size:15px!important}'
    + '#hud-hint{display:none!important}'
    + '}';
  document.head.appendChild(mq);

  // ---- Top-left column: mission panel (g1) + PD response panel (g2) ----
  const leftCol = el('div', 'hud-leftcol', root, BASE + 'top:14px;left:16px;width:330px;display:flex;flex-direction:column;gap:8px;');
  const missionPanel = el('div', 'hud-mission', leftCol, PANEL + 'position:relative;');
  const mpHead = el('div', null, missionPanel, 'display:flex;align-items:center;gap:8px;');
  const mpChip = el('span', 'hud-chip', mpHead, 'background:#ffd94a;color:#241a30;font-size:12px;font-weight:900;padding:2px 7px;border-radius:5px;text-shadow:none;');
  const mpTitle = el('span', 'hud-mtitle', mpHead, 'font-size:17px;font-weight:800;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;');
  const mpTimer = el('span', 'hud-mtimer', mpHead, 'font-size:14px;font-weight:700;color:#ffb347;');
  const mpObj = el('div', 'hud-mobj', missionPanel, 'font-size:14.5px;line-height:1.4;margin-top:5px;');
  const mpSub = el('div', 'hud-msub', missionPanel, 'font-size:12.5px;color:#9fd8ff;margin-top:2px;min-height:15px;');
  const mpSegs = el('div', 'hud-msegs', missionPanel, 'display:flex;gap:4px;margin-top:7px;');
  const mpNext = el('div', 'hud-mnext', missionPanel, 'font-size:12.5px;color:#ffd94a;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;');
  const segDivs = [];
  for (let i = 0; i < 4; i += 1) {
    const s = el('div', null, mpSegs, 'height:6px;flex:1;border-radius:3px;background:rgba(255,255,255,.18);');
    segDivs.push(s);
  }
  const pdPanel = el('div', 'hud-pd', leftCol, PANEL + 'position:relative;border-left-color:#3a86ff;display:none;');
  let pdCache = '';

  // ---- Top-right: DAY + clock, money, stars, seen chip (g8) + slots (g9) ----
  const topRight = el('div', 'hud-topright', root, BASE + 'top:14px;right:16px;text-align:right;');
  const dayClock = el('div', 'hud-dayclock', topRight, 'font-size:14px;font-weight:700;color:#ffd9ec;letter-spacing:1px;');
  const money = el('div', 'hud-money', topRight, 'font-size:30px;font-weight:900;color:#3dff7a;');
  const stars = el('div', 'hud-stars', topRight, 'color:#ffd94a;font-size:26px;letter-spacing:4px;');
  const seenChip = el('div', 'hud-seen', topRight, 'display:none;margin-top:4px;');
  const seenInner = el('span', null, seenChip, 'font-size:12px;font-weight:900;padding:3px 9px;border-radius:5px;text-shadow:none;');
  const slots = el('div', 'hud-slots', root, BASE + 'top:158px;right:16px;display:flex;gap:6px;');
  const slotDivs = [];
  for (let i = 0; i < 4; i += 1) {
    const s = el('div', null, slots, 'width:44px;height:44px;border-radius:8px;background:rgba(10,12,26,.78);border:2px solid rgba(255,255,255,.25);display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:10px;font-weight:800;text-align:center;line-height:1.25;');
    slotDivs.push(s);
  }
  const slotLabel = el('div', 'hud-slotlabel', root, BASE + 'top:208px;right:16px;font-size:12px;color:#ffd9ec;text-align:right;');

  // ---- Bottom-left: minimap (g3) + district + status bars (g4) ----
  const leftBottom = el('div', 'hud-leftbottom', root, BASE + 'left:16px;bottom:16px;width:204px;');
  const minimap = el('canvas', 'hud-minimap', leftBottom, 'width:204px;height:204px;border:2px solid rgba(255,255,255,.75);border-radius:50%;background:#3f74b8;box-shadow:0 4px 18px rgba(0,0,0,.5);display:block;');
  // v5.2 (sharpness): the backing store renders at up to 2x the CSS size,
  // so retina displays get a native-resolution map instead of a 204px
  // upscale. drawMinimap keeps working in the 204 CSS space under a
  // matching transform; the CSS box (and every overlap measurement) is
  // unchanged.
  const MM_SCALE = Math.min(window.devicePixelRatio || 1, 2);
  minimap.width = 204 * MM_SCALE;
  minimap.height = 204 * MM_SCALE;
  const ctx2d = minimap.getContext('2d');
  const districtEl = el('div', 'hud-district', leftBottom, 'margin-top:7px;font-size:13px;font-weight:800;color:#ffd9ec;letter-spacing:.5px;');
  function barRow(label, color) {
    const row = el('div', null, leftBottom, 'display:flex;align-items:center;gap:7px;margin-top:5px;');
    const lab = el('span', null, row, 'font-size:11px;font-weight:900;width:52px;color:#e8f2ff;');
    lab.textContent = label;
    const wrap = el('div', null, row, 'flex:1;height:11px;background:rgba(0,0,0,.55);border:1px solid #fff8;border-radius:6px;overflow:hidden;');
    const fill = el('div', null, wrap, `height:100%;width:100%;background:${color};`);
    const val = el('span', null, row, 'font-size:11px;font-weight:700;width:30px;text-align:right;');
    return { row, fill, val, lab };
  }
  const healthBar = barRow('HEALTH', 'linear-gradient(90deg,#37d67a,#a8e063)');
  const secondBar = barRow('ARMOR', 'linear-gradient(90deg,#3a86ff,#7db8ff)');
  const respectEl = el('div', 'hud-respect', leftBottom, 'margin-top:5px;font-size:12px;font-weight:800;color:#ffd94a;');

  // ---- Bottom-centre: message, dialog (g5), hint ----
  const message = el('div', 'hud-message', root, BASE + 'left:50%;bottom:196px;transform:translateX(-50%);font-size:19px;font-weight:700;color:#ffe9a8;');
  const dialog = el('div', 'hud-dialog', root, BASE + 'left:50%;bottom:64px;transform:translateX(-50%);width:560px;max-width:92vw;display:none;');
  const dialogPanel = el('div', null, dialog, PANEL + 'display:flex;gap:12px;align-items:center;');
  const portrait = el('canvas', 'hud-portrait', dialogPanel, 'width:64px;height:64px;border-radius:8px;flex:none;background:#241a30;');
  portrait.width = 64;
  portrait.height = 64;
  const dialogTextWrap = el('div', null, dialogPanel, 'flex:1;min-width:0;');
  const dialogName = el('div', 'hud-dname', dialogTextWrap, 'font-size:14px;font-weight:900;');
  const dialogBody = el('div', 'hud-dtext', dialogTextWrap, 'font-size:14.5px;line-height:1.4;margin-top:2px;');
  let portraitKey = '';
  const hint = el('div', 'hud-hint', root, BASE + 'left:50%;bottom:24px;transform:translateX(-50%);font-size:14px;color:#e8f2ff;background:rgba(0,0,0,.45);padding:6px 12px;border-radius:6px;');

  // ---- Bottom-right: radio (g6) + vehicle panel (g7) ----
  const rightBottom = el('div', 'hud-rightbottom', root, BASE + 'right:16px;bottom:16px;width:250px;display:flex;flex-direction:column;gap:8px;align-items:stretch;');
  const radioPanel = el('div', 'hud-radio', rightBottom, PANEL + 'position:relative;border-left-color:#ffb347;');
  radioPanel.innerHTML = `
    <div style="display:flex;align-items:center;gap:7px;">
      <span style="color:#ffb347;font-size:17px;">♪</span>
      <span id="hud-rstation" style="font-size:14px;font-weight:900;color:#ffd9ec;"></span>
      <span id="hud-rshow" style="font-size:11.5px;color:#9fb6c8;"></span>
    </div>
    <div id="hud-rsong" style="font-size:13px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
    <div style="display:flex;align-items:flex-end;gap:3px;height:16px;margin-top:6px;">
      <div class="eqbar"></div><div class="eqbar"></div><div class="eqbar"></div><div class="eqbar"></div><div class="eqbar"></div>
    </div>
    <div style="height:3px;background:rgba(255,255,255,.15);border-radius:2px;margin-top:6px;overflow:hidden;"><div id="hud-rprog" style="height:100%;width:0%;background:#ffb347;"></div></div>
    <style>
      .eqbar{width:5px;background:#ff6b9d;border-radius:2px;animation:eq 0.9s ease-in-out infinite alternate;}
      .eqbar:nth-child(2){animation-duration:0.7s;animation-delay:.1s;}
      .eqbar:nth-child(3){animation-duration:1.1s;animation-delay:.2s;}
      .eqbar:nth-child(4){animation-duration:0.8s;animation-delay:.05s;}
      .eqbar:nth-child(5){animation-duration:1s;animation-delay:.15s;}
      @keyframes eq{from{height:22%;}to{height:100%;}}
    </style>`;
  const rStation = radioPanel.querySelector('#hud-rstation');
  const rShow = radioPanel.querySelector('#hud-rshow');
  const rSong = radioPanel.querySelector('#hud-rsong');
  const rProg = radioPanel.querySelector('#hud-rprog');
  rStation.textContent = RADIO.station;
  rShow.textContent = RADIO.show;
  const vehiclePanel = el('div', 'hud-vehicle', rightBottom, PANEL + 'position:relative;border-left-color:#5ee6ff;display:none;');
  const vpName = el('div', 'hud-vname', vehiclePanel, 'font-size:15px;font-weight:900;color:#eafcff;');
  const vpCondRow = el('div', null, vehiclePanel, 'display:flex;align-items:center;gap:7px;margin-top:5px;');
  const vpCondLab = el('span', null, vpCondRow, 'font-size:11px;font-weight:900;color:#e8f2ff;');
  vpCondLab.textContent = 'CONDITION';
  const vpCondWrap = el('div', null, vpCondRow, 'flex:1;height:10px;background:rgba(0,0,0,.55);border:1px solid #fff8;border-radius:5px;overflow:hidden;');
  const vpCondFill = el('div', null, vpCondWrap, 'height:100%;width:100%;background:linear-gradient(90deg,#5ee6ff,#3dff7a);');
  const vpCondVal = el('span', null, vpCondRow, 'font-size:11px;font-weight:700;width:34px;text-align:right;');
  const vpSpeedRow = el('div', null, vehiclePanel, 'display:flex;align-items:flex-end;gap:8px;margin-top:2px;');
  const vpSpeed = el('span', 'hud-vspeed', vpSpeedRow, 'font-size:48px;font-weight:900;line-height:1;color:#fff;');
  const vpUnit = el('span', null, vpSpeedRow, 'font-size:13px;font-weight:900;color:#9fd8ff;padding-bottom:5px;');
  vpUnit.textContent = 'KM/H';
  const vpGear = el('span', 'hud-vgear', vpSpeedRow, 'margin-left:auto;font-size:13px;font-weight:900;color:#241a30;background:#ffd94a;padding:3px 9px;border-radius:5px;text-shadow:none;');

  const BASE_MAP = 760;
  const WORLD_SPAN = CITY.size * 2;
  const baseMap = document.createElement('canvas');
  baseMap.width = BASE_MAP;
  baseMap.height = BASE_MAP;
  {
    const b = baseMap.getContext('2d');
    const s = BASE_MAP / WORLD_SPAN;
    const bx = (x) => BASE_MAP / 2 + x * s;
    const by = (z) => BASE_MAP / 2 + z * s;
    // v5.1 (P2): the bright readable palette — sunlit blocks, pale warm
    // roads as the light network, saturated sea/sand. The old dusk palette
    // (dark mauve blocks, mid-grey roads) was the audit's W2.
    b.fillStyle = '#8c6a78'; // block ground, sunlit
    b.fillRect(0, 0, BASE_MAP, BASE_MAP);
    // Sea + sand (south).
    b.fillStyle = '#3f74b8';
    b.fillRect(0, by(CITY.seaZ), BASE_MAP, BASE_MAP - by(CITY.seaZ));
    b.fillStyle = '#eecfa0';
    b.fillRect(0, by(CITY.beachZ), BASE_MAP, by(CITY.seaZ) - by(CITY.beachZ));
    // Buildings as blocks from the real colliders — darker than the block
    // ground so rooftops still read against it.
    b.fillStyle = '#4a3550';
    if (world && world.colliders) {
      for (const c of world.colliders) {
        if (c.maxX - c.minX < 3 || c.maxZ - c.minZ < 3) continue; // skip poles/palms
        b.fillRect(bx(c.minX), by(c.minZ), (c.maxX - c.minX) * s, (c.maxZ - c.minZ) * s);
      }
    }
    // Roads over the blocks.
    b.strokeStyle = '#e8d8c8';
    b.lineWidth = CITY.roadHalf * 2 * s;
    for (const c of roadCentres()) {
      b.beginPath(); b.moveTo(bx(c), 0); b.lineTo(bx(c), BASE_MAP); b.stroke();
      b.beginPath(); b.moveTo(0, by(c)); b.lineTo(BASE_MAP, by(c)); b.stroke();
    }
    // Marina plaza + lighthouse markers.
    b.fillStyle = '#7fb8d8';
    b.beginPath(); b.arc(bx(140), by(140), 9 * s + 2, 0, Math.PI * 2); b.fill();
    b.fillStyle = '#ffe9a8';
    b.beginPath(); b.arc(bx(-40), by(CITY.beachZ + 26), 4, 0, Math.PI * 2); b.fill();
  }

  function drawMinimap(data) {
    const W = 204;
    ctx2d.setTransform(MM_SCALE, 0, 0, MM_SCALE, 0, 0); // v5.2: draw in CSS space on the hi-dpi backing
    const view = 115; // metres from player to edge (PLAN Lampiran A.4)
    const scale = (W / 2) / view;
    const px = data.player.x;
    const pz = data.player.z;
    ctx2d.save();
    ctx2d.beginPath();
    ctx2d.arc(W / 2, W / 2, W / 2 - 1, 0, Math.PI * 2);
    ctx2d.clip();
    // Blit the pre-rendered base so the player sits at the centre.
    const bs = BASE_MAP / WORLD_SPAN; // base px per metre
    const srcHalf = view / bs;
    ctx2d.drawImage(
      baseMap,
      BASE_MAP / 2 + px * bs - srcHalf, BASE_MAP / 2 + pz * bs - srcHalf, srcHalf * 2, srcHalf * 2,
      0, 0, W, W,
    );
    const toX = (x) => W / 2 + (x - px) * scale;
    const toY = (z) => W / 2 + (z - pz) * scale;
    // Search zone (g3): a red circle that follows the player while
    // wanted. v5.1 (P2): firmer — stronger fill and a heavier rim.
    if (data.searchR > 0) {
      ctx2d.fillStyle = 'rgba(255,60,60,0.14)';
      ctx2d.strokeStyle = 'rgba(255,80,80,0.9)';
      ctx2d.lineWidth = 2.5;
      ctx2d.beginPath();
      ctx2d.arc(W / 2, W / 2, data.searchR * scale, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.stroke();
    }
    // Waypoint diamond.
    if (data.waypoint) {
      const wx = toX(data.waypoint.x);
      const wy = toY(data.waypoint.z);
      if (wx > -20 && wx < W + 20 && wy > -20 && wy < W + 20) {
        ctx2d.fillStyle = '#fff';
        ctx2d.beginPath();
        ctx2d.moveTo(wx, wy - 13); ctx2d.lineTo(wx + 10, wy); ctx2d.lineTo(wx, wy + 13); ctx2d.lineTo(wx - 10, wy);
        ctx2d.closePath(); ctx2d.fill();
        ctx2d.fillStyle = '#ffd94a';
        ctx2d.beginPath();
        ctx2d.moveTo(wx, wy - 9); ctx2d.lineTo(wx + 7, wy); ctx2d.lineTo(wx, wy + 9); ctx2d.lineTo(wx - 7, wy);
        ctx2d.closePath(); ctx2d.fill();
      }
    }
    // Traffic dots.
    ctx2d.fillStyle = '#dfe9ef';
    for (const t of data.traffic || []) {
      const tx = toX(t.x);
      const ty = toY(t.z);
      if (tx < 0 || tx > W || ty < 0 || ty > W) continue;
      ctx2d.fillRect(tx - 1.5, ty - 1.5, 3, 3);
    }
    // Police dots (flashing blue/red).
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    ctx2d.fillStyle = flash ? '#3a86ff' : '#ff3b30';
    for (const p of data.police || []) {
      const tx = toX(p.x);
      const ty = toY(p.z);
      if (tx < -6 || tx > W + 6 || ty < -6 || ty > W + 6) continue;
      ctx2d.beginPath(); ctx2d.arc(Math.max(4, Math.min(W - 4, tx)), Math.max(4, Math.min(W - 4, ty)), 4, 0, Math.PI * 2); ctx2d.fill();
    }
    // Player arrow (heading up = north = -z on screen… heading 0 faces +z
    // (south), so rotate by π − heading to keep north up).
    ctx2d.save();
    ctx2d.translate(W / 2, W / 2);
    ctx2d.rotate(Math.PI - data.player.heading);
    ctx2d.fillStyle = '#fff';
    ctx2d.beginPath();
    ctx2d.moveTo(0, -8); ctx2d.lineTo(5, 6); ctx2d.lineTo(-5, 6);
    ctx2d.closePath(); ctx2d.fill();
    ctx2d.restore();
    ctx2d.restore();
    // North marker.
    ctx2d.fillStyle = '#fff';
    ctx2d.font = '900 13px ' + FONT;
    ctx2d.textAlign = 'center';
    ctx2d.fillText('N', W / 2, 16);
  }

  // ---- Dialog portraits (g5): tiny procedural faces, drawn once per line ----
  function drawPortrait(who) {
    const g = portrait.getContext('2d');
    const accent = PORTRAIT_COLORS[who] || '#ffb347';
    const grad = g.createRadialGradient(32, 26, 4, 32, 32, 44);
    grad.addColorStop(0, accent);
    grad.addColorStop(1, '#241a30');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    // Face.
    g.fillStyle = '#c98a5e';
    g.beginPath(); g.arc(32, 34, 13, 0, Math.PI * 2); g.fill();
    // Shoulders.
    g.fillStyle = who === 'Rosa' ? '#3d1030' : who === 'Marco' ? '#2c4a7c' : '#d81b60';
    g.fillRect(14, 52, 36, 12);
    if (who === 'Marco') {
      // Cap.
      g.fillStyle = '#1c2b33';
      g.fillRect(17, 18, 30, 8);
      g.fillRect(24, 26, 24, 4);
      g.fillStyle = '#8a8f88';
      g.fillRect(24, 44, 16, 5); // grey stubble beard
    } else if (who === 'Rosa') {
      // Dark hair + sunglasses.
      g.fillStyle = '#17101c';
      g.beginPath(); g.arc(32, 28, 15, Math.PI, Math.PI * 2); g.fill();
      g.fillRect(17, 26, 5, 20);
      g.fillRect(42, 26, 5, 20);
      g.fillStyle = '#10131a';
      g.fillRect(20, 31, 24, 6);
    } else {
      // Luz: dark-pink hair, one hoop earring.
      g.fillStyle = '#5a1030';
      g.beginPath(); g.arc(32, 28, 15, Math.PI, Math.PI * 2); g.fill();
      g.fillRect(17, 26, 5, 16);
      g.strokeStyle = '#ffd94a';
      g.lineWidth = 2;
      g.beginPath(); g.arc(46, 42, 3.5, 0, Math.PI * 2); g.stroke();
    }
  }

  // Full-screen menu overlays (pointer events on, so buttons click).
  function overlay(id, html) {
    const o = el('div', id, document.body, 'position:fixed;inset:0;z-index:10;display:flex;align-items:center;justify-content:center;background:rgba(8,18,28,.72);color:#fff;font-family:' + FONT + ';');
    o.innerHTML = html;
    o.style.display = 'none';
    return o;
  }
  const startScreen = overlay('screen-start', `
    <div style="text-align:center;max-width:640px;padding:24px;">
      <div style="font-size:64px;font-weight:900;letter-spacing:2px;background:linear-gradient(90deg,#ff6b9d,#ffb347);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none;filter:drop-shadow(0 4px 14px rgba(255,107,157,.45));">PALMERA CITY</div>
      <div style="font-size:18px;margin-top:6px;color:#ffd9ec;">A sunset open-world crime story — an original city, not Vice City.</div>
      <div style="margin-top:18px;font-size:15px;line-height:1.7;text-align:left;background:rgba(10,12,26,.55);padding:14px 18px;border-radius:10px;">
        <b>Luz Vega</b> owes the harbour crew a debt. Four jobs pay it off — if the Palmera PD lets her.<br>
        <b>WASD</b> move / drive &nbsp;·&nbsp; <b>E</b> enter / exit car &nbsp;·&nbsp; <b>F</b> punch &nbsp;·&nbsp; <b>Click</b> shoot &nbsp;·&nbsp; <b>2 / 3</b> pistol / SMG &nbsp;·&nbsp; <b>Shift</b> run
      </div>
      <div style="margin-top:20px;font-size:20px;font-weight:700;color:#ffb347;">Press SPACE or click to start</div>
      <div style="margin-top:8px;font-size:13px;color:#c9a8c0;">Progress saves automatically to this browser.</div>
    </div>`);
  // g10: the start screen shows the city through a translucent sunset veil.
  startScreen.style.background = 'linear-gradient(180deg, rgba(46,26,71,.18), rgba(20,8,28,.55))';
  const pauseScreen = overlay('screen-pause', `
    <div style="text-align:center;">
      <div style="font-size:44px;font-weight:900;color:#b28dff;">PAUSED</div>
      <div style="margin-top:10px;font-size:16px;color:#ffd9ec;">Palmera City waits for no one — except now.</div>
      <div style="margin-top:18px;font-size:18px;font-weight:700;color:#ffb347;">Press P or SPACE to resume</div>
    </div>`);
  pauseScreen.style.background = 'rgba(26,14,46,.72)';
  const bustedScreen = overlay('screen-busted', `
    <div style="text-align:center;">
      <div style="font-size:56px;font-weight:900;color:#ff2e63;">BUSTED</div>
      <div style="margin-top:10px;font-size:16px;color:#ffd9ec;">The Palmera PD caught up with Luz. The debt is still waiting.</div>
      <div style="margin-top:18px;font-size:18px;font-weight:700;color:#ffb347;">Press SPACE to try again</div>
    </div>`);
  bustedScreen.style.background = 'rgba(40,6,20,.68)';

  let lastStars = -1;
  let lastSong = -1;

  return {
    update(data) {
      // --- Mission panel (g1) ---
      mpChip.textContent = `CH ${data.chapter}`;
      mpTitle.textContent = data.missionTitle.split(' — ')[0];
      mpTimer.textContent = data.missionTimerSec != null ? `◷ ${Math.floor(data.missionTimerSec / 60)}:${String(data.missionTimerSec % 60).padStart(2, '0')}` : '';
      const colon = data.objective.indexOf(': ');
      mpObj.textContent = colon > 0 ? data.objective.slice(colon + 2) : data.objective;
      mpSub.textContent = data.distToWaypoint != null
        ? `Waypoint · ${data.distToWaypoint} m`
        : (data.stars > 0 ? 'Break line of sight and stay clear' : '');
      for (let i = 0; i < segDivs.length; i += 1) {
        const seg = segDivs[i];
        if (i >= data.stepCount) seg.style.display = 'none';
        else {
          seg.style.display = '';
          seg.style.background = i < data.stepIndex ? '#3dff7a' : i === data.stepIndex ? '#ffd94a' : 'rgba(255,255,255,.18)';
        }
      }
      mpNext.textContent = `NEXT ▸ ${data.nextText}`;
      // --- PD panel (g2): re-rendered only when its summary string changes ---
      if (data.stars >= 1 && data.police.length) {
        // v5.1 (P3): up to 7 units now answer (was 5) and a ROADBLOCK row
        // is never the one cut — blockers sort first, then by distance.
        // Short viewports (landscape phones) keep the old 5-row cap: at 7
        // rows the panel outgrew the 390 px height and touched the
        // minimap column (measured overlap 88x12 px).
        const rows = [...data.police]
          .sort((a, b) => (b.status === 'ROADBLOCK') - (a.status === 'ROADBLOCK') || a.dist - b.dist)
          .slice(0, window.innerHeight < 500 ? 5 : 7);
        const key = `${data.stars}|${rows.map((c) => `${c.callsign}:${c.dist}:${c.status}`).join(',')}|${data.heliActive ? 1 : 0}`;
        if (key !== pdCache) {
          pdCache = key;
          pdPanel.style.display = '';
          pdPanel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:13px;font-weight:900;color:#7db8ff;">● PALMERA PD RESPONSE</span>
              <span style="font-size:12px;font-weight:800;color:#ffd9ec;">${data.police.length} UNITS • CODE ${data.stars}</span>
            </div>
            ${rows.map((c) => `
            <div style="display:flex;align-items:center;gap:8px;margin-top:5px;font-size:13px;">
              <span style="color:#7db8ff;font-size:15px;">▬</span>
              <span style="font-weight:800;flex:1;">${c.callsign}</span>
              <span style="color:#9fd8ff;">${c.dist} m</span>
              <span style="font-size:10.5px;font-weight:900;padding:2px 7px;border-radius:4px;color:#241a30;background:${STATUS_COLORS[c.status] || '#ff9a3c'};text-shadow:none;">${c.status}</span>
            </div>`).join('')}
            ${data.heliActive ? '<div style="margin-top:6px;font-size:11.5px;font-weight:800;color:#ffe9a8;">+1 AIR UNIT IN THE SEARCH ZONE</div>' : ''}`;
        }
      } else {
        pdPanel.style.display = 'none';
        pdCache = '';
      }
      // --- Top-right (g8) ---
      const hh = String(Math.floor(data.clockMin / 60) % 24).padStart(2, '0');
      const mm = String(Math.floor(data.clockMin % 60)).padStart(2, '0');
      dayClock.textContent = `DAY ${data.day} · ${hh}:${mm}`;
      money.textContent = `$${Math.floor(data.money).toLocaleString('en-US')}`;
      const starsNow = Math.max(0, Math.min(5, data.stars));
      if (starsNow !== lastStars) {
        stars.textContent = '★'.repeat(starsNow) + '☆'.repeat(5 - starsNow);
        lastStars = starsNow;
      }
      if (starsNow > 0) {
        seenChip.style.display = '';
        seenInner.textContent = data.seen ? 'IN SIGHT' : 'HIDDEN';
        seenInner.style.background = data.seen ? '#ff4040' : '#5a5f6b';
        seenInner.style.color = '#fff';
      } else {
        seenChip.style.display = 'none';
      }
      // --- Weapon slots (g9): v5.1 (P5) — keys 2/3 really switch now,
      // and slot 3 is a real SMG once Rosa hands it over at CH3 ---
      const activeSlot = data.inCar ? -1 : data.weapon === 'smg' ? 2 : 1;
      const slotTexts = [
        'FIST',
        `PISTOL<br>${data.pistolAmmo}/${data.pistolMag}`,
        data.smgUnlocked ? `SMG<br>${data.smgAmmo}/${data.smgMag}` : 'LOCKED',
        'LOCKED',
      ];
      for (let i = 0; i < 4; i += 1) {
        slotDivs[i].innerHTML = slotTexts[i];
        slotDivs[i].style.borderColor = i === activeSlot ? '#ff9a3c' : 'rgba(255,255,255,.25)';
        const locked = i === 3 || (i === 2 && !data.smgUnlocked);
        slotDivs[i].style.opacity = locked ? '0.45' : (data.inCar ? '0.55' : '1');
        slotDivs[i].style.color = locked ? '#9fb6c8' : '#fff';
      }
      slotLabel.textContent = data.inCar ? '' : data.weapon === 'smg' ? NAMES.smg + ' · SMG' : NAMES.weapon + ' · 9MM';
      // --- Bottom-left bars (g4) ---
      districtEl.textContent = data.district;
      healthBar.fill.style.width = `${Math.max(0, data.health)}%`;
      healthBar.fill.style.background = data.health > 50 ? 'linear-gradient(90deg,#37d67a,#a8e063)' : data.health > 25 ? 'linear-gradient(90deg,#f39c12,#f5d76e)' : 'linear-gradient(90deg,#e74c3c,#ff8a7a)';
      healthBar.val.textContent = `${data.health}`;
      if (data.inCar) {
        secondBar.lab.textContent = 'ARMOR';
        secondBar.fill.style.width = `${data.carCondition}%`;
        secondBar.fill.style.background = 'linear-gradient(90deg,#3a86ff,#7db8ff)';
        secondBar.val.textContent = `${data.carCondition}%`;
      } else {
        // On foot the second bar is STAMINA — a real local state in
        // player.js (drains sprinting, refills resting; display only).
        secondBar.lab.textContent = 'STAMINA';
        secondBar.fill.style.width = `${data.stamina}%`;
        secondBar.fill.style.background = 'linear-gradient(90deg,#5ee6ff,#3a86ff)';
        secondBar.val.textContent = `${data.stamina}`;
      }
      respectEl.textContent = `RESPECT ${data.respect}`;
      // --- Message + hint ---
      message.textContent = data.messageTimer > 0 ? data.message : '';
      hint.textContent = data.inCar
        ? 'WASD drive · Space brake · E exit car · Click shoot'
        : 'E enter car · F punch · Click shoot · Shift run · P pause';
      // --- Dialog (g5) ---
      if (data.dialog) {
        dialog.style.display = '';
        const key = data.dialog.who;
        if (key !== portraitKey) {
          portraitKey = key;
          drawPortrait(key);
        }
        dialogName.innerHTML = '';
        const nameSpan = document.createElement('span');
        nameSpan.textContent = data.dialog.who;
        nameSpan.style.color = PORTRAIT_COLORS[key] || '#ffb347';
        const roleSpan = document.createElement('span');
        roleSpan.textContent = ` · ${data.dialog.role}`;
        roleSpan.style.color = '#9fb6c8';
        roleSpan.style.fontSize = '11.5px';
        dialogName.appendChild(nameSpan);
        dialogName.appendChild(roleSpan);
        dialogBody.textContent = data.dialog.text;
      } else {
        dialog.style.display = 'none';
        portraitKey = '';
      }
      // --- Radio (g6): visual widget only; audio.js is untouched ---
      radioPanel.style.opacity = data.inCar ? '1' : '0.45';
      const song = RADIO.songs[data.radio.songIndex % RADIO.songs.length];
      if (data.radio.songIndex !== lastSong) {
        lastSong = data.radio.songIndex;
        rSong.textContent = `${song.title} — ${song.artist}`;
      }
      rProg.style.width = `${Math.round(data.radio.progress * 100)}%`;
      // --- Vehicle panel (g7) ---
      document.body.classList.toggle('incar', !!data.inCar);
      if (data.inCar) {
        vehiclePanel.style.display = '';
        vpName.textContent = data.carModel;
        vpCondFill.style.width = `${data.carCondition}%`;
        vpCondVal.textContent = `${data.carCondition}%`;
        vpSpeed.textContent = `${Math.round(data.speedKmh)}`;
        vpGear.textContent = `GEAR ${data.gear}`;
      } else {
        vehiclePanel.style.display = 'none';
      }
      drawMinimap(data);
    },
    showScreen(name) {
      document.body.classList.toggle('playing', name === 'play' || name === 'paused');
      startScreen.style.display = name === 'start' ? 'flex' : 'none';
      pauseScreen.style.display = name === 'paused' ? 'flex' : 'none';
      bustedScreen.style.display = name === 'busted' ? 'flex' : 'none';
      root.style.display = name === 'play' || name === 'paused' ? 'block' : name === 'start' ? 'none' : 'block';
      if (name === 'start') root.style.display = 'none';
    },
  };
}
