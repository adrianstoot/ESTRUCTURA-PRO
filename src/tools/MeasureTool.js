import * as THREE from 'three';

/**
 * MeasureTool — Professional 2-click CAD measurement.
 * Uses snap system with orthogonal constraint support.
 * Draws a clean dimension line with arrows and a floating label.
 */
export class MeasureTool {
  constructor(sceneManager, snapManager) {
    this.sceneManager = sceneManager;
    this.snapManager = snapManager;
    this.active = false;
    this.mode = 'distance'; // 'distance' | 'angle' | 'area'
    this.pointA = null;
    this._points = [];      // for angle (3) and area (n)
    this.measurements = [];
    this._tempLine = null;
    this._tempLabel = null;
    this._tempArea = null;
    this._bindKeys = this._bindKeys.bind(this);
    window.addEventListener('keydown', this._bindKeys);
  }

  setMode(mode) {
    this.mode = ['distance','angle','area'].includes(mode) ? mode : 'distance';
    this.pointA = null;
    this._points = [];
    this._removeTempLine();
    this._removeTempLabel();
    this._removeTempArea();
  }

  setActive(active) {
    this.active = active;
    if (!active) {
      this.pointA = null;
      this._points = [];
      this.snapManager.setReferencePoint(null);
      this.snapManager.orthoLock = false;
      this._removeTempLine();
      this._removeTempLabel();
      this._removeTempArea();
    } else {
      this.snapManager.orthoLock = false;
    }
  }

  _bindKeys(e) {
    if (!this.active) return;
    // Enter closes the polygon in area mode
    if (e.key === 'Enter' && this.mode === 'area' && this._points.length >= 3) {
      this._commitArea();
    } else if (e.key === 'Escape') {
      this.pointA = null;
      this._points = [];
      this._removeTempLine();
      this._removeTempLabel();
      this._removeTempArea();
    }
  }

  handleClick(event) {
    if (!this.active) return;
    const snapPt = this.snapManager.getSnapPoint();
    if (!snapPt) return;

    if (this.mode === 'angle') {
      this._points.push(snapPt.clone());
      this.snapManager.setReferencePoint(snapPt.clone());
      if (this._points.length === 3) {
        this._createAngleMeasurement(this._points[0], this._points[1], this._points[2]);
        this._points = [];
        this.snapManager.setReferencePoint(null);
        this._removeTempLine();
        this._removeTempLabel();
      }
      return;
    }

    if (this.mode === 'area') {
      this._points.push(snapPt.clone());
      this.snapManager.setReferencePoint(snapPt.clone());
      return;
    }

    // distance (default)
    if (!this.pointA) {
      this.pointA = snapPt.clone();
      this.snapManager.setReferencePoint(this.pointA);
    } else {
      const pointB = snapPt.clone();
      this._createMeasurement(this.pointA, pointB);
      this.pointA = null;
      this.snapManager.setReferencePoint(null);
      this._removeTempLine();
      this._removeTempLabel();
    }
  }

  handleMouseMove(event) {
    if (!this.active) return;
    const snapPt = this.snapManager.getSnapPoint();
    if (!snapPt) return;

    this._removeTempLine();
    this._removeTempLabel();
    this._removeTempArea();

    if (this.mode === 'angle' && this._points.length > 0) {
      const pts = [...this._points, snapPt];
      this._tempLine = this._mkDashedLine(pts);
      this.sceneManager.scene.add(this._tempLine);
      if (this._points.length === 2) {
        const ang = this._angleDeg(this._points[0], this._points[1], snapPt);
        this._tempLabel = this._createLabelDiv(`${ang.toFixed(2)} °`, this._points[1], true);
      }
      return;
    }

    if (this.mode === 'area' && this._points.length > 0) {
      const pts = [...this._points, snapPt, this._points[0]];
      this._tempLine = this._mkDashedLine(pts);
      this.sceneManager.scene.add(this._tempLine);
      if (this._points.length >= 2) {
        const A = this._polygonArea([...this._points, snapPt]);
        const perim = this._polygonPerimeter([...this._points, snapPt, this._points[0]]);
        const center = this._polygonCentroid([...this._points, snapPt]);
        this._tempLabel = this._createLabelDiv(`A=${A.toFixed(3)} m² · P=${perim.toFixed(2)} m  [Enter=cerrar]`, center, true);
      }
      return;
    }

    // distance
    if (!this.pointA) return;
    const points = [this.pointA, snapPt];
    this._tempLine = this._mkDashedLine(points);
    this.sceneManager.scene.add(this._tempLine);

    const distance = this.pointA.distanceTo(snapPt);
    const mid = new THREE.Vector3().addVectors(this.pointA, snapPt).multiplyScalar(0.5);
    this._tempLabel = this._createLabelDiv(`${(distance * 100).toFixed(1)} cm`, mid, true);
  }

  _mkDashedLine(pts) {
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineDashedMaterial({
      color: 0xeab308, dashSize: 0.05, gapSize: 0.03, depthTest: false,
    });
    const line = new THREE.Line(geo, mat);
    line.computeLineDistances();
    line.renderOrder = 900;
    line.name = '__tempMeasure';
    return line;
  }

  _createMeasurement(a, b) {
    const dist = a.distanceTo(b);
    const distCm = (dist * 100).toFixed(1);
    const distM = dist.toFixed(3);

    // Solid line
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const mat = new THREE.LineBasicMaterial({ color: 0xeab308, depthTest: false });
    const line = new THREE.Line(geo, mat);
    line.renderOrder = 900;
    line.name = 'MeasureLine';
    this.sceneManager.scene.add(line);

    // Endpoint markers (small spheres)
    const markerGeo = new THREE.SphereGeometry(0.02, 8, 8);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xeab308, depthTest: false });
    const ma = new THREE.Mesh(markerGeo, markerMat);
    ma.position.copy(a);
    ma.renderOrder = 901;
    this.sceneManager.scene.add(ma);
    const mb = new THREE.Mesh(markerGeo.clone(), markerMat.clone());
    mb.position.copy(b);
    mb.renderOrder = 901;
    this.sceneManager.scene.add(mb);

    // Label
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const label = this._createLabelDiv(`${distCm} cm (${distM} m)`, mid, false);

    this.measurements.push({ line, ma, mb, label, a: a.clone(), b: b.clone(), dist });
  }

  _createLabelDiv(text, position, isTemp) {
    const div = document.createElement('div');
    div.className = 'measure-label';
    div.textContent = text;
    div.style.cssText = `
      position: absolute;
      background: rgba(234, 179, 8, 0.92);
      color: #000;
      padding: 2px 8px;
      border-radius: 2px;
      font-size: 11px;
      font-weight: 600;
      font-family: 'Inter', monospace;
      pointer-events: none;
      z-index: 100;
      white-space: nowrap;
      letter-spacing: 0.3px;
      border: 1px solid rgba(0,0,0,0.2);
    `;
    if (isTemp) div.style.opacity = '0.75';
    const container = document.getElementById('canvas-container');
    container.appendChild(div);

    const cam = this.sceneManager.camera;
    const renderer = this.sceneManager.renderer;

    const updatePos = () => {
      if (!div.parentElement) return;
      const projected = position.clone().project(cam);
      const rect = renderer.domElement.getBoundingClientRect();
      const x = (projected.x + 1) / 2 * rect.width;
      const y = (-projected.y + 1) / 2 * rect.height;
      div.style.left = (x + rect.left) + 'px';
      div.style.top = (y + rect.top - 20) + 'px';
      requestAnimationFrame(updatePos);
    };
    updatePos();
    return div;
  }

  _removeTempLine() {
    if (this._tempLine) {
      this.sceneManager.scene.remove(this._tempLine);
      this._tempLine.geometry?.dispose();
      this._tempLine.material?.dispose();
      this._tempLine = null;
    }
  }

  _removeTempLabel() {
    if (this._tempLabel && this._tempLabel.parentElement) {
      this._tempLabel.remove();
      this._tempLabel = null;
    }
  }

  _removeTempArea() {
    if (this._tempArea) {
      this.sceneManager.scene.remove(this._tempArea);
      this._tempArea.geometry?.dispose();
      this._tempArea.material?.dispose();
      this._tempArea = null;
    }
  }

  // ─── Angle ────────────────────────────────────────────────────
  _angleDeg(a, b, c) {
    const v1 = new THREE.Vector3().subVectors(a, b);
    const v2 = new THREE.Vector3().subVectors(c, b);
    const cos = v1.dot(v2) / (Math.max(1e-9, v1.length() * v2.length()));
    return THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(cos, -1, 1)));
  }

  _createAngleMeasurement(a, b, c) {
    const angle = this._angleDeg(a, b, c);

    // segments a-b, b-c
    const mat = new THREE.LineBasicMaterial({ color: 0xeab308, depthTest: false });
    const segGeo = new THREE.BufferGeometry().setFromPoints([a, b, c]);
    const segLine = new THREE.Line(segGeo, mat);
    segLine.renderOrder = 900;
    this.sceneManager.scene.add(segLine);

    // Arc between the two vectors at vertex b
    const v1 = new THREE.Vector3().subVectors(a, b).normalize();
    const v2 = new THREE.Vector3().subVectors(c, b).normalize();
    const r = Math.min(a.distanceTo(b), b.distanceTo(c)) * 0.25;
    const steps = 36;
    const arcPts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const dir = new THREE.Vector3().copy(v1).lerp(v2, t).normalize();
      arcPts.push(new THREE.Vector3().copy(b).addScaledVector(dir, r));
    }
    const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPts);
    const arcMat = new THREE.LineDashedMaterial({
      color: 0xeab308, dashSize: 0.02, gapSize: 0.015, depthTest: false,
    });
    const arc = new THREE.Line(arcGeo, arcMat);
    arc.computeLineDistances();
    arc.renderOrder = 901;
    this.sceneManager.scene.add(arc);

    const label = this._createLabelDiv(`${angle.toFixed(2)} °`, b.clone().addScaledVector(new THREE.Vector3().copy(v1).add(v2).normalize(), r * 1.3), false);
    this.measurements.push({ type: 'angle', line: segLine, arc, label, angle });
  }

  // ─── Area ─────────────────────────────────────────────────────
  _polygonArea(pts) {
    // Shoelace on the plane dominated by the largest normal component
    if (pts.length < 3) return 0;
    const n = new THREE.Vector3();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], pn = pts[(i + 1) % pts.length];
      n.x += (p.y - pn.y) * (p.z + pn.z);
      n.y += (p.z - pn.z) * (p.x + pn.x);
      n.z += (p.x - pn.x) * (p.y + pn.y);
    }
    return n.length() / 2;
  }

  _polygonPerimeter(pts) {
    let s = 0;
    for (let i = 0; i < pts.length - 1; i++) s += pts[i].distanceTo(pts[i + 1]);
    return s;
  }

  _polygonCentroid(pts) {
    const c = new THREE.Vector3();
    pts.forEach(p => c.add(p));
    return c.multiplyScalar(1 / Math.max(1, pts.length));
  }

  _commitArea() {
    if (this._points.length < 3) return;
    const pts = [...this._points, this._points[0]];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xeab308, depthTest: false }));
    line.renderOrder = 900;
    this.sceneManager.scene.add(line);

    const A = this._polygonArea(this._points);
    const P = this._polygonPerimeter(pts);
    const center = this._polygonCentroid(this._points);
    const label = this._createLabelDiv(`A = ${A.toFixed(3)} m² · P = ${P.toFixed(2)} m`, center, false);

    this.measurements.push({ type: 'area', line, label, area: A, perim: P });
    this._points = [];
    this.snapManager.setReferencePoint(null);
    this._removeTempLine();
    this._removeTempLabel();
  }
}
