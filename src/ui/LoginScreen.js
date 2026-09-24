import './pro-upgrade.css';
import { icon, brandLogo } from './icons.js';

const SETTINGS_KEY = 'estructuras-pro:settings:v1';
const DEFAULT_SETTINGS = Object.freeze({
  units: 'metric',
  interfaceTheme: 'dark',
  snapPrecision: '10',
  autosave: true,
  reducedMotion: false,
});

export class LoginScreen {
  constructor(onSuccess) {
    this.onSuccess = onSuccess;
    this.settings = this._readSettings();
    this.launchContext = { mode: 'new', action: 'new-project', project: null, file: null };
    this.overlay = null;
    this.lastFocus = null;
    this.minimized = false;
    this._render();
  }

  _render() {
    document.getElementById('login-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'login-overlay';
    overlay.className = 'ep0-overlay';
    overlay.dataset.reducedMotion = String(this.settings.reducedMotion);
    overlay.style.setProperty('--ep0-splash-image', `url("${import.meta.env.BASE_URL}estructuras-pro-splash.png")`);
    overlay.innerHTML = `
      <div class="ep0-background" aria-hidden="true"></div>
      <div class="ep0-window-controls" aria-label="Controles de ventana">
        <span class="ep0-mini-label" aria-hidden="true">ESTRUCTURAS PRO</span>
        <button type="button" class="ep0-window-btn" id="ep0-minimize" aria-label="Minimizar ventana" title="Minimizar">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>
        </button>
        <button type="button" class="ep0-window-btn ep0-window-close" id="ep0-close-app" aria-label="Cerrar aplicación" title="Cerrar">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>

      <main class="ep0-shell">
        <section class="ep0-content" aria-labelledby="ep0-title">
          <header class="ep0-brand">
            <div class="ep0-logo">${brandLogo(156)}</div>
            <h1 id="ep0-title"><span>ESTRUCTURAS</span> <strong>PRO</strong></h1>
            <p>Diseño, análisis y detallado<br>de estructuras metálicas</p>
          </header>

          <nav class="ep0-launch-actions" aria-label="Inicio de proyecto">
            <button type="button" class="ep0-launch-card is-selected" data-mode="new" aria-pressed="true">
              <span class="ep0-launch-icon">${icon('filePlus', 58)}</span><span>Nuevo proyecto</span>
            </button>
            <button type="button" class="ep0-launch-card" data-mode="load" aria-pressed="false">
              <span class="ep0-launch-icon">${icon('folder', 58)}</span><span>Cargar proyecto</span>
            </button>
            <button type="button" class="ep0-launch-card" id="ep0-settings">
              <span class="ep0-launch-icon">${icon('settings', 58)}</span><span>Ajustes</span>
            </button>
          </nav>
          <div class="ep0-project-status" id="ep0-project-status" role="status" aria-live="polite"></div>

          <form class="ep0-login-form" id="ep0-form" autocomplete="on" novalidate>
            <div class="ep0-field">
              <label class="ep0-field-icon" for="ep0-user">${icon('user', 25)}<span class="sr-only">Usuario</span></label>
              <input id="ep0-user" name="username" type="text" placeholder="Usuario"
                autocomplete="username" spellcheck="false" aria-describedby="ep0-error">
            </div>
            <div class="ep0-field">
              <label class="ep0-field-icon" for="ep0-password">${icon('lock', 25)}<span class="sr-only">Contraseña</span></label>
              <input id="ep0-password" name="password" type="password" placeholder="Contraseña"
                autocomplete="current-password" inputmode="numeric" aria-describedby="ep0-error ep0-caps">
              <span id="ep0-caps" class="ep0-caps hidden" role="status">Bloq Mayús</span>
              <button type="button" class="ep0-password-toggle" id="ep0-show-password"
                aria-label="Mostrar contraseña" aria-pressed="false" title="Mostrar contraseña">${icon('eyeOff', 23)}</button>
            </div>
            <div class="ep0-login-error" id="ep0-error" role="alert" aria-live="assertive"></div>
            <button type="submit" class="ep0-login-submit" id="ep0-submit"><span>Iniciar sesión</span></button>
            <button type="button" class="ep0-recovery-link" id="ep0-recover">¿Olvidaste tu contraseña?</button>
          </form>
        </section>

        <footer class="ep0-footer-links">
          <button type="button" id="ep0-help">${icon('info', 25)}<span>Ayuda</span></button>
          <button type="button" id="ep0-about">${icon('info', 25)}<span>Acerca de</span></button>
        </footer>
      </main>

      <section class="ep0-closed-state" aria-labelledby="ep0-closed-title">
        <div class="ep0-closed-logo">${brandLogo(72)}</div>
        <h2 id="ep0-closed-title">ESTRUCTURAS PRO</h2>
        <p>La pantalla de inicio se ha cerrado.</p>
        <button type="button" id="ep0-restore-closed">Restaurar aplicación</button>
      </section>

      <input id="ep0-file" class="ep0-file-input" type="file"
        accept=".json,.cometv.json,application/json" tabindex="-1" aria-hidden="true">

      <div class="ep0-modal-backdrop hidden" id="ep0-dialog-backdrop">
        <section class="ep0-modal" role="dialog" aria-modal="true"
          aria-labelledby="ep0-dialog-title" aria-describedby="ep0-dialog-body">
          <header class="ep0-modal-header">
            <div><span class="ep0-modal-eyebrow">ESTRUCTURAS PRO</span><h2 id="ep0-dialog-title"></h2></div>
            <button type="button" id="ep0-dialog-close" aria-label="Cerrar diálogo">${icon('x', 20)}</button>
          </header>
          <div class="ep0-modal-body" id="ep0-dialog-body"></div>
        </section>
      </div>
    `;
    document.body.appendChild(overlay);
    this.overlay = overlay;
    this._bind();
    window.setTimeout(() => overlay.querySelector('#ep0-user')?.focus(),
      this.settings.reducedMotion ? 0 : 160);
  }

  _bind() {
    const q = (selector) => this.overlay.querySelector(selector);
    const password = q('#ep0-password');
    const caps = q('#ep0-caps');
    const fileInput = q('#ep0-file');
    const backdrop = q('#ep0-dialog-backdrop');

    q('[data-mode="new"]').addEventListener('click', () => this._selectMode('new'));
    q('[data-mode="load"]').addEventListener('click', () => {
      fileInput.value = '';
      fileInput.click();
    });
    fileInput.addEventListener('change', () => {
      const [file] = fileInput.files || [];
      if (file) this._loadProject(file);
    });
    q('#ep0-settings').addEventListener('click', () => this._openDialog('settings'));
    q('#ep0-recover').addEventListener('click', () => this._openDialog('recover'));
    q('#ep0-help').addEventListener('click', () => this._openDialog('help'));
    q('#ep0-about').addEventListener('click', () => this._openDialog('about'));
    q('#ep0-dialog-close').addEventListener('click', () => this._closeDialog());
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) this._closeDialog();
    });
    backdrop.addEventListener('keydown', (event) => this._trapDialogFocus(event));

    const detectCaps = (event) => caps.classList.toggle('hidden', !event.getModifierState?.('CapsLock'));
    password.addEventListener('keydown', detectCaps);
    password.addEventListener('keyup', detectCaps);

    q('#ep0-show-password').addEventListener('click', (event) => {
      const reveal = password.type === 'password';
      password.type = reveal ? 'text' : 'password';
      event.currentTarget.innerHTML = icon(reveal ? 'eye' : 'eyeOff', 23);
      event.currentTarget.setAttribute('aria-pressed', String(reveal));
      event.currentTarget.setAttribute('aria-label', reveal ? 'Ocultar contraseña' : 'Mostrar contraseña');
      event.currentTarget.title = reveal ? 'Ocultar contraseña' : 'Mostrar contraseña';
      password.focus();
    });

    q('#ep0-form').addEventListener('submit', (event) => {
      event.preventDefault();
      this._login(q('#ep0-user'), password);
    });
    q('#ep0-minimize').addEventListener('click', () => this._toggleMinimize());
    q('#ep0-close-app').addEventListener('click', () => this._closeApp());
    q('#ep0-restore-closed').addEventListener('click', () => this._restore());
    this.overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !backdrop.classList.contains('hidden')) {
        event.preventDefault();
        this._closeDialog();
      }
    });
  }

  _selectMode(mode) {
    const load = mode === 'load';
    this.launchContext = {
      mode,
      action: load ? 'load-project' : 'new-project',
      project: load ? this.launchContext.project : null,
      file: load ? this.launchContext.file : null,
    };
    this.overlay.querySelectorAll('[data-mode]').forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle('is-selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (!load) this._notice('Nuevo proyecto seleccionado');
  }

  _loadProject(file) {
    if (file.size > 25 * 1024 * 1024) {
      this._notice('El archivo supera el límite de 25 MB.', true);
      return;
    }
    this._notice(`Leyendo ${file.name}…`);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || ''));
        if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.objects)) {
          throw new Error('El archivo no contiene un proyecto de ESTRUCTURAS PRO válido.');
        }
        this.launchContext = {
          mode: 'load',
          action: 'load-project',
          project: data,
          file: { name: file.name, size: file.size, lastModified: file.lastModified },
        };
        this._selectMode('load');
        const name = typeof data.project === 'string' && data.project.trim()
          ? data.project.trim()
          : file.name.replace(/\.(cometv\.)?json$/i, '');
        this._notice(`Proyecto preparado: ${name}`);
        this.overlay.querySelector('#ep0-user').focus();
      } catch (error) {
        this._notice(error?.message || 'No se ha podido leer el proyecto.', true);
      }
    };
    reader.onerror = () => this._notice('No se ha podido leer el archivo seleccionado.', true);
    reader.readAsText(file, 'utf-8');
  }

  _notice(message, error = false) {
    const status = this.overlay.querySelector('#ep0-project-status');
    status.textContent = message;
    status.classList.toggle('is-error', error);
  }

  _login(userInput, passwordInput) {
    const error = this.overlay.querySelector('#ep0-error');
    error.textContent = '';
    passwordInput.removeAttribute('aria-invalid');
    if (passwordInput.value !== '4444') {
      error.textContent = passwordInput.value
        ? 'La contraseña no es correcta.'
        : 'Introduce tu contraseña para continuar.';
      passwordInput.setAttribute('aria-invalid', 'true');
      passwordInput.classList.remove('ep0-shake');
      void passwordInput.offsetWidth;
      passwordInput.classList.add('ep0-shake');
      passwordInput.select();
      passwordInput.focus();
      return;
    }

    const user = userInput.value.trim() || 'Ingeniero';
    const submit = this.overlay.querySelector('#ep0-submit');
    submit.disabled = true;
    submit.querySelector('span').textContent = 'Preparando el editor…';
    const context = { ...this.launchContext, settings: { ...this.settings } };
    this.overlay.classList.add('ep0-exit');
    window.setTimeout(() => {
      this.overlay?.remove();
      this.overlay = null;
      this.onSuccess?.(user, context);
    }, this.settings.reducedMotion ? 0 : 340);
  }

  _openDialog(kind) {
    const backdrop = this.overlay.querySelector('#ep0-dialog-backdrop');
    const title = this.overlay.querySelector('#ep0-dialog-title');
    const body = this.overlay.querySelector('#ep0-dialog-body');
    this.lastFocus = document.activeElement;

    const content = {
      recover: {
        title: 'Recuperar acceso',
        html: `<p>Introduce el correo asociado a tu licencia.</p>
          <form class="ep0-dialog-form" id="ep0-recovery-form">
            <label for="ep0-email">Correo electrónico</label>
            <input id="ep0-email" type="email" autocomplete="email" required placeholder="ingenieria@empresa.com">
            <p class="ep0-dialog-note">Modo demostración: usa la clave <strong>4444</strong>.</p>
            <div class="ep0-dialog-status" id="ep0-recovery-status" role="status" aria-live="polite"></div>
            <div class="ep0-dialog-actions"><button type="button" class="ep0-btn-secondary" data-dialog-close>Cancelar</button><button type="submit" class="ep0-btn-primary">Enviar instrucciones</button></div>
          </form>`,
      },
      help: {
        title: 'Ayuda',
        html: `<div class="ep0-info-block"><h3>Primeros pasos</h3><ol>
          <li>Elige Nuevo proyecto o carga un archivo JSON.</li>
          <li>Introduce tu usuario y la clave de acceso.</li>
          <li>Configura unidades y guardado desde Ajustes.</li>
          </ol><p>Atajos: <kbd>Ctrl</kbd> + <kbd>S</kbd> para guardar y <kbd>Ctrl</kbd> + <kbd>K</kbd> para comandos.</p></div>
          <div class="ep0-dialog-actions"><button type="button" class="ep0-btn-primary" data-dialog-close>Entendido</button></div>`,
      },
      about: {
        title: 'Acerca de',
        html: `<div class="ep0-about"><div class="ep0-about-logo">${brandLogo(64)}</div><div><h3>ESTRUCTURAS PRO</h3><p>Diseño, análisis y detallado profesional de estructuras metálicas.</p></div></div>
          <dl class="ep0-about-grid"><div><dt>Edición</dt><dd>Professional</dd></div><div><dt>Normativa</dt><dd>Código Estructural · RD 470/2021</dd></div><div><dt>Motor gráfico</dt><dd>Three.js</dd></div></dl>
          <div class="ep0-dialog-actions"><button type="button" class="ep0-btn-primary" data-dialog-close>Cerrar</button></div>`,
      },
    };

    if (kind === 'settings') {
      title.textContent = 'Ajustes';
      body.innerHTML = this._settingsHtml();
    } else {
      title.textContent = content[kind].title;
      body.innerHTML = content[kind].html;
    }
    backdrop.classList.remove('hidden');
    this._bindDialog(kind);
    window.setTimeout(() => body.querySelector('input, select, button')?.focus(), 0);
  }

  _bindDialog(kind) {
    const backdrop = this.overlay.querySelector('#ep0-dialog-backdrop');
    backdrop.querySelectorAll('[data-dialog-close]').forEach((button) =>
      button.addEventListener('click', () => this._closeDialog()));

    if (kind === 'settings') {
      backdrop.querySelector('#ep0-settings-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        this.settings = {
          units: String(data.get('units') || 'metric'),
          interfaceTheme: String(data.get('interfaceTheme') || 'dark'),
          snapPrecision: String(data.get('snapPrecision') || '10'),
          autosave: data.get('autosave') === 'on',
          reducedMotion: data.get('reducedMotion') === 'on',
        };
        this._saveSettings();
        this.overlay.dataset.reducedMotion = String(this.settings.reducedMotion);
        this._closeDialog();
        this._notice('Ajustes guardados');
      });
      backdrop.querySelector('#ep0-reset-settings').addEventListener('click', () => {
        this.settings = { ...DEFAULT_SETTINGS };
        this._saveSettings();
        this.overlay.dataset.reducedMotion = 'false';
        this._closeDialog();
        this._notice('Ajustes restablecidos');
      });
    }

    if (kind === 'recover') {
      backdrop.querySelector('#ep0-recovery-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const email = backdrop.querySelector('#ep0-email');
        if (!email.checkValidity()) return email.reportValidity();
        backdrop.querySelector('#ep0-recovery-status').textContent =
          'Solicitud preparada. Revisa tu correo para continuar.';
        event.currentTarget.querySelector('[type="submit"]').disabled = true;
      });
    }
  }

  _settingsHtml() {
    const selected = (current, value) => current === value ? 'selected' : '';
    const checked = (value) => value ? 'checked' : '';
    return `<form class="ep0-dialog-form" id="ep0-settings-form">
      <div class="ep0-setting-row"><label for="ep0-units">Sistema de unidades</label><select id="ep0-units" name="units"><option value="metric" ${selected(this.settings.units, 'metric')}>Métrico · m, mm, kN</option></select></div>
      <div class="ep0-setting-row"><label for="ep0-theme">Tema del editor</label><select id="ep0-theme" name="interfaceTheme"><option value="dark" ${selected(this.settings.interfaceTheme, 'dark')}>Oscuro técnico</option><option value="system" ${selected(this.settings.interfaceTheme, 'system')}>Configuración del sistema</option></select></div>
      <div class="ep0-setting-row"><label for="ep0-snap">Precisión de captura</label><select id="ep0-snap" name="snapPrecision"><option value="5" ${selected(this.settings.snapPrecision, '5')}>5 mm · Alta precisión</option><option value="10" ${selected(this.settings.snapPrecision, '10')}>10 mm · Recomendada</option><option value="25" ${selected(this.settings.snapPrecision, '25')}>25 mm · Croquis rápido</option></select></div>
      <label class="ep0-check-row"><input type="checkbox" name="autosave" ${checked(this.settings.autosave)}><span>Activar guardado automático</span></label>
      <label class="ep0-check-row"><input type="checkbox" name="reducedMotion" ${checked(this.settings.reducedMotion)}><span>Reducir animaciones</span></label>
      <div class="ep0-dialog-actions ep0-dialog-actions-split"><button type="button" class="ep0-btn-quiet" id="ep0-reset-settings">Restablecer</button><div><button type="button" class="ep0-btn-secondary" data-dialog-close>Cancelar</button><button type="submit" class="ep0-btn-primary">Guardar ajustes</button></div></div>
    </form>`;
  }

  _closeDialog() {
    const backdrop = this.overlay?.querySelector('#ep0-dialog-backdrop');
    if (!backdrop || backdrop.classList.contains('hidden')) return;
    backdrop.classList.add('hidden');
    this.lastFocus?.focus?.();
    this.lastFocus = null;
  }

  _trapDialogFocus(event) {
    if (event.key !== 'Tab') return;
    const nodes = Array.from(event.currentTarget.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled])'
    )).filter((node) => node.offsetParent !== null);
    if (!nodes.length) return;
    if (event.shiftKey && document.activeElement === nodes[0]) {
      event.preventDefault();
      nodes.at(-1).focus();
    } else if (!event.shiftKey && document.activeElement === nodes.at(-1)) {
      event.preventDefault();
      nodes[0].focus();
    }
  }

  _readSettings() {
    try {
      const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return { ...DEFAULT_SETTINGS, ...(value && typeof value === 'object' ? value : {}), units: 'metric' };
    } catch (_) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  _saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (_) {
      // La pantalla permanece operativa sin almacenamiento.
    }
  }

  _toggleMinimize() {
    if (this.minimized) return this._restore();
    if (this._hostAction('minimize')) return;
    this.minimized = true;
    this.overlay.classList.add('is-minimized');
    const button = this.overlay.querySelector('#ep0-minimize');
    button.setAttribute('aria-label', 'Restaurar ventana');
    button.title = 'Restaurar';
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12"/></svg>';
  }

  _closeApp() {
    if (this._hostAction('close')) return;
    this.minimized = false;
    this.overlay.classList.remove('is-minimized');
    this.overlay.classList.add('is-closed');
    this.overlay.querySelector('#ep0-restore-closed').focus();
  }

  _restore() {
    this.minimized = false;
    this.overlay.classList.remove('is-minimized', 'is-closed');
    const button = this.overlay.querySelector('#ep0-minimize');
    button.setAttribute('aria-label', 'Minimizar ventana');
    button.title = 'Minimizar';
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>';
    this.overlay.querySelector('#ep0-user').focus();
  }

  _hostAction(action) {
    const methods = {
      minimize: ['minimize', 'minimizeWindow'],
      close: ['close', 'closeWindow', 'quit'],
    };
    const hosts = [window.electronAPI, window.desktopAPI, window.appWindow, window.hostAPI].filter(Boolean);
    for (const host of hosts) {
      for (const name of methods[action] || []) {
        if (typeof host[name] === 'function') {
          try {
            host[name]();
            return true;
          } catch (_) {
            // Prueba el siguiente puente.
          }
        }
      }
    }
    if (window.chrome?.webview?.postMessage) {
      try {
        window.chrome.webview.postMessage({ source: 'estructuras-pro', type: 'window-control', action });
        return true;
      } catch (_) {
        return false;
      }
    }
    return false;
  }
}
