import { icon } from './icons.js';

/**
 * Docked model navigator + compact CAD tool rail.
 * Mirrors the hierarchy used by professional BIM/steel detailing software.
 */
export class Sidebar {
  constructor(el) {
    this.el = el;
    this.callbacks = {};
    this._activeTool = 'select';
    this._objects = [];
    this._render();
  }

  on(action, cb) { this.callbacks[action] = cb; }
  _emit(action, payload) { this.callbacks[action]?.(payload); }

  setActiveTool(tool) {
    this._activeTool = tool;
    this.el.querySelectorAll('.sb-tool[data-action]').forEach(button => {
      button.classList.toggle('active', button.dataset.action === tool);
    });
  }

  _render() {
    this.el.innerHTML = `
      <div class="sidebar-toolrail" aria-label="Herramientas rápidas">
        ${this._tool('select', 'pointer', 'Seleccionar', 'V', 14)}
        ${this._tool('move', 'move', 'Mover', 'G', 16)}
        ${this._tool('rotate', 'rotate', 'Rotar', 'R', 16)}
        ${this._tool('scale', 'scale', 'Escalar', 'S', 16)}
        <div class="sb-divider"></div>
        ${this._tool('measure', 'ruler', 'Medir', 'M', 16)}
        ${this._tool('weld', 'weld', 'Soldadura', 'W', 16)}
        <div class="sb-tool-spacer"></div>
        ${this._tool('view-iso', 'cube', 'Vista ISO', '1', 15)}
        ${this._tool('view-top', 'viewTop', 'Planta', '7', 15)}
        ${this._tool('view-front', 'viewFront', 'Frontal', '3', 15)}
      </div>
      <section class="model-browser" aria-label="Navegador del modelo">
        <header class="model-browser__header"><span>NAVEGADOR DEL MODELO</span><button type="button" data-action="collapse-browser" title="Contraer">‹</button></header>
        <label class="model-search">${icon('search', 13)}<input type="search" id="model-search-input" placeholder="Buscar en el modelo…" autocomplete="off"></label>
        <div id="model-tree" class="model-tree"></div>
        <div class="connection-browser">
          <div class="connection-browser__title"><span>NAVEGADOR DE CONEXIONES</span><b id="connection-count">0</b></div>
          <div id="connection-tree" class="connection-tree"><span class="tree-empty">Sin conjuntos insertados</span></div>
        </div>
        <footer class="model-browser__tabs"><button class="active" type="button">NAVEGADOR</button><button type="button" data-action="open-structure-tab">ESTRUCTURA</button></footer>
      </section>`;

    this.el.querySelectorAll('.sb-tool[data-action]').forEach(button => {
      button.addEventListener('click', () => this._emit(button.dataset.action));
    });
    this.el.querySelector('[data-action="collapse-browser"]')?.addEventListener('click', () => {
      document.documentElement.classList.toggle('model-browser-collapsed');
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    });
    this.el.querySelector('[data-action="open-structure-tab"]')?.addEventListener('click', () => this._emit('open-structure-tab'));
    this.el.querySelector('#model-search-input')?.addEventListener('input', event => this.refresh(this._objects, event.target.value));
    this.refresh([]);
  }

  refresh(objects = this._objects, query = '') {
    this._objects = Array.isArray(objects) ? objects : [];
    const normalized = String(query || '').trim().toLowerCase();
    const visible = this._objects.filter(object => {
      if (!normalized) return true;
      return `${object.designation} ${object.type} ${object.params?.role || ''} ${object.id}`.toLowerCase().includes(normalized);
    });
    const groups = [
      ['profile', 'Perfiles / Barras', 'fa-grip-lines'],
      ['plate', 'Placas y cartelas', 'fa-square'],
      ['fastener', 'Tornillería', 'fa-screwdriver-wrench'],
      ['weld', 'Soldaduras', 'fa-wave-square'],
    ];
    const tree = this.el.querySelector('#model-tree');
    if (!tree) return;
    tree.innerHTML = `
      <div class="tree-project"><span class="tree-caret">⌄</span><i class="fa-solid fa-building"></i><b>PROYECTO_NAVE INDUSTRIAL_01</b></div>
      <div class="tree-branch reference-tree">
        <div class="tree-section"><span class="tree-caret">⌄</span><i class="fa-solid fa-layer-group"></i><b>VISTAS (Disciplinas)</b></div>
        <div class="tree-group reference-tree__level"><div class="tree-group__label"><span class="tree-caret">⌄</span><i class="fa-solid fa-cube"></i><span>Modelo estructural</span></div>
          <div class="tree-group reference-tree__level"><div class="tree-group__label"><span class="tree-caret">⌄</span><i class="fa-solid fa-cube"></i><span>Vistas 3D</span></div>
            <button type="button" class="tree-view" data-tree-view="view-iso">3D GENERAL</button>
            <button type="button" class="tree-view" data-tree-view="view-iso">3D MONTAJE</button>
            <button type="button" class="tree-view active" data-tree-view="view-iso">ENCUENTRO PRINCIPAL</button>
          </div>
          <div class="tree-group reference-tree__level"><div class="tree-group__label"><span class="tree-caret">⌄</span><i class="fa-solid fa-building-columns"></i><span>Alzados</span></div>
            <button type="button" class="tree-view" data-tree-view="view-front">ALZADO NORTE</button>
            <button type="button" class="tree-view" data-tree-view="view-front">ALZADO SUR</button>
            <button type="button" class="tree-view" data-tree-view="view-right">ALZADO ESTE</button>
            <button type="button" class="tree-view" data-tree-view="view-left">ALZADO OESTE</button>
          </div>
          <div class="tree-group reference-tree__level"><div class="tree-group__label"><span class="tree-caret">⌄</span><i class="fa-solid fa-scissors"></i><span>Secciones</span></div>
            <button type="button" class="tree-view" data-tree-view="view-left">SECCIÓN A-A</button>
            <button type="button" class="tree-view" data-tree-view="view-right">SECCIÓN B-B</button>
            <button type="button" class="tree-view" data-tree-view="view-front">SECCIÓN C-C</button>
          </div>
          <div class="tree-group reference-tree__level"><div class="tree-group__label"><span class="tree-caret">⌄</span><i class="fa-regular fa-map"></i><span>Planos de planta</span></div>
            <button type="button" class="tree-view" data-tree-view="view-top">NIVEL 0 - CIMENTACIÓN</button>
            <button type="button" class="tree-view" data-tree-view="view-top">NIVEL 1 - ARRANQUE</button>
            <button type="button" class="tree-view" data-tree-view="view-top">NIVEL 2 - CUBIERTA</button>
          </div>
        </div>
      </div>
      <div class="tree-section model-elements-title"><span class="tree-caret">⌄</span><i class="fa-solid fa-diagram-project"></i><b>ELEMENTOS DEL MODELO</b><em>${visible.length}</em></div>
      <div class="tree-branch dynamic-elements">
        ${groups.map(([type, label, fa]) => {
          const items = visible.filter(object => object.type === type);
          return `<div class="tree-group"><div class="tree-group__label"><span class="tree-caret">${items.length ? '⌄' : '·'}</span><i class="fa-solid ${fa}"></i><span>${label}</span><em>${items.length}</em></div>
            ${items.map(object => `<button type="button" class="tree-object${object._isSelected ? ' selected' : ''}" data-bim-id="${object.id}" title="${object.designation}">
              <span class="tree-object__state ${object.analysisResults?.status || 'NOT_CHECKED'}"></span><span>${object.params?.role || object.designation || object.type}</span><small>${object.designation || ''}</small></button>`).join('')}
          </div>`;
        }).join('')}
      </div>
      <div class="tree-section tree-static"><span class="tree-caret">›</span><i class="fa-solid fa-chart-line"></i><span>Modelo analítico</span></div>
      <div class="tree-section tree-static"><span class="tree-caret">›</span><i class="fa-solid fa-table"></i><span>Tablas de materiales y mediciones</span></div>
      <div class="tree-section tree-static"><span class="tree-caret">›</span><i class="fa-regular fa-file-lines"></i><span>PLANOS (Hoja)</span></div>
      <div class="tree-section tree-static"><span class="tree-caret">›</span><i class="fa-solid fa-shapes"></i><span>FAMILIAS / GRUPOS</span></div>`;
    tree.querySelectorAll('[data-bim-id]').forEach(button => button.addEventListener('click', () => this._emit('select-object', button.dataset.bimId)));
    tree.querySelectorAll('[data-tree-view]').forEach(button => button.addEventListener('click', () => {
      tree.querySelectorAll('.tree-view').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      this._emit(button.dataset.treeView);
    }));

    const assemblies = new Map();
    this._objects.forEach(object => {
      const id = object.params?.assemblyId || object.params?.templateInstanceId;
      if (!id) return;
      if (!assemblies.has(id)) assemblies.set(id, []);
      assemblies.get(id).push(object);
    });
    const connectionTree = this.el.querySelector('#connection-tree');
    const count = this.el.querySelector('#connection-count');
    if (count) count.textContent = String(assemblies.size);
    if (connectionTree) connectionTree.innerHTML = assemblies.size
      ? [...assemblies.entries()].map(([id, items]) => `<button type="button" data-assembly-id="${id}"><span class="assembly-thumb">${icon('plate', 16)}</span><span><b>${items[0]?.params?.templateId || 'Conjunto estructural'}</b><small>${items.length} componentes</small></span></button>`).join('')
      : '<span class="tree-empty">Sin conjuntos insertados</span>';
    connectionTree?.querySelectorAll('[data-assembly-id]').forEach(button => button.addEventListener('click', () => this._emit('select-object', assemblies.get(button.dataset.assemblyId)?.[0]?.id)));
  }

  setActiveObject(id) {
    this.el.querySelectorAll('.tree-object').forEach(button => button.classList.toggle('selected', button.dataset.bimId === id));
  }

  _tool(action, iconName, label, key, size = 16) {
    return `<button class="sb-tool${action === this._activeTool ? ' active' : ''}" data-action="${action}" title="${label} (${key})">
      ${icon(iconName, size)}<span class="sb-tooltip">${label} <span class="shortcut-hint">${key}</span></span>
    </button>`;
  }
}