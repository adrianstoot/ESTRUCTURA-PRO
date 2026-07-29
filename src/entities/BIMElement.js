import * as THREE from 'three';

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
    this.analysisInput = null;
    this.analysisResults = null;
    this._isSelected = false;
    this._originalMaterials = new Map();
  }

  createMaterial(colorHex) {
    const color = new THREE.Color(colorHex);
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.44,
      metalness: 0.76,
      envMapIntensity: 0.9,
    });
  }

  buildMesh() { /* Override */ }

  updateMesh() {
    if (!this.mesh) return;
    const parent = this.mesh.parent;
    const pos = this.mesh.position.clone();
    const rot = this.mesh.rotation.clone();
    if (parent) parent.remove(this.mesh);
    this._disposeMesh();
    this.buildMesh();
    if (this.mesh) {
      this.mesh.position.copy(pos);
      if (this.params.orientation !== 'column') {
        this.mesh.rotation.copy(rot);
      } else {
        this.mesh.rotation.y = rot.y;
        this.mesh.rotation.z = rot.z;
      }
      if (parent) parent.add(this.mesh);
    }
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

  setSelected(selected) {
    this._isSelected = selected;
    if (!this.mesh) return;
    this.mesh.traverse(child => {
      if (!child.isMesh) return;
      if (selected) {
        if (!this._originalMaterials.has(child.uuid)) {
          this._originalMaterials.set(child.uuid, {
            emissive: child.material.emissive ? child.material.emissive.clone() : new THREE.Color(0),
            emissiveIntensity: child.material.emissiveIntensity || 0,
          });
        }
        child.material.emissive = new THREE.Color(0x4488ff);
        child.material.emissiveIntensity = 0.25;
      } else {
        const orig = this._originalMaterials.get(child.uuid);
        if (orig) {
          child.material.emissive.copy(orig.emissive);
          child.material.emissiveIntensity = orig.emissiveIntensity;
        }
      }
    });
  }

  setColor(colorHex) {
    this.color = colorHex;
    if (!this.mesh) return;
    const col = new THREE.Color(colorHex);
    this.mesh.traverse(child => {
      if (child.isMesh && child.material && child.material.color) {
        child.material.color.copy(col);
        child.material.needsUpdate = true;
        // Update originals so deselect doesn't revert
        this._originalMaterials.set(child.uuid, {
          emissive: child.material.emissive ? child.material.emissive.clone() : new THREE.Color(0),
          emissiveIntensity: child.material.emissiveIntensity || 0,
        });
      }
    });
  }

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
    }
  }

  getBoundingBox() {
    if (!this.mesh) return null;
    return new THREE.Box3().setFromObject(this.mesh);
  }
}
