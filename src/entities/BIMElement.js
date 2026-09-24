import * as THREE from 'three';
import { workshopMaterial, applyWorkshopStyle } from '../core/WorkshopMaterial.js';

let _idCounter = 0;

/**
 * BIMElement — Base class for all structural steel elements.
 */
export class BIMElement {
  constructor(type, params = {}) {
    this.id = `bim_${++_idCounter}`;
    this.type = type;
    this.params = { ...params };
    this.mesh = null;
    this.color = '#9aabb8';
    this.steelGrade = 'S275 JR';
    this.designation = '';
    this.area = 0;
    this.mass = 0;
    this.tw = 0;
    this.tf = 0;
    this.engineeringData = null;
    this._isSelected = false;
    this._originalMaterials = new Map();
  }

  createMaterial(colorHex) {
    return workshopMaterial(colorHex);
  }

  buildMesh() { /* Override */ }

  updateMesh() {
    if (!this.mesh) return;
    const root = this.mesh;
    const pos = root.position.clone(), q = root.quaternion.clone(), scale = root.scale.clone(), visible = root.visible;
    this._disposeMesh();
    this.buildMesh();
    const next=this.mesh;
    root.clear();
    if(root.isMesh) {root.geometry=next.geometry;root.material=next.material;}
    if(next.children.length) root.add(...next.children.slice());
    root.name=next.name; root.userData=next.userData;
    root.position.copy(pos); root.quaternion.copy(q); root.scale.copy(scale);root.visible=visible;
    this.mesh=root;
    root.updateMatrixWorld(true);
    applyWorkshopStyle(this);
  }

  _disposeMesh() {
    if (!this.mesh) return;
    this.mesh.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
  }

  _applyUserData() {
    if (!this.mesh) return;
    this.mesh.userData = {
      bimId: this.id,
      type: this.type,
      designation: this.designation,
      steelGrade: this.steelGrade,
      params: { ...this.params },
    };
  }

  setSelected(selected) { this._isSelected = selected; applyWorkshopStyle(this); }

  setColor(colorHex) { this.color = colorHex; applyWorkshopStyle(this); }

  getPosition() {
    return this.mesh ? this.mesh.position : new THREE.Vector3();
  }

  getRotation() {
    return this.mesh ? this.mesh.rotation : new THREE.Euler();
  }

  setPosition(x, y, z) {
    if (this.mesh) {
      this.mesh.position.set(x, y, z);
      this.mesh.updateMatrixWorld(true);
    }
  }

  restoreId(id) {
    if (!id) return;
    this.id = String(id);
    const match = /^bim_(\d+)$/.exec(this.id);
    if (match) _idCounter = Math.max(_idCounter, Number(match[1]));
    this._applyUserData();
  }

  setRotation(degX, degY, degZ) {
    if (this.mesh) {
      this.mesh.rotation.set(
        THREE.MathUtils.degToRad(degX),
        THREE.MathUtils.degToRad(degY),
        THREE.MathUtils.degToRad(degZ)
      );
      this.mesh.updateMatrixWorld(true);
    }
  }

  getBoundingBox() {
    if (!this.mesh) return null;
    return new THREE.Box3().setFromObject(this.mesh);
  }
}
