import { Profile } from '../entities/Profile.js';
import { Plate } from '../entities/Plate.js';
import { Fastener } from '../entities/Fastener.js';
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
    analysisInput: clone(object.analysisInput), analysisResults: clone(object.analysisResults),
    connectionInput: clone(object.connectionInput),
  };
  if (object.type === 'weld' && object.serializeEndpoints) state.weld = object.serializeEndpoints();
  return state;
}

export function createBIMObjectFromState(state = {}) {
  const p = state.params || {};
  let object = null;
  if (state.type === 'profile') object = new Profile(p.series, p.size, p.length, p.orientation, {
    sectionRotation: p.sectionRotation, insertionPoint: p.insertionPoint, role: p.role,
    assemblyId: p.assemblyId, templateInstanceId: p.templateInstanceId,
  });
  else if (state.type === 'plate') { object = new Plate(p.subtype, p.width, p.height, p.thickness); object.update(p); }
  else if (state.type === 'fastener') { object = new Fastener(p.subtype, p.metric, p.shankLength); object.update(p); }
  else if (state.type === 'weld') object = Weld.fromState(state.weld || {
    pointA: p.pointA, pointB: p.pointB, radius: p.radius, bindings: p.bindings,
  });
  if (!object) return null;
  object.params = { ...object.params, ...clone(p) };
  if (state.steelGrade) object.steelGrade = state.steelGrade;
  if (object.type === 'profile' && state.steelGrade) object.update(object.params);
  object.restoreId?.(state.id);
  if (state.color) object.setColor(state.color);
  object.analysisInput = clone(state.analysisInput) || null;
  object.analysisResults = clone(state.analysisResults) || null;
  object.connectionInput = clone(state.connectionInput) || null;
  object._applyUserData?.();
  return object;
}

export function restoreBIMObject(state, sceneManager) {
  const object = createBIMObjectFromState(state);
  if (!object) return null;
  sceneManager.addObject(object);
  if (object.type !== 'weld') {
    if (state.position) object.mesh.position.fromArray(state.position);
    if (state.quaternion) object.mesh.quaternion.fromArray(state.quaternion);
    else if (state.rotation) object.mesh.rotation.set(...state.rotation);
    if (state.scale) object.mesh.scale.fromArray(state.scale);
  }
  object.mesh.visible = state.visible !== false;
  object.mesh.updateMatrixWorld(true);
  object._applyUserData?.();
  return object;
}

export function serializeProject(objects = [], metadata = {}) {
  return { format: 'estructuras-pro', version: '5.0', project: metadata.project || 'Sin título',
    date: metadata.date || new Date().toISOString(), settings: clone(metadata.settings || {}),
    objects: objects.map(serializeBIMObject) };
}

export function restoreProject(data, sceneManager, { clear = true } = {}) {
  if (!data || !Array.isArray(data.objects)) return [];
  if (clear) sceneManager.objects.slice().forEach(object => sceneManager.removeObject(object));
  const restored = data.objects.map(state => restoreBIMObject(state, sceneManager)).filter(Boolean);
  const resolver = id => sceneManager.objects.find(object => object.id === id);
  restored.filter(object => object.type === 'weld').forEach(weld => weld.updateFromBindings?.(resolver));
  return restored;
}