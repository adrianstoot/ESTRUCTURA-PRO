import * as THREE from 'three';
import { BIMElement } from './BIMElement.js';
import { getProfileData, getEngineeringData, SERIES_LIST } from './ProfileCatalog.js';

/**
 * Profile v3.2 — Geometría de precisión normativa.
 *
 * Cada perfil se construye con ExtrudeGeometry a partir de un Shape 2D
 * que representa la sección transversal EXACTA según el catálogo:
 *   - h, b, tw, tf, r: dimensiones reales en mm → convertidas a metros
 *   - Radio de acuerdo r en los 4 filetes alma-ala (cuartos de círculo reales)
 *   - Bisel de borde (bevelEnabled) para calidad visual de arista
 *   - Sin solapamientos, sin artefactos
 *
 * Sistema de ejes de la extrusión:
 *   X = ancho (b), Y = alto (h), Z = longitud (L)
 *   orientation='column' → rota -90° en X para que L quede en Y (vertical)
 *   orientation='beam'   → sin rotación, L en Z (horizontal)
 */
export class Profile extends BIMElement {
  constructor(series = 'IPE', size = '200', length = 3.0, orientation = 'beam', options = {}) {
    super('profile', {
      series, size, length, orientation,
      sectionRotation: Number(options.sectionRotation ?? 0),
      insertionPoint: options.insertionPoint || 'center',
      role: options.role || null,
      assemblyId: options.assemblyId || null,
      templateInstanceId: options.templateInstanceId || null,
      detailLevel: options.detailLevel || 'standard',
      endTreatment: options.endTreatment || 'square-cut',
    });
    this._computeProperties();
    this.buildMesh();
  }

  _computeProperties() {
    const eng = getEngineeringData(this.params.series, this.params.size, this.params.length, this.steelGrade);
    if (!eng) return;
    this.designation   = eng.designation;
    this.area          = eng.area;
    this.mass          = eng.mass;
    this.tw            = eng.tw;
    this.tf            = eng.tf;
    this.engineeringData = eng;
  }

  buildMesh() {
    const { series, size, length, orientation } = this.params;
    const data = getProfileData(series, size);
    if (!data) return;

    const group = new THREE.Group();
    const sectionGroup = new THREE.Group();
    group.name = this.designation || `${series} ${size}`;
    sectionGroup.name = `${group.name} · sección`;
    const mat  = this.createMaterial(this.color);
    const L    = length;

    if      (series === 'CHS') this._buildCHS(sectionGroup, data, L, mat);
    else if (series === 'SHS') this._buildSHS(sectionGroup, data, L, mat);
    else if (series === 'L')   this._buildAngle(sectionGroup, data, L, mat);
    else if (series === 'UPN') this._buildChannel(sectionGroup, data, L, mat);
    else                        this._buildISection(sectionGroup, data, L, mat);

    sectionGroup.traverse(child => {
      if (!child.isMesh) return;
      child.name ||= `${series} ${size} - solid`;
      child.userData.componentRole = 'profile-solid';
    });

    // Roll angle is applied around the longitudinal local Z axis.
    const roll = [0, 90, 180, 270].includes(Number(this.params.sectionRotation))
      ? Number(this.params.sectionRotation)
      : 0;
    sectionGroup.rotation.z = THREE.MathUtils.degToRad(roll);
    this._applyInsertionOffset(sectionGroup, data);
    group.add(sectionGroup);

    const startPivot = new THREE.Group();
    startPivot.name = 'PIVOT_INICIO';
    startPivot.position.z = -L / 2;
    startPivot.userData = { componentRole: 'connection-pivot', end: 'start' };
    group.add(startPivot);
    const endPivot = new THREE.Group();
    endPivot.name = 'PIVOT_FIN';
    endPivot.position.z = L / 2;
    endPivot.userData = { componentRole: 'connection-pivot', end: 'end' };
    group.add(endPivot);

    // Column preset maps longitudinal local Z to world Y.
    if (orientation === 'column') group.rotation.x = -Math.PI / 2;

    this.mesh = group;
    this._applyUserData();
    this.mesh.userData.pivot = 'member-centroid';
    this.mesh.userData.longitudinalAxis = 'local-z';
    this.mesh.userData.connectionPivots = ['PIVOT_INICIO', 'PIVOT_FIN'];
  }

  _applyInsertionOffset(sectionGroup, data) {
    const point = this.params.insertionPoint || 'center';
    const h = (data.h || data.d || data.a || 0) / 1000;
    const b = (data.b || data.d || data.b || data.a || 0) / 1000;
    const offsets = {
      center: [0, 0], top: [0, -h / 2], bottom: [0, h / 2],
      left: [b / 2, 0], right: [-b / 2, 0],
      'top-left': [b / 2, -h / 2], 'top-right': [-b / 2, -h / 2],
      'bottom-left': [b / 2, h / 2], 'bottom-right': [-b / 2, h / 2],
    };
    const [dx, dy] = offsets[point] || offsets.center;
    sectionGroup.position.set(dx, dy, 0);
  }

  /* ─── UTILIDADES ──────────────────────────────────────────── */

  /**
   * Extruye un Shape 2D a lo largo de Z y centra en Z.
   * bevelSize controla el bisel de arista (pequeño pero visible).
   */
  _extrude(shape, L, mat, curveSegments = 4, bevelSize = 0.0006) {
    const bevel = Math.min(Math.max(0, bevelSize), Math.max(0, L * 0.01));
    const useBevel = this.params.detailLevel !== 'performance' && bevel > 0 && L > bevel * 4;
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth:           L,
      bevelEnabled:    useBevel,
      bevelThickness:  bevel,
      bevelSize:       bevel,
      bevelOffset:     0,
      bevelSegments:   useBevel ? 1 : 0,
      curveSegments,
    });
    geo.translate(0, 0, -L / 2);   // centrar en Z
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow    = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /* ─── SECCIÓN I  (IPE · HEB · HEA · IPN) ─────────────────── */
  /**
   * Shape de la sección en I construida con las dimensiones exactas.
   *
   *        ←——— b ———→
   *    ┌──────────────┐  ↑
   *    │   ala sup    │  tf
   *    └────┐    ┌────┘  ↓
   *         │    │       ↑
   *         │alma│    hw = h - 2·tf
   *         │    │       ↓
   *    ┌────┘    └────┐  ↑
   *    │   ala inf    │  tf
   *    └──────────────┘  ↓
   *
   * Filetes en las 4 esquinas interior alma-ala: arco de radio r real.
   */
  _buildISection(group, dims, L, mat) {
    // Dimensiones en metros
    const h  = dims.h  / 1000;   // altura total
    const b  = dims.b  / 1000;   // ancho ala
    const tw = dims.tw / 1000;   // espesor alma
    const tf = dims.tf / 1000;   // espesor ala
    const r  = Math.min(dims.r / 1000, (b/2 - tw/2) * 0.99, (h/2 - tf) * 0.99);

    // Coordenadas clave
    const H  =  h / 2;   // mitad altura (arriba)
    const B  =  b / 2;   // mitad ancho ala
    const Tw = tw / 2;   // mitad ancho alma
    // Altura interior del alma (entre alas)
    const Yi = H - tf;   // y donde comienza el filete (desde centro)

    /*
     * Recorrido del contorno en sentido ANTIHORARIO
     * empezando en esquina inferior-izquierda del ala inferior:
     *
     *  P0 (-B, -H)  →  P1 (B, -H)   ← borde inferior ala
     *  P1 (B, -H)   →  P2 (B, -H+tf) ← lado exterior ala derecha
     *  P2 (B, -H+tf) → filete inferior-derecho → (Tw, -Yi)
     *  subir alma derecha hasta filete superior-derecho
     *  filete superior-derecho → (B, H-tf)
     *  P (B, H-tf)  → P (B, H)      ← borde superior ala derecha
     *  P (B, H)     → P (-B, H)     ← borde superior ala
     *  P (-B, H)    → P (-B, H-tf)  ← lado exterior ala izquierda
     *  filete superior-izquierdo → (-Tw, Yi)
     *  bajar alma izquierda hasta filete inferior-izquierdo
     *  filete inferior-izquierdo → (-B, -H+tf)
     *  P (-B, -H+tf) → P (-B, -H)  ← cerrar
     */
    const shape = new THREE.Shape();

    // ── ALA INFERIOR ──────────────────────────────────────────
    shape.moveTo(-B, -H);
    shape.lineTo( B, -H);
    shape.lineTo( B, -(H - tf));

    // Filete inferior-derecho (centro del arco: Tw+r, -(Yi-r))
    //  desde (B, -(H-tf)) curva hasta (Tw, -(Yi-r)) → bajamos a (Tw, -Yi+r)
    shape.lineTo( Tw + r, -(Yi));          // punto antes del arco
    shape.absarc( Tw + r, -(Yi - r), r,
                  -Math.PI / 2,            // ángulo inicio: apunta hacia abajo
                   Math.PI,                // ángulo fin: apunta hacia izquierda
                   true                    // antihorario = true → clockwise en Three = sentido horario del arco
    );

    // ── ALMA (lado derecho, subiendo) ─────────────────────────
    shape.lineTo(Tw, Yi - r);

    // Filete superior-derecho
    shape.absarc( Tw + r,  Yi - r, r,
                  Math.PI,
                  Math.PI / 2,
                  true
    );

    // ── ALA SUPERIOR ──────────────────────────────────────────
    shape.lineTo( B,  H - tf);
    shape.lineTo( B,  H);
    shape.lineTo(-B,  H);
    shape.lineTo(-B,  H - tf);

    // Filete superior-izquierdo
    shape.lineTo(-(Tw + r),  Yi);
    shape.absarc(-(Tw + r),  Yi - r, r,
                  Math.PI / 2,
                  0,
                  true
    );

    // ── ALMA (lado izquierdo, bajando) ────────────────────────
    shape.lineTo(-Tw, -(Yi - r));

    // Filete inferior-izquierdo
    shape.absarc(-(Tw + r), -(Yi - r), r,
                  0,
                  -Math.PI / 2,
                  true
    );

    shape.lineTo(-B, -(H - tf));
    shape.lineTo(-B, -H);   // cierra al punto inicial

    group.add(this._extrude(shape, L, mat, 4));
  }

  /* ─── CANAL UPN ───────────────────────────────────────────── */
  _buildChannel(group, dims, L, mat) {
    const h  = dims.h  / 1000;
    const b  = dims.b  / 1000;
    const tw = dims.tw / 1000;
    const tf = dims.tf / 1000;
    const r  = Math.min(dims.r / 1000, (b - tw) * 0.9, (h/2 - tf) * 0.9);

    const H  =  h / 2;
    const Yi =  H - tf;

    // Perfil en U: alma a la izquierda (x = -b/2 a -b/2+tw)
    // alas hacia la derecha
    const x0 = -b / 2;       // cara exterior alma
    const x1 = x0 + tw;      // cara interior alma
    const xF =  b / 2;       // extremo alas

    const shape = new THREE.Shape();
    shape.moveTo(x0, -H);
    shape.lineTo(xF, -H);
    shape.lineTo(xF, -(H - tf));
    // filete inferior
    shape.lineTo(x1 + r, -(H - tf));
    shape.absarc(x1 + r, -(H - tf - r), r, -Math.PI/2, Math.PI, true);
    shape.lineTo(x1, Yi - r);
    // filete superior
    shape.absarc(x1 + r, Yi - r, r, Math.PI, Math.PI/2, true);
    shape.lineTo(xF, H - tf);
    shape.lineTo(xF, H);
    shape.lineTo(x0, H);
    shape.lineTo(x0, -H);

    group.add(this._extrude(shape, L, mat, 4));
  }

  /* ─── ANGULAR L ───────────────────────────────────────────── */
  _buildAngle(group, dims, L, mat) {
    const a  = dims.a / 1000;
    const b  = (dims.b || dims.a) / 1000;
    const t  = dims.t / 1000;
    // Radio de acuerdo interior según catálogo EN 10056-1: r1 ≈ t, r2 ≈ t/2
    const r1 = Math.min(t * 1.0, (b - t) * 0.8, (a - t) * 0.8);   // filete interior
    const r2 = Math.min(t * 0.4, 0.004);                            // radio punta exterior

    // Centrado en centroide aproximado
    const cx = b / 2;
    const cy = a / 2;

    const shape = new THREE.Shape();
    // Origen en esquina exterior inferior-izquierda del contorno,
    // luego se traslada al centrar el mesh.

    // Pata horizontal (a lo largo de X)
    shape.moveTo(0,  0);
    shape.lineTo(b,  0);
    shape.lineTo(b,  t);               // esquina punta ala horizontal

    // Pata vertical (a lo largo de Y) — unión con filete interior r1
    // El filete está en la esquina interior (t, t) con radio r1
    shape.lineTo(t + r1, t);
    shape.absarc(t + r1, t + r1, r1,
                 -Math.PI / 2,
                  Math.PI,
                  true);               // cuarto de círculo interior

    shape.lineTo(t, a);
    shape.lineTo(0, a);
    shape.lineTo(0, 0);

    const mesh = this._extrude(shape, L, mat, 4);
    // Centrar en XY (centroide teórico ≈ b/2, a/2 para simplificar)
    mesh.position.set(-cx, -cy, 0);
    group.add(mesh);
  }

  /* ─── TUBO CHS ────────────────────────────────────────────── */
  _buildCHS(group, dims, L, mat) {
    const ro = (dims.d / 1000) / 2;
    const t  =  dims.t / 1000;
    const ri =  Math.max(ro - t, 0.001);

    const outer = new THREE.Shape();
    outer.absarc(0, 0, ro, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, ri, 0, Math.PI * 2, true);
    outer.holes.push(hole);

    const geo = new THREE.ExtrudeGeometry(outer, {
      depth: L, bevelEnabled: false, curveSegments: this.params.detailLevel === 'performance' ? 24 : 32,
    });
    geo.translate(0, 0, -L / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }

  /* ─── TUBO SHS/RHS ────────────────────────────────────────── */
  _buildSHS(group, dims, L, mat) {
    const H  = dims.h / 1000;
    const B  = dims.b / 1000;
    const t  = dims.t / 1000;
    const ro = Math.min(t * 1.5, 0.008);   // radio exterior esquina
    const ri = Math.max(ro - t * 0.8, 0.001); // radio interior esquina

    const addRoundRect = (shape, w, h, rx) => {
      const hw = w / 2, hh = h / 2;
      shape.moveTo(-hw + rx, -hh);
      shape.lineTo( hw - rx, -hh);
      shape.absarc( hw - rx, -hh + rx, rx, -Math.PI/2,  0,          false);
      shape.lineTo( hw,       hh - rx);
      shape.absarc( hw - rx,  hh - rx, rx,  0,           Math.PI/2,  false);
      shape.lineTo(-hw + rx,  hh);
      shape.absarc(-hw + rx,  hh - rx, rx,  Math.PI/2,  Math.PI,    false);
      shape.lineTo(-hw,      -hh + rx);
      shape.absarc(-hw + rx, -hh + rx, rx,  Math.PI,    -Math.PI/2, false);
    };

    const outer = new THREE.Shape();
    addRoundRect(outer, B, H, ro);
    const hole = new THREE.Path();
    addRoundRect(hole, B - 2*t, H - 2*t, ri);
    outer.holes.push(hole);

    const geo = new THREE.ExtrudeGeometry(outer, {
      depth: L, bevelEnabled: false, curveSegments: 6,
    });
    geo.translate(0, 0, -L / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }

  update(params) {
    Object.assign(this.params, params);
    this._computeProperties();
    this.updateMesh();
  }
}
