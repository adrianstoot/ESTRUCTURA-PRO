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
const ORTHO_VIEWS = [
  ['top', 'Planta'], ['front', 'Alzado frontal'], ['right', 'Alzado lateral derecho'],
  ['left', 'Alzado lateral izquierdo'], ['back', 'Alzado posterior'],
];

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
    if (Math.hypot(a.x - b.x, a.y - b.y) < 0.01) return false;
    for (let j = i + 1; j < points.length; j += 1) {
      const adjacent = j === i || j === (i + 1) % points.length || (j + 1) % points.length === i;
      if (adjacent) continue;
      if (segmentsIntersect(a, b, points[j], points[(j + 1) % points.length])) return false;
    }
  }
  return polygonArea(points) >= 0.01;
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
    .part-editor__body{min-height:0;display:grid;grid-template-columns:minmax(420px,1fr) 340px}
    .part-editor__drawing{position:relative;min-width:0;min-height:0;display:grid;place-items:center;overflow:hidden;background:#dce4e8;padding:12px}
    .part-editor canvas{display:block;width:100%;height:100%;background:#eef3f5;box-shadow:inset 0 0 0 1px #7d919e;cursor:crosshair;touch-action:none}
    .part-editor__hint{position:absolute;left:22px;bottom:20px;max-width:calc(100% - 44px);background:#12202de6;color:#dcecff;border:1px solid #547995;padding:7px 10px;font:10px/1.35 'Segoe UI',sans-serif;pointer-events:none}
    .part-editor__viewtools{position:absolute;right:22px;top:20px;display:flex;gap:4px;z-index:1}.part-editor__viewtools button{min-width:32px;padding:0 8px;background:#12202de6;border-color:#547995;font-size:11px}
    .part-editor__tools{overflow:auto;padding:15px;background:#1c2933;border-left:1px solid #52616d}
    .part-editor__tools h3{margin:14px 0 8px;font-size:10px;letter-spacing:1px;color:#8dbfe8;text-transform:uppercase}
    .part-editor__tools label{display:grid;grid-template-columns:1fr 128px;align-items:center;gap:10px;margin:7px 0;font-size:11px}
    .part-editor__tools input,.part-editor__tools select{width:100%;height:28px;box-sizing:border-box;background:#111c24;border:1px solid #415462;color:#eaf3f8;padding:0 7px}
    .part-editor__plane{padding:9px 10px;border:1px solid #385469;background:#12202a;color:#c9d9e2;font-size:10px;line-height:1.45}
    .part-editor__coords{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:8px 0}.part-editor__coords label{display:grid;grid-template-columns:24px 1fr;gap:6px;align-items:center;margin:0}.part-editor__coord-actions{display:flex;gap:6px}.part-editor__coord-actions button{flex:1;padding:0 6px;font-size:10px}.part-editor__tools [data-update-coordinate]:disabled{opacity:.42;cursor:not-allowed}.part-editor__tools .part-editor__snap-toggle{grid-template-columns:1fr 24px}.part-editor__tools .part-editor__snap-toggle input{width:16px;height:16px;justify-self:center}
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
    document.querySelector('.part-editor-overlay')?._closePartEditor?.();
    const cameraState = this._captureCameraState();
    this._stopCameraMotion();
    const activeView = ORTHO_VIEWS.some(([view]) => view === this.sceneManager.activeView)
      ? this.sceneManager.activeView
      : 'front';
    this.sceneManager.setCameraView(activeView);
    if (selected) this.sceneManager.focusOnObject?.(selected, { animate: false, padding: 1.65 });
    else {
      this.sceneManager.camera.position.add(cameraState.target);
      this.sceneManager.orbitControls.target.copy(cameraState.target);
      this.sceneManager.camera.updateMatrixWorld(true);
      this.sceneManager.orbitControls.update();
    }

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
            <div class="part-editor__hint">Clic: punto con captura a geometría · doble clic/Enter: cerrar · selecciona un vértice para editarlo · rueda: zoom · botón central: desplazar</div>
          </div>
          <aside class="part-editor__tools">
            <h3>Plano de trabajo</h3>
            <label>Vista ortogonal<select data-work-view>${ORTHO_VIEWS.map(([value, label]) => `<option value="${value}" ${value === activeView ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
            <div class="part-editor__plane" data-plane></div>
            <h3>Clasificación BIM</h3>
            <label>Condición<select name="role">${TYPES.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
            <label>Nombre<input name="name" value="Rigidizador personalizado" maxlength="60"></label>
            <h3>Geometría y acabado</h3>
            <label>Espesor (mm)<input name="thickness" type="number" min="1" max="200" step="1" value="12"></label>
            <label>Desfase del plano (mm)<input name="planeOffset" type="number" step="1" value="0"></label>
            <label>Rejilla (mm)<select name="snap"><option value="0">Libre</option><option value="1" selected>1</option><option value="2">2</option><option value="5">5</option><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></label>
            <label class="part-editor__snap-toggle"><span>Captura a vértices y aristas</span><input name="geometrySnap" type="checkbox" checked></label>
            <label>Bisel (mm)<input name="bevel" type="number" min="0" max="20" step="0.5" value="0"></label>
            <label>Radio esquinas (mm)<input name="radius" type="number" min="0" max="100" step="1" value="0"></label>
            <h3>Material</h3>
            <label>Acero<select name="grade">${GRADES.map((grade) => `<option>${grade}</option>`).join('')}</select></label>
            <label>Color<input name="color" type="color" value="#586672"></label>
            <h3>Coordenadas exactas (mm)</h3>
            <div class="part-editor__coords"><label>U<input data-coordinate-u type="number" step="0.01" value="0"></label><label>V<input data-coordinate-v type="number" step="0.01" value="0"></label></div>
            <div class="part-editor__coord-actions"><button type="button" data-add-coordinate>Añadir punto exacto</button><button type="button" data-update-coordinate disabled>Actualizar vértice</button></div>
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
    this._wire(overlay, selected, cameraState);
  }

  _captureCameraState() {
    const scene = this.sceneManager;
    const camera = scene.camera;
    return {
      camera, mode: scene._cameraMode, activeView: scene.activeView,
      position: camera.position.clone(), quaternion: camera.quaternion.clone(), up: camera.up.clone(),
      zoom: camera.zoom, target: scene.orbitControls.target.clone(),
      enableRotate: scene.orbitControls.enableRotate,
    };
  }

  _stopCameraMotion() {
    const scene = this.sceneManager;
    if (scene._cameraAnim) cancelAnimationFrame(scene._cameraAnim);
    if (scene._focusAnimFrame) cancelAnimationFrame(scene._focusAnimFrame);
    scene._cameraAnim = null;
    scene._focusAnimFrame = null;
  }

  _restoreCameraState(state) {
    if (!state) return;
    const scene = this.sceneManager;
    this._stopCameraMotion();
    scene._cameraMode = state.mode;
    scene.camera = state.camera;
    scene.camera.position.copy(state.position);
    scene.camera.quaternion.copy(state.quaternion);
    scene.camera.up.copy(state.up);
    if (Number.isFinite(state.zoom)) scene.camera.zoom = state.zoom;
    scene.camera.updateProjectionMatrix();
    scene.camera.updateMatrixWorld(true);
    scene.orbitControls.object = scene.camera;
    scene.orbitControls.target.copy(state.target);
    scene.orbitControls.enableRotate = state.enableRotate;
    scene.orbitControls.update();
    if (scene.transformControls) scene.transformControls.camera = scene.camera;
    scene.activeView = state.activeView;
    scene.gridManager?.updateForCamera(scene.camera, scene.renderer.domElement.clientHeight, state.target);
    scene._updateZoomLabel?.();
    scene._notifyCameraViewChanged?.();
  }

  _wire(overlay, selected, cameraState) {
    const canvas = overlay.querySelector('canvas');
    const context = canvas.getContext('2d');
    const points = [];
    let closed = false;
    let pointer = null;
    const scene = this.sceneManager;
    const rendererCanvas = scene.renderer.domElement;
    let camera = scene.camera;
    const raycaster = new THREE.Raycaster();
    const planeOrigin = new THREE.Vector3();
    const planeRight = new THREE.Vector3();
    const planeUp = new THREE.Vector3();
    const planeNormal = new THREE.Vector3();
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
    let aspectLabel = '';
    overlay.querySelector('[data-plane]').textContent = '';

    const read = (name) => overlay.querySelector(`[name="${name}"]`);
    const basePlaneOrigin = planeOrigin.clone();
    let selectedPointIndex = -1;
    const featureCache = new WeakMap();
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
    const syncPlaneBasis = () => {
      camera = scene.camera;
      camera.updateMatrixWorld(true);
      planeRight.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
      planeUp.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
      planeNormal.crossVectors(planeRight, planeUp).normalize();
      if (selected?.mesh) {
        selected.mesh.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(selected.mesh);
        if (!box.isEmpty()) box.getCenter(planeOrigin);
      } else planeOrigin.copy(scene.orbitControls.target);
      basePlaneOrigin.copy(planeOrigin);
      aspectLabel = overlay.querySelector('[data-work-view]').selectedOptions[0]?.textContent || 'Vista ortogonal';
      const reference = selected ? ` · referencia: ${selected.designation || selected.type}` : ' · sin elemento de referencia';
      overlay.querySelector('[data-plane]').textContent = `${aspectLabel}${reference} · origen en el centro de la referencia · espesor perpendicular al plano · escala real en mm.`;
      workPlane.setFromNormalAndCoplanarPoint(planeNormal, planeOrigin);
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
      const roots = selected?.mesh
        ? [selected.mesh]
        : scene.objects.filter((object) => object?.mesh).map((object) => object.mesh);
      const visible = (object) => {
        for (let current = object; current; current = current.parent) if (!current.visible) return false;
        return true;
      };
      const seenVertices = new Set();
      roots.forEach((root) => {
        root.updateWorldMatrix(true, true);
        root.traverse((child) => {
        if (!child.isMesh || !child.geometry?.attributes?.position || !visible(child)) return;
        let features = featureCache.get(child.geometry);
        if (!features) {
          const edgeGeometry = new THREE.EdgesGeometry(child.geometry, 12);
          const positions = edgeGeometry.attributes.position;
          const edges = [];
          const vertices = new Map();
          if (positions) {
            for (let i = 0; i + 1 < positions.count; i += 2) {
              const a = new THREE.Vector3().fromBufferAttribute(positions, i);
              const b = new THREE.Vector3().fromBufferAttribute(positions, i + 1);
              if (a.distanceToSquared(b) < 1e-16) continue;
              edges.push([a, b]);
              for (const point of [a, b]) {
                const key = `${Math.round(point.x * 1e6)}:${Math.round(point.y * 1e6)}:${Math.round(point.z * 1e6)}`;
                if (!vertices.has(key)) vertices.set(key, point.clone());
              }
            }
          }
          edgeGeometry.dispose();
          features = { edges, vertices: [...vertices.values()] };
          featureCache.set(child.geometry, features);
        }
        const world = (point) => point.clone().applyMatrix4(child.matrixWorld);
        for (const [localA, localB] of features.edges) {
          const start = world(localA);
          const end = world(localB);
          const a = screenForWorld(start);
          const b = screenForWorld(end);
          if (a.depth < -1 || a.depth > 1 || b.depth < -1 || b.depth > 1) continue;
          const aUV = { x: start.clone().sub(planeOrigin).dot(planeRight) * 1000, y: start.clone().sub(planeOrigin).dot(planeUp) * 1000 };
          const bUV = { x: end.clone().sub(planeOrigin).dot(planeRight) * 1000, y: end.clone().sub(planeOrigin).dot(planeUp) * 1000 };
          projectedEdges.push({ a, b, aUV, bUV, aWorld: start, bWorld: end });
        }
        for (const localVertex of features.vertices) {
          const vertex = world(localVertex);
          const screen = screenForWorld(vertex);
          if (screen.depth < -1 || screen.depth > 1) continue;
          const key = `${Math.round(screen.x * 100)}:${Math.round(screen.y * 100)}`;
          if (seenVertices.has(key)) continue;
          seenVertices.add(key);
          const delta = vertex.clone().sub(planeOrigin);
          snapTargets.push({ screen, uv: { x: delta.dot(planeRight) * 1000, y: delta.dot(planeUp) * 1000 }, world: vertex, kind: 'VÉRTICE' });
        }
        });
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
      if (sceneSnapshot.width !== rendererCanvas.width || sceneSnapshot.height !== rendererCanvas.height) {
        sceneSnapshot.width = rendererCanvas.width;
        sceneSnapshot.height = rendererCanvas.height;
      }
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
      const selectedStep = Number(read('snap').value);
      const snap = selectedStep > 0 ? selectedStep : 10;
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
      overlay.querySelector('[data-width]').textContent = `${box.width.toFixed(2)} mm`;
      overlay.querySelector('[data-height]').textContent = `${box.height.toFixed(2)} mm`;
      overlay.querySelector('[data-area]').textContent = `${polygonArea(points).toFixed(2)} mm²`;
      overlay.querySelector('[data-create]').disabled = !valid;
      overlay.querySelector('[data-update-coordinate]').disabled = selectedPointIndex < 0 || selectedPointIndex >= points.length;
      overlay.querySelector('[data-work-view]').disabled = points.length > 0;
      overlay.querySelector('[data-status]').textContent = validationMessage || (closed
        ? valid ? 'Contorno válido. Puede crear la pieza.' : 'Contorno inválido: revise cruces, lados menores de 0,01 mm y área.'
        : `${points.length} vértices · cierre en el primer punto o pulse Enter. ${selectedPointIndex >= 0 ? `Vértice ${selectedPointIndex + 1} seleccionado.` : ''}`);
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
          context.beginPath(); context.arc(p.x, p.y, index === selectedPointIndex ? 8 : index === 0 ? 6 : 4.5, 0, Math.PI * 2);
          context.fillStyle = index === selectedPointIndex ? '#37b6ff' : index === 0 ? '#ff9f2e' : '#f7fbff'; context.fill();
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
      let snapKind = 'LIBRE';
      const rect = canvas.getBoundingClientRect();
      const mouseX = (event.clientX - rect.left) / rect.width * canvas.width;
      const mouseY = (event.clientY - rect.top) / rect.height * canvas.height;
      const pixelScale = canvas.width / Math.max(1, rect.width);
      let closest = null;
      let closestDistance = 12 * pixelScale;
      if (read('geometrySnap').checked) {
        for (const target of snapTargets) {
          const distance = Math.hypot(target.screen.x - mouseX, target.screen.y - mouseY);
          if (distance < closestDistance) {
            closest = { ...target, distance };
            closestDistance = distance;
          }
        }
        for (const edge of projectedEdges) {
          const dx = edge.b.x - edge.a.x; const dy = edge.b.y - edge.a.y;
          const length2 = dx * dx + dy * dy;
          if (length2 < 1e-8) continue;
          const t = THREE.MathUtils.clamp(((mouseX - edge.a.x) * dx + (mouseY - edge.a.y) * dy) / length2, 0, 1);
          const sx = edge.a.x + dx * t; const sy = edge.a.y + dy * t;
          const distance = Math.hypot(sx - mouseX, sy - mouseY);
          const keepVertex = closest?.kind === 'VÉRTICE' && distance > closestDistance - 3 * pixelScale;
          if (distance < closestDistance && !keepVertex) {
            closestDistance = distance;
            closest = {
              uv: { x: edge.aUV.x + (edge.bUV.x - edge.aUV.x) * t, y: edge.aUV.y + (edge.bUV.y - edge.aUV.y) * t },
              kind: 'ARISTA',
            };
          }
        }
      }
      if (closest) {
        point = { ...closest.uv };
        snapKind = closest.kind;
      } else {
        const step = Number(read('snap').value);
        if (step > 0) {
          point.x = Math.round(point.x / step) * step;
          point.y = Math.round(point.y / step) * step;
          snapKind = 'REJILLA';
        }
      }
      if (constrain && event.shiftKey && points.length) {
        const previous = points.at(-1);
        if (Math.abs(point.x - previous.x) >= Math.abs(point.y - previous.y)) point.y = previous.y;
        else point.x = previous.x;
      }
      overlay.querySelector('[data-cursor]').textContent = `${point.x.toFixed(2)} / ${point.y.toFixed(2)}`;
      overlay.querySelector('[data-snap]').textContent = snapKind;
      return point;
    };
    const closePolygon = () => {
      if (points.length < 3) return;
      if (points.length > 3 && Math.hypot(points[0].x - points.at(-1).x, points[0].y - points.at(-1).y) < 0.01) points.pop();
      closed = true;
      const valid = polygonIsSimple(points);
      draw();
      if (!valid) updateStats('El contorno se cruza, tiene lados menores de 0,01 mm o área insuficiente; ajuste los puntos.');
    };

    const setCoordinateFields = (point) => {
      overlay.querySelector('[data-coordinate-u]').value = Number(point.x).toFixed(2);
      overlay.querySelector('[data-coordinate-v]').value = Number(point.y).toFixed(2);
    };
    const pointAtScreen = (clientX, clientY, toleranceCss = 12) => {
      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width * canvas.width;
      const y = (clientY - rect.top) / rect.height * canvas.height;
      const limit = toleranceCss * canvas.width / Math.max(1, rect.width);
      let nearest = -1;
      let distance = limit;
      points.forEach((point, index) => {
        const screen = pointCanvas(point);
        const candidate = Math.hypot(screen.x - x, screen.y - y);
        if (candidate < distance) { nearest = index; distance = candidate; }
      });
      return nearest;
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
      const point = fromEvent(event);
      pointer = point ? pointCanvas(point) : null;
      if (point && selectedPointIndex < 0) setCoordinateFields(point);
      draw();
    });
    canvas.addEventListener('pointerleave', () => { pointer = null; draw(); });
    canvas.addEventListener('click', (event) => {
      if (suppressClick) { suppressClick = false; return; }
      if (event.detail > 1) return;
      if (points.length >= 3) {
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width * canvas.width;
        const y = (event.clientY - rect.top) / rect.height * canvas.height;
        const firstScreen = pointCanvas(points[0]);
        const closeTolerance = 11 * canvas.width / Math.max(1, rect.width);
        if (!closed && Math.hypot(x - firstScreen.x, y - firstScreen.y) <= closeTolerance) { closePolygon(); return; }
      }
      const existingPoint = pointAtScreen(event.clientX, event.clientY);
      if (existingPoint >= 0) {
        selectedPointIndex = existingPoint;
        setCoordinateFields(points[existingPoint]);
        draw();
        return;
      }
      if (closed) { selectedPointIndex = -1; draw(); return; }
      const point = fromEvent(event);
      if (!point) return;
      const prior = points.at(-1);
      if (prior && Math.hypot(prior.x - point.x, prior.y - point.y) < 0.01) return;
      points.push(point);
      selectedPointIndex = -1;
      draw();
    });
    canvas.addEventListener('dblclick', (event) => { event.preventDefault(); closePolygon(); });
    read('snap').addEventListener('change', () => draw());
    read('geometrySnap').addEventListener('change', () => draw());
    read('planeOffset').addEventListener('change', updatePlaneOffset);
    overlay.querySelector('[data-work-view]').addEventListener('change', (event) => {
      if (points.length) { event.target.value = scene.activeView; return; }
      this._stopCameraMotion();
      scene.setCameraView(event.target.value);
      camera = scene.camera;
      if (selected) scene.focusOnObject(selected, { animate: false, padding: 1.65 });
      else {
        camera.position.add(cameraState.target);
        scene.orbitControls.target.copy(cameraState.target);
        camera.updateMatrixWorld(true);
        scene.orbitControls.update();
      }
      syncPlaneBasis();
      updatePlaneOffset();
      refreshSceneSnapshot();
    });
    overlay.querySelector('[data-add-coordinate]').addEventListener('click', () => {
      if (closed) { updateStats('El contorno está cerrado; abra con Deshacer punto antes de añadir otro vértice.'); return; }
      const x = Number(overlay.querySelector('[data-coordinate-u]').value);
      const y = Number(overlay.querySelector('[data-coordinate-v]').value);
      if (!Number.isFinite(x) || !Number.isFinite(y)
        || !overlay.querySelector('[data-coordinate-u]').value.trim()
        || !overlay.querySelector('[data-coordinate-v]').value.trim()) return;
      points.push({ x, y });
      selectedPointIndex = -1;
      draw();
    });
    overlay.querySelector('[data-update-coordinate]').addEventListener('click', () => {
      if (selectedPointIndex < 0 || selectedPointIndex >= points.length) return;
      const x = Number(overlay.querySelector('[data-coordinate-u]').value);
      const y = Number(overlay.querySelector('[data-coordinate-v]').value);
      if (!Number.isFinite(x) || !Number.isFinite(y)
        || !overlay.querySelector('[data-coordinate-u]').value.trim()
        || !overlay.querySelector('[data-coordinate-v]').value.trim()) return;
      points[selectedPointIndex] = { x, y };
      draw();
      if (closed && !polygonIsSimple(points)) updateStats('El vértice se actualizó, pero el contorno tiene cruces o área insuficiente.');
    });
    overlay.querySelector('[data-undo]').addEventListener('click', () => {
      if (closed) closed = false;
      else if (selectedPointIndex >= 0) points.splice(selectedPointIndex, 1);
      else points.pop();
      selectedPointIndex = -1;
      draw();
    });
    overlay.querySelector('[data-clear]').addEventListener('click', () => { points.length = 0; closed = false; selectedPointIndex = -1; pointer = null; draw(); });
    overlay.querySelector('[data-template]').addEventListener('click', () => {
      points.splice(0, points.length, { x: -200, y: -150 }, { x: 200, y: -150 }, { x: 0, y: 150 });
      closed = true; draw();
    });

    const close = () => {
      if (!overlay.isConnected) return;
      overlay._disposePartEditor?.();
      overlay.remove();
      this._restoreCameraState(cameraState);
    };
    overlay._closePartEditor = close;
    overlay.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', close));
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
      if (event.key === 'Backspace' && !event.target.matches('input,select')) { event.preventDefault(); if (closed) closed = false; else if (selectedPointIndex >= 0) points.splice(selectedPointIndex, 1); else points.pop(); selectedPointIndex = -1; draw(); }
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
      close();
      this.onCreate(plate);
      this.toast(`${plate.designation} creada · ${box.width.toFixed(1)} × ${box.height.toFixed(1)} × ${thicknessMm} mm`);
    });

    syncPlaneBasis();
    setSnapshotDimensions();
    collectSnapGeometry();
    refreshSceneSnapshot();
    draw();
    overlay.focus({ preventScroll: true });
  }
}
