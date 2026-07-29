const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

const isFiniteValue = value =>
  value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

const fmt = (value, digits = 2) => isFiniteValue(value)
  ? Number(value).toLocaleString('es-ES', { maximumFractionDigits: digits })
  : '—';

const statusLabel = { PASS: 'CUMPLE', WARN: 'REVISAR', FAIL: 'NO CUMPLE', NOT_CHECKED: 'SIN VERIFICAR' };
const statusRank = { PASS: 0, WARN: 1, NOT_CHECKED: 2, FAIL: 3 };

export class ReportGenerator {
  constructor({ getProjectName, getObjects, toast } = {}) {
    this.getProjectName = getProjectName || (() => 'Sin título');
    this.getObjects = getObjects || (() => []);
    this.toast = toast || (() => {});
  }

  createModel() {
    const sourceObjects = this.getObjects();
    const objects = Array.isArray(sourceObjects) ? sourceObjects : [];
    const profiles = objects.filter(item => item.type === 'profile');
    const plates = objects.filter(item => item.type === 'plate');
    const fasteners = objects.filter(item => item.type === 'fastener');
    const welds = objects.filter(item => item.type === 'weld');
    const steelKg = [...profiles, ...plates].reduce((sum, item) => sum + (Number(item.mass) || 0), 0);
    const profileMetres = profiles.reduce((sum, item) => sum + (Number(item.params?.length) || 0), 0);
    const weldMetres = welds.reduce((sum, item) => {
      const a = item.pointA, b = item.pointB;
      return sum + (a?.distanceTo?.(b) || 0);
    }, 0);
    const calculationGroupKey = item => item.analysisResults?.calculationGroupId ||
      item.params?.boltGroup?.id || item.params?.boltGroupId || null;
    const groupRepresentatives = new Map();
    objects.forEach(item => {
      if (!item.analysisResults) return;
      const key = calculationGroupKey(item);
      if (!key) return;
      const current = groupRepresentatives.get(key);
      if (!current || (item.type === 'plate' && current.type !== 'plate')) groupRepresentatives.set(key, item);
    });
    const seenCalculationGroups = new Set();
    const checks = objects.flatMap(item => {
      const result = item.analysisResults;
      if (!result) return [];
      const groupId = calculationGroupKey(item);
      if (groupId && groupRepresentatives.get(groupId) !== item) return [];
      if (groupId && seenCalculationGroups.has(groupId)) return [];
      if (groupId) seenCalculationGroups.add(groupId);
      const rows = Array.isArray(result.checks) ? result.checks : [];
      return rows.map(check => ({ object: item, result, check }));
    });
    const governing = checks.reduce((current, row) => {
      const value = row.check.ratio;
      if (
        row.check.status === 'NOT_CHECKED' ||
        row.check.required === false ||
        row.check.applicable === false ||
        !isFiniteValue(value)
      ) return current;
      const ratio = Number(value);
      return !current || ratio > current.ratio ? { ...row, ratio } : current;
    }, null);
    const globalStatus = objects.length
      ? objects.reduce((status, item) => {
        const requested = item.analysisResults?.status || 'NOT_CHECKED';
        const next = Object.hasOwn(statusRank, requested) ? requested : 'NOT_CHECKED';
        return statusRank[next] > statusRank[status] ? next : status;
      }, 'PASS')
      : 'NOT_CHECKED';
    return {
      projectName: this.getProjectName(),
      generatedAt: new Date(), objects, profiles, plates, fasteners, welds, checks, governing, globalStatus,
      quantities: { steelKg, profileMetres, boltCount: fasteners.filter(item => item.params?.subtype === 'bolt' || item.params?.subtype === 'anchor').length, weldMetres },
    };
  }

  renderHtml(model = this.createModel()) {
    const { projectName, generatedAt, objects, checks, governing, quantities } = model;
    const globalStatus = statusLabel[model.globalStatus] ? model.globalStatus : 'NOT_CHECKED';
    const objectRows = objects.map(item => `
      <tr><td>${escapeHtml(item.id)}</td><td>${escapeHtml(item.designation || item.type)}</td><td>${escapeHtml(item.params?.role || '—')}</td>
      <td>${fmt(item.mass)} kg</td><td><span class="status ${escapeHtml(item.analysisResults?.status || 'NOT_CHECKED')}">${statusLabel[item.analysisResults?.status] || 'SIN VERIFICAR'}</span></td></tr>`).join('');
    const checkRows = checks.length ? checks.map(({ object, result, check }) => `
      <article class="check-card ${escapeHtml(check.status || result.status || 'NOT_CHECKED')}">
        <header><div><span class="check-object">${escapeHtml(object.designation)}</span><h3>${escapeHtml(check.label || check.id)}</h3></div>
          <span class="ratio">η ${fmt(check.ratio, 3)}</span></header>
        <div class="check-grid"><span>Solicitación <b>${fmt(check.demand)} ${escapeHtml(check.unit || '')}</b></span><span>Resistencia <b>${fmt(check.resistance)} ${escapeHtml(check.unit || '')}</b></span><span>Estado <b>${escapeHtml(statusLabel[check.status] || check.status || 'SIN VERIFICAR')}</b></span></div>
        ${check.formula ? `<code>${escapeHtml(check.formula)}</code>` : ''}
        ${check.substitution ? `<p class="substitution">${escapeHtml(check.substitution)}</p>` : ''}
        ${check.clause ? `<small>${escapeHtml(check.clause)}</small>` : ''}
      </article>`).join('') : '<p class="empty">No hay comprobaciones ejecutadas. Los elementos permanecen sin verificar.</p>';
    const warnings = [...new Set(objects.flatMap(item => (item.analysisResults?.warnings || []).map(warning => warning?.message || String(warning))))];

    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Memoria justificativa · ${escapeHtml(projectName)}</title><style>
      :root{font-family:Inter,Arial,sans-serif;color:#182231;background:#edf1f6}*{box-sizing:border-box}body{margin:0}.page{width:min(1100px,calc(100% - 40px));margin:24px auto;background:white;box-shadow:0 12px 45px #0d1b2a26}.cover{min-height:380px;padding:64px;background:linear-gradient(135deg,#111b29,#1b2b43);color:white;display:flex;flex-direction:column;justify-content:space-between}.brand{letter-spacing:.24em;font-size:13px}.brand b{color:#4b8cff}.cover h1{font-size:42px;line-height:1.05;margin:12px 0}.cover p{color:#aebdd0}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#ffffff26}.meta span{padding:16px;background:#132033}.content{padding:48px 64px}h2{font-size:22px;border-bottom:2px solid #e4e9f0;padding-bottom:10px;margin-top:38px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.kpi{padding:18px;border:1px solid #dfe5ed;background:#f8fafc}.kpi b{display:block;font-size:24px;color:#2166d1}.kpi span{font-size:11px;color:#69778a;text-transform:uppercase;letter-spacing:.08em}table{width:100%;border-collapse:collapse;font-size:12px}th{text-align:left;background:#eef3f8;color:#526175}th,td{padding:10px;border-bottom:1px solid #e4e9f0}.status{font-size:9px;font-weight:800;padding:4px 7px;border-radius:10px}.PASS{--state:#16865a}.WARN{--state:#b67608}.FAIL{--state:#c2363c}.NOT_CHECKED{--state:#718096}.status{color:var(--state);background:color-mix(in srgb,var(--state) 12%,white)}.check-card{border:1px solid #dfe5ed;border-left:4px solid var(--state);padding:16px;margin:12px 0;break-inside:avoid}.check-card header{display:flex;justify-content:space-between;gap:16px}.check-card h3{margin:3px 0 12px}.check-object{font-size:10px;color:#69778a}.ratio{font-size:18px;font-weight:800;color:var(--state)}.check-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.check-grid span{background:#f7f9fc;padding:8px;font-size:11px}.check-grid b{display:block;margin-top:3px}code{display:block;padding:10px;margin-top:10px;background:#172232;color:#e3ebf7;white-space:normal}.substitution{font:11px/1.5 monospace;color:#566578}.warning{padding:12px 14px;background:#fff5df;border-left:3px solid #d48a14;margin:8px 0}.legal{padding:16px;background:#f3f5f8;color:#59687b;font-size:10px;line-height:1.55}.empty{padding:20px;background:#f5f7fa;color:#69778a}@media print{body{background:white}.page{width:100%;margin:0;box-shadow:none}.print-actions{display:none}.cover{break-after:page}.content{padding:35px 45px}}@page{size:A4;margin:12mm}
      </style></head><body><main class="page">
      <section class="cover"><div><div class="brand">ESTRUCTURAS <b>PRO</b></div><h1>Memoria<br>justificativa</h1><p>Diseño, análisis y detallado de estructuras metálicas</p></div>
        <div class="meta"><span><small>PROYECTO</small><br><b>${escapeHtml(projectName)}</b></span><span><small>FECHA</small><br><b>${generatedAt.toLocaleDateString('es-ES')}</b></span><span><small>NORMA</small><br><b>Código Estructural · RD 470/2021 · Anejos 22/26</b></span></div></section>
      <section class="content"><h2>Resumen de mediciones</h2><div class="kpis">
        <div class="kpi"><b>${fmt(quantities.steelKg,1)}</b><span>kg de acero</span></div><div class="kpi"><b>${fmt(quantities.profileMetres,1)}</b><span>m de perfiles</span></div>
        <div class="kpi"><b>${quantities.boltCount}</b><span>tornillos / pernos</span></div><div class="kpi"><b>${fmt(quantities.weldMetres,2)}</b><span>m de soldadura</span></div></div>
      <h2>Estado global</h2><p><span class="status ${globalStatus}">${statusLabel[globalStatus]}</span> · ${governing ? `Comprobación gobernante: <b>${escapeHtml(governing.object.designation)} · ${escapeHtml(governing.check.label)}</b>, η = <b>${fmt(governing.ratio,3)}</b>.` : 'El proyecto no dispone de una comprobación numérica gobernante.'}</p>
      <h2>Inventario del modelo</h2><table><thead><tr><th>ID</th><th>Elemento</th><th>Función</th><th>Masa</th><th>Verificación</th></tr></thead><tbody>${objectRows || '<tr><td colspan="5">Modelo vacío</td></tr>'}</tbody></table>
      <h2>Comprobaciones ELU / ELS</h2>${checkRows}
      ${warnings.length ? `<h2>Hipótesis y advertencias</h2>${warnings.map(w => `<p class="warning">${escapeHtml(w)}</p>`).join('')}` : ''}
      <h2>Alcance y responsabilidad</h2><div class="legal">Documento generado por ESTRUCTURAS PRO. Las verificaciones identificadas como estimadas o no comprobadas requieren revisión independiente. El informe no sustituye el proyecto, firma ni criterio de un técnico competente. Deben validarse el modelo resistente, las combinaciones, el Anejo Nacional, las condiciones de apoyo y los detalles constructivos antes de fabricación.</div>
      </section></main></body></html>`;
  }

  downloadHtml() {
    const model = this.createModel();
    const html = this.renderHtml(model);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${String(model.projectName || 'memoria').replace(/[^a-z0-9-_]+/gi, '_')}_memoria.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    this.toast('Memoria HTML generada.');
  }

  printPdf() {
    const html = this.renderHtml(this.createModel());
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
      this.toast('El navegador bloqueó la ventana del informe. Permita ventanas emergentes.');
      return;
    }
    try { reportWindow.opener = null; } catch (_) {}
    let printRequested = false;
    const printOnce = () => {
      if (printRequested || reportWindow.closed) return;
      printRequested = true;
      setTimeout(() => {
        if (!reportWindow.closed) reportWindow.print();
      }, 180);
    };
    reportWindow.addEventListener('load', printOnce, { once: true });
    reportWindow.document.open();
    reportWindow.document.write(html);
    reportWindow.document.close();
    setTimeout(printOnce, 500);
    this.toast('Vista de impresión abierta · seleccione “Guardar como PDF”.');
  }
}
