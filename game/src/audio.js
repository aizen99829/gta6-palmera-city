// audio.js — pure WebAudio synthesis, no audio files. Everything is an
// oscillator or filtered noise: engine hum tied to rpm, a two-tone siren,
// gunshots, crashes, UI blips and a tiny radio melody loop. The context
// only starts after the first user gesture, as browsers require.
export function createAudio() {
  let ctx = null; let master = null;
  let engineOsc = null; let engineGain = null;
  let sirenOsc = null; let sirenGain = null; let sirenFlip = null;
  let radioTimer = 0; let radioStep = 0;
  const MELODY = [392, 440, 523, 440, 392, 330, 392, 587, 523, 440, 392, 330, 294, 330, 392, 0];
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      engineOsc.connect(lp); lp.connect(engineGain); engineGain.connect(master); engineOsc.start();
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
      sirenFlip = window.setInterval(() => {
        if (sirenOsc && sirenGain.gain.value > 0.001) {
          sirenOsc.frequency.value = sirenOsc.frequency.value > 800 ? 660 : 960;
        }
      }, 380);
      return true;
    } catch { return false; }
  }
  function blip(freq, dur, type = 'square', vol = 0.12, slide = 0) {
    if (!ensure()) return;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur);
  }
  function noiseBurst(dur, vol, freq) {
    if (!ensure()) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }
  return {
    ensure,
    setEngine(on, rpm01) {
      if (!ctx) return;
      const t = ctx.currentTime;
      engineGain.gain.setTargetAtTime(on ? 0.05 + rpm01 * 0.05 : 0, t, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + rpm01 * 165, t, 0.05);
    },
    setSiren(on, dist01) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on ? 0.028 * (1 - dist01 * 0.7) : 0, ctx.currentTime, 0.15);
    },
    shot(auto) { noiseBurst(auto ? 0.07 : 0.11, 0.20, 2600); blip(auto ? 190 : 150, 0.08, 'square', 0.10, -90); },
    dryFire() { blip(1200, 0.04, 'square', 0.06); },
    reload() { blip(500, 0.06, 'square', 0.08); window.setTimeout(() => blip(760, 0.06, 'square', 0.08), 160); },
    crash(hard) { noiseBurst(hard ? 0.28 : 0.14, hard ? 0.3 : 0.16, 700); },
    punch() { noiseBurst(0.08, 0.14, 500); },
    cash() { blip(880, 0.09, 'sine', 0.12); window.setTimeout(() => blip(1320, 0.14, 'sine', 0.12), 80); },
    ui() { blip(660, 0.06, 'sine', 0.08); },
    stepRadio(dt, inCar) {
      if (!ctx || !inCar) return;
      radioTimer -= dt;
      if (radioTimer <= 0) {
        radioTimer = 0.235;
        const f = MELODY[radioStep % MELODY.length]; radioStep += 1;
        if (f) blip(f, 0.22, 'triangle', 0.045);
      }
    },
  };
}
