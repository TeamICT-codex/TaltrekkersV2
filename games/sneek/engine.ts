// Spelmotor van Sneek — de woordentuin.
//
// Gebaseerd op "Ensō" (zandtuin, gelakte slang met kintsugi-aders), omgebouwd:
//   • voedsel = steentjes met een letter; de slang spelt letter voor letter een woord
//   • rondes eindigen via hooks, de UI-laag regelt bezoek/tijd/tokens
//   • spaarstand (eco) voor zwakke toestellen: geen schaduwblur, lagere DPR, lichtere effecten

import { Sound } from './sound';
import {
  TAU, clamp, ctx2d, easeOutBack, easeOutCubic, lerp, mixHex, mk, mulberry32, pick, rand, randi, rgba, shadeHex, smooth,
} from './util';
import { DEMO_WORDS, WordQueue, isCollectible, type WordEntry } from './words';
import type { GameMode } from './protocol';

// ─── Publieke types ─────────────────────────────────────────

export interface Dir { readonly x: number; readonly y: number }
export const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
} as const satisfies Record<string, Dir>;
export type DirName = keyof typeof DIRS;

export type EngineState = 'boot' | 'demo' | 'ready' | 'playing' | 'paused' | 'dying' | 'over';
export type EndReason = 'wall' | 'stone' | 'self' | 'full' | 'time' | 'stopped';

export interface WordSlot { ch: string; collectible: boolean; got: boolean }
export interface ActiveWord { entry: WordEntry; slots: WordSlot[]; next: number }

export interface RoundResult {
  score: number;
  letters: number;
  words: WordEntry[];
  length: number;
  timeMs: number;
  level: number;
  reason: EndReason;
}

export interface EngineHooks {
  nextWord(): WordEntry;
  onWordStart(w: ActiveWord): void;
  onLetter(w: ActiveWord, slot: number): void;
  onWordComplete(w: ActiveWord, points: number): void;
  onScore(score: number): void;
  onLevel(level: number): void;
  onRoundEnd(r: RoundResult): void;
  onStateChange(s: EngineState): void;
}

// ─── Interne types ──────────────────────────────────────────

interface Cell { x: number; y: number }
interface Stone { x: number; y: number; seed: number; size: number; tint: number; ring: number; moss: boolean; born: number }
interface Food { x: number; y: number; ch: string; born: number; tilt: number; landed: boolean }
interface Bonus { x: number; y: number; t0: number; life: number; born: number }
interface TrailPt { x: number; y: number; t: number; brk: boolean }
interface Bulge { d: number; a: number }
interface Sprite { c: HTMLCanvasElement; size: number }
interface Sample { x: number; y: number; tx: number; ty: number; d: number; r: number }
interface Ripple { x: number; y: number; r0: number; r1: number; dur: number; k: number; t0: number }

type Particle = {
  type: 'petal' | 'sand' | 'shard' | 'spark' | 'leaf' | 'text';
  x: number; y: number; vx: number; vy: number; g: number; drag: number; life: number; fade: number;
  rot?: number; vr?: number; size?: number; flip?: number; fs?: number; color?: string;
  pts?: [number, number][]; text?: string; gold?: boolean;
};

// ─── Omgeving & instellingen ────────────────────────────────

let hooks: EngineHooks;
let cvs: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let boardEl: HTMLElement | null = null;
let TOUCH = false;
let REDUCED = false;
let eco = false;
let accent = '#2d7a7b';
let gold = false;

const FONT_LETTER = "Poppins, 'Segoe UI', system-ui, -apple-system, sans-serif";
const FONT_DISPLAY = "'Cormorant Garamond', 'Iowan Old Style', Georgia, serif";

function vibrate(p: number | number[]) {
  if (TOUCH && Sound.on && navigator.vibrate) {
    try { navigator.vibrate(p); } catch { /* niet ondersteund */ }
  }
}

// ─── Geometrie & texturen ───────────────────────────────────

let COLS = 20, ROWS = 20;
let cell = 30, frameW = 18, W = 600, H = 600, DPR = 1;
let bgC!: HTMLCanvasElement, stoneC!: HTMLCanvasElement, lightC!: HTMLCanvasElement, shadeC!: HTMLCanvasElement;
let maskC!: HTMLCanvasElement, maskX!: CanvasRenderingContext2D, grooveC!: HTMLCanvasElement;
let pebbleS!: Sprite, ginkgoS!: Sprite;

const grainTile = (() => {
  const S = 256, c = mk(S, S), x = ctx2d(c), img = x.createImageData(S, S), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let v = 128 + (Math.random() - 0.5) * 36;
    const r = Math.random();
    if (r < 0.02) v -= 70 * Math.random(); else if (r < 0.045) v += 55 * Math.random();
    d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c;
})();

export const PETAL = new Path2D('M-0.2,-0.94 L0,-0.76 L0.2,-0.94 C0.62,-0.72 0.58,0.3 0,1 C-0.58,0.3 -0.62,-0.72 -0.2,-0.94 Z');
export const PETAL_COLORS = ['#f6c1ce', '#f9d6de', '#eea3b6', '#fbe4ea', '#f3b3c3'] as const;
const STONE_TINTS = [['#9d9e95', '#6b6d65', '#3f413c'], ['#a39a8c', '#716960', '#443e37'], ['#919c97', '#606c68', '#38403d']] as const;

const bx0 = () => frameW, by0 = () => frameW;
const cx = (gx: number) => frameW + (gx + 0.5) * cell;
const cy = (gy: number) => frameW + (gy + 0.5) * cell;

/** Kiest het raster (16×16 op kleine schermen, 20×20 anders) en schaalt het bord in de beschikbare ruimte. */
export function layoutBoard(avW: number, avH: number, allowGridChange: boolean): { W: number; H: number; gridChanged: boolean } {
  DPR = Math.min(eco ? 1 : 2, window.devicePixelRatio || 1);
  const size = Math.max(220, Math.floor(Math.min(avW, avH, 880)));
  let gridChanged = false;
  if (allowGridChange) {
    const n = size < 440 ? 16 : 20;
    gridChanged = n !== COLS;
    COLS = n; ROWS = n;
  }
  const c = Math.max(10, Math.floor(size / (COLS + 1.24)));
  cell = c;
  frameW = clamp(Math.round(c * 0.62), 8, 26);
  W = c * COLS + frameW * 2;
  H = c * ROWS + frameW * 2;
  cvs.width = Math.round(W * DPR);
  cvs.height = Math.round(H * DPR);
  cvs.style.width = W + 'px';
  cvs.style.height = H + 'px';
  buildTextures();
  return { W, H, gridChanged };
}

function buildTextures() {
  const w = W * DPR, h = H * DPR;
  bgC = mk(w, h); stoneC = mk(w, h); lightC = mk(w, h); shadeC = mk(w, h); maskC = mk(w, h); grooveC = mk(w, h);
  maskX = ctx2d(maskC);
  renderGroove(); renderBackground(); renderStones(); renderLight(); renderShade();
  pebbleS = makePebble(cell * 0.92);
  ginkgoS = makeGinkgo(cell * 1.04);
  HEAD_PATH = null;
}

function sandFill(x: CanvasRenderingContext2D, dark: number) {
  const bx = bx0(), by = by0(), bw = COLS * cell, bh = ROWS * cell;
  const g = x.createLinearGradient(bx, by, bx + bw, by + bh);
  g.addColorStop(0, shadeHex('#f0e8d6', dark)); g.addColorStop(0.55, shadeHex('#e7dec9', dark)); g.addColorStop(1, shadeHex('#dbd0b8', dark));
  x.fillStyle = g; x.fillRect(bx, by, bw, bh);
  x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalCompositeOperation = 'soft-light'; x.globalAlpha = 0.55;
  const pat = x.createPattern(grainTile, 'repeat');
  if (pat) { x.fillStyle = pat; x.fillRect(bx * DPR, by * DPR, bw * DPR, bh * DPR); }
  x.restore();
}

function rakeLines(x: CanvasRenderingContext2D) {
  const bx = bx0(), by = by0(), bw = COLS * cell, bh = ROWS * cell;
  const gap = Math.max(4.6, cell / 3.1), amp = cell * 0.05, lw = Math.max(0.9, cell * 0.042), stepX = Math.max(4, cell / 6);
  x.save(); x.beginPath(); x.rect(bx, by, bw, bh); x.clip();
  x.lineCap = 'round'; x.lineWidth = lw;
  for (let y = by + gap * 0.55; y < by + bh; y += gap) {
    for (let pass = 0; pass < 2; pass++) {
      const oy = pass ? -lw * 0.85 : lw * 0.85;
      x.beginPath();
      for (let px = bx - stepX; px <= bx + bw + stepX; px += stepX) {
        const yy = y + oy + Math.sin(px * 0.019 + y * 0.004) * amp + Math.sin(px * 0.047 + y * 0.011 + 1.7) * amp * 0.35;
        if (px === bx - stepX) x.moveTo(px, yy); else x.lineTo(px, yy);
      }
      x.strokeStyle = pass ? 'rgba(255,253,246,0.78)' : 'rgba(138,114,82,0.36)';
      x.stroke();
    }
  }
  x.restore();
}

function drawRings(x: CanvasRenderingContext2D, s: Stone) {
  const X = cx(s.x), Y = cy(s.y), R = cell * s.ring;
  x.save(); x.beginPath(); x.rect(bx0(), by0(), COLS * cell, ROWS * cell); x.clip();
  x.beginPath(); x.arc(X, Y, R + 0.5, 0, TAU); x.clip();
  sandFill(x, 0);
  const gap = Math.max(4.6, cell / 3.1), lw = Math.max(0.9, cell * 0.042);
  x.lineWidth = lw;
  for (let r = cell * 0.62 * s.size; r <= R + 0.01; r += gap) {
    x.strokeStyle = 'rgba(138,114,82,0.36)'; x.beginPath(); x.arc(X, Y + lw * 0.85, r, 0, TAU); x.stroke();
    x.strokeStyle = 'rgba(255,253,246,0.78)'; x.beginPath(); x.arc(X, Y - lw * 0.85, r, 0, TAU); x.stroke();
  }
  x.restore();
}

const rgbL = (r: number, g: number, b: number, L: number) => `rgb(${Math.round(r * L)},${Math.round(g * L)},${Math.round(b * L)})`;

function drawFrame(x: CanvasRenderingContext2D) {
  const F = frameW, w = W, h = H, rng = mulberry32(4242);
  const sides = [
    { poly: [[0, 0], [w, 0], [w - F, F], [F, F]], hz: true, a: 0, b: F, lum: 1 },
    { poly: [[F, h - F], [w - F, h - F], [w, h], [0, h]], hz: true, a: h - F, b: h, lum: 0.78 },
    { poly: [[0, 0], [F, F], [F, h - F], [0, h]], hz: false, a: 0, b: F, lum: 0.92 },
    { poly: [[w - F, F], [w, 0], [w, h], [w - F, h - F]], hz: false, a: w - F, b: w, lum: 0.72 },
  ];
  for (const sd of sides) {
    const p = new Path2D();
    p.moveTo(sd.poly[0][0], sd.poly[0][1]);
    for (let i = 1; i < 4; i++) p.lineTo(sd.poly[i][0], sd.poly[i][1]);
    p.closePath();
    x.save(); x.clip(p);
    const g = sd.hz ? x.createLinearGradient(0, sd.a, 0, sd.b) : x.createLinearGradient(sd.a, 0, sd.b, 0);
    const L = sd.lum, outerFirst = sd.a === 0;
    const c0 = rgbL(92, 74, 58, L), c1 = rgbL(64, 50, 40, L), c2 = rgbL(42, 32, 25, L);
    g.addColorStop(0, outerFirst ? c0 : c2); g.addColorStop(0.5, c1); g.addColorStop(1, outerFirst ? c2 : c0);
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    const len = sd.hz ? w : h, n = Math.max(7, Math.round(F / 1.5));
    for (let i = 0; i < n; i++) {
      const off = sd.a + (i + rng()) * (F / n), ph = rng() * TAU, amp = rng() * 1.3 + 0.2, fq = 0.004 + rng() * 0.012;
      x.beginPath();
      for (let t = -10; t <= len + 10; t += 8) {
        const o = off + Math.sin(t * fq + ph) * amp + Math.sin(t * fq * 3.7 + ph) * amp * 0.3;
        if (sd.hz) { if (t === -10) x.moveTo(t, o); else x.lineTo(t, o); } else { if (t === -10) x.moveTo(o, t); else x.lineTo(o, t); }
      }
      x.strokeStyle = rng() < 0.55 ? `rgba(16,10,6,${0.18 + rng() * 0.26})` : `rgba(160,128,96,${0.06 + rng() * 0.1})`;
      x.lineWidth = 0.5 + rng() * 1.1; x.stroke();
    }
    for (let k = 0; k < 2; k++) {
      const t = len * (0.2 + rng() * 0.6), o = sd.a + F * (0.35 + rng() * 0.3);
      const kx = sd.hz ? t : o, ky = sd.hz ? o : t;
      x.strokeStyle = 'rgba(14,9,5,0.35)'; x.lineWidth = 0.8;
      for (let r = 1; r < 4; r++) { x.beginPath(); x.ellipse(kx, ky, sd.hz ? r * 2.6 : r * 1.1, sd.hz ? r * 1.1 : r * 2.6, 0, 0, TAU); x.stroke(); }
    }
    x.restore();
  }
  x.strokeStyle = 'rgba(8,5,3,0.55)'; x.lineWidth = 1;
  x.beginPath(); x.moveTo(0, 0); x.lineTo(F, F); x.moveTo(w, 0); x.lineTo(w - F, F); x.moveTo(0, h); x.lineTo(F, h - F); x.moveTo(w, h); x.lineTo(w - F, h - F); x.stroke();
  x.strokeStyle = 'rgba(255,236,210,0.2)'; x.lineWidth = 1; x.strokeRect(0.5, 0.5, w - 1, h - 1);
  x.strokeStyle = 'rgba(255,236,210,0.13)'; x.strokeRect(F - 2.5, F - 2.5, w - 2 * F + 5, h - 2 * F + 5);
  x.strokeStyle = 'rgba(8,5,3,0.65)'; x.lineWidth = 1.5; x.strokeRect(F - 0.75, F - 0.75, w - 2 * F + 1.5, h - 2 * F + 1.5);
}

function renderBackground() {
  if (!bgC) return;
  const x = ctx2d(bgC);
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, bgC.width, bgC.height);
  x.setTransform(DPR, 0, 0, DPR, 0, 0);
  sandFill(x, 0);
  rakeLines(x);
  for (const s of G.stones) drawRings(x, s);
  drawFrame(x);
}

function renderGroove() {
  const x = ctx2d(grooveC);
  x.setTransform(DPR, 0, 0, DPR, 0, 0);
  sandFill(x, 0.045);
}

function stonePath(s: Stone) {
  const rng = mulberry32(s.seed), X = cx(s.x), Y = cy(s.y), base = cell * 0.47 * s.size;
  const n = 10, rot = rng() * TAU, pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU, rr = base * (0.84 + rng() * 0.24);
    pts.push([X + Math.cos(a) * rr * 1.06, Y + Math.sin(a) * rr * 0.93]);
  }
  const p = new Path2D(), mid = (a: [number, number], b: [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  p.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) { const p1 = pts[i], m = mid(p1, pts[(i + 1) % n]); p.quadraticCurveTo(p1[0], p1[1], m[0], m[1]); }
  p.closePath();
  return { p, rng, X, Y, base };
}

function drawStone(x: CanvasRenderingContext2D, s: Stone) {
  const { p, rng, X, Y, base } = stonePath(s), c = cell, tint = STONE_TINTS[s.tint];
  if (s.moss) {
    x.save();
    const mg = x.createRadialGradient(X, Y + base * 0.1, base * 0.6, X, Y + base * 0.1, base * 1.28);
    mg.addColorStop(0, 'rgba(96,112,58,0.9)'); mg.addColorStop(0.7, 'rgba(118,134,72,0.55)'); mg.addColorStop(1, 'rgba(118,134,72,0)');
    x.fillStyle = mg; x.beginPath(); x.ellipse(X, Y + base * 0.1, base * 1.28, base * 1.12, 0, 0, TAU); x.fill();
    for (let i = 0; i < 26; i++) {
      const a = rng() * TAU, rr = base * (0.9 + rng() * 0.35);
      x.fillStyle = rng() < 0.5 ? 'rgba(150,166,96,0.55)' : 'rgba(70,86,44,0.45)';
      x.beginPath(); x.arc(X + Math.cos(a) * rr, Y + base * 0.1 + Math.sin(a) * rr * 0.88, c * (0.012 + rng() * 0.02), 0, TAU); x.fill();
    }
    x.restore();
  }
  x.save();
  x.shadowColor = 'rgba(46,32,18,0.5)'; x.shadowBlur = c * 0.32 * DPR; x.shadowOffsetX = c * 0.11 * DPR; x.shadowOffsetY = c * 0.17 * DPR;
  x.fillStyle = tint[2]; x.fill(p);
  x.restore();
  const g = x.createRadialGradient(X - base * 0.38, Y - base * 0.45, base * 0.08, X, Y, base * 1.25);
  g.addColorStop(0, tint[0]); g.addColorStop(0.55, tint[1]); g.addColorStop(1, tint[2]);
  x.fillStyle = g; x.fill(p);
  x.save(); x.clip(p);
  for (let i = 0; i < 30; i++) {
    const a = rng() * TAU, rr = rng() * base;
    x.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.14)';
    x.beginPath(); x.arc(X + Math.cos(a) * rr, Y + Math.sin(a) * rr, c * (0.01 + rng() * 0.025), 0, TAU); x.fill();
  }
  const mossN = 1 + Math.floor(rng() * 4);
  for (let i = 0; i < mossN; i++) {
    const a = -2.3 + rng() * 1.6, rr = base * (0.2 + rng() * 0.55), mx = X + Math.cos(a) * rr, my = Y + Math.sin(a) * rr, mr = base * (0.18 + rng() * 0.24);
    const mg = x.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, 0, mx, my, mr);
    mg.addColorStop(0, 'rgba(164,176,104,0.95)'); mg.addColorStop(0.6, 'rgba(114,130,70,0.8)'); mg.addColorStop(1, 'rgba(92,106,56,0)');
    x.fillStyle = mg; x.beginPath(); x.arc(mx, my, mr, 0, TAU); x.fill();
  }
  x.strokeStyle = 'rgba(255,255,255,0.2)'; x.lineWidth = c * 0.05; x.translate(c * 0.022, c * 0.03); x.stroke(p);
  x.restore();
}

const STONE_RISE = 700;
function renderStones() {
  if (!stoneC) return;
  const x = ctx2d(stoneC);
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, stoneC.width, stoneC.height);
  x.setTransform(DPR, 0, 0, DPR, 0, 0);
  x.save(); x.beginPath(); x.rect(bx0(), by0(), COLS * cell, ROWS * cell); x.clip();
  for (const s of G.stones) if (clock - s.born >= STONE_RISE) drawStone(x, s);
  x.restore();
}

function renderLight() {
  const x = ctx2d(lightC);
  x.setTransform(DPR, 0, 0, DPR, 0, 0);
  const bx = bx0(), by = by0(), bw = COLS * cell, bh = ROWS * cell;
  x.save(); x.beginPath(); x.rect(bx, by, bw, bh); x.clip();
  let g = x.createRadialGradient(bx + bw * 0.28, by + bh * 0.22, 0, bx + bw * 0.28, by + bh * 0.22, bw * 0.98);
  g.addColorStop(0, 'rgba(255,246,222,0.16)'); g.addColorStop(0.45, 'rgba(255,246,222,0)'); g.addColorStop(1, 'rgba(70,48,28,0.17)');
  x.fillStyle = g; x.fillRect(bx, by, bw, bh);
  const sd = cell * 0.6;
  g = x.createLinearGradient(0, by, 0, by + sd); g.addColorStop(0, 'rgba(56,38,22,0.34)'); g.addColorStop(1, 'rgba(56,38,22,0)'); x.fillStyle = g; x.fillRect(bx, by, bw, sd);
  g = x.createLinearGradient(bx, 0, bx + sd * 0.8, 0); g.addColorStop(0, 'rgba(56,38,22,0.27)'); g.addColorStop(1, 'rgba(56,38,22,0)'); x.fillStyle = g; x.fillRect(bx, by, sd * 0.8, bh);
  g = x.createLinearGradient(0, by + bh, 0, by + bh - sd * 0.35); g.addColorStop(0, 'rgba(56,38,22,0.14)'); g.addColorStop(1, 'rgba(56,38,22,0)'); x.fillStyle = g; x.fillRect(bx, by + bh - sd * 0.35, bw, sd * 0.35);
  g = x.createLinearGradient(bx + bw, 0, bx + bw - sd * 0.35, 0); g.addColorStop(0, 'rgba(56,38,22,0.12)'); g.addColorStop(1, 'rgba(56,38,22,0)'); x.fillStyle = g; x.fillRect(bx + bw - sd * 0.35, by, sd * 0.35, bh);
  x.restore();
}

function mapleLeaf(x: CanvasRenderingContext2D, px: number, py: number, size: number, rot: number) {
  x.save(); x.translate(px, py); x.rotate(rot); x.beginPath();
  const span = Math.PI * 1.5, start = -Math.PI / 2 - span / 2;
  for (let i = 0; i <= 12; i++) {
    const a = start + span * (i / 12), tip = i % 2 === 0, k = Math.abs(i - 6) / 6;
    const r = tip ? size * (1 - 0.38 * k) : size * 0.34;
    if (i === 0) x.moveTo(Math.cos(a) * r, Math.sin(a) * r); else x.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  x.lineTo(0, size * 0.16); x.closePath(); x.fill();
  x.lineWidth = size * 0.07; x.beginPath(); x.moveTo(0, size * 0.1); x.lineTo(0, size * 0.62); x.stroke();
  x.restore();
}

function renderShade() {
  const x = ctx2d(shadeC);
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, shadeC.width, shadeC.height);
  x.setTransform(DPR, 0, 0, DPR, 0, 0);
  const rng = mulberry32(99), off = 6000;
  x.save(); x.translate(-off, 0);
  x.shadowColor = 'rgba(28,34,50,1)'; x.shadowBlur = cell * 0.3 * DPR; x.shadowOffsetX = off * DPR; x.shadowOffsetY = 0;
  x.fillStyle = '#000'; x.strokeStyle = '#000'; x.lineCap = 'round';
  const w = W, h = H;
  const branches: [number, number][][] = [
    [[w + 30, -20], [w * 0.84, h * 0.07], [w * 0.68, h * 0.1], [w * 0.47, h * 0.06]],
    [[w * 0.8, h * 0.075], [w * 0.8, h * 0.2], [w * 0.74, h * 0.28], [w * 0.63, h * 0.33]],
    [[w + 20, h * 0.16], [w * 0.92, h * 0.27], [w * 0.9, h * 0.4], [w * 0.82, h * 0.47]],
    [[w * 0.62, h * 0.09], [w * 0.57, h * 0.16], [w * 0.52, h * 0.19], [w * 0.44, h * 0.2]],
  ];
  const bez = (b: [number, number][], t: number): [number, number] => {
    const u = 1 - t;
    return [
      u * u * u * b[0][0] + 3 * u * u * t * b[1][0] + 3 * u * t * t * b[2][0] + t * t * t * b[3][0],
      u * u * u * b[0][1] + 3 * u * u * t * b[1][1] + 3 * u * t * t * b[2][1] + t * t * t * b[3][1],
    ];
  };
  branches.forEach((b, bi) => {
    for (let s = 0; s < 6; s++) {
      const t0 = s / 6, t1 = (s + 1) / 6, p0 = bez(b, t0), p1 = bez(b, t1);
      x.lineWidth = cell * (bi === 0 ? 0.28 : 0.16) * (1 - t0 * 0.7);
      x.beginPath(); x.moveTo(p0[0], p0[1]); x.lineTo(p1[0], p1[1]); x.stroke();
    }
    for (let t = 0.2; t <= 1.001; t += 0.085) {
      const p = bez(b, t);
      for (let k = 0; k < 2; k++) mapleLeaf(x, p[0] + (rng() - 0.5) * cell * 1.3, p[1] + (rng() - 0.3) * cell * 1.2, cell * (0.5 + rng() * 0.45), rng() * TAU);
    }
  });
  x.restore();
}

/** Een lichte rivierkei — hier komt de letter op. */
function makePebble(size: number): Sprite {
  const S = Math.ceil(size * DPR * 1.2), c = mk(S, S), x = ctx2d(c);
  x.translate(S / 2, S / 2); x.scale(DPR, DPR);
  const R = size * 0.5, rng = mulberry32(777);
  const p = new Path2D();
  const n = 12, pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, rr = R * (0.95 + rng() * 0.06);
    pts.push([Math.cos(a) * rr * 1.04, Math.sin(a) * rr * 0.94]);
  }
  const mid = (a: [number, number], b: [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  p.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) { const p1 = pts[i], m = mid(p1, pts[(i + 1) % n]); p.quadraticCurveTo(p1[0], p1[1], m[0], m[1]); }
  p.closePath();
  const g = x.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.05, 0, 0, R * 1.15);
  g.addColorStop(0, '#fffdf7'); g.addColorStop(0.5, '#f1ead9'); g.addColorStop(1, '#d3c6a8');
  x.fillStyle = g; x.fill(p);
  x.save(); x.clip(p);
  for (let i = 0; i < 26; i++) {
    const a = rng() * TAU, rr = rng() * R;
    x.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(120,100,70,0.12)';
    x.beginPath(); x.arc(Math.cos(a) * rr, Math.sin(a) * rr, size * (0.008 + rng() * 0.018), 0, TAU); x.fill();
  }
  x.restore();
  x.lineWidth = Math.max(0.8, size * 0.03); x.strokeStyle = 'rgba(120,98,66,0.45)'; x.stroke(p);
  return { c, size: S / DPR };
}

function makeGinkgo(size: number): Sprite {
  const S = Math.ceil(size * DPR * 1.3), c = mk(S, S), x = ctx2d(c);
  x.translate(S / 2, S / 2); x.scale(DPR, DPR);
  const R = size * 0.5, by = R * 0.36;
  x.strokeStyle = '#a97c26'; x.lineWidth = Math.max(1, size * 0.05); x.lineCap = 'round';
  x.beginPath(); x.moveTo(0, by); x.quadraticCurveTo(R * 0.05, R * 0.7, R * 0.2, R * 0.98); x.stroke();
  const a0 = -Math.PI / 2 - 1.12, a1 = -Math.PI / 2 + 1.12, p = new Path2D();
  p.moveTo(0, by);
  for (let i = 0; i <= 48; i++) {
    const u = i / 48, a = a0 + (a1 - a0) * u;
    const notch = 1 - 0.22 * Math.exp(-Math.pow((u - 0.5) / 0.04, 2));
    const rr = R * 1.05 * notch * (1 + 0.022 * Math.sin(u * 40)) * (0.93 + 0.07 * Math.sin(u * Math.PI));
    p.lineTo(Math.cos(a) * rr, by + Math.sin(a) * rr);
  }
  p.closePath();
  const g = x.createRadialGradient(0, by, 0, 0, by, R * 1.08);
  g.addColorStop(0, '#c98f1f'); g.addColorStop(0.4, '#e8b93f'); g.addColorStop(0.85, '#f6d874'); g.addColorStop(1, '#e0ac38');
  x.fillStyle = g; x.fill(p);
  x.save(); x.clip(p);
  x.strokeStyle = 'rgba(160,110,20,0.3)'; x.lineWidth = Math.max(0.5, size * 0.012);
  for (let i = 0; i <= 18; i++) { const a = a0 + (a1 - a0) * (i / 18); x.beginPath(); x.moveTo(0, by); x.lineTo(Math.cos(a) * R * 1.2, by + Math.sin(a) * R * 1.2); x.stroke(); }
  x.restore();
  x.strokeStyle = 'rgba(166,116,28,0.7)'; x.lineWidth = Math.max(0.6, size * 0.018); x.stroke(p);
  return { c, size: S / DPR };
}

// ─── Spelstatus ─────────────────────────────────────────────

const G = {
  state: 'boot' as EngineState,
  mode: 'rustig' as GameMode,
  demo: true,
  wrap: true,
  snake: [] as Cell[],
  prev: [] as Cell[],
  grew: false,
  moving: false,
  dir: DIRS.right as Dir,
  queue: [] as Dir[],
  stepMs: 150,
  acc: 0,
  time: 0,
  food: null as Food | null,
  bonus: null as Bonus | null,
  nextBonus: 5,
  stones: [] as Stone[],
  score: 0,
  eaten: 0,
  level: 1,
  reason: 'self' as EndReason,
  trail: [] as TrailPt[],
  bulges: [] as Bulge[],
  glow: 0,
  dieT: 0,
  shatterOn: false,
  shattered: 0,
  shatterDur: 0.8,
  hideSnake: false,
  bodyLen: 3,
  tongueT: 0,
  tongueNext: 2,
  blinkT: 0,
  blinkNext: 3,
  stoneDirty: false,
  word: null as ActiveWord | null,
  wordsDone: [] as WordEntry[],
  pendingWordAt: 0,
};

let clock = 0; // bord-animatieklok (ms), bevroren tijdens pauze
const particles: Particle[] = [];
const ripples: Ripple[] = [];
const TRAIL_HOLD = 1500, TRAIL_FADE = 7000, TRAIL_LIFE = TRAIL_HOLD + TRAIL_FADE;
const SHATTER_AT = 0.24, TONGUE_DUR = 0.34, BLINK_DUR = 0.16;
const demoQueue = new WordQueue(DEMO_WORDS);

function setState(s: EngineState) {
  if (G.state === s) return;
  G.state = s;
  hooks.onStateChange(s);
}

function stoneAt(x: number, y: number) { for (const s of G.stones) if (s.x === x && s.y === y) return true; return false; }

function occupiedSet() {
  const s = new Set<number>();
  for (const p of G.snake) s.add(p.y * COLS + p.x);
  for (const st of G.stones) s.add(st.y * COLS + st.x);
  if (G.food) s.add(G.food.y * COLS + G.food.x);
  if (G.bonus) s.add(G.bonus.y * COLS + G.bonus.x);
  return s;
}

function freeCell(minD: number): Cell | null {
  const occ = occupiedSet(), head = G.snake[0], all: Cell[] = [], far: Cell[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (occ.has(y * COLS + x)) continue;
      all.push({ x, y });
      let dx = Math.abs(x - head.x), dy = Math.abs(y - head.y);
      if (G.wrap) { dx = Math.min(dx, COLS - dx); dy = Math.min(dy, ROWS - dy); }
      if (dx + dy >= minD) far.push({ x, y });
    }
  }
  const arr = far.length ? far : all;
  return arr.length ? arr[(Math.random() * arr.length) | 0] : null;
}

function neighbor(x: number, y: number, d: Dir): number {
  let nx = x + d.x, ny = y + d.y;
  if (G.wrap) { nx = (nx + COLS) % COLS; ny = (ny + ROWS) % ROWS; }
  else if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return -1;
  return ny * COLS + nx;
}

const NB4: Dir[] = [DIRS.up, DIRS.down, DIRS.left, DIRS.right];

function floodCount(start: number, blocked: Uint8Array, limit: number): number {
  const seen = new Uint8Array(COLS * ROWS), q = [start];
  seen[start] = 1;
  let n = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi];
    n++;
    if (limit && n >= limit) return n;
    const x = c % COLS, y = (c / COLS) | 0;
    for (const d of NB4) {
      const k = neighbor(x, y, d);
      if (k < 0 || seen[k] || blocked[k]) continue;
      seen[k] = 1; q.push(k);
    }
  }
  return n;
}

function connectedBoard() {
  const blocked = new Uint8Array(COLS * ROWS);
  for (const s of G.stones) blocked[s.y * COLS + s.x] = 1;
  const h = G.snake[0];
  return floodCount(h.y * COLS + h.x, blocked, 0) === COLS * ROWS - G.stones.length;
}

function makeStone(x: number, y: number, instant: boolean): Stone {
  const seed = (Math.random() * 2147483647) | 0, r = mulberry32(seed ^ 0x5bd1e995);
  return { x, y, seed, size: 0.84 + r() * 0.18, tint: (r() * 3) | 0, ring: 1.36 + r() * 0.28, moss: r() < 0.45, born: instant ? -1e9 : clock };
}

function addStones(n: number, instant: boolean): Stone[] {
  const head = G.snake[0], dir = G.dir, added: Stone[] = [];
  for (let k = 0; k < n; k++) {
    for (let attempt = 0; attempt < 400; attempt++) {
      const minSep = attempt < 260 ? 3.3 : 2.2;
      const x = randi(1, COLS - 2), y = randi(1, ROWS - 2);
      if (occupiedSet().has(y * COLS + x)) continue;
      if (Math.max(Math.abs(x - head.x), Math.abs(y - head.y)) < 4) continue;
      let lane = false;
      for (let s = 1; s <= 7; s++) {
        let lx = head.x + dir.x * s, ly = head.y + dir.y * s;
        if (G.wrap) { lx = (lx + COLS) % COLS; ly = (ly + ROWS) % ROWS; }
        if (lx === x && ly === y) { lane = true; break; }
      }
      if (lane) continue;
      if (G.food && Math.abs(G.food.x - x) <= 1 && Math.abs(G.food.y - y) <= 1) continue;
      if (G.bonus && Math.abs(G.bonus.x - x) <= 1 && Math.abs(G.bonus.y - y) <= 1) continue;
      if (G.stones.some(s => Math.hypot(s.x - x, s.y - y) < minSep)) continue;
      const st = makeStone(x, y, instant);
      G.stones.push(st);
      if (!connectedBoard()) { G.stones.pop(); continue; }
      added.push(st);
      break;
    }
  }
  return added;
}

/** Tempo: rustig blijft rustig; uitdaging versnelt, maar nooit tot arcade-snelheid. */
function stepFor(): number {
  const e = G.eaten;
  if (G.mode === 'rustig') return Math.max(98, 152 - e * 1.0);
  return Math.max(74, 138 - e * 1.7);
}

function maxStones() { return COLS <= 16 ? 11 : 16; }

function newGame(mode: GameMode, demo: boolean) {
  G.mode = mode;
  G.demo = demo;
  G.wrap = demo || mode === 'rustig';
  const sx = COLS <= 16 ? 5 : 6, sy = Math.floor(ROWS / 2);
  G.snake = [];
  for (let i = 0; i < 4; i++) G.snake.push({ x: sx - i, y: sy });
  G.prev = G.snake.map(p => ({ x: p.x, y: p.y }));
  G.grew = false; G.moving = false; G.dir = DIRS.right; G.queue = [];
  G.acc = 0; G.time = 0; G.score = 0; G.eaten = 0; G.level = 1; G.reason = 'self';
  G.trail = []; G.bulges = []; G.glow = 0; G.dieT = 0; G.shatterOn = false; G.shattered = 0; G.hideSnake = false;
  G.stones = []; G.food = null; G.bonus = null; G.nextBonus = randi(5, 7); G.stoneDirty = false;
  G.word = null; G.wordsDone = []; G.pendingWordAt = 0;
  particles.length = 0; ripples.length = 0;
  if (demo || mode === 'uitdaging') addStones(3, true);
  renderBackground(); renderStones();
  G.stepMs = demo ? 124 : stepFor();
  startNextWord();
  setState(demo ? 'demo' : 'ready');
  if (!demo) hooks.onScore(0);
}

function makeActive(entry: WordEntry): ActiveWord {
  const slots = Array.from(entry.word).map(ch => ({ ch, collectible: isCollectible(ch), got: false }));
  return { entry, slots, next: slots.findIndex(s => s.collectible) };
}

function startNextWord() {
  G.pendingWordAt = 0;
  const entry = G.demo ? demoQueue.next() : hooks.nextWord();
  G.word = makeActive(entry);
  if (!G.demo) hooks.onWordStart(G.word);
  if (!spawnFood()) winRound();
}

function spawnFood(): boolean {
  const w = G.word;
  if (!w || w.next < 0) { G.food = null; return true; }
  const c = freeCell(3);
  if (!c) { G.food = null; return false; }
  G.food = { x: c.x, y: c.y, ch: w.slots[w.next].ch, born: clock, tilt: rand(-0.07, 0.07), landed: false };
  return true;
}

function spawnBonus() {
  const c = freeCell(4);
  if (!c) return;
  G.bonus = { x: c.x, y: c.y, t0: G.time, life: 7200, born: clock };
  ripple(cx(c.x), cy(c.y), cell * 0.3, cell * 1.6, 1100, 0.7);
}

function expireBonus() {
  const b = G.bonus;
  if (!b) return;
  addP({ type: 'leaf', x: cx(b.x), y: cy(b.y), vx: rand(-14, 14), vy: rand(6, 16), g: 0, drag: 0.6, life: 1.4, fade: 1.2, rot: 0, vr: rand(-2.5, 2.5), size: 0.8 });
  G.bonus = null; G.nextBonus = randi(4, 7);
}

function addTrail(v: Cell) {
  const T = G.trail, last = T[T.length - 1];
  const brk = !!last && Math.abs(last.x - v.x) + Math.abs(last.y - v.y) !== 1;
  T.push({ x: v.x, y: v.y, t: clock, brk });
  if (T.length > 400) T.shift();
}

function step() {
  const before = G.dir;
  if (G.queue.length) G.dir = G.queue.shift() as Dir;
  const turned = G.dir.x !== before.x || G.dir.y !== before.y;
  const head = G.snake[0];
  let nx = head.x + G.dir.x, ny = head.y + G.dir.y;
  if (G.wrap) { nx = (nx + COLS) % COLS; ny = (ny + ROWS) % ROWS; }
  else if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) { die('wall'); return; }
  if (stoneAt(nx, ny)) { die('stone'); return; }
  const eatF = !!G.food && G.food.x === nx && G.food.y === ny;
  const eatB = !!G.bonus && G.bonus.x === nx && G.bonus.y === ny;
  const grow = eatF || eatB;
  const lim = grow ? G.snake.length : G.snake.length - 1;
  for (let i = 0; i < lim; i++) if (G.snake[i].x === nx && G.snake[i].y === ny) { die('self'); return; }
  G.prev = G.snake.map(p => ({ x: p.x, y: p.y }));
  G.snake.unshift({ x: nx, y: ny });
  if (!grow) addTrail(G.snake.pop() as Cell);
  G.grew = grow; G.moving = true;
  if (turned) spraySand(cx(head.x), cy(head.y), before);
  if (eatF) eatFood(nx, ny);
  if (eatB) eatBonus(nx, ny);
  if (G.food && G.tongueT <= 0) {
    const dx = G.food.x - nx, dy = G.food.y - ny;
    if (Math.abs(dx) + Math.abs(dy) <= 3 && dx * G.dir.x + dy * G.dir.y > 0 && Math.random() < 0.5) G.tongueT = TONGUE_DUR;
  }
}

function eatFood(x: number, y: number) {
  const w = G.word;
  if (!w || w.next < 0) return;
  const X = cx(x), Y = cy(y);
  const slot = w.next;
  w.slots[slot].got = true;
  G.eaten++;
  const letterIndex = w.slots.slice(0, slot + 1).filter(s => s.collectible).length - 1;
  const pts = 10 * G.level;
  G.score += pts;
  if (!G.demo) {
    Sound.letter(letterIndex);
    floatText(X, Y - cell * 0.45, '+' + pts, false);
    hooks.onLetter(w, slot);
  }
  burstPetals(X, Y, REDUCED || eco ? 4 : 9);
  ripple(X, Y, cell * 0.35, cell * 2.1, 1300, 1);
  G.bulges.push({ d: 0.3, a: 0.3 }); G.glow = 1; G.tongueT = 0;
  if (!G.demo) G.stepMs = stepFor();
  w.next = w.slots.findIndex((s, i) => i > slot && s.collectible && !s.got);
  G.food = null;
  if (w.next >= 0) {
    if (!spawnFood()) { winRound(); return; }
  } else {
    completeWord(X, Y);
  }
  if (!G.bonus && --G.nextBonus <= 0) spawnBonus();
  if (!G.demo) hooks.onScore(G.score);
}

function completeWord(X: number, Y: number) {
  const w = G.word;
  if (!w) return;
  const n = w.slots.filter(s => s.collectible).length;
  const pts = Math.round(((20 + 5 * n) * (1 + (G.level - 1) * 0.25)) / 5) * 5;
  G.score += pts;
  G.wordsDone.push(w.entry);
  G.pendingWordAt = G.time + (G.demo ? 700 : 1100);
  G.glow = 1.6;
  goldBurst(X, Y);
  ripple(X, Y, cell * 0.4, cell * 3, 1600, 1.15);
  if (!G.demo) {
    Sound.word();
    vibrate(12);
    floatText(X, Y - cell * 1.1, '+' + pts, true);
    hooks.onWordComplete(w, pts);
    const lvl = 1 + Math.floor(G.wordsDone.length / 2);
    if (lvl > G.level) { G.level = lvl; onLevelUp(); }
  }
}

function eatBonus(x: number, y: number) {
  const b = G.bonus;
  if (!b) return;
  const X = cx(x), Y = cy(y), frac = clamp(1 - (G.time - b.t0) / b.life, 0, 1);
  const pts = Math.round(((25 + 45 * frac) * (1 + (G.level - 1) * 0.25)) / 5) * 5;
  G.score += pts; G.bonus = null; G.nextBonus = randi(5, 8);
  if (!G.demo) { floatText(X, Y - cell * 0.45, '+' + pts, true); hooks.onScore(G.score); }
  goldBurst(X, Y); ripple(X, Y, cell * 0.4, cell * 2.6, 1500, 1.1);
  G.bulges.push({ d: 0.3, a: 0.36 }); G.glow = 1.5;
}

function onLevelUp() {
  hooks.onLevel(G.level);
  if (G.mode === 'uitdaging' && G.stones.length < maxStones()) {
    const added = addStones(G.level <= 4 ? 2 : 1, false);
    if (added.length) {
      renderBackground(); G.stoneDirty = true;
      added.forEach(s => { const X = cx(s.x), Y = cy(s.y); ripple(X, Y, cell * 0.4, cell * 2.3, 1300, 1.1); dust(X, Y); });
    }
  }
}

function die(reason: EndReason) {
  G.reason = reason;
  G.dieT = 0; G.moving = false; G.queue = [];
  G.prev = G.snake.map(p => ({ x: p.x, y: p.y })); G.grew = true;
  G.shatterOn = false; G.shattered = 0; G.shatterDur = clamp(0.25 + G.snake.length * 0.022, 0.4, 1.0);
  setState('dying');
  if (!G.demo) shake(cell * 0.35);
}

const TMP: Sample = { x: 0, y: 0, tx: 0, ty: 0, d: 0, r: 0 };
function updateDying(dt: number) {
  G.dieT += dt;
  if (G.dieT >= SHATTER_AT) {
    if (!G.shatterOn) { G.shatterOn = true; G.shattered = 0; }
    const total = G.bodyLen + 0.6, target = clamp((G.dieT - SHATTER_AT) / G.shatterDur, 0, 1) * total;
    let guard = 0;
    while (G.shattered < target && guard++ < 200) {
      if (PATH.length) {
        pathPoint(PATH, clamp(G.shattered, 0, PATH.length - 1), TMP);
        const gx = ((TMP.x % COLS) + COLS) % COLS, gy = ((TMP.y % ROWS) + ROWS) % ROWS;
        spawnShards(frameW + (gx + 0.5) * cell, frameW + (gy + 0.5) * cell, radiusAt(Math.min(G.shattered, G.bodyLen), G.bodyLen) * cell);
      }
      G.shattered += eco ? 1 : 0.5;
    }
  }
  if (G.dieT >= SHATTER_AT + G.shatterDur + 0.5) finishDeath();
}

function roundResult(reason: EndReason): RoundResult {
  return { score: G.score, letters: G.eaten, words: [...G.wordsDone], length: G.snake.length, timeMs: G.time, level: G.level, reason };
}

function finishDeath() {
  if (G.state !== 'dying') return;
  G.hideSnake = true;
  if (G.demo) { newGame(G.mode, true); return; }
  setState('over');
  hooks.onRoundEnd(roundResult(G.reason));
}

function winRound() {
  if (G.demo) { newGame(G.mode, true); return; }
  setState('over');
  hooks.onRoundEnd(roundResult('full'));
}

// ─── Demo-AI (de tuin speelt zichzelf achter het menu) ───────

function aiThink() {
  const head = G.snake[0], blocked = new Uint8Array(COLS * ROWS);
  for (let i = 0; i < G.snake.length - 1; i++) blocked[G.snake[i].y * COLS + G.snake[i].x] = 1;
  for (const s of G.stones) blocked[s.y * COLS + s.x] = 1;
  const target = G.bonus || G.food;
  let dist: Int16Array | null = null;
  if (target) {
    dist = new Int16Array(COLS * ROWS).fill(-1);
    const st = target.y * COLS + target.x, q = [st];
    dist[st] = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const c = q[qi], x = c % COLS, y = (c / COLS) | 0;
      for (const d of NB4) { const k = neighbor(x, y, d); if (k < 0 || blocked[k] || dist[k] >= 0) continue; dist[k] = dist[c] + 1; q.push(k); }
    }
  }
  const cands: Dir[] = [G.dir, { x: G.dir.y, y: -G.dir.x }, { x: -G.dir.y, y: G.dir.x }];
  let best: Dir | null = null, bestScore = -Infinity;
  for (const d of cands) {
    const k = neighbor(head.x, head.y, d);
    if (k < 0 || blocked[k]) continue;
    const area = floodCount(k, blocked, G.snake.length * 2 + 20);
    let sc = 0;
    if (area < G.snake.length + 2) sc -= 10000 - area;
    const dd = dist ? dist[k] : -1;
    sc += dd >= 0 ? 1000 - dd * 10 : area * 0.5;
    if (d === G.dir) sc += 3;
    sc += Math.random() * 2.5;
    if (sc > bestScore) { bestScore = sc; best = d; }
  }
  if (best && (best.x !== G.dir.x || best.y !== G.dir.y)) { G.queue.length = 0; G.queue.push(best); }
}

// ─── Deeltjes & rimpels ─────────────────────────────────────

function addP(p: Particle) { if (particles.length < (eco ? 160 : 520)) particles.push(p); }
function ripple(x: number, y: number, r0: number, r1: number, dur: number, k: number) {
  if (ripples.length < (eco ? 10 : 24)) ripples.push({ x, y, r0, r1, dur, k, t0: clock });
}
function burstPetals(X: number, Y: number, n: number) {
  const sc = cell / 30;
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), sp = rand(30, 115) * sc;
    addP({ type: 'petal', x: X, y: Y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 16 * sc, g: 14 * sc, drag: 0.3, life: rand(0.9, 1.7), fade: 0.6, rot: rand(0, TAU), vr: rand(-4, 4), size: cell * rand(0.1, 0.17), flip: rand(0, TAU), fs: rand(0.6, 1.6), color: pick(PETAL_COLORS) });
  }
}
function goldBurst(X: number, Y: number) {
  const sc = cell / 30;
  const n = REDUCED || eco ? 9 : 18;
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), sp = rand(40, 150) * sc;
    addP({ type: 'spark', x: X, y: Y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, drag: 0.12, life: rand(0.5, 1.1), fade: 0.5, size: rand(1.2, 2.6) * sc, rot: rand(0, TAU), vr: rand(-3, 3) });
  }
}
function spraySand(X: number, Y: number, d: Dir) {
  if (eco) return;
  const sc = cell / 30;
  for (let i = 0; i < 5; i++) {
    const a = Math.atan2(d.y, d.x) + rand(-0.9, 0.9), sp = rand(20, 70) * sc;
    addP({ type: 'sand', x: X + d.x * cell * 0.3, y: Y + d.y * cell * 0.3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, drag: 0.04, life: rand(0.25, 0.55), fade: 0.3, size: rand(0.6, 1.4) * sc, color: pick(['#cbbd9d', '#b3a27c', '#f4eee0']) });
  }
}
function dust(X: number, Y: number) {
  const sc = cell / 30;
  for (let i = 0; i < 16; i++) {
    const a = rand(0, TAU), sp = rand(25, 90) * sc;
    addP({ type: 'sand', x: X, y: Y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, drag: 0.05, life: rand(0.4, 0.9), fade: 0.4, size: rand(0.8, 1.8) * sc, color: pick(['#cbbd9d', '#b3a27c', '#f4eee0', '#8f8a7c']) });
  }
}
function spawnShards(X: number, Y: number, r: number) {
  const sc = cell / 30;
  for (let k = 0; k < (eco ? 2 : 3); k++) {
    const n = randi(4, 5), pts: [number, number][] = [], rr = r * rand(0.42, 0.72);
    for (let j = 0; j < n; j++) { const a = (j / n) * TAU + rand(-0.3, 0.3); pts.push([Math.cos(a) * rr * rand(0.6, 1.1), Math.sin(a) * rr * rand(0.6, 1.1)]); }
    const a = rand(0, TAU), sp = rand(25, 110) * sc;
    addP({ type: 'shard', x: X + rand(-r, r) * 0.4, y: Y + rand(-r, r) * 0.4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, drag: 0.08, life: rand(0.7, 1.25), fade: 0.55, rot: rand(0, TAU), vr: rand(-7, 7), pts });
  }
  if (Math.random() < 0.8) {
    const a = rand(0, TAU), sp = rand(30, 120) * sc;
    addP({ type: 'spark', x: X, y: Y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, drag: 0.1, life: rand(0.4, 0.9), fade: 0.4, size: rand(1, 2.2) * sc, rot: 0, vr: 2 });
  }
}
function floatText(X: number, Y: number, text: string, isGold: boolean) {
  addP({ type: 'text', x: X, y: Y, vx: 0, vy: -30 * (cell / 30), g: 0, drag: 0.35, life: 1.15, fade: 0.55, text, gold: isGold });
}
function updateParticles(dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles[i] = particles[particles.length - 1]; particles.pop(); continue; }
    const dr = Math.pow(p.drag, dt);
    p.vx *= dr; p.vy *= dr; p.vy += p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.vr && p.rot !== undefined) p.rot += p.vr * dt;
  }
}
function drawParticles() {
  const x = ctx;
  for (const p of particles) {
    const a = clamp(p.life / p.fade, 0, 1);
    if (p.type === 'petal') {
      x.save(); x.globalAlpha = a; x.translate(p.x, p.y); x.rotate(p.rot ?? 0);
      const s = p.size ?? 1;
      x.scale(s, s * Math.cos((p.flip ?? 0) + clock * 0.006 * (p.fs ?? 1)));
      x.fillStyle = p.color ?? PETAL_COLORS[0]; x.fill(PETAL); x.restore();
    } else if (p.type === 'sand') {
      x.globalAlpha = a; x.fillStyle = p.color ?? '#cbbd9d'; x.beginPath(); x.arc(p.x, p.y, p.size ?? 1, 0, TAU); x.fill(); x.globalAlpha = 1;
    } else if (p.type === 'shard' && p.pts) {
      const s = 0.55 + 0.45 * a;
      x.save(); x.globalAlpha = Math.min(1, a * 1.4); x.translate(p.x, p.y); x.rotate(p.rot ?? 0); x.scale(s, s);
      x.beginPath(); x.moveTo(p.pts[0][0], p.pts[0][1]);
      for (let i = 1; i < p.pts.length; i++) x.lineTo(p.pts[i][0], p.pts[i][1]);
      x.closePath();
      x.fillStyle = gold ? '#b88a2e' : '#1d1916'; x.fill();
      x.strokeStyle = gold ? 'rgba(40,30,20,0.8)' : 'rgba(216,178,92,0.9)'; x.lineWidth = Math.max(0.8, cell * 0.03); x.stroke(); x.restore();
    } else if (p.type === 'spark') {
      const s = (p.size ?? 1) * (0.5 + 0.5 * a);
      x.save(); x.globalAlpha = a; x.translate(p.x, p.y); x.rotate(p.rot ?? 0);
      x.fillStyle = '#e2b84f'; x.beginPath();
      for (let i = 0; i < 8; i++) { const ang = (i * Math.PI) / 4, r = i % 2 ? s * 0.55 : s * 2.3; if (i) x.lineTo(Math.cos(ang) * r, Math.sin(ang) * r); else x.moveTo(r, 0); }
      x.closePath(); x.fill(); x.fillStyle = '#fff7da'; x.beginPath(); x.arc(0, 0, s * 0.55, 0, TAU); x.fill(); x.restore();
    } else if (p.type === 'leaf') {
      const sz = ginkgoS.size * (p.size ?? 1);
      x.save(); x.globalAlpha = a; x.translate(p.x, p.y); x.rotate(p.rot ?? 0); x.scale(0.7 + 0.3 * a, 0.7 + 0.3 * a);
      x.drawImage(ginkgoS.c, -sz / 2, -sz / 2, sz, sz); x.restore();
    }
  }
}
function drawTexts() {
  const x = ctx;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  for (const p of particles) {
    if (p.type !== 'text' || !p.text) continue;
    const a = clamp(p.life / p.fade, 0, 1), fs = Math.round(cell * (p.gold ? 0.8 : 0.68));
    x.font = `italic 600 ${fs}px ${FONT_DISPLAY}`;
    x.lineWidth = Math.max(2, cell * 0.11); x.lineJoin = 'round';
    x.strokeStyle = `rgba(248,243,233,${0.9 * a})`; x.strokeText(p.text, p.x, p.y);
    x.fillStyle = p.gold ? `rgba(150,104,24,${a})` : `rgba(33,29,26,${a})`; x.fillText(p.text, p.x, p.y);
  }
}
function drawRipples() {
  const x = ctx;
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i], p = (clock - r.t0) / r.dur;
    if (p >= 1) { ripples.splice(i, 1); continue; }
    if (p < 0) continue;
    const e = easeOutCubic(p), a = (1 - p) * r.k;
    x.lineWidth = Math.max(1, cell * 0.05);
    for (let j = 0; j < 2; j++) {
      const rad = lerp(r.r0, r.r1, e) * (1 - j * 0.3);
      x.strokeStyle = `rgba(118,96,68,${Math.min(1, 0.42 * a)})`; x.beginPath(); x.arc(r.x, r.y + 0.9, rad, 0, TAU); x.stroke();
      x.strokeStyle = `rgba(255,252,244,${Math.min(1, 0.85 * a)})`; x.beginPath(); x.arc(r.x, r.y - 0.9, rad, 0, TAU); x.stroke();
    }
  }
}

// ─── Slang: vloeiend pad met afgeronde bochten ──────────────

const R0 = 0.37;
const SP: Sample[] = [];
let SN = 0;
const PATH: Cell[] = [];

function pathPoint(P: Cell[], s: number, o: Sample): Sample {
  const n = P.length - 1;
  if (n < 1) { o.x = P[0].x; o.y = P[0].y; o.tx = -G.dir.x; o.ty = -G.dir.y; return o; }
  if (s < 0) s = 0; else if (s > n) s = n;
  let k = Math.floor(s);
  if (k > n - 1) k = n - 1;
  const f = s - k, A = P[k], B = P[k + 1], ex = B.x - A.x, ey = B.y - A.y;
  if (f < 0.5) {
    if (k > 0) { const Z = P[k - 1], ax = A.x - Z.x, ay = A.y - Z.y; if (ax !== ex || ay !== ey) return arcPt(A, ax, ay, ex, ey, 0.5 + f, o); }
  } else if (k + 2 <= n) {
    const C = P[k + 2], bx = C.x - B.x, by = C.y - B.y;
    if (bx !== ex || by !== ey) return arcPt(B, ex, ey, bx, by, f - 0.5, o);
  }
  o.x = A.x + ex * f; o.y = A.y + ey * f; o.tx = ex; o.ty = ey;
  return o;
}

function arcPt(V: Cell, ax: number, ay: number, bx: number, by: number, phi: number, o: Sample): Sample {
  const th = phi * Math.PI * 0.5, c = Math.cos(th), s = Math.sin(th);
  const Cx = V.x - ax * 0.5 + bx * 0.5, Cy = V.y - ay * 0.5 + by * 0.5;
  o.x = Cx + 0.5 * (-bx * c + ax * s); o.y = Cy + 0.5 * (-by * c + ay * s);
  o.tx = ax * c + bx * s; o.ty = ay * c + by * s;
  const L = Math.hypot(o.tx, o.ty) || 1;
  o.tx /= L; o.ty /= L;
  return o;
}

function radiusAt(d: number, len: number) {
  let r = R0;
  r *= 1 - 0.1 * Math.exp(-Math.pow((d - 0.7) / 0.3, 2));
  const tl = Math.min(3.4, len * 0.6 + 0.3), ft = len - d;
  if (ft < tl) { const q = clamp(ft / tl, 0, 1); r *= 0.22 + 0.78 * (1 - (1 - q) * (1 - q)); }
  for (let i = 0; i < G.bulges.length; i++) { const b = G.bulges[i], z = (d - b.d) / 0.5; r *= 1 + b.a * Math.exp(-z * z); }
  return r;
}

const wrapD = (v: number, n: number) => (v > 1 ? v - n : v < -1 ? v + n : v);

function buildSamples() {
  const s = G.snake;
  SN = 0;
  if (!s.length) return;
  PATH.length = 0;
  let ux = s[0].x, uy = s[0].y;
  PATH.push({ x: ux, y: uy });
  for (let i = 1; i < s.length; i++) { ux += wrapD(s[i].x - s[i - 1].x, COLS); uy += wrapD(s[i].y - s[i - 1].y, ROWS); PATH.push({ x: ux, y: uy }); }
  const t = G.moving ? clamp(G.acc / G.stepMs, 0, 1) : 1;
  let extra = false;
  if (G.moving && !G.grew && G.prev.length) {
    const o = G.prev[G.prev.length - 1], l = s[s.length - 1];
    const dx = wrapD(o.x - l.x, COLS), dy = wrapD(o.y - l.y, ROWS);
    if (dx || dy) { PATH.push({ x: ux + dx, y: uy + dy }); extra = true; }
  }
  const sh = 1 - t, st = PATH.length - 1 - (extra ? t : 0), len = Math.max(0.001, st - sh);
  SN = Math.max(2, Math.ceil(len / (eco ? 0.26 : 0.18)) + 1);
  for (let i = 0; i < SN; i++) {
    const smp = SP[i] || (SP[i] = { x: 0, y: 0, tx: 0, ty: 0, d: 0, r: 0 });
    const a = sh + len * (i / (SN - 1));
    pathPoint(PATH, a, smp);
    smp.d = a - sh;
    smp.r = radiusAt(smp.d, len);
  }
  G.bodyLen = len;
}

function drawSnake() {
  if (!G.snake.length || G.hideSnake) return;
  buildSamples();
  if (SN < 2) return;
  const cut = G.state === 'dying' && G.shatterOn ? G.shattered : 0;
  let i0 = 0;
  while (i0 < SN && SP[i0].d < cut) i0++;
  if (i0 >= SN - 1) return;
  const headOn = i0 === 0;
  if (!G.wrap) { drawSnakeAt(0, 0, i0, headOn); return; }
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (let i = i0; i < SN; i++) { const p = SP[i]; if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
  for (let ox = -COLS; ox <= COLS; ox += COLS) {
    for (let oy = -ROWS; oy <= ROWS; oy += ROWS) {
      if (maxX + ox < -1.3 || minX + ox > COLS + 0.3 || maxY + oy < -1.3 || minY + oy > ROWS + 0.3) continue;
      drawSnakeAt(ox, oy, i0, headOn);
    }
  }
}

/** Lak & aders — standaard zwarte lak met gouden kintsugi, "gouden slang" is het omgekeerde. */
function palette() {
  return gold
    ? { base: '#a47a26', bands: ['#b98c32', '#d2a84a', 'rgba(255,248,220,0.30)'] as const, vein: 'rgba(58,40,14,0.85)', veinHi: '#2a1d0c', eye: ['#fff6d6', '#e7c768', '#7a5516'] as const, crest: '#3b2a10' }
    : { base: '#1d1916', bands: ['#2b2520', '#453c34', 'rgba(255,240,215,0.14)'] as const, vein: 'rgba(112,82,28,0.9)', veinHi: '#d8b25c', eye: ['#fbe39a', '#dcaa40', '#8a611d'] as const, crest: '#d8b25c' };
}

const veinOff = (d: number) => 0.1 * Math.sin(d * 2.1) + 0.05 * Math.sin(d * 5.3 + 1.3);

function drawSnakeAt(ox: number, oy: number, i0: number, headOn: boolean) {
  const x = ctx, c = cell, pal = palette();
  const flash = G.state === 'dying' ? Math.max(0, 1 - G.dieT / 0.5) : 0;
  const base = flash > 0 ? mixHex(pal.base, '#a8321f', flash * 0.85) : pal.base;
  const PX = (i: number) => frameW + (SP[i].x + ox + 0.5) * c, PY = (i: number) => frameW + (SP[i].y + oy + 0.5) * c;
  // lichaam + contactschaduw (in spaarstand een goedkope verschoven silhouet i.p.v. blur)
  x.save();
  if (eco) {
    x.fillStyle = 'rgba(46,30,16,0.22)'; x.beginPath();
    for (let i = i0; i < SN; i++) { const X = PX(i) + c * 0.1, Y = PY(i) + c * 0.16, r = SP[i].r * c; x.moveTo(X + r, Y); x.arc(X, Y, r, 0, TAU); }
    x.fill();
  } else {
    x.shadowColor = 'rgba(46,30,16,0.36)'; x.shadowBlur = c * 0.34 * DPR; x.shadowOffsetX = c * 0.1 * DPR; x.shadowOffsetY = c * 0.17 * DPR;
  }
  x.fillStyle = base; x.beginPath();
  for (let i = i0; i < SN; i++) { const X = PX(i), Y = PY(i), r = SP[i].r * c; x.moveTo(X + r, Y); x.arc(X, Y, r, 0, TAU); }
  x.fill(); x.restore();
  // laklaagjes (licht van linksboven)
  const bands: [number, number, string][] = [[0.72, 0.6, pal.bands[0]], [0.46, 1, pal.bands[1]], [0.17, 1.55, pal.bands[2]]];
  for (const [rk, ok, col] of bands) {
    x.fillStyle = col; x.beginPath();
    for (let i = i0; i < SN; i++) {
      const k = SP[i].r / R0, r = SP[i].r * c * rk, X = PX(i) - 0.1 * c * ok * k, Y = PY(i) - 0.125 * c * ok * k;
      x.moveTo(X + r, Y); x.arc(X, Y, r, 0, TAU);
    }
    x.fill();
  }
  // kintsugi-aders
  if (SN > 5) {
    const endD = G.bodyLen - 0.35;
    x.beginPath();
    let on = false;
    for (let i = i0; i < SN; i++) {
      const s = SP[i];
      if (s.d < 0.55 || s.d > endD) continue;
      const off = veinOff(s.d) * c * (s.r / R0), X = PX(i) - s.ty * off, Y = PY(i) + s.tx * off;
      if (!on) { x.moveTo(X, Y); on = true; } else x.lineTo(X, Y);
    }
    const stp = G.bodyLen / (SN - 1);
    for (let k = 0; k < 400; k++) {
      const dk = 1.35 + k * 2.3;
      if (dk > endD - 0.3) break;
      const i = Math.round(dk / stp);
      if (i < i0 || i >= SN) continue;
      const s = SP[i], kk = s.r / R0, off = veinOff(s.d) * c * kk;
      const X = PX(i) - s.ty * off, Y = PY(i) + s.tx * off;
      const side = k % 2 ? 1 : -1, ang = Math.atan2(s.ty, s.tx) + side * 1.05, l = c * 0.21 * kk;
      x.moveTo(X, Y); x.lineTo(X + Math.cos(ang) * l, Y + Math.sin(ang) * l);
      const mx = X + Math.cos(ang) * l * 0.55, my = Y + Math.sin(ang) * l * 0.55, a2 = ang - side * 0.75;
      x.moveTo(mx, my); x.lineTo(mx + Math.cos(a2) * l * 0.45, my + Math.sin(a2) * l * 0.45);
    }
    x.lineCap = 'round'; x.lineJoin = 'round';
    x.strokeStyle = pal.vein; x.lineWidth = Math.max(1.3, c * 0.072); x.stroke();
    const glow = Math.min(1, Math.max(G.glow, flash));
    x.save();
    if (glow > 0 && !eco) { x.shadowColor = `rgba(255,205,110,${0.9 * glow})`; x.shadowBlur = c * 0.45 * DPR * glow; x.shadowOffsetX = 0; x.shadowOffsetY = 0; }
    x.strokeStyle = glow > 0 && !gold ? mixHex('#d8b25c', '#fff0b8', glow * 0.7) : pal.veinHi;
    x.lineWidth = Math.max(0.8, c * 0.036); x.stroke();
    x.restore();
  }
  if (headOn) { const h = SP[0]; drawHead(PX(0), PY(0), Math.atan2(-h.ty, -h.tx), base); }
}

let HEAD_PATH: Path2D | null = null;
function headPath(): Path2D {
  if (HEAD_PATH) return HEAD_PATH;
  const L = cell * 0.52, Wd = cell * 0.4, p = new Path2D();
  p.moveTo(-L * 0.62, -Wd * 0.8);
  p.bezierCurveTo(-L * 0.1, -Wd * 1.1, L * 0.6, -Wd * 0.98, L * 0.9, -Wd * 0.4);
  p.quadraticCurveTo(L * 1.05, 0, L * 0.9, Wd * 0.4);
  p.bezierCurveTo(L * 0.6, Wd * 0.98, -L * 0.1, Wd * 1.1, -L * 0.62, Wd * 0.8);
  p.quadraticCurveTo(-L * 0.85, 0, -L * 0.62, -Wd * 0.8);
  p.closePath();
  return (HEAD_PATH = p);
}

function drawHead(X: number, Y: number, ang: number, base: string) {
  const x = ctx, c = cell, L = c * 0.52, Wd = c * 0.4, hp = headPath(), pal = palette();
  const gulp = 1 + 0.09 * Math.min(1, G.glow);
  x.save(); x.translate(X, Y); x.rotate(ang); x.scale(gulp, gulp);
  if (G.tongueT > 0 && G.state !== 'dying') {
    const p = 1 - G.tongueT / TONGUE_DUR, ext = Math.sin(p * Math.PI) * c * 0.44, fl = Math.sin(p * Math.PI * 7) * c * 0.035;
    const bx = L * 0.86, fk = Math.min(ext * 0.5, c * 0.13);
    x.strokeStyle = '#b3322a'; x.lineWidth = Math.max(1, c * 0.042); x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(bx, 0); x.lineTo(bx + ext, fl);
    x.moveTo(bx + ext, fl); x.lineTo(bx + ext + fk, fl - fk * 0.62);
    x.moveTo(bx + ext, fl); x.lineTo(bx + ext + fk, fl + fk * 0.62); x.stroke();
  }
  x.save();
  if (!eco) { x.shadowColor = 'rgba(46,30,16,0.38)'; x.shadowBlur = c * 0.34 * DPR; x.shadowOffsetX = c * 0.1 * DPR; x.shadowOffsetY = c * 0.17 * DPR; }
  x.fillStyle = base; x.fill(hp); x.restore();
  const ca = Math.cos(-ang), sa = Math.sin(-ang), lxs = -0.1 * c, lys = -0.125 * c;
  const lx = lxs * ca - lys * sa, ly = lxs * sa + lys * ca;
  x.save(); x.translate(lx * 0.55, ly * 0.55); x.scale(0.8, 0.8); x.fillStyle = pal.bands[0]; x.fill(hp); x.restore();
  x.save(); x.translate(lx, ly); x.scale(0.5, 0.48); x.fillStyle = pal.bands[1]; x.fill(hp); x.restore();
  x.save(); x.translate(lx * 1.6, ly * 1.6); x.fillStyle = 'rgba(255,240,215,0.15)'; x.beginPath(); x.ellipse(L * 0.1, 0, L * 0.36, Wd * 0.11, 0, 0, TAU); x.fill(); x.restore();
  // kam
  x.lineCap = 'round';
  x.beginPath(); x.moveTo(-L * 0.62, 0); x.quadraticCurveTo(-L * 0.25, c * 0.025, L * 0.08, 0);
  x.strokeStyle = pal.vein; x.lineWidth = Math.max(1.3, c * 0.064); x.stroke();
  x.strokeStyle = pal.crest; x.lineWidth = Math.max(0.8, c * 0.032); x.stroke();
  x.fillStyle = pal.crest; x.beginPath(); x.moveTo(L * 0.36, 0); x.lineTo(L * 0.21, -c * 0.048); x.lineTo(L * 0.06, 0); x.lineTo(L * 0.21, c * 0.048); x.closePath(); x.fill();
  // ogen
  const er = c * 0.092, ex = L * 0.3, ey = Wd * 0.56, closed = G.state === 'dying' || G.state === 'over';
  let open = 1;
  if (G.blinkT > 0) open = 1 - Math.sin((1 - G.blinkT / BLINK_DUR) * Math.PI) * 0.9;
  const ln = Math.hypot(lx, ly) || 1;
  for (const sg of [-1, 1]) {
    x.save(); x.translate(ex, sg * ey);
    x.fillStyle = 'rgba(0,0,0,0.42)'; x.beginPath(); x.ellipse(0, 0, er * 1.3, er * 1.15, 0, 0, TAU); x.fill();
    if (closed) {
      x.strokeStyle = pal.crest; x.lineWidth = Math.max(1, c * 0.03);
      x.beginPath(); x.moveTo(-er, 0); x.quadraticCurveTo(0, sg * er * 0.6, er, 0); x.stroke();
    } else {
      x.scale(1, open);
      const g = x.createRadialGradient(-er * 0.3, -er * 0.3, er * 0.1, 0, 0, er);
      g.addColorStop(0, pal.eye[0]); g.addColorStop(0.55, pal.eye[1]); g.addColorStop(1, pal.eye[2]);
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, er, 0, TAU); x.fill();
      x.fillStyle = '#110e0c'; x.beginPath(); x.ellipse(er * 0.05, 0, er * 0.72, er * 0.22, 0, 0, TAU); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.9)'; x.beginPath(); x.arc((lx / ln) * er * 0.42, (ly / ln) * er * 0.42, er * 0.21, 0, TAU); x.fill();
    }
    x.restore();
  }
  x.fillStyle = 'rgba(0,0,0,0.55)';
  for (const sg of [-1, 1]) { x.beginPath(); x.ellipse(L * 0.8, sg * Wd * 0.2, c * 0.022, c * 0.014, 0, 0, TAU); x.fill(); }
  x.restore();
}

// ─── Zandspoor: de slang duwt de harklijnen opzij ───────────

const TRAIL_PTS: TrailPt[] = [];
function trailW(age: number) {
  const w0 = cell * 0.76;
  if (age < TRAIL_HOLD) return w0;
  const q = (age - TRAIL_HOLD) / TRAIL_FADE;
  return q >= 1 ? 0 : w0 * (1 - smooth(q));
}

function strokeRun(m: CanvasRenderingContext2D, pts: TrailPt[], a: number, b: number) {
  if (b - a < 1) return false;
  let drew = false;
  const X = (p: TrailPt) => frameW + (p.x + 0.5) * cell, Y = (p: TrailPt) => frameW + (p.y + 0.5) * cell;
  for (let i = a; i <= b; i++) {
    const w = trailW(clock - pts[i].t);
    if (w < 0.5) continue;
    const p = pts[i], px = X(p), py = Y(p);
    const sx = i === a ? px : (X(pts[i - 1]) + px) / 2, sy = i === a ? py : (Y(pts[i - 1]) + py) / 2;
    const ex = i === b ? px : (px + X(pts[i + 1])) / 2, ey = i === b ? py : (py + Y(pts[i + 1])) / 2;
    m.lineWidth = w; m.beginPath(); m.moveTo(sx, sy); m.quadraticCurveTo(px, py, ex, ey); m.stroke(); drew = true;
  }
  return drew;
}

function collectTrail(): TrailPt[] | null {
  const T = G.trail;
  while (T.length && clock - T[0].t > TRAIL_LIFE) T.shift();
  if (!T.length) return null;
  const pts = TRAIL_PTS;
  pts.length = 0;
  for (let i = 0; i < T.length; i++) pts.push(T[i]);
  if (G.snake.length && !G.hideSnake) {
    const tl = G.snake[G.snake.length - 1], last = pts[pts.length - 1];
    pts.push({ x: tl.x, y: tl.y, t: clock, brk: Math.abs(last.x - tl.x) + Math.abs(last.y - tl.y) !== 1 });
  }
  return pts;
}

function drawTrail() {
  const pts = collectTrail();
  if (!pts) return;
  if (eco) {
    // Spaarstand: één zachte streek in plaats van drie maskerpasses.
    const x = ctx;
    x.save(); x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = 'rgba(236,228,210,0.55)';
    let start = 0;
    for (let i = 1; i <= pts.length; i++) if (i === pts.length || pts[i].brk) { strokeRun(x, pts, start, i - 1); start = i; }
    x.restore();
    return;
  }
  const m = maskX;
  m.setTransform(1, 0, 0, 1, 0, 0); m.globalCompositeOperation = 'source-over'; m.globalAlpha = 1; m.clearRect(0, 0, maskC.width, maskC.height);
  m.setTransform(DPR, 0, 0, DPR, 0, 0); m.lineCap = 'round'; m.lineJoin = 'round'; m.strokeStyle = '#000';
  let drew = false, start = 0;
  for (let i = 1; i <= pts.length; i++) if (i === pts.length || pts[i].brk) { if (strokeRun(m, pts, start, i - 1)) drew = true; start = i; }
  if (!drew) return;
  const d = Math.max(1, cell * 0.055);
  m.setTransform(1, 0, 0, 1, 0, 0); m.globalCompositeOperation = 'source-in';
  m.fillStyle = '#6a5639'; m.fillRect(0, 0, maskC.width, maskC.height);
  ctx.globalAlpha = 0.34; ctx.drawImage(maskC, -d, -d, W, H);
  m.fillStyle = '#fffaf0'; m.fillRect(0, 0, maskC.width, maskC.height);
  ctx.globalAlpha = 0.8; ctx.drawImage(maskC, d, d, W, H);
  m.drawImage(grooveC, 0, 0);
  ctx.globalAlpha = 1; ctx.drawImage(maskC, 0, 0, W, H);
  m.globalCompositeOperation = 'source-over';
}

// ─── Voedsel (letterkei), bonus, stenen ─────────────────────

function drawFoodUnder() {
  const f = G.food;
  if (!f) return;
  const X = cx(f.x), Y = cy(f.y), c = cell, p = clamp((clock - f.born) / 600, 0, 1), e = easeOutCubic(p);
  if (p >= 1 && !f.landed) { f.landed = true; ripple(X, Y, c * 0.3, c * 1.25, 900, 0.8); }
  const ra = e * 0.6;
  ctx.lineWidth = Math.max(1, c * 0.045);
  for (let k = 0; k < 2; k++) {
    const rr = c * (0.6 + k * 0.26) + Math.sin(clock * 0.0022 - k * 0.9) * c * 0.03;
    ctx.strokeStyle = `rgba(122,98,68,${0.34 * ra})`; ctx.beginPath(); ctx.arc(X, Y + 0.8, rr, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(255,252,244,${0.9 * ra})`; ctx.beginPath(); ctx.arc(X, Y - 0.8, rr, 0, TAU); ctx.stroke();
  }
  const sx = X + c * 0.1, sy = Y + c * 0.13, g = ctx.createRadialGradient(sx, sy, 0, sx, sy, c * 0.48);
  g.addColorStop(0, `rgba(80,60,34,${0.34 * e})`); g.addColorStop(1, 'rgba(80,60,34,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, c * 0.48, 0, TAU); ctx.fill();
}

function drawFood() {
  const f = G.food;
  if (!f) return;
  const X = cx(f.x), Y = cy(f.y), c = cell, p = clamp((clock - f.born) / 600, 0, 1), e = easeOutCubic(p);
  const lift = (1 - e) * c * 1.1 + c * 0.04 + Math.sin(clock * 0.003) * c * 0.02;
  const sc = 1 + 0.35 * (1 - e);
  const pulse = REDUCED ? 0.5 : 0.5 + 0.5 * Math.sin(clock * 0.0055);
  ctx.save();
  ctx.globalAlpha = Math.min(1, p * 1.7);
  ctx.translate(X, Y - lift);
  ctx.scale(sc, sc);
  // accent-halo zodat de volgende letter altijd te vinden is
  ctx.strokeStyle = rgba(accent, 0.3 + 0.35 * pulse);
  ctx.lineWidth = Math.max(1.4, c * 0.07);
  ctx.beginPath(); ctx.arc(0, 0, c * (0.6 + 0.05 * pulse), 0, TAU); ctx.stroke();
  ctx.rotate(f.tilt);
  const sz = pebbleS.size;
  ctx.drawImage(pebbleS.c, -sz / 2, -sz / 2, sz, sz);
  ctx.fillStyle = '#1d1916';
  ctx.font = `700 ${Math.max(10, Math.round(c * 0.6))}px ${FONT_LETTER}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(f.ch, 0, c * 0.04);
  ctx.restore();
}

function drawBonus() {
  const b = G.bonus;
  if (!b) return;
  const X = cx(b.x), Y = cy(b.y), c = cell;
  const frac = clamp(1 - (G.time - b.t0) / b.life, 0, 1), pin = clamp((clock - b.born) / 520, 0, 1), e = easeOutBack(pin);
  const warn = frac < 0.3 ? 0.5 + 0.5 * Math.sin(clock * 0.022) : 1;
  ctx.save(); ctx.globalAlpha = pin * (0.35 + 0.65 * warn);
  ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(29,25,22,0.78)';
  const a0 = -Math.PI / 2, segs = 28, total = TAU * frac;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    ctx.lineWidth = Math.max(1, c * (0.035 + 0.05 * (1 - t0)));
    ctx.beginPath(); ctx.arc(X, Y, c * 0.62, a0 + total * t0, a0 + total * t1 + 0.01); ctx.stroke();
  }
  ctx.restore();
  const sx = X + c * 0.1, sy = Y + c * 0.14, g = ctx.createRadialGradient(sx, sy, 0, sx, sy, c * 0.42);
  g.addColorStop(0, `rgba(90,60,20,${0.3 * pin})`); g.addColorStop(1, 'rgba(90,60,20,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, c * 0.42, 0, TAU); ctx.fill();
  const sz = ginkgoS.size;
  ctx.save(); ctx.globalAlpha = pin; ctx.translate(X, Y - c * 0.06 - Math.sin(clock * 0.0035) * c * 0.04);
  ctx.rotate(Math.sin(clock * 0.0021) * 0.26 - 0.12); ctx.scale(e, e);
  ctx.drawImage(ginkgoS.c, -sz / 2, -sz * 0.52, sz, sz); ctx.restore();
  if (G.state !== 'paused' && !eco && Math.random() < 0.06) {
    const a = rand(0, TAU);
    addP({ type: 'spark', x: X + Math.cos(a) * c * 0.4, y: Y + Math.sin(a) * c * 0.4, vx: 0, vy: -10, g: 0, drag: 0.5, life: 0.7, fade: 0.5, size: rand(0.8, 1.6) * (c / 30), rot: 0, vr: 2 });
  }
}

function drawRisingStones() {
  let pending = false;
  for (const s of G.stones) {
    const age = clock - s.born;
    if (age >= STONE_RISE) continue;
    pending = true;
    const p = clamp(age / STONE_RISE, 0, 1), k = Math.max(0.01, easeOutBack(p)), X = cx(s.x), Y = cy(s.y);
    ctx.save(); ctx.globalAlpha = Math.min(1, p * 2.2); ctx.translate(X, Y); ctx.scale(k, k); ctx.translate(-X, -Y); drawStone(ctx, s); ctx.restore();
  }
  if (!pending && G.stoneDirty) { G.stoneDirty = false; renderStones(); }
}

// ─── Render & update ────────────────────────────────────────

function render() {
  const x = ctx;
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  x.drawImage(bgC, 0, 0);
  x.setTransform(DPR, 0, 0, DPR, 0, 0);
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  const bx = bx0(), by = by0(), bw = COLS * cell, bh = ROWS * cell;
  x.save(); x.beginPath(); x.rect(bx, by, bw, bh); x.clip();
  drawTrail();
  drawRipples();
  drawFoodUnder();
  x.drawImage(stoneC, 0, 0, W, H);
  drawRisingStones();
  drawFood();
  drawBonus();
  drawSnake();
  drawParticles();
  if (!eco) {
    x.save();
    x.globalCompositeOperation = 'multiply'; x.globalAlpha = 0.15;
    const sw = REDUCED ? 0 : Math.sin(clock * 0.00035) * 0.014 + Math.sin(clock * 0.00091) * 0.006;
    x.translate(W, 0); x.rotate(sw); x.translate(-W, 0);
    x.drawImage(shadeC, 0, 0, W, H);
    x.restore();
  }
  x.drawImage(lightC, 0, 0, W, H);
  drawTexts();
  x.restore();
}

let shakeAmt = 0;
function shake(a: number) { if (!REDUCED) shakeAmt = Math.max(shakeAmt, a); }

function update(dt: number) {
  if (G.state !== 'paused') clock += dt * 1000;
  if (G.state === 'playing' || G.state === 'demo') {
    G.time += dt * 1000; G.acc += dt * 1000;
    let guard = 0;
    while (G.acc >= G.stepMs && guard++ < 4) {
      G.acc -= G.stepMs;
      if (G.state === 'demo') aiThink();
      step();
      if (G.state !== 'playing' && G.state !== 'demo') { G.acc = 0; break; }
    }
    if (G.bonus && G.time - G.bonus.t0 > G.bonus.life) expireBonus();
    if (G.pendingWordAt && !G.food && G.time >= G.pendingWordAt && (G.state === 'playing' || G.state === 'demo')) startNextWord();
  }
  if (G.state === 'dying') updateDying(dt);
  if (G.state !== 'paused') {
    updateParticles(dt);
    G.glow = Math.max(0, G.glow - dt * 1.7);
    const spd = (1000 / G.stepMs) * 1.25;
    for (let i = G.bulges.length - 1; i >= 0; i--) {
      const b = G.bulges[i];
      b.d += dt * spd; b.a *= Math.pow(0.75, dt);
      if (b.d > G.bodyLen + 0.6) G.bulges.splice(i, 1);
    }
    G.tongueT = Math.max(0, G.tongueT - dt); G.tongueNext -= dt;
    if (G.tongueNext <= 0) { if (G.tongueT <= 0) G.tongueT = TONGUE_DUR; G.tongueNext = rand(1.8, 4.6); }
    G.blinkT = Math.max(0, G.blinkT - dt); G.blinkNext -= dt;
    if (G.blinkNext <= 0) { G.blinkT = BLINK_DUR; G.blinkNext = rand(2.4, 6); }
  }
  if (boardEl) {
    if (shakeAmt > 0.15) {
      boardEl.style.transform = `translate(${(Math.random() * 2 - 1) * shakeAmt}px,${(Math.random() * 2 - 1) * shakeAmt}px)`;
      shakeAmt *= Math.pow(0.0008, dt);
    } else if (shakeAmt) { shakeAmt = 0; boardEl.style.transform = ''; }
  }
}

// ─── Publieke API ───────────────────────────────────────────

export interface EngineOptions { touch: boolean; reduced: boolean; eco: boolean; board: HTMLElement }

export function initEngine(canvas: HTMLCanvasElement, h: EngineHooks, o: EngineOptions): void {
  cvs = canvas;
  ctx = ctx2d(canvas);
  hooks = h;
  TOUCH = o.touch;
  REDUCED = o.reduced;
  eco = o.eco;
  boardEl = o.board;
}

export function setEco(on: boolean) { eco = on; }
export function isEco() { return eco; }
export function setAccent(hex: string) { accent = hex; }
export function setGold(on: boolean) { gold = on; }

export function startDemo(mode: GameMode = 'rustig') { newGame(mode, true); }
export function startRound(mode: GameMode) { newGame(mode, false); }

export function getState(): EngineState { return G.state; }
export function getMode(): GameMode { return G.mode; }
export function getScore(): number { return G.score; }
export function getLevel(): number { return G.level; }
export function roundActive(): boolean { return !G.demo && (G.state === 'ready' || G.state === 'playing' || G.state === 'paused' || G.state === 'dying'); }

/** Richting aanvragen. In 'ready' start de eerste geldige richting de ronde. */
export function pushDir(d: Dir): void {
  if (G.state === 'paused') return;
  if (G.state === 'ready') {
    const hd = G.snake[0], n = G.snake[1];
    if (n) {
      let nx = hd.x + d.x, ny = hd.y + d.y;
      if (G.wrap) { nx = (nx + COLS) % COLS; ny = (ny + ROWS) % ROWS; }
      if (nx === n.x && ny === n.y) return;
    }
    G.dir = d; G.queue.length = 0; G.acc = G.stepMs;
    setState('playing');
    return;
  }
  if (G.state !== 'playing') return;
  const last = G.queue.length ? G.queue[G.queue.length - 1] : G.dir;
  if ((d.x === last.x && d.y === last.y) || (d.x === -last.x && d.y === -last.y)) return;
  if (G.queue.length < 3) G.queue.push(d);
}

export function pause(): boolean {
  if (G.state !== 'playing') return false;
  setState('paused');
  return true;
}

export function resume(): boolean {
  if (G.state !== 'paused') return false;
  setState('playing');
  return true;
}

/** Sneller door de sterfanimatie (spatie/enter). */
export function skipDeath(): void {
  if (G.state === 'dying' && G.dieT > 0.4) finishDeath();
}

/** Ronde afbreken van buitenaf (tijd om, leerling stopt). */
export function endRound(reason: 'time' | 'stopped'): void {
  if (G.demo || G.state === 'over' || G.state === 'boot') return;
  G.moving = false;
  setState('over');
  hooks.onRoundEnd(roundResult(reason));
}

export function frame(dt: number): void {
  update(dt);
  render();
}

/** Bord-coördinaten van de kop (CSS-px, t.o.v. het canvas) — voor de woordkaart. */
export function headPos(): { x: number; y: number; W: number; H: number } {
  const hd = G.snake[0] || { x: COLS / 2, y: ROWS / 2 };
  return { x: cx(hd.x), y: cy(hd.y), W, H };
}

/** Momentopname voor geautomatiseerde tests (geen invloed op het spel). */
export function debugSnapshot() {
  return {
    state: G.state, mode: G.mode, cols: COLS, rows: ROWS, wrap: G.wrap, cell,
    dir: { x: G.dir.x, y: G.dir.y },
    snake: G.snake.map(p => ({ x: p.x, y: p.y })),
    stones: G.stones.map(s => ({ x: s.x, y: s.y })),
    food: G.food ? { x: G.food.x, y: G.food.y, ch: G.food.ch } : null,
    bonus: G.bonus ? { x: G.bonus.x, y: G.bonus.y } : null,
    word: G.word ? { word: G.word.entry.word, next: G.word.next } : null,
    score: G.score, eaten: G.eaten, level: G.level, eco,
  };
}
