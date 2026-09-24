import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const PRESETS = Object.freeze({
  iso: new THREE.Vector3(1, 0.72, 1),
  front: new THREE.Vector3(0, 0, 1),
  right: new THREE.Vector3(1, 0, 0),
  top: new THREE.Vector3(0, 1, 0.0001),
  detail: new THREE.Vector3(-1, 0.38, 1),
});

/** Independent clean renderer: BIM meshes only, no grid, labels or editor overlays. */
export class RenderStudio {
  constructor(sceneManager, options = {}) {
    if (!sceneManager) throw new TypeError('RenderStudio requires SceneManager');
    this.sceneManager = sceneManager;
    this.textureUrl = options.textureUrl || `${import.meta.env.BASE_URL || '/'}textures/steel-rolled-pro.jpg`;
    this.host = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.modelRoot = null;
    this.ground = null;
    this.pmrem = null;
    this.environment = null;
    this.steelTexture = null;
    this.materials = new Set();
    this.bounds = new THREE.Box3();
    this.preset = 'iso';
    this.background = 'white';
    this.raf = 0;
    this.resizeObserver = null;
    this.opened = false;
  }

  open() {
    this._ensureDOM();
    this._ensureRenderer();
    this.host.hidden = false;
    this.opened = true;
    this._resize();
    this.refresh(true);
    this._animate();
    return this;
  }

  close() {
    if (!this.host) return;
    this.opened = false;
    this.host.hidden = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  refresh(fit = false) {
    if (!this.modelRoot) return;
    this._clearModel();
    let meshes = 0;
    for (const bim of this.sceneManager.objects || []) {
      if (!bim?.mesh || !this._worldVisible(bim.mesh)) continue;
      const clone = this._cloneBIM(bim);
      if (!clone) continue;
      this.modelRoot.add(clone);
      clone.traverse(node => { if (node.isMesh) meshes += 1; });
    }
    this.modelRoot.updateMatrixWorld(true);
    this.bounds.setFromObject(this.modelRoot, true);
    if (this.bounds.isEmpty()) this.bounds.set(new THREE.Vector3(-1,-.5,-1), new THREE.Vector3(1,.5,1));
    this._stage();
    if (fit) this.setPreset(this.preset);
    this._status(`${(this.sceneManager.objects || []).length} elementos · ${meshes} mallas · render limpio`);
    this._render();
  }

  setPreset(name = 'iso') {
    if (!PRESETS[name]) name = 'iso';
    this.preset = name;
    const select = this.host?.querySelector('[data-render-preset]');
    if (select) select.value = name;
    if (!this.camera || !this.controls) return;
    const sphere = this.bounds.getBoundingSphere(new THREE.Sphere());
    const radius = Math.max(.25, sphere.radius);
    const vfov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const hfov = Math.atan(Math.tan(vfov) * Math.max(.1, this.camera.aspect));
    const distance = radius / Math.sin(Math.max(.08, Math.min(vfov, hfov))) * (name === 'detail' ? .94 : 1.22);
    this.camera.up.set(0, name === 'top' ? 0 : 1, name === 'top' ? -1 : 0);
    this.camera.position.copy(sphere.center).addScaledVector(PRESETS[name].clone().normalize(), distance);
    this.camera.near = Math.max(.005, distance - radius * 2.5);
    this.camera.far = Math.max(100, distance + radius * 14);
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(sphere.center);
    this.controls.update();
    this._render();
  }

  setBackground(mode = 'white') {
    this.background = mode === 'transparent' ? 'transparent' : 'white';
    if (!this.renderer || !this.scene) return;
    const transparent = this.background === 'transparent';
    this.scene.background = transparent ? null : new THREE.Color(0xf5f6f7);
    this.renderer.setClearColor(transparent ? 0x000000 : 0xf5f6f7, transparent ? 0 : 1);
    if (this.ground) this.ground.visible = !transparent;
    this.host?.querySelectorAll('[data-background]').forEach(button => button.classList.toggle('active', button.dataset.background === this.background));
    this._render();
  }

  setAutoRotate(enabled) {
    if (this.controls) this.controls.autoRotate = !!enabled;
    const button = this.host?.querySelector('[data-action="rotate"]');
    button?.classList.toggle('active', !!enabled);
    if (button) button.textContent = enabled ? '⏸ Giro' : '↻ Giro';
  }

  async exportPNG() {
    const size = this.renderer.getSize(new THREE.Vector2());
    const oldRatio = this.renderer.getPixelRatio();
    const oldAspect = this.camera.aspect;
    const oldBackground = this.background;
    const width = Math.max(1, Math.round(size.x * 2));
    const height = Math.max(1, Math.round(size.y * 2));
    this._status(`Renderizando ${width} × ${height}…`);
    let blob;
    try {
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.render(this.scene, this.camera);
      blob = await new Promise((resolve, reject) => this.renderer.domElement.toBlob(value => value ? resolve(value) : reject(new Error('No se pudo codificar el PNG')), 'image/png'));
    } finally {
      this.renderer.setPixelRatio(oldRatio);
      this.renderer.setSize(size.x, size.y, false);
      this.camera.aspect = oldAspect;
      this.camera.updateProjectionMatrix();
      this.setBackground(oldBackground);
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ESTRUCTURAS-PRO-render.png';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this._status(`PNG exportado · ${width} × ${height}`);
  }

  _ensureDOM() {
    if (this.host) return;
    this.host = document.createElement('div');
    this.host.className = 'render-studio';
    this.host.hidden = true;
    this.host.innerHTML = `
      <div class="render-studio__backdrop" data-action="backdrop">
        <section class="render-studio__panel" role="dialog" aria-modal="true" aria-label="Estudio de render">
          <header><span class="render-studio__logo">E</span><div><b>ESTUDIO DE RENDER</b><small>ESTRUCTURAS PRO · ACERO PBR</small></div><button data-action="close" aria-label="Cerrar">×</button></header>
          <nav>
            <label>Cámara <select data-render-preset><option value="iso">Isométrica</option><option value="front">Frontal</option><option value="right">Lateral</option><option value="top">Superior</option><option value="detail">Detalle</option></select></label>
            <button data-action="fit">⌂ Encuadrar</button><button data-action="rotate">↻ Giro</button>
            <i></i><button class="active" data-background="white">Fondo blanco</button><button data-background="transparent">Transparente</button>
            <span></span><button data-action="refresh">↺ Actualizar</button><button class="primary" data-action="export">Exportar PNG 2×</button>
          </nav>
          <div class="render-studio__viewport"></div>
          <footer><span data-render-status>Preparando escena…</span><em>Arrastrar: orbitar · Rueda: zoom · Botón derecho: desplazar</em></footer>
        </section>
      </div>`;
    document.body.appendChild(this.host);
    this.host.addEventListener('click', event => {
      const target = event.target.closest('button,[data-action="backdrop"]');
      if (!target) return;
      const action = target.dataset.action;
      if (action === 'close' || (action === 'backdrop' && event.target === target)) this.close();
      if (action === 'fit') this.setPreset(this.preset);
      if (action === 'rotate') this.setAutoRotate(!this.controls?.autoRotate);
      if (action === 'refresh') this.refresh(false);
      if (action === 'export') this.exportPNG().catch(error => this._status(error.message));
      if (target.dataset.background) this.setBackground(target.dataset.background);
    });
    this.host.querySelector('[data-render-preset]').addEventListener('change', event => this.setPreset(event.target.value));
    this.host.addEventListener('keydown', event => { if (event.key === 'Escape') this.close(); });
  }

  _ensureRenderer() {
    if (this.renderer) return;
    const viewport = this.host.querySelector('.render-studio__viewport');
    this.renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true, preserveDrawingBuffer:true, powerPreference:'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    viewport.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, .01, 5000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = .07;
    this.controls.screenSpacePanning = true;
    this.controls.autoRotateSpeed = .8;
    this.modelRoot = new THREE.Group();
    this.scene.add(this.modelRoot);
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = this.pmrem.fromScene(room, .04).texture;
    room.dispose();
    this.scene.environment = this.environment;
    const hemi = new THREE.HemisphereLight(0xeaf7ff, 0x26313a, 1.25);
    const key = new THREE.DirectionalLight(0xffffff, 3.7); key.name = 'render-key'; key.castShadow = true; key.shadow.mapSize.set(2048,2048);
    const fill = new THREE.DirectionalLight(0xafdfff, 1.6); fill.name = 'render-fill';
    const rim = new THREE.DirectionalLight(0xffe3c5, 2.1); rim.name = 'render-rim';
    this.scene.add(hemi, key, key.target, fill, fill.target, rim, rim.target);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.ShadowMaterial({ color:0x26333c, opacity:.16, transparent:true, depthWrite:false }));
    this.ground.rotation.x = -Math.PI/2; this.ground.receiveShadow = true; this.scene.add(this.ground);
    new THREE.TextureLoader().load(this.textureUrl, texture => {
      texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(1.6,1.6);
      texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy()); this.steelTexture = texture;
      this.materials.forEach(material => this._textureMaterial(material)); this._render();
    }, undefined, () => this._status('PBR activo · textura opcional no disponible'));
    this.resizeObserver = new ResizeObserver(() => this._resize());
    this.resizeObserver.observe(viewport);
    this.setBackground('white');
  }

  _cloneBIM(bim) {
    const source = bim.mesh;
    source.updateWorldMatrix(true,true);
    const clone = source.clone(true);
    clone.matrix.copy(source.matrixWorld);
    clone.matrix.decompose(clone.position, clone.quaternion, clone.scale);
    const remove = [];
    clone.traverse(node => {
      const name = String(node.name || '').toLowerCase();
      if (node !== clone && (node.isLine || node.isLineSegments || node.isPoints || node.isSprite || /helper|gizmo|grid|snap|measure|outline|selection/.test(name))) { remove.push(node); return; }
      if (!node.isMesh) return;
      node.geometry = node.geometry.clone();
      node.material = this._materialFor(bim, node);
      node.castShadow = true; node.receiveShadow = true; node.renderOrder = 0;
    });
    remove.forEach(node => node.parent?.remove(node));
    let hasMesh = false; clone.traverse(node => { if (node.isMesh) hasMesh = true; });
    return hasMesh ? clone : null;
  }

  _materialFor(bim, node) {
    const text = `${bim.type || ''} ${bim.designation || ''} ${node.name || ''}`.toLowerCase();
    const kind = /weld|soldadura/.test(text) ? 'weld' : /bolt|tornillo|perno|anchor|nut|tuerca|washer|arandela/.test(text) ? 'fastener' : /concrete|hormig/.test(text) ? 'concrete' : 'steel';
    const settings = {
      steel:[0x7f8b95,.92,.31], fastener:[0x303941,.9,.23], weld:[0x454d53,.84,.38], concrete:[0x8a8d8f,0,.82],
    }[kind];
    const material = new THREE.MeshPhysicalMaterial({ color:settings[0], metalness:settings[1], roughness:settings[2], clearcoat:kind === 'concrete' ? 0 : .12, clearcoatRoughness:.42, envMapIntensity:kind === 'concrete' ? .45 : 1.18, side:THREE.FrontSide });
    material.userData.kind = kind;
    this.materials.add(material);
    this._textureMaterial(material);
    return material;
  }

  _textureMaterial(material) {
    if (!this.steelTexture || material.userData.kind === 'concrete') return;
    material.map = this.steelTexture; material.bumpMap = this.steelTexture; material.bumpScale = material.userData.kind === 'weld' ? .008 : .018; material.needsUpdate = true;
  }

  _stage() {
    const center = this.bounds.getCenter(new THREE.Vector3());
    const size = this.bounds.getSize(new THREE.Vector3());
    const extent = Math.max(size.x,size.y,size.z,1);
    this.ground.position.set(center.x,this.bounds.min.y - extent*.004,center.z); this.ground.scale.set(extent*4,extent*4,1);
    const positions = { 'render-key':[1.4,2.1,1.25], 'render-fill':[-1.6,.9,1.1], 'render-rim':[.7,1.4,-1.7] };
    for (const [name,coords] of Object.entries(positions)) { const light=this.scene.getObjectByName(name); light.position.copy(center).add(new THREE.Vector3(...coords).multiplyScalar(extent)); light.target.position.copy(center); }
  }

  _worldVisible(object) { for (let item=object; item; item=item.parent) if (!item.visible) return false; return true; }
  _clearModel() { this.modelRoot.traverse(node => { if (node.isMesh) node.geometry?.dispose?.(); }); this.modelRoot.clear(); this.materials.forEach(material => material.dispose()); this.materials.clear(); }
  _resize() { if (!this.renderer) return; const rect=this.host.querySelector('.render-studio__viewport').getBoundingClientRect(); if (!rect.width || !rect.height) return; this.renderer.setSize(rect.width,rect.height,false); this.camera.aspect=rect.width/rect.height; this.camera.updateProjectionMatrix(); this._render(); }
  _render() { if (this.renderer) this.renderer.render(this.scene,this.camera); }
  _animate() { if (this.raf || !this.opened) return; const tick=()=>{ this.raf=0; if (!this.opened) return; this.controls.update(); this._render(); this.raf=requestAnimationFrame(tick); }; this.raf=requestAnimationFrame(tick); }
  _status(text) { const el=this.host?.querySelector('[data-render-status]'); if (el) el.textContent=text; }

  dispose() {
    this.close(); this.resizeObserver?.disconnect(); this.controls?.dispose(); this._clearModel();
    this.ground?.geometry.dispose(); this.ground?.material.dispose(); this.steelTexture?.dispose(); this.environment?.dispose(); this.pmrem?.dispose(); this.renderer?.dispose(); this.host?.remove();
  }
}