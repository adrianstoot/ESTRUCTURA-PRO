/**
 * SectionDrawer v4.0 — Technical 2D cross-section diagrams
 *   · Background grid (10 mm) + frame + ISO axes (y-y teal / z-z magenta)
 *   · External & internal dimension lines (h, b, tw, tf, r, Ø)
 *   · CDG marker with crosshair
 *   · Theme-aware palette (dark / light)
 *   · Legend row with dominant ratios at the bottom
 */
export class SectionDrawer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this._light = false;
  }

  setTheme(light) { this._light = !!light; }

  _palette() {
    return this._light
      ? { bg:'#ffffff', grid:'rgba(80,90,120,0.10)', frame:'rgba(80,90,120,0.25)',
          fill:'rgba(61,111,255,0.14)', stroke:'#3d6fff',
          dim:'rgba(170,130,0,0.85)', dimLine:'rgba(170,130,0,0.35)',
          axisY:'rgba(15,140,130,0.9)', axisZ:'rgba(180,60,170,0.9)',
          cdg:'#c0383b', label:'#1f2636', legend:'rgba(20,30,60,0.6)' }
      : { bg:'#12151e', grid:'rgba(255,255,255,0.05)', frame:'rgba(255,255,255,0.12)',
          fill:'rgba(79,127,255,0.16)', stroke:'#6b93ff',
          dim:'#facc15', dimLine:'rgba(250,204,21,0.35)',
          axisY:'rgba(45,212,191,0.9)', axisZ:'rgba(232,121,249,0.9)',
          cdg:'#ff7070', label:'#9aa0bc', legend:'rgba(190,200,220,0.8)' };
  }

  clear() {
    if (!this.canvas) return;

    // Reassigning the backing-store dimensions clears every pixel and resets
    // the complete 2D state (transform, clip, dash, alpha and compositing).
    // This prevents dimensions from a previous profile leaking into the next.
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) return;

    const ctx = this.ctx;
    const p = this._palette();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, w, h);
    this._drawGrid(p);
    ctx.strokeStyle = p.frame;
    ctx.lineWidth = 1;
    ctx.strokeRect(4, 4, w - 8, h - 8);
  }

  _drawGrid(p) {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    ctx.strokeStyle = p.grid;
    ctx.lineWidth = 1;
    const step = 12;
    ctx.beginPath();
    for (let x = step; x < w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = step; y < h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
  }

  draw(bimElement) {
    this.clear();
    if (!bimElement || !this.ctx) return;

    const { type, params } = bimElement;
    if (type === 'profile') {
      const series = params.series;
      if (['IPE', 'HEB', 'HEA', 'IPN'].includes(series))      this._drawISection(bimElement);
      else if (series === 'UPN')                              this._drawChannel(bimElement);
      else if (series === 'L')                                this._drawAngle(bimElement);
      else if (series === 'CHS')                              this._drawCHS(bimElement);
      else if (series === 'SHS')                              this._drawSHS(bimElement);
    } else if (type === 'plate')    this._drawPlate(bimElement);
    else if (type === 'fastener')   this._drawFastener(bimElement);
    else if (type === 'weld')       this._drawWeld(bimElement);

    this._drawLegend(bimElement);
  }

  // ─── I-SECTION / HEB / HEA / IPN ───────────────────────────────
  _drawISection(el) {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    const eng = el.engineeringData;
    if (!eng) return;
    const p = this._palette();

    const hMM = eng.h, bMM = eng.b, twMM = eng.tw, tfMM = eng.tf, rMM = eng.r || 0;

    // Leave room for dimension lines
    const margin = { l:50, r:48, t:32, b:52 };
    const scale = Math.min((w - margin.l - margin.r) / bMM, (h - margin.t - margin.b) / hMM);
    const cx = w / 2, cy = h / 2 - 2;
    const H = hMM * scale, B = bMM * scale, TW = twMM * scale, TF = tfMM * scale, R = rMM * scale;

    ctx.fillStyle = p.fill;
    ctx.strokeStyle = p.stroke;
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(cx - B/2, cy - H/2);
    ctx.lineTo(cx + B/2, cy - H/2);
    ctx.lineTo(cx + B/2, cy - H/2 + TF);
    if (R > 0) {
      ctx.lineTo(cx + TW/2 + R, cy - H/2 + TF);
      ctx.arcTo(cx + TW/2, cy - H/2 + TF, cx + TW/2, cy - H/2 + TF + R, R);
      ctx.lineTo(cx + TW/2, cy + H/2 - TF - R);
      ctx.arcTo(cx + TW/2, cy + H/2 - TF, cx + TW/2 + R, cy + H/2 - TF, R);
    } else {
      ctx.lineTo(cx + TW/2, cy - H/2 + TF);
      ctx.lineTo(cx + TW/2, cy + H/2 - TF);
    }
    ctx.lineTo(cx + B/2, cy + H/2 - TF);
    ctx.lineTo(cx + B/2, cy + H/2);
    ctx.lineTo(cx - B/2, cy + H/2);
    ctx.lineTo(cx - B/2, cy + H/2 - TF);
    if (R > 0) {
      ctx.lineTo(cx - TW/2 - R, cy + H/2 - TF);
      ctx.arcTo(cx - TW/2, cy + H/2 - TF, cx - TW/2, cy + H/2 - TF - R, R);
      ctx.lineTo(cx - TW/2, cy - H/2 + TF + R);
      ctx.arcTo(cx - TW/2, cy - H/2 + TF, cx - TW/2 - R, cy - H/2 + TF, R);
    } else {
      ctx.lineTo(cx - TW/2, cy + H/2 - TF);
      ctx.lineTo(cx - TW/2, cy - H/2 + TF);
    }
    ctx.lineTo(cx - B/2, cy - H/2 + TF);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    this._drawAxes(cx, cy, H, B, p);
    this._drawCDG(cx, cy, p);

    // External dims
    this._dimV(cx + B/2 + 22, cy - H/2, cy + H/2, `h=${hMM}`, p);
    this._dimH(cx - B/2, cx + B/2, cy + H/2 + 22, `b=${bMM}`, p);

    // Internal dims — tw centered on flange, tf outside left, r callout
    this._dimH(cx - TW/2, cx + TW/2, cy - H/2 - 12, `tw=${twMM}`, p, true);
    this._dimV(cx - B/2 - 22, cy - H/2, cy - H/2 + TF, `tf=${tfMM}`, p);
    if (R > 0) {
      ctx.fillStyle = p.dim;
      ctx.font = '500 8.5px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`r=${rMM}`, cx + TW/2 + R + 6, cy - H/2 + TF + R + 2);
    }
    this._drawLabel(`${el.designation}`, p);
  }

  _drawChannel(el) {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    const eng = el.engineeringData;
    if (!eng) return;
    const p = this._palette();

    const hMM = eng.h, bMM = eng.b, twMM = eng.tw, tfMM = eng.tf, rMM = eng.r || 0;
    const margin = { l:50, r:48, t:32, b:52 };
    const scale = Math.min((w - margin.l - margin.r) / bMM, (h - margin.t - margin.b) / hMM);
    const eyMM = eng.ey || (bMM * 0.3);
    const cx = w / 2, cy = h / 2 - 2;
    const H = hMM * scale, B = bMM * scale, TW = twMM * scale, TF = tfMM * scale, R = rMM * scale;

    ctx.fillStyle = p.fill;
    ctx.strokeStyle = p.stroke;
    ctx.lineWidth = 1.5;

    const leftX = cx - B/2, rightX = cx + B/2;
    ctx.beginPath();
    ctx.moveTo(leftX, cy - H/2);
    ctx.lineTo(rightX, cy - H/2);
    ctx.lineTo(rightX, cy - H/2 + TF);
    if (R > 0) {
      ctx.lineTo(leftX + TW + R, cy - H/2 + TF);
      ctx.arcTo(leftX + TW, cy - H/2 + TF, leftX + TW, cy - H/2 + TF + R, R);
      ctx.lineTo(leftX + TW, cy + H/2 - TF - R);
      ctx.arcTo(leftX + TW, cy + H/2 - TF, leftX + TW + R, cy + H/2 - TF, R);
    } else {
      ctx.lineTo(leftX + TW, cy - H/2 + TF);
      ctx.lineTo(leftX + TW, cy + H/2 - TF);
    }
    ctx.lineTo(rightX, cy + H/2 - TF);
    ctx.lineTo(rightX, cy + H/2);
    ctx.lineTo(leftX, cy + H/2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const centroidX = leftX + (eyMM * scale);
    this._drawAxes(centroidX, cy, H, B, p);
    this._drawCDG(centroidX, cy, p);

    this._dimV(cx + B/2 + 22, cy - H/2, cy + H/2, `h=${hMM}`, p);
    this._dimH(cx - B/2, cx + B/2, cy + H/2 + 22, `b=${bMM}`, p);
    this._dimV(cx - B/2 - 22, cy - H/2, cy - H/2 + TF, `tf=${tfMM}`, p);
    this._drawLabel(`${el.designation}`, p);
  }

  _drawAngle(el) {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    const eng = el.engineeringData;
    if (!eng) return;
    const p = this._palette();

    const aMM = eng.h, bMM = eng.b || eng.h, tMM = eng.tw;
    const margin = { l:50, r:48, t:32, b:52 };
    const scale = Math.min((w - margin.l - margin.r) / bMM, (h - margin.t - margin.b) / aMM);
    const cx = w / 2, cy = h / 2 - 2;
    const A = aMM * scale, B = bMM * scale, T = Math.max(tMM * scale, 2);

    ctx.fillStyle = p.fill;
    ctx.strokeStyle = p.stroke;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - B/2, cy + A/2);
    ctx.lineTo(cx + B/2, cy + A/2);
    ctx.lineTo(cx + B/2, cy + A/2 - T);
    ctx.lineTo(cx - B/2 + T, cy + A/2 - T);
    ctx.lineTo(cx - B/2 + T, cy - A/2);
    ctx.lineTo(cx - B/2, cy - A/2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    this._drawAxes(cx, cy, A, B, p);
    this._drawCDG(cx, cy, p);
    this._dimV(cx + B/2 + 22, cy - A/2, cy + A/2, `a=${aMM}`, p);
    this._dimH(cx - B/2, cx + B/2, cy + A/2 + 22, `b=${bMM}`, p);
    this._dimV(cx - B/2 - 22, cy + A/2 - T, cy + A/2, `t=${tMM}`, p);
    this._drawLabel(`${el.designation}`, p);
  }

  _drawCHS(el) {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    const eng = el.engineeringData;
    if (!eng) return;
    const p = this._palette();

    const dMM = eng.h, tMM = eng.tw;
    const margin = { l:50, r:48, t:32, b:52 };
    const scale = Math.min((w - margin.l - margin.r) / dMM, (h - margin.t - margin.b) / dMM);
    const cx = w / 2, cy = h / 2 - 2;
    const R = dMM / 2 * scale;
    const Ri = (dMM / 2 - tMM) * scale;

    ctx.fillStyle = p.fill;
    ctx.strokeStyle = p.stroke;
    ctx.lineWidth = 1.5;

    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, Ri, 0, Math.PI * 2);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, Ri, 0, Math.PI * 2); ctx.stroke();

    this._drawAxes(cx, cy, R*2, R*2, p);
    this._drawCDG(cx, cy, p);
    this._dimH(cx - R, cx + R, cy + R + 22, `Ø=${dMM}`, p);
    // Thickness callout on top
    ctx.fillStyle = p.dim;
    ctx.font = '500 8.5px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`t=${tMM}`, cx + R + 6, cy - R + 8);
    this._drawLabel(`${el.designation}`, p);
  }

  _drawSHS(el) {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    const eng = el.engineeringData;
    if (!eng) return;
    const p = this._palette();

    const hMM = eng.h, bMM = eng.b, tMM = eng.tw;
    const margin = { l:50, r:48, t:32, b:52 };
    const scale = Math.min((w - margin.l - margin.r) / bMM, (h - margin.t - margin.b) / hMM);
    const cx = w / 2, cy = h / 2 - 2;
    const H = hMM * scale, B = bMM * scale, T = Math.max(tMM * scale, 2);

    ctx.fillStyle = p.fill;
    ctx.strokeStyle = p.stroke;
    ctx.lineWidth = 1.5;

    ctx.beginPath(); ctx.rect(cx - B/2, cy - H/2, B, H); ctx.fill(); ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.rect(cx - B/2 + T, cy - H/2 + T, B - 2*T, H - 2*T);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fill();
    ctx.restore();
    ctx.strokeRect(cx - B/2 + T, cy - H/2 + T, B - 2*T, H - 2*T);

    this._drawAxes(cx, cy, H, B, p);
    this._drawCDG(cx, cy, p);
    this._dimV(cx + B/2 + 22, cy - H/2, cy + H/2, `h=${hMM}`, p);
    this._dimH(cx - B/2, cx + B/2, cy + H/2 + 22, `b=${bMM}`, p);
    this._dimV(cx - B/2 - 22, cy - H/2, cy - H/2 + T, `t=${tMM}`, p);
    this._drawLabel(`${el.designation}`, p);
  }

  _drawPlate(el) {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    const p = this._palette();
    const wMM = (el.params.width || 0.3) * 1000;
    const hMM = (el.params.height || 0.3) * 1000;
    const tMM = (el.params.thickness || 0.01) * 1000;

    const margin = { l:50, r:48, t:32, b:52 };
    const scale = Math.min((w - margin.l - margin.r) / wMM, (h - margin.t - margin.b) / hMM);
    const cx = w / 2, cy = h / 2 - 2;
    const W = wMM * scale, H = hMM * scale;

    ctx.fillStyle = 'rgba(34,197,94,0.18)';
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.5;
    ctx.fillRect(cx - W/2, cy - H/2, W, H);
    ctx.strokeRect(cx - W/2, cy - H/2, W, H);

    this._drawAxes(cx, cy, H, W, p);
    this._drawCDG(cx, cy, p);
    this._dimV(cx + W/2 + 22, cy - H/2, cy + H/2, `H=${hMM}`, p);
    this._dimH(cx - W/2, cx + W/2, cy + H/2 + 22, `W=${wMM}`, p);
    ctx.fillStyle = p.dim;
    ctx.font = '500 8.5px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`t=${tMM.toFixed(0)}`, cx + W/2 + 6, cy - H/2 - 6);
    this._drawLabel(el.designation || 'Placa', p);
  }

  _drawFastener(el) {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    const p = this._palette();
    const cx = w / 2, cy = h / 2 - 10;

    const metric = parseInt(String(el.params.metric || 'M16').replace(/\D/g,'')) || 16;
    const shaftW = Math.max(6, metric * 0.6);
    const headW  = shaftW * 1.7;
    const headH  = shaftW * 0.8;
    const shankL = 60;

    ctx.fillStyle = 'rgba(234,179,8,0.18)';
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 1.5;

    // Head (hex outline)
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const x = cx + (headW/2) * Math.cos(a);
      const y = cy - shankL/2 - headH/2 + (headH/2) * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // Shank
    ctx.fillRect(cx - shaftW/2, cy - shankL/2, shaftW, shankL);
    ctx.strokeRect(cx - shaftW/2, cy - shankL/2, shaftW, shankL);

    // Threaded end lines
    ctx.strokeStyle = 'rgba(234,179,8,0.45)';
    for (let y = cy + shankL/2 - 14; y < cy + shankL/2 - 2; y += 3) {
      ctx.beginPath(); ctx.moveTo(cx - shaftW/2, y); ctx.lineTo(cx + shaftW/2, y); ctx.stroke();
    }

    // Washer + nut
    ctx.strokeStyle = '#eab308';
    ctx.strokeRect(cx - headW/2 + 2, cy + shankL/2, headW - 4, 4);
    ctx.strokeRect(cx - headW/2 + 4, cy + shankL/2 + 5, headW - 8, headH - 2);

    // Dim
    this._dimV(cx + headW/2 + 16, cy - shankL/2, cy + shankL/2, `L≈${shankL}mm`, p);
    ctx.fillStyle = p.dim;
    ctx.font = '500 9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Ø=${metric}`, cx, cy - shankL/2 - headH - 8);

    this._drawLabel(el.designation || el.params.metric || 'Fastener', p);
  }

  _drawWeld(el) {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    const p = this._palette();
    const cx = w / 2, cy = h / 2;

    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    const zigzag = [0, 10, -10, 10, -10, 10, 0];
    zigzag.forEach((dy, i) => {
      const x = cx - 30 + i * 10;
      const y = cy + dy;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    this._drawLabel('Cordón de soldadura', p);
  }

  // ─── HELPERS ───────────────────────────────────────────────────
  _drawAxes(cx, cy, H, B, p) {
    const ctx = this.ctx;

    ctx.save();
    ctx.strokeStyle = p.axisZ;
    ctx.setLineDash([8, 4, 2, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - B/2 - 16, cy);
    ctx.lineTo(cx + B/2 + 16, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = p.axisZ;
    ctx.font = '700 9px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('z', cx + B/2 + 18, cy + 3);
    ctx.textAlign = 'right';
    ctx.fillText('z', cx - B/2 - 18, cy + 3);

    ctx.strokeStyle = p.axisY;
    ctx.setLineDash([8, 4, 2, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, cy - H/2 - 16);
    ctx.lineTo(cx, cy + H/2 + 16);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = p.axisY;
    ctx.textAlign = 'center';
    ctx.fillText('y', cx, cy - H/2 - 18);
    ctx.fillText('y', cx, cy + H/2 + 24);
    ctx.restore();
  }

  _drawCDG(cx, cy, p) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = p.cdg;
    ctx.lineWidth = 1.2;
    const s = 5;
    ctx.beginPath(); ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - s); ctx.lineTo(cx, cy + s); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = p.cdg;
    ctx.font = '500 8px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('CDG', cx + 6, cy - 5);
    ctx.restore();
  }

  _dimV(x, y1, y2, label, p, _invert = false) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = p.dimLine;
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
    // Extension ticks
    ctx.strokeStyle = p.dim;
    ctx.beginPath();
    ctx.moveTo(x - 3, y1); ctx.lineTo(x + 3, y1);
    ctx.moveTo(x - 3, y2); ctx.lineTo(x + 3, y2);
    ctx.stroke();
    // Arrows
    const a = 3;
    ctx.beginPath(); ctx.moveTo(x - a, y1 + a); ctx.lineTo(x, y1); ctx.lineTo(x + a, y1 + a); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - a, y2 - a); ctx.lineTo(x, y2); ctx.lineTo(x + a, y2 - a); ctx.stroke();
    // Rotated text
    ctx.translate(x + 10, (y1 + y2) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = p.dim;
    ctx.font = '600 8.5px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  _dimH(x1, x2, y, label, p, above = false) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = p.dimLine;
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
    ctx.strokeStyle = p.dim;
    ctx.beginPath();
    ctx.moveTo(x1, y - 3); ctx.lineTo(x1, y + 3);
    ctx.moveTo(x2, y - 3); ctx.lineTo(x2, y + 3);
    ctx.stroke();
    const a = 3;
    ctx.beginPath(); ctx.moveTo(x1 + a, y - a); ctx.lineTo(x1, y); ctx.lineTo(x1 + a, y + a); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2 - a, y - a); ctx.lineTo(x2, y); ctx.lineTo(x2 - a, y + a); ctx.stroke();
    ctx.fillStyle = p.dim;
    ctx.font = '600 8.5px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, (x1 + x2) / 2, y + (above ? -5 : 11));
    ctx.restore();
  }

  _drawLabel(text, p) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    ctx.fillStyle = p.stroke;
    ctx.font = '700 10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, w / 2, 18);
  }

  _drawLegend(el) {
    if (!el?.engineeringData) return;
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    const p = this._palette();
    const eng = el.engineeringData;

    const pieces = [];
    if (eng.area) pieces.push(`A ${eng.area.toFixed(1)} cm²`);
    if (eng.Iy)   pieces.push(`Iy ${eng.Iy.toFixed(0)} cm⁴`);
    if (eng.Iz)   pieces.push(`Iz ${eng.Iz.toFixed(0)} cm⁴`);
    if (eng.sectionClass) pieces.push(`Clase ${eng.sectionClass}`);

    if (!pieces.length) return;
    ctx.fillStyle = p.legend;
    ctx.font = '500 8.5px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(pieces.join('  ·  '), w / 2, h - 8);
  }
}
