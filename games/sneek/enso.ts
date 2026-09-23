// Ensō — de penseelcirkel. Procedurele haren, deterministisch.
// Gebruikt als logo in het menu én als timer in de HUD (de cirkel slinkt met de resterende tijd).

import { TAU, ctx2d, mulberry32 } from './util';

const ENSO = (() => {
  const r = mulberry32(8191), b = [] as { lat: number; start: number; end: number; alpha: number; w: number; wob: number }[], NB = 24;
  for (let i = 0; i < NB; i++) {
    const lat = i / (NB - 1) - 0.5;
    b.push({ lat: lat + (r() - 0.5) * 0.03, start: r() * 0.015, end: 1 - r() * r() * 0.32 * (0.3 + Math.abs(lat) * 1.8), alpha: 0.55 + r() * 0.45, w: 0.8 + r() * 0.6, wob: r() * 6 });
  }
  const s = [] as { u: number; lat: number; r: number }[];
  for (let i = 0; i < 170; i++) s.push({ u: 0.3 + r() * 0.7, lat: r() - 0.5, r: r() });
  return { b, s };
})();

/** Tekent de ensō. prog 0..1 bepaalt hoe ver de penseelstreek loopt. ink = [r,g,b]. */
export function drawEnso(cv: HTMLCanvasElement, prog: number, ink: readonly [number, number, number] = [24, 20, 17]): void {
  const S = cv.width, x = ctx2d(cv);
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, S, S);
  if (prog <= 0) return;
  const C = S / 2, R = S * 0.37, Wb = S * 0.1, a0 = -Math.PI * 0.36, sweep = TAU * 0.9;
  const widthAt = (u: number) => Wb * (0.92 + 0.3 * Math.sin(Math.min(1, u * 2.4) * Math.PI * 0.5) - 0.12 * u) * (1 - 0.6 * Math.pow(u, 2.8));
  const radAt = (u: number, wob: number) => R * (1 + 0.017 * Math.sin(u * 7.2 + 0.6) + 0.007 * Math.sin(u * 19 + wob));
  const [ir, ig, ib] = ink;
  x.lineCap = 'round';
  x.lineJoin = 'round';
  const w0 = widthAt(0);
  x.fillStyle = `rgba(${ir},${ig},${ib},0.92)`;
  x.beginPath();
  x.ellipse(C + Math.cos(a0) * R, C + Math.sin(a0) * R, w0 * 0.64, w0 * 0.5, a0 + 0.4, 0, TAU);
  x.fill();
  const NB = ENSO.b.length;
  for (const b of ENSO.b) {
    const uEnd = Math.min(b.end, prog);
    if (uEnd <= b.start) continue;
    const segs = Math.max(2, Math.ceil(110 * (uEnd - b.start)));
    x.beginPath();
    for (let i = 0; i <= segs; i++) {
      const u = b.start + (uEnd - b.start) * (i / segs), ang = a0 + sweep * u, w = widthAt(u), rr = radAt(u, b.wob) + b.lat * w;
      const px = C + Math.cos(ang) * rr, py = C + Math.sin(ang) * rr;
      if (i) x.lineTo(px, py); else x.moveTo(px, py);
    }
    x.strokeStyle = `rgba(${ir},${ig},${ib},${b.alpha})`;
    x.lineWidth = Math.max(1, (Wb / NB) * 2.6 * b.w);
    x.stroke();
  }
  x.globalCompositeOperation = 'destination-out';
  for (const s of ENSO.s) {
    if (s.u > prog) continue;
    const ang = a0 + sweep * s.u, w = widthAt(s.u), rr = radAt(s.u, 0) + s.lat * w * 0.9;
    x.globalAlpha = 0.25 + 0.6 * s.r * s.u;
    x.beginPath();
    x.ellipse(C + Math.cos(ang) * rr, C + Math.sin(ang) * rr, S * (0.008 + 0.024 * s.r * s.u), S * 0.0035, ang + Math.PI / 2, 0, TAU);
    x.fill();
  }
  x.globalCompositeOperation = 'source-over';
  x.globalAlpha = 1;
}
