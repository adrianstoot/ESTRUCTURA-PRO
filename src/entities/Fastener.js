import * as THREE from 'three';
import { BIMElement } from './BIMElement.js';

/**
 * Geometría nominal visual basada en EN ISO 4014/4017, 4032 y 7089.
 * Todas las cotas de la tabla están en milímetros.
 */
export const FASTENER_METRICS = Object.freeze({
  M12: Object.freeze({ d: 12, holeD: 14, washerID: 13, s: 18, headH: 7.5, nutH: 10, washerOD: 24, washerT: 2.5, pitch: 1.75 }),
  M16: Object.freeze({ d: 16, holeD: 18, washerID: 17, s: 24, headH: 10, nutH: 13, washerOD: 30, washerT: 3, pitch: 2 }),
  M20: Object.freeze({ d: 20, holeD: 22, washerID: 21, s: 30, headH: 12.5, nutH: 18, washerOD: 37, washerT: 3, pitch: 2.5 }),
  M24: Object.freeze({ d: 24, holeD: 26, washerID: 25, s: 36, headH: 15, nutH: 19, washerOD: 44, washerT: 4, pitch: 3 }),
  M27: Object.freeze({ d: 27, holeD: 30, washerID: 28, s: 41, headH: 17, nutH: 22, washerOD: 50, washerT: 4, pitch: 3 }),
  M30: Object.freeze({ d: 30, holeD: 33, washerID: 31, s: 46, headH: 18.7, nutH: 24, washerOD: 56, washerT: 4, pitch: 3.5 }),
});

const mm = value => Number(value || 0) / 1000;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

class JBoltCurve extends THREE.Curve {
  constructor(projection, embedment, hookRadius, tipLength) {
    super();
    this.projection = projection;
    this.embedment = embedment;
    this.hookRadius = hookRadius;
    this.tipLength = tipLength;
    this.straightEndY = -embedment + hookRadius;
    this.straightLength = projection - this.straightEndY;
    this.arcLength = Math.PI * hookRadius;
    this.totalLength = this.straightLength + this.arcLength + tipLength;
  }

  getPoint(t) {
    const distance = clamp(t, 0, 1) * this.totalLength;
    if (distance <= this.straightLength) {
      return new THREE.Vector3(0, this.projection - distance, 0);
    }
    if (distance <= this.straightLength + this.arcLength) {
      const arcDistance = distance - this.straightLength;
      const angle = Math.PI + arcDistance / this.hookRadius;
      return new THREE.Vector3(
        this.hookRadius + this.hookRadius * Math.cos(angle),
        this.straightEndY + this.hookRadius * Math.sin(angle),
        0,
      );
    }
    return new THREE.Vector3(
      this.hookRadius * 2,
      this.straightEndY + distance - this.straightLength - this.arcLength,
      0,
    );
  }
}

/**
 * Tornillería paramétrica con pivot en el extremo de tuerca (bolt), en la cara
 * de apoyo (nut/washer) o en la cara superior de placa (anchor).
 * Los componentes siguen siendo meshes separados dentro de un único elemento
 * BIM para mantener selección, matrices y serialización eficientes.
 */
export class Fastener extends BIMElement {
  constructor(subtype = 'bolt', metric = 'M16', shankLength = 60, options = {}) {
    const effectiveLength = subtype === 'anchor' && Number(shankLength) === 60 ? 450 : shankLength;
    super('fastener', {
      subtype,
      metric,
      shankLength: Number(effectiveLength) || (subtype === 'anchor' ? 450 : 60),
      assemblyMode: options.assemblyMode || (subtype === 'anchor' ? 'anchored' : subtype === 'stud' ? 'stud-welded' : 'bolt-only'),
      threadLength: options.threadLength ?? null,
      projection: options.projection ?? null,
      hookRadius: options.hookRadius ?? null,
      includeNut: options.includeNut,
      includeWashers: options.includeWashers,
      doubleNut: options.doubleNut === true,
    });
    this.color = '#a0a0a8';
    this._computeProperties();
    this.buildMesh();
  }

  _metricData() {
    return FASTENER_METRICS[this.params.metric] || FASTENER_METRICS.M16;
  }

  _isCompleteBolt() {
    return this.params.assemblyMode === 'through-bolt' || this.params.includeNut === true || this.params.includeWashers === true;
  }

  _computeProperties() {
    const { subtype, metric } = this.params;
    const data = this._metricData();
    const d = data.d;
    const length = Math.max(1, Number(this.params.shankLength) || 1);
    const steelKgPerMm3 = 7.85e-6;
    const shankArea = Math.PI * d ** 2 / 4;
    const hexArea = Math.sqrt(3) * data.s ** 2 / 2;
    const washerArea = Math.PI * (data.washerOD ** 2 - (data.washerID || d * 1.1) ** 2) / 4;
    const nutArea = Math.max(0, hexArea - Math.PI * (d * 1.08) ** 2 / 4);
    let volumeMm3 = shankArea * length;

    if (subtype === 'bolt') {
      volumeMm3 += hexArea * data.headH;
      if (this._isCompleteBolt()) volumeMm3 += nutArea * data.nutH + 2 * washerArea * data.washerT;
    } else if (subtype === 'stud') {
      const headDiameter = data.d * 1.6;
      volumeMm3 += Math.PI * headDiameter ** 2 / 4 * data.d * 0.35;
      volumeMm3 += Math.PI * (data.d * 1.35) ** 2 / 4 * data.d * 0.18;
    } else if (subtype === 'nut') {
      volumeMm3 = nutArea * data.nutH;
    } else if (subtype === 'washer') {
      volumeMm3 = washerArea * data.washerT;
    } else {
      const hookR = Number(this.params.hookRadius) || Math.max(3 * d, 45);
      const projection = Number(this.params.projection) || Math.max(3.5 * d, 70);
      const rodLength = length + projection + Math.PI * hookR + 1.5 * hookR;
      volumeMm3 = shankArea * rodLength + nutArea * data.nutH + washerArea * data.washerT;
      if (this.params.doubleNut) volumeMm3 += nutArea * data.nutH;
    }

    const labels = {
      bolt: this._isCompleteBolt() ? 'Conjunto de tornillo' : 'Tornillo',
      nut: 'Tuerca',
      washer: 'Arandela',
      anchor: 'Perno de anclaje J',
      stud: 'Conector de cabeza',
    };
    this.designation = `${labels[subtype] || 'Fijación'} ${metric}`;
    this.area = shankArea / 100;
    this.mass = volumeMm3 * steelKgPerMm3;
    this.tw = d;
    this.tf = data.headH;
  }

  _tag(mesh, name, role) {
    mesh.name = name;
    mesh.userData.componentRole = role;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  _hexShape(acrossFlats, holeRadius = 0) {
    const shape = new THREE.Shape();
    const radius = acrossFlats / Math.sqrt(3);
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 6 + i * Math.PI / 3;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    if (holeRadius > 0) {
      const hole = new THREE.Path();
      hole.absarc(0, 0, holeRadius, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
    return shape;
  }

  _hexMesh(data, height, material, name, role, withHole = false) {
    const bevel = Math.min(0.0007, height * 0.08);
    const geometry = new THREE.ExtrudeGeometry(
      this._hexShape(mm(data.s), withHole ? mm(data.d) * 0.55 : 0),
      {
        depth: height,
        bevelEnabled: true,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelSegments: 1,
        curveSegments: 10,
      },
    );
    geometry.translate(0, 0, -height / 2);
    const mesh = this._tag(new THREE.Mesh(geometry, material), name, role);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  _washerMesh(data, material, name = 'Arandela') {
    const outerRadius = mm(data.washerOD) / 2;
    const innerRadius = mm(data.washerID || data.d * 1.1) / 2;
    const thickness = mm(data.washerT);
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 16 });
    geometry.translate(0, 0, -thickness / 2);
    const mesh = this._tag(new THREE.Mesh(geometry, material), name, 'washer');
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  _threadMesh(data, length, material, name = 'Rosca simplificada') {
    const safeLength = Math.max(mm(data.pitch) * 2, length);
    const pitch = mm(data.pitch);
    const turns = clamp(Math.round(safeLength / pitch), 3, 12);
    const samples = turns * 2;
    const points = [];
    for (let i = 0; i <= samples; i++) {
      const y = -safeLength / 2 + safeLength * i / samples;
      const radius = mm(data.d) / 2 * (i % 2 ? 1.035 : 0.91);
      points.push(new THREE.Vector2(radius, y));
    }
    const geometry = new THREE.LatheGeometry(points, 12);
    return this._tag(new THREE.Mesh(geometry, material), name, 'thread');
  }

  _buildBolt(group, data, material) {
    const shankLength = mm(this.params.shankLength);
    const radius = mm(data.d) / 2;
    const headHeight = mm(data.headH);
    const nutHeight = mm(data.nutH);
    const washerThickness = mm(data.washerT);
    const requestedThread = Number(this.params.threadLength);
    const threadLength = Math.min(
      shankLength * 0.65,
      mm(Number.isFinite(requestedThread) && requestedThread > 0 ? requestedThread : Math.max(2.5 * data.d, 35)),
    );

    const shank = this._tag(
      new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.985, radius * 0.985, shankLength, 12), material),
      'Vástago liso',
      'shank',
    );
    shank.position.y = shankLength / 2;
    group.add(shank);

    const threadMaterial = material.clone();
    threadMaterial.roughness = 0.58;
    threadMaterial.color.offsetHSL(0, 0, -0.07);
    const thread = this._threadMesh(data, threadLength, threadMaterial);
    thread.position.y = threadLength / 2;
    group.add(thread);

    const head = this._hexMesh(data, headHeight, material, 'Cabeza hexagonal', 'head');
    head.position.y = shankLength + headHeight / 2;
    group.add(head);

    if (this._isCompleteBolt()) {
      const headWasher = this._washerMesh(data, material, 'Arandela bajo cabeza');
      headWasher.position.y = shankLength - washerThickness / 2;
      group.add(headWasher);

      const nut = this._hexMesh(data, nutHeight, material, 'Tuerca hexagonal', 'nut', true);
      nut.position.y = nutHeight / 2;
      group.add(nut);

      const nutWasher = this._washerMesh(data, material, 'Arandela bajo tuerca');
      nutWasher.position.y = nutHeight + washerThickness / 2;
      group.add(nutWasher);
    }
  }

  _buildStud(group, data, material) {
    const length = mm(this.params.shankLength);
    const diameter = mm(data.d);
    const shank = this._tag(
      new THREE.Mesh(new THREE.CylinderGeometry(diameter / 2, diameter / 2, length, 12), material),
      'Vastago de conector',
      'stud-shank',
    );
    shank.position.y = length / 2;
    group.add(shank);

    const headHeight = diameter * 0.35;
    const head = this._tag(
      new THREE.Mesh(new THREE.CylinderGeometry(diameter * 0.8, diameter * 0.8, headHeight, 16), material),
      'Cabeza circular',
      'stud-head',
    );
    head.position.y = length + headHeight / 2;
    group.add(head);

    const collarHeight = diameter * 0.18;
    const collar = this._tag(
      new THREE.Mesh(new THREE.CylinderGeometry(diameter * 0.68, diameter * 0.68, collarHeight, 12), material),
      'Collar de soldadura',
      'weld-collar',
    );
    collar.position.y = collarHeight / 2;
    group.add(collar);
  }

  _buildAnchor(group, data, material) {
    const embedment = mm(Math.max(Number(this.params.shankLength) || 450, data.d * 12));
    const projection = mm(Number(this.params.projection) || Math.max(3.5 * data.d, 70));
    const hookRadius = mm(Number(this.params.hookRadius) || Math.max(3 * data.d, 45));
    const tipLength = hookRadius * 1.5;
    const radius = mm(data.d) / 2;
    const path = new JBoltCurve(projection, embedment, hookRadius, tipLength);
    const tubularSegments = clamp(Math.ceil(path.totalLength / Math.max(radius * 2.5, 0.018)), 28, 56);
    const rod = this._tag(
      new THREE.Mesh(new THREE.TubeGeometry(path, tubularSegments, radius, 8, false), material),
      'Vástago y gancho J',
      'anchor-rod',
    );
    group.add(rod);

    const threadLength = Math.min(projection, mm(Number(this.params.threadLength) || Math.max(3 * data.d, 55)));
    const threadMaterial = material.clone();
    threadMaterial.roughness = 0.58;
    threadMaterial.color.offsetHSL(0, 0, -0.07);
    const thread = this._threadMesh(data, threadLength, threadMaterial, 'Rosca de anclaje');
    thread.position.y = projection - threadLength / 2;
    group.add(thread);

    const washer = this._washerMesh(data, material, 'Arandela de anclaje');
    washer.position.y = mm(data.washerT) / 2;
    group.add(washer);

    const nut = this._hexMesh(data, mm(data.nutH), material, 'Tuerca de anclaje', 'nut', true);
    nut.position.y = mm(data.washerT) + mm(data.nutH) / 2;
    group.add(nut);

    if (this.params.doubleNut) {
      const secondNut = this._hexMesh(data, mm(data.nutH), material, 'Contratuerca', 'lock-nut', true);
      secondNut.position.y = mm(data.washerT) + mm(data.nutH) * 1.55;
      group.add(secondNut);
    }
  }

  buildMesh() {
    const { subtype } = this.params;
    const data = this._metricData();
    const material = this.createMaterial(this.color);
    const group = new THREE.Group();
    group.name = this.designation;

    if (subtype === 'bolt') {
      this._buildBolt(group, data, material);
      group.userData.pivot = 'thread-end';
    } else if (subtype === 'nut') {
      const nut = this._hexMesh(data, mm(data.nutH), material, 'Tuerca hexagonal', 'nut', true);
      nut.position.y = mm(data.nutH) / 2;
      group.add(nut);
      group.userData.pivot = 'bearing-face';
    } else if (subtype === 'washer') {
      const washer = this._washerMesh(data, material);
      washer.position.y = mm(data.washerT) / 2;
      group.add(washer);
      group.userData.pivot = 'bearing-face';
    } else if (subtype === 'anchor') {
      this._buildAnchor(group, data, material);
      group.userData.pivot = 'plate-top';
    } else if (subtype === 'stud') {
      this._buildStud(group, data, material);
      group.userData.pivot = 'plate-face';
    }

    const axis = new THREE.Group();
    axis.name = 'PIVOT_EJE_LOCAL';
    axis.userData.componentRole = 'local-axis-pivot';
    group.add(axis);

    this.mesh = group;
    this._applyUserData();
    this.mesh.userData.pivot = subtype === 'anchor' ? 'plate-top' : subtype === 'stud' ? 'plate-face' : subtype === 'bolt' ? 'thread-end' : 'bearing-face';
    this.mesh.userData.componentCount = group.children.filter(child => child.isMesh).length;
  }

  update(params) {
    Object.assign(this.params, params);
    this._computeProperties();
    this.updateMesh();
  }
}
