import { getSizes, STEEL_GRADES, SERIES_LIST } from '../entities/ProfileCatalog.js';

const COLORS = [
  '#1E293B','#334155','#475569','#64748B','#94A3B8','#CBD5E1','#E2E8F0','#F8FAFC',
  '#991B1B','#DC2626','#F97316','#D97706','#EAB308','#65A30D','#16A34A','#059669',
  '#0D9488','#0891B2','#0284C7','#2563EB','#4F46E5','#6D28D9','#9333EA','#C026D3',
  '#DB2777','#BE123C','#7C2D12','#854D0E','#365314','#14532D','#164E63','#172554',
];
const STATUS_LABEL = { PASS: 'CUMPLE', WARN: 'REVISAR', FAIL: 'NO CUMPLE', NOT_CHECKED: 'SIN VERIFICAR' };
const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const fmt = (value, digits = 2) => Number.isFinite(Number(value)) ? Number(value).toLocaleString('es-ES', { maximumFractionDigits: digits }) : '—';
const hex = (value, fallback = '#64748B') => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toUpperCase() : fallback;

export class PropertiesPanel {
  constructor(panelElement, sectionDrawer) {
    this.panel = panelElement;
    this.sectionDrawer = sectionDrawer;
    this.currentElement = null;
    this.activeTab = 'geometry';
    this.onPropertyChange = null;
    this.onDelete = null;
    this.onDuplicate = null;
    this.onColorChange = null;
    this.onCalculate = null;
    this.onExplode = null;
    this.getClashes = null;
    this._renderShell();
  }

  _renderShell() {
    this.panel.innerHTML = `
      <div class="panel-header-bar"><span><i class="fa-solid fa-sliders"></i> PROPIEDADES</span><button type="button" id="inspector-pin" aria-label="Contraer inspector" aria-pressed="false" title="Contraer inspector">‹</button></div>
      <div class="panel-section">
        <canvas id="section-canvas" width="312" height="156"></canvas>
        <div class="mini-prop-row" id="mini-props"></div>
      </div>
      <nav class="inspector-tabs" aria-label="Secciones del inspector">
        <button type="button" data-inspector-tab="geometry" class="active">Geometría</button>
        <button type="button" data-inspector-tab="analysis">ELU / ELS</button>
        <button type="button" data-inspector-tab="connection">Unión</button>
      </nav>
      <div id="props-content" class="panel-content"></div>`;
    if (this.sectionDrawer) {
      this.sectionDrawer.canvas = this.panel.querySelector('#section-canvas');
      this.sectionDrawer.ctx = this.sectionDrawer.canvas?.getContext('2d');
      this.sectionDrawer.clear();
    }
    this.panel.querySelectorAll('[data-inspector-tab]').forEach(button => button.addEventListener('click', () => this.setActiveTab(button.dataset.inspectorTab)));
    const inspectorToggle = this.panel.querySelector('#inspector-pin');
    inspectorToggle?.addEventListener('click', () => {
      const collapsed = !document.documentElement.classList.contains('inspector-collapsed');
      document.documentElement.classList.toggle('inspector-collapsed', collapsed);
      inspectorToggle.setAttribute('aria-pressed', String(collapsed));
      inspectorToggle.setAttribute('aria-label', collapsed ? 'Expandir inspector' : 'Contraer inspector');
      inspectorToggle.title = collapsed ? 'Expandir inspector' : 'Contraer inspector';
      inspectorToggle.textContent = collapsed ? '›' : '‹';
    });
    this.update(null);
  }

  setActiveTab(tab) {
    this.activeTab = ['geometry','analysis','connection'].includes(tab) ? tab : 'geometry';
    this.panel.querySelectorAll('[data-inspector-tab]').forEach(button => button.classList.toggle('active', button.dataset.inspectorTab === this.activeTab));
    this.panel.querySelectorAll('[data-inspector-pane]').forEach(pane => pane.classList.toggle('active', pane.dataset.inspectorPane === this.activeTab));
  }

  refresh() { this.update(this.currentElement); }

  update(bimElement) {
    this.currentElement = bimElement;
    this.sectionDrawer?.draw(bimElement);
    const content = this.panel.querySelector('#props-content');
    const mini = this.panel.querySelector('#mini-props');
    if (!bimElement) {
      mini.innerHTML = '';
      content.innerHTML = `<div class="no-selection"><i class="fa-solid fa-arrow-pointer no-sel-icon"></i><b>Seleccione un elemento</b><span class="no-sel-hint">El inspector mostrará geometría, comprobaciones ELU/ELS y componentes de la unión.</span></div>`;
      return;
    }

    const result = bimElement.analysisResults;
    const status = result?.status || 'NOT_CHECKED';
    const clashes = this.getClashes?.(bimElement) || [];
    mini.innerHTML = `<span class="mini-prop-chip"><b>${esc(bimElement.type.toUpperCase())}</b></span><span class="mini-prop-chip">${esc(bimElement.steelGrade)}</span><span class="mini-prop-chip status-${status}">${STATUS_LABEL[status]}</span>`;

    content.innerHTML = `
      <div class="inspector-identity">
        <div><span>${esc(bimElement.params?.role || bimElement.type)}</span><h2>${esc(bimElement.designation)}</h2><small>${esc(bimElement.id)}</small></div>
        <div class="utilization-orb ${status}"><b>${Number.isFinite(Number(result?.ratio)) ? `${Math.round(result.ratio*100)}%` : '—'}</b><span>η máx.</span></div>
      </div>
      ${clashes.length ? `<div class="clash-banner"><i class="fa-solid fa-triangle-exclamation"></i><div><b>${clashes.length} posible${clashes.length === 1 ? '' : 's'} solape${clashes.length === 1 ? '' : 's'}</b><span>${clashes.slice(0,3).map(item => esc(item.other?.designation || item.designation || 'Elemento')).join(' · ')}</span></div></div>` : ''}
      <section class="inspector-pane" data-inspector-pane="geometry">${this._geometryHtml(bimElement)}</section>
      <section class="inspector-pane" data-inspector-pane="analysis">${this._analysisHtml(bimElement)}</section>
      <section class="inspector-pane" data-inspector-pane="connection">${this._connectionHtml(bimElement)}</section>`;
    this._wireEvents(bimElement);
    this.setActiveTab(this.activeTab);
  }

  _geometryHtml(element) {
    const grades = Object.keys(STEEL_GRADES);
    const grade = STEEL_GRADES[element.steelGrade] || STEEL_GRADES['S275 JR'];
    const eng = element.engineeringData;
    const color = hex(element.color);
    const rawStandard = element.analysisInput?.standard || element.connectionInput?.standard || 'CODIGO';
    const standard = ['CTE', 'CODIGO_CTE'].includes(rawStandard) ? 'CODIGO_CTE' : 'CODIGO';
    let html = this._acc('Material y norma', `
      ${this._field('Calidad', `<select id="prop-steel-grade">${grades.map(item => `<option ${item === element.steelGrade ? 'selected' : ''}>${item}</option>`).join('')}</select>`)}
      ${this._value('fy / fu', `${grade.fy} / ${grade.fu} MPa`)}${this._value('E', `${fmt(grade.E,0)} MPa`)}
      ${this._field('Normativa', `<select id="prop-standard"><option value="CODIGO" ${standard === 'CODIGO' ? 'selected' : ''}>Código Estructural · RD 470/2021</option><option value="CODIGO_CTE" ${standard === 'CODIGO_CTE' ? 'selected' : ''}>Código Estructural + CTE DB-SE-A</option></select>`)}`, true);

    if (element.type === 'profile') {
      const sizes = getSizes(element.params.series);
      html += this._acc('Perfil y eje local', `
        ${this._field('Serie', `<select id="prop-series">${SERIES_LIST.map(item => `<option ${item === element.params.series ? 'selected' : ''}>${item}</option>`).join('')}</select>`)}
        ${this._field('Tamaño', `<select id="prop-size">${sizes.map(item => `<option ${String(item) === String(element.params.size) ? 'selected' : ''}>${item}</option>`).join('')}</select>`)}
        ${this._field('Longitud', `<span class="input-unit"><input id="prop-length" type="number" min="0.1" step="0.1" value="${element.params.length}"><em>m</em></span>`)}
        ${this._field('Dirección base', `<select id="prop-orientation"><option value="beam" ${element.params.orientation === 'beam' ? 'selected' : ''}>Viga / libre</option><option value="column" ${element.params.orientation === 'column' ? 'selected' : ''}>Pilar vertical</option></select>`)}
        ${this._field('Giro θ', `<select id="prop-roll">${[0,90,180,270].map(v => `<option value="${v}" ${Number(element.params.sectionRotation || 0) === v ? 'selected' : ''}>${v}°</option>`).join('')}</select>`)}
        ${this._field('Inserción', `<select id="prop-insertion">${['center','top','bottom','left','right','top-left','top-right','bottom-left','bottom-right'].map(v => `<option value="${v}" ${element.params.insertionPoint === v ? 'selected' : ''}>${({center:'Centro',top:'Superior',bottom:'Inferior',left:'Izquierda',right:'Derecha','top-left':'Sup. izquierda','top-right':'Sup. derecha','bottom-left':'Inf. izquierda','bottom-right':'Inf. derecha'})[v]}</option>`).join('')}</select>`)}
        <button id="btn-apply-profile" class="prop-apply-btn">Aplicar perfil</button>`, true);
      if (eng) html += this._acc('Propiedades de sección', `
        ${this._value('A', `${fmt(element.area)} cm²`)}${this._value('Iy / Iz', `${fmt(eng.Iy,1)} / ${fmt(eng.Iz,1)} cm⁴`)}
        ${this._value('Wel,y / Wel,z', `${fmt(eng.Wely,1)} / ${fmt(eng.Welz,1)} cm³`)}${this._value('Wpl,y / Wpl,z', `${fmt(eng.Wply,1)} / ${fmt(eng.Wplz,1)} cm³`)}
        ${this._value('iy / iz', `${fmt(eng.iy)} / ${fmt(eng.iz)} cm`)}${this._value('It / Iw', `${fmt(eng.It,2)} cm⁴ / ${fmt(eng.Iw,1)} cm⁶`)}
        ${this._value('Clase orientativa', `Clase ${eng.sectionClass || '—'} · flexión pura`)}${this._value('Masa', `${fmt(element.mass)} kg`)}`, false);
    } else if (element.type === 'plate') {
      html += this._acc('Dimensiones de placa', `
        ${this._field('Ancho', `<span class="input-unit"><input id="prop-width" type="number" step="0.01" value="${element.params.width}"><em>m</em></span>`)}
        ${this._field('Alto', `<span class="input-unit"><input id="prop-height" type="number" step="0.01" value="${element.params.height}"><em>m</em></span>`)}
        ${this._field('Espesor', `<span class="input-unit"><input id="prop-thickness" type="number" step="0.001" value="${element.params.thickness}"><em>m</em></span>`)}
        <button id="btn-apply-plate" class="prop-apply-btn">Aplicar placa</button>`, true);
    } else if (element.type === 'fastener') {
      html += this._acc('Tornillo / perno', `
        ${this._field('Métrica', `<select id="prop-metric">${['M12','M16','M20','M24','M27','M30'].map(item => `<option ${item === element.params.metric ? 'selected' : ''}>${item}</option>`).join('')}</select>`)}
        ${this._field('Clase', `<select id="prop-bolt-class"><option ${element.params.boltClass !== '10.9' ? 'selected' : ''}>8.8</option><option ${element.params.boltClass === '10.9' ? 'selected' : ''}>10.9</option></select>`)}
        ${this._field('Vástago', `<span class="input-unit"><input id="prop-shank" type="number" value="${element.params.shankLength || 60}"><em>mm</em></span>`)}
        <button id="btn-apply-fastener" class="prop-apply-btn">Aplicar tornillo</button>`, true);
    } else if (element.type === 'weld') {
      const length = element.pointA?.distanceTo?.(element.pointB) || 0;
      html += this._acc('Cordón de soldadura', `${this._value('Longitud', `${fmt(length*1000,1)} mm`)}${this._value('Garganta a', `${fmt((element.params.throat || element.params.radius || .005)*1000,1)} mm`)}${this._value('Vinculación', element.params.bindings?.a || element.params.bindings?.b || element.bindings?.a || element.bindings?.b ? 'Enlazada a piezas' : 'Puntos globales')}`, true);
    }

    const pos = element.getPosition();
    const rot = element.getRotation();
    html += this._acc('Posición y rotación', `
      <div class="coordinate-grid">${['x','y','z'].map((axis, i) => `<label><span>${axis.toUpperCase()}</span><input id="prop-p${axis}" type="number" step="0.01" value="${[pos.x,pos.y,pos.z][i].toFixed(3)}"></label>`).join('')}</div>
      <div class="coordinate-grid">${['x','y','z'].map((axis, i) => `<label><span>R${axis.toUpperCase()}</span><input id="prop-r${axis}" type="number" step="1" value="${(rot[axis]*180/Math.PI).toFixed(1)}"></label>`).join('')}</div>
      <button id="btn-apply-transform" class="prop-apply-btn">Aplicar transformación</button>`, false);
    html += this._acc('Acabado y color', `<div class="color-palette">${COLORS.map(item => `<button type="button" class="color-swatch${item === color ? ' active' : ''}" data-color="${item}" style="--swatch:${item}" title="${item}"></button>`).join('')}</div><div class="color-picker-row"><input id="color-picker-custom" type="color" value="${color}"><input id="color-hex-input" value="${color}"></div>`, false);
    html += `<div class="prop-actions-row"><button id="btn-duplicate-element">Duplicar</button><button id="btn-delete-element" class="danger">Eliminar</button></div>`;
    return html;
  }

  _analysisHtml(element) {
    if (element.type !== 'profile') return `<div class="inspector-empty-pane"><i class="fa-solid fa-calculator"></i><b>Seleccione una barra o perfil</b><span>Para tornillos, placas y soldaduras use la pestaña Unión.</span></div>`;
    const input = element.analysisInput || {};
    return `
      <div class="calculation-intro"><span class="eyebrow">NIVEL 1 · BARRA</span><h3>Comprobación ELU / ELS</h3><p>Introduzca las solicitaciones de cálculo. Las fórmulas y las hipótesis quedarán trazadas en la memoria.</p></div>
      ${this._acc('Solicitaciones', `
        ${this._field('N<sub>Ed</sub> (+ comp.)', `<span class="input-unit"><input id="calc-ned" type="number" step="1" value="${input.NEd ?? 0}"><em>kN</em></span>`)}
        ${this._field('V<sub>Ed</sub>', `<span class="input-unit"><input id="calc-ved" type="number" step="1" value="${input.VEd ?? 0}"><em>kN</em></span>`)}
        ${this._field('M<sub>y,Ed</sub>', `<span class="input-unit"><input id="calc-myed" type="number" step="1" value="${input.MyEd ?? input.MEd ?? 0}"><em>kNm</em></span>`)}
        ${this._field('M<sub>z,Ed</sub>', `<span class="input-unit"><input id="calc-mzed" type="number" step="1" value="${input.MzEd ?? 0}"><em>kNm</em></span>`)}
        ${this._field('L<sub>cr,y</sub>', `<span class="input-unit"><input id="calc-lcry" type="number" step="0.1" value="${input.LcrY ?? element.params.length}"><em>m</em></span>`)}
        ${this._field('L<sub>cr,z</sub>', `<span class="input-unit"><input id="calc-lcrz" type="number" step="0.1" value="${input.LcrZ ?? element.params.length}"><em>m</em></span>`)}
        ${this._field('Límite flecha', `<select id="calc-deflection-limit">${[300,250,400,500].map(value => `<option value="${value}" ${Number(input.deflectionLimit ?? 300) === value ? 'selected' : ''}>L/${value}</option>`).join('')}</select>`)}
        ${this._field('Carga ELS q', `<span class="input-unit"><input id="calc-service-load" type="number" min="0" step="0.1" value="${input.serviceLoad ?? ''}" placeholder="opcional"><em>kN/m</em></span>`)}
        ${this._field('Flecha δEd', `<span class="input-unit"><input id="calc-delta-ed" type="number" min="0" step="0.1" value="${input.deltaEdMm ?? ''}" placeholder="alternativa"><em>mm</em></span>`)}
        <button id="btn-run-member-check" class="calculation-run"><i class="fa-solid fa-play"></i> Calcular y comprobar</button>`, true)}
      ${this._resultsHtml(element.analysisResults)}`;
  }

  _connectionHtml(element) {
    const input = element.connectionInput || {};
    if (element.type === 'weld') return `
      <div class="calculation-intro"><span class="eyebrow">NIVEL 2 · SOLDADURA</span><h3>Cordón · Código Estructural · Anejo 26</h3></div>
      ${this._acc('Datos del cordón', `
        ${this._field('F<sub>Ed</sub>', `<span class="input-unit"><input id="weld-fed" type="number" value="${input.FEd ?? 50}"><em>kN</em></span>`)}
        ${this._field('Garganta a', `<span class="input-unit"><input id="weld-throat" type="number" value="${input.throatMm ?? ((element.params.throat || element.params.radius || .005)*1000)}"><em>mm</em></span>`)}
        ${this._field('Longitud eficaz', `<span class="input-unit"><input id="weld-length" type="number" value="${input.lengthMm ?? ((element.pointA?.distanceTo?.(element.pointB) || 0)*1000)}"><em>mm</em></span>`)}
        <button id="btn-run-weld-check" class="calculation-run">Comprobar soldadura</button>`, true)}${this._resultsHtml(element.analysisResults)}`;

    if (element.type === 'plate' || element.type === 'fastener') {
      const group = element.params.boltGroup || {};
      return `<div class="calculation-intro"><span class="eyebrow">NIVEL 2 · UNIÓN</span><h3>Grupo de tornillos</h3><p>${group.rows ? `Matriz ${group.rows}×${group.cols} · ${group.metric}` : 'Seleccione una placa con matriz o un tornillo.'}</p></div>
        ${this._acc('Acciones transferidas', `
          ${this._field('N<sub>Ed</sub>', `<span class="input-unit"><input id="bolt-ned" type="number" value="${input.NEd ?? 0}"><em>kN</em></span>`)}
          ${this._field('V<sub>Ed</sub>', `<span class="input-unit"><input id="bolt-ved" type="number" value="${input.VEd ?? 0}"><em>kN</em></span>`)}
          ${this._field('M<sub>Ed</sub>', `<span class="input-unit"><input id="bolt-med" type="number" value="${input.MEd ?? 0}"><em>kNm</em></span>`)}
          ${this._field('Espesor chapa', `<span class="input-unit"><input id="bolt-plate-t" type="number" value="${input.plateThicknessMm ?? ((element.params.thickness || .02)*1000)}"><em>mm</em></span>`)}
          <button id="btn-run-bolt-check" class="calculation-run">Comprobar Fv,Rd · Fb,Rd · Ft,Rd</button>`, true)}${this._resultsHtml(element.analysisResults)}
          ${element.params.assemblyId ? '<button id="btn-explode-assembly" class="secondary-wide">Vista explosionada 3D</button>' : ''}`;
    }
    return `<div class="inspector-empty-pane"><i class="fa-solid fa-link"></i><b>Transferencia automática de esfuerzos</b><span>Seleccione una placa, tornillo o soldadura perteneciente a una unión.</span>${element.params.assemblyId ? '<button id="btn-explode-assembly" class="secondary-wide">Vista explosionada 3D</button>' : ''}</div>`;
  }

  _resultsHtml(result) {
    if (!result) return `<div class="not-checked-card"><i class="fa-solid fa-circle-info"></i><div><b>Sin verificar</b><span>Ejecute el cálculo para obtener resistencias, esbeltez, coeficientes y ratios.</span></div></div>`;
    const checks = Array.isArray(result.checks) ? result.checks : [];
    return `<div class="result-summary ${result.status || 'NOT_CHECKED'}"><div class="result-gauge" style="--ratio:${Math.min(1.25, Number(result.ratio) || 0)}"><b>${fmt((Number(result.ratio)||0)*100,0)}%</b><span>η</span></div><div><span>RESULTADO GOBERNANTE</span><h3>${STATUS_LABEL[result.status] || result.status}</h3><small>${esc(result.governing || 'Comprobación automática')}</small></div></div>
      <div class="check-list">${checks.map(check => `<div class="check-row ${check.status || 'NOT_CHECKED'}"><span class="check-dot"></span><div><b>${esc(check.label || check.id)}</b><small>${fmt(check.demand)} / ${fmt(check.resistance)} ${esc(check.unit || '')}</small></div><em>${Number.isFinite(Number(check.ratio)) ? fmt(check.ratio,3) : '—'}</em></div>`).join('')}</div>
      ${result.slenderness ? this._acc('Pandeo y esbeltez', `${this._value('λ̄y / λ̄z', `${fmt(result.slenderness.y,3)} / ${fmt(result.slenderness.z,3)}`)}${this._value('χy / χz', `${fmt(result.reduction?.y,3)} / ${fmt(result.reduction?.z,3)}`)}`, false) : ''}
      ${(result.warnings || []).map(warning => `<div class="calculation-warning">${esc(warning)}</div>`).join('')}`;
  }

  _wireEvents(element) {
    this.panel.querySelector('#prop-series')?.addEventListener('change', event => {
      const select = this.panel.querySelector('#prop-size');
      if (select) select.innerHTML = getSizes(event.target.value).map(item => `<option>${item}</option>`).join('');
    });
    this.panel.querySelector('#btn-apply-profile')?.addEventListener('click', () => {
      element.steelGrade = this.panel.querySelector('#prop-steel-grade')?.value || element.steelGrade;
      element.update({ ...element.params, series: this._valueOf('prop-series'), size: this._valueOf('prop-size'), length: this._numberOf('prop-length', element.params.length), orientation: this._valueOf('prop-orientation'), sectionRotation: this._numberOf('prop-roll', 0), insertionPoint: this._valueOf('prop-insertion') });
      this.onPropertyChange?.(element, { rebuild: true }); this.update(element);
    });
    this.panel.querySelector('#btn-apply-plate')?.addEventListener('click', () => {
      element.update({ ...element.params, width: this._numberOf('prop-width', element.params.width), height: this._numberOf('prop-height', element.params.height), thickness: this._numberOf('prop-thickness', element.params.thickness) });
      this.onPropertyChange?.(element, { rebuild: true }); this.update(element);
    });
    this.panel.querySelector('#btn-apply-fastener')?.addEventListener('click', () => {
      element.params.metric = this._valueOf('prop-metric'); element.params.boltClass = this._valueOf('prop-bolt-class'); element.params.shankLength = this._numberOf('prop-shank', 60);
      element.update(element.params); this.onPropertyChange?.(element, { rebuild: true }); this.update(element);
    });
    this.panel.querySelector('#prop-steel-grade')?.addEventListener('change', event => {
      element.steelGrade = event.target.value;
      if (element.type === 'profile') element.update(element.params);
      this.onPropertyChange?.(element, { rebuild: element.type === 'profile' }); this.update(element);
    });
    this.panel.querySelector('#btn-apply-transform')?.addEventListener('click', () => {
      element.setPosition(this._numberOf('prop-px',0), this._numberOf('prop-py',0), this._numberOf('prop-pz',0));
      element.setRotation(this._numberOf('prop-rx',0), this._numberOf('prop-ry',0), this._numberOf('prop-rz',0));
      element.mesh.updateMatrixWorld(true); this.onPropertyChange?.(element); this.update(element);
    });
    const applyColor = value => { const next = hex(value, hex(element.color)); element.setColor(next); this.onColorChange?.(element,next); this.update(element); };
    this.panel.querySelectorAll('[data-color]').forEach(button => button.addEventListener('click', () => applyColor(button.dataset.color)));
    this.panel.querySelector('#color-picker-custom')?.addEventListener('change', event => applyColor(event.target.value));
    this.panel.querySelector('#color-hex-input')?.addEventListener('change', event => applyColor(event.target.value));
    this.panel.querySelector('#btn-delete-element')?.addEventListener('click', () => this.onDelete?.(element));
    this.panel.querySelector('#btn-duplicate-element')?.addEventListener('click', () => this.onDuplicate?.(element));
    this.panel.querySelector('#btn-explode-assembly')?.addEventListener('click', () => this.onExplode?.(element));
    this.panel.querySelector('#btn-run-member-check')?.addEventListener('click', () => this.onCalculate?.(element, 'member', {
      NEd: this._numberOf('calc-ned',0), VEd: this._numberOf('calc-ved',0), MyEd: this._numberOf('calc-myed',0), MzEd: this._numberOf('calc-mzed',0),
      LcrY: this._numberOf('calc-lcry',element.params.length), LcrZ: this._numberOf('calc-lcrz',element.params.length), deflectionLimit: this._numberOf('calc-deflection-limit',300),
      serviceLoad: this._optionalNumberOf('calc-service-load'), deltaEdMm: this._optionalNumberOf('calc-delta-ed'), standard: this._valueOf('prop-standard') || 'CODIGO',
    }));
    this.panel.querySelector('#btn-run-bolt-check')?.addEventListener('click', () => this.onCalculate?.(element, 'bolt', {
      NEd: this._numberOf('bolt-ned',0), VEd: this._numberOf('bolt-ved',0), MEd: this._numberOf('bolt-med',0), plateThicknessMm: this._numberOf('bolt-plate-t',20), standard: this._valueOf('prop-standard') || 'CODIGO',
    }));
    this.panel.querySelector('#btn-run-weld-check')?.addEventListener('click', () => this.onCalculate?.(element, 'weld', {
      FEd: this._numberOf('weld-fed',0), throatMm: this._numberOf('weld-throat',5), lengthMm: this._numberOf('weld-length',100), standard: this._valueOf('prop-standard') || 'CODIGO',
    }));
  }

  updateCoords(element) {
    if (!element) return;
    const p = element.getPosition();
    ['x','y','z'].forEach((axis,index) => { const input = this.panel.querySelector(`#prop-p${axis}`); if (input) input.value = [p.x,p.y,p.z][index].toFixed(3); });
  }

  _valueOf(id) { return this.panel.querySelector(`#${id}`)?.value; }
  _optionalNumberOf(id) { const raw = this._valueOf(id); if (raw === undefined || raw === null || String(raw).trim() === '') return null; const value = Number(raw); return Number.isFinite(value) ? value : null; }
  _numberOf(id, fallback = 0) { const value = Number(this._valueOf(id)); return Number.isFinite(value) ? value : fallback; }
  _field(label, control) { return `<label class="prop-row"><span>${label}</span><span class="prop-control">${control}</span></label>`; }
  _value(label, value) { return `<div class="prop-row"><span>${label}</span><b class="prop-value">${value}</b></div>`; }
  _acc(label, body, open = false) { return `<details class="prop-accordion" ${open ? 'open' : ''}><summary>${label}<i class="fa-solid fa-chevron-down"></i></summary><div class="prop-rows">${body}</div></details>`; }
}