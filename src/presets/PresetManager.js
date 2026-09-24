import { baseAssembly, portal, truss, expansionJoint, steelDeck, castellated, doubleCleat, bracedBay } from './WorkshopAssemblies.js';
import * as THREE from 'three';
import { Profile } from '../entities/Profile.js';
import { Plate } from '../entities/Plate.js';
import { Fastener, FASTENER_METRICS } from '../entities/Fastener.js';
import { getProfileData } from '../entities/ProfileCatalog.js';
import { boltLayout, validateHolesInContour } from '../core/WorkshopGeometry.js';
import { buildSmartConnection } from '../core/SmartConnection.js';
import { PRESET_REFERENCE_NOTES } from './ReferenceInventory.js';

const STRUCTURE_PRESETS = [
  { id: 'portal-duopitch', title: 'Pórtico a 2 aguas', subtitle: 'Nave industrial con cartelas y placas base', icon: '⌂' },
  { id: 'truss', title: 'Cercha Pratt / Warren', subtitle: 'Cordones, montantes, diagonales y cartelas', icon: '△' },
  { id: 'portal-flat', title: 'Pórtico recto', subtitle: 'Forjado con viga, pilares y casquillos L', icon: 'Π' },
  { id: 'braced-bay-x', title: 'Vano arriostrado en X', subtitle: 'Pórtico, diagonales y cartelas de esquina', icon: '╳' },
  { id: 'castellated-beam', title: 'Viga alveolar', subtitle: 'Viga armada con huecos hexagonales', icon: '⬡' },
  { id: 'composite-column-batten', title: 'Pilar compuesto', subtitle: 'Dos canales unidos mediante presillas', icon: 'Ⅱ' },
  { id: 'expansion-joint-frame', title: 'Junta de dilatación', subtitle: 'Dos alineaciones estructurales independientes', icon: '↔' },
  { id: 'steel-deck-studs', title: 'Chapa grecada + conectores', subtitle: 'Deck metálico sobre vigas con pernos de cabeza', icon: '≋' },
];

const CONNECTION_PRESETS = [
  { id: 'endplate-rigid', title: 'Chapa de testa rígida', subtitle: '4/8 tornillos y rigidizadores', icon: '▣' },
  { id: 'double-cleat', title: 'Doble casquillo L', subtitle: 'Unión articulada de alma', icon: '⌞' },
  { id: 'baseplate-rigid', title: 'Placa base completa', subtitle: 'Cartelas y pernos en J', icon: '⊞' },
  { id: 'beam-splice', title: 'Empalme de viga', subtitle: 'Cubrejuntas de alma y alas', icon: '⇔' },
  { id: 'rigid-haunched-node', title: 'Nudo rígido acartelado', subtitle: 'Dos vigas, chapas de testa y diafragmas', icon: '┿' },
];

const SCHEMAS = {
  'portal-duopitch': [
    ['span', 'Luz L', 'number', 12, 'm'], ['height', 'Altura H', 'number', 6, 'm'],
    ['slope', 'Pendiente', 'number', 15, '%'], ['columnSize', 'Pilar HEB', 'select', '300', ['200','240','260','280','300','320','340']],
    ['beamSize', 'Viga IPE', 'select', '330', ['240','270','300','330','360','400','450']],
  ],
  truss: [
    ['span', 'Luz L', 'number', 12, 'm'], ['height', 'Canto / flecha', 'number', 2.4, 'm'],
    ['panels', 'Paneles', 'number', 6, 'uds'], ['trussType', 'Tipología', 'select', 'Pratt', ['Pratt','Warren']],
    ['series', 'Perfil', 'select', 'SHS', ['SHS','L']], ['size', 'Tamaño', 'select', '100x100x5', ['100x100x5','80x80x5','60x60x5','80x8']],
  ],
  'portal-flat': [
    ['span', 'Luz L', 'number', 8, 'm'], ['height', 'Altura H', 'number', 4, 'm'],
    ['columnSize', 'Pilar HEB', 'select', '240', ['200','220','240','260','280','300']],
    ['beamSize', 'Viga IPE', 'select', '300', ['240','270','300','330','360']],
  ],
  'braced-bay-x': [
    ['span', 'Ancho de vano', 'number', 6, 'm'], ['height', 'Altura', 'number', 4, 'm'],
    ['columnSize', 'Pilar HEB', 'select', '240', ['200','220','240','260','280']],
    ['beamSize', 'Viga IPE', 'select', '300', ['240','270','300','330']],
    ['braceSize', 'Diagonal CHS', 'select', '76.1x3.6', ['60.3x3.6','76.1x3.6','88.9x4.0','101.6x4.0']],
  ],
  'castellated-beam': [
    ['span', 'Longitud', 'number', 7, 'm'], ['supportHeight', 'Cota de apoyo', 'number', 3.2, 'm'],
    ['beamDepth', 'Canto total', 'number', 0.5, 'm'], ['openingCount', 'Huecos', 'number', 7, 'uds'],
    ['columnSize', 'Pilar HEB', 'select', '240', ['200','220','240','260']],
  ],
  'composite-column-batten': [
    ['height', 'Altura', 'number', 4, 'm'], ['separation', 'Separación de ejes', 'number', 0.48, 'm'],
    ['battenSpacing', 'Paso de presillas', 'number', 0.7, 'm'],
    ['channelSize', 'Canal UPN', 'select', '200', ['160','180','200','220','240']],
  ],
  'expansion-joint-frame': [
    ['span', 'Luz de cada pórtico', 'number', 6, 'm'], ['height', 'Altura', 'number', 4, 'm'],
    ['gap', 'Junta libre', 'number', 0.08, 'm'], ['columnSize', 'Pilar HEB', 'select', '200', ['180','200','220','240']],
    ['beamSize', 'Viga IPE', 'select', '270', ['240','270','300','330']],
  ],
  'steel-deck-studs': [
    ['width', 'Ancho de paño', 'number', 3, 'm'], ['length', 'Longitud', 'number', 6, 'm'],
    ['ribs', 'Número de grecas', 'number', 6, 'uds'], ['deckHeight', 'Canto de greca', 'number', 0.075, 'm'],
    ['beamSize', 'Viga IPE', 'select', '240', ['200','220','240','270']],
    ['metric', 'Conector', 'select', 'M20', ['M16','M20']],
  ],
  'endplate-rigid': [
    ['metric', 'Métrica', 'select', 'M20', ['M16','M20','M24']], ['boltCount', 'Tornillos', 'select', '8', ['4','8']],
    ['plateWidth', 'Ancho chapa', 'number', 0.28, 'm'], ['plateHeight', 'Alto chapa', 'number', 0.46, 'm'],
    ['plateThickness', 'Espesor', 'number', 0.02, 'm'],
  ],
  'double-cleat': [
    ['metric', 'Métrica', 'select', 'M16', ['M16','M20']], ['cleatHeight', 'Altura casquillo', 'number', 0.22, 'm'],
  ],
  'baseplate-rigid': [
    ['metric', 'Perno', 'select', 'M20', ['M20','M24','M30']], ['plateWidth', 'Placa', 'number', 0.4, 'm'],
    ['plateThickness', 'Espesor', 'number', 0.02, 'm'], ['columnSize', 'Pilar HEB', 'select', '200', ['180','200','220','240','260']],
  ],
  'beam-splice': [
    ['metric', 'Métrica', 'select', 'M20', ['M16','M20','M24']], ['beamSize', 'Vigas IPE', 'select', '300', ['240','270','300','330','360']],
    ['plateThickness', 'Espesor cubrejunta', 'number', 0.012, 'm'],
  ],
  'rigid-haunched-node': [
    ['metric', 'Métrica', 'select', 'M20', ['M16','M20','M24']],
    ['columnSize', 'Pilar HEB', 'select', '300', ['240','260','280','300','320']],
    ['beamSize', 'Vigas IPE', 'select', '300', ['240','270','300','330','360']],
    ['plateThickness', 'Espesor de chapas', 'number', 0.02, 'm'],
  ],
};

const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export class PresetManager {
  constructor({ sceneManager, onCommit, onSelect, toast, getSelected } = {}) {
    this.sceneManager = sceneManager;
    this.onCommit = onCommit;
    this.onSelect = onSelect;
    this.toast = toast || (() => {});
    this.getSelected = getSelected || (() => null);
    this._counter = 0;
  }

  open(category = 'structure', initialId = null) {
    const presets = category === 'connection' ? CONNECTION_PRESETS : STRUCTURE_PRESETS;
    let selectedId = initialId || presets[0].id;
    const overlay = document.createElement('div');
    overlay.className = 'preset-overlay modal-overlay';
    overlay.innerHTML = `
      <section class="preset-dialog" role="dialog" aria-modal="true" aria-labelledby="preset-title">
        <header class="preset-dialog__header">
          <div><span class="eyebrow">BIBLIOTECA PARAMÉTRICA</span><h2 id="preset-title">Plantillas de ${category === 'connection' ? 'uniones' : 'estructuras'}</h2></div>
          <button class="preset-close" type="button" aria-label="Cerrar">×</button>
        </header>
        <div class="preset-dialog__body">
          <div class="preset-cards" role="list">
            ${presets.map((preset, index) => `
              <button class="preset-card${index === 0 ? ' active' : ''}" type="button" data-preset="${preset.id}">
                <span class="preset-card__icon">${preset.icon}</span>
                <span><b>${preset.title}</b><small>${preset.subtitle}</small></span>
                <span class="preset-card__check">✓</span>
              </button>`).join('')}
          </div>
          <div class="preset-form-wrap">
            <div class="preset-preview"><div class="preset-preview__grid"></div><span id="preset-preview-label"></span></div>
            <form id="preset-form" class="preset-form"></form>
            <aside class="preset-scope"><b>Geometría de taller</b><span>La geometría se genera lista para editar. Compruebe las dimensiones, contactos y holguras antes de documentar el montaje.</span></aside>
          </div>
        </div>
        <footer class="preset-dialog__footer">
          <span><kbd>Esc</kbd> Cancelar · <kbd>Enter</kbd> Insertar</span>
          <div><button class="btn-secondary preset-cancel" type="button">Cancelar</button><button class="btn-primary preset-insert" type="button">Insertar en escena</button></div>
        </footer>
      </section>`;
    document.body.appendChild(overlay);

    const renderForm = () => {
      const schema = SCHEMAS[selectedId] || [];
      const preset = presets.find(item => item.id === selectedId);
      overlay.querySelector('#preset-preview-label').textContent = preset?.title || '';
      overlay.querySelector('#preset-form').innerHTML = schema.map(([id, label, type, value, unitOrOptions]) => `
        <label class="preset-field"><span>${label}</span>
          ${type === 'select'
            ? `<select name="${id}">${unitOrOptions.map(option => `<option value="${option}" ${String(option) === String(value) ? 'selected' : ''}>${option}</option>`).join('')}</select>`
            : `<span class="input-with-unit"><input name="${id}" type="number" value="${unitOrOptions==='m'?Number(value)*1000:value}" step="any" min="0"><em>${unitOrOptions==='m'?'mm':unitOrOptions || ''}</em></span>`}
        </label>`).join('');
    };
    renderForm();
    const close = () => overlay.remove();
    overlay.querySelectorAll('.preset-card').forEach(card => card.addEventListener('click', () => {
      selectedId = card.dataset.preset;
      overlay.querySelectorAll('.preset-card').forEach(item => item.classList.toggle('active', item === card));
      renderForm();
    }));
    const insert = () => {
      const values = Object.fromEntries(new FormData(overlay.querySelector('#preset-form')).entries());
      for(const [key,,type,,unit] of SCHEMAS[selectedId]||[])if(type==='number'&&unit==='m')values[key]=Number(values[key])/1000;
      try { const created = this.generate(selectedId, values); if (created.length) close(); } catch(error) { let alert=overlay.querySelector('[role="alert"]');if(!alert){alert=document.createElement("p");alert.setAttribute("role","alert");alert.className="workshop-error";overlay.querySelector(".preset-form-wrap").appendChild(alert);}alert.textContent=error.message; }
    };
    overlay.querySelector('.preset-close').addEventListener('click', close);
    overlay.querySelector('.preset-cancel').addEventListener('click', close);
    overlay.querySelector('.preset-insert').addEventListener('click', insert);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    overlay.addEventListener('keydown', event => {
      if (event.key === 'Escape') close();
      if (event.key === 'Enter' && !event.target.matches('button')) { event.preventDefault(); insert(); }
    });
    overlay.querySelector('input, select, button')?.focus();
  }

  generate(id, raw = {}) {
    const instanceId = `preset_${Date.now().toString(36)}_${++this._counter}`;
    const created = [];
    const ctx = { id: instanceId, created, raw };
    const generators = {
      'portal-duopitch': () => this._portalDuopitch(ctx), truss: () => this._truss(ctx),
      'portal-flat': () => this._portalFlat(ctx), 'braced-bay-x': () => this._bracedBayX(ctx),
      'castellated-beam': () => this._castellatedBeam(ctx), 'composite-column-batten': () => this._compositeColumn(ctx),
      'expansion-joint-frame': () => this._expansionJoint(ctx), 'steel-deck-studs': () => this._steelDeckStuds(ctx),
      'endplate-rigid': () => this._endplate(ctx), 'double-cleat': () => this._doubleCleat(ctx),
      'baseplate-rigid': () => this._baseplate(ctx), 'beam-splice': () => this._beamSplice(ctx),
      'rigid-haunched-node': () => this._rigidHaunchedNode(ctx),
    };
    if (!generators[id]) return [];
    try { generators[id](); } catch(error) { created.forEach(o=>this.sceneManager.removeObject(o)); throw error; }
    const reference = PRESET_REFERENCE_NOTES[id] || { sources: [], confidence: 'parametric', speculative: [] };
    created.forEach(object => {
      object.params.templateInstanceId = instanceId;
      object.params.templateId = id;
      object.params.referenceSources = [...reference.sources];
      object.params.referenceConfidence = reference.confidence;
      object.params.referenceAssumptions = [...reference.speculative];
      object.params.speculativeGeometry = reference.speculative.length > 0;
      this._refreshUserData(object);
      object.mesh.userData.templateInstanceId = instanceId;
      object.mesh.userData.referenceModel = { sources: [...reference.sources], confidence: reference.confidence, speculative: reference.speculative.length > 0 };
    });
    this.onCommit?.(created, { instanceId, presetId: id, parameters: raw, reference });
    if (created[0]) this.onSelect?.(created[0]);
    this.sceneManager?.fitAll?.();
    this.toast(`${created.length} elementos insertados · ${id}`);
    return created;
  }

  _refreshUserData(object) {
    if (!object?.mesh) return;
    const preserved = { ...object.mesh.userData };
    object._applyUserData?.();
    ['bimId', 'type', 'designation', 'steelGrade', 'params'].forEach(key => delete preserved[key]);
    Object.assign(object.mesh.userData, preserved);
  }

  _add(ctx, object, role, position = null, quaternion = null, assemblyId = ctx.id) {
    if (!object?.mesh) return null;
    object.params.role = role;
    object.params.assemblyId = assemblyId;
    this.sceneManager?.addObject?.(object);
    if (position) object.mesh.position.copy(position);
    if (quaternion) object.mesh.quaternion.copy(quaternion);
    object.mesh.updateMatrixWorld(true);
    this._refreshUserData(object);
    ctx.created.push(object);
    return object;
  }

  _validSize(series, requested, fallback) {
    const candidate = String(requested ?? fallback);
    return getProfileData(series, candidate) ? candidate : String(fallback);
  }

  _member(ctx, a, b, series, size, role, options = {}) {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    if (length < 1e-6) return null;
    const fallback = series === 'HEB' ? '200' : series === 'IPE' ? '240' : series === 'UPN' ? '200' : series === 'L' ? '80x8' : series === 'CHS' ? '76.1x3.6' : '100x100x5';
    const safeSize = this._validSize(series, size, fallback);
    const profile = new Profile(series, safeSize, length, 'beam', {
      role, assemblyId: ctx.id, templateInstanceId: ctx.id,
      detailLevel: options.detailLevel || 'standard', sectionRotation: options.sectionRotation || 0,
      insertionPoint: options.insertionPoint || 'center', endTreatment: options.endTreatment || 'square-cut',
    });
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.normalize());
    return this._add(ctx, profile, role, start.clone().add(end).multiplyScalar(0.5), quaternion);
  }

  _plate(ctx, subtype, width, height, thickness, role, position, euler = [0, 0, 0], options = {}) {
    const plate = new Plate(subtype, width, height, thickness, options);
    return this._add(ctx, plate, role, new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...euler)));
  }

  _plateQ(ctx, subtype, width, height, thickness, role, position, quaternion, options = {}) {
    return this._add(ctx, new Plate(subtype, width, height, thickness, options), role, new THREE.Vector3(...position), quaternion);
  }

  _fastener(ctx, metric, role, position, axis = [0, 1, 0], subtype = 'bolt', options = {}) {
    const fallbackLength = subtype === 'anchor' ? 450 : subtype === 'stud' ? 100 : 70;
    const shankLength = Math.max(10, number(options.shankLengthMm, fallbackLength));
    const fastener = new Fastener(subtype, metric, shankLength, options);
    fastener.params.boltClass = options.boltClass || '8.8';
    const direction = new THREE.Vector3(...axis).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    return this._add(ctx, fastener, role, new THREE.Vector3(...position), quaternion);
  }

  _grid(rows, cols, spacingX, spacingY) {
    const coordinates = [];
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) coordinates.push({
      row, col, x: (col - (cols - 1) / 2) * spacingX, y: (row - (rows - 1) / 2) * spacingY,
    });
    return coordinates;
  }

  _holeDiameter(metric) {
    return (FASTENER_METRICS[metric]?.holeD || (FASTENER_METRICS[metric]?.d || 16) + 2) / 1000;
  }

  _holes(metric, coordinates) {
    const diameter = this._holeDiameter(metric);
    return coordinates.map(({ x, y }) => ({ x, y, diameter }));
  }

  _boltsOnPlate(ctx, plate, coordinates, metric, rolePrefix, axis, options = {}) {
    const direction = new THREE.Vector3(...axis).normalize();
    const lengthMm = Math.max(30, number(options.shankLengthMm, 70));
    plate.mesh.updateMatrixWorld(true);
    return coordinates.map((coordinate, index) => {
      const world = plate.mesh.localToWorld(new THREE.Vector3(coordinate.x, coordinate.y, 0));
      const origin = world.clone().addScaledVector(direction, -lengthMm / 2000);
      const bolt = this._fastener(ctx, metric, `${rolePrefix} ${index + 1}`, origin.toArray(), direction.toArray(), 'bolt', {
        assemblyMode: 'through-bolt', shankLengthMm: lengthMm, boltClass: options.boltClass || '8.8',
      });
      if (bolt) { bolt.params.row = coordinate.row; bolt.params.col = coordinate.col; }
      return bolt;
    }).filter(Boolean);
  }

  _registerBoltGroup(plate, bolts, options = {}) {
    const list = (bolts || []).filter(Boolean);
    if (!plate || !list.length) return null;
    const rows = Math.max(1, Math.round(number(options.rows, 1)));
    const cols = Math.max(1, Math.round(number(options.cols, list.length)));
    const groupId = options.id || `${plate.params.assemblyId || plate.id}_bolts`;
    list.forEach((bolt, index) => {
      bolt.params.boltGroupId = groupId;
      bolt.params.hostPlateId = plate.id;
      bolt.params.row = Number.isInteger(bolt.params.row) ? bolt.params.row : Math.floor(index / cols);
      bolt.params.col = Number.isInteger(bolt.params.col) ? bolt.params.col : index % cols;
      bolt.params.boltClass = options.boltClass || bolt.params.boltClass || '8.8';
      this._refreshUserData(bolt);
    });
    plate.params.boltGroup = {
      id: groupId, rows, cols, spacingX: Math.max(0.001, number(options.spacingX, 0.08)),
      spacingY: Math.max(0.001, number(options.spacingY, 0.08)), metric: options.metric || list[0].params.metric || 'M16',
      boltClass: options.boltClass || list[0].params.boltClass || '8.8', boltIds: list.map(item => item.id),
    };
    this._refreshUserData(plate);
    return groupId;
  }
  _baseAssembly(ctx,x,z,options={}) { return baseAssembly(this,ctx,x,z,options); }

  _portalDuopitch(ctx) { portal(this,ctx,true); }

  _truss(ctx) { truss(this,ctx); }

  _portalFlat(ctx) { portal(this,ctx,false); }
  _endplate(ctx) { this._smartNode(ctx,false); }
  _smartNode(ctx,double=false) {
    const p=ctx.raw,cs=this._validSize('HEB',p.columnSize,'300'),bs=this._validSize('IPE',p.beamSize,'300'),c=new Profile('HEB',cs,4,'column');
    this._add(ctx,c,'Pilar continuo',new THREE.Vector3(0,2,0));
    for(const side of double?[1,-1]:[1]){
      const b=new Profile('IPE',bs,2.8,'beam');this._add(ctx,b,side===1?'Viga derecha':'Viga izquierda',new THREE.Vector3(0,2.4,side*(getProfileData('HEB',cs).h/2000+.02+1.4)));
      if(side<0){b.mesh.rotation.y=Math.PI;b.mesh.updateMatrixWorld(true);}
      const result=buildSmartConnection(c,b,{thicknessMm:number(p.plateThickness,.02)*1000,diameter:Number((p.metric||'M20').slice(1)),haunch:true});
      for(const part of result.parts){this.sceneManager.addObject(part);ctx.created.push(part);}
    }
  }

  _doubleCleat(ctx) { doubleCleat(this,ctx); }

  _baseplate(ctx) {
    const p = ctx.raw;
    const metric = p.metric || 'M20';
    const width = Math.max(0.24, number(p.plateWidth, 0.4));
    const thickness = Math.max(0.012, number(p.plateThickness, 0.02));
    this._baseAssembly(ctx, 0, 0, { width, thickness, metric, rolePrefix: 'Placa base rígida', embedmentMm: 450, columnSize:p.columnSize||'200' });
    this._member(ctx, [0, thickness, 0], [0, 1.8, 0], 'HEB', p.columnSize || '200', 'Pilar');
  }

  _beamSplice(ctx) {
    const p = ctx.raw;
    const metric = p.metric || 'M20';
    const size = this._validSize('IPE', p.beamSize, '300');
    const thickness = Math.max(0.008, number(p.plateThickness, 0.012));
    const data = getProfileData('IPE', size) || getProfileData('IPE', '300');
    const h = data.h / 1000;
    const b = data.b / 1000;
    const tw = data.tw / 1000;
    const tf = data.tf / 1000;
    const beamY = 1.6;
    const gap = 0.02;
    this._member(ctx, [-3, beamY, 0], [-gap / 2, beamY, 0], 'IPE', size, 'Viga izquierda');
    this._member(ctx, [gap / 2, beamY, 0], [3, beamY, 0], 'IPE', size, 'Viga derecha');
    const webHeight = Math.max(0.18, h - 2 * tf - 0.045);
    const webSpacingY = Math.min(0.075, webHeight / 4.5);
    const webCoordinates = this._grid(4, 2, 0.24, webSpacingY);
    const webHoles = this._holes(metric, webCoordinates);
    const rear = this._plate(ctx, 'splice-plate', 0.52, webHeight, thickness, 'Cubrejunta posterior de alma', [0, beamY, -(tw / 2 + thickness / 2)], [0, Math.PI, 0], { holes: webHoles, cornerRadius: 0.012, edgeBevel: 0.0008 });
    const front = this._plate(ctx, 'splice-plate', 0.52, webHeight, thickness, 'Cubrejunta frontal de alma', [0, beamY, tw / 2 + thickness / 2], [0, 0, 0], { holes: webHoles, cornerRadius: 0.012, edgeBevel: 0.0008 });
    const webBolts = this._boltsOnPlate(ctx, front, webCoordinates, metric, 'Tornillo de alma', [0, 0, 1], { shankLengthMm: 80 });
    const webGroup = this._registerBoltGroup(front, webBolts, { id: `${ctx.id}_splice_web`, rows: 4, cols: 2, spacingX: 0.24, spacingY: webSpacingY, metric });
    rear.params.companionBoltGroupId = webGroup;
    this._refreshUserData(rear);
    const flangeSpacingY = Math.min(0.07, b * 0.42);
    const flangeCoordinates = this._grid(2, 2, 0.22, flangeSpacingY);
    const flangeHoles = this._holes(metric, flangeCoordinates);
    const top = this._plate(ctx, 'splice-plate', 0.5, Math.max(0.11, b * 0.88), thickness, 'Cubrejunta de ala superior', [0, beamY + h / 2 + thickness / 2, 0], [-Math.PI / 2, 0, 0], { holes: flangeHoles, cornerRadius: 0.01, edgeBevel: 0.0008 });
    const bottom = this._plate(ctx, 'splice-plate', 0.5, Math.max(0.11, b * 0.88), thickness, 'Cubrejunta de ala inferior', [0, beamY - h / 2 - thickness / 2, 0], [-Math.PI / 2, 0, 0], { holes: flangeHoles, cornerRadius: 0.01, edgeBevel: 0.0008 });
    const topBolts = this._boltsOnPlate(ctx, top, flangeCoordinates, metric, 'Tornillo de ala superior', [0, 1, 0], { shankLengthMm: 65 });
    const bottomBolts = this._boltsOnPlate(ctx, bottom, flangeCoordinates, metric, 'Tornillo de ala inferior', [0, 1, 0], { shankLengthMm: 65 });
    this._registerBoltGroup(top, topBolts, { id: `${ctx.id}_splice_top`, rows: 2, cols: 2, spacingX: 0.22, spacingY: flangeSpacingY, metric });
    this._registerBoltGroup(bottom, bottomBolts, { id: `${ctx.id}_splice_bottom`, rows: 2, cols: 2, spacingX: 0.22, spacingY: flangeSpacingY, metric });
  }
  _bracedBayX(ctx) { bracedBay(this,ctx); }

  _castellatedBeam(ctx) { castellated(this,ctx); }

  _compositeColumn(ctx) {
    const p = ctx.raw;
    const height = Math.max(1.5, number(p.height, 4));
    const separation = clamp(number(p.separation, 0.48), 0.25, 1.2);
    const spacing = clamp(number(p.battenSpacing, 0.7), 0.3, 1.5);
    const size = this._validSize('UPN', p.channelSize, '200');
    const data = getProfileData('UPN', size) || getProfileData('UPN', '200');
    const depth = data.h / 1000;
    this._member(ctx, [-separation / 2, 0.024, 0], [-separation / 2, height-.009, 0], 'UPN', size, 'Montante canal izquierdo', { sectionRotation: 0 });
    this._member(ctx, [separation / 2, 0.024, 0], [separation / 2, height-.009, 0], 'UPN', size, 'Montante canal derecho', { sectionRotation: 180 });
    const count = Math.max(2, Math.floor((height - 0.5) / spacing) + 1);
    for (let index = 0; index < count; index++) {
      const y = 0.3 + index * (height - 0.6) / Math.max(1, count - 1);
      this._plate(ctx, 'gusset-square', separation + 0.16, 0.14, 0.012, `Presilla frontal ${index + 1}`, [0, y, depth / 2 + 0.006], [0, 0, 0], { cornerRadius: 0.012, edgeBevel: 0.0007 });
      this._plate(ctx, 'gusset-square', separation + 0.16, 0.14, 0.012, `Presilla posterior ${index + 1}`, [0, y, -depth / 2 - 0.006], [0, Math.PI, 0], { cornerRadius: 0.012, edgeBevel: 0.0007 });
    }
    this._plate(ctx, 'base', separation + 0.3, depth + 0.18, 0.024, 'Placa base de pilar compuesto', [0, 0.012, 0], [-Math.PI / 2, 0, 0], { cornerRadius: 0.018, edgeBevel: 0.001 });
    this._plate(ctx, 'gusset-square', separation + 0.22, depth + 0.12, 0.018, 'Chapa de cabeza', [0, height, 0], [-Math.PI / 2, 0, 0], { cornerRadius: 0.015, edgeBevel: 0.0008 });
  }
  _expansionJoint(ctx) { expansionJoint(this,ctx); }

  _steelDeckStuds(ctx) { steelDeck(this,ctx); }

  _rigidHaunchedNode(ctx) { this._smartNode(ctx,true); }

  openBoltMatrix(plate = this.getSelected()) {
    if (!plate || plate.type !== 'plate') {
      this.toast('Seleccione primero una placa para crear la matriz de tornillos.');
      return;
    }
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<section class="bolt-matrix-dialog" role="dialog" aria-modal="true">
      <header><div><span class="eyebrow">GENERADOR N × M</span><h2>Matriz de tornillos</h2></div><button type="button" data-close>×</button></header>
      <div class="bolt-matrix-grid">
        <label>Filas N<input name="rows" type="number" min="1" max="12" value="2"></label>
        <label>Columnas M<input name="cols" type="number" min="1" max="12" value="2"></label>
        <label>Paso X (mm)<input name="sx" type="number" min="30" value="100"></label>
        <label>Paso Y (mm)<input name="sy" type="number" min="30" value="100"></label>
        <label>Métrica<select name="metric"><option>M16</option><option selected>M20</option><option>M24</option><option>M30</option></select></label>
        <label>Clase<select name="boltClass"><option selected>8.8</option><option>10.9</option></select></label>
      </div>
      <p class="dialog-note">TALLER-02: mínimos geométricos de borde y paso. Se valida el contorno real. Una matriz nueva sustituye la anterior.</p>
      <footer><button type="button" class="btn-secondary" data-close>Cancelar</button><button type="button" class="btn-primary" data-create>Crear matriz</button></footer>
    </section>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', close));
    overlay.querySelector('[data-create]').addEventListener('click', () => {
      const read = name => overlay.querySelector(`[name="${name}"]`).value;
      try { this.generateBoltMatrix(plate, {
        rows: Number(read('rows')), cols: Number(read('cols')),
        spacingX: Number(read('sx')) / 1000, spacingY: Number(read('sy')) / 1000,
        metric: read('metric'), boltClass: read('boltClass'),
      });
      close(); } catch(error) { this.toast(error.message,6000); }
    });
  }

  generateBoltMatrix(plate, options = {}) {
    const rows = clamp(Math.round(number(options.rows, 2)), 1, 12);
    const cols = clamp(Math.round(number(options.cols, 2)), 1, 12);
    const spacingX = Math.max(0.03, number(options.spacingX, 0.1));
    const spacingY = Math.max(0.03, number(options.spacingY, 0.1));
    const metric = options.metric || 'M20';
    const boltClass = options.boltClass || '8.8';
    const groupId = `bolts_${Date.now().toString(36)}_${++this._counter}`;
    if(['cleat','folded'].includes(plate.params.subtype))throw new Error('Seleccione una chapa plana para perforar.');
    const diameter=Number(metric.slice(1)),holeD=FASTENER_METRICS[metric]?.holeD;
    if(!holeD)throw new Error('Métrica no disponible.');
    boltLayout({width:plate.params.width*1000,height:plate.params.height*1000,diameter,rows,cols,edge:1.5*holeD,pitchX:spacingX*1000,pitchY:spacingY*1000});
    const coordinates = this._grid(rows, cols, spacingX, spacingY);
    const holes=this._holes(metric,coordinates).map(h=>({...h,matrixGenerated:true}));
    const oldGroup=plate.params.boltGroup;
    const existingHoles = (plate.params.holes || []).filter(h=>!h.matrixGenerated && !(oldGroup&&this._grid(oldGroup.rows,oldGroup.cols,oldGroup.spacingX,oldGroup.spacingY).some(p=>Math.hypot(p.x-h.x,p.y-h.y)<1e-6)));
    validateHolesInContour(plate._outlinePoints(),[...existingHoles,...holes]);
    this.sceneManager.objects.filter(o=>o.params.hostPlateId===plate.id).forEach(o=>this.sceneManager.removeObject(o));
    plate.update({ holes: [...existingHoles, ...holes] });
    plate.mesh.updateMatrixWorld(true);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(plate.mesh.getWorldQuaternion(new THREE.Quaternion())).normalize();
    const metricData=FASTENER_METRICS[metric];
    const lengthMm = plate.params.thickness*1000+metricData.nutH+2*metricData.washerT;
    const created = coordinates.map(coordinate => {
      const world = plate.mesh.localToWorld(new THREE.Vector3(coordinate.x, coordinate.y, 0));
      const origin = world.clone().addScaledVector(normal, -plate.params.thickness/2-(metricData.nutH+metricData.washerT)/1000);
      const bolt = new Fastener('bolt', metric, lengthMm, { assemblyMode: 'through-bolt' });
      bolt.params.boltClass = boltClass;
      bolt.params.boltGroupId = groupId;
      bolt.params.hostPlateId = plate.id;
      bolt.params.hostLocal = [coordinate.x,coordinate.y,-plate.params.thickness/2-(metricData.nutH+metricData.washerT)/1000];
      bolt.params.row = coordinate.row;
      bolt.params.col = coordinate.col;
      this.sceneManager?.addObject?.(bolt);
      bolt.mesh.position.copy(origin);
      bolt.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      bolt.mesh.updateMatrixWorld(true);
      this._refreshUserData(bolt);
      return bolt;
    });
    plate.params.boltGroup = { id: groupId, rows, cols, spacingX, spacingY, metric, boltClass, boltIds: created.map(item => item.id) };
    this._refreshUserData(plate);
    this.onCommit?.(created, { instanceId: groupId, presetId: 'bolt-matrix', parameters: plate.params.boltGroup });
    this.onSelect?.(plate);
    this.toast(`Matriz ${rows}×${cols} creada · ${created.length} tornillos ${metric}`);
    return created;
  }
}

export { STRUCTURE_PRESETS, CONNECTION_PRESETS, SCHEMAS };
