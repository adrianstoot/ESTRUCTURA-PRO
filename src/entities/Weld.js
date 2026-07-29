import * as THREE from 'three';
import { BIMElement } from './BIMElement.js';

const MIN_LENGTH = 1e-6;
const MAX_RIPPLES = 128;
const asFinite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

/**
 * Serializable segmented weld bead between two world-space points.
 * The root Group identity is stable so selection, undo and bound endpoints keep
 * working while the internal bead geometry can be refreshed independently.
 */
export class Weld extends BIMElement {
  constructor(pointA, pointB, radius = 0.008, bindings = null) {
    const safeRadius = Math.max(0.0005, asFinite(radius, 0.008));
    super('weld', { radius: safeRadius, renderStyle: 'segmented' });
    this.pointA = Weld._toVector3(pointA);
    this.pointB = Weld._toVector3(pointB);
    this.params.radius = safeRadius;
    this.bindings = { a: null, b: null };
    this._materials = {};
    this._geometryLength = -1;
    this._heatLevel = 0;
    this.setBindings(bindings);
    this._computeProperties();
    this.buildMesh();
  }

  static _toVector3(value) {
    if (value?.isVector3) return value.clone();
    if (Array.isArray(value) || ArrayBuffer.isView(value)) {
      return new THREE.Vector3().fromArray(Array.from(value));
    }
    if (value && Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z)) {
      return new THREE.Vector3(value.x, value.y, value.z);
    }
    return new THREE.Vector3();
  }

  static _normalizeBinding(binding) {
    if (!binding || !binding.objectId) return null;
    return {
      objectId: String(binding.objectId),
      localPoint: Weld._toVector3(binding.localPoint).toArray(),
    };
  }

  static fromState(state = {}) {
    const pointA = state.pointA || state.endpoints?.a || [0, 0, 0];
    const pointB = state.pointB || state.endpoints?.b || [0, 0, 0];
    const radius = state.radius ?? state.params?.radius ?? 0.008;
    const bindings = state.bindings || state.params?.bindings || null;
    return new Weld(pointA, pointB, radius, bindings);
  }

  setBindings(bindings = null) {
    this.bindings = {
      a: Weld._normalizeBinding(bindings?.a),
      b: Weld._normalizeBinding(bindings?.b),
    };
    this.params.bindings = this.getSerializableBindings();
  }

  setBinding(endpoint, binding) {
    if (endpoint !== 'a' && endpoint !== 'b') return;
    this.bindings[endpoint] = Weld._normalizeBinding(binding);
    this.params.bindings = this.getSerializableBindings();
    this._applyUserData();
  }

  getSerializableBindings() {
    const serialize = binding => binding ? {
      objectId: binding.objectId,
      localPoint: [...binding.localPoint],
    } : null;
    return {
      a: serialize(this.bindings?.a),
      b: serialize(this.bindings?.b),
    };
  }

  serializeEndpoints() {
    return {
      pointA: this.pointA.toArray(),
      pointB: this.pointB.toArray(),
      radius: this.params.radius,
      bindings: this.getSerializableBindings(),
    };
  }

  _detachBindingsForManualTransform() {
    if (this.bindings?.a || this.bindings?.b) this.setBindings(null);
  }

  setPosition(x, y, z) {
    if (!this.mesh) return;
    const target = new THREE.Vector3(
      asFinite(x, this.mesh.position.x),
      asFinite(y, this.mesh.position.y),
      asFinite(z, this.mesh.position.z),
    );
    const delta = target.sub(this.mesh.position);
    if (delta.lengthSq() < 1e-20) return;
    this._detachBindingsForManualTransform();
    this.setEndpoints(this.pointA.clone().add(delta), this.pointB.clone().add(delta));
  }

  setRotation(degX, degY, degZ) {
    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(asFinite(degX)),
      THREE.MathUtils.degToRad(asFinite(degY)),
      THREE.MathUtils.degToRad(asFinite(degZ)),
      this.mesh?.rotation?.order || 'XYZ',
    );
    const length = this.pointA.distanceTo(this.pointB);
    const midpoint = new THREE.Vector3().addVectors(this.pointA, this.pointB).multiplyScalar(0.5);
    const halfDirection = Weld._UP.clone().applyEuler(euler).normalize().multiplyScalar(length * 0.5);
    const nextA = midpoint.clone().sub(halfDirection);
    const nextB = midpoint.clone().add(halfDirection);
    if (
      nextA.distanceToSquared(this.pointA) < 1e-18 &&
      nextB.distanceToSquared(this.pointB) < 1e-18
    ) return;
    this._detachBindingsForManualTransform();
    this.setEndpoints(nextA, nextB);
  }

  _computeProperties() {
    const distance = this.pointA.distanceTo(this.pointB);
    this.designation = `Soldadura L=${(distance * 100).toFixed(1)}cm`;
    const radius = this.params.radius;
    this.area = Math.PI * radius * radius * 10000;
    this.mass = this.area / 10000 * distance * 7850;
    this.tw = radius * 2 * 1000;
    this.tf = 0;
  }

  buildMesh() {
    this.mesh = new THREE.Group();
    this.mesh.name = this.designation;
    this.mesh.userData.isSegmentedWeld = true;
    this._rebuildBeadGeometry();
    this._updateMeshTransform();
    this._applyUserData();
  }

  _rebuildBeadGeometry() {
    if (!this.mesh) return;
    this._disposeBeadGeometry();

    const length = Math.max(this.pointA.distanceTo(this.pointB), MIN_LENGTH);
    const radius = this.params.radius;
    const rippleCount = THREE.MathUtils.clamp(
      Math.ceil(length / Math.max(radius * 1.35, 0.0035)),
      3,
      MAX_RIPPLES,
    );
    const spacing = length / Math.max(1, rippleCount - 1);

    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0x4d4a48,
      roughness: 0.3,
      metalness: 0.94,
      emissive: 0x1b0300,
      emissiveIntensity: 0.05,
    });
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, length, 12, 1, false),
      coreMaterial,
    );
    core.name = 'WeldCore';
    core.castShadow = true;
    core.receiveShadow = true;
    this.mesh.add(core);

    const rippleMaterial = new THREE.MeshStandardMaterial({
      color: 0x69615c,
      roughness: 0.24,
      metalness: 0.96,
      emissive: 0x240500,
      emissiveIntensity: 0.08,
      flatShading: true,
    });
    const rippleGeometry = new THREE.SphereGeometry(1, 10, 6);
    const ripples = new THREE.InstancedMesh(rippleGeometry, rippleMaterial, rippleCount);
    ripples.name = 'WeldRipples';
    ripples.castShadow = true;
    ripples.receiveShadow = true;
    ripples.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    const dummy = new THREE.Object3D();
    const glowPositions = [];
    for (let index = 0; index < rippleCount; index += 1) {
      const t = rippleCount === 1 ? 0.5 : index / (rippleCount - 1);
      const phase = index * 2.17;
      dummy.position.set(
        Math.sin(phase) * radius * 0.09,
        (t - 0.5) * length,
        Math.cos(phase * 0.73) * radius * 0.07,
      );
      dummy.rotation.set(0, phase * 0.23, Math.sin(phase) * 0.15);
      dummy.scale.set(
        radius * (1.05 + 0.08 * Math.sin(phase)),
        Math.min(radius * 1.02, spacing * 0.72),
        radius * (0.82 + 0.06 * Math.cos(phase)),
      );
      dummy.updateMatrix();
      ripples.setMatrixAt(index, dummy.matrix);
      if (index % 2 === 0) glowPositions.push(dummy.position.x, dummy.position.y, dummy.position.z);
    }
    ripples.instanceMatrix.needsUpdate = true;
    this.mesh.add(ripples);

    const glowMaterial = new THREE.PointsMaterial({
      color: 0xff5a1f,
      size: Math.max(radius * 2.8, 0.006),
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glowGeometry = new THREE.BufferGeometry();
    glowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(glowPositions, 3));
    const glow = new THREE.Points(glowGeometry, glowMaterial);
    glow.name = '__WeldGlow';
    glow.renderOrder = 820;
    this.mesh.add(glow);

    const seamMaterial = new THREE.LineBasicMaterial({
      color: 0xff7a2f,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const seam = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -length * 0.5, 0),
        new THREE.Vector3(0, length * 0.5, 0),
      ]),
      seamMaterial,
    );
    seam.name = '__WeldMoltenSeam';
    seam.renderOrder = 821;
    this.mesh.add(seam);

    this._materials = { core: coreMaterial, ripples: rippleMaterial, glow: glowMaterial, seam: seamMaterial };
    this._geometryLength = length;
    this.setHeat(this._heatLevel);
  }

  _disposeBeadGeometry() {
    if (!this.mesh) return;
    for (const child of [...this.mesh.children]) {
      this.mesh.remove(child);
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) child.material.forEach(material => material?.dispose?.());
      else child.material?.dispose?.();
    }
    this._materials = {};
  }

  setHeat(level = 0) {
    this._heatLevel = THREE.MathUtils.clamp(asFinite(level), 0, 1);
    const heat = this._heatLevel;
    if (this._materials.core) {
      this._materials.core.emissive.set(heat > 0.35 ? 0xff2a00 : 0x1b0300);
      this._materials.core.emissiveIntensity = 0.05 + heat * 1.2;
    }
    if (this._materials.ripples) {
      this._materials.ripples.emissive.set(heat > 0.2 ? 0xff3b08 : 0x240500);
      this._materials.ripples.emissiveIntensity = 0.08 + heat * 1.65;
      this._materials.ripples.roughness = 0.24 - heat * 0.1;
    }
    if (this._materials.glow) this._materials.glow.opacity = heat * 0.72;
    if (this._materials.seam) this._materials.seam.opacity = heat * 0.82;
  }

  _updateMeshTransform() {
    if (!this.mesh) return;
    const distance = this.pointA.distanceTo(this.pointB);
    const midpoint = new THREE.Vector3().addVectors(this.pointA, this.pointB).multiplyScalar(0.5);
    this.mesh.position.copy(midpoint);
    if (distance > MIN_LENGTH) {
      const direction = new THREE.Vector3().subVectors(this.pointB, this.pointA).normalize();
      this.mesh.quaternion.setFromUnitVectors(Weld._UP, direction);
    } else {
      this.mesh.quaternion.identity();
    }
    this.mesh.updateMatrixWorld(true);
  }

  setEndpoints(pointA, pointB) {
    const previousLength = this.pointA.distanceTo(this.pointB);
    this.pointA.copy(Weld._toVector3(pointA));
    this.pointB.copy(Weld._toVector3(pointB));
    const nextLength = this.pointA.distanceTo(this.pointB);
    this._computeProperties();

    if (!this.mesh) {
      this.buildMesh();
      return;
    }
    if (Math.abs(nextLength - previousLength) > Math.max(1e-6, previousLength * 1e-4)) {
      this._rebuildBeadGeometry();
    }
    this.mesh.name = this.designation;
    this._updateMeshTransform();
    this.params.bindings = this.getSerializableBindings();
    this._applyUserData();
  }

  updateFromBindings(resolver) {
    let nextA = this.pointA.clone();
    let nextB = this.pointB.clone();

    const updateEndpoint = (endpoint, binding) => {
      if (!binding) return endpoint;
      const owner = Weld._resolveBoundObject(resolver, binding.objectId);
      const ownerMesh = owner?.mesh || (owner?.isObject3D ? owner : null);
      if (!ownerMesh) return endpoint;
      ownerMesh.updateWorldMatrix(true, true);
      return ownerMesh.localToWorld(Weld._toVector3(binding.localPoint));
    };

    nextA = updateEndpoint(nextA, this.bindings?.a);
    nextB = updateEndpoint(nextB, this.bindings?.b);
    const changed =
      nextA.distanceToSquared(this.pointA) > 1e-18 ||
      nextB.distanceToSquared(this.pointB) > 1e-18;
    if (changed) this.setEndpoints(nextA, nextB);
    return changed;
  }

  refreshFromBindings(resolver) {
    return this.updateFromBindings(resolver);
  }

  static _resolveBoundObject(resolver, objectId) {
    if (!resolver || !objectId) return null;
    if (typeof resolver === 'function') return resolver(objectId);
    if (resolver instanceof Map) return resolver.get(objectId) || null;
    if (Array.isArray(resolver)) return resolver.find(item => item?.id === objectId) || null;
    return resolver[objectId] || null;
  }
}

Weld._UP = new THREE.Vector3(0, 1, 0);
