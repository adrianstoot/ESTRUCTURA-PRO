import * as THREE from 'three';
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
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

function orient(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentsIntersect(a, b, c, d) {
  const epsilon = 1e-7;
  const abC = orient(a, b, c);
  const abD = orient(a, b, d);
  const cdA = orient(c, d, a);
  const cdB = orient(c, d, b);
  if (abC * abD < -epsilon && cdA * cdB < -epsilon) return true;
  const onSegment = (start, end, point) => point.x >= Math.min(start.x, end.x) - epsilon
    && point.x <= Math.max(start.x, end.x) + epsilon
    && point.y >= Math.min(start.y, end.y) - epsilon
    && point.y <= Math.max(start.y, end.y) + epsilon;
  return (Math.abs(abC) <= epsilon && onSegment(a, b, c))
    || (Math.abs(abD) <= epsilon && onSegment(a, b, d))
    || (Math.abs(cdA) <= epsilon && onSegment(c, d, a))
    || (Math.abs(cdB) <= epsilon && onSegment(c, d, b));
}

function polygonIsSimple(points) {
  if (points.length < 3) return false;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (Math.hypot(a.x - b.x, a.y - b.y) < 0.5) return false;
    for (let j = i + 1; j < points.length; j += 1) {
      const adjacent = j === i || j === (i + 1) % points.length || (j + 1) % points.length === i;
      if (adjacent) continue;
      if (segmentsIntersect(a, b, points[j], points[(j + 1) % points.length])) return false;
    }
  }
  return polygonArea(points) >= 1;
}

function injectStyle() {
  if (document.getElementById('custom-part-editor-style')) return;
  const style = document.createElement('style');
  style.id = 'custom-part-editor-style';
  style.textContent = `
    .part-editor-overlay{z-index:1600;background:rgba(4,9,15,.82);backdrop-filter:blur(8px)}
    .part-editor{width:min(1320px,calc(100vw - 40px));height:min(820px,calc(100vh - 40px));display:grid;grid-template-rows:58px 1fr 54px;background:#18232c;border:1px solid #526676;box-shadow:0 28px 90px #000b;color:#dce6ed}
    .part-editor>header,.part-editor>footer{display:flex;align-items:center;justify-content:space-between;padding:0 18px;background:linear-gradient(#26343f,#1c2832);border-bottom:1px solid #465863}
    .part-editor>footer{border-top:1px solid #465863;border-bottom:0}
    .part-editor h2{font-size:15px;margin:1px 0 0;font-weight:600}.part-editor header span{font-size:9px;letter-spacing:1.7px;color:#77b9f4}
    .part-editor button{border:1px solid #526878;background:#263844;color:#e9f2f7;min-height:30px;padding:0 14px;cursor:pointer}.part-editor button:hover{background:#31506a;border-color:#5ca7e8}.part-editor [data-create]{background:#2877b9;border-color:#52a8ec;font-weight:600}.part-editor [data-create]:disabled{opacity:.48;cursor:not-allowed}
    .part-editor__body{min-height:0;display:grid;grid-template-columns:minmax(420px,1fr) 320px}
    .part-editor__drawing{position:relative;min-width:0;min-height:0;display:grid;place-items:center;overflow:hidden;background:#dce4e8;padding:12px}
    .part-editor canvas{display:block;width:100%;height:100%;background:#eef3f5;box-shadow:inset 0 0 0 1px #7d919e;cursor:crosshair;touch-action:none}
    .part-editor__hint{position:absolute;left:22px;bottom:20px;max-width:calc(100% - 44px);background:#12202de6;color:#dcecff;border:1px solid #547995;padding:7px 10px;font:10px/1.35 'Segoe UI',sans-serif;pointer-events:none}
    .part-editor__viewtools{position:absolute;right:22px;top:20px;display:flex;gap:4px;z-index:1}.part-editor__viewtools button{min-width:32px;padding:0 8px;background:#12202de6;border-color:#547995;font-size:11px}
    .part-editor__tools{overflow:auto;padding:15px;background:#1c2933;border-left:1px solid #52616d}
    .part-editor__tools h3{margin:14px 0 8px;font-size:10px;letter-spacing:1px;color:#8dbfe8;text-transform:uppercase}
    .part-editor__tools label{display:grid;grid-template-columns:1fr 128px;align-items:center;gap:10px;margin:7px 0;font-size:11px}
    .part-editor__tools input,.part-editor__tools select{width:100%;height:28px;box-sizing:border-box;background:#111c24;border:1px solid #415462;color:#eaf3f8;padding:0 7px}
    .part-editor__plane{padding:9px 10px;border:1px solid #385469;background:#12202a;color:#c9d9e2;font-size:10px;line-height:1.45}
    .part-editor__stats{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:13px}.part-editor__stat{padding:9px;background:#12202a;border:1px solid #344b5d}.part-editor__stat b{display:block;color:#fff;font:600 13px 'JetBrains Mono',monospace}.part-editor__stat span{font-size:9px;color:#89a1b2}
    .part-editor__toolbar{display:flex;gap:6px}.part-editor__status{font:10px 'JetBrains Mono',monospace;color:#9cb1be}
    @media(max-width:760px){.part-editor{width:100vw;height:100dvh}.part-editor__body{grid-template-columns:1fr;grid-template-rows:minmax(330px,55vh) auto}.part-editor__tools{border-left:0;border-top:1px solid #52616d}.part-editor>footer{gap:8px}.part-editor__status{display:none}}
  `;
  document.head.appendChild(style);
}

/** Draws millimetre-accurate plate outlines directly over the current orthographic model view. */
export class CustomPartEditor {
  constructor(sceneManager, options = {}) {
    this.sceneManager = sceneManager;
    this.onCreate = options.onCreate || (() => {});
    this.toast = options.toast || (() => {});
    injectStyle();
  }

  open(selected = null) {
    document.querySelector('.part-editor-overlay')?.remove();
    this.sceneManager.useOrthographicProjection?.();
    if (selected) this.sceneManager.focusOnObject?.(selected);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay part-editor-overlay';
    overlay.innerHTML = `
      <section class="part-editor" role="dialog" aria-modal="true" aria-labelledby="part-editor-title">
        <header>
          <div><span>PLANO DE TRABAJO ORTOGRÁFICO · DIBUJO 2D → PIEZA 3D</span><h2 id="part-editor-title">Pieza libre · cartela o rigidizador</h2></div>
          <button type="button" data-close aria-label="Cerrar editor">×</button>
        </header>
        <div class="part-editor__body">
          <div class="part-editor__drawing">
            <canvas width="1200" height="800" aria-label="Dibujar el contorno de una pieza sobre la vista ortográfica del modelo"></canvas>
            <div class="part-editor__viewtools" aria-label="Navegación del plano"><button type="button" data-zoom-out title="Alejar">−</button><button type="button" data-zoom-in title="Acercar">+</button><button type="button" data-fit title="Encuadrar la pieza seleccionada">Encuadrar</button></div>
            <div class="part-editor__hint">Clic: vértice · Shift: ortogonal · Doble clic o Enter: cerrar · Backspace: deshacer · Esc: salir · Captura a geometría visible y rejilla en mm</div>
          </div>
          <aside class="part-editor__tools">
            <h3>Plano de trabajo</h3>
            <div class="part-editor__plane" data-plane></div>
            <h3>Clasificación BIM</h3>
            <label>Condición<select name="role">${TYPES.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
            <label>Nombre<input name="name" value="Rigidizador personalizado" maxlength="60"></label>
            <h3>Geometría y acabado</h3>
            <label>Espesor (mm)<input name="thickness" type="number" min="1" max="200" step="1" value="12"></label>
            <label>Desfase del plano (mm)<input name="planeOffset" type="number" step="1" value="0"></label>
            <label>Snap (mm)<select name="snap"><option>1</option><option>2</option><option selected>5</option><option>10</option><option>25</option><option>50</option></select></label>
            <label>Bisel (mm)<input name="bevel" type="number" min="0" max="20" step="0.5" value="0"></label>
            <label>Radio esquinas (mm)<input name="radius" type="number" min="0" max="100" step="1" value="0"></label>
            <h3>Material</h3>
            <label>Acero<select name="grade">${GRADES.map((grade) => `<option>${grade}</option>`).join('')}</select></label>
            <label>Color<input name="color" type="color" value="#586672"></label>
            <div class="part-editor__stats">
              <div class="part-editor__stat"><b data-points>0</b><span>VÉRTICES</span></div>
              <div class="part-editor__stat"><b data-area>0 mm²</b><span>ÁREA</span></div>
              <div class="part-editor__stat"><b data-width>0 mm</b><span>ANCHO</span></div>
              <div class="part-editor__stat"><b data-height>0 mm</b><span>ALTO</span></div>
              <div class="part-editor__stat"><b data-cursor>—</b><span>COORDENADA U / V</span></div>
              <div class="part-editor__stat"><b data-snap>REJILLA</b><span>REFERENCIA DE CAPTURA</span></div>
            </div>
          </aside>
        </div>
        <footer>
          <div class="part-editor__toolbar">
            <button type="button" data-undo>Deshacer punto</button>
            <button type="button" data-clear>Limpiar</button>
            <button type="button" data-template>Cartela inicial</button>
          </div>
          <span class="part-editor__status" data-status>Dibuje sobre el plano del modelo.</span>
          <div><button type="button" data-close>Cancelar</button><button type="button" data-create disabled>Crear pieza 3D</button></div>
        </footer>
      </section>`;
    document.body.appendChild(overlay);
    overlay.tabIndex = -1;
    this._wire(overlay, selected);
  }

  _wire(overlay, selected) {
    const canvas = overlay.querySelector('canvas');
    const context = canvas.getContext('2d');
    const points = [];
    let closed = false;
    let pointer = null;
    const scene = this.sceneManager;
    const rendererCanvas = scene.renderer.domElement;
    const camera = scene.camera;
    const raycaster = new THREE.Raycaster();
    const planeOrigin = new THREE.Vector3();
    const planeRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
    const planeUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
    const planeNormal = new THREE.Vector3().crossVectors(planeRight, planeUp).normalize();
    const workPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, planeOrigin);

    if (selected?.mesh) {
      selected.mesh.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(selected.mesh);
      if (!box.isEmpty()) box.getCenter(planeOrigin);
    } else {
      planeOrigin.copy(scene.orbitControls.target);
    }
    workPlane.setFromNormalAndCoplanarPoint(planeNormal, planeOrigin);

    const imageRect = { x: 0, y: 0, width: 0, height: 0 };
    const sceneSnapshot = document.createElement('canvas');
    sceneSnapshot.width = rendererCanvas.width;
    sceneSnapshot.height = rendererCanvas.height;
    const snapshotContext = sceneSnapshot.getContext('2d');
    const aspectLabel = Math.abs(planeNormal.y) > 0.9 ? 'Planta' : Math.abs(planeNormal.x) > 0.9 ? 'Alzado lateral' : Math.abs(planeNormal.z) > 0.9 ? 'Alzado / sección' : 'Vista ortográfica actual';
    overlay.querySelector('[data-plane]').textContent = selected
      ? `${aspectLabel} sobre «${selected.designation || selected.type}» · origen en el centro geométrico · espesor normal al plano · proyección ortográfica.`
      : `${aspectLabel} · plano por el centro de la vista actual · selecciona una pieza antes de abrir para usarla como referencia.`;

    const read = (name) => overlay.querySelector(`[name="${name}"]`);
    const basePlaneOrigin = planeOrigin.clone();
    const fitImageRect = () => {
      const scale = Math.min(canvas.width / rendererCanvas.width, canvas.height / rendererCanvas.height);
      const width = rendererCanvas.width * scale;
      const height = rendererCanvas.height * scale;
      imageRect.x = (canvas.width - width) / 2;
      imageRect.y = (canvas.height - height) / 2;
      imageRect.width = width;
      imageRect.height = height;
    };
    const screenToNdc = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      const px = (clientX - rect.left) / rect.width * canvas.width;
      const py = (clientY - rect.top) / rect.height * canvas.height;
      if (px < imageRect.x || px > imageRect.x + imageRect.width || py < imageRect.y || py > imageRect.y + imageRect.height) return null;
      return new THREE.Vector2(
        ((px - imageRect.x) / imageRect.width) * 2 - 1,
        -((py - imageRect.y) / imageRect.height) * 2 + 1,
      );
    };
    const screenForWorld = (worldPoint) => {
      const projected = worldPoint.clone().project(camera);
      return {
        x: imageRect.x + (projected.x + 1) * 0.5 * imageRect.width,
        y: imageRect.y + (1 - projected.y) * 0.5 * imageRect.height,
        depth: projected.z,
      };
    };
    const pointWorld = (point) => planeOrigin.clone()
      .addScaledVector(planeRight, point.x / 1000)
      .addScaledVector(planeUp, point.y / 1000);
    const pointCanvas = (point) => screenForWorld(pointWorld(point));
    const snapTargets = [];
    const projectedEdges = [];
    const collectSnapGeometry = () => {
      snapTargets.length = 0;
      projectedEdges.length = 0;
      if (!selected?.mesh) return;
      selected.mesh.updateMatrixWorld(true);
      selected.mesh.traverse((child) => {
        if (!child.isMesh || !child.geometry?.attributes?.position) return;
        const edges = new THREE.EdgesGeometry(child.geometry, 12);
        const positions = edges.attributes.position;
        const stride = Math.max(1, Math.ceil(positions.count / 24000));
        const projected = [];
        for (let i = 0; i + 1 < positions.count; i += 2 * stride) {
          const start = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(child.matrixWorld);
          const endIndex = Math.min(i + 1, positions.count - 1);
          const end = new THREE.Vector3().fromBufferAttribute(positions, endIndex).applyMatrix4(child.matrixWorld);
          const a = screenForWorld(start);
          const b = screenForWorld(end);
          if (a.depth < -1 || a.depth > 1 || b.depth < -1 || b.depth > 1) continue;
          const aUV = { x: start.clone().sub(planeOrigin).dot(planeRight) * 1000, y: start.clone().sub(planeOrigin).dot(planeUp) * 1000 };
          const bUV = { x: end.clone().sub(planeOrigin).dot(planeRight) * 1000, y: end.clone().sub(planeOrigin).dot(planeUp) * 1000 };
          projectedEdges.push({ a, b, aUV, bUV, aWorld: start, bWorld: end });
          projected.push(start, end);
        }
        const seen = new Set();
        for (const vertex of projected) {
          const key = `${Math.round(vertex.x * 10000)}:${Math.round(vertex.y * 10000)}:${Math.round(vertex.z * 10000)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const screen = screenForWorld(vertex);
          if (screen.depth < -1 || screen.depth > 1) continue;
          const delta = vertex.clone().sub(planeOrigin);
          snapTargets.push({ screen, uv: { x: delta.dot(planeRight) * 1000, y: delta.dot(planeUp) * 1000 }, world: vertex });
        }
        edges.dispose();
      });
    };
    const updatePlaneOffset = () => {
      planeOrigin.copy(basePlaneOrigin).addScaledVector(planeNormal, (Number(read('planeOffset').value) || 0) / 1000);
      workPlane.setFromNormalAndCoplanarPoint(planeNormal, planeOrigin);
      collectSnapGeometry();
      draw();
    };

    const setSnapshotDimensions = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      fitImageRect();
    };
    const refreshImageRect = () => {
      fitImageRect();
    };
    const refreshSceneSnapshot = () => {
      try {
        scene.renderer.render(scene.scene, camera);
        snapshotContext.clearRect(0, 0, sceneSnapshot.width, sceneSnapshot.height);
        snapshotContext.drawImage(rendererCanvas, 0, 0);
      } catch {
        snapshotContext.fillStyle = '#eef3f5';
        snapshotContext.fillRect(0, 0, sceneSnapshot.width, sceneSnapshot.height);
      }
    };

    const bounds = () => {
      if (!points.length) return { width: 0, height: 0, minX: 0, minY: 0, centerX: 0, centerY: 0 };
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const minX = Math.min(...xs); const maxX = Math.max(...xs);
      const minY = Math.min(...ys); const maxY = Math.max(...ys);
      return { minX, minY, width: maxX - minX, height: maxY - minY, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 };
    };
    const drawGrid = () => {
      const snap = Math.max(1, Number(read('snap').value) || 5);
      const origin = screenForWorld(planeOrigin);
      const oneMm = screenForWorld(planeOrigin.clone().addScaledVector(planeRight, 0.001));
      const pxPerMm = Math.hypot(oneMm.x - origin.x, oneMm.y - origin.y);
      const factor = Math.max(1, Math.ceil(8 / Math.max(0.001, snap * pxPerMm)));
      const stepMm = snap * factor;
      const stepPx = stepMm * pxPerMm;
      if (!Number.isFinite(stepPx) || stepPx < 1 || stepPx > 2000) return;
      const left = imageRect.x; const top = imageRect.y;
      const right = left + imageRect.width; const bottom = top + imageRect.height;
      const ox = origin.x; const oy = origin.y;
      const firstX = ox + Math.ceil((left - ox) / stepPx) * stepPx;
      const firstY = oy + Math.ceil((top - oy) / stepPx) * stepPx;
      context.lineWidth = 1;
      for (let x = firstX, i = Math.ceil((left - ox) / stepPx); x < right; x += stepPx, i += 1) {
        context.strokeStyle = i % 10 === 0 ? 'rgba(22,79,112,.33)' : 'rgba(32,88,115,.12)';
        context.beginPath(); context.moveTo(x, top); context.lineTo(x, bottom); context.stroke();
      }
      for (let y = firstY, i = Math.ceil((top - oy) / stepPx); y < bottom; y += stepPx, i += 1) {
        context.strokeStyle = i % 10 === 0 ? 'rgba(22,79,112,.33)' : 'rgba(32,88,115,.12)';
        context.beginPath(); context.moveTo(left, y); context.lineTo(right, y); context.stroke();
      }
      context.setLineDash([5, 4]);
      context.strokeStyle = 'rgba(0,105,165,.75)';
      context.beginPath(); context.moveTo(ox, top); context.lineTo(ox, bottom); context.moveTo(left, oy); context.lineTo(right, oy); context.stroke();
      context.setLineDash([]);
      context.fillStyle = '#143c54'; context.beginPath(); context.arc(ox, oy, 4, 0, Math.PI * 2); context.fill();
    };
    const updateStats = (validationMessage = '') => {
      const box = bounds();
      const valid = closed && polygonIsSimple(points) && Number(read('thickness').value) > 0;
      overlay.querySelector('[data-points]').textContent = String(points.length);
      overlay.querySelector('[data-width]').textContent = `${box.width.toFixed(1)} mm`;
      overlay.querySelector('[data-height]').textContent = `${box.height.toFixed(1)} mm`;
      overlay.querySelector('[data-area]').textContent = `${polygonArea(points).toFixed(1)} mm²`;
      overlay.querySelector('[data-create]').disabled = !valid;
      overlay.querySelector('[data-status]').textContent = validationMessage || (closed
        ? valid ? 'Contorno válido. Puede crear la pieza.' : 'Contorno inválido: revise cruces, lados menores de 0,5 mm y área.'
        : `${points.length} vértices · cierre en el primer punto o pulse Enter.`);
    };
    const draw = () => {
      refreshImageRect();
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#e6edf0';
      context.fillRect(0, 0, canvas.width, canvas.height);
      try {
        context.drawImage(sceneSnapshot, imageRect.x, imageRect.y, imageRect.width, imageRect.height);
      } catch {
        context.fillStyle = '#eef3f5'; context.fillRect(imageRect.x, imageRect.y, imageRect.width, imageRect.height);
      }
      context.save();
      context.beginPath(); context.rect(imageRect.x, imageRect.y, imageRect.width, imageRect.height); context.clip();
      context.fillStyle = 'rgba(226,238,244,.18)'; context.fillRect(imageRect.x, imageRect.y, imageRect.width, imageRect.height);
      drawGrid();
      if (points.length) {
        context.beginPath();
        const first = pointCanvas(points[0]);
        context.moveTo(first.x, first.y);
        points.slice(1).forEach((point) => { const p = pointCanvas(point); context.lineTo(p.x, p.y); });
        if (closed) context.closePath();
        else if (pointer) context.lineTo(pointer.x, pointer.y);
        context.fillStyle = closed ? 'rgba(26,125,177,.34)' : 'rgba(26,125,177,.18)';
        context.fill();
        context.strokeStyle = '#0879b7'; context.lineWidth = Math.max(2, canvas.width / 700); context.stroke();
        points.forEach((point, index) => {
          const p = pointCanvas(point);
          context.beginPath(); context.arc(p.x, p.y, index === 0 ? 6 : 4.5, 0, Math.PI * 2);
          context.fillStyle = index === 0 ? '#ff9f2e' : '#f7fbff'; context.fill();
          context.strokeStyle = '#185a86'; context.lineWidth = 2; context.stroke();
        });
      }
      if (pointer) {
        context.beginPath(); context.arc(pointer.x, pointer.y, 5, 0, Math.PI * 2);
        context.fillStyle = '#e6543d'; context.fill(); context.strokeStyle = '#fff'; context.lineWidth = 1.5; context.stroke();
      }
      context.restore();
      updateStats();
    };

    const fromEvent = (event, constrain = true) => {
      const ndc = screenToNdc(event.clientX, event.clientY);
      if (!ndc) return null;
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.ray.intersectPlane(workPlane, new THREE.Vector3());
      if (!hit) return null;
      const delta = hit.sub(planeOrigin);
      let point = { x: delta.dot(planeRight) * 1000, y: delta.dot(planeUp) * 1000 };
      let snapKind = 'REJILLA';
      const rect = canvas.getBoundingClientRect();
      const mouseX = (event.clientX - rect.left) / rect.width * canvas.width;
      const mouseY = (event.clientY - rect.top) / rect.height * canvas.height;
      let closest = null;
      let closestDistance = 9 * (canvas.width / Math.max(1, rect.width));
      snapTargets.forEach((target) => {
        const distance = Math.hypot(target.screen.x - mouseX, target.screen.y - mouseY);
        if (distance < closestDistance) { closest = target; closestDistance = distance; }
      });
      projectedEdges.forEach((edge) => {
        const dx = edge.b.x - edge.a.x; const dy = edge.b.y - edge.a.y;
        const length2 = dx * dx + dy * dy;
        if (length2 < 1e-8) return;
        const t = THREE.MathUtils.clamp(((mouseX - edge.a.x) * dx + (mouseY - edge.a.y) * dy) / length2, 0, 1);
        const sx = edge.a.x + dx * t; const sy = edge.a.y + dy * t;
        const distance = Math.hypot(sx - mouseX, sy - mouseY);
        if (distance < closestDistance) {
          closestDistance = distance;
          closest = {
            uv: { x: edge.aUV.x + (edge.bUV.x - edge.aUV.x) * t, y: edge.aUV.y + (edge.bUV.y - edge.aUV.y) * t },
            screen: { x: sx, y: sy },
            world: edge.aWorld.clone().lerp(edge.bWorld, t),
          };
        }
      });
      if (closest) {
        const sceneObjects = scene.objects.filter((object) => object?.mesh).map((object) => object.mesh);
        raycaster.setFromCamera(ndc, camera);
        const occluders = raycaster.intersectObjects(sceneObjects, true);
        const candidateWorld = closest.world || planeOrigin.clone().addScaledVector(planeRight, closest.uv.x / 1000).addScaledVector(planeUp, closest.uv.y / 1000);
        const candidateDistance = raycaster.ray.origin.distanceTo(candidateWorld);
        const hidden = occluders.length && occluders[0].distance < candidateDistance - 0.002;
        if (!hidden) { point = { ...closest.uv }; snapKind = 'GEOMETRÍA'; }
      }
      if (snapKind === 'REJILLA') {
        const step = Math.max(1, Number(read('snap').value) || 5);
        point.x = Math.round(point.x / step) * step;
        point.y = Math.round(point.y / step) * step;
      }
      if (constrain && event.shiftKey && points.length) {
        const previous = points.at(-1);
        if (Math.abs(point.x - previous.x) >= Math.abs(point.y - previous.y)) point.y = previous.y;
        else point.x = previous.x;
      }
      overlay.querySelector('[data-cursor]').textContent = `${point.x.toFixed(1)} / ${point.y.toFixed(1)}`;
      overlay.querySelector('[data-snap]').textContent = snapKind;
      return point;
    };
    const closePolygon = () => {
      if (points.length < 3) return;
      closed = true;
      const valid = polygonIsSimple(points);
      draw();
      if (!valid) updateStats('El contorno se cruza, tiene lados demasiado cortos o área insuficiente; deshaga o ajuste puntos.');
    };

    const hitPlane = (ndc) => {
      if (!ndc) return null;
      raycaster.setFromCamera(ndc, camera);
      return raycaster.ray.intersectPlane(workPlane, new THREE.Vector3());
    };
    const translateView = (delta) => {
      camera.position.add(delta);
      scene.orbitControls.target.add(delta);
      camera.updateMatrixWorld(true);
      scene.orbitControls.update();
      collectSnapGeometry();
      refreshSceneSnapshot();
      draw();
    };
    let panState = null;
    let suppressClick = false;
    canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 1 && event.button !== 2) return;
      const ndc = screenToNdc(event.clientX, event.clientY);
      const hit = hitPlane(ndc);
      if (!hit) return;
      panState = { id: event.pointerId, last: hit, moved: false };
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!panState || panState.id !== event.pointerId) return;
      const current = hitPlane(screenToNdc(event.clientX, event.clientY));
      if (!current) return;
      const delta = panState.last.clone().sub(current);
      if (delta.lengthSq() > 1e-12) {
        panState.moved = true;
        translateView(delta);
      }
      panState.last.copy(current);
    });
    const endPan = (event) => {
      if (!panState || panState.id !== event.pointerId) return;
      suppressClick = panState.moved;
      panState = null;
    };
    canvas.addEventListener('pointerup', endPan);
    canvas.addEventListener('pointercancel', endPan);
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    canvas.addEventListener('wheel', (event) => {
      const ndc = screenToNdc(event.clientX, event.clientY);
      const before = hitPlane(ndc);
      if (!before) return;
      event.preventDefault();
      scene.stepZoom(event.deltaY < 0 ? 1.2 : 1 / 1.2);
      camera.updateMatrixWorld(true);
      const after = hitPlane(ndc);
      if (after) translateView(before.sub(after));
      else { collectSnapGeometry(); refreshSceneSnapshot(); draw(); }
    }, { passive: false });
    overlay.querySelector('[data-zoom-in]').addEventListener('click', () => { scene.stepZoom(1.25); collectSnapGeometry(); refreshSceneSnapshot(); draw(); });
    overlay.querySelector('[data-zoom-out]').addEventListener('click', () => { scene.stepZoom(1 / 1.25); collectSnapGeometry(); refreshSceneSnapshot(); draw(); });
    overlay.querySelector('[data-fit]').addEventListener('click', () => { if (selected) scene.focusOnObject(selected); collectSnapGeometry(); refreshSceneSnapshot(); draw(); });

    const rectObserver = new ResizeObserver(() => { setSnapshotDimensions(); collectSnapGeometry(); draw(); });
    rectObserver.observe(canvas);
    overlay._disposePartEditor = () => rectObserver.disconnect();
    canvas.addEventListener('pointermove', (event) => {
      if (closed) return;
      const point = fromEvent(event);
      pointer = point ? pointCanvas(point) : null;
      draw();
    });
    canvas.addEventListener('pointerleave', () => { pointer = null; draw(); });
    canvas.addEventListener('click', (event) => {
      if (suppressClick) { suppressClick = false; return; }
      if (closed) return;
      const point = fromEvent(event);
      if (!point) return;
      if (points.length >= 3) {
        const firstScreen = pointCanvas(points[0]);
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width * canvas.width;
        const y = (event.clientY - rect.top) / rect.height * canvas.height;
        if (Math.hypot(x - firstScreen.x, y - firstScreen.y) < 10 * canvas.width / Math.max(1, rect.width)) { closePolygon(); return; }
      }
      const prior = points.at(-1);
      if (prior && Math.hypot(prior.x - point.x, prior.y - point.y) < 0.5) return;
      points.push(point);
      draw();
    });
    canvas.addEventListener('dblclick', (event) => { event.preventDefault(); closePolygon(); });
    read('snap').addEventListener('change', () => draw());
    read('planeOffset').addEventListener('change', updatePlaneOffset);
    overlay.querySelector('[data-undo]').addEventListener('click', () => { if (closed) closed = false; else points.pop(); draw(); });
    overlay.querySelector('[data-clear]').addEventListener('click', () => { points.length = 0; closed = false; pointer = null; draw(); });
    overlay.querySelector('[data-template]').addEventListener('click', () => {
      points.splice(0, points.length, { x: -200, y: -150 }, { x: 200, y: -150 }, { x: 0, y: 150 });
      closed = true; draw();
    });

    const close = () => { overlay._disposePartEditor?.(); overlay.remove(); };
    overlay.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', close));
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
      if (event.key === 'Backspace' && !event.target.matches('input,select')) { event.preventDefault(); if (closed) closed = false; else points.pop(); draw(); }
      if (event.key === 'Enter' && !event.target.matches('input,select,button')) { event.preventDefault(); closePolygon(); }
    });
    overlay.querySelector('[data-create]').addEventListener('click', () => {
      if (!closed || !polygonIsSimple(points)) return;
      const box = bounds();
      const centered = points.map((point) => ({ x: (point.x - box.centerX) / 1000, y: (point.y - box.centerY) / 1000 }));
      const thicknessMm = Math.max(1, Number(read('thickness').value) || 12);
      const thickness = thicknessMm / 1000;
      const plate = new Plate('gusset-custom', Math.max(0.001, box.width / 1000), Math.max(0.001, box.height / 1000), thickness);
      plate.update({
        points: centered,
        role: read('role').value,
        customName: read('name').value.trim() || 'Pieza personalizada',
        materialStandard: 'Código Estructural · EN 10025-2',
        edgeBevel: Math.max(0, Number(read('bevel').value) / 1000),
        cornerRadius: Math.max(0, Number(read('radius').value) / 1000),
        workPlane: {
          origin: planeOrigin.toArray(),
          normal: planeNormal.toArray(),
          u: planeRight.toArray(),
          v: planeUp.toArray(),
          drawingUnits: 'mm',
        },
      });
      plate.designation = read('name').value.trim() || plate.designation;
      plate.steelGrade = read('grade').value;
      plate.setColor(read('color').value);
      plate.mesh.position.copy(planeOrigin)
        .addScaledVector(planeRight, box.centerX / 1000)
        .addScaledVector(planeUp, box.centerY / 1000);
      const basis = new THREE.Matrix4().makeBasis(planeRight, planeUp, planeNormal);
      plate.mesh.quaternion.setFromRotationMatrix(basis);
      plate.mesh.updateMatrixWorld(true);
      plate._applyUserData?.();
      scene.addObject(plate);
      this.onCreate(plate);
      this.toast(`${plate.designation} creada · ${box.width.toFixed(1)} × ${box.height.toFixed(1)} × ${thicknessMm} mm`);
      close();
    });

    setSnapshotDimensions();
    collectSnapGeometry();
    refreshSceneSnapshot();
    draw();
    overlay.focus({ preventScroll: true });
  }
}
