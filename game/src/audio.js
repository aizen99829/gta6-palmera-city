// Synthesised sound only — no audio files. A WebAudio graph built lazily on the
// first user gesture (browsers block audio before one): engine hum whose pitch
// follows speed, a two-tone police siren, and short blips for pickups, punches,
// gunshots and mission events.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.25;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function noise(dur, vol, low) {
    if (!ensure()) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = low || 1200;
      const gain = ctx.createGain();
      gain.gain.value = vol || 0.5;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch {
      // Ignore.
    }
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    setEngine(speed01, on) {
      if (!ctx) return;
      try {
        engineGain.gain.setTargetAtTime(on ? 0.05 + 0.06 * speed01 : 0, ctx.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(55 + 160 * speed01, ctx.currentTime, 0.1);
      } catch {
        // Ignore.
      }
    },
    setSiren(on, time) {
      if (!ctx) return;
      try {
        sirenGain.gain.setTargetAtTime(on ? 0.05 : 0, ctx.currentTime, 0.2);
        if (on) {
          sirenTimer += 1;
          sirenOsc.frequency.setTargetAtTime(time % 1 < 0.5 ? 700 : 950, ctx.currentTime, 0.05);
        }
      } catch {
        // Ignore.
      }
    },
    pickup() { blip(880, 0.18, 'sine', 0.5, 1320); },
    punch() { noise(0.12, 0.6, 500); },
    shoot() { noise(0.15, 0.8, 3000); },
    mission() { blip(523, 0.12, 'triangle', 0.5); setTimeout(() => blip(784, 0.2, 'triangle', 0.5), 120); },
    busted() { blip(220, 0.5, 'sawtooth', 0.4, 110); },
    denied() { blip(160, 0.2, 'square', 0.3); },
  };
}
