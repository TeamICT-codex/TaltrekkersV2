// Alle geluid wordt ter plekke gesynthetiseerd (Karplus–Strong koto, klankschalen,
// houtblokjes, windgong, bamboe-klop, wind). Geen audiobestanden, geen netwerk.
//
// Klasvriendelijke standaard: geluidseffecten zacht aan, sfeermuziek UIT.

import { clamp, pick, rand, randi, store } from './util';

type Cat = 'sfx' | 'music';
interface OutOpts { wet?: number; dry?: number; cat?: Cat; pan?: number }

interface PluckEntry { buf: AudioBuffer; rate: number }

type ACtor = typeof AudioContext;

function createSound() {
  let ctx: AudioContext | null = null;
  let master: GainNode, sfxDry: GainNode, sfxWet: GainNode, musDry: GainNode, musWet: GainNode;
  let noiseBuf: AudioBuffer | null = null;
  let sfxOn = store.get<boolean>('sfx', true);
  let musOn = store.get<boolean>('music', false);
  const cache = new Map<number, PluckEntry>();
  const SCALE = [0, 2, 3, 7, 8]; // de koto "In"-toonladder
  const ROOT = 220;
  let ambOn = false, ambTimer = 0, ambIdx = 3, lastKnock = 0;
  let wind: { src: AudioBufferSourceNode; g: GainNode; lfo: OscillatorNode; lfo2: OscillatorNode } | null = null;

  const note = (i: number) => {
    const o = Math.floor(i / 5), d = ((i % 5) + 5) % 5;
    return ROOT * Math.pow(2, o + SCALE[d] / 12);
  };

  function init(): boolean {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    const AC: ACtor | undefined = window.AudioContext
      || (window as unknown as { webkitAudioContext?: ACtor }).webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
    } catch {
      ctx = null;
      return false;
    }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.3;
    master = ctx.createGain(); master.gain.value = 0.62;
    master.connect(comp); comp.connect(ctx.destination);
    const reverb = ctx.createConvolver(); reverb.buffer = makeIR(3.4);
    const rv = ctx.createGain(); rv.gain.value = 0.8; reverb.connect(rv); rv.connect(master);
    sfxDry = ctx.createGain(); sfxWet = ctx.createGain(); musDry = ctx.createGain(); musWet = ctx.createGain();
    sfxDry.connect(master); sfxWet.connect(reverb); musDry.connect(master); musWet.connect(reverb);
    sfxDry.gain.value = sfxWet.gain.value = sfxOn ? 1 : 0;
    musDry.gain.value = musWet.gain.value = musOn ? 1 : 0;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    // Snaren op voorhand "stemmen" in kleine stapjes zodat de eerste noot niet hapert.
    let k = -7;
    const warm = () => { if (!ctx || k > 16) return; pluckBuf(note(k)); k++; window.setTimeout(warm, 12); };
    window.setTimeout(warm, 40);
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (musOn) startAmbient();
    return true;
  }

  function makeIR(sec: number): AudioBuffer {
    const c = ctx as AudioContext;
    const sr = c.sampleRate, len = Math.floor(sr * sec), pre = Math.floor(sr * 0.012);
    const buf = c.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = pre; i < len; i++) {
        const t = (i - pre) / (len - pre);
        lp += (Math.random() * 2 - 1 - lp) * (0.62 - 0.5 * t);
        d[i] = lp * Math.pow(1 - t, 2.4);
      }
      for (let e = 0; e < 7; e++) {
        const idx = pre + Math.floor(sr * (0.008 + Math.random() * 0.07));
        if (idx < len) d[idx] += (0.2 + Math.random() * 0.4) * (Math.random() < 0.5 ? -1 : 1);
      }
    }
    return buf;
  }

  function out(node: AudioNode, o: OutOpts = {}) {
    const c = ctx as AudioContext;
    const { wet = 0.25, dry = 1, cat = 'sfx', pan = 0 } = o;
    let n: AudioNode = node;
    if (pan && c.createStereoPanner) {
      const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); n.connect(p); n = p;
    }
    const D = cat === 'music' ? musDry : sfxDry, Wt = cat === 'music' ? musWet : sfxWet;
    if (dry > 0) {
      if (dry === 1) n.connect(D);
      else { const g = c.createGain(); g.gain.value = dry; n.connect(g); g.connect(D); }
    }
    if (wet > 0) { const g = c.createGain(); g.gain.value = wet; n.connect(g); g.connect(Wt); }
  }

  // Karplus–Strong getokkelde snaar, exact gestemd via playbackRate
  function pluckBuf(freq: number): PluckEntry {
    const c = ctx as AudioContext;
    const key = Math.round(freq * 100);
    const hit = cache.get(key);
    if (hit) return hit;
    const sr = c.sampleRate, N = Math.max(4, Math.round(sr / freq));
    const t60 = clamp(3.4 - (freq - 110) / 650, 1.1, 3.4);
    const len = Math.floor(sr * Math.min(3.2, t60 * 0.95));
    const buf = c.createBuffer(1, len, sr), o = buf.getChannelData(0);
    const ring = new Float32Array(N);
    let lp = 0;
    for (let i = 0; i < N; i++) { lp += (Math.random() * 2 - 1 - lp) * 0.6; ring[i] = lp; }
    const p = Math.max(1, Math.round(N * 0.14)), tmp = ring.slice();
    for (let i = 0; i < N; i++) ring[i] = tmp[i] - 0.85 * tmp[(i - p + N) % N];
    let mean = 0;
    for (let i = 0; i < N; i++) mean += ring[i];
    mean /= N;
    for (let i = 0; i < N; i++) ring[i] -= mean;
    const rho = Math.pow(10, -3 / (t60 * (sr / N)));
    let idx = 0, peak = 0;
    for (let i = 0; i < len; i++) {
      const a = ring[idx], b = ring[idx + 1 === N ? 0 : idx + 1];
      o[i] = a; ring[idx] = (a + b) * 0.5 * rho;
      if (++idx === N) idx = 0;
      const v = a < 0 ? -a : a;
      if (v > peak) peak = v;
    }
    const gn = peak > 0 ? 0.8 / peak : 1, fs = Math.floor(len * 0.8);
    for (let i = 0; i < len; i++) { let v = o[i] * gn; if (i > fs) v *= 1 - (i - fs) / (len - fs); o[i] = v; }
    const e = { buf, rate: (freq * (N + 0.5)) / sr };
    cache.set(key, e);
    return e;
  }

  function pluck(freq: number, o: { vol?: number; wet?: number; dry?: number; when?: number; cat?: Cat; pan?: number; bend?: number } = {}) {
    if (!ctx) return;
    const { vol = 0.4, wet = 0.3, dry = 1, when = 0, cat = 'sfx', pan = 0, bend = 0 } = o;
    const e = pluckBuf(freq), t = ctx.currentTime + when;
    const src = ctx.createBufferSource(); src.buffer = e.buf;
    src.playbackRate.setValueAtTime(e.rate, t);
    if (bend) {
      src.playbackRate.setValueAtTime(e.rate, t + 0.1);
      src.playbackRate.linearRampToValueAtTime(e.rate * Math.pow(2, bend / 12), t + 0.24);
    }
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(g); out(g, { wet, dry, cat, pan });
    src.start(t);
  }

  function tone(freq: number, o: { type?: OscillatorType; vol?: number; when?: number; attack?: number; decay?: number; wet?: number; dry?: number; cat?: Cat; pan?: number; glide?: number } = {}) {
    if (!ctx) return;
    const { type = 'sine', vol = 0.2, when = 0, attack = 0.005, decay = 1, wet = 0.3, dry = 1, cat = 'sfx', pan = 0, glide = 0 } = o;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator(); osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (glide) osc.frequency.exponentialRampToValueAtTime(freq * glide, t + attack + decay);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    osc.connect(g); out(g, { wet, dry, cat, pan });
    osc.start(t); osc.stop(t + attack + decay + 0.05);
  }

  function noise(o: { when?: number; dur?: number; freq?: number; q?: number; vol?: number; type?: BiquadFilterType; wet?: number; dry?: number; cat?: Cat; attack?: number; pan?: number; sweep?: number } = {}) {
    if (!ctx || !noiseBuf) return;
    const { when = 0, dur = 0.08, freq = 1200, q = 1, vol = 0.1, type = 'bandpass', wet = 0.15, dry = 1, cat = 'sfx', attack = 0.004, pan = 0, sweep = 0 } = o;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(freq * sweep, t + attack + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
    src.connect(f); f.connect(g); out(g, { wet, dry, cat, pan });
    src.start(t, Math.random() * 1.4, attack + dur + 0.06);
  }

  function bowl(freq: number, o: { vol?: number; when?: number; dur?: number; wet?: number; cat?: Cat } = {}) {
    if (!ctx) return;
    const { vol = 0.3, when = 0, dur = 5, wet = 0.45, cat = 'sfx' } = o;
    const parts: [number, number, number][] = [[1, 1, 1], [2.72, 0.42, 0.7], [5.1, 0.2, 0.45], [8.3, 0.08, 0.3]];
    for (const [r, a, dm] of parts) {
      for (let k = 0; k < 2; k++) {
        tone(freq * r * (k ? 1.0035 : 1), { vol: vol * a * 0.5, when, attack: 0.006, decay: dur * dm, wet, cat, pan: k ? 0.25 : -0.25 });
      }
    }
    noise({ when, dur: 0.05, freq: freq * 4, q: 3, vol: vol * 0.25, wet, cat });
  }

  function wood(freq = 900, o: { vol?: number; when?: number; wet?: number; cat?: Cat } = {}) {
    if (!ctx) return;
    const { vol = 0.25, when = 0, wet = 0.18, cat = 'sfx' } = o;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.6, t); osc.frequency.exponentialRampToValueAtTime(freq, t + 0.015);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(g); out(g, { wet, cat }); osc.start(t); osc.stop(t + 0.16);
    tone(freq * 2.63, { type: 'triangle', vol: vol * 0.22, when, attack: 0.001, decay: 0.05, wet, cat });
    noise({ when, dur: 0.015, freq: 2800, q: 0.9, vol: vol * 0.5, wet, cat, attack: 0.001 });
  }

  function chime(freq: number, o: { vol?: number; when?: number; wet?: number; cat?: Cat; pan?: number; decay?: number } = {}) {
    const { vol = 0.08, when = 0, wet = 0.6, cat = 'sfx', pan = 0, decay = 2.4 } = o;
    tone(freq, { vol, when, attack: 0.002, decay, wet, cat, pan });
    tone(freq * 2.76, { vol: vol * 0.35, when, attack: 0.002, decay: decay * 0.5, wet, cat, pan });
    tone(freq * 5.4, { vol: vol * 0.12, when, attack: 0.002, decay: decay * 0.3, wet, cat, pan });
  }

  // bamboe-waterklop (shishi-odoshi)
  function knock(o: { when?: number; vol?: number; cat?: Cat } = {}) {
    if (!ctx || !noiseBuf) return;
    const { when = 0, vol = 0.2, cat = 'music' } = o;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(1, t + 0.001); env.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
    src.connect(env);
    for (const [f, q, a] of [[380, 16, 1], [940, 12, 0.6], [2150, 9, 0.3]] as const) {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const g = ctx.createGain(); g.gain.value = vol * a * 7;
      env.connect(bp); bp.connect(g); out(g, { wet: 0.65, cat });
    }
    src.start(t, Math.random(), 0.1);
    tone(190, { vol: vol * 0.55, when, attack: 0.002, decay: 0.12, wet: 0.5, cat, glide: 0.8 });
  }

  function brown(sec: number): AudioBuffer {
    const c = ctx as AudioContext;
    const sr = c.sampleRate, len = Math.floor(sr * sec), F = Math.floor(sr * 0.5);
    const raw = new Float32Array(len + F);
    let last = 0;
    for (let i = 0; i < raw.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; raw[i] = last * 3.5; }
    const b = c.createBuffer(1, len, sr), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = raw[i];
    for (let i = 0; i < F; i++) { const k = i / F; d[i] = raw[i] * k + raw[len + i] * (1 - k); }
    return b;
  }

  function startWind() {
    if (wind || !ctx) return;
    const src = ctx.createBufferSource(); src.buffer = brown(6); src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.4;
    const g = ctx.createGain();
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06;
    const lg = ctx.createGain(); lg.gain.value = 260; lfo.connect(lg); lg.connect(lp.frequency);
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.037;
    const lg2 = ctx.createGain(); lg2.gain.value = 0.014; lfo2.connect(lg2); lg2.connect(g.gain);
    src.connect(lp); lp.connect(g); out(g, { wet: 0.3, cat: 'music' });
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.026, t + 4);
    src.start(); lfo.start(); lfo2.start();
    wind = { src, g, lfo, lfo2 };
  }

  function phrase() {
    if (document.hidden || !ctx) return;
    ambIdx = clamp(ambIdx + pick([-2, -1, -1, 0, 1, 1, 2]), -2, 8);
    const count = Math.random() < 0.35 ? randi(2, 3) : 1;
    let idx = ambIdx, t = 0;
    for (let i = 0; i < count; i++) {
      pluck(note(idx), { vol: rand(0.07, 0.12), wet: 0.85, dry: 0.5, when: t, cat: 'music', pan: rand(-0.6, 0.6), bend: Math.random() < 0.18 ? 1 : 0 });
      t += rand(0.22, 0.5); idx += pick([-1, 1, 2, -2]);
    }
    if (Math.random() < 0.22) pluck(note(ambIdx - 5 - randi(0, 2)), { vol: 0.1, wet: 0.9, dry: 0.5, when: t + 0.3, cat: 'music' });
    const now = performance.now();
    if (now - lastKnock > 26000 && Math.random() < 0.3) { lastKnock = now; knock({ when: t + 1.2 }); }
  }

  function startAmbient() {
    if (!ctx || ambOn) return;
    ambOn = true; startWind();
    const loop = () => { if (!ambOn) return; phrase(); ambTimer = window.setTimeout(loop, rand(2600, 5400)); };
    ambTimer = window.setTimeout(loop, 1400);
  }

  function stopAmbient() {
    ambOn = false; window.clearTimeout(ambTimer);
    if (wind && ctx) {
      const w = wind; wind = null;
      const t = ctx.currentTime;
      w.g.gain.cancelScheduledValues(t); w.g.gain.setValueAtTime(Math.max(0.0001, w.g.gain.value), t); w.g.gain.linearRampToValueAtTime(0.0001, t + 1.2);
      window.setTimeout(() => { try { w.src.stop(); w.lfo.stop(); w.lfo2.stop(); } catch { /* al gestopt */ } }, 1500);
    }
  }

  const setBus = (a: GainNode, b: GainNode, v: boolean, tc: number) => {
    if (!ctx) return;
    const t = ctx.currentTime;
    a.gain.setTargetAtTime(v ? 1 : 0, t, tc); b.gain.setTargetAtTime(v ? 1 : 0, t, tc);
  };

  return {
    init,
    get sfx() { return sfxOn; },
    get music() { return musOn; },
    setSfx(v: boolean) { sfxOn = v; store.set('sfx', v); if (ctx) setBus(sfxDry, sfxWet, v, 0.04); },
    setMusic(v: boolean) {
      musOn = v; store.set('music', v);
      if (!ctx) return;
      setBus(musDry, musWet, v, 0.25);
      if (v) startAmbient(); else stopAmbient();
    },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    /** Een letter gegeten — de toonhoogte klimt mee met de positie in het woord. */
    letter(i: number) { const n = 2 + (i % 9); pluck(note(n), { vol: 0.48, wet: 0.3 }); chime(note(n + 10), { vol: 0.02, wet: 0.5, decay: 1.2 }); },
    word() {
      [0, 2, 4, 5, 7].forEach((d, k) => pluck(note(5 + d), { vol: 0.32, when: k * 0.06, wet: 0.35, pan: -0.4 + k * 0.2 }));
      chime(note(15), { vol: 0.05, when: 0.32 });
    },
    turn() { noise({ dur: 0.07, freq: rand(1300, 1900), q: 0.7, vol: 0.026, wet: 0.04, attack: 0.012 }); },
    bonusAppear() { for (let i = 0; i < 6; i++) chime(note(randi(10, 15)), { vol: rand(0.02, 0.04), when: i * rand(0.05, 0.11), pan: rand(-0.7, 0.7), decay: 2 }); },
    bonus() { [0, 2, 4, 5, 7].forEach((d, k) => pluck(note(7 + d), { vol: 0.3, when: k * 0.05, wet: 0.35, pan: -0.4 + k * 0.2 })); },
    bonusGone() { pluck(note(4), { vol: 0.14, wet: 0.5 }); pluck(note(2), { vol: 0.12, wet: 0.5, when: 0.16, bend: -1 }); },
    level() { bowl(note(0), { vol: 0.24, dur: 5 }); pluck(note(5), { vol: 0.26, when: 0.25 }); pluck(note(7), { vol: 0.24, when: 0.45 }); pluck(note(10), { vol: 0.22, when: 0.7 }); },
    stone(k: number) { noise({ when: k * 0.14, dur: 0.2, freq: 240, q: 0.6, type: 'lowpass', vol: 0.3, wet: 0.35 }); tone(82, { when: k * 0.14, vol: 0.2, attack: 0.005, decay: 0.28, glide: 0.7 }); },
    start() { wood(1180, { vol: 0.3, wet: 0.35 }); wood(1240, { vol: 0.34, wet: 0.35, when: 0.2 }); },
    die() {
      noise({ dur: 0.25, freq: 900, q: 0.5, type: 'lowpass', vol: 0.28, wet: 0.3, sweep: 0.3 });
      tone(70, { vol: 0.3, attack: 0.004, decay: 0.5, glide: 0.6, wet: 0.2 });
      bowl(note(-5), { vol: 0.28, dur: 7, when: 0.04, wet: 0.55 });
      [7, 5, 3, 2, 0].forEach((d, k) => pluck(note(d), { vol: 0.17, when: 0.5 + k * 0.26, wet: 0.5, bend: k === 4 ? -1 : 0 }));
    },
    shatter() {
      for (let i = 0; i < 5; i++) chime(note(randi(12, 16)), { vol: rand(0.012, 0.025), when: i * 0.07, decay: 0.8, pan: rand(-0.6, 0.6) });
      noise({ dur: 0.5, freq: 3200, q: 0.5, vol: 0.03, wet: 0.2, attack: 0.05 });
    },
    warn() { chime(note(12), { vol: 0.06, decay: 1.6 }); chime(note(10), { vol: 0.05, when: 0.28, decay: 1.6 }); },
    pause() { wood(760, { vol: 0.18 }); },
    click() { wood(980, { vol: 0.15, wet: 0.12 }); },
    select() { wood(1320, { vol: 0.12, wet: 0.14 }); },
    stamp() {
      tone(120, { vol: 0.36, attack: 0.002, decay: 0.18, glide: 0.6, wet: 0.2 });
      noise({ dur: 0.08, freq: 500, q: 0.8, type: 'lowpass', vol: 0.3 });
      [5, 7, 9, 10].forEach((d, k) => chime(note(d + 5), { vol: 0.04, when: 0.12 + k * 0.08 }));
    },
    win() { bowl(note(0), { vol: 0.28, dur: 7 }); [0, 2, 3, 5, 7, 8, 10].forEach((d, k) => pluck(note(d + 3), { vol: 0.28, when: 0.2 + k * 0.12 })); },
  };
}

export const Sound = createSound();
export type SoundApi = typeof Sound;
