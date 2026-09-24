import { icon } from './icons.js';

const ASSET_BASE = import.meta.env.BASE_URL || '/';

/** Compact, image-led workshop ribbon. Keeps the familiar editor layout and groups every tool in one strip. */
export class Ribbon {
  constructor(ribbonElement) {
    this.ribbon = ribbonElement;
    this.callbacks = {};
    this._render();
  }

  on(action, callback) { this.callbacks[action] = callback; }
  _emit(action) { this.callbacks[action]?.(); }

  _render() {
    const groups = [
      {
        id: 'profiles', category: 'PERFILES', title: 'Perfiles', items: [
          ['tool-select', 'select', 'Modificar', 'Seleccionar y editar elementos'],
          ['add-heb-col', 'heb', 'HEB', 'Crear pilar HEB 200 · 1000 mm'],
          ['add-ipe', 'ipe', 'IPE', 'Crear viga IPE 200 · 1000 mm'],
          ['add-angle', 'angle', 'L', 'Crear perfil angular L 80×8 · 1000 mm'],
          ['add-shs', 'shs', 'shs', 'Crear tubo SHS · 1000 mm'],
          ['add-chs', 'chs', 'chs', 'Crear tubo CHS · 1000 mm'],
          ['add-upn', 'channel', 'UPN', 'Crear canal UPN · 1000 mm'],
        ],
      },
      {
        id: 'floors', category: 'FORJADOS', title: 'Chapas', items: [
          ['add-plate', 'plate', 'Chapa', 'Crear una chapa estructural'],
        ],
      },
      {
        id: 'connections', category: 'UNIONES', title: 'Uniones', items: [
          ['add-baseplate', 'baseplate', 'Placa base', 'Crear placa base'],
          ['add-gusset-tri', 'gusset-tri', 'Cartela', 'Crear cartela triangular'],
          ['add-gusset-sq', 'gusset-sq', 'Cartela rect.', 'Crear cartela rectangular'],
          ['add-cleat', 'cleat', 'Casquillo L', 'Crear casquillo angular'],
          ['add-neoprene', 'neoprene', 'Neopreno', 'Crear apoyo de neopreno'],
          ['add-bolt', 'bolt', 'Tornillo', 'Clic en el modelo para colocar un tornillo individual'],
          ['bolt-matrix', 'bolt-matrix', 'Matriz', 'Crear una matriz de tornillos en la placa seleccionada'],
        ],
      },
      {
        id: 'custom-part', category: 'CREAR PIEZA', title: 'Pieza personalizada', className: 'ribbon-group-custom-piece', items: [
          ['open-custom-part', 'custom-part', 'Pieza libre', 'Dibujar una pieza sobre el plano y extruirla'],
        ],
      },
      {
        id: 'weld', category: 'UNIONES', title: 'Soldadura', className: 'ribbon-group-weld', items: [
          ['tool-weld', 'weld', 'Soldadura', 'Crear cordón de soldadura'],
        ],
      },
      {
        id: 'styles', category: 'COMPLEMENTOS', title: 'Estilos', className: 'ribbon-group-style', items: [
          ['mode-pbr', 'material-pbr', 'Realismo', 'Vista realista del acero'],
          ['mode-clay', 'material-clay', 'Básico', 'Color plano de taller'],
        ],
      },
      {
        id: 'extensions', category: 'COMPLEMENTOS', title: 'Extensiones', items: [
          ['open-render-studio', 'render-camera', 'Render', 'Capturar la vista actual y exportarla como imagen'],
          ['open-tutorial', 'aula', 'Aula ETSIE', 'Abrir el aula y el cuestionario constructivo'],
          ['preset-connections', 'connection', 'Nudos', 'Abrir las plantillas de nudos'],
        ],
      },
      {
        id: 'views', category: 'COMPLEMENTOS', title: 'Vistas', items: [
          ['view-iso', 'view-iso', '3D', 'Vista isométrica'],
          ['view-top', 'view-top', 'Planta', 'Vista ortográfica en planta'],
          ['view-front', 'view-front', 'Alzado', 'Vista ortográfica de alzado'],
          ['view-right', 'view-right', 'Lateral', 'Vista ortográfica lateral'],
        ],
      },
      {
        id: 'measurements', category: 'COMPLEMENTOS', title: 'Medición y entrega', items: [
          ['measure-dist', 'ruler', 'Distancia', 'Medir distancia y diferencias en milímetros'],
          ['measure-angle', 'angle', 'Ángulo', 'Medir ángulo'],
          ['measure-area', 'area', 'Área', 'Medir área'],
          ['report-pdf', 'report-pdf', 'Memoria PDF', 'Exportar memoria PDF'],
          ['report-html', 'report-html', 'Memoria HTML', 'Exportar memoria HTML'],
        ],
      },
    ];

    const categories = ['PERFILES', 'FORJADOS', 'UNIONES', 'CREAR PIEZA', 'COMPLEMENTOS'];
    this.ribbon.innerHTML = `
      <nav class="ribbon-category-bar" aria-label="Categorías de herramientas">
        ${categories.map((name, index) => `<button type="button" class="ribbon-category-tab${index === 0 ? ' active' : ''}" data-ribbon-category="${name}">${name}</button>`).join('')}
      </nav>
      <div class="ribbon-content ribbon-workshop-content">
        <div class="ribbon-panel ribbon-workshop-panel" data-panel="edicion" role="toolbar" aria-label="Herramientas de estructuras">
          ${groups.map(group => `<section id="ribbon-group-${group.id}" class="ribbon-group-box ${group.className || ''}" data-ribbon-group="${group.category}">
            <div class="ribbon-group-buttons">${group.items.map(([action, image, label, title]) => this._rasterButton(action, image, label, title)).join('')}</div>
            <div class="ribbon-group-title">${group.title}</div>
          </section>`).join('')}
        </div>
      </div>`;

    this.ribbon.querySelectorAll('.ribbon-category-tab').forEach(button => button.addEventListener('click', () => {
      this.ribbon.querySelectorAll('.ribbon-category-tab').forEach(tab => tab.classList.toggle('active', tab === button));
      const group = this.ribbon.querySelector(`[data-ribbon-group="${button.dataset.ribbonCategory}"]`);
      const viewport = this.ribbon.querySelector('.ribbon-workshop-content');
      if (group && viewport) viewport.scrollTo({ left: group.offsetLeft - 8, behavior: 'smooth' });
    }));

    this.ribbon.querySelectorAll('.ribbon-btn').forEach(button => button.addEventListener('click', () => {
      const action = button.dataset.action;
      if (action) this._emit(action);
    }));

    const gridSize = document.getElementById('grid-size-select');
    gridSize?.addEventListener('change', () => this._emit(`grid-size-${gridSize.value}`));
    const coordSpace = document.getElementById('coord-space-select');
    coordSpace?.addEventListener('change', () => this._emit(`coord-space-${coordSpace.value}`));
  }

  _rasterButton(action, asset, label, title = '') {
    const src = `${ASSET_BASE}ui-icons/${asset}.png`;
    return `<button type="button" class="ribbon-btn" data-action="${action}" title="${title || label}" aria-label="${label}">
      <span class="ribbon-icon-frame"><img class="ribbon-raster-icon" src="${src}" alt="" draggable="false"></span>
      <span>${label}</span>
    </button>`;
  }

  setActiveButton(action) {
    this.ribbon.querySelectorAll('.ribbon-btn').forEach(button => button.classList.toggle('active', button.dataset.action === action));
    document.querySelectorAll('.sb-tool').forEach(button => button.classList.toggle('active', button.dataset.action === action));
  }

  setActiveModeButton(mode) {
    this.ribbon.querySelectorAll('.ribbon-btn[data-action^="mode-"]').forEach(button => {
      button.classList.toggle('active', button.dataset.action === `mode-${mode}`);
    });
  }
}
