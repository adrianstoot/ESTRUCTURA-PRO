/** Captures the editor's current camera view and exports it as an image. */
export class RenderStudio {
  constructor(sceneManager) {
    if (!sceneManager) throw new TypeError('RenderStudio requires SceneManager');
    this.sceneManager = sceneManager;
    this.host = null;
    this.previewUrl = null;
    this.lastBlob = null;
  }

  open() {
    this._ensureDOM();
    this.host.hidden = false;
    this.capture().catch(error => this._status(`No se pudo capturar la vista: ${error.message}`));
  }

  close() {
    if (this.host) this.host.hidden = true;
  }

  async capture() {
    const renderer = this.sceneManager.renderer;
    const image = this.host?.querySelector('[data-render-preview]');
    if (!renderer || !image) throw new Error('La vista 3D todavía no está disponible.');

    // Render synchronously before reading the drawing buffer so the image is the exact current camera view.
    renderer.render(this.sceneManager.scene, this.sceneManager.camera);
    const canvas = renderer.domElement;
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('El navegador no pudo codificar la imagen.')), 'image/png');
    });

    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = URL.createObjectURL(blob);
    this.lastBlob = blob;
    image.src = this.previewUrl;
    image.hidden = false;
    this.host.querySelector('[data-render-placeholder]').hidden = true;
    const exportLink = this.host.querySelector('[data-render-export]');
    exportLink.href = this.previewUrl;
    exportLink.download = 'ESTRUCTURAS-PRO-toma.png';
    exportLink.classList.remove('is-disabled');
    exportLink.removeAttribute('aria-disabled');
    exportLink.removeAttribute('tabindex');
    this._status('Toma capturada desde la vista actual.');
    return blob;
  }

  _ensureDOM() {
    if (this.host) return;
    this.host = document.createElement('div');
    this.host.className = 'render-studio';
    this.host.hidden = true;
    this.host.innerHTML = `
      <div class="render-studio__backdrop" data-action="backdrop">
        <section class="render-studio__panel" role="dialog" aria-modal="true" aria-label="Captura de vista">
          <header><span class="render-studio__logo">E</span><div><b>CAPTURA DE VISTA</b><small>ESTRUCTURAS PRO</small></div><button type="button" data-action="close" aria-label="Cerrar">×</button></header>
          <div class="render-studio__viewport">
            <div data-render-placeholder>La imagen capturada aparecerá aquí.</div>
            <img data-render-preview alt="Toma capturada de la vista actual" hidden>
          </div>
          <footer><span data-render-status>Lista para capturar.</span><div><button type="button" data-action="capture">Capturar toma</button><a class="primary is-disabled" data-render-export role="button" aria-label="Exportar imagen" aria-disabled="true" tabindex="-1">Exportar imagen</a></div></footer>
        </section>
      </div>`;
    document.body.appendChild(this.host);
    this.host.querySelector('[data-render-export]').addEventListener('click', event => {
      if (!this.lastBlob) {
        event.preventDefault();
        this.capture().catch(error => this._status(error.message));
        return;
      }
      this._status('Descarga de la toma iniciada.');
    });
    this.host.addEventListener('click', event => {
      const target = event.target.closest('button,[data-action="backdrop"]');
      if (!target) return;
      const action = target.dataset.action;
      if (action === 'close' || (action === 'backdrop' && event.target === target)) this.close();
      if (action === 'capture') this.capture().catch(error => this._status(error.message));
    });
    this.host.addEventListener('keydown', event => { if (event.key === 'Escape') this.close(); });
  }

  _status(message) {
    const label = this.host?.querySelector('[data-render-status]');
    if (label) label.textContent = message;
  }
}
