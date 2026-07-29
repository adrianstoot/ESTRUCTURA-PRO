import * as THREE from 'three';

/**
 * NavigationCube v1.0 — Interactive 3D view cube (AutoCAD / Fusion style)
 *
 *  - Renders its own tiny Three.js scene inside a dedicated <canvas>.
 *  - A unit cube with 6 labeled faces (TOP/BOTTOM/FRONT/BACK/LEFT/RIGHT)
 *    reflects the orientation of the main camera every frame.
 *  - Click a face  → animate main camera to that orthogonal view.
 *  - Click an edge → ISO of the two neighbor faces.
 *  - Click a corner→ a full ISO.
 *  - Hover feedback: the hit region lights up in accent color.
 */
export class NavigationCube {
  constructor(canvas, sceneManager) {
    this.canvas = canvas;
    this.sceneManager = sceneManager;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setSize(canvas.clientWidth || 96, canvas.clientHeight || 96, false);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1.6, 1.6, 1.6, -1.6, 0.1, 10);
    this.camera.position.set(0, 0, 4);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(3, 5, 4);
    this.scene.add(dir);

    this._buildCube();
    this._buildPickRegions();

    this.raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this._hovered = null;

    this._bindEvents();
    this._loop = this._loop.bind(this);
    this._loop();
  }

  // ── Face texture (CanvasTexture with label) ───────────────────
  _faceTexture(label, hot = false) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');

    const base = hot ? '#4f7fff' : '#eef1f7';
    const textColor = hot ? '#ffffff' : '#1f2636';
    const borderColor = hot ? '#2b55d9' : '#c4cbda';

    // body gradient
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, hot ? '#6b93ff' : '#ffffff');
    g.addColorStop(1, base);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);

    // thick inner border
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 250, 250);

    // subtle corner marks
    ctx.strokeStyle = hot ? 'rgba(255,255,255,0.4)' : 'rgba(80,90,120,0.25)';
    ctx.lineWidth = 2;
    const L = 24;
    [[10,10],[246,10],[10,246],[246,246]].forEach(([x,y]) => {
      ctx.beginPath();
      ctx.moveTo(x - Math.sign(x-128)*L, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y - Math.sign(y-128)*L);
      ctx.stroke();
    });

    // label
    ctx.fillStyle = textColor;
    ctx.font = '700 58px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 128, 132);

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }

  _buildCube() {
    const labels = ['RIGHT', 'LEFT', 'TOP', 'BOTTOM', 'FRONT', 'BACK'];
    // Order must match BoxGeometry materials: +X, -X, +Y, -Y, +Z, -Z
    this._faceTextures = labels.map(l => this._faceTexture(l, false));
    this._faceTexturesHot = labels.map(l => this._faceTexture(l, true));

    const mats = this._faceTextures.map(tex =>
      new THREE.MeshBasicMaterial({ map: tex })
    );

    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.cube = new THREE.Mesh(geo, mats);
    this.scene.add(this.cube);

    // thin black edge wireframe for technical look
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x2c3245, transparent: true, opacity: 0.9 })
    );
    this.cube.add(edges);
  }

  // Invisible pick helpers for edges and corners (slightly larger than cube).
  _buildPickRegions() {
    this._pickRegions = [];
    const inv = new THREE.MeshBasicMaterial({ visible: false });
    const edgeGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);

    // 12 edges – midpoints of each cube edge
    const edgeDefs = [
      ['topFront',    [ 0,  0.5,  0.5]], ['topBack',     [ 0,  0.5, -0.5]],
      ['topRight',    [ 0.5, 0.5, 0  ]], ['topLeft',     [-0.5, 0.5, 0  ]],
      ['bottomFront', [ 0, -0.5,  0.5]], ['bottomBack',  [ 0, -0.5, -0.5]],
      ['bottomRight', [ 0.5,-0.5, 0  ]], ['bottomLeft',  [-0.5,-0.5, 0  ]],
      ['frontRight',  [ 0.5, 0,   0.5]], ['frontLeft',   [-0.5, 0,   0.5]],
      ['backRight',   [ 0.5, 0,  -0.5]], ['backLeft',    [-0.5, 0,  -0.5]],
    ];
    edgeDefs.forEach(([view, p]) => {
      const m = new THREE.Mesh(edgeGeo, inv);
      m.position.set(...p);
      m.userData.navView = view;
      m.userData.navKind = 'edge';
      this.cube.add(m);
      this._pickRegions.push(m);
    });

    // 8 corners → ISO
    const cornerGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    const cornerDefs = [
      [ 0.5,  0.5,  0.5], [-0.5,  0.5,  0.5],
      [ 0.5,  0.5, -0.5], [-0.5,  0.5, -0.5],
      [ 0.5, -0.5,  0.5], [-0.5, -0.5,  0.5],
      [ 0.5, -0.5, -0.5], [-0.5, -0.5, -0.5],
    ];
    cornerDefs.forEach(p => {
      const m = new THREE.Mesh(cornerGeo, inv);
      m.position.set(...p);
      m.userData.navView = 'iso';
      m.userData.navKind = 'corner';
      this.cube.add(m);
      this._pickRegions.push(m);
    });
  }

  _bindEvents() {
    const canvas = this.canvas;
    canvas.addEventListener('pointermove', (e) => this._onPointer(e, false));
    canvas.addEventListener('pointerleave', () => this._clearHover());
    canvas.addEventListener('click', (e) => this._onPointer(e, true));

    // Home button (if present next to cube)
    const home = document.getElementById('nav-cube-home');
    if (home) {
      home.addEventListener('click', () => this.sceneManager.fitAll());
    }
  }

  _onPointer(event, commit) {
    const rect = this.canvas.getBoundingClientRect();
    this._pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this._pointer, this.camera);

    // Test edges/corners first (they sit on the cube and have priority)
    const pickHits = this.raycaster.intersectObjects(this._pickRegions, false);
    if (pickHits.length) {
      const pick = pickHits[0].object;
      if (commit) this._go(pick.userData.navView);
      else this._setHover(pick);
      return;
    }

    // Face pick on the cube body
    const hits = this.raycaster.intersectObject(this.cube, false);
    if (hits.length && hits[0].face) {
      const faceIdx = hits[0].face.materialIndex;
      const views = ['right','left','top','bottom','front','back'];
      const v = views[faceIdx];
      if (commit) this._go(v);
      else this._setHover({ userData: { faceIdx } });
      return;
    }
    this._clearHover();
  }

  _setHover(target) {
    if (this._hovered === target) return;
    this._clearHover();
    this._hovered = target;
    if (target?.userData?.faceIdx !== undefined) {
      this.cube.material[target.userData.faceIdx].map = this._faceTexturesHot[target.userData.faceIdx];
      this.cube.material[target.userData.faceIdx].needsUpdate = true;
    }
    this.canvas.style.cursor = 'pointer';
  }

  _clearHover() {
    if (this._hovered?.userData?.faceIdx !== undefined) {
      const i = this._hovered.userData.faceIdx;
      this.cube.material[i].map = this._faceTextures[i];
      this.cube.material[i].needsUpdate = true;
    }
    this._hovered = null;
    this.canvas.style.cursor = '';
  }

  _go(view) {
    this._clearHover();
    this.sceneManager.animateCameraTo(view, 450);
  }

  // ── Main loop: mirror the main camera orientation ─────────────
  _loop() {
    this._rafId = requestAnimationFrame(this._loop);
    // Reflect orientation of the main camera
    const mainCam = this.sceneManager.camera;
    if (mainCam) {
      this.cube.quaternion.copy(mainCam.quaternion).invert();
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this.renderer.dispose();
  }
}
