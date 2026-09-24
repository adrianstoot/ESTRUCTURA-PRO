import { Plate } from '../entities/Plate.js';

const TYPES = [
  ['custom', 'Pieza personalizada'],
  ['beam-stiffener', 'Rigidizador de viga'],
  ['column-stiffener', 'Rigidizador de pilar'],
  ['gusset', 'Cartela de arriostramiento'],
  ['base-stiffener', 'Rigidizador de placa base'],
  ['connection-plate', 'Chapa de unión'],
];

const GRADES = ['S235JR', 'S275JR', 'S355JR', 'S355J2', 'S460M'];

function polygonArea(points) {
  let value = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    value += current.x * next.y - next.x * current.y;
  }
  return Math.abs(value) / 2;
}

function injectStyle() {
  if (document.getElementById('custom-part-editor-style')) return;
  const style = document.createElement('style');
  style.id = 'custom-part-editor-style';
  style.textContent = `
    .part-editor-overlay{z-index:1600;background:rgba(4,9,15,.82);backdrop-filter:blur(8px)}
    .part-editor{width:min(1120px,calc(100vw - 40px));height:min(760px,calc(100vh - 40px));display:grid;grid-template-rows:58px 1fr 54px;background:#18232c;border:1px solid #526676;box-shadow:0 28px 90px #000b;color:#dce6ed}
    .part-editor>header,.part-editor>footer{display:flex;align-items:center;justify-content:space-between;padding:0 18px;background:linear-gradient(#26343f,#1c2832);border-bottom:1px solid #465863}
    .part-editor>footer{border-top:1px solid #465863;border-bottom:0}
    .part-editor h2{font-size:15px;margin:1px 0 0;font-weight:600}.part-editor header span{font-size:9px;letter-spacing:1.7px;color:#77b9f4}
    .part-editor button{border:1px solid #526878;background:#263844;color:#e9f2f7;min-height:30px;padding:0 14px;cursor:pointer}.part-editor button:hover{background:#31506a;border-color:#5ca7e8}.part-editor [data-create]{background:#2877b9;border-color:#52a8ec;font-weight:600}
    .part-editor__body{min-height:0;display:grid;grid-template-columns:minmax(420px,1fr) 320px}
    .part-editor__drawing{position:relative;min-width:0;background:#dce4e8;padding:12px}
    .part-editor canvas{display:block;width:100%;height:100%;background:#eef3f5;box-shadow:inset 0 0 0 1px #7d919e;cursor:crosshair}
    .part-editor__hint{position:absolute;left:22px;bottom:20px;background:#12202de6;color:#dcecff;border:1px solid #547995;padding:7px 10px;font:10px/1.35 'Segoe UI',sans-serif;pointer-events:none}
    .part-editor__tools{overflow:auto;padding:15px;background:#1c2933;border-left:1px solid #52616d}
    .part-editor__tools h3{margin:14px 0 8px;font-size:10px;letter-spacing:1px;color:#8dbfe8;text-transform:uppercase}
    .part-editor__tools label{display:grid;grid-template-columns:1fr 128px;align-items:center;gap:10px;margin:7px 0;font-size:11px}
    .part-editor__tools input,.part-editor__tools select{width:100%;height:28px;box-sizing:border-box;background:#111c24;border:1px solid #415462;color:#eaf3f8;padding:0 7px}
    .part-editor__stats{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:13px}.part-editor__stat{padding:9px;background:#12202a;border:1px solid #344b5d}.part-editor__stat b{display:block;color:#fff;font:600 13px 'JetBrains Mono',monospace}.part-editor__stat span{font-size:9px;color:#89a1b2}
    .part-editor__toolbar{display:flex;gap:6px}.part-editor__status{font:10px 'JetBrains Mono',monospace;color:#9cb1be}
    @media(max-width:760px){.part-editor{width:100vw;height:100dvh}.part-editor__body{grid-template-columns:1fr;grid-template-rows:minmax(330px,55vh) auto}.part-editor__tools{border-left:0;border-top:1px solid #52616d}.part-editor>footer{gap:8px}.part-editor__status{display:none}}
  `;
  document.head.appendChild(style);
}

/**
 * Interactive 2D polygon editor for custom structural plates.
 * Coordinates are stored in metres and remain fully editable in project JSON.
 */
export class CustomPartEditor {
  constructor(sceneManager, options = {}) {
    this.sceneManager = sceneManager;
    this.onCreate = options.onCreate || (() => {});
    this.toast = options.toast || (() => {});
    injectStyle();
  }

  open() {
    document.querySelector('.part-editor-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay part-editor-overlay';
    overlay.innerHTML = `
      <section class="part-editor" role="dialog" aria-modal="true" aria-labelledby="part-editor-title">
        <header>
          <div><span>EDITOR PARAMÉTRICO 2D → 3D</span><h2 id="part-editor-title">Crear pieza avanzada</h2></div>
          <button type="button" data-close aria-label="Cerrar editor">×</button>
        </header>
        <div class="part-editor__body">
          <div class="part-editor__drawing">
            <canvas width="800" height="600" aria-label="Lienzo para dibujar el contorno de la pieza"></canvas>
            <div class="part-editor__hint">Clic: añadir vértice · Shift: ortogonal · Clic en el primer punto o Enter: cerrar</div>
          </div>
          <aside class="part-editor__tools">
            <h3>Clasificación BIM</h3>
            <label>Condición<select name="role">${TYPES.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
            <label>Nombre<input name="name" value="Rigidizador personalizado" maxlength="60"></label>
            <h3>Geometría y acabado</h3>
            <label>Espesor (mm)<input name="thickness" type="number" min="2" max="100" step="1" value="12"></label>
            <label>Snap (mm)<select name="snap"><option>5</option><option selected>10</option><option>25</option><option>50</option></select></label>
            <label>Bisel (mm)<input name="bevel" type="number" min="0" max="20" step="1" value="2"></label>
            <label>Radio esquinas (mm)<input name="radius" type="number" min="0" max="100" step="1" value="0"></label>
            <h3>Material</h3>
            <label>Acero<select name="grade">${GRADES.map((grade) => `<option>${grade}</option>`).join('')}</select></label>
            <label>Color<input name="color" type="color" value="#586672"></label>
            <div class="part-editor__stats">
              <div class="part-editor__stat"><b data-points>0</b><span>VÉRTICES</span></div>
              <div class="part-editor__stat"><b data-area>0 cm²</b><span>ÁREA</span></div>
              <div class="part-editor__stat"><b data-width>0 mm</b><span>ANCHO</span></div>
              <div class="part-editor__stat"><b data-height>0 mm</b><span>ALTO</span></div>
            </div>
          </aside>
        </div>
        <footer>
          <div class="part-editor__toolbar">
            <button type="button" data-undo>Deshacer punto</button>
            <button type="button" data-clear>Limpiar</button>
            <button type="button" data-template>Cartela inicial</button>
          </div>
          <span class="part-editor__status" data-status>Dibuje al menos 3 vértices.</span>
          <div><button type="button" data-close>Cancelar</button><button type="button" data-create disabled>Crear pieza 3D</button></div>
        </footer>
      </section>`;
    document.body.appendChild(overlay);
    this._wire(overlay);
  }

  _wire(overlay) {
    const canvas = overlay.querySelector('canvas');
    const context = canvas.getContext('2d');
    const points = [];
    let closed = false;
    const extentMm = { width: 800, height: 600 };

    const read = (name) => overlay.querySelector(`[name="${name}"]`);
    const toCanvas = (point) => ({
      x: (point.x / extentMm.width) * canvas.width + canvas.width / 2,
      y: canvas.height / 2 - (point.y / extentMm.height) * canvas.height,
    });
    const fromCanvas = (x, y, event) => {
      const rect = canvas.getBoundingClientRect();
      let px = ((x - rect.left) / rect.width - 0.5) * extentMm.width;
      let py = (0.5 - (y - rect.top) / rect.height) * extentMm.height;
      const snap = Math.max(1, Number(read('snap').value) || 10);
      px = Math.round(px / snap) * snap;
      py = Math.round(py / snap) * snap;
      if (event?.shiftKey && points.length) {
        const previous = points.at(-1);
        if (Math.abs(px - previous.x) >= Math.abs(py - previous.y)) py = previous.y;
        else px = previous.x;
      }
      return { x: px, y: py };
    };

    const bounds = () => {
      if (!points.length) return { width: 0, height: 0, minX: 0, minY: 0 };
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return { minX, minY, width: maxX - minX, height: maxY - minY };
    };

    const draw = (pointer = null) => {
      const width = canvas.width;
      const height = canvas.height;
      context.clearRect(0, 0, width, height);
      context.fillStyle = '#edf2f4';
      context.fillRect(0, 0, width, height);
      const snap = Math.max(5, Number(read('snap').value) || 10);
      const stepX = (snap / extentMm.width) * width;
      const stepY = (snap / extentMm.height) * height;
      context.lineWidth = 1;
      for (let x = width / 2 % stepX; x < width; x += stepX) {
        context.strokeStyle = Math.abs(x - width / 2) < 1 ? '#8ca0ad' : '#d5dfe4';
        context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
      }
      for (let y = height / 2 % stepY; y < height; y += stepY) {
        context.strokeStyle = Math.abs(y - height / 2) < 1 ? '#8ca0ad' : '#d5dfe4';
        context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
      }
      if (points.length) {
        context.beginPath();
        const first = toCanvas(points[0]);
        context.moveTo(first.x, first.y);
        points.slice(1).forEach((point) => {
          const converted = toCanvas(point);
          context.lineTo(converted.x, converted.y);
        });
        if (closed) context.closePath();
        else if (pointer) context.lineTo(pointer.x, pointer.y);
        context.fillStyle = closed ? 'rgba(50,116,165,.28)' : 'rgba(50,116,165,.12)';
        context.fill();
        context.strokeStyle = '#176ea9';
        context.lineWidth = 3;
        context.stroke();
        points.forEach((point, index) => {
          const converted = toCanvas(point);
          context.beginPath();
          context.arc(converted.x, converted.y, index === 0 ? 7 : 5, 0, Math.PI * 2);
          context.fillStyle = index === 0 ? '#ff9f2e' : '#f7fbff';
          context.fill();
          context.strokeStyle = '#185a86';
          context.lineWidth = 2;
          context.stroke();
        });
      }
      const box = bounds();
      overlay.querySelector('[data-points]').textContent = points.length;
      overlay.querySelector('[data-width]').textContent = `${box.width.toFixed(0)} mm`;
      overlay.querySelector('[data-height]').textContent = `${box.height.toFixed(0)} mm`;
      overlay.querySelector('[data-area]').textContent = `${(polygonArea(points) / 100).toFixed(1)} cm²`;
      overlay.querySelector('[data-create]').disabled = !(closed && points.length >= 3 && polygonArea(points) > 10);
      overlay.querySelector('[data-status]').textContent = closed
        ? 'Contorno cerrado. Revise dimensiones y cree la pieza.'
        : `${points.length} vértices · cierre sobre el punto naranja o pulse Enter.`;
    };

    const closePolygon = () => {
      if (points.length >= 3) {
        closed = true;
        draw();
      }
    };

    canvas.addEventListener('pointermove', (event) => {
      if (closed || !points.length) return;
      const raw = fromCanvas(event.clientX, event.clientY, event);
      draw(toCanvas(raw));
    });
    canvas.addEventListener('pointerleave', () => draw());
    canvas.addEventListener('click', (event) => {
      if (closed) return;
      const point = fromCanvas(event.clientX, event.clientY, event);
      if (points.length >= 3) {
        const first = points[0];
        const snap = Math.max(5, Number(read('snap').value) || 10);
        if (Math.hypot(point.x - first.x, point.y - first.y) <= snap * 1.5) {
          closePolygon();
          return;
        }
      }
      points.push(point);
      draw();
    });
    canvas.addEventListener('dblclick', (event) => {
      event.preventDefault();
      closePolygon();
    });
    read('snap').addEventListener('change', () => draw());
    overlay.querySelector('[data-undo]').addEventListener('click', () => {
      if (closed) closed = false;
      else points.pop();
      draw();
    });
    overlay.querySelector('[data-clear]').addEventListener('click', () => {
      points.length = 0;
      closed = false;
      draw();
    });
    overlay.querySelector('[data-template]').addEventListener('click', () => {
      points.splice(0, points.length,
        { x: -200, y: -150 }, { x: 200, y: -150 },
        { x: 200, y: -65 }, { x: 35, y: 150 },
        { x: -35, y: 150 }, { x: -200, y: -65 });
      closed = true;
      draw();
    });

    const close = () => overlay.remove();
    overlay.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', close));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
      if (event.key === 'Enter' && !event.target.matches('input,select,button')) closePolygon();
    });
    overlay.querySelector('[data-create]').addEventListener('click', () => {
      if (!closed || points.length < 3) return;
      const box = bounds();
      const centered = points.map((point) => ({
        x: (point.x - box.minX - box.width / 2) / 1000,
        y: (point.y - box.minY - box.height / 2) / 1000,
      }));
      const thickness = Math.max(0.002, Number(read('thickness').value) / 1000);
      const plate = new Plate('gusset-custom', Math.max(0.01, box.width / 1000), Math.max(0.01, box.height / 1000), thickness);
      plate.update({
        points: centered,
        role: read('role').value,
        customName: read('name').value.trim() || 'Pieza personalizada',
        materialStandard: 'Código Estructural · EN 10025-2',
        edgeBevel: Math.max(0, Number(read('bevel').value) / 1000),
        cornerRadius: Math.max(0, Number(read('radius').value) / 1000),
      });
      plate.designation = read('name').value.trim() || plate.designation;
      plate.steelGrade = read('grade').value;
      plate.setColor(read('color').value);
      plate._applyUserData?.();
      this.sceneManager.addObject(plate);
      this.onCreate(plate);
      this.toast(`Pieza creada · ${box.width.toFixed(0)}×${box.height.toFixed(0)}×${(thickness * 1000).toFixed(0)} mm`);
      close();
    });
    draw();
  }
}
