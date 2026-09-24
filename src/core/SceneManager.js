import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { applyWorkshopStyle } from './WorkshopMaterial.js';

/**
 * SceneManager v4.0 — Rewritten for Three.js r183+
 *  - Correct TransformControls usage (no getHelper(), direct scene.add)
 *  - Fast zoom & pan (zoomSpeed=2, panSpeed=1.2)
 *  - Drag-state tracking to prevent click-deselect on gizmo drop
 *  - PBR metallic / clay / wire / xray visual modes
 */
export class SceneManager {
  constructor(container) {
    this.container = container;
    this.objects = [];
    this._visualMode = 'clay';
    this._dark = true;
    this._hoveredObj = null;
    this._hoveredOriginals = new Map();
    this._isDragging = false;
    this._justFinishedDragging = false;

    // ── Renderer ─────────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1.6;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // ── Scene ────────────────────────────────────────────────
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf2f4f5);

    // ── Cameras ───────────────────────────────────────────────
    const aspect = container.clientWidth / container.clientHeight;
    this.perspCamera = new THREE.PerspectiveCamera(45, aspect, 0.0001, 2000);
    this.perspCamera.position.set(8, 6, 10);
    this.perspCamera.lookAt(0, 0, 0);

    const frustumSize = 10;
    this.orthoCamera = new THREE.OrthographicCamera(
      frustumSize * aspect / -2, frustumSize * aspect / 2,
      frustumSize / 2, frustumSize / -2,
      -50, 2000
    );
    this.orthoCamera.position.set(0, 10, 0);
    this.orthoCamera.lookAt(0, 0, 0);

    this.camera = this.perspCamera; // Active camera
    this._cameraMode = 'perspective';
    this._baseFrustumSize = frustumSize;

    // ── Lights ───────────────────────────────────────────────

    // ── Environment (for PBR reflections) ────────────────────

    // ── Orbit Controls ───────────────────────────────────────
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.08;
    this.orbitControls.minDistance = 0.002;
    this.orbitControls.maxDistance = 600;
    this.orbitControls.screenSpacePanning = true;
    this.orbitControls.zoomSpeed = 0.8;
    this.orbitControls.zoomToCursor = true;
    this.orbitControls.panSpeed = 0.8;
    this.orbitControls.rotateSpeed = 0.8;
    this.renderer.domElement.addEventListener('wheel',event=>this.zoomAtPointer(event),{capture:true,passive:false});

    // ── Transform Controls — r183+ API ───────────────────────
    // In r183+, TransformControls extends Controls (NOT Object3D).
    // getHelper() returns this._root which IS an Object3D → add that to scene.
    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControls.setSize(0.55);
    this.transformControls.setTranslationSnap(0.001);
    this.transformControls.setRotationSnap(THREE.MathUtils.degToRad(1));
    this.scene.add(this.transformControls.getHelper());

    this.transformControls.addEventListener('mouseDown', () => {
      this.orbitControls.enabled = false;
      this._isDragging = true;
    });

    this.transformControls.addEventListener('mouseUp', () => {
      this.orbitControls.enabled = true;
      this._isDragging = false;
      this._justFinishedDragging = true;
      setTimeout(() => { this._justFinishedDragging = false; }, 150);
      document.dispatchEvent(new Event('gizmo-drag-end'));
    });

    // ── Raycaster ────────────────────────────────────────────
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Line = { threshold: 0.04 };
    this.mouse = new THREE.Vector2();

    // ── Resize ───────────────────────────────────────────────
    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
    new ResizeObserver(() => this._onResize()).observe(container);

    // ── Zoom Widget Integration ──────────────────────────────
    this._initZoomWidget();

    // ── Animation loop ────────────────────────────────────────
    this._animate = this._animate.bind(this);
    this._animate();
  }

  // ─── VISUAL MODES ────────────────────────────────────────────
  setVisualMode(mode) {
    this._visualMode = mode;
    const badge = document.getElementById('viewport-mode-badge');
    const labels = { clay: 'COLOR PLANO', wire: 'ARISTAS', xray: 'TRANSPARENTE' };
    if (badge) badge.textContent = labels[mode] || mode.toUpperCase();
    this.objects.forEach(obj => this._applyVisualModeToObject(obj));
  }

  _applyVisualModeToObject(obj) { applyWorkshopStyle(obj, this._visualMode); }

  // ─── HOVER SYSTEM ────────────────────────────────────────────
  setHovered(bimObj) {
    if(this._hoveredObj && this._hoveredObj!==bimObj) applyWorkshopStyle(this._hoveredObj,this._visualMode);
    this._hoveredObj=bimObj;
    if(bimObj && !bimObj._isSelected) bimObj.mesh.traverse(c=>{if(c.isMesh && c.material?.color)c.material.color.set('#98acb8');});
  }

  _clearHover(bimObj) { applyWorkshopStyle(bimObj,this._visualMode); this._hoveredObj=null; }

  clearHover() {
    if (this._hoveredObj) this._clearHover(this._hoveredObj);
  }

  // ─── OBJECT MANAGEMENT ───────────────────────────────────────
  addObject(obj) {
    this.scene.add(obj.mesh);
    this.objects.push(obj);
    this._applyVisualModeToObject(obj);
  }

  removeObject(obj) {
    // Always detach BEFORE removing from scene to prevent TransformControls error
    if (this.transformControls.object === obj.mesh) {
      this.transformControls.detach();
    }
    this.scene.remove(obj.mesh);
    if (this._hoveredObj === obj) this._hoveredObj = null;
    const idx = this.objects.indexOf(obj);
    if (idx !== -1) this.objects.splice(idx, 1);
    obj._disposeMesh?.();
  }

  getSelectableObjects() {
    const meshes = [];
    this.objects.forEach(o => {
      if (o.mesh?.visible) {
        o.mesh.traverseVisible(child => { if (child.isMesh && !child.userData.ignoreSnap) meshes.push(child); });
      }
    });
    return meshes;
  }

  getBIMObjectAtMouse(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.getSelectableObjects(), true);
    const hit=hits.find(h=>!this.renderer.clippingPlanes.some(p=>p.distanceToPoint(h.point)<0));
    if (!hit) return null;
    let target = hit.object;
    while (target && !target.userData?.bimId) target = target.parent;
    if (!target?.userData?.bimId) return null;
    return this.objects.find(o => o.id === target.userData.bimId) || null;
  }

  // ─── GIZMO ───────────────────────────────────────────────────
  attachGizmo(mesh) {
    if (mesh) this.transformControls.attach(mesh);
  }
  detachGizmo() {
    this.transformControls.detach();
  }
  setGizmoMode(mode) {
    this.transformControls.setMode(mode);
  }
  setGizmoSpace(space) {
    this.transformControls.setSpace(space);
  }

  // ─── CAMERA VIEWS (ARCHICAD MODE) ──────────────────────────
  _cameraViewPreset(view) {
    const d = 16;
    const positions = {
      iso:        [8, 6, 10],
      top:        [0, d, 0.01],
      bottom:     [0, -d, 0.01],
      front:      [0, 0, d],
      back:       [0, 0, -d],
      left:       [-d, 0, 0],
      right:      [d, 0, 0],
      topFront:   [0, d * 0.75, d * 0.75],
      topRight:   [d * 0.75, d * 0.75, 0],
      topLeft:    [-d * 0.75, d * 0.75, 0],
      topBack:    [0, d * 0.75, -d * 0.75],
      frontRight: [d * 0.75, d * 0.25, d * 0.75],
      frontLeft:  [-d * 0.75, d * 0.25, d * 0.75],
      backRight:  [d * 0.75, d * 0.25, -d * 0.75],
      backLeft:   [-d * 0.75, d * 0.25, -d * 0.75],
    };
    return positions[view] || positions.iso;
  }

  setCameraView(view) {
    const pos = this._cameraViewPreset(view);
    const target = this.orbitControls.target.clone();
    const isOrthoView = ['top','bottom','front','back','left','right'].includes(view);

    if (!isOrthoView) {
      this._cameraMode = 'perspective';
      this.camera = this.perspCamera;
      this.orbitControls.enableRotate = true;
    } else {
      this._cameraMode = 'ortho';
      this.camera = this.orthoCamera;
      this.orbitControls.enableRotate = false;
      this.camera.zoom = 1;
      this.camera.updateProjectionMatrix();
    }

    this.camera.up.set(0,1,0);
    if(view === "top") {pos[2]=0;this.camera.up.set(0,0,-1);}
    if(view === "bottom") {pos[2]=0;this.camera.up.set(0,0,1);}
    this.camera.position.set(...pos).add(target);
    this.camera.lookAt(target);
    this.orbitControls.object = this.camera;
    this.orbitControls.target.copy(target);
    this.orbitControls.update();

    this.transformControls.camera = this.camera;
    this._updateZoomLabel();
  }

  /** Smooth animated transition between camera views. */
  animateCameraTo(view) { this.setCameraView(view); this.fitAll(); }

  /** Fit whole scene in view (Home / F key). */
  fitAll(padding = 1.4) {
    if (!this.objects.length) return;
    const box = new THREE.Box3();
    this.objects.forEach(o => { if (o.mesh?.visible) box.expandByObject(o.mesh); });
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const direction=this.camera.position.clone().sub(this.orbitControls.target).normalize();
    this.orbitControls.target.copy(center);
    if (this._cameraMode === 'perspective') {
      const dir = direction;
      if (dir.lengthSq() < 1e-6) dir.set(1, 0.7, 1).normalize();
      this.camera.position.copy(center).add(dir.multiplyScalar(size * padding));
    } else {
      this.camera.position.copy(center).add(direction.multiplyScalar(Math.max(10,size)));
      this.camera.zoom = Math.min(this._baseFrustumSize,this._baseFrustumSize*this.container.clientWidth/this.container.clientHeight) / (size * padding);
      this.camera.updateProjectionMatrix();
      this._updateZoomLabel();
    }
    this.orbitControls.update();
  }

  /** Return current camera orientation as quaternion (used by NavigationCube). */
  getCameraQuaternion() {
    return this.camera.quaternion.clone();
  }

  focusOnObject(bimObj) {
    if (!bimObj?.mesh) return;
    const box = new THREE.Box3().setFromObject(bimObj.mesh);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const direction=this.camera.position.clone().sub(this.orbitControls.target).normalize();
    this.orbitControls.target.copy(center);
    
    if (this._cameraMode === 'perspective') {
      this.camera.position.copy(center).add(direction.multiplyScalar(Math.max(.005,size*1.6)));
    } else {
      // Ortográfica: centrar y ajustar zoom (frustum)
      this.camera.position.copy(center).add(direction.multiplyScalar(10));
      this.camera.zoom = Math.min(this._baseFrustumSize,this._baseFrustumSize*this.container.clientWidth/this.container.clientHeight) / Math.max(.001,size * 1.5);
      this.camera.updateProjectionMatrix();
      this._updateZoomLabel();
    }
    this.orbitControls.update();
  }

  // ─── ZOOM WIDGET ─────────────────────────────────────────────
  _initZoomWidget() {
    this._zwLabel = document.getElementById('zw-label');
    const btnIn = document.getElementById('zw-in');
    const btnOut = document.getElementById('zw-out');

    if (btnIn) btnIn.addEventListener('click', () => this.stepZoom(1.2));
    if (btnOut) btnOut.addEventListener('click', () => this.stepZoom(1/1.2));
    if (this._zwLabel) {
      this._zwLabel.addEventListener('dblclick', () => this.resetZoom());
    }

    // Escuchar cambios de zoom del OrbitControls (rueda ratón)
    this.orbitControls.addEventListener('change', () => this._updateZoomLabel());
  }

  _updateZoomLabel() {
    if (!this._zwLabel) return;
    let pct = 100;
    if (this._cameraMode === 'perspective') {
      // Aproximación del % de zoom basado en la distancia al target
      const dist = this.camera.position.distanceTo(this.orbitControls.target);
      pct = Math.round((10 / Math.max(0.1, dist)) * 100);
    } else {
      pct = Math.round(this.camera.zoom * 100);
    }
    this._zwLabel.textContent = `${pct}%`;
  }

  stepZoom(factor) {
    if (this._cameraMode === 'perspective') {
      // Acercar la cámara moviéndola hacia el target
      const target = this.orbitControls.target;
      const vec = new THREE.Vector3().subVectors(this.camera.position, target);
      vec.multiplyScalar(1 / factor);
      this.camera.position.copy(target).add(vec);
    } else {
      this.camera.zoom *= factor;
      this.camera.updateProjectionMatrix();
    }
    this.orbitControls.update();
    this._updateZoomLabel();
  }

  zoomAtPointer(event){
    if(!this.orbitControls.enabled||this._isDragging)return;
    event.preventDefault();event.stopImmediatePropagation();
    const rect=this.renderer.domElement.getBoundingClientRect(),pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),ray=new THREE.Raycaster();
    this.camera.updateMatrixWorld(true);this.scene.updateMatrixWorld(true);ray.setFromCamera(pointer,this.camera);
    const hit=ray.intersectObjects(this.getSelectableObjects(),false).find(h=>!this.renderer.clippingPlanes.some(p=>p.distanceToPoint(h.point)<0));
    const direction=this.camera.getWorldDirection(new THREE.Vector3()),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(direction,this.orbitControls.target),anchor=hit?.point.clone()||ray.ray.intersectPlane(plane,new THREE.Vector3());
    if(!anchor)return;
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?rect.height:1),factor=Math.exp(THREE.MathUtils.clamp(delta*.0012,-.8,.8));
    if(this.camera.isPerspectiveCamera){
      const distance=this.camera.position.distanceTo(anchor),next=THREE.MathUtils.clamp(distance*factor,.002,600),ratio=next/Math.max(distance,1e-12);
      this.camera.position.sub(anchor).multiplyScalar(ratio).add(anchor);this.orbitControls.target.sub(anchor).multiplyScalar(ratio).add(anchor);
    }else{
      this.camera.zoom=THREE.MathUtils.clamp(this.camera.zoom/factor,.01,100000);this.camera.updateProjectionMatrix();
      ray.setFromCamera(pointer,this.camera);plane.setFromNormalAndCoplanarPoint(direction,anchor);const after=ray.ray.intersectPlane(plane,new THREE.Vector3());
      if(after){const shift=anchor.clone().sub(after);this.camera.position.add(shift);this.orbitControls.target.add(shift);}
    }
    this.orbitControls.update();this._updateZoomLabel();
  }

  resetZoom() { this.fitAll(); this._updateZoomLabel(); }

  // ─── THEME ───────────────────────────────────────────────────
  setTheme(dark) { this._dark=dark; this.scene.background=new THREE.Color(dark?0xe9edf0:0xf7f8f9); }

  /** Dynamically resize gizmo so it stays visible at any zoom. */
  _updateGizmoSize() {
    if (!this.transformControls || !this.transformControls.object) return;
    let size = 0.55;
    if (this._cameraMode === 'perspective') {
      const dist = this.camera.position.distanceTo(this.orbitControls.target);
      size = THREE.MathUtils.clamp(dist / 20, 0.38, 0.72);
    } else {
      size = THREE.MathUtils.clamp(0.58 / Math.max(0.2, this.camera.zoom), 0.38, 0.72);
    }
    this.transformControls.setSize(size);
  }

  // ─── RESIZE ──────────────────────────────────────────────────
  _onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    
    const aspect = w / h;
    
    // Update Persp
    this.perspCamera.aspect = aspect;
    this.perspCamera.updateProjectionMatrix();

    // Update Ortho
    this.orthoCamera.left = this._baseFrustumSize * aspect / -2;
    this.orthoCamera.right = this._baseFrustumSize * aspect / 2;
    this.orthoCamera.top = this._baseFrustumSize / 2;
    this.orthoCamera.bottom = this._baseFrustumSize / -2;
    this.orthoCamera.updateProjectionMatrix();

    this.renderer.setSize(w, h);
  }

  // ─── LOOP ────────────────────────────────────────────────────
  _animate() {
    requestAnimationFrame(this._animate);
    this.orbitControls.update();
    this._updateGizmoSize();
    this.renderer.render(this.scene, this.camera);
    this._fpsFrames = (this._fpsFrames || 0) + 1;
    const now = performance.now();
    if (!this._fpsT0) this._fpsT0 = now;
    if (now - this._fpsT0 >= 500) {
      this.fps = Math.round((this._fpsFrames * 1000) / (now - this._fpsT0));
      this._fpsFrames = 0;
      this._fpsT0 = now;
    }
  }
}
