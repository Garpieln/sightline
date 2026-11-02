let ctx = null;

export function audio() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no audio */ }
  }
  if (ctx && ctx.state === "suspended") ctx.resume();
  return ctx;
}

// Schedule a short tone at a performance.now() timestamp.
function tone(atPerf, freq, dur, type, gain) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + Math.max(0, (atPerf - performance.now()) / 1000);
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

export const click = (at, accent) => tone(at, accent ? 1760 : 1180, 0.05, "sine", accent ? 0.35 : 0.22);
export const buzz = () => tone(performance.now(), 98, 0.22, "square", 0.08);
