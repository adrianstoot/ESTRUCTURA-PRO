import * as THREE from 'three';

/**
 * Broad-phase clash detector for BIM elements.
 *
 * It intentionally reports volumetric AABB penetration only: faces that merely
 * touch are not clashes. Rotated or concave profiles may require a later OBB or
 * triangle/BVH narrow phase, but this module provides a deterministic warning
 * layer with explicit exclusions and no external dependency.
 */
export class ClashDetector {
  constructor(sceneManager, options = {}) {
    this.sceneManager = sceneManager;
    this.tolerance = Math.max(0, Number(options.tolerance ?? 0.001));
    this.includeInvisible = !!options.includeInvisible;
    this.excludeSameConnection = options.excludeSameConnection !== false;
    this.excludeTypes = new Set(options.excludeTypes || ['weld']);
    this.excludeIds = new Set(options.excludeIds || []);
    this.excludePairs = new Set();
    this.shouldExclude = typeof options.shouldExclude === 'function'
      ? options.shouldExclude
      : null;

    for (const pair of options.excludePairs || []) {
      if (Array.isArray(pair)) this.addExcludedPair(pair[0], pair[1]);
      else if (typeof pair === 'string') this.excludePairs.add(pair);
    }
  }

  configure(options = {}) {
    if (options.tolerance != null) {
      this.tolerance = Math.max(0, Number(options.tolerance) || 0);
    }
    if (options.includeInvisible != null) this.includeInvisible = !!options.includeInvisible;
    if (options.excludeSameConnection != null) {
      this.excludeSameConnection = !!options.excludeSameConnection;
    }
    if (options.excludeTypes) this.excludeTypes = new Set(options.excludeTypes);
    if (options.excludeIds) this.excludeIds = new Set(options.excludeIds);
    if (typeof options.shouldExclude === 'function') this.shouldExclude = options.shouldExclude;
    return this;
  }

  addExcludedPair(first, second) {
    const key = this._pairKey(first, second);
    if (key) this.excludePairs.add(key);
    return key;
  }

  removeExcludedPair(first, second) {
    const key = this._pairKey(first, second);
    return key ? this.excludePairs.delete(key) : false;
  }

  clearExcludedPairs() {
    this.excludePairs.clear();
  }

  /** Return clashes involving a target BIMElement or its id. */
  detect(targetOrId, options = {}) {
    const target = this._resolveObject(targetOrId);
    if (!target?.mesh) return [];

    this.sceneManager.scene?.updateMatrixWorld?.(true);
    const includeInvisible = options.includeInvisible ?? this.includeInvisible;
    const targetBox = this._worldBox(target, includeInvisible);
    if (!targetBox) return [];

    const results = [];
    const objects = options.objects || this.sceneManager.objects || [];
    for (const other of objects) {
      if (!other?.mesh || other === target) continue;
      if (this._isExcluded(target, other, options)) continue;
      const otherBox = this._worldBox(other, includeInvisible);
      if (!otherBox) continue;
      const result = this._intersectionResult(target, targetBox, other, otherBox, options);
      if (result) results.push(result);
    }
    return results.sort((left, right) => right.volume - left.volume);
  }

  // Integration-friendly alias.
  detectClashes(targetOrId, options = {}) {
    return this.detect(targetOrId, options);
  }

  hasClash(targetOrId, options = {}) {
    return this.detect(targetOrId, options).length > 0;
  }

  /** Return every unique pair in the scene. */
  detectAll(options = {}) {
    const objects = (options.objects || this.sceneManager.objects || [])
      .filter((item) => item?.mesh);
    this.sceneManager.scene?.updateMatrixWorld?.(true);
    const boxes = new Map();
    const getBox = (object) => {
      if (!boxes.has(object)) {
        const includeInvisible = options.includeInvisible ?? this.includeInvisible;
        boxes.set(object, this._worldBox(object, includeInvisible));
      }
      return boxes.get(object);
    };
    const results = [];

    for (let firstIndex = 0; firstIndex < objects.length; firstIndex += 1) {
      const first = objects[firstIndex];
      const firstBox = getBox(first);
      if (!firstBox) continue;
      for (let secondIndex = firstIndex + 1; secondIndex < objects.length; secondIndex += 1) {
        const second = objects[secondIndex];
        if (this._isExcluded(first, second, options)) continue;
        const secondBox = getBox(second);
        if (!secondBox) continue;
        const result = this._intersectionResult(first, firstBox, second, secondBox, options);
        if (result) results.push(result);
      }
    }
    return results.sort((left, right) => right.volume - left.volume);
  }

  _resolveObject(value) {
    if (value && typeof value === 'object') return value;
    return (this.sceneManager.objects || []).find((item) => item.id === value) || null;
  }

  _worldBox(object, includeInvisible = this.includeInvisible) {
    if (!object?.mesh) return null;
    if (!includeInvisible && !this._isWorldVisible(object.mesh)) return null;
    object.mesh.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(object.mesh, true);
    return box.isEmpty() ? null : box;
  }

  _intersectionResult(first, firstBox, second, secondBox, options) {
    if (!firstBox.intersectsBox(secondBox)) return null;
    const tolerance = Math.max(0, Number(options.tolerance ?? this.tolerance));
    const min = new THREE.Vector3(
      Math.max(firstBox.min.x, secondBox.min.x),
      Math.max(firstBox.min.y, secondBox.min.y),
      Math.max(firstBox.min.z, secondBox.min.z),
    );
    const max = new THREE.Vector3(
      Math.min(firstBox.max.x, secondBox.max.x),
      Math.min(firstBox.max.y, secondBox.max.y),
      Math.min(firstBox.max.z, secondBox.max.z),
    );
    const penetration = max.clone().sub(min);
    if (
      penetration.x <= tolerance ||
      penetration.y <= tolerance ||
      penetration.z <= tolerance
    ) return null;

    return {
      first,
      second,
      target: first,
      other: second,
      pairKey: this._pairKey(first, second),
      penetration,
      volume: penetration.x * penetration.y * penetration.z,
      box: new THREE.Box3(min, max),
      broadPhase: 'AABB',
    };
  }

  _isExcluded(first, second, options) {
    const includeInvisible = options.includeInvisible ?? this.includeInvisible;
    if (!includeInvisible && (!this._isWorldVisible(first.mesh) || !this._isWorldVisible(second.mesh))) {
      return true;
    }

    const excludedTypes = options.excludeTypes
      ? new Set(options.excludeTypes)
      : this.excludeTypes;
    if (excludedTypes.has(first.type) || excludedTypes.has(second.type)) return true;

    const excludedIds = options.excludeIds ? new Set(options.excludeIds) : this.excludeIds;
    if (excludedIds.has(first.id) || excludedIds.has(second.id)) return true;

    const pairKey = this._pairKey(first, second);
    const excludedPairs = options.excludePairs
      ? this._normalizePairSet(options.excludePairs)
      : this.excludePairs;
    if (pairKey && excludedPairs.has(pairKey)) return true;

    const excludeSameConnection = options.excludeSameConnection ?? this.excludeSameConnection;
    if (excludeSameConnection) {
      const firstConnection = this._connectionId(first);
      const secondConnection = this._connectionId(second);
      if (firstConnection && firstConnection === secondConnection) return true;
    }

    if (this._allowsPair(first, second) || this._allowsPair(second, first)) return true;
    const custom = options.shouldExclude || this.shouldExclude;
    return !!custom?.(first, second);
  }

  _normalizePairSet(pairs) {
    const result = new Set();
    for (const pair of pairs || []) {
      if (Array.isArray(pair)) {
        const key = this._pairKey(pair[0], pair[1]);
        if (key) result.add(key);
      } else if (typeof pair === 'string') {
        result.add(pair);
      }
    }
    return result;
  }

  _allowsPair(owner, other) {
    const allowed = owner?.allowClashWith || owner?.params?.allowClashWith;
    return Array.isArray(allowed) && allowed.includes(other?.id);
  }

  _connectionId(object) {
    return object?.connectionId || object?.params?.connectionId || object?.params?.assemblyId || object?.params?.templateInstanceId || object?.userData?.connectionId || null;
  }

  _pairKey(first, second) {
    const firstId = typeof first === 'string' ? first : first?.id || first?.mesh?.uuid;
    const secondId = typeof second === 'string' ? second : second?.id || second?.mesh?.uuid;
    if (!firstId || !secondId || firstId === secondId) return null;
    return [String(firstId), String(secondId)].sort().join('::');
  }

  _isWorldVisible(object) {
    let current = object;
    while (current) {
      if (!current.visible) return false;
      current = current.parent;
    }
    return true;
  }
}

export function detectAABBClashes(sceneManager, targetOrId, options = {}) {
  return new ClashDetector(sceneManager, options).detect(targetOrId, options);
}
