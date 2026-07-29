import './ui/layout.css';
import './ui/geometric-system.css';
import './ui/editor-pro.css';
import { LoginScreen } from './ui/LoginScreen.js';
import { SceneManager } from './core/SceneManager.js';
import { NavigationCube } from './core/NavigationCube.js';
import { GridManager } from './core/GridManager.js';
import { SnapManager } from './core/SnapManager.js';
import { Profile } from './entities/Profile.js';
import { Plate } from './entities/Plate.js';
import { Fastener } from './entities/Fastener.js';
import { Weld } from './entities/Weld.js';
import { SelectTool } from './tools/SelectTool.js';
import { MeasureTool } from './tools/MeasureTool.js';
import { WeldTool } from './tools/WeldTool.js';
import { GizmoManager } from './tools/GizmoManager.js';
import { Header } from './ui/Header.js';
import { Sidebar } from './ui/Sidebar.js';
import { Ribbon } from './ui/Ribbon.js';
import { PropertiesPanel } from './ui/PropertiesPanel.js';
import { SectionDrawer } from './ui/SectionDrawer.js';
import { TutorialModule } from './ui/TutorialModule.js';
import { CustomPartEditor } from './ui/CustomPartEditor.js';
import { ProWorkspaceController } from './core/ProWorkspaceController.js';
import { LoadManager } from './core/LoadManager.js';
import { RenderStudio } from './core/RenderStudio.js';
import { serializeBIMObject, serializeProject, restoreProject } from './core/ProjectSerializer.js';

// ─── DOM ELEMENTS ─────────────────────────────────────────────
const appEl = document.getElementById('app');
appEl.classList.add('hidden');

// ─── UI COMPONENTS ─────────────────────────────────────────────
const header = new Header(document.getElementById('header'));
const sidebar = new Sidebar(document.getElementById('sidebar'));
const ribbon = new Ribbon(document.getElementById('ribbon'));

let sceneManager, gridManager, snapManager, gizmoManager;
let sectionDrawer, propsPanel, tutorialModule, proController;
let customPartEditor, loadManager, renderStudio;
let selectTool, measureTool, weldTool;
let navCube = null;
let activeTool = 'select';
let darkTheme = true;
let visualMode = 'clay';
let gizmoSpace = 'world';
let _undoStack = [];
let _undoPointer = -1;
let _currentProjectName = 'Sin título';
let _appSettings = { units: 'metric', interfaceTheme: 'dark', snapPrecision: '10', autosave: true, reducedMotion: false };
const RECENTS_KEY = 'estructuras-pro:recent';
const VIEW_SLOTS_KEY = 'estructuras-pro:views';

// ─── LOGIN ────────────────────────────────────────────────────
new LoginScreen((userName, launchContext = {}) => {
  appEl.classList.remove('hidden');
  header.setUser(userName);
  // Wait for browser to do layout pass before Three.js reads clientWidth
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      initApp(launchContext);
    });
  });
});

// ─── INIT ─────────────────────────────────────────────────────
function initApp(launchContext = {}) {
  const canvas = document.getElementById('canvas-container');

  sceneManager = new SceneManager(canvas);
  gridManager = new GridManager(sceneManager.scene, 16);
  snapManager = new SnapManager(sceneManager, gridManager);
  gizmoManager = new GizmoManager(sceneManager);

  sectionDrawer = new SectionDrawer();
  propsPanel = new PropertiesPanel(document.getElementById('properties-panel'), sectionDrawer);
  tutorialModule = new TutorialModule();
  loadManager = new LoadManager(sceneManager, {
    toast: showToast,
    onCommit: (element) => {
      propsPanel.update(element);
      pushUndo();
      refreshWorkspace();
    },
  });
  renderStudio = new RenderStudio(sceneManager);
  customPartEditor = new CustomPartEditor(sceneManager, {
    toast: showToast,
    onCreate: (plate) => {
      selectAndShow(plate);
      pushUndo();
      refreshWorkspace();
    },
  });

  // Tools
  selectTool = new SelectTool(sceneManager, snapManager, (bimObj) => {
    propsPanel.update(bimObj);
    updateMiniTransform(bimObj);
    if (bimObj && bimObj.type !== 'weld') sceneManager.attachGizmo(bimObj.mesh);
    else sceneManager.detachGizmo();
    sidebar.setActiveObject(bimObj?.id || null);
  });

  measureTool = new MeasureTool(sceneManager, snapManager);
  weldTool = new WeldTool(sceneManager, snapManager, (weld) => { selectAndShow(weld); pushUndo(); });

  propsPanel.onDelete = (el) => deleteSelected();
  propsPanel.onDuplicate = (el) => duplicateSelected();
  propsPanel.onColorChange = (el, color) => { updateStatusBar(); pushUndo(); };
  propsPanel.onPropertyChange = (el) => { loadManager?.rebuild(el); updateStatusBar(); pushUndo(); };

  // Listen for gizmo drop
  document.addEventListener('gizmo-drag-end', () => pushUndo());

  wireRibbon();
  wireSidebar();
  wireHeader();
  header.onTutorialToggle = () => tutorialModule.show();
  wireCanvas();
  wireKeyboard();
  wireCommandPalette();
  wireContextMenu();
  wireViewCube();
  wireMiniTransform();
  wireSnapIndicator();
  _wireStatusChips();

  proController = new ProWorkspaceController({
    sceneManager, propsPanel, sidebar, ribbon,
    getSelected: () => selectTool.selected,
    selectObject: object => selectAndShow(object),
    pushUndo, toast: showToast, refresh: refreshWorkspace,
    getProjectName: () => _currentProjectName,
    onExport: exportProject, onTutorial: () => tutorialModule.show(),
  }).wire();

  // Gizmo coord sync
  sceneManager.transformControls?.addEventListener('objectChange', () => {
    if (selectTool.selected) {
      propsPanel.updateCoords(selectTool.selected);
      updateCoordReadout(selectTool.selected.getPosition());
    }
    proController?.syncBoundWelds();
    updateStatusBar();
  });

  // Force resize to get correct canvas dimensions after app is shown
  requestAnimationFrame(() => {
    sceneManager._onResize();
    requestAnimationFrame(() => sceneManager._onResize());
  });

  // Set default visual mode
  setVisualMode('clay');

  // Status bar loop
  setInterval(updateStatusBar, 500);

  // Toast container
  const toastEl = document.createElement('div');
  toastEl.id = 'toast-container';
  document.body.appendChild(toastEl);

  // Update recents dropdown
  _refreshRecentsDropdown();

  if (launchContext?.settings) {
    _appSettings = { ..._appSettings, ...launchContext.settings };
    document.documentElement.dataset.units = _appSettings.units || 'metric';
    document.documentElement.classList.toggle('reduced-motion', !!_appSettings.reducedMotion);
    snapManager.gridSnap = Math.max(.001, Number(_appSettings.snapPrecision || 10) / 1000);
    const useDark = _appSettings.interfaceTheme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : _appSettings.interfaceTheme !== 'light';
    header.setTheme(useDark);
  }
  if (launchContext?.project) _deserializeScene(launchContext.project);
  _undoStack = [captureState()];
  _undoPointer = 0;
  refreshWorkspace();

  // Disable legacy autosave state if it exists from older builds
  try { localStorage.removeItem('cometv:auto'); } catch (_) {}

  console.log('✦ ESTRUCTURAS PRO v6.0 — Código Estructural');
  showToast('ESTRUCTURAS PRO listo', 2500);
}

// ─── HELPERS ──────────────────────────────────────────────────
function refreshWorkspace() {
  sidebar.refresh(sceneManager?.objects || []);
  sidebar.setActiveObject(selectTool?.selected?.id || null);
  updateStatusBar();
}
function selectAndShow(bimObj) {
  if (selectTool.selected && selectTool.selected !== bimObj) {
    selectTool.selected.setSelected(false);
  }
  selectTool.selected = bimObj;
  selectTool.selectedSet.forEach(object => { if (object !== bimObj) object.setSelected(false); });
  selectTool.selectedSet.clear();
  if (bimObj) { bimObj.setSelected(true); selectTool.selectedSet.add(bimObj); }
  propsPanel.update(bimObj);
  updateMiniTransform(bimObj);
  if (bimObj && bimObj.type !== 'weld') sceneManager.attachGizmo(bimObj.mesh);
  else sceneManager.detachGizmo();
  sidebar.setActiveObject(bimObj?.id || null);
  updateStatusBar();
}

function createProfile(series, size, length, orientation) {
  const p = new Profile(series, size, length, orientation);
  sceneManager.addObject(p);
  selectAndShow(p);
  pushUndo();
}

function createPlate(subtype, w = 0.3, h = 0.3, t = 0.02, points = null) {
  const p = new Plate(subtype, w, h, t);
  if (points) p.params.points = points;
  sceneManager.addObject(p);
  selectAndShow(p);
  pushUndo();
}

function createFastener(subtype, metric = 'M16') {
  const metric_ = document.getElementById('global-metric-select')?.value || metric;
  const f = new Fastener(subtype, metric_);
  sceneManager.addObject(f);
  selectAndShow(f);
  // Auto-foco inmediato (Zoom in) para localizar piezas pequeñas
  setTimeout(() => sceneManager.focusOnObject(f), 50); 
  pushUndo();
}

function duplicateSelected() {
  const sel = selectTool.selected;
  if (!sel) return;
  let dup;
  if (sel.type === 'profile') {
    dup = new Profile(sel.params.series, sel.params.size, sel.params.length, sel.params.orientation, sel.params);
  } else if (sel.type === 'plate') {
    dup = new Plate(sel.params.subtype, sel.params.width, sel.params.height, sel.params.thickness);
    dup.update(sel.params);
  } else if (sel.type === 'fastener') {
    dup = new Fastener(sel.params.subtype, sel.params.metric, sel.params.shankLength);
    dup.update(sel.params);
  } else return;
  const pos = sel.getPosition();
  dup.setColor(sel.color);
  dup.steelGrade = sel.steelGrade;
  sceneManager.addObject(dup);
  dup.mesh.quaternion.copy(sel.mesh.quaternion);
  dup.mesh.scale.copy(sel.mesh.scale);
  dup.setPosition(pos.x + 0.3, pos.y, pos.z + 0.3);
  selectAndShow(dup);
  pushUndo();
  showToast(`Duplicado: ${dup.designation}`);
}

function deleteSelected() {
  if (!selectTool.selected) return;
  const removed = selectTool.selected;
  sceneManager.removeObject(removed);
  loadManager?.rebuildAll();
  selectTool.selectedSet.delete(removed);
  selectTool.selected = null;
  propsPanel.update(null);
  updateMiniTransform(null);
  pushUndo();
}

function isolateSelected() {
  const sel = selectTool.selected;
  if (!sel) return;
  sceneManager.objects.forEach(o => {
    if (o !== sel && o.mesh) o.mesh.visible = false;
  });
  showToast('Aislado. Pulsa Alt+I para mostrar todo.');
}

function showAll() {
  sceneManager.objects.forEach(o => {
    if (o.mesh) o.mesh.visible = true;
  });
  showToast('Todos los elementos visibles.');
}

function setTool(toolName) {
  activeTool = toolName;
  measureTool.setActive(false);
  weldTool.setActive(false);

  const toolLabels = {
    select: 'Seleccionar',
    move: 'Mover',
    rotate: 'Rotar',
    scale: 'Escalar',
    measure: 'Medir',
    weld: 'Soldadura',
  };

  if (toolName === 'measure') { measureTool.setActive(true); }
  else if (toolName === 'weld') { weldTool.setActive(true); }
  else if (toolName === 'move') { sceneManager.setGizmoMode('translate'); }
  else if (toolName === 'rotate') { sceneManager.setGizmoMode('rotate'); }
  else if (toolName === 'scale') { sceneManager.setGizmoMode('scale'); }

  ribbon.setActiveButton('tool-' + toolName);
  sidebar.setActiveTool(toolName);

  const sb = document.getElementById('sb-tool');
  if (sb) sb.textContent = toolLabels[toolName] || toolName;
}

function setVisualMode(mode) {
  visualMode = mode;
  sceneManager.setVisualMode(mode);
  ribbon.setActiveModeButton(mode);
  const badge = document.getElementById('viewport-mode-badge');
  const labels = { clay:'TECHNICAL CLAY', pbr:'PBR REALISTIC', wire:'WIREFRAME', xray:'X-RAY' };
  if (badge) badge.textContent = labels[mode] || mode.toUpperCase();
  showToast(`Modo: ${labels[mode] || mode}`);
}

// ─── STATUS BAR ───────────────────────────────────────────────
function updateStatusBar() {
  const sbObjs = document.getElementById('sb-objects');
  const sbSel  = document.getElementById('sb-selection');
  if (sbObjs) sbObjs.textContent = `${sceneManager?.objects?.length || 0} objetos`;
  if (sbSel) {
    sbSel.textContent = selectTool?.selected
      ? (selectTool.selectedSet && selectTool.selectedSet.size > 1
          ? `${selectTool.selectedSet.size} seleccionados`
          : selectTool.selected.designation)
      : 'Sin selección';
  }

  // Chips
  const fpsChip = document.getElementById('sb-chip-fps');
  if (fpsChip && sceneManager?.fps != null) fpsChip.textContent = `${sceneManager.fps} FPS`;

  const camChip = document.getElementById('sb-chip-cam');
  if (camChip && sceneManager?.camera) {
    const isOrtho = sceneManager.camera.type === 'OrthographicCamera';
    camChip.textContent = isOrtho ? 'ORTHO' : 'PERS';
    camChip.classList.toggle('active', !isOrtho);
  }

  const gridChip = document.getElementById('sb-chip-grid');
  if (gridChip && gridManager) gridChip.classList.toggle('active', gridManager.visible !== false);

  const snapChip = document.getElementById('sb-chip-snap');
  if (snapChip && snapManager) {
    snapChip.classList.toggle('active', !!snapManager.enabled);
    snapChip.textContent = snapManager.enabled ? `SNAP · ${String(snapManager.snapType || 'grid').toUpperCase()}` : 'SNAP · OFF';
  }
}

function _wireStatusChips() {
  document.getElementById('sb-chip-grid')?.addEventListener('click', () => {
    if (!gridManager) return;
    const v = !(gridManager.visible !== false);
    gridManager.setVisible ? gridManager.setVisible(v) : (gridManager.visible = v);
    showToast(`Grid: ${v ? 'visible' : 'oculta'}`);
    updateStatusBar();
  });
  document.getElementById('sb-chip-snap')?.addEventListener('click', () => {
    if (!snapManager) return;
    setSnapEnabled(!snapManager.enabled);

  });
  document.getElementById('sb-chip-cam')?.addEventListener('click', () => {
    const isOrtho = sceneManager?.camera?.type === 'OrthographicCamera';
    sceneManager.animateCameraTo?.(isOrtho ? 'iso' : 'top');
  });
}

// ─── COORD READOUT ─────────────────────────────────────────────
function updateCoordReadout(pos) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val.toFixed(3); };
  set('cr-x', pos?.x || 0);
  set('cr-y', pos?.y || 0);
  set('cr-z', pos?.z || 0);
  const sbC = document.getElementById('sb-coords');
  if (sbC && pos) sbC.textContent = `${pos.x.toFixed(3)} · ${pos.y.toFixed(3)} · ${pos.z.toFixed(3)}`;
}

// ─── MINI TRANSFORM ────────────────────────────────────────────
function updateMiniTransform(bimObj) {
  const mt = document.getElementById('mini-transform');
  if (!mt) return;
  mt.classList.toggle('hidden', !bimObj);
}

function wireMiniTransform() {
  document.querySelectorAll('.mt-btn[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      setTool(mode === 'translate' ? 'move' : mode);
      document.querySelectorAll('.mt-btn[data-mode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.getElementById('mt-local-global')?.addEventListener('click', (e) => {
    gizmoSpace = gizmoSpace === 'world' ? 'local' : 'world';
    sceneManager.setGizmoSpace(gizmoSpace);
    e.currentTarget.querySelector('.mt-coord-label').textContent = gizmoSpace === 'world' ? 'GLB' : 'LCL';
    showToast(`Espacio: ${gizmoSpace === 'world' ? 'Global' : 'Local'}`);
  });
}

// ─── SNAP INDICATOR ────────────────────────────────────────────
function wireSnapIndicator() {
  // Updated via mousemove
}

function setSnapEnabled(enabled) {
  snapManager.setEnabled(!!enabled);
  if (!snapManager.enabled) updateSnapIndicator(null);
  document.getElementById('btn-snap')?.classList.toggle('active', snapManager.enabled);
  updateStatusBar();
  showToast(`Snap: ${snapManager.enabled ? 'activo' : 'desactivado'}`);
}

function updateSnapIndicator(snapType) {
  const si = document.getElementById('snap-indicator');
  const sl = document.getElementById('snap-type-label');
  if (!si || !sl) return;
  if (snapType) {
    si.classList.remove('hidden');
    sl.textContent = snapType.toUpperCase();
    const colors = { vertex:'var(--snap-vertex)', edge:'var(--snap-edge)', face:'var(--snap-face)', grid:'var(--snap-grid)' };
    si.style.color = colors[snapType] || 'var(--snap-grid)';
    si.style.borderColor = colors[snapType] || 'var(--border-2)';
  } else {
    si.classList.add('hidden');
  }
}

// ─── NAVIGATION CUBE 3D ─────────────────────────────────────────
function wireViewCube() {
  const navCanvas = document.getElementById('nav-cube-canvas');
  if (navCanvas) {
    try {
      navCube = new NavigationCube(navCanvas, sceneManager);
    } catch (e) {
      console.warn('NavigationCube init failed:', e);
    }
  }

  const homeBtn = document.getElementById('nav-cube-home');
  homeBtn?.addEventListener('click', () => {
    sceneManager.fitAll?.();
    showToast('Fit All');
  });
}

// ─── RIBBON ────────────────────────────────────────────────────
function wireRibbon() {
  ribbon.on('project-new', () => header.onNew?.());
  ribbon.on('project-open', () => header.onLoad?.());
  ribbon.on('project-save', () => header.onSave?.());
  ribbon.on('project-export', () => header.onExport?.());
  // Estructura
  ribbon.on('add-heb-col',  () => createProfile('HEB', '200', 3.0, 'column'));
  ribbon.on('add-hea-col',  () => createProfile('HEA', '200', 3.0, 'column'));
  ribbon.on('add-ipe',      () => createProfile('IPE', '200', 4.0, 'beam'));
  ribbon.on('add-ipn',      () => createProfile('IPN', '200', 4.0, 'beam'));
  ribbon.on('add-upn',      () => createProfile('UPN', '200', 3.0, 'beam'));
  ribbon.on('add-chs',      () => createProfile('CHS', '114.3x5.0', 3.0, 'column'));
  ribbon.on('add-shs',      () => createProfile('SHS', '100x100x5', 3.0, 'column'));
  ribbon.on('add-angle',    () => createProfile('L', '80x8', 2.0, 'beam'));
  ribbon.on('add-heb-beam', () => createProfile('HEB', '200', 4.0, 'beam'));

  // Conexiones
  ribbon.on('add-plate',       () => createPlate('base', 0.3, 0.3, 0.02));
  ribbon.on('add-gusset-sq',   () => createPlate('gusset-square', 0.2, 0.2, 0.012));
  ribbon.on('add-gusset-tri',  () => createPlate('gusset-triangle', 0.2, 0.2, 0.012));
  ribbon.on('add-cleat',       () => createPlate('cleat', 0.1, 0.1, 0.01));
  ribbon.on('add-neoprene',    () => createPlate('neoprene', 0.15, 0.2, 0.015));
  ribbon.on('tool-weld',       () => setTool('weld'));

  // Tornillería
  ribbon.on('add-bolt',    () => createFastener('bolt', 'M16'));
  ribbon.on('add-nut',     () => createFastener('nut', 'M16'));
  ribbon.on('add-washer',  () => createFastener('washer', 'M16'));
  ribbon.on('add-anchor',  () => createFastener('anchor', 'M20'));
  ribbon.on('add-bolt-set', () => {
    const metric = document.getElementById('global-metric-select')?.value || 'M16';
    const bolt = new Fastener('bolt', metric);
    sceneManager.addObject(bolt);
    
    const boltPos = selectTool.selected?.getPosition();
    if (boltPos) {
      bolt.setPosition(boltPos.x, boltPos.y, boltPos.z);
      const nut = new Fastener('nut', metric);
      const washer = new Fastener('washer', metric);
      sceneManager.addObject(nut);
      sceneManager.addObject(washer);
      nut.setPosition(boltPos.x, boltPos.y - 0.07, boltPos.z);
      washer.setPosition(boltPos.x, boltPos.y - 0.075, boltPos.z);
    }
    selectAndShow(bolt);
    setTimeout(() => sceneManager.focusOnObject(bolt), 50);
    pushUndo();
  });
  ribbon.on('array-linear', () => arrayLinearSelected());
  ribbon.on('array-polar',  () => arrayPolarSelected());
  ribbon.on('align-x',      () => alignSelected('x'));
  ribbon.on('align-y',      () => alignSelected('y'));
  ribbon.on('align-z',      () => alignSelected('z'));
  ribbon.on('measure-dist', () => { measureTool.setMode?.('distance'); setTool('measure'); });
  ribbon.on('measure-angle',() => { measureTool.setMode?.('angle');    setTool('measure'); });
  ribbon.on('measure-area', () => { measureTool.setMode?.('area');     setTool('measure'); });
  ribbon.on('open-custom-part', () => customPartEditor?.open());
  ribbon.on('open-render-studio', () => renderStudio?.open());
  ribbon.on('add-load-point', () => loadManager?.openDialog(selectTool.selected, 'point'));
  ribbon.on('add-load-distributed', () => loadManager?.openDialog(selectTool.selected, 'distributed'));
  ribbon.on('add-load-moment', () => loadManager?.openDialog(selectTool.selected, 'moment'));

  // Edición
  ribbon.on('tool-select',  () => setTool('select'));
  ribbon.on('tool-move',    () => setTool('move'));
  ribbon.on('tool-rotate',  () => setTool('rotate'));
  ribbon.on('tool-scale',   () => setTool('scale'));
  ribbon.on('tool-measure', () => setTool('measure'));
  ribbon.on('duplicate',    () => duplicateSelected());
  ribbon.on('delete-selected', () => deleteSelected());

  // Coord space
  ribbon.on('coord-space-world', () => {
    gizmoSpace = 'world';
    sceneManager.setGizmoSpace('world');
  });
  ribbon.on('coord-space-local', () => {
    gizmoSpace = 'local';
    sceneManager.setGizmoSpace('local');
  });

  // Visualización — cámara
  ribbon.on('view-iso',   () => sceneManager.setCameraView('iso'));
  ribbon.on('view-top',   () => sceneManager.setCameraView('top'));
  ribbon.on('view-front', () => sceneManager.setCameraView('front'));
  ribbon.on('view-left',  () => sceneManager.setCameraView('left'));
  ribbon.on('view-right', () => sceneManager.setCameraView('right'));

  // Modos visuales
  ribbon.on('mode-clay',  () => setVisualMode('clay'));
  ribbon.on('mode-pbr',   () => setVisualMode('pbr'));
  ribbon.on('mode-wire',  () => setVisualMode('wire'));
  ribbon.on('mode-xray',  () => setVisualMode('xray'));

  // Grid / Snap
  ribbon.on('toggle-snap', () => setSnapEnabled(!snapManager.enabled));

  [8, 16, 24, 32].forEach(s => ribbon.on('grid-size-' + s, () => gridManager.setSize(s)));
}

// ─── SIDEBAR ──────────────────────────────────────────────────
function wireSidebar() {
  sidebar.on('select',    () => setTool('select'));
  sidebar.on('move',      () => setTool('move'));
  sidebar.on('rotate',    () => setTool('rotate'));
  sidebar.on('scale',     () => setTool('scale'));
  sidebar.on('measure',   () => setTool('measure'));
  sidebar.on('weld',      () => setTool('weld'));
  sidebar.on('view-iso',  () => sceneManager.setCameraView('iso'));
  sidebar.on('view-top',  () => sceneManager.setCameraView('top'));
  sidebar.on('view-front',() => sceneManager.setCameraView('front'));
  sidebar.on('view-left', () => sceneManager.setCameraView('left'));
  sidebar.on('view-right',() => sceneManager.setCameraView('right'));
  sidebar.on('select-object', id => {
    const object = sceneManager.objects.find(item => item.id === id);
    if (object) selectAndShow(object);
  });
  sidebar.on('open-structure-tab', () => document.querySelector('.ribbon-tab[data-tab="estructura"]')?.click());
}

// ─── HEADER ───────────────────────────────────────────────────
function wireHeader() {
  header.onThemeToggle = (dark) => {
    darkTheme = dark;
    document.documentElement.setAttribute('data-theme', dark ? '' : 'light');
    sceneManager.setTheme(dark);
    sectionDrawer?.setTheme?.(!dark);
    propsPanel?.refresh?.();
  };
  header.onSave = saveProject;
  header.onLoad = loadProject;
  header.onNew = () => {
    if (!confirm('¿Crear nuevo proyecto? Se perderán los cambios no guardados.')) return;
    proController?.resetTransientState({ refresh: false });
    sceneManager.objects.slice().forEach(o => sceneManager.removeObject(o));
    loadManager?.clear();
    selectTool.selectedSet.clear();
    selectTool.selected = null;
    proController?.visualizer.clear();
    propsPanel.update(null);
    updateMiniTransform(null);
    _currentProjectName = 'Sin título';
    const nameInput = document.getElementById('project-name-input');
    if (nameInput) nameInput.value = _currentProjectName;
    pushUndo();
    showToast('Nuevo proyecto creado.');
  };
  header.onExport = exportProject;
}

// ─── CANVAS ───────────────────────────────────────────────────
function wireCanvas() {
  const canvasEl = sceneManager.renderer.domElement;

  canvasEl.addEventListener('mousemove', (e) => {
    const snapResult = snapManager.update(e);
    if (snapResult) {
      updateCoordReadout(snapResult);
      updateSnapIndicator(snapManager.snapType);
    } else {
      updateSnapIndicator(null);
    }

    measureTool.handleMouseMove(e);
    weldTool.handleMouseMove(e);

    // Hover detection (only in select mode)
    if (activeTool === 'select') {
      const hovered = sceneManager.getBIMObjectAtMouse(e);
      if (hovered !== sceneManager._hoveredObj) {
        if (hovered && !hovered._isSelected) {
          sceneManager.setHovered(hovered);
          showHoverTooltip(e, hovered);
        } else {
          sceneManager.clearHover();
          hideHoverTooltip();
        }
      }
    }
  });

  canvasEl.addEventListener('mouseleave', () => {
    sceneManager.clearHover();
    hideHoverTooltip();
    updateSnapIndicator(null);
  });

  canvasEl.addEventListener('click', (e) => {
    if (e.button !== 0) return;
    if (sceneManager._isDragging || sceneManager._justFinishedDragging) return;
    if (activeTool === 'measure') measureTool.handleClick(e);
    else if (activeTool === 'weld') weldTool.handleClick(e);
    else selectTool.handleClick(e);
  });

  canvasEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (selectTool.selected) showContextMenu(e.clientX, e.clientY);
  });
}

// ─── HOVER TOOLTIP ────────────────────────────────────────────
function showHoverTooltip(event, bimObj) {
  const tt = document.getElementById('hover-tooltip');
  if (!tt || !bimObj) return;
  tt.textContent = bimObj.designation || bimObj.type;
  tt.classList.remove('hidden');
  tt.style.left = (event.clientX + 14) + 'px';
  tt.style.top  = (event.clientY - 8) + 'px';
}
function hideHoverTooltip() {
  document.getElementById('hover-tooltip')?.classList.add('hidden');
}

// ─── CONTEXT MENU ─────────────────────────────────────────────
function showContextMenu(x, y) {
  const cm = document.getElementById('context-menu');
  if (!cm) return;
  cm.classList.remove('hidden');
  cm.style.left = x + 'px';
  cm.style.top  = y + 'px';
}

function wireContextMenu() {
  const cm = document.getElementById('context-menu');
  if (!cm) return;

  cm.querySelectorAll('.ctx-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      if (action === 'duplicate') duplicateSelected();
      else if (action === 'isolate') isolateSelected();
      else if (action === 'focus') {
        if (selectTool.selected) sceneManager.focusOnObject(selectTool.selected);
      }
      else if (action === 'delete') deleteSelected();
      cm.classList.add('hidden');
    });
  });

  document.addEventListener('click', (e) => {
    if (!cm.contains(e.target)) cm.classList.add('hidden');
  });
}

// ─── KEYBOARD ─────────────────────────────────────────────────
function wireKeyboard() {
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

    // Command palette
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openCommandPalette();
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 's') { e.preventDefault(); saveProject(); return; }
      if (e.key === 'd') { e.preventDefault(); duplicateSelected(); return; }
      if (e.key === 'z') { e.preventDefault(); undoAction(); return; }
      if (e.key === 'y') { e.preventDefault(); redoAction(); return; }
    }

    if (e.altKey) {
      if (e.key === 'i') { e.preventDefault(); showAll(); return; }
    }

    switch (e.key.toLowerCase()) {
      case 'v': case 'escape': setTool('select'); closeCommandPalette(); break;
      case 'g': setTool('move'); break;
      case 'r': setTool('rotate'); break;
      case 'w': setTool('weld'); break;
      case 'm': setTool('measure'); break;
      case 's': if (!e.ctrlKey) setTool('scale'); break;
      case 'delete': case 'backspace': deleteSelected(); break;
      case 'f': if (selectTool.selected) sceneManager.focusOnObject(selectTool.selected); break;
      case 'home': e.preventDefault(); sceneManager.fitAll?.(); showToast('Fit All'); break;
      case '1': sceneManager.animateCameraTo ? sceneManager.animateCameraTo('iso') : sceneManager.setCameraView('iso'); break;
      case '3': sceneManager.animateCameraTo ? sceneManager.animateCameraTo('front') : sceneManager.setCameraView('front'); break;
      case '5': sceneManager.animateCameraTo ? sceneManager.animateCameraTo('left') : sceneManager.setCameraView('left'); break;
      case '7': sceneManager.animateCameraTo ? sceneManager.animateCameraTo('top') : sceneManager.setCameraView('top'); break;
    }
  });
}

// ─── COMMAND PALETTE ──────────────────────────────────────────
const COMMANDS = [
  { label: 'Añadir Columna HEB 200',   icon: 'fa-building',       action: () => createProfile('HEB','200',3,'column'),  group: 'Estructura' },
  { label: 'Añadir Viga IPE 200',       icon: 'fa-building',       action: () => createProfile('IPE','200',4,'beam'),     group: 'Estructura' },
  { label: 'Añadir Viga HEB 200',       icon: 'fa-building',       action: () => createProfile('HEB','200',4,'beam'),     group: 'Estructura' },
  { label: 'Añadir Columna HEA 200',    icon: 'fa-building',       action: () => createProfile('HEA','200',3,'column'),  group: 'Estructura' },
  { label: 'Añadir Canal UPN 200',      icon: 'fa-building',       action: () => createProfile('UPN','200',3,'beam'),    group: 'Estructura' },
  { label: 'Añadir Tubo CHS',           icon: 'fa-circle',         action: () => createProfile('CHS','114.3x5.0',3,'column'), group: 'Estructura' },
  { label: 'Añadir Tubo SHS',           icon: 'fa-square',         action: () => createProfile('SHS','100x100x5',3,'column'), group: 'Estructura' },
  { label: 'Añadir Angular L 80×8',     icon: 'fa-building',       action: () => createProfile('L','80x8',2,'beam'),    group: 'Estructura' },
  { label: 'Añadir Placa Base',         icon: 'fa-square',         action: () => createPlate('base'),                    group: 'Conexiones' },
  { label: 'Añadir Casquillo L',        icon: 'fa-chevron-right',  action: () => createPlate('cleat', 0.1, 0.1, 0.01),   group: 'Conexiones' },
  { label: 'Añadir Apoyo Neopreno',     icon: 'fa-square',         action: () => createPlate('neoprene', 0.15, 0.2, 0.015),group: 'Conexiones' },
  { label: 'Añadir Tornillo M16',       icon: 'fa-gears',          action: () => createFastener('bolt','M16'),           group: 'Tornillería' },
  { label: 'Duplicar selección',        icon: 'fa-clone',          action: duplicateSelected,   kbd: 'Ctrl+D',           group: 'Edición' },
  { label: 'Eliminar selección',        icon: 'fa-trash-can',      action: deleteSelected,      kbd: 'Del',              group: 'Edición' },
  { label: 'Aislar selección',          icon: 'fa-eye',            action: isolateSelected,                              group: 'Edición' },
  { label: 'Mostrar todo',              icon: 'fa-eye',            action: showAll,             kbd: 'Alt+I',            group: 'Edición' },
  { label: 'Vista isométrica',          icon: 'fa-cube',           action: () => sceneManager.setCameraView('iso'),  kbd:'1', group:'Cámara' },
  { label: 'Vista planta',              icon: 'fa-border-all',     action: () => sceneManager.setCameraView('top'),  kbd:'7', group:'Cámara' },
  { label: 'Vista frontal',             icon: 'fa-square',         action: () => sceneManager.setCameraView('front'),kbd:'3', group:'Cámara' },
  { label: 'Modo Technical Clay',       icon: 'fa-circle',         action: () => setVisualMode('clay'),                  group: 'Visualización' },
  { label: 'Modo PBR Realista',         icon: 'fa-circle',         action: () => setVisualMode('pbr'),                   group: 'Visualización' },
  { label: 'Modo Wireframe',            icon: 'fa-circle',         action: () => setVisualMode('wire'),                  group: 'Visualización' },
  { label: 'Modo X-Ray',                icon: 'fa-circle',         action: () => setVisualMode('xray'),                  group: 'Visualización' },
  { label: 'Guardar proyecto',          icon: 'fa-floppy-disk',    action: saveProject,         kbd: 'Ctrl+S',           group: 'Archivo' },
  { label: 'Exportar proyecto',         icon: 'fa-arrow-up-from-bracket', action: exportProject, group: 'Archivo' },
  { label: 'Centrar cámara en selección', icon: 'fa-crosshairs',  action: () => { if(selectTool.selected) sceneManager.focusOnObject(selectTool.selected); }, kbd: 'F', group: 'Cámara' },
];

function openCommandPalette() {
  const overlay = document.getElementById('command-palette-overlay');
  overlay?.classList.remove('hidden');
  const input = document.getElementById('cp-input');
  if (input) { input.value = ''; input.focus(); renderCommandResults(''); }
}

function closeCommandPalette() {
  document.getElementById('command-palette-overlay')?.classList.add('hidden');
}

function renderCommandResults(query) {
  const results = document.getElementById('cp-results');
  if (!results) return;

  const filtered = COMMANDS.filter(c =>
    !query || c.label.toLowerCase().includes(query.toLowerCase()) ||
    c.group.toLowerCase().includes(query.toLowerCase())
  );

  if (!filtered.length) {
    results.innerHTML = `<div class="cp-empty">Sin resultados para "${query}"</div>`;
    return;
  }

  const groups = {};
  filtered.forEach(c => {
    if (!groups[c.group]) groups[c.group] = [];
    groups[c.group].push(c);
  });

  let html = '';
  for (const [group, cmds] of Object.entries(groups)) {
    html += `<div class="cp-section-header">${group}</div>`;
    html += cmds.map((c, i) => `
      <div class="cp-result" data-idx="${COMMANDS.indexOf(c)}">
        <i class="fa-solid ${c.icon} cp-result-icon"></i>
        <span class="cp-result-label">${c.label}</span>
        ${c.kbd ? `<kbd class="cp-result-kbd">${c.kbd}</kbd>` : ''}
      </div>
    `).join('');
  }
  results.innerHTML = html;

  results.querySelectorAll('.cp-result').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx);
      if (COMMANDS[idx]) COMMANDS[idx].action();
      closeCommandPalette();
    });
  });
}

function wireCommandPalette() {
  const input = document.getElementById('cp-input');
  input?.addEventListener('input', (e) => renderCommandResults(e.target.value));
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCommandPalette();
    if (e.key === 'Enter') {
      const first = document.querySelector('.cp-result');
      first?.click();
    }
  });

  document.getElementById('command-palette-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'command-palette-overlay') closeCommandPalette();
  });
}

// ─── UNDO / REDO ──────────────────────────────────────────────
function captureState() {
  proController?.resetTransientState({ refresh: false });
  return sceneManager.objects.map(serializeBIMObject);
}

function applyState(stateData) {
  proController?.resetTransientState({ refresh: false });
  sceneManager.detachGizmo();
  selectTool.selectedSet.forEach(object => object.setSelected?.(false));
  selectTool.selectedSet.clear();
  selectTool.selected = null;
  restoreProject({ objects: Array.isArray(stateData) ? stateData : [] }, sceneManager);
  loadManager?.rebuildAll();
  propsPanel.update(null);
  updateMiniTransform(null);
  proController?.visualizer.clear();
  refreshWorkspace();
}

function pushUndo() {
  _undoStack.splice(_undoPointer + 1);
  _undoStack.push(captureState());
  if (_undoStack.length > 50) _undoStack.shift();
  _undoPointer = _undoStack.length - 1;
  if (_appSettings.autosave && sceneManager) {
    try { localStorage.setItem('estructuras-pro:auto', JSON.stringify(_serializeScene())); } catch (_) {}
  }
  refreshWorkspace();
}

function undoAction() {
  if (_undoPointer > 0) {
    _undoPointer--;
    applyState(_undoStack[_undoPointer]);
    showToast('Deshacer (Undo)');
  } else showToast('No hay más acciones para deshacer', 1500);
}

function redoAction() {
  if (_undoPointer < _undoStack.length - 1) {
    _undoPointer++;
    applyState(_undoStack[_undoPointer]);
    showToast('Rehacer (Redo)');
  } else showToast('No hay acciones para rehacer', 1500);
}

// ─── CLONE HELPER ──────────────────────────────────────────────
function _cloneBIM(src) {
  let dup;
  if (src.type === 'profile') dup = new Profile(src.params.series, src.params.size, src.params.length, src.params.orientation, src.params);
  else if (src.type === 'plate') { dup = new Plate(src.params.subtype, src.params.width, src.params.height, src.params.thickness); dup.update(src.params); }
  else if (src.type === 'fastener') { dup = new Fastener(src.params.subtype, src.params.metric, src.params.shankLength); dup.update(src.params); }
  else return null;
  if (src.color) dup.setColor(src.color);
  if (src.steelGrade) { dup.steelGrade = src.steelGrade; if (dup.type === 'profile') dup.update(dup.params); }
  dup.mesh.quaternion.copy(src.mesh.quaternion);
  dup.mesh.scale.copy(src.mesh.scale);
  return dup;
}

// ─── ARRAY LINEAR ─────────────────────────────────────────────
async function arrayLinearSelected() {
  const sel = selectTool.selected;
  if (!sel) { showToast('Seleccione un elemento primero.', 2000); return; }
  const res = await openInputModal('Array Lineal', [
    { id:'count',   label:'Nº copias (2–20)', value:'4',  type:'number' },
    { id:'sx',      label:'Separación X (m)', value:'1.0', type:'number' },
    { id:'sy',      label:'Separación Y (m)', value:'0.0', type:'number' },
    { id:'sz',      label:'Separación Z (m)', value:'0.0', type:'number' },
  ]);
  if (!res) return;
  const count = Math.max(1, Math.min(20, parseInt(res.count) || 0));
  const sx = parseFloat(res.sx) || 0, sy = parseFloat(res.sy) || 0, sz = parseFloat(res.sz) || 0;

  const pos = sel.getPosition();
  for (let i = 1; i <= count; i++) {
    const dup = _cloneBIM(sel); if (!dup) continue;
    sceneManager.addObject(dup);
    dup.setPosition(pos.x + sx * i, pos.y + sy * i, pos.z + sz * i);
  }
  showToast(`${count} copias (Array Lineal)`);
  pushUndo();
}

// ─── ARRAY POLAR ──────────────────────────────────────────────
async function arrayPolarSelected() {
  const sel = selectTool.selected;
  if (!sel) { showToast('Seleccione un elemento primero.', 2000); return; }
  const res = await openInputModal('Array Polar', [
    { id:'count', label:'Nº copias (2–36)', value:'6',   type:'number' },
    { id:'angle', label:'Ángulo total (°)', value:'360', type:'number' },
    { id:'axis',  label:'Eje (x/y/z)',      value:'y',   type:'text' },
  ]);
  if (!res) return;
  const count = Math.max(2, Math.min(36, parseInt(res.count) || 0));
  const totalDeg = parseFloat(res.angle) || 360;
  const axis = (res.axis || 'y').toLowerCase();
  const step = (totalDeg * Math.PI / 180) / (totalDeg === 360 ? count : (count - 1 || 1));

  const center = sel.getPosition().clone();
  for (let i = 1; i < count; i++) {
    const dup = _cloneBIM(sel); if (!dup) continue;
    sceneManager.addObject(dup);
    const a = step * i;
    const cos = Math.cos(a), sin = Math.sin(a);
    const p = sel.getPosition();
    const dx = p.x - center.x, dy = p.y - center.y, dz = p.z - center.z;
    let nx = p.x, ny = p.y, nz = p.z;
    if (axis === 'y')      { nx = center.x + dx * cos + dz * sin; nz = center.z - dx * sin + dz * cos; dup.mesh.rotation.y = (sel.mesh.rotation.y || 0) + a; }
    else if (axis === 'x') { ny = center.y + dy * cos - dz * sin; nz = center.z + dy * sin + dz * cos; dup.mesh.rotation.x = (sel.mesh.rotation.x || 0) + a; }
    else                   { nx = center.x + dx * cos - dy * sin; ny = center.y + dx * sin + dy * cos; dup.mesh.rotation.z = (sel.mesh.rotation.z || 0) + a; }
    dup.setPosition(nx, ny, nz);
  }
  showToast(`${count} copias polares (${totalDeg}° · eje ${axis.toUpperCase()})`);
  pushUndo();
}

// ─── ALIGN ────────────────────────────────────────────────────
function alignSelected(axis) {
  const pool = (selectTool.selectedSet && selectTool.selectedSet.size > 1)
    ? Array.from(selectTool.selectedSet)
    : (selectTool.selected ? [selectTool.selected] : []);
  if (pool.length < 2) { showToast('Selecciona 2+ objetos (Ctrl+click) para alinear.', 2500); return; }
  const comp = axis;
  const vals = pool.map(o => o.getPosition()[comp]);
  const target = vals.reduce((a, b) => a + b, 0) / vals.length;
  pool.forEach(o => {
    const p = o.getPosition();
    const nx = comp === 'x' ? target : p.x;
    const ny = comp === 'y' ? target : p.y;
    const nz = comp === 'z' ? target : p.z;
    o.setPosition(nx, ny, nz);
    o.mesh.updateMatrixWorld(true);
  });
  showToast(`Alineados ${pool.length} objetos en ${axis.toUpperCase()} = ${target.toFixed(3)}m`);
  pushUndo();
}

// ─── INPUT MODAL ──────────────────────────────────────────────
function openInputModal(title, fields) {
  return new Promise((resolve) => {
    let overlay = document.getElementById('input-modal-overlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'input-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card glass-panel">
        <div class="modal-title">${title}</div>
        <div class="modal-body">
          ${fields.map(f => `
            <label class="modal-row">
              <span>${f.label}</span>
              <input type="${f.type||'text'}" id="mod-${f.id}" value="${f.value||''}" />
            </label>`).join('')}
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" id="mod-cancel">Cancelar</button>
          <button class="btn-primary" id="mod-ok">Aceptar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = (val) => { overlay.remove(); resolve(val); };
    overlay.querySelector('#mod-cancel').onclick = () => close(null);
    overlay.querySelector('#mod-ok').onclick = () => {
      const out = {};
      fields.forEach(f => { out[f.id] = overlay.querySelector('#mod-'+f.id).value; });
      close(out);
    };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
    const first = overlay.querySelector('input');
    first?.focus(); first?.select();
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') overlay.querySelector('#mod-ok').click();
      if (e.key === 'Escape') close(null);
    });
  });
}

// ─── AUTOSAVE + RECENTS ───────────────────────────────────────
function _serializeScene() {
  proController?.resetTransientState({ refresh: false });
  return serializeProject(sceneManager.objects, {
    project: _currentProjectName,
    settings: { units: document.documentElement.dataset.units || 'metric' },
  });
}

function _deserializeScene(data) {
  if (!data || !Array.isArray(data.objects)) return 0;
  proController?.resetTransientState({ refresh: false });
  sceneManager.detachGizmo();
  selectTool.selectedSet.forEach(object => object.setSelected?.(false));
  selectTool.selectedSet.clear();
  selectTool.selected = null;
  propsPanel.update(null);
  updateMiniTransform(null);
  proController?.visualizer.clear();
  const restored = restoreProject(data, sceneManager);
  loadManager?.rebuildAll();
  if (data.project) {
    _currentProjectName = data.project;
    const nameInput = document.getElementById('project-name-input');
    if (nameInput) nameInput.value = data.project;
  }
  refreshWorkspace();
  return restored.length;
}

function _pushRecent(entry) {
  try {
    const list = JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]');
    const next = [entry, ...list.filter(x => x.project !== entry.project)].slice(0, 5);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch (_) {}
  _refreshRecentsDropdown();
}

function _refreshRecentsDropdown() {
  const el = document.getElementById('recents-dropdown');
  if (!el) return;
  const list = JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]');
  if (!list.length) { el.innerHTML = '<div class="recent-empty">Sin proyectos recientes</div>'; return; }
  el.innerHTML = list.map((r, i) => `
    <div class="recent-item" data-idx="${i}">
      <b>${r.project}</b><span>${new Date(r.date).toLocaleDateString()} · ${r.count} obj.</span>
    </div>`).join('');
  el.querySelectorAll('.recent-item').forEach(it => {
    it.addEventListener('click', () => {
      const idx = parseInt(it.dataset.idx);
      const r = list[idx];
      if (r?.data) { _deserializeScene(r.data); showToast(`Cargado: ${r.project}`); pushUndo(); }
    });
  });
}

// ─── SAVE / LOAD / EXPORT ─────────────────────────────────────
function saveProject() {
  const projectName = document.getElementById('project-name-input')?.value || 'Sin título';
  _currentProjectName = projectName;
  const payload = _serializeScene();
  payload.project = projectName;
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${projectName.replace(/\s+/g,'-')}.estructuras-pro.json`; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  _pushRecent({ project: projectName, date: payload.date, count: payload.objects.length, data: payload });
  showToast(`Guardado: ${projectName}.estructuras-pro.json`);
}

function loadProject() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,.estructuras-pro.json,.cometv.json,application/json';
  input.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const count = _deserializeScene(data);
      _undoStack = [captureState()];
      _undoPointer = 0;
      showToast(`Proyecto cargado: ${data.project || file.name} · ${count} objetos`);
    } catch (error) {
      console.error(error);
      showToast('El archivo no contiene un proyecto válido.', 3200);
    }
  });
  input.click();
}

function exportProject() {
  saveProject();
}

// ─── TOAST ────────────────────────────────────────────────────
function showToast(message, duration = 2000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 350);
  }, duration);
}
