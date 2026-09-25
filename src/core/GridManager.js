import * as THREE from 'three';

/**
 * GridManager v3.0 — Premium dark grid with major/minor lines and axis indicators.
 */
export class GridManager {
  constructor(scene, initialSize = 16) {
    this.scene = scene;
    this.gridGroup = new THREE.Group();
    this.gridGroup.name = 'GridSystem';
    this.scene.add(this.gridGroup);
    this.currentSize = initialSize;
    // The model remains in metres internally; the displayed workshop grid is
    // adaptive and starts at 10 mm, switching to a 1 mm pitch for close work.
    this.gridStep = 0.01;
    this.groundPlane = null;
    this.visible = true;
    this.buildGrid(initialSize);
  }

  buildGrid(size) {
    // Clear old
    while (this.gridGroup.children.length) {
      const c = this.gridGroup.children[0];
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
        else c.material.dispose();
      }
      this.gridGroup.remove(c);
    }
    this.currentSize = size;

    // Fine grid: divisions represent real millimetres (not arbitrary metres).
    const minorDivisions = Math.max(1, Math.round(size / this.gridStep));
    const majorDivisions = Math.max(1, Math.round(size / (this.gridStep * 10)));
    const minorGrid = new THREE.GridHelper(size, minorDivisions, 0x9aabba, 0xc1ccd4);
    minorGrid.material.transparent = true;
    minorGrid.material.opacity = 0.52;
    minorGrid.position.y = 0;
    this.gridGroup.add(minorGrid);

    // Major grid — slightly more visible
    const majorGrid = new THREE.GridHelper(size, majorDivisions, 0x8298a8, 0xa9b8c2);
    majorGrid.material.transparent = true;
    majorGrid.material.opacity = 0.62;
    majorGrid.position.y = 0.001;
    this.gridGroup.add(majorGrid);

    // Ground plane (for raycasting, invisible)
    const planeGeo = new THREE.PlaneGeometry(size * 3, size * 3);
    const planeMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
    this.groundPlane = new THREE.Mesh(planeGeo, planeMat);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.name = 'GroundPlane';
    this.gridGroup.add(this.groundPlane);

    // Origin indicator (small dot)
    const originGeo = new THREE.SphereGeometry(0.004, 8, 8);
    const originMat = new THREE.MeshBasicMaterial({ color: 0x4a5070, depthTest: false });
    const origin = new THREE.Mesh(originGeo, originMat);
    origin.position.y = 0.002;
    this.gridGroup.add(origin);

    // Axis lines — thin and tasteful
    const axisLen = size / 2 + 1;
    this._addAxis(new THREE.Vector3(axisLen, 0.003, 0), 0x883333, 'X'); // X – red
    this._addAxis(new THREE.Vector3(0, axisLen, 0), 0x338833, 'Y');      // Y – green
    this._addAxis(new THREE.Vector3(0, 0.003, axisLen), 0x334488, 'Z');  // Z – blue
  }

  _addAxis(end, color, label) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.002, 0), end]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 });
    const line = new THREE.Line(geo, mat);
    this.gridGroup.add(line);
  }

  setSize(size) {
    this.buildGrid(size);
  }

  /** Keep grid cells legible while allowing true 1 mm work when zoomed in. */
  updateForCamera(camera, viewportHeight, target = new THREE.Vector3()) {
    if (!camera || !Number.isFinite(viewportHeight) || viewportHeight <= 0) return;

    let visibleWorldHeight;
    if (camera.isOrthographicCamera) {
      visibleWorldHeight = (camera.top - camera.bottom) / Math.max(camera.zoom, 1e-6);
    } else if (camera.isPerspectiveCamera) {
      const distance = camera.position.distanceTo(target);
      visibleWorldHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    } else {
      return;
    }

    const desiredStep = visibleWorldHeight * 8 / viewportHeight;
    if (!Number.isFinite(desiredStep) || desiredStep <= 0) return;

    const magnitude = 10 ** Math.floor(Math.log10(desiredStep));
    const ratio = desiredStep / magnitude;
    const niceRatio = ratio < 1.5 ? 1 : ratio < 3.5 ? 2 : ratio < 7.5 ? 5 : 10;
    const nextStep = THREE.MathUtils.clamp(
      niceRatio * magnitude,
      0.001,
      this.currentSize / 8,
    );

    // Avoid rebuilding geometry on every OrbitControls change event.
    if (Math.abs(Math.log(nextStep / this.gridStep)) < Math.log(1.4)) return;
    this.gridStep = nextStep;
    this.buildGrid(this.currentSize);
  }

  setVisible(v) {
    this.visible = v;
    this.gridGroup.visible = !!v;
  }

  getGroundPlane() {
    return this.groundPlane;
  }
}
