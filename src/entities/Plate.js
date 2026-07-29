import * as THREE from 'three';
import { BIMElement } from './BIMElement.js';

const STEEL_DENSITY = 7850;
const NEOPRENE_DENSITY = 1200;
const EPSILON = 1e-6;

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Chapa estructural paramétrica.
 *
 * Plano local: XY. Espesor/eje normal: Z.
 * `gusset-custom` conserva los puntos proporcionados por el editor.
 * `holes`, `cornerRadius` y `edgeBevel` se expresan en metros.
 */
export class Plate extends BIMElement {
  constructor(subtype = 'base', width = 0.3, height = 0.3, thickness = 0.02, options = {}) {
    super('plate', { subtype, width, height, thickness, ...options });
    this.color = '#607d8b';
    this._computeProperties();
    this.buildMesh();
  }

  _outlinePoints() {
    const width = Math.max(EPSILON, finite(this.params.width, 0.3));
    const height = Math.max(EPSILON, finite(this.params.height, 0.3));
    const supplied = Array.isArray(this.params.points) ? this.params.points : [];
    if ((this.params.subtype === 'gusset-custom' || this.params.subtype === 'stiffener') && supplied.length >= 3) {
      return supplied.map(point => new THREE.Vector2(
        finite(Array.isArray(point) ? point[0] : point.x),
        finite(Array.isArray(point) ? point[1] : point.y),
      ));
    }
    if (this.params.subtype === 'gusset-triangle' || this.params.subtype === 'stiffener') {
      return [
        new THREE.Vector2(-width / 2, -height / 2),
        new THREE.Vector2(width / 2, -height / 2),
        new THREE.Vector2(-width / 2, height / 2),
      ];
    }
    return [
      new THREE.Vector2(-width / 2, -height / 2),
      new THREE.Vector2(width / 2, -height / 2),
      new THREE.Vector2(width / 2, height / 2),
      new THREE.Vector2(-width / 2, height / 2),
    ];
  }

  _shapeFromPoints(points, requestedRadius = 0) {
    const shape = new THREE.Shape();
    const radius = Math.max(0, finite(requestedRadius));
    if (points.length < 3) return shape;
    const corners = points.map((current, index) => {
      const previous = points[(index - 1 + points.length) % points.length];
      const next = points[(index + 1) % points.length];
      const toPrevious = previous.clone().sub(current);
      const toNext = next.clone().sub(current);
      const offset = Math.min(radius, toPrevious.length() * 0.45, toNext.length() * 0.45);
      return {
        corner: current,
        start: current.clone().add(toPrevious.normalize().multiplyScalar(offset)),
        end: current.clone().add(toNext.normalize().multiplyScalar(offset)),
      };
    });
    shape.moveTo(corners[0].start.x, corners[0].start.y);
    corners.forEach(({ start, corner, end }) => {
      shape.lineTo(start.x, start.y);
      if (radius > EPSILON) shape.quadraticCurveTo(corner.x, corner.y, end.x, end.y);
      else shape.lineTo(end.x, end.y);
    });
    shape.closePath();
    return shape;
  }

  _normalisedHoles() {
    const holes = Array.isArray(this.params.holes) ? this.params.holes : [];
    return holes.map(hole => {
      const diameter = finite(hole?.diameter, 0);
      const points = Array.isArray(hole?.points)
        ? hole.points.map(point => new THREE.Vector2(
          finite(Array.isArray(point) ? point[0] : point.x),
          finite(Array.isArray(point) ? point[1] : point.y),
        ))
        : [];
      return {
        x: finite(hole?.x),
        y: finite(hole?.y),
        radius: Math.max(0, finite(hole?.radius, diameter / 2)),
        points,
      };
    }).filter(hole => hole.radius > EPSILON || hole.points.length >= 3);
  }

  _addHoles(shape) {
    this._normalisedHoles().forEach(({ x, y, radius, points }) => {
      const hole = new THREE.Path();
      if (points.length >= 3) {
        const ordered = THREE.ShapeUtils.isClockWise(points) ? [...points].reverse() : points;
        hole.moveTo(ordered[0].x, ordered[0].y);
        ordered.slice(1).forEach(point => hole.lineTo(point.x, point.y));
        hole.closePath();
      } else {
        hole.absarc(x, y, radius, 0, Math.PI * 2, true);
      }
      shape.holes.push(hole);
    });
    return shape;
  }

  _computeProperties() {
    const width = Math.max(EPSILON, finite(this.params.width, 0.3));
    const thickness = Math.max(EPSILON, finite(this.params.thickness, 0.02));
    const subtype = this.params.subtype;
    let area;
    if (subtype === 'cleat') {
      const legDepth = Math.max(thickness, finite(this.params.legDepth, width));
      area = width * thickness + legDepth * thickness - thickness ** 2;
    } else {
      const shape = this._shapeFromPoints(this._outlinePoints(), this.params.cornerRadius);
      area = Math.abs(THREE.ShapeUtils.area(shape.extractPoints(12).shape));
      this._normalisedHoles().forEach(hole => {
        area -= hole.points.length >= 3
          ? Math.abs(THREE.ShapeUtils.area(hole.points))
          : Math.PI * hole.radius ** 2;
      });
      area = Math.max(0, area);
    }
    const names = {
      base: 'Placa Base',
      'gusset-square': 'Cartela Rectangular',
      'gusset-triangle': 'Cartela Triangular',
      'gusset-custom': 'Cartela Especial',
      stiffener: 'Rigidizador',
      'splice-plate': 'Cubrejunta',
      cleat: 'Casquillo L',
      neoprene: 'Apoyo Neopreno',
    };
    this.designation = names[subtype] || 'Chapa';
    this.area = area * 10000;
    this.mass = area * thickness * (subtype === 'neoprene' ? NEOPRENE_DENSITY : STEEL_DENSITY);
    this.tw = thickness * 1000;
    this.tf = thickness * 1000;
    if (subtype === 'neoprene') this.color = '#11131a';
    else if (subtype === 'cleat') this.color = '#546e7a';
  }

  _configureMesh(mesh, role) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.componentRole = role;
    return mesh;
  }

  _buildCleat(material) {
    const width = Math.max(EPSILON, finite(this.params.width, 0.08));
    const depth = Math.max(EPSILON, finite(this.params.legDepth, width));
    const height = Math.max(EPSILON, finite(this.params.height, 0.2));
    const thickness = clamp(finite(this.params.thickness, 0.008), EPSILON, Math.min(width, depth));
    const group = new THREE.Group();
    group.name = this.designation;
    const xLeg = this._configureMesh(new THREE.Mesh(new THREE.BoxGeometry(width, height, thickness), material), 'cleat-leg-x');
    xLeg.name = 'Ala de casquillo X';
    xLeg.position.set(width / 2 - thickness / 2, 0, 0);
    group.add(xLeg);
    const zLeg = this._configureMesh(new THREE.Mesh(new THREE.BoxGeometry(thickness, height, depth), material), 'cleat-leg-z');
    zLeg.name = 'Ala de casquillo Z';
    zLeg.position.set(0, 0, depth / 2 - thickness / 2);
    group.add(zLeg);
    const heel = new THREE.Group();
    heel.name = 'PIVOT_TALON';
    heel.userData.componentRole = 'angle-heel-pivot';
    group.add(heel);
    return group;
  }

  buildMesh() {
    const { subtype } = this.params;
    const width = Math.max(EPSILON, finite(this.params.width, 0.3));
    const height = Math.max(EPSILON, finite(this.params.height, 0.3));
    const thickness = Math.max(EPSILON, finite(this.params.thickness, 0.02));
    const material = this.createMaterial(this.color);
    if (subtype === 'neoprene') {
      material.roughness = 0.9;
      material.metalness = 0;
    }
    if (subtype === 'cleat') {
      this.mesh = this._buildCleat(material);
    } else {
      const holes = this._normalisedHoles();
      const cornerRadius = Math.max(0, finite(this.params.cornerRadius));
      const edgeBevel = clamp(finite(this.params.edgeBevel), 0, Math.min(thickness * 0.35, 0.003));
      const isSimpleRectangle = !holes.length && cornerRadius <= EPSILON && edgeBevel <= EPSILON
        && !['gusset-triangle', 'gusset-custom', 'stiffener'].includes(subtype);
      let geometry;
      if (isSimpleRectangle) {
        geometry = new THREE.BoxGeometry(width, height, thickness);
      } else {
        const shape = this._addHoles(this._shapeFromPoints(this._outlinePoints(), cornerRadius));
        geometry = new THREE.ExtrudeGeometry(shape, {
          depth: thickness,
          bevelEnabled: edgeBevel > EPSILON,
          bevelThickness: edgeBevel,
          bevelSize: edgeBevel,
          bevelSegments: edgeBevel > EPSILON ? 1 : 0,
          curveSegments: cornerRadius > EPSILON ? 8 : 4,
        });
        geometry.translate(0, 0, -thickness / 2);
      }
      this.mesh = this._configureMesh(new THREE.Mesh(geometry, material), 'plate-body');
      this.mesh.name = this.designation;
    }
    this._applyUserData();
    this.mesh.userData.pivot = subtype === 'cleat' ? 'angle-heel' : 'centroid';
    this.mesh.userData.localPlane = 'XY';
    this.mesh.userData.localNormal = 'Z';
    this.mesh.userData.holeCount = this._normalisedHoles().length;
    this.mesh.userData.fabrication = {
      cornerRadius: Math.max(0, finite(this.params.cornerRadius)),
      edgeBevel: Math.max(0, finite(this.params.edgeBevel)),
    };
  }

  update(params) {
    Object.assign(this.params, params);
    this._computeProperties();
    this.updateMesh();
  }
}