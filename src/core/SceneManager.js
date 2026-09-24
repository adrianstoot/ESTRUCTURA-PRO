import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

/**
 * SceneManager v4.0 — Rewritten for Three.js r183+
 *  - Correct TransformControls usage (no getHelper(), direct scene.add)
 *  - Cursor-focused zoom and responsive damped navigation
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
    this._transformStartPosition = null;

    // ── Renderer ─────────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.6;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // ── Scene ────────────────────────────────────────────────
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xcbd5dc);

    // ── Cameras ───────────────────────────────────────────────
    const aspect = container.clientWidth / container.clientHeight;
    this.perspCamera = new THREE.PerspectiveCamera(45, aspect, 0.01, 2000);
    this.perspCamera.position.set(6, 4.5, 7.5);
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
    this._setupLights();

    // ── Environment (for PBR reflections) ────────────────────
    this._setupEnvironment();
    this._loadSteelTexture();

    // ── Orbit Controls ───────────────────────────────────────
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.13;
    this.orbitControls.minDistance = 0.1;
    this.orbitControls.maxDistance = 600;
    this.orbitControls.screenSpacePanning = true;
    this.orbitControls.zoomSpeed = 3.6;
    this.orbitControls.zoomToCursor = true;
    this.orbitControls.panSpeed = 1.25;
    this.orbitControls.rotateSpeed = 0.95;

    // ── Transform Controls — r183+ API ───────────────────────
    // In r183+, TransformControls extends Controls (NOT Object3D).
    // getHelper() returns this._root which IS an Object3D → add that to scene.
    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControls.setSize(0.55);
    this.transformControls.setTranslationSnap(0.001); // 1 mm; scene coordinates are metres.
    this.scene.add(this.transformControls.getHelper());

    this._transformReadout = document.createElement('div');
    this._transformReadout.className = 'transform-mm-readout';
    this._transformReadout.setAttribute('role', 'status');
    this._transformReadout.setAttribute('aria-live', 'polite');
    this._transformReadout.style.cssText = [
      'position:absolute', 'display:none', 'z-index:1200', 'pointer-events:none',
      'transform:translate(-50%,-115%)', 'padding:5px 8px',
      'border:1px solid rgba(93,190,238,.9)', 'background:rgba(12,16,21,.94)',
      'color:#f3f7fa', 'font:600 11px/1.3 "JetBrains Mono",monospace',
      'white-space:nowrap', 'box-shadow:0 2px 8px rgba(0,0,0,.35)',
    ].join(';');
    container.appendChild(this._transformReadout);

    this.transformControls.addEventListener('mouseDown', () => {
      this.orbitControls.enabled = false;
      this._isDragging = true;
      const object = this.transformControls.object;
      this._transformStartPosition = object?.getWorldPosition(new THREE.Vector3()) || null;
      if (this._transformReadout) this._transformReadout.style.display = this._transformStartPosition ? 'block' : 'none';
      this._renderTransformReadout();
    });

    this.transformControls.addEventListener('mouseUp', () => {
      this.orbitControls.enabled = true;
      this._isDragging = false;
      this._transformReadout.style.display = 'none';
      this._transformStartPosition = null;
      this._justFinishedDragging = true;
      setTimeout(() => { this._justFinishedDragging = false; }, 150);
      document.dispatchEvent(new Event('gizmo-drag-end'));
    });
    this.transformControls.addEventListener('objectChange', () => this._renderTransformReadout());

    // Keep the technical grid readable and let close-ups resolve down to 1 mm.
    this.orbitControls.addEventListener('change', () => {
      this.gridManager?.updateForCamera(
        this.camera,
        this.renderer.domElement.clientHeight,
        this.orbitControls.target,
      );
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

  // ─── LIGHTS ──────────────────────────────────────────────────
  _renderTransformReadout() {
    const object = this.transformControls?.object;
    const start = this._transformStartPosition;
    const readout = this._transformReadout;
    if (!object || !start || !readout || !this._isDragging) return;

    const position = object.getWorldPosition(new THREE.Vector3());
    const delta = position.clone().sub(start);
    const mm = value => `${value > 0 ? '+' : ''}${Math.round(value * 1000)}`;
    readout.textContent = `ΔX ${mm(delta.x)} · ΔY ${mm(delta.y)} · ΔZ ${mm(delta.z)} mm`;

    const projected = position.clone().project(this.camera);
    const canvasRect = this.renderer.domElement.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();
    readout.style.left = `${canvasRect.left - containerRect.left + (projected.x + 1) * canvasRect.width / 2}px`;
    readout.style.top = `${canvasRect.top - containerRect.top + (1 - projected.y) * canvasRect.height / 2}px`;
  }

  _setupLights() {
    this.hemiLight = new THREE.HemisphereLight(0xb0c4dd, 0x404858, 0.9);
    this.scene.add(this.hemiLight);

    this.ambientLight = new THREE.AmbientLight(0xc0c8d8, 0.7);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xfff8f0, 2.2);
    this.dirLight.position.set(10, 18, 12);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(2048, 2048);
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 100;
    this.dirLight.shadow.camera.left = -20;
    this.dirLight.shadow.camera.right = 20;
    this.dirLight.shadow.camera.top = 20;
    this.dirLight.shadow.camera.bottom = -20;
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.normalBias = 0.02;
    this.scene.add(this.dirLight);

    this.fillLight = new THREE.DirectionalLight(0xd0e0ff, 1.0);
    this.fillLight.position.set(-8, 8, -6);
    this.scene.add(this.fillLight);

    this.rimLight = new THREE.DirectionalLight(0xffffff, 0.6);
    this.rimLight.position.set(0, -4, 8);
    this.scene.add(this.rimLight);
  }

  _setupEnvironment() {
    const envScene = new THREE.Scene();
    const envGen = new THREE.PMREMGenerator(this.renderer);
    envGen.compileCubemapShader();
    const envMesh = new THREE.Mesh(
      new THREE.SphereGeometry(50, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x445566, side: THREE.BackSide })
    );
    envScene.add(envMesh);
    envScene.add(new THREE.AmbientLight(0x8899aa, 1));
    const envMap = envGen.fromScene(envScene, 0.01).texture;
    this.scene.environment = envMap;
    this.envMap = envMap;
    envGen.dispose();
  }

  _loadSteelTexture() {
    const textureUrl = `${import.meta.env.BASE_URL || '/'}textures/steel-rolled-pro.jpg`;
    new THREE.TextureLoader().load(textureUrl, (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(3, 3);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      this.steelTexture = texture;
      if (this._visualMode === 'pbr') {
        this.objects.forEach((object) => this._applyVisualModeToObject(object));
      }
    }, undefined, (error) => {
      console.warn('No se pudo cargar la textura de acero PBR.', error);
    });
  }

  // ─── VISUAL MODES ────────────────────────────────────────────
  setVisualMode(mode) {
    this._visualMode = mode;
    const badge = document.getElementById('viewport-mode-badge');
    const labels = { clay: 'TECHNICAL CLAY', pbr: 'PBR REALISTIC', wire: 'WIREFRAME', xray: 'X-RAY' };
    if (badge) badge.textContent = labels[mode] || mode.toUpperCase();
    this.objects.forEach(obj => this._applyVisualModeToObject(obj));
  }

  _applyVisualModeToObject(obj) {
    if (!obj.mesh) return;
    const mode = this._visualMode;
    obj.mesh.traverse(child => {
      if (!child.isMesh || !child.material) return;
      const mat = child.material;
      switch (mode) {
        case 'clay':
          mat.map = null;
          mat.bumpMap = null;
          mat.roughnessMap = null;
          mat.wireframe = false;
          mat.transparent = false; mat.opacity = 1;
          mat.roughness = 0.82; mat.metalness = 0.15;
          mat.color.set(obj._isSelected ? 0x4a5580 : 0x48505e);
          mat.envMapIntensity = 0.2;
          break;
        case 'pbr':
          mat.wireframe = false;
          mat.transparent = false; mat.opacity = 1;
          mat.roughness = 0.42; mat.metalness = 0.78;
          mat.color.set(new THREE.Color(obj.color));
          mat.envMapIntensity = 1.0;
          mat.map = this.steelTexture && (obj.type === 'profile' || (obj.type === 'plate' && obj.params?.subtype !== 'neoprene'))
            ? this.steelTexture
            : null;
          mat.bumpMap = mat.map;
          mat.bumpScale = mat.map ? 0.012 : 0;
          mat.roughnessMap = mat.map;
          break;
        case 'wire':
          mat.wireframe = true;
          mat.transparent = false; mat.opacity = 1;
          mat.color.set(obj._isSelected ? 0x6b93ff : 0x4a7acc);
          break;
        case 'xray':
          mat.wireframe = false;
          mat.transparent = true; mat.opacity = 0.35;
          mat.roughness = 0.5; mat.metalness = 0.3;
          mat.color.set(new THREE.Color(obj.color));
          mat.side = THREE.DoubleSide;
          mat.depthWrite = false;
          break;
      }
      mat.needsUpdate = true;
    });
  }

  // ─── HOVER SYSTEM ────────────────────────────────────────────
  setHovered(bimObj) {
    if (this._hoveredObj && this._hoveredObj !== bimObj) this._clearHover(this._hoveredObj);
    if (!bimObj || bimObj === this._hoveredObj || bimObj._isSelected) return;
    this._hoveredObj = bimObj;
    if (!bimObj.mesh) return;
    bimObj.mesh.traverse(child => {
      if (!child.isMesh || !child.material) return;
      if (!this._hoveredOriginals.has(child.uuid)) {
        this._hoveredOriginals.set(child.uuid, {
          emissive: child.material.emissive ? child.material.emissive.clone() : new THREE.Color(0),
          emissiveIntensity: child.material.emissiveIntensity || 0,
          roughness: child.material.roughness,
        });
      }
      child.material.emissive = new THREE.Color(0x2255aa);
      child.material.emissiveIntensity = 0.12;
      child.material.roughness = Math.max(0.3, child.material.roughness - 0.08);
      child.material.needsUpdate = true;
    });
  }

  _clearHover(bimObj) {
    if (!bimObj || !bimObj.mesh) return;
    bimObj.mesh.traverse(child => {
      if (!child.isMesh || !child.material) return;
      const orig = this._hoveredOriginals.get(child.uuid);
      if (orig) {
        child.material.emissive.copy(orig.emissive);
        child.material.emissiveIntensity = orig.emissiveIntensity;
        child.material.roughness = orig.roughness;
        child.material.needsUpdate = true;
      }
      this._hoveredOriginals.delete(child.uuid);
    });
    this._hoveredObj = null;
  }

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
  }

  getSelectableObjects() {
    const meshes = [];
    this.objects.forEach(o => {
      if (o.mesh) {
        o.mesh.traverse(child => { if (child.isMesh) meshes.push(child); });
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
    if (!hits.length) return null;
    let target = hits[0].object;
    while (target && !target.userData?.bimId) target = target.parent;
    if (!target?.userData?.bimId) return null;
    return this.objects.find(o => o.id === target.userData.bimId) || null;
  }

  getSurfaceHitAtMouse(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    this.mouse.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = this.raycaster.intersectObjects(this.getSelectableObjects(), true)[0];
    if (!hit) return null;
    let owner = hit.object;
    while (owner && !owner.userData?.bimId) owner = owner.parent;
    const normal = hit.face?.normal
      ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
      : new THREE.Vector3(0, 1, 0);
    return { point: hit.point.clone(), normal, objectId: owner?.userData?.bimId || null };
  }

  getPlacementPlanePointAtMouse(event, planePoint = this.orbitControls.target) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    this.mouse.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const normal = this.camera.getWorldDirection(new THREE.Vector3());
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, planePoint);
    return this.raycaster.ray.intersectPlane(plane, new THREE.Vector3());
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
    const d = 12;
    const positions = {
      iso:        [6, 4.5, 7.5],
      top:        [0, d, 0],
      bottom:     [0, -d, 0],
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

  _cameraUpForView(view) {
    if (view === 'top') return new THREE.Vector3(0, 0, -1);
    if (view === 'bottom') return new THREE.Vector3(0, 0, 1);
    return new THREE.Vector3(0, 1, 0);
  }

  _notifyCameraViewChanged() {
    document.dispatchEvent(new Event('camera-view-changed'));
  }

  setCameraView(view) {
    const pos = this._cameraViewPreset(view);
    const target = new THREE.Vector3(0, 0, 0);
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

    this.camera.position.set(...pos);
    this.camera.up.copy(this._cameraUpForView(view));
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld(true);
    this.orbitControls.object = this.camera;
    this.orbitControls.target.copy(target);
    const damping = this.orbitControls.enableDamping;
    this.orbitControls.enableDamping = false;
    this.orbitControls.update();
    this.orbitControls.enableDamping = damping;
    this.activeView = view;

    this.transformControls.camera = this.camera;
    this._updateZoomLabel();
    this._notifyCameraViewChanged();
  }

  /** Smooth animated transition between camera views. */
  animateCameraTo(view, duration = 450) {
    if (this._cameraAnim) cancelAnimationFrame(this._cameraAnim);
    const endPos = new THREE.Vector3(...this._cameraViewPreset(view));
    const endTarget = new THREE.Vector3(0, 0, 0);
    const isOrthoView = ['top','bottom','front','back','left','right'].includes(view);

    // If switching camera mode, swap first then animate on the destination camera
    const wasPersp = this._cameraMode === 'perspective';
    const willPersp = !isOrthoView;
    if (wasPersp !== willPersp) {
      // Carry current view to new camera so animation starts at the right place
      const sourceCamera = this.camera;
      const startWorld = sourceCamera.position.clone();
      const startTarget = this.orbitControls.target.clone();
      const startQuaternion = sourceCamera.quaternion.clone();
      const startUp = sourceCamera.up.clone();
      if (willPersp) {
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
      this.camera.position.copy(startWorld);
      this.camera.quaternion.copy(startQuaternion);
      this.camera.up.copy(startUp);
      this.camera.lookAt(startTarget);
      this.orbitControls.object = this.camera;
      this.orbitControls.target.copy(startTarget);
      this.transformControls.camera = this.camera;
    }

    const startPos = this.camera.position.clone();
    const startTarget = this.orbitControls.target.clone();
    const startUp = this.camera.up.clone();
    const endUp = this._cameraUpForView(view);
    const t0 = performance.now();
    const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const step = () => {
      const now = performance.now();
      const k = Math.min(1, (now - t0) / duration);
      const e = ease(k);
      this.camera.position.lerpVectors(startPos, endPos, e);
      this.orbitControls.target.lerpVectors(startTarget, endTarget, e);
      this.camera.up.lerpVectors(startUp, endUp, e).normalize();
      this.orbitControls.update();
      if (k < 1) {
        this._cameraAnim = requestAnimationFrame(step);
      } else {
        this.camera.up.copy(endUp);
        this.camera.position.copy(endPos);
        this.orbitControls.target.copy(endTarget);
        this.orbitControls.update();
        this.activeView = view;
        this._cameraAnim = null;
        this._updateZoomLabel();
        this._notifyCameraViewChanged();
      }
    };
    step();
  }

  /** Fit whole scene in view (Home / F key). */
  _orthographicBounds(box) {
    this.camera.updateMatrixWorld(true);
    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    for (let mask = 0; mask < 8; mask += 1) {
      const world = new THREE.Vector3(
        mask & 1 ? box.max.x : box.min.x,
        mask & 2 ? box.max.y : box.min.y,
        mask & 4 ? box.max.z : box.min.z,
      ).applyMatrix4(this.camera.matrixWorldInverse);
      min.min(world); max.max(world);
    }
    return { width: max.x - min.x, height: max.y - min.y };
  }

  _orthographicZoomToBounds(box, padding = 1.4) {
    const projected = this._orthographicBounds(box);
    const aspect = Math.max(0.1, this.container.clientWidth / Math.max(1, this.container.clientHeight));
    const zoomY = this._baseFrustumSize / Math.max(0.01, projected.height);
    const zoomX = this._baseFrustumSize * aspect / Math.max(0.01, projected.width);
    return Math.min(zoomX, zoomY) / Math.max(1, padding);
  }

  fitAll(padding = 1.4) {
    if (!this.objects.length) return;
    const box = new THREE.Box3();
    this.objects.forEach(o => { if (o.mesh) box.expandByObject(o.mesh); });
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    this.orbitControls.target.copy(center);
    if (this._cameraMode === 'perspective') {
      const dir = new THREE.Vector3().subVectors(this.camera.position, this.orbitControls.target).normalize();
      if (dir.lengthSq() < 1e-6) dir.set(1, 0.7, 1).normalize();
      this.camera.position.copy(center).add(dir.multiplyScalar(size * padding));
    } else {
      const direction = this.camera.position.clone().sub(this.orbitControls.target).normalize();
      if (!direction.lengthSq()) direction.set(1, 1, 1).normalize();
      this.camera.position.copy(center).addScaledVector(direction, 10);
      this.camera.zoom = this._orthographicZoomToBounds(box, padding);
      this.camera.updateProjectionMatrix();
      this._updateZoomLabel();
    }
    this.orbitControls.update();
  }

  /** Return current camera orientation as quaternion (used by NavigationCube). */
  getCameraQuaternion() {
    return this.camera.quaternion.clone();
  }

  focusOnObject(bimObj, { animate = true, padding = 1.35, duration = 260, targetPoint = null } = {}) {
    if (!bimObj?.mesh) return;
    const box = new THREE.Box3().setFromObject(bimObj.mesh);
    const center = targetPoint?.clone?.() || box.getCenter(new THREE.Vector3());
    const size = Math.max(0.01, box.getSize(new THREE.Vector3()).length());
    const startTarget = this.orbitControls.target.clone();
    const direction = this.camera.position.clone().sub(startTarget).normalize();
    if (direction.lengthSq() < 1e-8) direction.set(1, 0.7, 1).normalize();
    let endPosition;
    let endZoom = null;

    if (this._cameraMode === 'perspective') {
      const radius = size / 2;
      const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
      const distance = Math.max(this.orbitControls.minDistance, radius / Math.sin(halfFov) * padding);
      endPosition = center.clone().addScaledVector(direction, distance);
    } else {
      const distance = Math.max(1, this.camera.position.distanceTo(startTarget));
      endPosition = center.clone().addScaledVector(direction, distance);
      endZoom = THREE.MathUtils.clamp(this._orthographicZoomToBounds(box, padding), 0.05, 500);
    }

    if (animate && !document.documentElement.classList.contains('reduced-motion')) {
      this._animateFocusTo(endPosition, center, endZoom, duration);
    } else {
      this.camera.position.copy(endPosition);
      this.orbitControls.target.copy(center);
      if (endZoom !== null) this.camera.zoom = endZoom;
      this.camera.updateProjectionMatrix();
      this.orbitControls.update();
      this._updateZoomLabel();
    }
  }

  _animateFocusTo(endPosition, endTarget, endZoom, duration) {
    if (this._focusAnimFrame) cancelAnimationFrame(this._focusAnimFrame);
    if (this._cameraAnim) {
      cancelAnimationFrame(this._cameraAnim);
      this._cameraAnim = null;
    }
    const startPosition = this.camera.position.clone();
    const startTarget = this.orbitControls.target.clone();
    const startZoom = this.camera.zoom;
    const startTime = performance.now();
    const step = now => {
      const linear = THREE.MathUtils.clamp((now - startTime) / Math.max(1, duration), 0, 1);
      const eased = linear * linear * (3 - 2 * linear);
      this.camera.position.lerpVectors(startPosition, endPosition, eased);
      this.orbitControls.target.lerpVectors(startTarget, endTarget, eased);
      if (endZoom !== null) {
        this.camera.zoom = THREE.MathUtils.lerp(startZoom, endZoom, eased);
        this.camera.updateProjectionMatrix();
      }
      this.orbitControls.update();
      if (linear < 1) this._focusAnimFrame = requestAnimationFrame(step);
      else {
        this.camera.position.copy(endPosition);
        this.orbitControls.target.copy(endTarget);
        if (endZoom !== null) {
          this.camera.zoom = endZoom;
          this.camera.updateProjectionMatrix();
        }
        this._focusAnimFrame = null;
        this._updateZoomLabel();
      }
    };
    this._focusAnimFrame = requestAnimationFrame(step);
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

  resetZoom() {
    if (this._cameraMode === 'perspective') {
      this.camera.position.set(8, 6, 10);
      this.orbitControls.target.set(0, 0, 0);
    } else {
      this.camera.zoom = 1;
      this.camera.updateProjectionMatrix();
      const direction = this.camera.position.clone().sub(this.orbitControls.target).normalize();
      if (!direction.lengthSq()) direction.set(1, 1, 1).normalize();
      this.orbitControls.target.set(0, 0, 0);
      this.camera.position.copy(this.orbitControls.target).addScaledVector(direction, 10);
    }
    this.orbitControls.update();
    this._updateZoomLabel();
  }

  /** Switch to parallel projection while retaining the current camera direction and target. */
  useOrthographicProjection() {
    if (this._cameraMode === 'ortho') return;
    const target = this.orbitControls.target.clone();
    const position = this.camera.position.clone();
    const quaternion = this.camera.quaternion.clone();
    const up = this.camera.up.clone();
    const distance = Math.max(0.01, position.distanceTo(target));
    const perspective = this.camera;
    const verticalSpan = 2 * distance * Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2));

    this._cameraMode = 'ortho';
    this.camera = this.orthoCamera;
    this.camera.position.copy(position);
    this.camera.quaternion.copy(quaternion);
    this.camera.up.copy(up);
    this.camera.zoom = this._baseFrustumSize / Math.max(0.01, verticalSpan);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
    this.orbitControls.object = this.camera;
    this.orbitControls.target.copy(target);
    this.orbitControls.enableRotate = true;
    this.orbitControls.update();
    this.transformControls.camera = this.camera;
    this.activeView = 'orthographic-current';
    this.gridManager?.updateForCamera(this.camera, this.renderer.domElement.clientHeight, target);
    this._updateZoomLabel();
    this._notifyCameraViewChanged();
  }

  // ─── THEME ───────────────────────────────────────────────────
  setTheme(dark) {
    this._dark = dark;
    if (dark) {
      // The reference application keeps a light technical viewport inside a dark shell.
      this.scene.background = new THREE.Color(0xcbd5dc);
      this.hemiLight.color.set(0xf4f7fa);
      this.hemiLight.groundColor.set(0x667580);
      this.ambientLight.color.set(0xffffff);
      this.ambientLight.intensity = 0.82;
    } else {
      this.scene.background = new THREE.Color(0xf1f4f6);
      this.hemiLight.color.set(0xffffff);
      this.hemiLight.groundColor.set(0xb8c2c9);
      this.ambientLight.color.set(0xffffff);
      this.ambientLight.intensity = 0.96;
    }
  }

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
