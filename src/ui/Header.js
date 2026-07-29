import { icon, brandLogo } from './icons.js';

/**
 * Header — Premium top bar with project name, actions, user info.
 */
export class Header {
  constructor(el) {
    this.el = el;
    this.userName = '';
    this.onThemeToggle = null;
    this.onSave = null;
    this.onExport = null;
    this.onLoad = null;
    this._dark = true;
    this._render();
  }

  _render() {
    this.el.innerHTML = `
      <div class="header-brand">
        <div class="header-logo">${brandLogo(30)}</div>
        <div>
          <div class="header-title">ESTRUCTURAS <span>PRO</span></div>
          <div class="header-subtitle">STEEL DESIGN · CÓDIGO ESTRUCTURAL</div>
        </div>
      </div>

      <div class="header-project-area">
        <span class="header-project-label">ESTRUCTURAS PRO —</span>
        <input type="text" id="project-name-input" value="Sin título" placeholder="Nombre del proyecto…" spellcheck="false">
        <span class="header-view-context">— VISTA 3D: GENERAL</span>
      </div>

      <div class="header-actions">
        <button class="header-btn" id="btn-new" title="Nuevo proyecto">
          ${icon('filePlus', 14)}<span>Nuevo</span>
        </button>
        <div class="header-menu-wrap">
          <button class="header-btn" id="btn-load" title="Abrir proyecto">
            ${icon('folder', 14)}<span>Abrir</span>
            ${icon('chevDown', 12)}
          </button>
          <div class="header-menu hidden" id="header-load-menu">
            <div class="header-menu-item" data-action="load-file">${icon('upload', 12)}<span>Desde archivo…</span></div>
            <div class="header-menu-sep"></div>
            <div class="header-menu-label">Recientes</div>
            <div id="recents-dropdown"></div>
          </div>
        </div>
        <button class="header-btn primary" id="btn-save" title="Guardar (Ctrl+S)">
          ${icon('save', 14)}<span>Guardar</span>
        </button>
        <button class="header-btn" id="btn-export" title="Exportar proyecto">
          ${icon('download', 14)}<span>Exportar</span>
        </button>

        <div class="header-sep"></div>
        <button class="header-btn header-btn-accent" id="btn-tut" title="Módulo didáctico ETSIE">
          ${icon('graduation', 14)}<span>Tutoría</span>
        </button>

        <div class="header-sep"></div>

        <button class="header-btn header-btn-icon" id="btn-cmd" title="Paleta de comandos (Ctrl+K)">
          ${icon('terminal', 15)}
        </button>
        <button class="header-btn header-btn-icon" id="btn-theme" title="Alternar tema claro / oscuro">
          ${icon('theme', 15)}
        </button>

        <div class="header-sep"></div>

        <div class="header-user-badge" id="user-badge">
          <div class="header-user-dot"></div>
          <span id="header-user-name">—</span>
        </div>
        <div class="header-window-controls" aria-label="Controles de ventana">
          <button type="button" id="editor-window-min" title="Minimizar interfaz" aria-label="Minimizar">—</button>
          <button type="button" id="editor-window-max" title="Maximizar" aria-label="Maximizar">□</button>
          <button type="button" id="editor-window-close" title="Cerrar" aria-label="Cerrar">×</button>
        </div>
      </div>
    `;

    this.el.querySelector('#btn-theme').addEventListener('click', () => {
      this.setTheme(!this._dark);
    });
    this.el.querySelector('#btn-save').addEventListener('click', () => this.onSave?.());
    this.el.querySelector('#btn-export').addEventListener('click', () => this.onExport?.());
    this.el.querySelector('#btn-new').addEventListener('click', () => this.onNew?.());
    this.el.querySelector('#btn-cmd').addEventListener('click', () => {
      document.getElementById('command-palette-overlay')?.classList.remove('hidden');
      document.getElementById('cp-input')?.focus();
    });
    this.el.querySelector('#btn-tut')?.addEventListener('click', () => this.onTutorialToggle?.());
    this.el.querySelector('#editor-window-min')?.addEventListener('click', () => {
      if (window.electronAPI?.minimizeWindow) window.electronAPI.minimizeWindow();
      else document.documentElement.classList.toggle('ui-chrome-hidden');
    });
    this.el.querySelector('#editor-window-max')?.addEventListener('click', async () => {
      if (window.electronAPI?.toggleMaximize) await window.electronAPI.toggleMaximize();
      else if (document.fullscreenElement) await document.exitFullscreen?.();
      else await document.documentElement.requestFullscreen?.();
    });
    this.el.querySelector('#editor-window-close')?.addEventListener('click', () => {
      if (window.electronAPI?.closeWindow) window.electronAPI.closeWindow();
      else window.location.reload();
    });

    // Dropdown: Abrir
    const loadBtn = this.el.querySelector('#btn-load');
    const loadMenu = this.el.querySelector('#header-load-menu');
    loadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      loadMenu.classList.toggle('hidden');
    });
    loadMenu.querySelector('[data-action="load-file"]').addEventListener('click', () => {
      loadMenu.classList.add('hidden');
      this.onLoad?.();
    });
    document.addEventListener('click', (e) => {
      if (!loadMenu.contains(e.target) && e.target !== loadBtn) {
        loadMenu.classList.add('hidden');
      }
    });
  }

  setTheme(dark, { notify = true } = {}) {
    this._dark = !!dark;
    const button = this.el.querySelector('#btn-theme');
    button?.setAttribute('aria-pressed', String(!this._dark));
    button?.setAttribute('data-theme', this._dark ? 'dark' : 'light');
    if (notify) this.onThemeToggle?.(this._dark);
    return this._dark;
  }

  setUser(name) {
    this.userName = name;
    const el = document.getElementById('header-user-name');
    if (el) el.textContent = name || '—';
  }
}
