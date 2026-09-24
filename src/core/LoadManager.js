import * as THREE from 'three';

const DIRECTIONS = {
  '-Y': new THREE.Vector3(0, -1, 0),
  '+Y': new THREE.Vector3(0, 1, 0),
  '-X': new THREE.Vector3(-1, 0, 0),
  '+X': new THREE.Vector3(1, 0, 0),
  '-Z': new THREE.Vector3(0, 0, -1),
  '+Z': new THREE.Vector3(0, 0, 1),
};

const LOAD_COLORS = {
  point: 0x35a7ff,
  distributed: 0xef5350,
  moment: 0xffb23f,
};

function finite(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function disposeTree(root) {
  root?.traverse?.((child) => {
    child.geometry?.dispose?.();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach((material) => {
      material.map?.dispose?.();
      material.dispose?.();
    });
  });
}

function alignYTo(vector) {
  const direction = vector.clone().normalize();
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
}
function injectLoadEditorStyle() {
  if (document.getElementById('load-editor-style')) return;
  const style = document.createElement('style');
  style.id = 'load-editor-style';
  style.textContent = `
    .load-editor-overlay{z-index:1550;background:rgba(4,9,14,.72);backdrop-filter:blur(7px)}
    .load-editor{width:min(520px,calc(100vw - 28px));background:#1b2832;border:1px solid #536878;box-shadow:0 24px 70px #000a;color:#dce8ef}
    .load-editor>header,.load-editor>footer{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:linear-gradient(#293943,#202d37);border-bottom:1px solid #465b68}
    .load-editor>footer{border-top:1px solid #465b68;border-bottom:0}.load-editor h2{font-size:15px;margin:2px 0}.load-editor header span{font-size:9px;letter-spacing:1.3px;color:#70b8f2}
    .load-editor button{min-height:30px;padding:0 13px;border:1px solid #516a7b;background:#243745;color:#edf6fa;cursor:pointer}.load-editor button[data-create]{background:#2778b8;border-color:#65b4ef;font-weight:600}
    .load-editor__body{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px;padding:17px}.load-editor__body label{display:grid;gap:5px;font-size:10px;color:#aebfca}.load-editor__body input,.load-editor__body select{height:30px;box-sizing:border-box;background:#101b23;border:1px solid #405563;color:#edf6fa;padding:0 8px}
    .load-editor__body label:last-of-type,.load-editor__body p{grid-column:1/-1}.load-editor__body p{margin:3px 0 0;padding:9px;background:#13222c;border-left:3px solid #318dd0;font-size:10px;line-height:1.45}
    @media(max-width:520px){.load-editor__body{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}
/**
 * Technical load glyphs attached to BIM elements.
 * Loads are persisted inside element.params.loads and rebuilt after load/undo.
 */
export class LoadManager {
  constructor(sceneManager, options = {}) {
    this.sceneManager = sceneManager;
    this.toast = options.toast || (() => {});
    this.onCommit = options.onCommit || (() => {});
    this._groups = new Map();
    injectLoadEditorStyle();
  }

  addLoad(element, raw = {}) {
    if (!element?.mesh) return null;
    const type = ['point', 'distributed', 'moment'].includes(raw.type) ? raw.type : 'point';
    const magnitude = Math.max(0, finite(raw.magnitude, 10));
    const load = {
      id: raw.id || `load_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      magnitude,
      unit: raw.unit || (type === 'distributed' ? 'kN/m' : type === 'moment' ? 'kN·m' : 'kN'),
      direction: DIRECTIONS[raw.direction] ? raw.direction : '-Y',
      position: THREE.MathUtils.clamp(finite(raw.position, 0.5), 0, 1),
      count: THREE.MathUtils.clamp(Math.round(finite(raw.count, 7)), 3, 15),
      loadCase: String(raw.loadCase || 'Permanente G'),
      label: String(raw.label || ''),
    };
    element.params.loads = Array.isArray(element.params.loads) ? element.params.loads : [];
    element.params.loads.push(load);
    element._applyUserData?.();
    this.rebuild(element);
    this.onCommit(element, load);
    return load;
  }

  removeLoad(element, loadId) {
    if (!Array.isArray(element?.params?.loads)) return;
    element.params.loads = element.params.loads.filter((item) => item.id !== loadId);
    element._applyUserData?.();
    this.rebuild(element);
    this.onCommit(element, null);
  }

  clear(element = null) {
    if (element) {
      element.params.loads = [];
      element._applyUserData?.();
      this.rebuild(element);
      return;
    }
    this._groups.forEach((group) => {
      group.parent?.remove(group);
      disposeTree(group);
    });
    this._groups.clear();
  }

  rebuildAll() {
    const valid = new Set(this.sceneManager.objects.map((object) => object.id));
    this._groups.forEach((group, id) => {
      if (!valid.has(id)) {
        group.parent?.remove(group);
        disposeTree(group);
        this._groups.delete(id);
      }
    });
    this.sceneManager.objects.forEach((object) => this.rebuild(object));
  }

  rebuild(element) {
    if (!element?.mesh) return;
    const previous = this._groups.get(element.id);
    if (previous) {
      previous.parent?.remove(previous);
      disposeTree(previous);
      this._groups.delete(element.id);
    }
    const loads = Array.isArray(element.params.loads) ? element.params.loads : [];
    if (!loads.length) return;
    const group = new THREE.Group();
    group.name = `Cargas · ${element.designation}`;
    group.userData.isAnalysisOverlay = true;
    loads.forEach((load) => {
      const glyph = this._buildGlyph(element, load);
      if (glyph) group.add(glyph);
    });
    element.mesh.add(group);
    this._groups.set(element.id, group);
  }

  _memberLength(element) {
    return Math.max(0.5, finite(element.params?.length, 1));
  }

  _buildGlyph(element, load) {
    if (load.type === 'distributed') return this._distributedGlyph(element, load);
    if (load.type === 'moment') return this._momentGlyph(element, load);
    return this._pointGlyph(element, load);
  }

  _arrow(direction, length, color) {
    const group = new THREE.Group();
    const vector = direction.clone().normalize();
    const headLength = Math.min(length * 0.3, 0.18);
    const shaftLength = Math.max(0.03, length - headLength);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.24,
      metalness: 0.2,
      roughness: 0.32,
      depthTest: false,
    });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, shaftLength, 12), material);
    shaft.position.y = shaftLength / 2;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.045, headLength, 18), material);
    head.position.y = shaftLength + headLength / 2;
    group.add(shaft, head);
    group.quaternion.copy(alignYTo(vector));
    group.renderOrder = 80;
    return group;
  }

  _pointGlyph(element, load) {
    const group = new THREE.Group();
    const memberLength = this._memberLength(element);
    const localZ = (load.position - 0.5) * memberLength;
    const direction = DIRECTIONS[load.direction] || DIRECTIONS['-Y'];
    const origin = new THREE.Vector3(0, direction.y < 0 ? 0.85 : -0.85, localZ);
    const arrow = this._arrow(direction, 0.72, LOAD_COLORS.point);
    arrow.position.copy(origin);
    group.add(arrow);
    group.add(this._labelSprite(load, origin.clone().add(new THREE.Vector3(0.14, 0.12, 0))));
    return group;
  }

  _distributedGlyph(element, load) {
    const group = new THREE.Group();
    const memberLength = this._memberLength(element);
    const direction = DIRECTIONS[load.direction] || DIRECTIONS['-Y'];
    const count = load.count || 7;
    const points = [];
    for (let index = 0; index < count; index += 1) {
      const t = count === 1 ? 0.5 : index / (count - 1);
      const z = (t - 0.5) * memberLength;
      const origin = new THREE.Vector3(0, direction.y < 0 ? 0.82 : -0.82, z);
      const arrow = this._arrow(direction, 0.64, LOAD_COLORS.distributed);
      arrow.position.copy(origin);
      group.add(arrow);
      points.push(origin);
    }
    if (points.length > 1) {
      const railMaterial = new THREE.LineBasicMaterial({
        color: LOAD_COLORS.distributed,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
      });
      const rail = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), railMaterial);
      rail.renderOrder = 80;
      group.add(rail);
    }
    group.add(this._labelSprite(load, new THREE.Vector3(0.18, 0.95, 0)));
    return group;
  }

  _momentGlyph(element, load) {
    const group = new THREE.Group();
    const radius = 0.48;
    const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0.2, Math.PI * 1.75, false, 0);
    const points = curve.getPoints(48).map((point) => new THREE.Vector3(point.x, point.y, 0));
    const material = new THREE.LineBasicMaterial({
      color: LOAD_COLORS.moment,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    });
    const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
    arc.renderOrder = 80;
    const tail = points.at(-1);
    const tangent = points.at(-1).clone().sub(points.at(-2)).normalize();
    const head = this._arrow(tangent, 0.16, LOAD_COLORS.moment);
    head.scale.setScalar(0.7);
    head.position.copy(tail);
    const localZ = (load.position - 0.5) * this._memberLength(element);
    group.position.set(0.55, 0, localZ);
    group.add(arc, head);
    group.add(this._labelSprite(load, new THREE.Vector3(0, 0.68, 0)));
    return group;
  }

  _labelSprite(load, position) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 112;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(10,25,42,.9)';
    context.strokeStyle = '#8fc7ff';
    context.lineWidth = 3;
    context.roundRect(4, 4, 504, 104, 14);
    context.fill();
    context.stroke();
    context.fillStyle = '#eef7ff';
    context.font = '600 34px Segoe UI';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const prefix = load.type === 'distributed' ? 'q' : load.type === 'moment' ? 'M' : 'F';
    context.fillText(load.label || `${prefix} = ${load.magnitude} ${load.unit}`, 256, 56);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.scale.set(1.28, 0.28, 1);
    sprite.renderOrder = 90;
    return sprite;
  }

  openDialog(element, defaultType = 'point') {
    if (!element?.mesh) {
      this.toast('Seleccione una barra o pieza antes de aplicar una carga.');
      return;
    }
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay load-editor-overlay';
    overlay.innerHTML = `
      <section class="load-editor" role="dialog" aria-modal="true" aria-labelledby="load-editor-title">
        <header>
          <div><span>CÓDIGO ESTRUCTURAL · ACCIONES</span><h2 id="load-editor-title">Carga gráfica</h2></div>
          <button type="button" data-close aria-label="Cerrar">×</button>
        </header>
        <div class="load-editor__body">
          <label>Tipo<select name="type">
            <option value="point">Carga puntual</option>
            <option value="distributed">Carga distribuida</option>
            <option value="moment">Momento aplicado</option>
          </select></label>
          <label>Valor<input name="magnitude" type="number" min="0" step="0.1" value="10"></label>
          <label>Dirección<select name="direction">${Object.keys(DIRECTIONS).map((key) => `<option>${key}</option>`).join('')}</select></label>
          <label>Posición sobre barra<input name="position" type="range" min="0" max="1" step="0.01" value="0.5"></label>
          <label>Caso de carga<select name="loadCase">
            <option>Permanente G</option><option>Variable Q</option><option>Viento W</option><option>Nieve S</option><option>Sismo A</option>
          </select></label>
          <label>Etiqueta opcional<input name="label" type="text" maxlength="40" placeholder="Ej. Qk cubierta"></label>
          <p>La flecha queda vinculada a <b>${element.designation}</b> y se guarda con el proyecto.</p>
        </div>
        <footer><button type="button" data-close>Cancelar</button><button type="button" data-create>Aplicar carga</button></footer>
      </section>`;
    document.body.appendChild(overlay);
    overlay.querySelector('[name="type"]').value = defaultType;
    const close = () => overlay.remove();
    overlay.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', close));
    overlay.querySelector('[data-create]').addEventListener('click', () => {
      const read = (name) => overlay.querySelector(`[name="${name}"]`).value;
      const type = read('type');
      this.addLoad(element, {
        type,
        magnitude: read('magnitude'),
        direction: read('direction'),
        position: read('position'),
        loadCase: read('loadCase'),
        label: read('label'),
        unit: type === 'distributed' ? 'kN/m' : type === 'moment' ? 'kN·m' : 'kN',
      });
      close();
      this.toast('Carga técnica añadida y vinculada.');
    });
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
      if (event.key === 'Enter' && !event.target.matches('button')) {
        event.preventDefault();
        overlay.querySelector('[data-create]').click();
      }
    });
  }
}
