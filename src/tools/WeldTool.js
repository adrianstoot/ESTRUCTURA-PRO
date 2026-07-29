import * as THREE from 'three';
import { Weld } from '../entities/Weld.js';

const AXIS_THRESHOLD_DEG = 7;
const SPARK_COUNT = 32;
const clamp = THREE.MathUtils.clamp;

/**
 * Surface-aware two-click weld tool.
 * - Intelligent snap endpoints and near-axis straight assistance.
 * - Fixed, non-selectable laser pointer and 3D live preview.
 * - Short-lived molten glow, point light and GPU particle sparks.
 * - Escape or right click cancels the current bead.
 */
export class WeldTool {
  constructor(sceneManager, snapManager, onWeldCreated) {
    this.sceneManager = sceneManager;
    this.snapManager = snapManager;
    this.onWeldCreated = onWeldCreated;
    this.active = false;
    this.axisAssist = true;
    this.axisThresholdDeg = AXIS_THRESHOLD_DEG;
    this.radius = 0.005;
    this.pointA = null;
    this.normalA = null;
    this.bindingA = null;
    this._tempMarker = null;
    this._tempLine = null;
    this._previewGroup = null;
    this._previewBody = null;
    this._previewMarkers = null;
    this._laserGroup = null;
    this._laserLine = null;
    this._laserDot = null;
    this._effects = new Set();
    this._effectFrame = null;
    this._previousCursor = '';

    this._onKeyDown = event => {
      if (this.active && event.key === 'Escape') this.cancel();
    };
    this._onContextMenu = event => {
      if (!this.active) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.cancel();
    };
    if (typeof window !== 'undefined') window.addEventListener('keydown', this._onKeyDown);
    this.sceneManager.renderer?.domElement?.addEventListener(
      'contextmenu', this._onContextMenu, true,
    );
  }

  setActive(active) {
    const next = !!active;
    if (next === this.active) return;
    this.active = next;
    const canvas = this.sceneManager.renderer?.domElement;
    if (canvas) {
      if (next) {
        this._previousCursor = canvas.style.cursor;
        canvas.style.cursor = 'crosshair';
      } else {
        canvas.style.cursor = this._previousCursor;
      }
    }
    if (!next) this._resetPending({ keepLaser: false });
  }

  setAxisAssist(enabled, thresholdDeg = this.axisThresholdDeg) {
    this.axisAssist = !!enabled;
    this.axisThresholdDeg = clamp(Number(thresholdDeg) || AXIS_THRESHOLD_DEG, 1, 25);
  }

  handleClick(event) {
    if (!this.active || (event?.button != null && event.button !== 0)) return null;
    const rawEndpoint = this._pickEndpoint(event, true);
    if (!rawEndpoint) return null;
    const endpoint = this.pointA ? this._applyAxisAssist(rawEndpoint, event) : rawEndpoint;

    if (!this.pointA) {
      this.pointA = endpoint.point.clone();
      this.normalA = endpoint.normal?.clone() || null;
      this.bindingA = this._cloneBinding(endpoint.binding);
      this.snapManager?.setReferencePoint?.(this.pointA);
      this._showTempMarker(this.pointA);
      this._updatePreview(this.pointA, this.pointA);
      return this.pointA.clone();
    }

    return this._createWeld(
      this.pointA,
      endpoint.point,
      this.bindingA,
      endpoint.binding,
      this.normalA,
      endpoint.normal,
    );
  }

  handleMouseMove(event) {
    if (!this.active) return;
    const rawEndpoint = this._pickEndpoint(event, false);
    if (!rawEndpoint) {
      this._hidePointerVisuals();
      return;
    }
    const endpoint = this.pointA ? this._applyAxisAssist(rawEndpoint, event) : rawEndpoint;
    this._updateLaser(endpoint.point, event);
    if (this.pointA) this._updatePreview(this.pointA, endpoint.point);
  }

  cancel() {
    const hadPending = !!this.pointA;
    this._resetPending({ keepLaser: false });
    const canvas = this.sceneManager.renderer?.domElement;
    if (hadPending && canvas && typeof CustomEvent !== 'undefined') {
      canvas.dispatchEvent(new CustomEvent('weld-cancel', { bubbles: true }));
    }
    return hadPending;
  }

  _pickEndpoint(event, refreshSnap) {
    if (refreshSnap && event && this.snapManager?.enabled) this.snapManager.update?.(event);

    const snapInfo = this.snapManager?.getSnapInfo?.();
    if (snapInfo?.point && snapInfo.bimObject?.type !== 'weld') {
      const point = snapInfo.point.clone?.() || new THREE.Vector3().fromArray(snapInfo.point);
      let binding = this._cloneBinding(snapInfo.binding);
      if (!binding && snapInfo.bimObject) binding = this._makeBinding(snapInfo.bimObject, point);
      return {
        point,
        binding,
        normal: snapInfo.normal?.clone?.() || null,
        snapType: snapInfo.type,
        bimObject: snapInfo.bimObject || null,
      };
    }

    const hit = event ? this._raycastSurface(event) : null;
    if (hit) {
      return {
        point: hit.point.clone(),
        binding: this._cloneBinding(hit.binding),
        normal: hit.worldNormal?.clone() || null,
        snapType: 'surface',
        bimObject: hit.bimObject,
        hit,
      };
    }

    const snapPoint = this.snapManager?.getSnapPoint?.();
    return snapPoint ? {
      point: snapPoint.clone(), binding: null, normal: null, snapType: 'point', bimObject: null,
    } : null;
  }

  _applyAxisAssist(endpoint, event) {
    if (!this.axisAssist || event?.altKey || !this.pointA) return endpoint;
    const delta = new THREE.Vector3().subVectors(endpoint.point, this.pointA);
    const length = delta.length();
    if (length < 1e-8) return endpoint;

    const components = [Math.abs(delta.x), Math.abs(delta.y), Math.abs(delta.z)];
    const axisIndex = components.indexOf(Math.max(...components));
    const angle = THREE.MathUtils.radToDeg(Math.acos(clamp(components[axisIndex] / length, -1, 1)));
    if (!event?.shiftKey && angle > this.axisThresholdDeg) return endpoint;

    const point = this.pointA.clone();
    if (axisIndex === 0) point.x += delta.x;
    else if (axisIndex === 1) point.y += delta.y;
    else point.z += delta.z;
    const binding = endpoint.bimObject ? this._makeBinding(endpoint.bimObject, point) : endpoint.binding;
    return { ...endpoint, point, binding, snapType: `axis-${'xyz'[axisIndex]}` };
  }

  _createWeld(a, b, bindingA = null, bindingB = null, normalA = null, normalB = null) {
    if (a.distanceToSquared(b) < 1e-10) return null;
    const weld = new Weld(a, b, this.radius, {
      a: this._cloneBinding(bindingA),
      b: this._cloneBinding(bindingB),
    });
    this.sceneManager.addObject(weld);
    weld.setHeat(1);
    const normal = new THREE.Vector3();
    if (normalA) normal.add(normalA);
    if (normalB) normal.add(normalB);
    if (normal.lengthSq() < 1e-8) normal.set(0, 1, 0);
    else normal.normalize();
    this._emitSparks(weld, b, normal);
    if (this.onWeldCreated) this.onWeldCreated(weld);

    const canvas = this.sceneManager.renderer?.domElement;
    if (canvas && typeof CustomEvent !== 'undefined') {
      canvas.dispatchEvent(new CustomEvent('weld-created', {
        detail: { weldId: weld.id, length: a.distanceTo(b) },
        bubbles: true,
      }));
    }
    this._resetPending({ keepLaser: true });
    return weld;
  }

  _resetPending({ keepLaser = false } = {}) {
    this.pointA = null;
    this.normalA = null;
    this.bindingA = null;
    this.snapManager?.setReferencePoint?.(null);
    this._removeTempMarker();
    this._removePreview();
    if (!keepLaser) this._removeLaser();
  }

  _cloneBinding(binding) {
    if (!binding?.objectId || !binding.localPoint) return null;
    const local = binding.localPoint.isVector3
      ? binding.localPoint.toArray()
      : Array.from(binding.localPoint);
    return { objectId: String(binding.objectId), localPoint: local.slice(0, 3) };
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
    let target = mesh;
    while (target && !target.userData?.bimId) target = target.parent;
    const id = target?.userData?.bimId;
    return id ? this.sceneManager.objects.find(item => item.id === id) || null : null;
  }

  _setRayFromEvent(event) {
    const canvas = this.sceneManager.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.sceneManager.raycaster.setFromCamera(mouse, this.sceneManager.camera);
    return this.sceneManager.raycaster.ray;
  }

  _raycastSurface(event) {
    this._setRayFromEvent(event);
    const hits = this.sceneManager.raycaster.intersectObjects(
      this.sceneManager.getSelectableObjects(), true,
    );
    for (const hit of hits) {
      if (hit.object.name === 'GroundPlane' || hit.object.name === 'GridSystem') continue;
      if (hit.object.name?.startsWith('__')) continue;
      const bimObject = this._findBIMObjectFromMesh(hit.object);
      if (!bimObject || bimObject.type === 'weld') continue;
      const worldNormal = hit.face?.normal
        ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
        : new THREE.Vector3(0, 1, 0);
      return {
        ...hit,
        bimObject,
        binding: this._makeBinding(bimObject, hit.point),
        worldNormal,
      };
    }
    return null;
  }

  _showTempMarker(point) {
    this._removeTempMarker();
    const geometry = new THREE.BufferGeometry().setFromPoints([point]);
    const material = new THREE.PointsMaterial({
      color: 0xffcf6b,
      size: 9,
      sizeAttenuation: false,
      depthTest: false,
      depthWrite: false,
    });
    this._tempMarker = new THREE.Points(geometry, material);
    this._tempMarker.name = '__WeldStart';
    this._tempMarker.renderOrder = 955;
    this.sceneManager.scene.add(this._tempMarker);
  }

  _ensurePreview() {
    if (this._previewGroup) return;
    this._previewGroup = new THREE.Group();
    this._previewGroup.name = '__WeldPreview';

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(6, 3));
    const lineMaterial = new THREE.LineDashedMaterial({
      color: 0xffb347,
      dashSize: 0.035,
      gapSize: 0.018,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    });
    this._tempLine = new THREE.Line(lineGeometry, lineMaterial);
    this._tempLine.renderOrder = 940;
    this._previewGroup.add(this._tempLine);

    this._previewBody = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 10),
      new THREE.MeshBasicMaterial({
        color: 0xff5a1f,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this._previewBody.renderOrder = 939;
    this._previewGroup.add(this._previewBody);

    const markerGeometry = new THREE.BufferGeometry();
    markerGeometry.setAttribute('position', new THREE.Float32BufferAttribute(6, 3));
    this._previewMarkers = new THREE.Points(markerGeometry, new THREE.PointsMaterial({
      color: 0xffe0a3,
      size: 7,
      sizeAttenuation: false,
      depthTest: false,
      depthWrite: false,
    }));
    this._previewMarkers.renderOrder = 945;
    this._previewGroup.add(this._previewMarkers);
    this.sceneManager.scene.add(this._previewGroup);
  }

  _updatePreview(a, b) {
    this._ensurePreview();
    this._previewGroup.visible = true;
    const length = a.distanceTo(b);
    const linePositions = this._tempLine.geometry.attributes.position;
    linePositions.setXYZ(0, a.x, a.y, a.z);
    linePositions.setXYZ(1, b.x, b.y, b.z);
    linePositions.needsUpdate = true;
    this._tempLine.computeLineDistances();

    const markerPositions = this._previewMarkers.geometry.attributes.position;
    markerPositions.setXYZ(0, a.x, a.y, a.z);
    markerPositions.setXYZ(1, b.x, b.y, b.z);
    markerPositions.needsUpdate = true;

    const midpoint = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    this._previewBody.position.copy(midpoint);
    this._previewBody.scale.set(this.radius * 1.15, Math.max(length, 1e-6), this.radius * 1.15);
    if (length > 1e-8) {
      const direction = new THREE.Vector3().subVectors(b, a).normalize();
      this._previewBody.quaternion.setFromUnitVectors(Weld._UP, direction);
    }
    this._previewBody.visible = length > 1e-8;
  }

  _ensureLaser() {
    if (this._laserGroup) return;
    this._laserGroup = new THREE.Group();
    this._laserGroup.name = '__WeldLaser';
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(6, 3));
    this._laserLine = new THREE.Line(geometry, new THREE.LineBasicMaterial({
      color: 0xff2d20,
      transparent: true,
      opacity: 0.78,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this._laserLine.renderOrder = 960;
    this._laserGroup.add(this._laserLine);
    this._laserDot = new THREE.Mesh(
      new THREE.SphereGeometry(1, 10, 8),
      new THREE.MeshBasicMaterial({
        color: 0xff4a2f,
        transparent: true,
        opacity: 0.92,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this._laserDot.renderOrder = 961;
    this._laserGroup.add(this._laserDot);
    this.sceneManager.scene.add(this._laserGroup);
  }

  _updateLaser(point, event) {
    this._ensureLaser();
    const ray = event ? this._setRayFromEvent(event) : null;
    const cameraPosition = this.sceneManager.camera.getWorldPosition(new THREE.Vector3());
    const direction = ray?.direction?.clone() || new THREE.Vector3().subVectors(point, cameraPosition).normalize();
    const distance = cameraPosition.distanceTo(point);
    const beamLength = clamp(distance * 0.12, 0.25, 1.5);
    const start = point.clone().addScaledVector(direction, -beamLength);
    const positions = this._laserLine.geometry.attributes.position;
    positions.setXYZ(0, start.x, start.y, start.z);
    positions.setXYZ(1, point.x, point.y, point.z);
    positions.needsUpdate = true;
    this._laserDot.position.copy(point);
    const dotScale = clamp(distance * 0.0013, 0.003, 0.018);
    this._laserDot.scale.setScalar(dotScale);
    this._laserGroup.visible = true;
  }

  _hidePointerVisuals() {
    if (this._laserGroup) this._laserGroup.visible = false;
    if (this._previewGroup) this._previewGroup.visible = false;
  }

  _emitSparks(weld, point, normal) {
    if (typeof requestAnimationFrame === 'undefined') {
      weld.setHeat(0);
      return;
    }
    const positions = new Float32Array(SPARK_COUNT * 3);
    const velocities = [];
    const n = normal.clone().normalize();
    const tangent = new THREE.Vector3().crossVectors(
      n,
      Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0),
    ).normalize();
    const bitangent = new THREE.Vector3().crossVectors(n, tangent).normalize();
    for (let index = 0; index < SPARK_COUNT; index += 1) {
      positions[index * 3] = point.x;
      positions[index * 3 + 1] = point.y;
      positions[index * 3 + 2] = point.z;
      velocities.push(
        n.clone().multiplyScalar(0.25 + Math.random() * 1.15)
          .addScaledVector(tangent, (Math.random() - 0.5) * 1.3)
          .addScaledVector(bitangent, (Math.random() - 0.5) * 1.3),
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xffb347,
      size: 3.2,
      sizeAttenuation: false,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(geometry, material);
    particles.name = '__WeldSparks';
    particles.renderOrder = 980;
    this.sceneManager.scene.add(particles);
    const light = new THREE.PointLight(0xff5a1f, 10, 1.5, 2);
    light.position.copy(point);
    this.sceneManager.scene.add(light);
    this._effects.add({
      weld, particles, positions, velocities, material, light,
      elapsed: 0, last: performance.now(), duration: 0.68,
    });
    this._startEffectLoop();
  }

  _startEffectLoop() {
    if (this._effectFrame != null || !this._effects.size) return;
    const tick = now => {
      this._effectFrame = null;
      for (const effect of [...this._effects]) {
        const dt = Math.min(0.04, Math.max(0, (now - effect.last) / 1000));
        effect.last = now;
        effect.elapsed += dt;
        const life = clamp(effect.elapsed / effect.duration, 0, 1);
        for (let index = 0; index < effect.velocities.length; index += 1) {
          const velocity = effect.velocities[index];
          velocity.y -= 3.8 * dt;
          effect.positions[index * 3] += velocity.x * dt;
          effect.positions[index * 3 + 1] += velocity.y * dt;
          effect.positions[index * 3 + 2] += velocity.z * dt;
        }
        effect.particles.geometry.attributes.position.needsUpdate = true;
        effect.material.opacity = Math.pow(1 - life, 1.4);
        effect.light.intensity = 10 * Math.pow(1 - life, 2);
        effect.weld.setHeat(Math.pow(1 - life, 1.2));
        if (life >= 1) this._removeEffect(effect);
      }
      if (this._effects.size) this._effectFrame = requestAnimationFrame(tick);
    };
    this._effectFrame = requestAnimationFrame(tick);
  }

  _removeEffect(effect) {
    if (!this._effects.delete(effect)) return;
    this.sceneManager.scene.remove(effect.particles, effect.light);
    effect.particles.geometry.dispose();
    effect.material.dispose();
    effect.weld.setHeat(0);
  }

  _removeTempMarker() {
    if (!this._tempMarker) return;
    this.sceneManager.scene.remove(this._tempMarker);
    this._tempMarker.geometry?.dispose();
    this._tempMarker.material?.dispose();
    this._tempMarker = null;
  }

  _removePreview() {
    if (!this._previewGroup) return;
    this.sceneManager.scene.remove(this._previewGroup);
    this._previewGroup.traverse(child => {
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    });
    this._previewGroup = null;
    this._previewBody = null;
    this._previewMarkers = null;
    this._tempLine = null;
  }

  _removeTempLine() {
    this._removePreview();
  }

  _removeLaser() {
    if (!this._laserGroup) return;
    this.sceneManager.scene.remove(this._laserGroup);
    this._laserGroup.traverse(child => {
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    });
    this._laserGroup = null;
    this._laserLine = null;
    this._laserDot = null;
  }

  dispose() {
    this.setActive(false);
    if (typeof window !== 'undefined') window.removeEventListener('keydown', this._onKeyDown);
    this.sceneManager.renderer?.domElement?.removeEventListener(
      'contextmenu', this._onContextMenu, true,
    );
    if (this._effectFrame != null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this._effectFrame);
      this._effectFrame = null;
    }
    for (const effect of [...this._effects]) this._removeEffect(effect);
  }
}
