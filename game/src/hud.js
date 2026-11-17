// HUD: all DOM overlays plus the 2D minimap canvas. Money, wanted stars,
// health bar, speed, clock, mission tracker, message line — and the start,
// pause and busted screens. The minimap draws the road grid, the beach, the
// player arrow, police dots, traffic dots and the mission waypoint diamond.
import { CITY, FONT } from './config.js';

function el(tag, id, parent, css) {
  const e = document.createElement(tag);
  if (id) e.id = id;
  e.style.cssText = css;
  parent.appendChild(e);
  return e;
}

const BASE = 'position:absolute;color:#fff;font-family:' + FONT + ';text-shadow:0 2px 4px rgba(0,0,0,.7);pointer-events:none;user-select:none;';

export function createHud() {
  const root = el('div', 'hud', document.body, 'position:fixed;inset:0;pointer-events:none;z-index:5;');
  const topLeft = el('div', 'hud-topleft', root, BASE + 'top:14px;left:16px;font-size:20px;font-weight:700;');
  const money = el('div', 'hud-money', topLeft, '');
  const stars = el('div', 'hud-stars', topLeft, 'color:#ffd94a;font-size:26px;letter-spacing:4px;');
  const healthWrap = el('div', 'hud-healthwrap', topLeft, 'width:220px;height:14px;background:rgba(0,0,0,.55);border:1px solid #fff8;border-radius:7px;margin-top:6px;overflow:hidden;');
  const healthBar = el('div', 'hud-health', healthWrap, 'height:100%;width:100%;background:linear-gradient(90deg,#37d67a,#a8e063);');
  const topRight = el('div', 'hud-topright', root, BASE + 'top:14px;right:16px;text-align:right;font-size:20px;font-weight:700;');
  const clock = el('div', 'hud-clock', topRight, '');
  const speed = el('div', 'hud-speed', topRight, 'font-size:15px;color:#cfe6ff;');
  const ammo = el('div', 'hud-ammo', topRight, 'font-size:15px;color:#ffe9a8;');
  const objective = el('div', 'hud-objective', root, BASE + 'top:118px;left:16px;max-width:360px;background:rgba(0,0,0,.55);padding:10px 12px;border-radius:8px;font-size:15px;line-height:1.45;');
  const objTitle = el('div', 'hud-objtitle', objective, 'font-weight:800;color:#ffd94a;margin-bottom:2px;');
  const objText = el('div', 'hud-objtext', objective, '');
  const message = el('div', 'hud-message', root, BASE + 'left:50%;bottom:150px;transform:translateX(-50%);font-size:19px;font-weight:700;color:#ffe9a8;');
  const hint = el('div', 'hud-hint', root, BASE + 'left:50%;bottom:24px;transform:translateX(-50%);font-size:14px;color:#e8f2ff;background:rgba(0,0,0,.45);padding:6px 12px;border-radius:6px;');
  const minimap = el('canvas', 'hud-minimap', root, 'position:absolute;right:16px;bottom:16px;width:190px;height:190px;border:2px solid rgba(255,255,255,.75);border-radius:50%;background:#1c2b33;box-shadow:0 4px 18px rgba(0,0,0,.5);');
  minimap.width = 190;
  minimap.height = 190;
  const ctx = minimap.getContext('2d');

  // Full-screen menu overlays (pointer events on, so buttons click).
  function overlay(id, html) {
    const o = el('div', id, document.body, 'position:fixed;inset:0;z-index:10;display:flex;align-items:center;justify-content:center;background:rgba(8,18,28,.72);color:#fff;font-family:' + FONT + ';');
    o.innerHTML = html;
    o.style.display = 'none';
    return o;
  }
  const startScreen = overlay('screen-start', `
    <div style="text-align:center;max-width:640px;padding:24px;">
      <div style="font-size:64px;font-weight:900;letter-spacing:2px;color:#ffd94a;text-shadow:0 4px 0 #c0392b,0 8px 24px rgba(0,0,0,.6);">PALMERA CITY</div>
      <div style="font-size:18px;margin-top:6px;color:#cfe6ff;">A sun-soaked open-world crime story — an original city, not Vice City.</div>
      <div style="margin-top:18px;font-size:15px;line-height:1.7;text-align:left;background:rgba(0,0,0,.45);padding:14px 18px;border-radius:10px;">
        <b>Luz Vega</b> owes the harbour crew a debt. Four jobs pay it off — if the Palmera PD lets her.<br>
        <b>WASD</b> move / drive &nbsp;·&nbsp; <b>Mouse drag</b> camera &nbsp;·&nbsp; <b>E</b> enter / exit car &nbsp;·&nbsp; <b>F</b> punch &nbsp;·&nbsp; <b>Click</b> shoot &nbsp;·&nbsp; <b>R</b> reload &nbsp;·&nbsp; <b>Shift</b> run &nbsp;·&nbsp; <b>P / Esc</b> pause<br>
        Steal cars, run missions, outrun the cops. Follow the yellow waypoint.
      </div>
      <div style="margin-top:20px;font-size:20px;font-weight:700;color:#ffd94a;">Press SPACE or click to start</div>
      <div style="margin-top:8px;font-size:13px;color:#9fb6c8;">Progress saves automatically to this browser.</div>
    </div>`);
  const pauseScreen = overlay('screen-pause', `
    <div style="text-align:center;">
      <div style="font-size:44px;font-weight:900;">PAUSED</div>
      <div style="margin-top:10px;font-size:16px;color:#cfe6ff;">Palmera City waits for no one — except now.</div>
      <div style="margin-top:18px;font-size:18px;font-weight:700;color:#ffd94a;">Press P or SPACE to resume</div>
    </div>`);
  const bustedScreen = overlay('screen-busted', `
    <div style="text-align:center;">
      <div style="font-size:56px;font-weight:900;color:#ff5a4a;">BUSTED</div>
      <div style="margin-top:10px;font-size:16px;color:#cfe6ff;">The Palmera PD caught up with Luz. The debt is still waiting.</div>
      <div style="margin-top:18px;font-size:18px;font-weight:700;color:#ffd94a;">Press SPACE to try again</div>
    </div>`);

  let lastStars = -1;

  function drawMinimap(data) {
    const W = 190;
    const H = 190;
    const scale = W / (CITY.size * 2);
    const toX = (x) => W / 2 + x * scale;
    const toY = (z) => H / 2 + z * scale;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#24343c';
    ctx.fillRect(0, 0, W, H);
    // Sea + sand (south edge).
    ctx.fillStyle = '#1e7fa8';
    ctx.fillRect(0, toY(CITY.seaZ), W, H - toY(CITY.seaZ));
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(0, toY(CITY.beachZ), W, toY(CITY.seaZ) - toY(CITY.beachZ));
    // Roads.
    ctx.strokeStyle = '#5a636b';
    ctx.lineWidth = 4;
    const half = ((7 - 1) / 2) * CITY.pitch;
    for (let i = 0; i < 7; i += 1) {
      const c = -half + i * CITY.pitch;
      ctx.beginPath(); ctx.moveTo(toX(c), 0); ctx.lineTo(toX(c), H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, toY(c)); ctx.lineTo(W, toY(c)); ctx.stroke();
    }
    // Waypoint diamond.
    if (data.waypoint) {
      const wx = toX(data.waypoint.x);
      const wy = toY(data.waypoint.z);
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.moveTo(wx, wy - 8); ctx.lineTo(wx + 7, wy); ctx.lineTo(wx, wy + 8); ctx.lineTo(wx - 7, wy);
      ctx.closePath(); ctx.fill();
    }
    // Traffic dots.
    ctx.fillStyle = '#dfe9ef';
    for (const t of data.traffic || []) {
      ctx.fillRect(toX(t.x) - 1.5, toY(t.z) - 1.5, 3, 3);
    }
    // Police dots (blue, flashing).
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    ctx.fillStyle = flash ? '#3a86ff' : '#ff3b30';
    for (const p of data.police || []) {
      ctx.beginPath(); ctx.arc(toX(p.x), toY(p.z), 4, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow.
    const px = toX(data.player.x);
    const py = toY(data.player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(data.player.heading);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(-5, 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  return {
    update(data) {
      money.textContent = `$${Math.floor(data.money).toLocaleString('en-US')}`;
      const starsNow = Math.max(0, Math.min(5, data.stars));
      if (starsNow !== lastStars) {
        stars.textContent = '★'.repeat(starsNow) + '☆'.repeat(5 - starsNow);
        lastStars = starsNow;
      }
      healthBar.style.width = `${Math.max(0, data.health)}%`;
      healthBar.style.background = data.health > 50 ? 'linear-gradient(90deg,#37d67a,#a8e063)' : data.health > 25 ? 'linear-gradient(90deg,#f39c12,#f5d76e)' : 'linear-gradient(90deg,#e74c3c,#ff8a7a)';
      const hh = String(Math.floor(data.clockMin / 60) % 24).padStart(2, '0');
      const mm = String(Math.floor(data.clockMin % 60)).padStart(2, '0');
      clock.textContent = `${hh}:${mm}`;
      speed.textContent = data.inCar ? `${Math.round(data.speedKmh)} km/h — ${data.carName || 'car'}` : 'On foot';
      ammo.textContent = data.inCar ? '' : `Pistol ${data.ammo} / ${data.magSize}`;
      objTitle.textContent = data.missionTitle;
      objText.textContent = data.objective;
      message.textContent = data.messageTimer > 0 ? data.message : '';
      hint.textContent = data.inCar
        ? 'WASD drive · Space brake · E exit car · Click shoot'
        : 'E enter car · F punch · Click shoot · Shift run · P pause';
      drawMinimap(data);
    },
    showScreen(name) {
      startScreen.style.display = name === 'start' ? 'flex' : 'none';
      pauseScreen.style.display = name === 'paused' ? 'flex' : 'none';
      bustedScreen.style.display = name === 'busted' ? 'flex' : 'none';
      root.style.display = name === 'play' || name === 'paused' ? 'block' : name === 'start' ? 'none' : 'block';
      if (name === 'start') root.style.display = 'none';
    },
  };
}
