import { icon } from './icons.js';

/**
 * Ribbon v4.0 — Professional tabbed toolbar.
 * Tabs: Estructura, Conexiones, Tornillería, Edición, Visualización
 */
export class Ribbon {
  constructor(ribbonElement) {
    this.ribbon = ribbonElement;
    this.callbacks = {};
    this._render();
  }

  on(action, callback) { this.callbacks[action] = callback; }
  _emit(action) { if (this.callbacks[action]) this.callbacks[action](); }

  _render() {
    this.ribbon.innerHTML = `
      <div class="ribbon-tabs" role="tablist" aria-label="Herramientas del modelo">
        <button class="ribbon-tab" data-tab="inicio"><span>INICIO</span></button>
        <button class="ribbon-tab active" data-tab="modelo"><span>MODELO</span></button>
        <button class="ribbon-tab" data-tab="estructura"><span>ESTRUCTURA</span></button>
        <button class="ribbon-tab" data-tab="cargas"><span>CARGAS</span></button>
        <button class="ribbon-tab" data-tab="analisis"><span>ANÁLISIS</span></button>
        <button class="ribbon-tab" data-tab="conexiones"><span>CONEXIONES</span></button>
        <button class="ribbon-tab" data-tab="detalles"><span>DETALLES</span></button>
        <button class="ribbon-tab" data-tab="informes"><span>PLANOS</span></button>
        <button class="ribbon-tab" data-tab="informes"><span>INFORMES</span></button>
        <button class="ribbon-tab" data-tab="visualizacion"><span>VISTA</span></button>
        <button class="ribbon-tab" data-tab="edicion"><span>GESTIONAR</span></button>
      </div>
      <div class="ribbon-content">

        <!-- INICIO -->
        <div class="ribbon-panel hidden" data-panel="inicio">
          <div class="ribbon-group-box ribbon-group-featured"><div class="ribbon-group-buttons">
            ${this._rbtn('project-new', icon('filePlus',20), 'Nuevo', 'Crear un proyecto nuevo', 'featured-btn')}
            ${this._rbtn('project-open', icon('folder',20), 'Abrir', 'Cargar proyecto')}
            ${this._rbtn('project-save', icon('save',20), 'Guardar', 'Guardar proyecto')}
            ${this._rbtn('project-export', icon('download',20), 'Exportar', 'Exportar proyecto')}
          </div><div class="ribbon-group-title">Proyecto</div></div>
          <div class="ribbon-group-box"><div class="ribbon-group-buttons">
            ${this._rbtn('tool-select', icon('pointer',18), 'Modificar', 'Seleccionar y modificar')}
            ${this._rbtn('duplicate', icon('copy',18), 'Duplicar', 'Duplicar selección')}
            ${this._rbtn('delete-selected', icon('trash',18), 'Eliminar', 'Eliminar selección')}
          </div><div class="ribbon-group-title">Edición rápida</div></div>
          <div class="ribbon-group-box"><div class="ribbon-group-buttons">
            ${this._rbtn('report-pdf', icon('file',18), 'Memoria PDF', 'Generar memoria justificativa')}
            ${this._rbtn('report-html', icon('download',18), 'Memoria HTML', 'Descargar memoria HTML')}
            ${this._rbtn('open-tutorial', icon('graduation',18), 'ETSIE', 'Módulo didáctico')}
          </div><div class="ribbon-group-title">Entregables</div></div>
        </div>

        <!-- ESTRUCTURA -->
        <div class="ribbon-panel hidden" data-panel="estructura">
          <div class="ribbon-group-box ribbon-group-featured"><div class="ribbon-group-buttons">
            ${this._rbtn('preset-structures', icon('wand',20), 'Plantillas', 'Abrir catálogo de estructuras', 'featured-btn')}
            ${this._rbtn('preset-portal', icon('column',18), 'Pórtico', 'Pórtico a dos aguas')}
            ${this._rbtn('preset-truss', icon('truss',18), 'Cercha', 'Cercha Pratt / Warren')}
          </div><div class="ribbon-group-title">Estructuras paramétricas</div></div>
          <div class="ribbon-group-box"><div class="ribbon-group-buttons">
            ${this._rbtn('add-heb-col', icon('column',18), 'Pilar HEB', 'Insertar pilar HEB')}
            ${this._rbtn('add-ipe', icon('beam',18), 'Viga IPE', 'Insertar viga IPE')}
            ${this._rbtn('add-shs', icon('column',18), 'Tubo SHS', 'Insertar tubo SHS')}
          </div><div class="ribbon-group-title">Barras</div></div>
          <div class="ribbon-group-box"><div class="ribbon-group-buttons">
            ${this._rbtn('open-custom-part', icon('layers',18), 'Pieza libre', 'Diseñar rigidizador o cartela')}
            ${this._rbtn('preset-connections', icon('plate',18), 'Uniones', 'Abrir plantillas de unión')}
            ${this._rbtn('clash-scan', icon('warning',18), 'Solapes', 'Comprobar colisiones')}
          </div><div class="ribbon-group-title">Detalle y control</div></div>
        </div>

        <!-- ESTRUCTURA -->
        <div class="ribbon-panel" data-panel="modelo">
          <div class="ribbon-group-box">
            <div class="ribbon-group-buttons">
              ${this._rbtn('add-heb-col', `<svg viewBox="0 0 24 24" width="18" height="18"><rect x="10" y="2" width="4" height="20" fill="currentColor" rx="1"/><rect x="6" y="2" width="12" height="3" fill="currentColor" rx="1"/><rect x="6" y="19" width="12" height="3" fill="currentColor" rx="1"/></svg>`, 'Col. HEB', 'Columna HEB 200')}
              ${this._rbtn('add-hea-col', `<svg viewBox="0 0 24 24" width="18" height="18"><rect x="10" y="3" width="4" height="18" fill="currentColor" rx="1" opacity="0.8"/><rect x="7" y="3" width="10" height="2.5" fill="currentColor" rx="1"/><rect x="7" y="18.5" width="10" height="2.5" fill="currentColor" rx="1"/></svg>`, 'Col. HEA', 'Columna HEA 200')}
              ${this._rbtn('add-ipe', `<svg viewBox="0 0 24 24" width="18" height="18"><rect x="2" y="10" width="20" height="4" fill="currentColor" rx="1"/><rect x="2" y="7" width="3" height="10" fill="currentColor" rx="1"/><rect x="19" y="7" width="3" height="10" fill="currentColor" rx="1"/></svg>`, 'Viga IPE', 'Viga IPE 200')}
              ${this._rbtn('add-ipn', `<svg viewBox="0 0 24 24" width="18" height="18"><rect x="2" y="10.5" width="20" height="3" fill="currentColor" rx="1"/><rect x="2" y="7.5" width="3" height="9" fill="currentColor" rx="1" opacity="0.75"/><rect x="19" y="7.5" width="3" height="9" fill="currentColor" rx="1" opacity="0.75"/></svg>`, 'Viga IPN', 'Viga IPN 200')}
              ${this._rbtn('add-heb-beam', `<svg viewBox="0 0 24 24" width="18" height="18"><rect x="2" y="10" width="20" height="4" fill="currentColor" rx="1"/><rect x="2" y="6" width="3" height="12" fill="currentColor" rx="1"/><rect x="19" y="6" width="3" height="12" fill="currentColor" rx="1"/></svg>`, 'Viga HEB', 'Viga HEB horizontal')}
            </div>
            <div class="ribbon-group-title">Perfiles I/H</div>
          </div>
          <div class="ribbon-vsep"></div>
          <div class="ribbon-group-box">
            <div class="ribbon-group-buttons">
              ${this._rbtn('add-upn', `<svg viewBox="0 0 24 24" width="18" height="18"><rect x="5" y="4" width="3" height="16" fill="currentColor" rx="1"/><rect x="5" y="4" width="14" height="3" fill="currentColor" rx="1"/><rect x="5" y="17" width="14" height="3" fill="currentColor" rx="1"/></svg>`, 'Canal UPN', 'Canal UPN 200')}
              ${this._rbtn('add-chs', `<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="3"/></svg>`, 'Tubo CHS', 'Tubo circular CHS')}
              ${this._rbtn('add-shs', `<svg viewBox="0 0 24 24" width="18" height="18"><rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" rx="1"/></svg>`, 'Tubo SHS', 'Tubo cuadrado SHS')}
              ${this._rbtn('add-angle', `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M5 4 L5 20 L20 20 L20 17 L8 17 L8 4 Z" fill="currentColor"/></svg>`, 'Angular L', 'Angular L 80×8')}
            </div>
            <div class="ribbon-group-title">Otros Perfiles</div>
          </div>
          <div class="ribbon-vsep"></div>
          <div class="ribbon-group-box ribbon-group-featured">
            <div class="ribbon-group-buttons">
              ${this._rbtn('preset-structures', icon('wand',18), 'Plantillas', 'Pórticos y cerchas paramétricas en 1-click', 'featured-btn')}
              ${this._rbtn('preset-portal', icon('column',16), 'Pórtico', 'Pórtico a dos aguas')}
              ${this._rbtn('preset-truss', icon('truss',16), 'Cercha', 'Cercha Pratt/Warren')}
            </div>
            <div class="ribbon-group-title">Tipologías 1-click</div>
          </div>
          <div class="ribbon-vsep"></div>
          <div class="ribbon-group-box">
            <div class="ribbon-group-buttons">
              ${this._rbtn('duplicate', icon('copy',16), 'Duplicar', 'Duplicar selección (Ctrl+D)')}
              ${this._rbtn('array-linear', icon('arrayLinear',16), 'Array Lin.', 'Duplicar en línea')}
            </div>
            <div class="ribbon-group-title">Composición</div>
          </div>
          <div class="ribbon-vsep"></div>
          <div class="ribbon-group-box">
            <div class="ribbon-group-buttons">
              ${this._rbtn('add-plate', icon('plate',18), 'Placa', 'Insertar placa estructural')}
              ${this._rbtn('add-bolt', icon('bolt',18), 'Pernos', 'Insertar tornillería')}
              ${this._rbtn('tool-weld', icon('weld',18), 'Soldadura', 'Crear cordón de soldadura')}
              <button class="ribbon-btn" data-action="open-custom-part" title="Pieza personalizada paramétrica">${icon('layers',18)}<span>Pieza libre</span></button>
            </div>
            <div class="ribbon-group-title">Detalles de acero</div>
          </div>
        </div>

        <!-- CONEXIONES -->
        <div class="ribbon-panel hidden" data-panel="conexiones">
          <div class="ribbon-group-box">
            <div class="ribbon-group-buttons">
              ${this._rbtn('add-plate', `<svg viewBox="0 0 24 24" width="18" height="18"><rect x="3" y="8" width="18" height="8" fill="currentColor" rx="1"/></svg>`, 'Placa Base', 'Placa base 300×300×20mm')}
              ${this._rbtn('add-gusset-sq', `<svg viewBox="0 0 24 24" width="18" height="18"><rect x="5" y="5" width="14" height="14" fill="currentColor" rx="1"/></svg>`, 'Cartela □', 'Cartela cuadrada')}
              ${this._rbtn('add-gusset-tri', `<svg viewBox="0 0 24 24" width="18" height="18"><polygon points="4,20 20,20 4,4" fill="currentColor"/></svg>`, 'Cartela △', 'Cartela triangular')}
              ${this._rbtn('add-cleat', `<svg viewBox="0 0 24 24" width="18" height="18"><polyline points="6,20 18,20" stroke="currentColor" stroke-width="4" fill="none"/><polyline points="6,20 6,8" stroke="currentColor" stroke-width="4" fill="none"/></svg>`, 'Casquillo L', 'Casquillo de fijación o montaje L')}
              ${this._rbtn('add-neoprene', `<svg viewBox="0 0 24 24" width="18" height="18"><rect x="3" y="10" width="18" height="4" fill="var(--tx-3)" rx="2"/></svg>`, 'Neopreno', 'Membrana elastomérica de apoyo CTE')}
            </div>
            <div class="ribbon-group-title">Placas</div>
          </div>
          <div class="ribbon-vsep"></div>
          <div class="ribbon-group-box ribbon-group-featured">
            <div class="ribbon-group-buttons">
              ${this._rbtn('preset-connections', icon('wand',18), 'Plantillas', 'Uniones Código Estructural · Anejo 26', 'featured-btn')}
              ${this._rbtn('bolt-matrix', icon('arrayLinear',16), 'Matriz N×M', 'Generar matriz de tornillos en placa')}
              ${this._rbtn('explode-assembly', icon('layers',16), 'Explosionar', 'Vista explosionada del conjunto')}
            </div>
            <div class="ribbon-group-title">Conexiones 1-click</div>
          </div>
          <div class="ribbon-vsep"></div>
          <div class="ribbon-group-box">
            <div class="ribbon-group-buttons">
              <button class="ribbon-btn weld-btn" data-action="tool-weld" title="Cordón de soldadura (W)">
                <svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 18 L8 6 L12 18 L16 6 L20 18" fill="none" stroke="var(--weld)" stroke-width="2.5" stroke-linecap="round"/></svg>
                <span>Soldadura</span>
              </button>
            </div>
            <div class="ribbon-group-title">Soldadura</div>
          </div>
        </div>

        <!-- TORNILLERÍA -->
        <div class="ribbon-panel hidden" data-panel="tornilleria">
          <div class="ribbon-group-box">
            <div class="ribbon-group-buttons">
              ${this._rbtn('add-bolt', `<svg viewBox="0 0 24 24" width="18" height="18"><rect x="10" y="2" width="4" height="16" fill="currentColor" rx="1"/><polygon points="7,2 17,2 15,6 9,6" fill="currentColor"/></svg>`, 'Tornillo', 'Tornillo M16 DIN 931')}
              ${this._rbtn('add-nut', `<svg viewBox="0 0 24 24" width="18" height="18"><polygon points="12,3 20,7 20,17 12,21 4,17 4,7" fill="none" stroke="currentColor" stroke-width="2"/></svg>`, 'Tuerca', 'Tuerca hexagonal M16')}
              ${this._rbtn('add-washer', `<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/></svg>`, 'Arandela', 'Arandela M16')}
              ${this._rbtn('add-anchor', `<svg viewBox="0 0 24 24" width="18" height="18"><rect x="10" y="2" width="4" height="14" fill="currentColor" rx="1"/><path d="M12 16 Q6 16 6 20 Q6 22 10 22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`, 'Anclaje', 'Perno de anclaje M20')}
              ${this._rbtn('add-bolt-set', icon('layers',16), 'Conj. M16', 'Conjunto tornillo+tuerca+arandela M16')}
            </div>
            <div class="ribbon-group-title">Elementos de Fijación</div>
          </div>
          <div class="ribbon-vsep"></div>
          <div class="ribbon-group-box">
            <div class="ribbon-group-buttons">
              ${this._rbtn('bolt-matrix', icon('arrayLinear',16), 'Matriz N×M', 'Patrón paramétrico sobre placa')}
              ${this._rbtn('run-bolt-check', icon('check',16), 'Comprobar', 'Comprobar grupo · Código Estructural · Anejo 26')}
            </div>
            <div class="ribbon-group-title">Grupo de tornillos</div>
          </div>
          <div class="ribbon-vsep"></div>
          <div class="ribbon-group-box">
            <div class="ribbon-group-buttons">
              <div class="ribbon-inline">
                <label class="ribbon-label">Métrica</label>
                <select id="global-metric-select" class="ribbon-select">
                  ${['M12','M16','M20','M24','M27','M30'].map(m=>`<option value="${m}" ${m==='M16'?'selected':''}>${m}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="ribbon-group-title">Configuración</div>
          </div>
        </div>

        <!-- ANÁLISIS -->

        <!-- CARGAS -->
        <div class="ribbon-panel hidden" data-panel="cargas">
          <div class="ribbon-group-box ribbon-group-featured">
            <div class="ribbon-group-buttons">
              <button class="ribbon-btn featured-btn" data-action="add-load-point" title="Añadir carga puntual">${icon('move',20)}<span>Puntual</span></button>
              <button class="ribbon-btn" data-action="add-load-distributed" title="Añadir carga distribuida">${icon('arrayLinear',20)}<span>Distribuida</span></button>
              <button class="ribbon-btn" data-action="add-load-moment" title="Añadir momento aplicado">${icon('rotate',20)}<span>Momento</span></button>
            </div>
            <div class="ribbon-group-title">Acciones sobre barras</div>
          </div>
          <div class="ribbon-vsep"></div>
          <div class="ribbon-group-box">
            <div class="ribbon-group-buttons">
              ${this._rbtn('toggle-diagrams', icon('chart',18), 'Diagramas', 'Mostrar diagramas N / V / M')}
              ${this._rbtn('run-check', icon('check',18), 'Calcular', 'Comprobar el elemento seleccionado')}
              ${this._rbtn('clear-diagrams', icon('eyeOff',18), 'Limpiar', 'Ocultar resultados')}
            </div>
            <div class="ribbon-group-title">Resultados de cálculo</div>
          </div>
          <div class="ribbon-vsep"></div>
          <div class="ribbon-group-box">
            <div class="ribbon-group-buttons">
              <div class="ribbon-inline">
                <label class="ribbon-label">Hipótesis</label>
                <select class="ribbon-select" aria-label="Hipótesis de carga"><option>ELU</option><option>ELS</option></select>
              </div>
            </div>
            <div class="ribbon-group-title">Combinaciones</div>
          </div>
        </div>

        <div class="ribbon-panel hidden" data-panel="analisis">
          <div class="ribbon-group-box ribbon-group-featured">
            <div class="ribbon-group-buttons">
              ${this._rbtn('run-check', icon('check',18), 'Calcular', 'Ejecutar comprobación ELU/ELS del elemento', 'featured-btn')}
              ${this._rbtn('toggle-diagrams', icon('chart',16), 'Diagramas', 'Mostrar N/V/M y deformada')}
            </div>
            <div class="ribbon-group-title">Barra / Perfil</div>
          </div>
          <div class="ribbon-vsep"></div>
          <div class="ribbon-group-box">
            <div class="ribbon-group-buttons">
              ${this._rbtn('run-bolt-check', icon('bolt',16), 'Tornillos', 'Comprobar grupo · Código Estructural · Anejo 26')}
              ${this._rbtn('run-weld-check', icon('weld',16), 'Soldadura', 'Comprobar cordón · Código Estructural · Anejo 26')}
            </div>
            <div class="ribbon-group-title">Uniones</div>
          </div>
          <div class="ribbon-vsep"></div>
          <div class="ribbon-group-box">
            <div class="ribbon-group-buttons">
              ${this._rbtn('clash-scan', icon('warning',16), 'Solapes', 'Analizar colisiones geométricas')}
              ${this._rbtn('clear-diagrams', icon('eyeOff',16), 'Limpiar', 'Ocultar resultados gráficos')}
            </div>
            <div class="ribbon-group-title">Validación</div>
          </div>
        </div>

        <!-- DETALLES -->
        <div class="ribbon-panel hidden" data-panel="detalles">
          <div class="ribbon-group-box ribbon-group-featured">
            <div class="ribbon-group-buttons">
              <button class="ribbon-btn featured-btn" data-action="open-custom-part" title="Crear una pieza paramétrica">${icon('wand',20)}<span>Pieza personalizada</span></button>
              ${this._rbtn('add-plate', icon('plate',18), 'Placa', 'Insertar placa')}
              ${this._rbtn('add-gusset-tri', icon('angle',18), 'Cartela', 'Insertar cartela triangular')}
            </div>
            <div class="ribbon-group-title">Piezas y chapas</div>
          </div>
          <div class="ribbon-vsep"></div>
          <div class="ribbon-group-box">
            <div class="ribbon-group-buttons">
              ${this._rbtn('add-bolt', icon('bolt',18), 'Perno', 'Insertar perno')}
              ${this._rbtn('bolt-matrix', icon('arrayLinear',18), 'Matriz N×M', 'Generar matriz paramétrica')}
              ${this._rbtn('add-anchor', icon('layers',18), 'Anclaje', 'Insertar anclaje')}
              ${this._rbtn('tool-weld', icon('weld',18), 'Soldadura', 'Crear cordón')}
            </div>
            <div class="ribbon-group-title">Tornillos y soldaduras</div>
          </div>
          <div class="ribbon-vsep"></div>
          <div class="ribbon-group-box">
            <div class="ribbon-group-buttons">
              ${this._rbtn('measure-dist', icon('ruler',18), 'Cota', 'Medir distancia')}
              ${this._rbtn('measure-angle', icon('angle',18), 'Ángulo', 'Medir ángulo')}
              ${this._rbtn('clash-scan', icon('warning',18), 'Solapes', 'Detectar colisiones')}
            </div>
            <div class="ribbon-group-title">Documentación</div>
          </div>
        </div>

        <!-- EDICIÓN -->
        <div class="ribbon-panel hidden" data-panel="edicion">
          <div class="ribbon-group-box">
            <div class="ribbon-group-buttons">
              ${this._rbtn('tool-select', icon('pointer',16), 'Selec.', 'Seleccionar (V)')}
            </div>
            <div class="ribbon-group-title">Selección</div>
          </div>
          <div class="ribbon-vsep"></div>
          <div class="ribbon-group-box">
            <div class="ribbon-group-buttons">
              ${this._rbtn('tool-move',   icon('move',16),   'Mover',   'Mover (G)')}
              ${this._rbtn('tool-rotate', icon('rotate',16), 'Rotar',   'Rotar (R)')}
              ${this._rbtn('tool-scale',  icon('scale',16),  'Escalar', 'Escalar (S)')}
            </div>
            <div class="ribbon-group-title">Transformar</div>
          </div>
          <div class="ribbon-vsep"></div>
          <div class="ribbon-group-box">
            <div class="ribbon-group-buttons">
              ${this._rbtn('measure-dist',  icon('ruler',16), 'Distancia', 'Medir distancia (M)')}
              ${this._rbtn('measure-angle', icon('angle',16), 'Ángulo',    'Medir ángulo (3 clics)')}
              ${this._rbtn('measure-area',  icon('area',16),  'Área',      'Medir área (N clics + Enter)')}
            </div>
            <div class="ribbon-group-title">Medición</div>
          </div>
          <div class="ribbon-vsep"></div>
          <div class="ribbon-group-box">
            <div class="ribbon-group-buttons">
              ${this._rbtn('array-linear', icon('arrayLinear',16), 'Array Lin.', 'Array lineal')}
              ${this._rbtn('array-polar',  icon('arrayPolar',16),  'Array Pol.', 'Array polar')}
            </div>
            <div class="ribbon-group-title">Copias</div>
          </div>
          <div class="ribbon-vsep"></div>
          <div class="ribbon-group-box">
            <div class="ribbon-group-buttons">
              ${this._rbtn('align-x', icon('alignH',16), 'Alinear X', 'Alinear en eje X (media)')}
              ${this._rbtn('align-y', icon('alignV',16), 'Alinear Y', 'Alinear en eje Y (media)')}
              ${this._rbtn('align-z', icon('alignH',16), 'Alinear Z', 'Alinear en eje Z (media)')}
            </div>
            <div class="ribbon-group-title">Alinear</div>
          </div>
          <div class="ribbon-vsep"></div>
          <div class="ribbon-group-box">
            <div class="ribbon-group-buttons">
              ${this._rbtn('duplicate',       icon('copy',16),  'Duplicar', 'Duplicar (Ctrl+D)')}
              ${this._rbtn('delete-selected', icon('trash',16), 'Eliminar', 'Eliminar (Del)', 'danger-btn')}
            </div>
            <div class="ribbon-group-title">Acciones</div>
          </div>
          <div class="ribbon-vsep"></div>
          <div class="ribbon-group-box">
            <div class="ribbon-group-buttons">
              <div class="ribbon-inline">
                <label class="ribbon-label">Espacio</label>
                <select id="coord-space-select" class="ribbon-select">
                  <option value="world">Global</option>
                  <option value="local">Local</option>
                </select>
              </div>
            </div>
            <div class="ribbon-group-title">Coordenadas</div>
          </div>
        </div>

        <!-- VISUALIZACIÓN -->
        <div class="ribbon-panel hidden" data-panel="visualizacion">
          <div class="ribbon-group-box ribbon-group-featured">
            <div class="ribbon-group-buttons">
              <button class="ribbon-btn featured-btn" data-action="open-render-studio" title="Abrir Render Studio">${icon('eye',20)}<span>Render</span></button>
            </div>
            <div class="ribbon-group-title">Presentación</div>
          </div>
          <div class="ribbon-vsep"></div>
          <div class="ribbon-group-box">
            <div class="ribbon-group-buttons">
              ${this._rbtn('view-iso',   icon('viewIso',16),   'ISO 3D',    'Vista isométrica 3D (1)')}
              ${this._rbtn('view-top',   icon('viewTop',16),   'Planta',    'Vista de planta (7)')}
              ${this._rbtn('view-front', icon('viewFront',16), 'Frontal',   'Vista frontal (3)')}
              ${this._rbtn('view-left',  icon('viewLeft',16),  'Izquierda', 'Vista izquierda (5)')}
              ${this._rbtn('view-right', icon('chevRight',16), 'Derecha',   'Vista derecha')}
            </div>
            <div class="ribbon-group-title">Cámara</div>
          </div>
          <div class="ribbon-vsep"></div>
          <div class="ribbon-group-box">
            <div class="ribbon-group-buttons">
              ${this._rbtn('mode-clay', '<span class="mode-dot" style="background:#aabac8"></span>', 'Clay',    'Modo Clay técnico')}
              ${this._rbtn('mode-pbr',  '<span class="mode-dot" style="background:#6b93ff"></span>', 'PBR',     'Modo PBR realista')}
              ${this._rbtn('mode-wire', '<span class="mode-dot" style="background:transparent;border:2px solid #4a7acc"></span>', 'Wire', 'Modo alámbrico')}
              ${this._rbtn('mode-xray', '<span class="mode-dot" style="background:#a855f7;opacity:0.5"></span>', 'X-Ray', 'Modo transparente')}
            </div>
            <div class="ribbon-group-title">Modo Visual</div>
          </div>
          <div class="ribbon-vsep"></div>
          <div class="ribbon-group-box">
            <div class="ribbon-group-buttons">
              <div class="ribbon-inline">
                <label class="ribbon-label">Grid</label>
                <select id="grid-size-select" class="ribbon-select">
                  <option value="8">8×8</option>
                  <option value="16" selected>16×16</option>
                  <option value="24">24×24</option>
                  <option value="32">32×32</option>
                </select>
              </div>
              <button class="ribbon-btn active" id="btn-snap" data-action="toggle-snap" title="Snap (activar/desactivar)">
                ${icon('magnet',16)}<span>Snap</span>
              </button>
            </div>
            <div class="ribbon-group-title">Grid / Snap</div>
          </div>
        </div>

      
        <!-- INFORMES -->
        <div class="ribbon-panel hidden" data-panel="informes">
          <div class="ribbon-group-box ribbon-group-featured"><div class="ribbon-group-buttons">
            ${this._rbtn('report-pdf', icon('file',18), 'Memoria PDF', 'Vista imprimible / Guardar como PDF', 'featured-btn')}
            ${this._rbtn('report-html', icon('download',16), 'Memoria HTML', 'Descargar informe HTML autónomo')}
          </div><div class="ribbon-group-title">Memoria justificativa</div></div>
          <div class="ribbon-vsep"></div>
          <div class="ribbon-group-box"><div class="ribbon-group-buttons">
            ${this._rbtn('export-json', icon('download',16), 'Proyecto JSON', 'Exportar modelo editable')}
            ${this._rbtn('open-tutorial', icon('graduation',16), 'Módulo ETSIE', 'Tests y teoría de examen')}
          </div><div class="ribbon-group-title">Entregables / Formación</div></div>
        </div>
</div>
    `;

    // Tab switching
    this.ribbon.querySelectorAll('.ribbon-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.ribbon.querySelectorAll('.ribbon-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.ribbon.querySelectorAll('.ribbon-panel').forEach(p => p.classList.add('hidden'));
        const panel = this.ribbon.querySelector(`[data-panel="${tab.dataset.tab}"]`);
        if (panel) panel.classList.remove('hidden');
      });
    });

    // Button clicks
    this.ribbon.querySelectorAll('.ribbon-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action) this._emit(action);
      });
    });

    // Grid size
    const gs = document.getElementById('grid-size-select');
    if (gs) gs.addEventListener('change', () => this._emit('grid-size-' + gs.value));

    // Coord space
    const cs = document.getElementById('coord-space-select');
    if (cs) cs.addEventListener('change', () => this._emit('coord-space-' + cs.value));
  }

  _rbtn(action, iconHtml, label, title = '', extra = '') {
    return `<button class="ribbon-btn ${extra}" data-action="${action}" title="${title || label}">
      ${iconHtml}<span>${label}</span>
    </button>`;
  }

  setActiveButton(action) {
    // Clear edit panel only
    const editPanel = this.ribbon.querySelector('[data-panel="edicion"]');
    if (editPanel) {
      editPanel.querySelectorAll('.ribbon-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.action === action);
      });
    }
    // Also highlight sidebar
    document.querySelectorAll('.sb-tool').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.action === action);
    });
  }

  setActiveModeButton(mode) {
    const vizPanel = this.ribbon.querySelector('[data-panel="visualizacion"]');
    if (!vizPanel) return;
    vizPanel.querySelectorAll('.ribbon-btn[data-action^="mode-"]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.action === 'mode-' + mode);
    });
  }
}


