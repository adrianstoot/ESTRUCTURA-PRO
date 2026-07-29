import * as THREE from 'three';

const SNAP_COLORS = {
  vertex: '#22d98f',
  midpoint: '#ffb020',
  edge: '#ffd166',
  face: '#ff6b55',
  grid: '#4f8cff',
};

/**
 * SnapManager - Screen-space CAD snapping with a fixed 10 px cursor.
 * Supports feature vertices/endpoints, edge midpoints, nearest edge points,
 * faces, grid points, and optional orthogonal constraints.
 */
export class SnapManager {
  constructor(sceneManager, gridManager) {
    this.sceneManager = sceneManager;
    this.gridManager = gridManager;
    this.enabled = true;
    this.orthoLock = false;
    this.snapToVertex = true;
    this.snapToEdge = true;
    this.snapToMidpoint = true;
    this.snapToFace = true;
    this.snapToGrid = true;
    this.gridSnap = 0.25;
    this.snapRadiusPx = 9;
    this.markerSizePx = 10;

    // Kept as a compatibility handle for callers that referenced markerGroup.
    // The visible marker is DOM-based so it stays discreet at every zoom.
    this.markerGroup = new THREE.Group();
    this.markerGroup.name = 'SnapCrosshair';
    this.markerGroup.visible = false;
    this.sceneManager.scene.add(this.markerGroup);

    this.lastSnap = null;
    this.lastSnapInfo = null;
    this.snapType = null;
    this._referencePoint = null;
    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();
    this._pointerPx = new THREE.Vector2();
    this._featureCache = new WeakMap();
    this._ownerCache = new WeakMap();
    this._lastEventKey = '';
    this._rect = null;
    this._screenMarker = this._createScreenMarker();
    this._onPointerLeave = () => this._clearSnap();
    this.sceneManager.renderer?.domElement?.addEventListener(
      'pointerleave', this._onPointerLeave);
  }

  _createScreenMarker() {
    if (typeof document === 'undefined') return null;
    const parent = this.sceneManager.renderer?.domElement?.parentElement || this.sceneManager.container;
    if (!parent) return null;

    const marker = document.createElement('div');
    marker.className = 'snap-cursor-marker';
    marker.setAttribute('aria-hidden', 'true');
    Object.assign(marker.style, {
      position: 'absolute',
      display: 'none',
      width: `${this.markerSizePx}px`,
      height: `${this.markerSizePx}px`,
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
      zIndex: '1001',
      color: SNAP_COLORS.grid,
      filter: 'drop-shadow(0 0 2px rgba(0,0,0,.9))',
    });
    marker.innerHTML = `
      <svg viewBox="0 0 12 12" width="100%" height="100%" fill="none" aria-hidden="true">
        <circle cx="6" cy="6" r="3.25" stroke="currentColor" stroke-width="1"/>
        <path d="M6 0.75v2M6 9.25v2M0.75 6h2M9.25 6h2" stroke="currentColor" stroke-width="1" stroke-linecap="square"/>
        <circle cx="6" cy="6" r="0.8" fill="currentColor"/>
      </svg>`;
    parent.appendChild(marker);
    return marker;
  }

  setEnabled(value) {
    this.enabled = !!value;
    if (!this.enabled) {
      this._referencePoint = null;
      this._clearSnap(false);
      if (typeof document !== 'undefined') {
        document.getElementById('snap-indicator')?.classList.add('hidden');
      }
    }
    this._emitSnapChange(true);
  }

  setReferencePoint(point) {
    this._referencePoint = point ? point.clone() : null;
  }

  update(event) {
    if (!this.enabled) return null;
    const canvas = this.sceneManager.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      this._clearSnap();
      return null;
    }

    this._rect = rect;
    this._mouse.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this._pointerPx.set(event.clientX - rect.left, event.clientY - rect.top);
    this.sceneManager.camera.updateMatrixWorld(true);
    this.sceneManager.scene.updateMatrixWorld(true);
    this._raycaster.setFromCamera(this._mouse, this.sceneManager.camera);

    const featureSnaps = this._findFeatureSnaps();
    if (this.snapToVertex && featureSnaps.vertex) return this._commitSnap(featureSnaps.vertex);
    if (this.snapToEdge && this.snapToMidpoint && featureSnaps.midpoint) {
      return this._commitSnap(featureSnaps.midpoint);
    }
    if (this.snapToEdge && featureSnaps.edge) return this._commitSnap(featureSnaps.edge);

    if (this.snapToFace) {
      const hits = this._raycaster.intersectObjects(this.sceneManager.getSelectableObjects(), true);
      const hit = hits.find((item) => this._isWorldVisible(item.object));
      if (hit) {
        const bimObject = this._findBIMObjectFromMesh(hit.object);
        const normal = hit.face?.normal
          ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
          : null;
        return this._commitSnap({
          point: hit.point.clone(),
          type: 'face',
          feature: 'face',
          bimObject,
          normal,
          distancePx: 0,
        });
      }
    }

    if (this.snapToGrid) {
      const ground = this.gridManager?.getGroundPlane?.();
      if (ground) {
        const hits = this._raycaster.intersectObject(ground, false);
        if (hits.length) {
          const point = hits[0].point.clone();
          point.x = Math.round(point.x / this.gridSnap) * this.gridSnap;
          point.y = 0;
          point.z = Math.round(point.z / this.gridSnap) * this.gridSnap;
          return this._commitSnap({
            point,
            type: 'grid',
            feature: 'grid',
            bimObject: null,
            normal: new THREE.Vector3(0, 1, 0),
            distancePx: 0,
          });
        }
      }
    }

    this._clearSnap();
    return null;
  }

  _findFeatureSnaps() {
    const best = { vertex: null, midpoint: null, edge: null };
    const selectables = this.sceneManager.getSelectableObjects();

    for (const mesh of selectables) {
      if (!mesh.geometry || !this._isWorldVisible(mesh)) continue;
      const features = this._getGeometryFeatures(mesh.geometry);
      if (!features.edges.length) continue;
      const bimObject = this._findBIMObjectFromMesh(mesh);

      if (this.snapToVertex) {
        for (const localPoint of features.vertices) {
          const worldPoint = localPoint.clone().applyMatrix4(mesh.matrixWorld);
          const candidate = this._pointCandidate(worldPoint, 'vertex', 'endpoint', bimObject);
          if (candidate && (!best.vertex || candidate.distancePx < best.vertex.distancePx)) {
            best.vertex = candidate;
          }
        }
      }

      if (!this.snapToEdge) continue;
      for (const edge of features.edges) {
        const worldA = edge[0].clone().applyMatrix4(mesh.matrixWorld);
        const worldB = edge[1].clone().applyMatrix4(mesh.matrixWorld);

        if (this.snapToMidpoint) {
          const midpoint = new THREE.Vector3().addVectors(worldA, worldB).multiplyScalar(0.5);
          const candidate = this._pointCandidate(midpoint, 'midpoint', 'midpoint', bimObject);
          if (candidate && (!best.midpoint || candidate.distancePx < best.midpoint.distancePx)) {
            best.midpoint = candidate;
          }
        }

        const candidate = this._edgeCandidate(worldA, worldB, bimObject);
        if (candidate && (!best.edge || candidate.distancePx < best.edge.distancePx)) {
          best.edge = candidate;
        }
      }
    }
    return best;
  }

  /** Build real feature edges for indexed and non-indexed BufferGeometry. */
  _getGeometryFeatures(geometry) {
    const cached = this._featureCache.get(geometry);
    if (cached) return cached;

    const edgeGeometry = new THREE.EdgesGeometry(geometry, 20);
    const positions = edgeGeometry.attributes.position;
    const edges = [];
    const vertexMap = new Map();
    const addVertex = (point) => {
      const key = `${Math.round(point.x * 1e6)}:${Math.round(point.y * 1e6)}:${Math.round(point.z * 1e6)}`;
      if (!vertexMap.has(key)) vertexMap.set(key, point.clone());
    };

    if (positions) {
      for (let index = 0; index + 1 < positions.count; index += 2) {
        const a = new THREE.Vector3().fromBufferAttribute(positions, index);
        const b = new THREE.Vector3().fromBufferAttribute(positions, index + 1);
        if (a.distanceToSquared(b) < 1e-16) continue;
        edges.push([a, b]);
        addVertex(a);
        addVertex(b);
      }
    }
    edgeGeometry.dispose();

    const result = { edges, vertices: Array.from(vertexMap.values()) };
    this._featureCache.set(geometry, result);
    return result;
  }

  _pointCandidate(worldPoint, type, feature, bimObject) {
    const screen = this._projectToScreen(worldPoint);
    if (!screen) return null;
    const distancePx = Math.hypot(
      screen.x - this._pointerPx.x,
      screen.y - this._pointerPx.y,
    );
    if (distancePx > this.snapRadiusPx) return null;
    return { point: worldPoint.clone(), type, feature, bimObject, normal: null, distancePx };
  }

  _edgeCandidate(worldA, worldB, bimObject) {
    const screenA = this._projectToScreen(worldA);
    const screenB = this._projectToScreen(worldB);
    if (!screenA || !screenB) return null;

    const dx = screenB.x - screenA.x;
    const dy = screenB.y - screenA.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq < 1e-8) return null;
    const t = THREE.MathUtils.clamp(
      ((this._pointerPx.x - screenA.x) * dx + (this._pointerPx.y - screenA.y) * dy) / lengthSq,
      0,
      1,
    );
    const px = screenA.x + dx * t;
    const py = screenA.y + dy * t;
    const distancePx = Math.hypot(px - this._pointerPx.x, py - this._pointerPx.y);
    if (distancePx > this.snapRadiusPx) return null;

    // Reproject the interpolated world point once. Perspective projection is
    // not linear, so this second check prevents distant false positives.
    const point = worldA.clone().lerp(worldB, t);
    const projected = this._projectToScreen(point);
    if (!projected) return null;
    const verifiedDistance = Math.hypot(
      projected.x - this._pointerPx.x,
      projected.y - this._pointerPx.y,
    );
    if (verifiedDistance > this.snapRadiusPx) return null;
    return {
      point,
      type: 'edge',
      feature: 'nearest-edge',
      bimObject,
      normal: null,
      distancePx: verifiedDistance,
    };
  }

  _projectToScreen(worldPoint) {
    if (!this._rect) return null;
    const projected = worldPoint.clone().project(this.sceneManager.camera);
    if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y) || projected.z < -1 || projected.z > 1) {
      return null;
    }
    return {
      x: (projected.x + 1) * 0.5 * this._rect.width,
      y: (1 - projected.y) * 0.5 * this._rect.height,
      z: projected.z,
    };
  }

  _commitSnap(candidate) {
    const point = this._applyOrthoConstraint(candidate.point);
    const bimObject = candidate.bimObject || null;
    const binding = bimObject ? this._makeBinding(bimObject, point) : null;

    this.lastSnap = point.clone();
    this.snapType = candidate.type;
    this.lastSnapInfo = {
      point: point.clone(),
      type: candidate.type,
      feature: candidate.feature || candidate.type,
      bimObject,
      objectId: bimObject?.id || null,
      binding,
      normal: candidate.normal?.clone() || null,
    };
    this._showScreenMarker(point, candidate.type);
    this._emitSnapChange();
    return this.lastSnap.clone();
  }

  _applyOrthoConstraint(sourcePoint) {
    const point = sourcePoint.clone();
    if (!this.orthoLock || !this._referencePoint) return point;

    const ref = this._referencePoint;
    const dx = Math.abs(point.x - ref.x);
    const dy = Math.abs(point.y - ref.y);
    const dz = Math.abs(point.z - ref.z);
    if (dx >= dy && dx >= dz) {
      point.y = ref.y;
      point.z = ref.z;
    } else if (dy >= dx && dy >= dz) {
      point.x = ref.x;
      point.z = ref.z;
    } else {
      point.x = ref.x;
      point.y = ref.y;
    }
    return point;
  }

  _makeBinding(bimObject, worldPoint) {
    if (!bimObject?.id || !bimObject.mesh) return null;
    bimObject.mesh.updateWorldMatrix(true, true);
    return {
      objectId: bimObject.id,
      localPoint: bimObject.mesh.worldToLocal(worldPoint.clone()).toArray(),
    };
  }

  _findBIMObjectFromMesh(mesh) {
    const cached = this._ownerCache.get(mesh);
    if (cached && this.sceneManager.objects.includes(cached)) return cached;
    let target = mesh;
    while (target && !target.userData?.bimId) target = target.parent;
    const id = target?.userData?.bimId;
    const owner = id ? this.sceneManager.objects.find((item) => item.id === id) || null : null;
    if (owner) this._ownerCache.set(mesh, owner);
    return owner;
  }

  _isWorldVisible(object) {
    let current = object;
    while (current) {
      if (!current.visible) return false;
      current = current.parent;
    }
    return true;
  }

  _showScreenMarker(worldPoint, type) {
    if (!this._screenMarker || !this._rect) return;
    const projected = this._projectToScreen(worldPoint);
    if (!projected) {
      this._screenMarker.style.display = 'none';
      return;
    }
    const parentRect = this._screenMarker.parentElement?.getBoundingClientRect?.() || { left: 0, top: 0 };
    this._screenMarker.style.left = `${this._rect.left - parentRect.left + projected.x}px`;
    this._screenMarker.style.top = `${this._rect.top - parentRect.top + projected.y}px`;
    this._screenMarker.style.color = SNAP_COLORS[type] || SNAP_COLORS.grid;
    this._screenMarker.style.display = 'block';
    this._screenMarker.dataset.snapType = type;
  }

  _clearSnap(emit = true) {
    this.markerGroup.visible = false;
    if (this._screenMarker) this._screenMarker.style.display = 'none';
    this.lastSnap = null;
    this.lastSnapInfo = null;
    this.snapType = null;
    if (emit) this._emitSnapChange();
  }

  _emitSnapChange(force = false) {
    const point = this.lastSnapInfo?.point || null;
    const detail = {
      enabled: this.enabled,
      type: this.snapType,
      feature: this.lastSnapInfo?.feature || null,
      point: point ? point.toArray() : null,
      objectId: this.lastSnapInfo?.objectId || null,
      binding: this.lastSnapInfo?.binding ? {
        objectId: this.lastSnapInfo.binding.objectId,
        localPoint: [...this.lastSnapInfo.binding.localPoint],
      } : null,
    };
    const key = JSON.stringify(detail);
    if (!force && key === this._lastEventKey) return;
    this._lastEventKey = key;

    const target = this.sceneManager.renderer?.domElement;
    if (target && typeof CustomEvent !== 'undefined') {
      target.dispatchEvent(new CustomEvent('snap-change', { detail, bubbles: true }));
    }
  }

  getSnapPoint() {
    return this.lastSnap;
  }

  getSnapInfo() {
    if (!this.lastSnapInfo) return null;
    return {
      ...this.lastSnapInfo,
      point: this.lastSnapInfo.point.clone(),
      normal: this.lastSnapInfo.normal?.clone() || null,
      binding: this.lastSnapInfo.binding ? {
        objectId: this.lastSnapInfo.binding.objectId,
        localPoint: [...this.lastSnapInfo.binding.localPoint],
      } : null,
    };
  }

  dispose() {
    this.sceneManager.renderer?.domElement?.removeEventListener(
      'pointerleave', this._onPointerLeave);
    this.sceneManager.scene.remove(this.markerGroup);
    this._screenMarker?.remove();
    this._screenMarker = null;
    this._clearSnap(false);
  }
}
