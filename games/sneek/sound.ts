// Geluid — bewust minimaal voor gebruik in de klas.
//
// • Standaard UIT. De leerling (of leerkracht) kan het aanzetten; de host kan het
//   volledig verbieden (config.soundAllowed = false).
// • Geen muziek of sfeergeluid. Enkel drie korte, zachte signalen:
//     letter()  — een letter gegeten (toonhoogte klimt mee in het woord)
//     word()    — een woord is af
//     end()     — de ronde is voorbij
// • Geen AudioContext zolang geluid uit staat (geen batterij- of CPU-kost).
// • Alles wordt ter plekke gesynthetiseerd (zachte getokkelde snaar), geen bestanden.

import { clamp, store } from './util';

type ACtor = typeof AudioContext;
interface PluckEntry { buf: AudioBuffer; rate: number }

const STORE_KEY = 'geluid'; // nieuwe sleutel: oude "aan"-voorkeuren uit het prototype tellen niet mee

function createSound() {
  let ctx: AudioContext | null = null;
  let out: GainNode | null = null;
  let allowed = true;
  let on = store.get<boolean>(STORE_KEY, false);
  const cache = new Map<number, PluckEntry>();
  const SCALE = [0, 2, 4, 7, 9]; // majeur-pentatonisch: altijd zacht en consonant
  const ROOT = 262;
  const note = (i: number) => {
    const o = Math.floor(i / 5), d = ((i % 5) + 5) % 5;
    return ROOT * Math.pow(2, o + SCALE[d] / 12);
  };

  /** Maakt de AudioContext pas aan wanneer geluid aan staat (en vanuit een gebruikersactie). */
  function ensure(): boolean {
    if (!on || !allowed) return false;
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
    comp.threshold.value = -20; comp.ratio.value = 4;
    out = ctx.createGain();
    out.gain.value = 0.35; // bewust stil
    out.connect(comp); comp.connect(ctx.destination);
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return true;
  }

  // Karplus–Strong: een korte, zachte getokkelde snaar.
  function pluckBuf(freq: number): PluckEntry {
    const c = ctx as AudioContext;
    const key = Math.round(freq * 100);
    const hit = cache.get(key);
    if (hit) return hit;
    const sr = c.sampleRate, N = Math.max(4, Math.round(sr / freq));
    const len = Math.floor(sr * 0.7);
    const buf = c.createBuffer(1, len, sr), o = buf.getChannelData(0);
    const ring = new Float32Array(N);
    let lp = 0;
    for (let i = 0; i < N; i++) { lp += (Math.random() * 2 - 1 - lp) * 0.5; ring[i] = lp; }
    const rho = Math.pow(10, -3 / (0.9 * (sr / N)));
    let idx = 0, peak = 0;
    for (let i = 0; i < len; i++) {
      const a = ring[idx], b = ring[idx + 1 === N ? 0 : idx + 1];
      o[i] = a; ring[idx] = (a + b) * 0.5 * rho;
      if (++idx === N) idx = 0;
      const v = a < 0 ? -a : a;
      if (v > peak) peak = v;
    }
    const gn = peak > 0 ? 0.8 / peak : 1, fs = Math.floor(len * 0.6);
    for (let i = 0; i < len; i++) { let v = o[i] * gn; if (i > fs) v *= 1 - (i - fs) / (len - fs); o[i] = v; }
    const e = { buf, rate: (freq * (N + 0.5)) / sr };
    cache.set(key, e);
    return e;
  }

  function pluck(freq: number, vol: number, when = 0) {
    if (!ensure() || !ctx || !out) return;
    const e = pluckBuf(freq), t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = e.buf;
    src.playbackRate.setValueAtTime(e.rate, t);
    const g = ctx.createGain();
    g.gain.value = clamp(vol, 0, 0.3);
    src.connect(g); g.connect(out);
    src.start(t);
  }

  return {
    get on() { return on && allowed; },
    get allowed() { return allowed; },
    /** Host kan geluid volledig verbieden (bv. instelling van de leerkracht). */
    setAllowed(v: boolean) {
      allowed = v;
      if (!v) this.suspend();
    },
    /** Aan/uit door de gebruiker — roep aan vanuit een klik of toets. */
    setOn(v: boolean) {
      on = v;
      store.set(STORE_KEY, v);
      if (v) ensure(); else this.suspend();
    },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    resume() { if (on && allowed && ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    letter(i: number) { pluck(note(2 + (i % 6)), 0.16); },
    word() { pluck(note(7), 0.14); pluck(note(9), 0.13, 0.09); },
    end() { pluck(note(-1), 0.12); },
  };
}

export const Sound = createSound();
export type SoundApi = typeof Sound;
