import * as THREE from 'three';
import { StructuralCalculator } from '../engineering/StructuralCalculator.js';
import { PresetManager } from '../presets/PresetManager.js';
import { ReportGenerator } from '../reporting/ReportGenerator.js';
import { AnalysisVisualizer } from './AnalysisVisualizer.js';
import { ClashDetector } from './ClashDetector.js';

const STATUS_TEXT = { PASS: 'CUMPLE', WARN: 'REVISAR', FAIL: 'NO CUMPLE', NOT_CHECKED: 'SIN VERIFICAR' };
const CHECK_LABELS = {
  'member-axial': 'Resistencia de la sección a axil',
  'member-bending-y': 'Resistencia a flexión respecto a y-y',
  'member-bending-z': 'Resistencia a flexión respecto a z-z',
  'member-shear-z': 'Resistencia a cortante local z',
  'member-shear-y': 'Resistencia a cortante local y',
  'member-buckling-y': 'Pandeo por flexión respecto a y-y',
  'member-buckling-z': 'Pandeo por flexión respecto a z-z',
  'member-ltb': 'Pandeo lateral / vuelco lateral',
  'member-deflection': 'Deformación y flecha ELS',
  'member-section-interaction-screening': 'Interacción N–M de la sección',
  'member-stability-interaction-screening': 'Interacción N–M con inestabilidad',
  'member-high-shear-bending': 'Reducción de flexión por cortante alto',
  'action-transfer': 'Transferencia de acciones barra → unión',
  'bolt-host-plate': 'Vinculación del grupo con la placa',
  'bolt-model-consistency': 'Consistencia de la matriz de tornillos',
  'bolt-group-distribution': 'Reparto elástico N/V/M en la matriz',
  'bolt-spacing': 'Separaciones y distancias a borde',
  'bolt-shear': 'Resistencia del tornillo a cortante',
  'bolt-tension': 'Resistencia del tornillo a tracción',
  'bolt-interaction': 'Interacción cortante–tracción',
  'plate-bearing': 'Aplastamiento de chapa en los taladros',
  'fillet-weld-resistance': 'Resistencia del cordón de soldadura',
  'fillet-weld-effective-length': 'Longitud eficaz mínima del cordón',
};
const WARNING_MESSAGES = {
  PRELIMINARY_SCOPE: 'Comprobación de predimensionado: valide el análisis global, imperfecciones, segundo orden y combinaciones antes de fabricar.',
  PRELIMINARY_BOLT_SCOPE: 'Quedan fuera de este control el desgarro en bloque, sección neta, punzonamiento, efecto palanca, deslizamiento, fatiga y flexión de la chapa.',
  PRELIMINARY_WELD_SCOPE: 'Control simplificado del cordón: no incluye reparto por momentos del grupo, tensiones direccionales, fatiga ni requisitos de ejecución.',
  LTB_SCOPE_UNDECLARED: 'Debe declarar la coacción lateral o aportar una resistencia Mb,Rd validada para cerrar el control de vuelco lateral.',
  ESTIMATED_DEFLECTION: 'La flecha se estima con un modelo elástico de viga equivalente; no procede de un análisis global.',
  SIMPLIFIED_INTERACTION: 'Interacción lineal N–M de predimensionado; aplique la ecuación de EC3 correspondiente a la clase de sección.',
  SIMPLIFIED_MEMBER_INTERACTION: 'Interacción simplificada de predimensionado; el dimensionado final debe aplicar el método de interacción correspondiente.',
  DATA_MISSING: 'Faltan datos para completar esta comprobación.',
  NOT_APPLICABLE: 'Comprobación no aplicable para las solicitaciones declaradas.',
  NET_SECTION_NOT_VERIFIED: 'No se ha verificado la rotura de la sección neta; defina Anet y fu o confirme que no existen taladros.',
  COMMON_BUCKLING_LENGTH: 'Se ha usado una longitud de pandeo común para ambos ejes; revise Lcr,y y Lcr,z.',
  COMMON_BUCKLING_CURVE: 'Se ha usado una curva de pandeo común para ambos ejes; valide la curva de cada eje.',
  BEARING_DIRECTION_APPROXIMATION: 'Se usa un único juego conservador de bordes y separaciones aunque varíe la dirección del cortante.',
  BOLT_COMPRESSION_CLIPPED: 'La tracción elástica negativa de algunos tornillos se ha limitado a cero; no se modelan el contacto, la redistribución ni el efecto palanca.',
  M16_REFERENCE_MISMATCH: 'La referencia interna de resistencia a tracción del tornillo M16 8.8 no coincide con el valor esperado.',
  GROSS_LENGTH_USED_AS_EFFECTIVE: 'Se ha usado la longitud bruta como eficaz; introduzca Leff después de las deducciones de extremos.',
  SMALL_WELD_THROAT: 'La garganta es inferior a 3 mm; compruebe los mínimos aplicables y los requisitos de ejecución.',
  ACTION_TRANSFER_MISSING: 'No existe una fuente de acciones válida: calcule una única barra vinculada o introduzca acciones manuales no nulas.',
  ACTION_TRANSFER_AMBIGUOUS: 'Hay varias barras calculadas en el conjunto; vincule explícitamente la barra que transmite las acciones.',
  ACTION_TRANSFER_SOURCE_STATUS: 'Las acciones proceden de una barra cuyo resultado global requiere revisión.',
  BOLT_LAYOUT_INFERRED: 'La matriz se ha inferido porque la unión no contiene geometría paramétrica completa; valide filas, columnas y separaciones.',
  BOLT_COUNT_MISMATCH: 'El número de tornillos del modelo no coincide con las filas y columnas declaradas.',
  PLATE_THICKNESS_FROM_MODEL: 'El espesor introducido no coincide con la geometría; la comprobación usa el espesor real de la placa.',
};
const optionalNum = value => {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const num = (value, fallback = 0) => optionalNum(value) ?? fallback;
const gradeStrength = grade => {
  const key = String(grade || 'S275').toUpperCase();
  if (key.startsWith('S235')) return { fy: 235, fu: 360, key: 'S235' };
  if (key.startsWith('S355')) return { fy: 355, fu: 510, key: 'S355' };
  if (key.startsWith('S450')) return { fy: 450, fu: 550, key: 'S355' };
  return { fy: 275, fu: 430, key: 'S275' };
};

export class ProWorkspaceController {
  constructor(options = {}) {
    Object.assign(this, options);
    this.calculator = new StructuralCalculator();
    this.visualizer = new AnalysisVisualizer(this.sceneManager);
    this.clashDetector = new ClashDetector(this.sceneManager, { tolerance: 0.001, excludeSameConnection: true });
    this.exploded = new Map();
    this.presetManager = new PresetManager({
      sceneManager: this.sceneManager,
      getSelected: () => this.getSelected?.(),
      onSelect: object => this.selectObject?.(object),
      onCommit: () => { this.pushUndo?.(); this.refresh?.(); },
      toast: message => this.toast?.(message),
    });
    this.reportGenerator = new ReportGenerator({
      getProjectName: () => this.getProjectName?.() || 'Sin título',
      getObjects: () => this.sceneManager.objects,
      toast: message => this.toast?.(message),
    });
  }

  wire() {
    this._wireInspector();
    this._wireRibbon();
    this.refresh?.();
    return this;
  }

  _wireInspector() {
    const previousChange = this.propsPanel.onPropertyChange;
    this.propsPanel.getClashes = element => this.clashDetector.detect(element);
    this.propsPanel.onCalculate = (element, kind, input) => this.calculate(element, kind, input);
    this.propsPanel.onExplode = element => this.toggleExploded(element);
    this.propsPanel.onPropertyChange = (element, meta = {}) => {
      previousChange?.(element, meta);
      if (meta.rebuild) this.selectObject?.(element);
      this.syncBoundWelds();
      this.refresh?.();
    };
  }

  _wireRibbon() {
    const on = (action, callback) => this.ribbon.on(action, callback);
    on('preset-structures', () => this.presetManager.open('structure'));
    on('preset-portal', () => this.presetManager.open('structure', 'portal-duopitch'));
    on('preset-truss', () => this.presetManager.open('structure', 'truss'));
    on('preset-connections', () => this.presetManager.open('connection'));
    on('bolt-matrix', () => this.presetManager.openBoltMatrix());
    on('explode-assembly', () => this.toggleExploded(this.getSelected?.()));
    on('run-check', () => this.calculateSelected());
    on('run-bolt-check', () => this.calculate(this.getSelected?.(), 'bolt', this.getSelected?.()?.connectionInput || {}));
    on('run-weld-check', () => this.calculate(this.getSelected?.(), 'weld', this.getSelected?.()?.connectionInput || {}));
    on('clash-scan', () => this.scanClashes());
    on('toggle-diagrams', () => {
      const visible = this.visualizer.toggle();
      const selected = this.getSelected?.();
      if (visible && selected?.type === 'profile' && selected.analysisResults) this.visualizer.show(selected);
      this.toast?.(`Diagramas: ${visible ? 'visibles' : 'ocultos'}`);
    });
    on('clear-diagrams', () => { this.visualizer.clear(); this.toast?.('Diagramas retirados.'); });
    on('report-html', () => this.reportGenerator.downloadHtml());
    on('report-pdf', () => this.reportGenerator.printPdf());
    on('export-json', () => this.onExport?.());
    on('open-tutorial', () => this.onTutorial?.());
  }

  calculateSelected() {
    const element = this.getSelected?.();
    if (!element) { this.toast?.('Seleccione una barra, placa, tornillo o soldadura.'); return null; }
    const kind = element.type === 'profile' ? 'member' : element.type === 'weld' ? 'weld' : 'bolt';
    return this.calculate(element, kind, kind === 'member' ? (element.analysisInput || {}) : (element.connectionInput || {}));
  }

  calculate(element, kind, input = {}) {
    if (!element) { this.toast?.('Seleccione primero un elemento.'); return null; }
    let raw;
    this._resolvedInput = null;
    if (kind === 'member') raw = this._checkMember(element, input);
    else if (kind === 'bolt') raw = this._checkBoltGroup(element, input);
    else if (kind === 'weld') raw = this._checkWeld(element, input);
    if (!raw) return null;
    const resolvedInput = this._resolvedInput || input;
    const result = this._normalise(raw, resolvedInput);
    element.analysisResults = result;
    if (kind === 'member') {
      element.analysisInput = { ...resolvedInput };
      this.visualizer.show(element, result);
      this.propsPanel.setActiveTab?.('analysis');
    } else {
      element.connectionInput = { ...resolvedInput };
      this.propsPanel.setActiveTab?.('connection');
    }
    element.params.calculationStatus = result.status;
    element._applyUserData?.();
    this.propsPanel.update(element);
    this.pushUndo?.();
    this.refresh?.();
    this.toast?.(`${STATUS_TEXT[result.status] || result.status} · η ${Number.isFinite(result.ratio) ? (result.ratio * 100).toFixed(0) + '%' : '—'}`, 3200);
    return result;
  }

  _checkMember(element, input) {
    if (element.type !== 'profile' || !element.engineeringData) {
      this.toast?.('La comprobación de barra requiere un perfil estructural.');
      return null;
    }
    const e = element.engineeringData;
    const strength = gradeStrength(element.steelGrade);
    const areaMm2 = num(e.area) * 100;
    const webArea = Math.max(areaMm2 * .25, Math.max(0, num(e.h) - 2 * num(e.tf)) * num(e.tw));
    const flangeArea = Math.max(areaMm2 * .25, 2 * num(e.b) * num(e.tf));
    const series = String(element.params.series || '').toUpperCase();
    const isTube = series === 'CHS' || series === 'SHS';
    const Lm = Math.max(.001, num(element.params.length, 1));
    const my = optionalNum(input.MyEd ?? input.MEd);
    const deflectionLimit = num(input.deflectionLimit, 300);
    const suppliedDeflection = optionalNum(input.deltaEdMm ?? input.deltaEd);
    const suppliedServiceLoad = optionalNum(input.serviceLoad ?? input.w_kN_per_m);
    let serviceability;
    if (element.params.orientation === 'column') {
      serviceability = { notRequired: true };
    } else if (suppliedDeflection !== null) {
      serviceability = { deltaEd_mm: Math.abs(suppliedDeflection), limitSpanRatio: deflectionLimit };
    } else if (suppliedServiceLoad !== null) {
      serviceability = {
        model: 'simply-supported-udl',
        w_kN_per_m: Math.abs(suppliedServiceLoad),
        limitSpanRatio: deflectionLimit,
      };
    } else {
      // Do not derive an ELS load from the ultimate design moment. Without an
      // explicit service load or analysed deflection, the calculator must fail closed.
      serviceability = { limitSpanRatio: deflectionLimit };
    }
    return this.calculator.checkMember({
      actions: {
        NEd_kN: optionalNum(input.NEd),
        VEd_kN: optionalNum(input.VEd),
        MyEd_kNm: my,
        MzEd_kNm: optionalNum(input.MzEd),
      },
      section: {
        sectionClass: num(e.sectionClass, 3), A_mm2: areaMm2, fy_MPa: num(e.fy, strength.fy), fu_MPa: num(e.fu, strength.fu),
        Avz_mm2: isTube ? areaMm2 * .55 : webArea, Avy_mm2: isTube ? areaMm2 * .55 : flangeArea,
        Iy_mm4: num(e.Iy) * 1e4, Iz_mm4: num(e.Iz) * 1e4,
        WplY_mm3: num(e.Wply) * 1e3, WplZ_mm3: num(e.Wplz) * 1e3,
        WelY_mm3: num(e.Wely) * 1e3, WelZ_mm3: num(e.Welz) * 1e3,
        E_MPa: num(e.E, 210000), holesAbsent: true,
      },
      member: {
        L_mm: Lm * 1000, LcrY_mm: Math.max(.001, num(input.LcrY, Lm)) * 1000,
        LcrZ_mm: Math.max(.001, num(input.LcrZ, Lm)) * 1000,
        bucklingCurveY: isTube ? 'a' : 'b', bucklingCurveZ: isTube ? 'a' : 'c',
      },
      serviceability,
      standardContext: { gammaM0: 1.05, gammaM1: 1.05, gammaM2: 1.25 },
    });
  }

  _checkBoltGroup(element, input) {
    const plate = this._hostPlate(element);
    const bolts = this._groupBolts(element, plate);
    const group = plate?.params?.boltGroup || {};
    const metric = group.metric || bolts[0]?.params?.metric || element.params?.metric || 'M16';
    const grade = group.boltClass || bolts[0]?.params?.boltClass || element.params?.boltClass || '8.8';
    const count = Math.max(1, bolts.length || 1);
    const cols = num(group.cols, count > 1 ? 2 : 1);
    const rows = num(group.rows, Math.max(1, Math.ceil(count / Math.max(1, cols))));
    const widthM = optionalNum(plate?.params?.width);
    const heightM = optionalNum(plate?.params?.height);
    const width = widthM === null ? null : widthM * 1000;
    const height = heightM === null ? null : heightM * 1000;
    const sx = num(group.spacingX, cols > 1 && width !== null ? width / (cols + 1) / 1000 : .08) * 1000;
    const sy = num(group.spacingY, rows > 1 && height !== null ? height / (rows + 1) / 1000 : .08) * 1000;
    const strength = gradeStrength(plate?.steelGrade || element.steelGrade);
    const transferred = this._transferredActions(element, input);
    const enteredThickness = optionalNum(input.plateThicknessMm);
    const geometricThickness = plate && optionalNum(plate.params?.thickness) !== null
      ? optionalNum(plate.params.thickness) * 1000
      : null;
    const plateThickness = geometricThickness ?? enteredThickness;
    const resolvedInput = { ...input, ...transferred, plateThicknessMm: plateThickness };
    this._resolvedInput = resolvedInput;
    const raw = this.calculator.checkBoltGroup({
      actions: { NEd_kN: transferred.NEd, VEd_kN: transferred.VEd, MEd_kNm: transferred.MEd },
      bolt: { metric, grade, threadsInShearPlane: true, shearPlanes: 1 },
      matrix: { rows, columns: cols, rowSpacing_mm: sy, columnSpacing_mm: sx },
      plate: { t_mm: plateThickness, fu_MPa: strength.fu, width_mm: width, height_mm: height },
      standardContext: { gammaM0: 1.05, gammaM1: 1.05, gammaM2: 1.25 },
    });

    raw.calculationGroupId = `bolt-group:${group.id || plate?.id || element.params?.boltGroupId || element.id}`;
    const declaredRows = optionalNum(group.rows);
    const declaredColumns = optionalNum(group.cols);
    const explicitLayout = Number.isInteger(declaredRows) && declaredRows >= 1 &&
      Number.isInteger(declaredColumns) && declaredColumns >= 1 &&
      (declaredColumns === 1 || num(group.spacingX) > 0) &&
      (declaredRows === 1 || num(group.spacingY) > 0);
    if (geometricThickness !== null && enteredThickness !== null && Math.abs(geometricThickness - enteredThickness) > 1e-6) {
      this._appendRawWarning(raw, 'PLATE_THICKNESS_FROM_MODEL', WARNING_MESSAGES.PLATE_THICKNESS_FROM_MODEL);
    }
    if (!plate) {
      this._appendNotChecked(raw, 'bolt-host-plate', 'Vinculación del grupo con la placa', 'No se encontró una placa anfitriona vinculada al tornillo o grupo.');
    }
    if (explicitLayout && bolts.length !== rows * cols) {
      this._appendNotChecked(raw, 'bolt-model-consistency', 'Consistencia de la matriz de tornillos', `La matriz declara ${rows * cols} tornillos y el modelo contiene ${bolts.length}.`, 'BOLT_COUNT_MISMATCH');
    }
    if (!explicitLayout) {
      this._appendRawWarning(raw, 'BOLT_LAYOUT_INFERRED', WARNING_MESSAGES.BOLT_LAYOUT_INFERRED);
    }
    if (transferred.issueCode) {
      this._appendRawWarning(raw, transferred.issueCode, transferred.issueMessage);
    } else if (transferred.actionSource === 'member' && transferred.sourceStatus !== 'PASS') {
      this._appendRawWarning(raw, 'ACTION_TRANSFER_SOURCE_STATUS', `${WARNING_MESSAGES.ACTION_TRANSFER_SOURCE_STATUS} Estado de origen: ${STATUS_TEXT[transferred.sourceStatus] || transferred.sourceStatus}.`);
    }

    const normalized = this._normalise(raw, resolvedInput);
    const assignGroupResult = object => {
      if (!object) return;
      object.analysisResults = normalized;
      object.connectionInput = { ...resolvedInput };
      if (object.params) object.params.calculationStatus = normalized.status;
      object._applyUserData?.();
    };
    assignGroupResult(plate);
    bolts.forEach(assignGroupResult);
    return raw;
  }

  _checkWeld(element, input) {
    if (element.type !== 'weld') { this.toast?.('Seleccione un cordón de soldadura.'); return null; }
    const strength = gradeStrength(element.steelGrade);
    return this.calculator.checkFilletWeld({
      actions: { FEd_kN: optionalNum(input.FEd) },
      weld: {
        throat_mm: Math.max(.1, num(input.throatMm, num(element.params.throat ?? element.params.radius, .005) * 1000)),
        effectiveLength_mm: Math.max(.1, num(input.lengthMm, element.pointA.distanceTo(element.pointB) * 1000)),
        fu_MPa: strength.fu,
        steelGrade: strength.key,
      },
      standardContext: { gammaM2: 1.25 },
    });
  }

  _appendRawWarning(raw, code, message) {
    raw.warnings = Array.isArray(raw.warnings) ? raw.warnings : [];
    if (!raw.warnings.some(item => item?.code === code)) {
      raw.warnings.push({ code, message, severity: 'blocking', localized: true });
    }
    if (raw.status === 'PASS') raw.status = 'WARN';
    if (raw.summary?.status === 'PASS') raw.summary = { ...raw.summary, status: 'WARN' };
  }

  _appendNotChecked(raw, id, label, message, warningCode = 'DATA_MISSING') {
    raw.checks = Array.isArray(raw.checks) ? raw.checks : [];
    if (!raw.checks.some(check => check.id === id)) {
      raw.checks.push({
        id, label, clause: 'Consistencia del modelo', required: true, applicable: true,
        status: 'NOT_CHECKED', demand: null, resistance: null, utilization: null,
        formula: '', substitution: '', values: {},
        warnings: [{ code: warningCode, message, severity: 'blocking', localized: true }],
      });
    }
    raw.warnings = Array.isArray(raw.warnings) ? raw.warnings : [];
    if (!raw.warnings.some(item => item?.code === warningCode)) {
      raw.warnings.push({ code: warningCode, message, severity: 'blocking', localized: true });
    }
    const requiredChecks = raw.checks.filter(check => check.required !== false);
    const status = raw.status === 'FAIL' ? 'FAIL' : 'NOT_CHECKED';
    raw.status = status;
    raw.summary = {
      ...(raw.summary || {}),
      status,
      checked: requiredChecks.filter(check => check.status !== 'NOT_CHECKED').length,
      required: requiredChecks.length,
      notChecked: requiredChecks.filter(check => check.status === 'NOT_CHECKED').length,
      noApplicableChecks: false,
    };
  }

  _normalise(raw, input) {
    const checks = (raw.checks || []).map(check => ({
      ...check,
      label: CHECK_LABELS[check.id] || check.label,
      demandDetail: check.demand, resistanceDetail: check.resistance,
      demand: typeof check.demand === 'object' ? check.demand?.value : check.demand,
      resistance: typeof check.resistance === 'object' ? check.resistance?.value : check.resistance,
      unit: check.demand?.unit || check.resistance?.unit || check.unit || '',
      ratio: check.utilization?.value ?? check.ratio ?? null,
    }));
    const summaryRatio = optionalNum(raw.summary?.governingUtilization);
    const calculatedRatios = checks
      .filter(check => check.required !== false && check.applicable !== false && check.status !== 'NOT_CHECKED')
      .map(check => optionalNum(check.ratio))
      .filter(value => value !== null);
    const ratio = summaryRatio ?? (calculatedRatios.length ? Math.max(...calculatedRatios) : null);
    const governing = checks.find(check => check.id === raw.summary?.governingCheckId) ||
      (ratio === null ? null : checks.find(check => check.ratio === ratio));
    const bucklingY = checks.find(check => check.id === 'member-buckling-y');
    const bucklingZ = checks.find(check => check.id === 'member-buckling-z');
    const warnings = [...new Set((raw.warnings || [])
      .filter(warning => warning?.severity !== 'info' || ['PRELIMINARY_SCOPE','PRELIMINARY_BOLT_SCOPE','PRELIMINARY_WELD_SCOPE'].includes(warning?.code))
      .map(warning => warning?.localized ? warning.message : WARNING_MESSAGES[warning?.code] || warning?.message || String(warning)))];
    return {
      ...raw, input: { ...input }, checks, ratio,
      governing: governing?.label || raw.summary?.governingCheckId || 'Comprobación automática',
      warnings,
      slenderness: bucklingY || bucklingZ ? { y: bucklingY?.values?.lambdaBar, z: bucklingZ?.values?.lambdaBar } : null,
      reduction: bucklingY || bucklingZ ? { y: bucklingY?.values?.chi, z: bucklingZ?.values?.chi } : null,
    };
  }

  _hostPlate(element) {
    if (element?.type === 'plate') return element;
    const objects = Array.isArray(this.sceneManager?.objects) ? this.sceneManager.objects : [];
    const id = element?.params?.hostPlateId;
    if (id) return objects.find(object => object.id === id && object.type === 'plate') || null;
    const assembly = element?.params?.assemblyId;
    if (!assembly) return null;
    const candidates = objects.filter(object => object.type === 'plate' && object.params?.assemblyId === assembly);
    if (candidates.length <= 1) return candidates[0] || null;
    const groupId = element?.params?.boltGroupId;
    const grouped = candidates.find(plate => plate.params?.boltGroup?.id === groupId || plate.params?.boltGroup?.boltIds?.includes(element.id));
    if (grouped) return grouped;
    const primary = candidates.filter(plate => /placa base|chapa de testa|cubrejunta|casquillo/i.test(String(plate.params?.role || plate.designation || '')));
    const pool = primary.length ? primary : candidates;
    if (!element?.mesh?.position) return pool[0] || null;
    return pool.slice().sort((a, b) =>
      a.mesh.position.distanceToSquared(element.mesh.position) - b.mesh.position.distanceToSquared(element.mesh.position))[0] || null;
  }

  _groupBolts(element, plate) {
    const objects = Array.isArray(this.sceneManager?.objects) ? this.sceneManager.objects : [];
    const fasteners = objects.filter(object => object.type === 'fastener' && ['bolt', 'anchor'].includes(object.params?.subtype));
    const ids = new Set(plate?.params?.boltGroup?.boltIds || []);
    if (ids.size) return fasteners.filter(object => ids.has(object.id));
    const groupId = element?.params?.boltGroupId || plate?.params?.boltGroup?.id;
    if (groupId) return fasteners.filter(object => object.params?.boltGroupId === groupId);
    if (plate?.id) {
      const hosted = fasteners.filter(object => object.params?.hostPlateId === plate.id);
      if (hosted.length) return hosted;
    }
    const assembly = element?.params?.assemblyId || plate?.params?.assemblyId;
    if (assembly) return fasteners.filter(object => object.params?.assemblyId === assembly);
    return element?.type === 'fastener' && ['bolt', 'anchor'].includes(element.params?.subtype) ? [element] : [];
  }

  _transferredActions(element, input) {
    const manual = {
      NEd: optionalNum(input.NEd),
      VEd: optionalNum(input.VEd),
      MEd: optionalNum(input.MEd),
    };
    const manualComplete = Object.values(manual).every(value => value !== null);
    const manualNonZero = Object.values(manual).some(value => value !== null && Math.abs(value) > 1e-9);
    const manualDeclared = input.actionSource === 'manual' && manualComplete;
    if (manualDeclared || (manualNonZero && input.actionSource !== 'member')) {
      return { ...manual, actionSource: 'manual', sourceStatus: null };
    }

    const objects = Array.isArray(this.sceneManager?.objects) ? this.sceneManager.objects : [];
    const explicitId = input.sourceMemberId || element?.params?.sourceMemberId || element?.params?.hostMemberId;
    const assembly = element?.params?.assemblyId;
    let candidates = [];
    if (explicitId) {
      candidates = objects.filter(object => object.id === explicitId && object.type === 'profile' && object.analysisInput);
    } else if (assembly) {
      candidates = objects.filter(object => object.type === 'profile' && object.params?.assemblyId === assembly && object.analysisInput);
    }
    if (candidates.length > 1) {
      return {
        NEd: null, VEd: null, MEd: null, actionSource: 'ambiguous', sourceStatus: null,
        issueCode: 'ACTION_TRANSFER_AMBIGUOUS', issueMessage: WARNING_MESSAGES.ACTION_TRANSFER_AMBIGUOUS,
      };
    }
    const member = candidates[0];
    if (!member || !member.analysisResults) {
      return {
        NEd: null, VEd: null, MEd: null, actionSource: 'missing', sourceStatus: member?.analysisResults?.status || null,
        issueCode: 'ACTION_TRANSFER_MISSING', issueMessage: WARNING_MESSAGES.ACTION_TRANSFER_MISSING,
      };
    }
    const source = member.analysisInput;
    const memberN = optionalNum(source.NEd);
    const memberV = optionalNum(source.VEd);
    const memberM = optionalNum(source.MEd ?? source.MyEd);
    if ([memberN, memberV, memberM].some(value => value === null)) {
      return {
        NEd: null, VEd: null, MEd: null, actionSource: 'missing', sourceMemberId: member.id,
        sourceStatus: member.analysisResults.status,
        issueCode: 'ACTION_TRANSFER_MISSING', issueMessage: WARNING_MESSAGES.ACTION_TRANSFER_MISSING,
      };
    }
    return {
      // Member convention: compression positive. Bolt-group convention: tension
      // normal to the plate positive. Axial transfer therefore reverses the sign.
      NEd: -memberN,
      VEd: memberV,
      MEd: memberM,
      actionSource: 'member',
      sourceMemberId: member.id,
      sourceStatus: member.analysisResults.status,
      signConvention: 'NEd de barra (+ compresión) → NEd de unión (+ tracción) mediante cambio de signo',
    };
  }

  syncBoundWelds() {
    const resolver = id => this.sceneManager.objects.find(object => object.id === id);
    this.sceneManager.objects.filter(object => object.type === 'weld').forEach(weld => weld.updateFromBindings?.(resolver));
  }

  /**
   * Recompose every temporary exploded view before a project snapshot or scene
   * replacement. Exploded offsets are presentation state and must never leak
   * into Undo/Redo, saved projects or a newly loaded model.
   */
  resetTransientState({ refresh = true } = {}) {
    if (!this.exploded.size) return 0;
    const objectsById = new Map(
      (Array.isArray(this.sceneManager?.objects) ? this.sceneManager.objects : [])
        .map(object => [object.id, object]),
    );
    let restored = 0;
    this.exploded.forEach(original => {
      original.forEach((position, id) => {
        const object = objectsById.get(id);
        if (!object?.mesh?.position || !Array.isArray(position) || position.length !== 3) return;
        object.mesh.position.fromArray(position);
        object.mesh.updateMatrixWorld(true);
        restored++;
      });
    });
    this.exploded.clear();
    this.syncBoundWelds();
    if (refresh) this.refresh?.();
    return restored;
  }

  scanClashes() {
    const clashes = this.clashDetector.detectAll();
    this.propsPanel.refresh?.();
    this.toast?.(clashes.length ? `${clashes.length} solape${clashes.length === 1 ? '' : 's'} detectado${clashes.length === 1 ? '' : 's'}. Revise el inspector.` : 'Sin solapes volumétricos no intencionados.', 3500);
    return clashes;
  }

  toggleExploded(element) {
    const assemblyId = element?.params?.assemblyId || element?.params?.templateInstanceId;
    if (!assemblyId) { this.toast?.('El elemento no pertenece a un conjunto explosionable.'); return; }
    const parts = this.sceneManager.objects.filter(object => object.params?.assemblyId === assemblyId || object.params?.templateInstanceId === assemblyId);
    if (this.exploded.has(assemblyId)) {
      const original = this.exploded.get(assemblyId);
      parts.forEach(part => { const state = original.get(part.id); if (state) part.mesh.position.fromArray(state); part.mesh.updateMatrixWorld(true); });
      this.exploded.delete(assemblyId);
      this.toast?.('Conjunto recompuesto.');
    } else {
      const original = new Map(parts.map(part => [part.id, part.mesh.position.toArray()]));
      const center = parts.reduce((sum, part) => sum.add(part.mesh.position), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, parts.length));
      parts.forEach((part, index) => {
        const direction = part.mesh.position.clone().sub(center);
        if (direction.lengthSq() < 1e-8) direction.set((index % 3) - 1, ((index + 1) % 3) - 1, ((index + 2) % 3) - 1);
        direction.normalize().multiplyScalar(.22 + .025 * (index % 5));
        part.mesh.position.add(direction); part.mesh.updateMatrixWorld(true);
      });
      this.exploded.set(assemblyId, original);
      this.toast?.(`Vista explosionada · ${parts.length} componentes.`);
    }
    this.syncBoundWelds();
    this.refresh?.();
  }
}

export default ProWorkspaceController;