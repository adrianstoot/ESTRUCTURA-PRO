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

    // Minor grid — subtle
    const minorGrid = new THREE.GridHelper(size, size * 2, 0x778894, 0xa8b4bc);
    minorGrid.material.transparent = true;
    minorGrid.material.opacity = 0.34;
    minorGrid.position.y = 0;
    this.gridGroup.add(minorGrid);

    // Major grid — slightly more visible
    const majorGrid = new THREE.GridHelper(size, size / 2, 0x5b7181, 0x82939e);
    majorGrid.material.transparent = true;
    majorGrid.material.opacity = 0.46;
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
    const originGeo = new THREE.SphereGeometry(0.04, 8, 8);
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

  setVisible(v) {
    this.visible = v;
    this.gridGroup.visible = !!v;
  }

  getGroundPlane() {
    return this.groundPlane;
  }
}
