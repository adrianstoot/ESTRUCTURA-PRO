import { Profile } from '../entities/Profile.js';
import { Plate } from '../entities/Plate.js';
import { Fastener } from '../entities/Fastener.js';
import { Reinforcement } from '../entities/Reinforcement.js';
import { Weld } from '../entities/Weld.js';
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

export function serializeBIMObject(object) {
  const mesh = object?.mesh;
  const state = {
    id: object.id, type: object.type, params: clone(object.params || {}),
    position: mesh?.position?.toArray?.() || [0, 0, 0],
    quaternion: mesh?.quaternion?.toArray?.() || [0, 0, 0, 1],
    scale: mesh?.scale?.toArray?.() || [1, 1, 1], visible: mesh?.visible !== false,
    color: object.color, steelGrade: object.steelGrade,
  };
  if (object.type === 'weld' && object.serializeEndpoints) state.weld = object.serializeEndpoints();
  return state;
}

export function createBIMObjectFromState(state = {}) {
  const p = state.params || {};
  let object = null;
  if (state.type === 'profile') object = new Profile(p.series, p.size, p.length, p.orientation, p);
  else if (state.type === 'plate') { object = new Plate(p.subtype, p.width, p.height, p.thickness); object.update(p); }
  else if (state.type === 'fastener') { object = new Fastener(p.subtype, p.metric, p.shankLength); object.update(p); }
  else if (state.type === 'reinforcement') object = new Reinforcement(p);
  else if (state.type === 'weld') object = Weld.fromState(state.weld || {
    pointA: p.pointA, pointB: p.pointB, radius: p.radius, bindings: p.bindings,
  });
  if (!object) return null;
  object.params = { ...object.params, ...clone(p) };
  if (state.steelGrade) object.steelGrade = state.steelGrade;
  if (object.type === 'profile' && state.steelGrade) object.update(object.params);
  object.restoreId?.(state.id);
  if (state.color) object.setColor(state.color);
  object._applyUserData?.();
  return object;
}

export function restoreBIMObject(state, sceneManager) {
  const object = createBIMObjectFromState(state);
  if (!object) return null;
  applyTransform(object, state);
  sceneManager.addObject(object);
  return object;
}

function applyTransform(object, state) {
  if (object.type !== 'weld') {
    if (state.position) object.mesh.position.fromArray(state.position);
    if (state.quaternion) object.mesh.quaternion.fromArray(state.quaternion);
    else if (state.rotation) object.mesh.rotation.set(...state.rotation);
    if (state.scale) object.mesh.scale.fromArray(state.scale);
  }
  object.mesh.visible = state.visible !== false;
  object.mesh.updateMatrixWorld(true);
  object._applyUserData?.();
}

export function serializeProject(objects = [], metadata = {}) {
  return { format: 'estructuras-pro', version: '7.0', units: { internal: 'm', display: 'mm' }, project: metadata.project || 'Sin título',
    date: metadata.date || new Date().toISOString(), settings: clone(metadata.settings || {}),
    measurements: clone(metadata.measurements || []), objects: objects.map(serializeBIMObject) };
}

export function restoreProject(data, sceneManager, { clear = true } = {}) {
  if (!data || !Array.isArray(data.objects)) throw new Error('El archivo no contiene un proyecto válido.');
  const restored = [], ids = new Set(clear ? [] : sceneManager.objects.map(o => o.id));
  try {
    for (const state of data.objects) {
      validateState(state);
      if (state.id && ids.has(state.id)) throw new Error('ID de pieza duplicado: ' + state.id);
      if (state.id) ids.add(state.id);
      const object = createBIMObjectFromState(state);
      if (!object) throw new Error('Tipo de pieza no compatible: ' + state.type);
      restored.push(object);
      applyTransform(object, state);
    }
  } catch (error) {
    restored.forEach(o => o._disposeMesh());
    throw error;
  }
  // Build every piece before replacing the existing project. Invalid files are atomic.
  if (clear) sceneManager.objects.slice().forEach(object => sceneManager.removeObject(object));
  restored.forEach(object => sceneManager.addObject(object));
  const resolver = id => sceneManager.objects.find(object => object.id === id);
  restored.filter(object => object.type === 'weld').forEach(weld => weld.updateFromBindings?.(resolver));
  return restored;
}

export function validateState(state) {
  if (!state || !['profile','plate','fastener','reinforcement','weld'].includes(state.type)) throw new Error('Tipo de pieza no compatible.');
  for (const [key, count] of [['position',3],['quaternion',4],['rotation',3],['scale',3]]) {
    const values=state[key];
    if (values != null && (!Array.isArray(values) || values.length!==count || values.some(n=>typeof n!=='number'||!Number.isFinite(n)))) throw new Error('Transformación no válida: '+key);
  }
  if (state.scale?.some(n=>n<=0)) throw new Error('La escala debe ser positiva.');
  if (state.quaternion && Math.hypot(...state.quaternion)<1e-10) throw new Error('Rotación no válida.');
  const p=state.params||{};
  for (const key of ['length','width','height','thickness','diameterMm','shankLength','throat','radius']) {
    if (p[key]!=null && (!Number.isFinite(p[key]) || p[key]<=0)) throw new Error('Dimensión no válida: '+key);
  }
  for (const key of ['pointA','pointB']) { const point=state.weld?.[key]||p[key]; if(point && (!Array.isArray(point)||point.length!==3||point.some(n=>!Number.isFinite(n)))) throw new Error('Extremo de soldadura no válido.'); }
}
