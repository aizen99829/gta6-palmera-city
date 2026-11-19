// hud.js — every piece of DOM on top of the canvas: mission card, PD
// response panel, wanted readout, weapon slots, the round picture
// minimap (204 CSS px on a 408 px backing canvas so it stays sharp on
// retina), dialog bar with procedural portraits, radio card, vehicle
// panel, touch-control styling and the start/pause/busted screens.
// Layout is responsive: dedicated portrait and landscape arrangements
// keep all six audited panels overlap-free at 390x844, 360x640, 844x390.
import { FONT, MONO, RADIO, WEAPONS } from './config.js';

const CSS = `
*{box-sizing:border-box}
html,body{margin:0;padding:0;overflow:hidden;background:#1c0f26;font-family:${FONT}}
canvas.webgl{position:fixed;inset:0;width:100%;height:100%;display:block}
.panel{background:rgba(10,12,26,.78);border-radius:10px;border-left:3px solid #ff6b9d;
  padding:9px 11px;color:#f4ecf4;backdrop-filter:blur(6px);box-shadow:0 4px 18px rgba(0,0,0,.35)}
#hud-leftcol{position:fixed;top:14px;left:14px;width:308px;display:flex;flex-direction:column;gap:8px;z-index:5}
#hud-mission .mrow1{display:flex;align-items:center;gap:8px}
#hud-chip{background:#ffb347;color:#241203;font-weight:800;font-size:12px;border-radius:5px;padding:2px 7px;white-space:nowrap}
#hud-mtitle{font-size:16px;font-weight:700;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#hud-mtimer{font-family:${MONO};font-size:13px;color:#ffd76a;white-space:nowrap}
#hud-mobj{font-size:13.5px;margin-top:5px;line-height:1.35}
#hud-msub{font-size:12px;color:#ffb3d9;margin-top:2px}
#hud-mbar{display:flex;gap:4px;margin-top:7px}
#hud-mbar i{flex:1;height:5px;border-radius:3px;background:rgba(255,255,255,.18)}
#hud-mbar i.on{background:#ffb347}
#hud-mnext{font-size:12px;color:#cfc4dd;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#hud-pd{border-left-color:#53a8ff}
#hud-pd .pdhead{display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:#aed4ff}
#hud-pd .pdrow{display:flex;align-items:center;gap:7px;font-size:12px;margin-top:4px;font-family:${MONO}}
#hud-pd .pdrow b{flex:1;font-weight:600}
#hud-pd .pchip{border-radius:4px;padding:1px 6px;font-size:10.5px;font-weight:800}
#hud-pd .pdfoot{font-size:11px;color:#ffd76a;margin-top:5px}
#hud-topright{position:fixed;top:14px;right:14px;text-align:right;z-index:5;color:#f4ecf4;
  text-shadow:0 2px 8px rgba(0,0,0,.6)}
#hud-dayclock{font-size:12.5px;font-family:${MONO};color:#ffd9ec}
#hud-money{font-size:30px;font-weight:800;color:#3dff7a;line-height:1.1}
#hud-stars{font-size:22px;color:#ffd76a;letter-spacing:2px;line-height:1.15}
#hud-seen{display:inline-block;margin-top:3px;font-size:11px;font-weight:800;border-radius:5px;padding:2px 8px;background:rgba(120,120,130,.55);color:#eee}
#hud-seen.hot{background:#d81b3b;color:#fff}
#hud-slots{position:fixed;top:136px;right:14px;z-index:5;text-align:right}
#hud-slots .srow{display:flex;gap:6px;justify-content:flex-end}
.slot{width:44px;height:44px;border-radius:8px;background:rgba(10,12,26,.72);border:2px solid rgba(255,255,255,.25);
  color:#f4ecf4;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:9px;font-weight:800}
.slot small{font-family:${MONO};font-size:10px;font-weight:600}
.slot.active{border-color:#ff9f43}
.slot.locked{opacity:.42}
#hud-wlabel{font-size:11.5px;color:#ffd9ec;margin-top:4px;text-shadow:0 1px 6px rgba(0,0,0,.7)}
#hud-leftbottom{position:fixed;left:14px;bottom:14px;width:204px;z-index:5}
#hud-minimap{width:204px;height:204px;border-radius:50%;border:3px solid rgba(255,255,255,.35);
  box-shadow:0 6px 22px rgba(0,0,0,.45);display:block;background:#3f74b8}
#hud-district{margin-top:6px;display:inline-block;background:rgba(10,12,26,.78);color:#ffe9b0;
  font-size:12px;font-weight:700;border-radius:6px;padding:3px 9px}
.bar{height:9px;border-radius:5px;background:rgba(10,12,26,.65);margin-top:5px;overflow:hidden;border:1px solid rgba(255,255,255,.22)}
.bar i{display:block;height:100%;border-radius:5px}
.barlbl{font-size:10px;font-weight:800;color:#e8dff0;letter-spacing:.6px;margin-top:5px;text-shadow:0 1px 4px #000}
#hud-respect{font-size:11.5px;color:#ffd76a;font-family:${MONO};margin-top:5px;text-shadow:0 1px 4px #000}
#hud-rightbottom{position:fixed;right:14px;bottom:14px;width:252px;display:flex;flex-direction:column;gap:8px;z-index:5}
#hud-radio .rhead{font-size:13px;font-weight:800;color:#ffb3d9}
#hud-rsong{font-size:12.5px;margin-top:2px}
#hud-radio .rshow{font-size:11px;color:#cfc4dd}
.eq{display:flex;gap:3px;align-items:flex-end;height:14px;margin-top:5px}
.eq i{flex:1;background:#ff6b9d;border-radius:2px;animation:eqA 0.7s ease-in-out infinite alternate}
.eq i:nth-child(2){animation-duration:.53s}.eq i:nth-child(3){animation-duration:.87s}
.eq i:nth-child(4){animation-duration:.61s}.eq i:nth-child(5){animation-duration:.79s}
@keyframes eqA{from{height:22%}to{height:100%}}
.rprog{height:3px;background:rgba(255,255,255,.18);border-radius:2px;margin-top:6px;overflow:hidden}
.rprog i{display:block;height:100%;background:#ffb347}
#hud-vehicle .vrow{display:flex;justify-content:space-between;align-items:baseline}
#hud-vname{font-size:14px;font-weight:700}
#hud-gear{font-family:${MONO};font-size:11px;background:#2c3040;border-radius:4px;padding:1px 7px;color:#ffd76a}
#hud-speed{font-size:46px;font-weight:800;line-height:1;color:#fff}
#hud-speed small{font-size:13px;color:#cfc4dd;font-weight:700}
#hud-dialog{position:fixed;left:50%;transform:translateX(-50%);bottom:16px;width:min(560px,92vw);
  display:flex;gap:11px;align-items:center;z-index:6}
#hud-portrait{width:64px;height:64px;border-radius:9px;flex:none;background:#241433}
#hud-dwho{font-size:13.5px;font-weight:800}
#hud-dwho span{font-size:10.5px;color:#ffb347;font-weight:700;margin-left:6px}
#hud-dtext{font-size:13.5px;line-height:1.4;margin-top:2px}
#hud-hint{position:fixed;top:12px;left:50%;transform:translateX(-50%);font-size:12px;color:rgba(255,255,255,.75);
  text-shadow:0 1px 5px #000;z-index:4;white-space:nowrap}
#hud-message{position:fixed;top:24%;left:50%;transform:translate(-50%,-50%);font-size:30px;font-weight:800;
  color:#ffe9b0;text-shadow:0 3px 14px rgba(0,0,0,.75);z-index:7;text-align:center;pointer-events:none;width:92vw}
#status{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.screen{position:fixed;inset:0;z-index:20;display:none;flex-direction:column;align-items:center;justify-content:center;
  text-align:center;color:#fff;padding:20px}
.screen.on{display:flex}
#screen-start{background:linear-gradient(180deg,rgba(46,26,71,.20),rgba(20,8,28,.58))}
#screen-start h1{font-size:min(74px,13vw);margin:0;font-weight:900;letter-spacing:2px;
  background:linear-gradient(92deg,#ff6b9d,#ffb347);-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 4px 16px rgba(255,107,157,.45))}
#screen-start .sub{font-size:min(19px,4.4vw);color:#ffe9f4;margin-top:2px}
#screen-start .card{margin-top:20px;background:rgba(10,12,26,.72);border-radius:12px;padding:13px 20px;
  font-size:14px;line-height:1.65;text-align:left}
#screen-start .go{margin-top:18px;font-size:17px;font-weight:800;color:#ffd76a;animation:pls 1.4s ease-in-out infinite}
@keyframes pls{50%{opacity:.45}}
#screen-pause{background:rgba(24,10,38,.72)}
#screen-busted{background:rgba(60,4,14,.66)}
.screen h2{font-size:52px;margin:0;letter-spacing:3px}
#screen-busted h2{color:#ff5060}
.screen p{font-size:16px;color:#ffe9f4}
#touch{display:none;z-index:15}
body.playing #touch{display:block}
#stick{position:fixed;left:12px;bottom:12px;width:118px;height:118px;border-radius:50%;
  background:rgba(255,255,255,.10);border:2px solid rgba(255,255,255,.35);z-index:15}
#stickKnob{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;
  background:rgba(255,255,255,.32);border:2px solid rgba(255,255,255,.5)}
.tbtn{position:fixed;width:64px;height:64px;border-radius:50%;background:rgba(10,12,26,.55);
  border:2px solid rgba(255,255,255,.4);color:#fff;font-weight:800;font-size:14px;z-index:15;
  display:flex;align-items:center;justify-content:center}
#btnGas{right:14px;bottom:14px;background:rgba(20,90,40,.55)}
#btnBrk{right:90px;bottom:14px;background:rgba(120,30,30,.55)}
#btnAct{right:14px;bottom:90px;background:rgba(50,50,120,.55)}
@media (max-width:600px){
  #hud-leftcol{width:190px;top:8px;left:8px}
  #hud-mtitle{font-size:14px;white-space:normal}
  #hud-mobj{font-size:12.5px}
  #hud-mnext{font-size:11px;white-space:normal}
  #hud-pd{max-height:88px;overflow:hidden}
  #hud-topright{top:8px;right:8px}
  #hud-money{font-size:22px}
  #hud-stars{font-size:19px}
  #hud-leftbottom{left:auto;right:8px;top:148px;bottom:auto;width:118px}
  #hud-minimap{width:118px;height:118px}
  #hud-slots{top:400px;right:8px}
  .slot{width:40px;height:40px}
  #hud-radio{display:none}
  #hud-rightbottom{right:8px;bottom:190px;width:172px}
  #hud-speed{font-size:34px}
  #hud-dialog{left:8px;transform:none;width:52vw;bottom:150px}
  body.incar #hud-dialog{bottom:302px}
  body.incar #hud-slots{display:none}
  #hud-hint{display:none}
}
@media (max-width:600px) and (max-height:700px){
  #hud-slots{top:auto;bottom:270px}
  .slot{width:36px;height:36px}
  #hud-dialog{width:48vw}
  #hud-district,#hud-respect,.armor-row{display:none}
}
@media (max-height:500px){
  #hud-leftcol{width:296px;top:8px;left:8px}
  #hud-mnext,#hud-msub{display:none}
  #hud-pd{max-height:80px;overflow:hidden}
  #hud-topright{top:8px;right:8px}
  #hud-money{font-size:22px}
  #hud-slots{top:8px;left:312px;right:auto}
  #hud-leftbottom{left:136px;bottom:8px;width:88px}
  #hud-minimap{width:88px;height:88px}
  #hud-district,.barlbl,.bar,#hud-respect{display:none}
  #hud-radio{display:none}
  #hud-rightbottom{left:252px;right:auto;bottom:8px;width:210px}
  #hud-speed{font-size:32px}
  #hud-dialog{bottom:126px;width:min(420px,50vw)}
  #hud-hint{display:none}
}`;

function el(tag, id, cls, parent, html) {
  const e = document.createElement(tag);
  if (id) e.id = id;
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}
function drawPortrait(cv, who) {
  const g = cv.getContext('2d');
  const accent = who === 'Rosa' ? '#ff2d78' : who === 'Marco' ? '#3f8cff' : '#ffb347';
  const grad = g.createRadialGradient(32, 26, 4, 32, 32, 46);
  grad.addColorStop(0, accent); grad.addColorStop(1, '#1c0f26');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#2c3040'; g.fillRect(14, 52, 36, 12);          // shoulders
  g.fillStyle = '#c98a5e'; g.beginPath(); g.arc(32, 34, 13, 0, Math.PI * 2); g.fill(); // face
  if (who === 'Rosa') {
    g.fillStyle = '#571233'; g.beginPath(); g.arc(32, 26, 14, Math.PI, Math.PI * 2); g.fill();
    g.fillRect(17, 24, 3, 16); g.fillRect(44, 24, 3, 16);
    g.fillStyle = '#101418'; g.fillRect(20, 31, 24, 6);           // sunglasses
  } else if (who === 'Marco') {
    g.fillStyle = '#274b73'; g.beginPath(); g.arc(32, 27, 14, Math.PI, Math.PI * 2); g.fill();
    g.fillRect(17, 26, 30, 4);                                    // cap + brim
    g.fillStyle = 'rgba(60,40,26,.8)'; g.fillRect(24, 42, 16, 6); // stubble
  } else {
    g.fillStyle = '#4a1030'; g.beginPath(); g.arc(32, 25, 14.5, Math.PI, Math.PI * 2); g.fill();
    g.fillRect(16, 22, 4, 20); g.fillRect(44, 22, 4, 20);
    g.fillStyle = '#ffcf4d'; g.beginPath(); g.arc(46, 38, 2.4, 0, Math.PI * 2); g.fill(); // earring
  }
}

export function createHud(world) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const root = el('div', 'hud-root', '', document.body);
  // left column: mission card + PD response
  const leftcol = el('div', 'hud-leftcol', '', root);
  const mission = el('div', 'hud-mission', 'panel', leftcol);
  mission.innerHTML = '<div class="mrow1"><span id="hud-chip">CH 1</span>' +
    '<span id="hud-mtitle">First Wheels</span><span id="hud-mtimer"></span></div>' +
    '<div id="hud-mobj"></div><div id="hud-msub"></div><div id="hud-mbar"></div>' +
    '<div id="hud-mnext"></div>';
  const pd = el('div', 'hud-pd', 'panel', leftcol);
  pd.style.display = 'none';
  // top right: clock, money, stars, seen chip
  const topright = el('div', 'hud-topright', '', root);
  topright.innerHTML = '<div id="hud-dayclock">DAY 1 · 18:24</div><div id="hud-money">$250</div>' +
    '<div id="hud-stars"></div><span id="hud-seen" style="display:none">HIDDEN</span>';
  // weapon slots
  const slots = el('div', 'hud-slots', '', root);
  slots.innerHTML = '<div class="srow">' +
    '<div class="slot" data-slot="0">FIST</div>' +
    '<div class="slot active" data-slot="1">PISTOL<small>12/12</small></div>' +
    '<div class="slot locked" data-slot="2">SMG<small>LOCKED</small></div>' +
    '<div class="slot locked" data-slot="3">—<small>LOCKED</small></div></div>' +
    '<div id="hud-wlabel">La Chica</div>';
  // left bottom: minimap + district + bars + respect
  const leftbottom = el('div', 'hud-leftbottom', '', root);
  const mm = el('canvas', 'hud-minimap', '', leftbottom);
  mm.width = 408; mm.height = 408;
  el('div', 'hud-district', '', leftbottom, 'Rambla del Sol');
  el('div', '', 'barlbl', leftbottom, 'HEALTH');
  const healthBar = el('div', '', 'bar', leftbottom, '<i style="background:#3ddc68;width:100%"></i>');
  el('div', '', 'barlbl armor-row', leftbottom, 'ARMOR');
  const armorBar = el('div', '', 'bar armor-row', leftbottom, '<i style="background:#53a8ff;width:100%"></i>');
  el('div', 'hud-respect', '', leftbottom, 'RESPECT 0');
  // right bottom: radio + vehicle
  const rightbottom = el('div', 'hud-rightbottom', '', root);
  const radio = el('div', 'hud-radio', 'panel', rightbottom);
  radio.innerHTML = `<div class="rhead">♪ ${RADIO.station} ${RADIO.freq}</div>` +
    '<div id="hud-rsong"></div><div class="rshow"></div>' +
    '<div class="eq"><i></i><i></i><i></i><i></i><i></i></div><div class="rprog"><i></i></div>';
  radio.querySelector('.rshow').textContent = RADIO.show;
  const vehicle = el('div', 'hud-vehicle', 'panel', rightbottom);
  vehicle.style.display = 'none';
  vehicle.innerHTML = '<div class="vrow"><span id="hud-vname">—</span><span id="hud-gear">N</span></div>' +
    '<div class="barlbl">CONDITION</div><div class="bar"><i id="hud-vcond" style="background:#ffb347;width:100%"></i></div>' +
    '<div id="hud-speed">0 <small>KM/H</small></div>';
  // dialog, hint, message, status, screens
  const dialog = el('div', 'hud-dialog', 'panel', root);
  dialog.style.display = 'none';
  dialog.innerHTML = '<canvas id="hud-portrait" width="64" height="64"></canvas>' +
    '<div><div id="hud-dwho"></div><div id="hud-dtext"></div></div>';
  el('div', 'hud-hint', '', root, 'WASD drive · E enter car · mouse aim, click shoot · R reload · 1/2 weapons · Esc pause');
  el('div', 'hud-message', '', root);
  el('div', 'status', '', root).setAttribute('aria-live', 'polite');
  const mkScreen = (id, html) => {
    const s = el('div', id, 'screen', root, html);
    return s;
  };
  const scrStart = mkScreen('screen-start',
    '<h1>PALMERA CITY</h1><div class="sub">Senja di atas teluk — satu utang terakhir, Luz.</div>' +
    '<div class="card"><b>WASD / stik</b> — jalan & menyetir<br><b>E</b> — masuk / keluar mobil<br>' +
    '<b>Mouse</b> — bidik & tembak · <b>R</b> reload · <b>1/2</b> ganti senjata<br>' +
    '<b>Shift</b> — lari · <b>Spasi</b> — rem / lanjut</div>' +
    '<div class="go">KLIK ATAU SENTUH UNTUK MULAI</div>');
  const scrPause = mkScreen('screen-pause', '<h2>PAUSED</h2><p>Esc atau klik untuk lanjut.</p>');
  const scrBusted = mkScreen('screen-busted', '<h2 id="hud-busted-title">BUSTED</h2><p id="hud-busted-sub">Palmera PD menahanmu. Denda $100.</p><p>Klik atau Spasi untuk lanjut.</p>');
  const screens = { start: scrStart, pause: scrPause, busted: scrBusted };

  // ---- minimap base, pre-rendered once from world data ----
  const MM = 408; const WORLD_SPAN = 580;
  const base = document.createElement('canvas'); base.width = 760; base.height = 760;
  {
    const g = base.getContext('2d');
    const S = 760 / WORLD_SPAN; const ox = 380; const oz = 380;
    g.fillStyle = '#3f74b8'; g.fillRect(0, 0, 760, 760);                    // sea surround
    g.fillStyle = '#8c6a78'; g.fillRect(0, 0, 760, (world.beachZ + 290) * S); // block ground
    g.fillStyle = '#eecfa0'; g.fillRect(0, (world.beachZ + 290) * S, 760, (world.seaZ - world.beachZ) * S); // sand
    g.fillStyle = '#e8d8c8';                                                // road network
    for (const c of world.roadCentres) {
      g.fillRect((c - 7 + 290) * S, 0, 14 * S, (world.seaZ + 290) * S);
      g.fillRect(0, (c - 7 + 290) * S, 760, 14 * S);
    }
    g.fillStyle = '#4a3550';                                                // rooftops
    for (const c of world.colliders) {
      if (c.maxX - c.minX < 3) continue;
      g.fillRect((c.minX + 290) * S, (c.minZ + 290) * S, (c.maxX - c.minX) * S, (c.maxZ - c.minZ) * S);
    }
    void ox; void oz;
  }
  const mmCtx = mm.getContext('2d');
  function drawMinimap(d) {
    const g = mmCtx; const S = MM / 204;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, MM, MM);
    g.setTransform(S, 0, 0, S, 0, 0);
    g.save();
    g.beginPath(); g.arc(102, 102, 100, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#3f74b8'; g.fillRect(0, 0, 204, 204);
    const viewM = 230; // metres across the viewport
    const pxPerM = 204 / viewM;
    const bScale = 760 / WORLD_SPAN;
    const srcSize = viewM * bScale;
    const sx = (d.player.x + 290) * bScale - srcSize / 2;
    const sy = (d.player.z + 290) * bScale - srcSize / 2;
    g.drawImage(base, sx, sy, srcSize, srcSize, 0, 0, 204, 204);
    const toPx = (x, z) => [102 + (x - d.player.x) * pxPerM, 102 + (z - d.player.z) * pxPerM];
    if (d.stars > 0) { // search zone ring
      const [cx, cy] = toPx(d.player.x, d.player.z);
      g.beginPath(); g.arc(cx, cy, d.searchR * pxPerM, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,60,80,0.14)'; g.fill();
      g.strokeStyle = 'rgba(255,60,80,0.9)'; g.lineWidth = 2.5; g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.75)';
    for (const t of d.trafficPos) {
      const [x, y] = toPx(t.x, t.z);
      if (x < -4 || y < -4 || x > 208 || y > 208) continue;
      g.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    for (const p of d.policePos) {
      const [x, y] = toPx(p.x, p.z);
      if (x < -5 || y < -5 || x > 209 || y > 209) continue;
      g.fillStyle = (Math.floor(d.time * 3) % 2 === 0) ? '#ff4050' : '#3f8cff';
      g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
    }
    if (d.waypoint) {
      const [x, y] = toPx(d.waypoint.x, d.waypoint.z);
      const cx = Math.max(10, Math.min(194, x)); const cy = Math.max(10, Math.min(194, y));
      g.fillStyle = '#ffb347';
      g.save(); g.translate(cx, cy); g.rotate(Math.PI / 4); g.fillRect(-5, -5, 10, 10); g.restore();
    }
    // player arrow
    g.save(); g.translate(102, 102); g.rotate(d.player.heading);
    g.fillStyle = '#ffffff'; g.beginPath();
    g.moveTo(0, -8); g.lineTo(5.5, 6); g.lineTo(0, 3); g.lineTo(-5.5, 6); g.closePath(); g.fill();
    g.restore();
    g.fillStyle = '#fff'; g.font = "bold 13px 'Segoe UI', sans-serif"; g.textAlign = 'center';
    g.fillText('N', 102, 16);
    g.restore();
  }

  const $ = (id) => document.getElementById(id);
  let lastDialogWho = null;
  let cache = '';
  function update(d) {
    document.body.classList.toggle('incar', !!d.inCar);
    $('hud-money').textContent = '$' + d.money.toLocaleString('en-US');
    const clock = ((d.clockMin % 1440) + 1440) % 1440;
    $('hud-dayclock').textContent = `DAY ${d.day} · ${String(Math.floor(clock / 60)).padStart(2, '0')}:${String(Math.floor(clock % 60)).padStart(2, '0')}`;
    $('hud-stars').textContent = d.stars > 0 ? '★'.repeat(d.stars) + '☆'.repeat(5 - d.stars) : '';
    const seen = $('hud-seen');
    if (d.stars > 0) {
      seen.style.display = 'inline-block';
      seen.textContent = d.seen ? 'IN SIGHT' : 'HIDDEN';
      seen.classList.toggle('hot', !!d.seen);
    } else seen.style.display = 'none';
    // mission card
    const m = d.mission;
    $('hud-chip').textContent = m.done ? 'FREE' : `CH ${m.chapter}`;
    $('hud-mtitle').textContent = m.title;
    $('hud-mtimer').textContent = m.timerSec !== null && !m.done ? '◷ ' + Math.floor(m.timerSec / 60) + ':' + String(Math.floor(m.timerSec % 60)).padStart(2, '0') : '';
    $('hud-mobj').textContent = m.objective;
    $('hud-msub').textContent = m.sub || '';
    $('hud-mnext').textContent = m.done ? '' : 'NEXT ▸ ' + m.nextText;
    const bar = $('hud-mbar');
    const barKey = `${m.stepIndex}/${m.stepCount}`;
    if (bar.dataset.k !== barKey) {
      bar.dataset.k = barKey;
      bar.innerHTML = '';
      for (let i = 0; i < m.stepCount; i += 1) {
        const seg = document.createElement('i');
        if (i < m.stepIndex) seg.className = 'on';
        bar.appendChild(seg);
      }
    }
    // PD panel (rebuilt only when its text actually changes)
    const pdKey = d.police.map((p) => `${p.callsign}${p.dist}${p.status}`).join('|') + d.heliActive;
    if (pdKey !== cache) {
      cache = pdKey;
      if (d.police.length === 0) pd.style.display = 'none';
      else {
        pd.style.display = 'block';
        const chipColor = { RAMMING: '#d81b3b', ROADBLOCK: '#c9a227', PURSUIT: '#e07b28' };
        pd.innerHTML = `<div class="pdhead"><span>● PALMERA PD RESPONSE</span><span>${d.police.length} UNITS • CODE ${d.stars}</span></div>` +
          d.police.slice(0, 7).map((p) =>
            `<div class="pdrow"><span style="color:#53a8ff">▬</span><b>${p.callsign}</b><span>${p.dist} m</span>` +
            `<span class="pchip" style="background:${chipColor[p.status] || '#888'};color:#fff">${p.status}</span></div>`).join('') +
          (d.heliActive ? '<div class="pdfoot">+1 AIR UNIT IN THE SEARCH ZONE</div>' : '');
      }
    }
    // bars, respect, district
    healthBar.firstChild.style.width = `${Math.max(0, Math.min(100, d.health))}%`;
    healthBar.firstChild.style.background = d.health > 50 ? '#3ddc68' : d.health > 25 ? '#ffb347' : '#ff4050';
    armorBar.firstChild.style.width = `${d.armor === null ? 0 : d.armor}%`;
    armorBar.style.opacity = d.armor === null ? '0.35' : '1';
    $('hud-respect').textContent = `RESPECT ${d.respect}`;
    $('hud-district').textContent = d.district;
    // weapon slots
    const slotEls = slots.querySelectorAll('.slot');
    slotEls.forEach((s) => {
      const n = Number(s.dataset.slot);
      s.classList.toggle('active', d.weapon.slot === n);
      if (n === 1) { s.classList.remove('locked'); s.querySelector('small').textContent = `${d.weapon.ammo}/${WEAPONS.pistol.mag}`; }
      if (n === 2) {
        s.classList.toggle('locked', !d.smgUnlocked);
        s.querySelector('small').textContent = d.smgUnlocked
          ? (d.weapon.slot === 2 ? `${d.weapon.ammo}/${WEAPONS.smg.mag}` : 'READY') : 'LOCKED';
      }
      s.style.opacity = d.inCar ? '0.45' : '1';
    });
    $('hud-wlabel').textContent = d.weapon.label;
    // radio
    const song = RADIO.songs[d.radio.songIndex % RADIO.songs.length];
    $('hud-rsong').textContent = `${song.title} — ${song.artist}`;
    radio.querySelector('.rprog i').style.width = `${Math.round(d.radio.progress * 100)}%`;
    // vehicle panel
    vehicle.style.display = d.inCar ? 'block' : 'none';
    if (d.inCar) {
      $('hud-vname').textContent = d.carModel;
      $('hud-gear').textContent = d.gear;
      $('hud-vcond').style.width = `${d.carCondition}%`;
      $('hud-speed').innerHTML = `${Math.round(d.speedKmh)} <small>KM/H</small>`;
    }
    // dialog
    if (d.dialog) {
      dialog.style.display = 'flex';
      if (lastDialogWho !== d.dialog.who) {
        lastDialogWho = d.dialog.who;
        drawPortrait($('hud-portrait'), d.dialog.who);
      }
      $('hud-dwho').innerHTML = `${d.dialog.who}<span>${d.dialog.role}</span>`;
      $('hud-dtext').textContent = d.dialog.text;
    } else { dialog.style.display = 'none'; lastDialogWho = null; }
    // center message
    const msg = $('hud-message');
    msg.textContent = d.message || '';
    drawMinimap(d);
  }
  function showScreen(name, opts = {}) {
    for (const [k, s] of Object.entries(screens)) s.classList.toggle('on', k === name);
    document.body.classList.toggle('playing', name === null);
    if (name === 'busted' && opts.title) $('hud-busted-title').textContent = opts.title;
    if (name === 'busted' && opts.sub) $('hud-busted-sub').textContent = opts.sub;
    $('status').textContent = name === null ? 'Playing' :
      name === 'start' ? 'Palmera City — start screen' :
      name === 'pause' ? 'Paused' : 'Busted';
  }
  return { update, showScreen, root };
}
