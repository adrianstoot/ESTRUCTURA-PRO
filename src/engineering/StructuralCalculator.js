/**
 * StructuralCalculator
 * --------------------
 * Pure, dependency-free preliminary design checks for structural steel.
 *
 * Scope:
 * - Member screening according to Código Estructural · Anejo 22 · EN 1993-1-1 concepts.
 * - Bearing-type bolt group screening according to Código Estructural · Anejo 26 · EN 1993-1-8.
 * - Fillet weld screening using the Código Estructural · Anejo 26 · EN 1993-1-8 simplified method.
 *
 * This module does not read or mutate Three.js objects, the DOM, or application state.
 * Every public input uses a unit suffix. Internal calculations use N, mm, MPa
 * (N/mm2), Nmm, mm2, mm3 and mm4.
 *
 * IMPORTANT: these functions are intended for preliminary sizing. A PASS means that
 * the checks explicitly listed in the result pass with the supplied assumptions. It
 * is not a substitute for a complete structural analysis, a National Annex, or an
 * engineer's review.
 */

export const CHECK_STATUS = Object.freeze({
  PASS: 'PASS',
  WARN: 'WARN',
  FAIL: 'FAIL',
  NOT_CHECKED: 'NOT_CHECKED',
});

export const INTERNAL_UNITS = Object.freeze({
  force: 'N',
  length: 'mm',
  stress: 'MPa (N/mm²)',
  moment: 'N·mm',
  area: 'mm²',
  sectionModulus: 'mm³',
  inertia: 'mm⁴',
});

export const EC3_STANDARD = Object.freeze({
  member: 'Código Estructural · Anejo 22 · EN 1993-1-1:2005+A1:2014 — predimensionado trazable conforme RD 470/2021',
  joints: 'Código Estructural · Anejo 26 · EN 1993-1-8:2005 — predimensionado trazable conforme RD 470/2021',
});

export const BUCKLING_CURVES = Object.freeze({
  a0: 0.13,
  a: 0.21,
  b: 0.34,
  c: 0.49,
  d: 0.76,
});

/**
 * Metric coarse-thread tensile stress areas and normal clearances used by the
 * current application. Gross shank area is calculated from d.
 */
export const BOLT_SIZES = Object.freeze({
  M12: Object.freeze({ diameter_mm: 12, stressArea_mm2: 84.3, normalHoleDiameter_mm: 13 }),
  M16: Object.freeze({ diameter_mm: 16, stressArea_mm2: 157, normalHoleDiameter_mm: 18 }),
  M20: Object.freeze({ diameter_mm: 20, stressArea_mm2: 245, normalHoleDiameter_mm: 22 }),
  M24: Object.freeze({ diameter_mm: 24, stressArea_mm2: 353, normalHoleDiameter_mm: 26 }),
  M27: Object.freeze({ diameter_mm: 27, stressArea_mm2: 459, normalHoleDiameter_mm: 30 }),
  M30: Object.freeze({ diameter_mm: 30, stressArea_mm2: 561, normalHoleDiameter_mm: 33 }),
});

export const BOLT_GRADES = Object.freeze({
  '4.6': Object.freeze({ fyb_MPa: 240, fub_MPa: 400, alphaV: 0.6 }),
  '4.8': Object.freeze({ fyb_MPa: 320, fub_MPa: 400, alphaV: 0.5 }),
  '5.6': Object.freeze({ fyb_MPa: 300, fub_MPa: 500, alphaV: 0.6 }),
  '5.8': Object.freeze({ fyb_MPa: 400, fub_MPa: 500, alphaV: 0.5 }),
  '6.8': Object.freeze({ fyb_MPa: 480, fub_MPa: 600, alphaV: 0.5 }),
  '8.8': Object.freeze({ fyb_MPa: 640, fub_MPa: 800, alphaV: 0.6 }),
  '10.9': Object.freeze({ fyb_MPa: 900, fub_MPa: 1000, alphaV: 0.5 }),
});

export const WELD_CORRELATION_FACTORS = Object.freeze({
  S235: 0.80,
  S275: 0.85,
  S355: 0.90,
});

const DEFAULT_GAMMA = Object.freeze({
  gammaM0: 1.05,
  gammaM1: 1.05,
  gammaM2: 1.25,
});

const DEFAULT_WARNING_UTILIZATION = 0.85;
const EPSILON = 1e-12;

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function firstValue(object, keys) {
  for (const key of keys) {
    if (hasOwn(object, key)) {
      const value = object[key];
      const blankString = typeof value === 'string' && value.trim() === '';
      if (value === null || value === undefined || blankString) continue;
      return { present: true, key, value };
    }
  }
  return { present: false, key: null, value: undefined };
}

function warning(code, message, severity = 'warning') {
  return { code, message, severity };
}

function uniqueWarnings(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.code}:${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function statusFromUtilization(utilization, warningAt = DEFAULT_WARNING_UTILIZATION) {
  if (!isFiniteNumber(utilization) || utilization < 0) return CHECK_STATUS.NOT_CHECKED;
  if (utilization > 1 + EPSILON) return CHECK_STATUS.FAIL;
  if (utilization >= warningAt) return CHECK_STATUS.WARN;
  return CHECK_STATUS.PASS;
}

function promoteStatus(current, promoted) {
  const rank = {
    [CHECK_STATUS.PASS]: 0,
    [CHECK_STATUS.WARN]: 1,
    [CHECK_STATUS.NOT_CHECKED]: 2,
    [CHECK_STATUS.FAIL]: 3,
  };
  return rank[promoted] > rank[current] ? promoted : current;
}

function makeNotChecked({
  id,
  label,
  clause = '',
  reason,
  formula = '',
  required = true,
  values = {},
  warnings = [],
}) {
  const missingWarning = warning('DATA_MISSING', reason, 'blocking');
  return {
    id,
    label,
    clause,
    required,
    applicable: true,
    status: CHECK_STATUS.NOT_CHECKED,
    demand: null,
    resistance: null,
    utilization: null,
    formula,
    substitution: '',
    values,
    warnings: uniqueWarnings([missingWarning, ...warnings]),
  };
}

function makeNotApplicable({ id, label, clause = '', reason, values = {} }) {
  return {
    id,
    label,
    clause,
    required: false,
    applicable: false,
    status: CHECK_STATUS.PASS,
    demand: null,
    resistance: null,
    utilization: { value: 0, limit: 1 },
    formula: '',
    substitution: '',
    values,
    warnings: [warning('NOT_APPLICABLE', reason, 'info')],
  };
}

function makeResistanceCheck({
  id,
  label,
  clause,
  demandSymbol,
  demandValue,
  demandUnit,
  resistanceSymbol,
  resistanceValue,
  resistanceUnit = demandUnit,
  formula,
  substitution,
  values = {},
  warnings = [],
  warningAt = DEFAULT_WARNING_UTILIZATION,
  forceWarn = false,
  required = true,
}) {
  if (!isFiniteNumber(demandValue) || !isFiniteNumber(resistanceValue) || resistanceValue <= 0) {
    return makeNotChecked({
      id,
      label,
      clause,
      reason: 'Demand or resistance is not a finite positive value.',
      formula,
      required,
      values,
      warnings,
    });
  }

  const utilization = Math.abs(demandValue) / resistanceValue;
  let status = statusFromUtilization(utilization, warningAt);
  if (forceWarn && status === CHECK_STATUS.PASS) status = CHECK_STATUS.WARN;

  return {
    id,
    label,
    clause,
    required,
    applicable: true,
    status,
    demand: { symbol: demandSymbol, value: demandValue, unit: demandUnit },
    resistance: { symbol: resistanceSymbol, value: resistanceValue, unit: resistanceUnit },
    utilization: { value: utilization, limit: 1 },
    formula,
    substitution,
    values,
    warnings: uniqueWarnings(warnings),
  };
}

function makeUtilizationCheck({
  id,
  label,
  clause,
  utilization,
  formula,
  substitution,
  values = {},
  warnings = [],
  forceWarn = false,
  warningAt = DEFAULT_WARNING_UTILIZATION,
  required = true,
}) {
  if (!isFiniteNumber(utilization) || utilization < 0) {
    return makeNotChecked({
      id,
      label,
      clause,
      reason: 'Utilization could not be calculated with the supplied data.',
      formula,
      required,
      values,
      warnings,
    });
  }

  let status = statusFromUtilization(utilization, warningAt);
  if (forceWarn && status === CHECK_STATUS.PASS) status = CHECK_STATUS.WARN;
  return {
    id,
    label,
    clause,
    required,
    applicable: true,
    status,
    demand: null,
    resistance: null,
    utilization: { value: utilization, limit: 1 },
    formula,
    substitution,
    values,
    warnings: uniqueWarnings(warnings),
  };
}

function summarizeChecks(checks) {
  const requiredChecks = checks.filter((check) => check.required !== false);
  // An empty set of applicable checks is not evidence of compliance. This is
  // particularly important when every action was entered as zero but no member
  // or connection data was supplied.
  let status = requiredChecks.length === 0
    ? CHECK_STATUS.NOT_CHECKED
    : CHECK_STATUS.PASS;

  if (requiredChecks.some((check) => check.status === CHECK_STATUS.FAIL)) {
    status = CHECK_STATUS.FAIL;
  } else if (requiredChecks.some((check) => check.status === CHECK_STATUS.NOT_CHECKED)) {
    status = CHECK_STATUS.NOT_CHECKED;
  } else if (requiredChecks.some((check) => check.status === CHECK_STATUS.WARN)) {
    status = CHECK_STATUS.WARN;
  }

  const governing = requiredChecks
    .filter((check) => check.utilization && isFiniteNumber(check.utilization.value))
    .sort((a, b) => b.utilization.value - a.utilization.value)[0] || null;

  return {
    status,
    governingCheckId: governing?.id || null,
    governingUtilization: governing?.utilization?.value ?? null,
    checked: requiredChecks.filter((check) => check.status !== CHECK_STATUS.NOT_CHECKED).length,
    required: requiredChecks.length,
    notChecked: requiredChecks.filter((check) => check.status === CHECK_STATUS.NOT_CHECKED).length,
    noApplicableChecks: requiredChecks.length === 0,
  };
}

function collectWarnings(checks, extraWarnings = []) {
  return uniqueWarnings([
    ...extraWarnings,
    ...checks.flatMap((check) => check.warnings || []),
  ]);
}

function validPositive(value) {
  return isFiniteNumber(value) && value > 0;
}

function validNonNegative(value) {
  return isFiniteNumber(value) && value >= 0;
}

function resolveGamma(context = {}) {
  return {
    gammaM0: validPositive(context.gammaM0) ? context.gammaM0 : DEFAULT_GAMMA.gammaM0,
    gammaM1: validPositive(context.gammaM1) ? context.gammaM1 : DEFAULT_GAMMA.gammaM1,
    gammaM2: validPositive(context.gammaM2) ? context.gammaM2 : DEFAULT_GAMMA.gammaM2,
  };
}

function resolveSectionClass(section) {
  const raw = firstValue(section, ['sectionClass', 'class']);
  if (!raw.present) return null;
  const value = Number(raw.value);
  return Number.isInteger(value) && value >= 1 && value <= 4 ? value : null;
}

function resolveBucklingCurve(member, axis) {
  const upper = axis.toUpperCase();
  const named = firstValue(member, [
    `bucklingCurve${upper}`,
    `bucklingCurve${axis}`,
    'bucklingCurve',
  ]);
  const explicitAlpha = firstValue(member, [
    `imperfectionFactor${upper}`,
    `alpha${upper}`,
    `alpha${axis}`,
    'imperfectionFactor',
    'alpha',
  ]);

  if (explicitAlpha.present && validNonNegative(Number(explicitAlpha.value))) {
    return {
      curve: named.present ? String(named.value) : 'custom',
      alpha: Number(explicitAlpha.value),
      assumedForBothAxes: ['imperfectionFactor', 'alpha'].includes(explicitAlpha.key),
    };
  }

  if (!named.present) return null;
  const curve = String(named.value).trim();
  if (!hasOwn(BUCKLING_CURVES, curve)) return null;
  return {
    curve,
    alpha: BUCKLING_CURVES[curve],
    assumedForBothAxes: named.key === 'bucklingCurve',
  };
}

function resolveEffectiveArea(section, sectionClass) {
  if (sectionClass === 4) {
    return validPositive(section.Aeff_mm2) ? section.Aeff_mm2 : null;
  }
  return validPositive(section.A_mm2) ? section.A_mm2 : null;
}

function resolveBendingModulus(section, sectionClass, axis) {
  const upper = axis.toUpperCase();
  if (sectionClass <= 2) {
    return {
      symbol: `Wpl,${axis}`,
      value: firstValue(section, [`Wpl${upper}_mm3`, `Wpl${axis}_mm3`]).value,
      source: 'plastic',
    };
  }
  if (sectionClass === 3) {
    return {
      symbol: `Wel,${axis}`,
      value: firstValue(section, [`Wel${upper}_mm3`, `Wel${axis}_mm3`]).value,
      source: 'elastic',
    };
  }
  return {
    symbol: `Weff,${axis}`,
    value: firstValue(section, [`Weff${upper}_mm3`, `Weff${axis}_mm3`]).value,
    source: 'effective',
  };
}

function checkAxialResistance(actions, section, context, sectionClass, warningAt) {
  const action = firstValue(actions, ['NEd_kN', 'N_Ed_kN']);
  if (!action.present || !isFiniteNumber(Number(action.value))) {
    return makeNotChecked({
      id: 'member-axial',
      label: 'Axial cross-section resistance',
      clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.2.3 / §6.2.4',
      reason: 'NEd_kN must be supplied explicitly; use 0 when there is no axial force.',
    });
  }

  const NEd_kN = Number(action.value);
  if (Math.abs(NEd_kN) <= EPSILON) {
    return makeNotApplicable({
      id: 'member-axial',
      label: 'Axial cross-section resistance',
      clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.2.3 / §6.2.4',
      reason: 'NEd_kN is explicitly zero.',
      values: { NEd_kN: 0, signConvention: 'compression positive; tension negative' },
    });
  }

  if (!validPositive(section.fy_MPa) || !validPositive(section.A_mm2)) {
    return makeNotChecked({
      id: 'member-axial',
      label: 'Axial cross-section resistance',
      clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.2.3 / §6.2.4',
      reason: 'section.fy_MPa and section.A_mm2 are required.',
    });
  }

  if (!sectionClass) {
    return makeNotChecked({
      id: 'member-axial',
      label: 'Axial cross-section resistance',
      clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.2.3 / §6.2.4',
      reason: 'A valid sectionClass (1–4) is required.',
    });
  }

  const fy = section.fy_MPa;
  const warnings = [];
  let resistanceN;
  let formula;
  let substitution;
  let resistanceSymbol;
  const values = {
    signConvention: 'compression positive; tension negative',
    sectionClass,
  };

  if (NEd_kN > 0) {
    const area = resolveEffectiveArea(section, sectionClass);
    if (!validPositive(area)) {
      return makeNotChecked({
        id: 'member-axial',
        label: 'Compression cross-section resistance',
        clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.2.4',
        reason: sectionClass === 4
          ? 'section.Aeff_mm2 is required for a Class 4 section.'
          : 'section.A_mm2 is required.',
      });
    }
    resistanceN = area * fy / context.gammaM0;
    resistanceSymbol = sectionClass === 4 ? 'Nc,Rd (effective)' : 'Nc,Rd';
    formula = 'Nc,Rd = Adesign · fy / γM0';
    substitution = `${area} mm² · ${fy} MPa / ${context.gammaM0} = ${(resistanceN / 1000).toFixed(3)} kN`;
    values.areaUsed_mm2 = area;
  } else {
    const NplRdN = section.A_mm2 * fy / context.gammaM0;
    resistanceN = NplRdN;
    resistanceSymbol = 'Nt,Rd';
    formula = 'Nt,Rd = min(Npl,Rd, Nu,Rd); Npl,Rd = A · fy / γM0';
    substitution = `${section.A_mm2} mm² · ${fy} MPa / ${context.gammaM0} = ${(NplRdN / 1000).toFixed(3)} kN`;
    values.NplRd_kN = NplRdN / 1000;

    if (validPositive(section.Anet_mm2) && validPositive(section.fu_MPa)) {
      const NuRdN = 0.9 * section.Anet_mm2 * section.fu_MPa / context.gammaM2;
      resistanceN = Math.min(NplRdN, NuRdN);
      values.NuRd_kN = NuRdN / 1000;
      values.Anet_mm2 = section.Anet_mm2;
      formula = 'Nt,Rd = min(A · fy / γM0, 0.9 · Anet · fu / γM2)';
      substitution =
        `min(${(NplRdN / 1000).toFixed(3)}, ` +
        `0.9 · ${section.Anet_mm2} · ${section.fu_MPa} / ${context.gammaM2} / 1000) ` +
        `= ${(resistanceN / 1000).toFixed(3)} kN`;
    } else if (section.holesAbsent !== true) {
      warnings.push(warning(
        'NET_SECTION_NOT_VERIFIED',
        'Anet_mm2 and fu_MPa were not supplied and holesAbsent is not true; net-section fracture is not verified.',
        'blocking',
      ));
    }
  }

  return makeResistanceCheck({
    id: 'member-axial',
    label: NEd_kN > 0 ? 'Compression cross-section resistance' : 'Tension cross-section resistance',
    clause: NEd_kN > 0 ? 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.2.4' : 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.2.3',
    demandSymbol: 'NEd',
    demandValue: Math.abs(NEd_kN),
    demandUnit: 'kN',
    resistanceSymbol,
    resistanceValue: resistanceN / 1000,
    formula,
    substitution,
    values,
    warnings,
    warningAt,
    forceWarn: warnings.some((item) => item.severity === 'blocking'),
  });
}

function checkBendingAxis(actions, section, context, sectionClass, axis, actionKeys, warningAt) {
  const action = firstValue(actions, actionKeys);
  if (!action.present) {
    return makeNotApplicable({
      id: `member-bending-${axis}`,
      label: `Bending resistance about ${axis}-${axis}`,
      clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.2.5',
      reason: `No ${actionKeys[0]} component was requested; it is treated as zero by the uniaxial input convention.`,
    });
  }
  if (!isFiniteNumber(Number(action.value))) {
    return makeNotChecked({
      id: `member-bending-${axis}`,
      label: `Bending resistance about ${axis}-${axis}`,
      clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.2.5',
      reason: `${action.key} must be a finite number.`,
    });
  }

  const MEd_kNm = Math.abs(Number(action.value));
  if (MEd_kNm <= EPSILON) {
    return makeNotApplicable({
      id: `member-bending-${axis}`,
      label: `Bending resistance about ${axis}-${axis}`,
      clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.2.5',
      reason: `${action.key} is explicitly zero.`,
      values: { [`M${axis}Ed_kNm`]: 0 },
    });
  }

  if (!sectionClass) {
    return makeNotChecked({
      id: `member-bending-${axis}`,
      label: `Bending resistance about ${axis}-${axis}`,
      clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.2.5',
      reason: 'A valid sectionClass (1–4) is required to select Wpl, Wel or Weff.',
    });
  }
  if (!validPositive(section.fy_MPa)) {
    return makeNotChecked({
      id: `member-bending-${axis}`,
      label: `Bending resistance about ${axis}-${axis}`,
      clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.2.5',
      reason: 'section.fy_MPa is required.',
    });
  }

  const modulus = resolveBendingModulus(section, sectionClass, axis);
  if (!validPositive(Number(modulus.value))) {
    return makeNotChecked({
      id: `member-bending-${axis}`,
      label: `Bending resistance about ${axis}-${axis}`,
      clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.2.5',
      reason: `${modulus.symbol} in mm³ is required for Section Class ${sectionClass}.`,
    });
  }

  const W = Number(modulus.value);
  const MRd_kNm = W * section.fy_MPa / context.gammaM0 / 1e6;
  return makeResistanceCheck({
    id: `member-bending-${axis}`,
    label: `Bending resistance about ${axis}-${axis}`,
    clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.2.5',
    demandSymbol: `M${axis},Ed`,
    demandValue: MEd_kNm,
    demandUnit: 'kN·m',
    resistanceSymbol: `M${axis},Rd`,
    resistanceValue: MRd_kNm,
    formula: `M${axis},Rd = ${modulus.symbol} · fy / γM0`,
    substitution: `${W} mm³ · ${section.fy_MPa} MPa / ${context.gammaM0} / 10⁶ = ${MRd_kNm.toFixed(3)} kN·m`,
    values: {
      sectionClass,
      modulusType: modulus.source,
      modulus_mm3: W,
    },
    warningAt,
  });
}

function checkShearAxis(actions, section, context, axis, actionKeys, areaKeys, warningAt, required) {
  const action = firstValue(actions, actionKeys);
  if (!action.present) {
    if (!required) {
      return makeNotApplicable({
        id: `member-shear-${axis}`,
        label: `Shear resistance in local ${axis}`,
        clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.2.6',
        reason: `No ${actionKeys[0]} component was requested; it is treated as zero.`,
      });
    }
    return makeNotChecked({
      id: `member-shear-${axis}`,
      label: `Shear resistance in local ${axis}`,
      clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.2.6',
      reason: `${actionKeys.join(' or ')} must be supplied explicitly; use 0 when there is no shear.`,
    });
  }
  if (!isFiniteNumber(Number(action.value))) {
    return makeNotChecked({
      id: `member-shear-${axis}`,
      label: `Shear resistance in local ${axis}`,
      clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.2.6',
      reason: `${action.key} must be a finite number.`,
    });
  }

  const VEd_kN = Math.abs(Number(action.value));
  if (VEd_kN <= EPSILON) {
    return makeNotApplicable({
      id: `member-shear-${axis}`,
      label: `Shear resistance in local ${axis}`,
      clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.2.6',
      reason: `${action.key} is explicitly zero.`,
      values: { [`V${axis}Ed_kN`]: 0 },
    });
  }

  const area = firstValue(section, areaKeys);
  if (!validPositive(Number(area.value)) || !validPositive(section.fy_MPa)) {
    return makeNotChecked({
      id: `member-shear-${axis}`,
      label: `Shear resistance in local ${axis}`,
      clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.2.6',
      reason: `${areaKeys.join(' or ')} and section.fy_MPa are required.`,
    });
  }

  const Av_mm2 = Number(area.value);
  const VRd_kN = Av_mm2 * section.fy_MPa / (Math.sqrt(3) * context.gammaM0) / 1000;
  return makeResistanceCheck({
    id: `member-shear-${axis}`,
    label: `Shear resistance in local ${axis}`,
    clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.2.6',
    demandSymbol: `V${axis},Ed`,
    demandValue: VEd_kN,
    demandUnit: 'kN',
    resistanceSymbol: `V${axis},Rd`,
    resistanceValue: VRd_kN,
    formula: `V${axis},Rd = Av,${axis} · fy / (√3 · γM0)`,
    substitution: `${Av_mm2} mm² · ${section.fy_MPa} MPa / (√3 · ${context.gammaM0}) / 1000 = ${VRd_kN.toFixed(3)} kN`,
    values: { shearArea_mm2: Av_mm2 },
    warningAt,
  });
}

function checkBucklingAxis(actions, section, member, context, sectionClass, axis, warningAt) {
  const axial = firstValue(actions, ['NEd_kN', 'N_Ed_kN']);
  if (!axial.present || !isFiniteNumber(Number(axial.value))) {
    return makeNotChecked({
      id: `member-buckling-${axis}`,
      label: `Flexural buckling about ${axis}-${axis}`,
      clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.3.1',
      reason: 'NEd_kN is required to determine whether buckling is applicable.',
    });
  }

  const NEd_kN = Number(axial.value);
  if (NEd_kN <= EPSILON) {
    return makeNotApplicable({
      id: `member-buckling-${axis}`,
      label: `Flexural buckling about ${axis}-${axis}`,
      clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.3.1',
      reason: NEd_kN < 0 ? 'The member is in tension.' : 'NEd_kN is explicitly zero.',
    });
  }

  if (!sectionClass) {
    return makeNotChecked({
      id: `member-buckling-${axis}`,
      label: `Flexural buckling about ${axis}-${axis}`,
      clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.3.1',
      reason: 'A valid sectionClass (1–4) is required.',
    });
  }

  const upper = axis.toUpperCase();
  const inertia = firstValue(section, [`I${upper}_mm4`, `I${axis}_mm4`]);
  const axisLength = firstValue(member, [`Lcr${upper}_mm`, `Lcr${axis}_mm`]);
  const commonLength = firstValue(member, ['Lcr_mm']);
  const length = axisLength.present ? axisLength : commonLength;
  const curve = resolveBucklingCurve(member, axis);
  const area = resolveEffectiveArea(section, sectionClass);
  const E = section.E_MPa;
  const fy = section.fy_MPa;

  const missing = [];
  if (!validPositive(Number(inertia.value))) missing.push(`I${axis}_mm4`);
  if (!validPositive(Number(length.value))) missing.push(`Lcr${upper}_mm`);
  if (!curve) missing.push(`bucklingCurve${upper} (a0/a/b/c/d) or an explicit imperfection factor`);
  if (!validPositive(area)) missing.push(sectionClass === 4 ? 'Aeff_mm2' : 'A_mm2');
  if (!validPositive(E)) missing.push('E_MPa');
  if (!validPositive(fy)) missing.push('fy_MPa');

  if (missing.length) {
    return makeNotChecked({
      id: `member-buckling-${axis}`,
      label: `Flexural buckling about ${axis}-${axis}`,
      clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.3.1',
      reason: `Missing or invalid: ${missing.join(', ')}.`,
      formula: 'Ncr = π²EI/Lcr²; λ̄ = √(Afy/Ncr); Nb,Rd = χAfy/γM1',
    });
  }

  const I_mm4 = Number(inertia.value);
  const Lcr_mm = Number(length.value);
  const Ncr_N = Math.PI ** 2 * E * I_mm4 / (Lcr_mm ** 2);
  const lambdaBar = Math.sqrt(area * fy / Ncr_N);
  const alpha = curve.alpha;
  const phi = 0.5 * (1 + alpha * (lambdaBar - 0.2) + lambdaBar ** 2);
  const chiFormula = 1 / (phi + Math.sqrt(Math.max(0, phi ** 2 - lambdaBar ** 2)));
  const chi = lambdaBar <= 0.2 ? 1 : Math.min(1, chiFormula);
  const NbRd_N = chi * area * fy / context.gammaM1;

  const warnings = [];
  let forceWarn = false;
  if (!axisLength.present && commonLength.present) {
    warnings.push(warning(
      'COMMON_BUCKLING_LENGTH',
      `Lcr_mm was used for both axes. Supply Lcr${upper}_mm when the effective lengths differ.`,
      'blocking',
    ));
    forceWarn = true;
  }
  if (curve.assumedForBothAxes) {
    warnings.push(warning(
      'COMMON_BUCKLING_CURVE',
      `The common buckling curve "${curve.curve}" was used for both axes.`,
      'blocking',
    ));
    forceWarn = true;
  }

  return makeResistanceCheck({
    id: `member-buckling-${axis}`,
    label: `Flexural buckling about ${axis}-${axis}`,
    clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.3.1',
    demandSymbol: 'NEd',
    demandValue: NEd_kN,
    demandUnit: 'kN',
    resistanceSymbol: `Nb,${axis},Rd`,
    resistanceValue: NbRd_N / 1000,
    formula:
      'Ncr = π²EI/Lcr²; λ̄ = √(Adesign·fy/Ncr); ' +
      'Φ = 0.5[1 + α(λ̄ − 0.2) + λ̄²]; χ = min(1, 1/[Φ + √(Φ² − λ̄²)]); ' +
      'Nb,Rd = χ·Adesign·fy/γM1',
    substitution:
      `Ncr=${(Ncr_N / 1000).toFixed(3)} kN; λ̄=${lambdaBar.toFixed(4)}; ` +
      `α=${alpha}; Φ=${phi.toFixed(4)}; χ=${chi.toFixed(4)}; ` +
      `Nb,Rd=${(NbRd_N / 1000).toFixed(3)} kN`,
    values: {
      axis,
      I_mm4,
      Lcr_mm,
      Ncr_kN: Ncr_N / 1000,
      lambdaBar,
      bucklingCurve: curve.curve,
      imperfectionFactor: alpha,
      phi,
      chi,
      areaUsed_mm2: area,
      NbRd_kN: NbRd_N / 1000,
    },
    warnings,
    warningAt,
    forceWarn,
  });
}

function resolveDeflectionLimit(serviceability, L_mm) {
  const direct = firstValue(serviceability, ['limit_mm', 'deltaLimit_mm']);
  if (direct.present && validPositive(Number(direct.value))) {
    return { value_mm: Number(direct.value), source: direct.key };
  }
  const ratio = firstValue(serviceability, ['limitSpanRatio', 'spanLimitDenominator']);
  if (ratio.present && validPositive(Number(ratio.value)) && validPositive(L_mm)) {
    return {
      value_mm: L_mm / Number(ratio.value),
      source: `L/${Number(ratio.value)}`,
    };
  }
  return null;
}

function checkDeflection(section, member, serviceability, warningAt) {
  if (serviceability?.notRequired === true) {
    return makeNotApplicable({
      id: 'member-deflection',
      label: 'Serviceability deflection',
      clause: 'Project / National Annex serviceability criterion',
      reason: 'serviceability.notRequired is explicitly true.',
    });
  }

  const L = firstValue(member, ['L_mm', 'length_mm']);
  const L_mm = Number(L.value);
  const limit = resolveDeflectionLimit(serviceability || {}, L_mm);
  const suppliedDelta = firstValue(serviceability || {}, ['deltaEd_mm', 'deflectionEd_mm']);

  if (suppliedDelta.present) {
    if (!validNonNegative(Number(suppliedDelta.value))) {
      return makeNotChecked({
        id: 'member-deflection',
        label: 'Serviceability deflection',
        clause: 'Project / National Annex serviceability criterion',
        reason: `${suppliedDelta.key} must be a finite non-negative value.`,
      });
    }
    if (!limit) {
      return makeNotChecked({
        id: 'member-deflection',
        label: 'Serviceability deflection',
        clause: 'Project / National Annex serviceability criterion',
        reason: 'A direct limit_mm or limitSpanRatio and member L_mm are required.',
        values: { deltaEd_mm: Number(suppliedDelta.value), source: 'supplied analysis result' },
      });
    }
    return makeResistanceCheck({
      id: 'member-deflection',
      label: 'Serviceability deflection',
      clause: 'Project / National Annex serviceability criterion',
      demandSymbol: 'δEd',
      demandValue: Number(suppliedDelta.value),
      demandUnit: 'mm',
      resistanceSymbol: 'δlim',
      resistanceValue: limit.value_mm,
      formula: 'ηδ = δEd / δlim',
      substitution: `${Number(suppliedDelta.value).toFixed(3)} / ${limit.value_mm.toFixed(3)}`,
      values: {
        estimated: false,
        source: 'supplied analysis result',
        limitSource: limit.source,
      },
      warningAt,
    });
  }

  const model = serviceability?.model;
  if (!model) {
    return makeNotChecked({
      id: 'member-deflection',
      label: 'Estimated serviceability deflection',
      clause: 'Elastic beam formula — preliminary estimate only',
      reason:
        'Deflection cannot be derived from MEd alone. Supply deltaEd_mm, or a supported ' +
        'serviceability.model with its characteristic/service load.',
      formula:
        'Supported models: simply-supported-udl, simply-supported-midpoint-load, cantilever-tip-load.',
    });
  }

  const inertia = firstValue(section, ['Iy_mm4', 'IY_mm4']);
  if (!validPositive(L_mm) || !validPositive(section.E_MPa) || !validPositive(Number(inertia.value))) {
    return makeNotChecked({
      id: 'member-deflection',
      label: 'Estimated serviceability deflection',
      clause: 'Elastic beam formula — preliminary estimate only',
      reason: 'member.L_mm, section.E_MPa and section.Iy_mm4 are required.',
    });
  }
  if (!limit) {
    return makeNotChecked({
      id: 'member-deflection',
      label: 'Estimated serviceability deflection',
      clause: 'Elastic beam formula — preliminary estimate only',
      reason: 'A direct limit_mm or limitSpanRatio is required to verify the estimated deflection.',
    });
  }

  const E = section.E_MPa;
  const I = Number(inertia.value);
  let delta_mm;
  let formula;
  let substitution;
  const estimateWarnings = [warning(
    'ESTIMATED_DEFLECTION',
    'Deflection uses a closed-form ideal beam model, not the global structural model.',
    'blocking',
  )];

  if (model === 'simply-supported-udl') {
    const load = firstValue(serviceability, ['w_kN_per_m']);
    if (!validNonNegative(Number(load.value))) {
      return makeNotChecked({
        id: 'member-deflection',
        label: 'Estimated serviceability deflection',
        clause: 'Elastic beam formula — preliminary estimate only',
        reason: 'serviceability.w_kN_per_m is required for simply-supported-udl.',
      });
    }
    const w_N_per_mm = Number(load.value); // 1 kN/m = 1 N/mm
    delta_mm = 5 * w_N_per_mm * L_mm ** 4 / (384 * E * I);
    formula = 'δmax = 5·w·L⁴/(384·E·I)';
    substitution =
      `5 · ${w_N_per_mm} N/mm · ${L_mm}⁴ / (384 · ${E} · ${I}) = ${delta_mm.toFixed(3)} mm`;
  } else if (model === 'simply-supported-midpoint-load') {
    const load = firstValue(serviceability, ['P_kN', 'pointLoad_kN']);
    if (!validNonNegative(Number(load.value))) {
      return makeNotChecked({
        id: 'member-deflection',
        label: 'Estimated serviceability deflection',
        clause: 'Elastic beam formula — preliminary estimate only',
        reason: 'serviceability.P_kN is required for simply-supported-midpoint-load.',
      });
    }
    const P_N = Number(load.value) * 1000;
    delta_mm = P_N * L_mm ** 3 / (48 * E * I);
    formula = 'δmax = P·L³/(48·E·I)';
    substitution =
      `${P_N} N · ${L_mm}³ / (48 · ${E} · ${I}) = ${delta_mm.toFixed(3)} mm`;
  } else if (model === 'cantilever-tip-load') {
    const load = firstValue(serviceability, ['P_kN', 'pointLoad_kN']);
    if (!validNonNegative(Number(load.value))) {
      return makeNotChecked({
        id: 'member-deflection',
        label: 'Estimated serviceability deflection',
        clause: 'Elastic beam formula — preliminary estimate only',
        reason: 'serviceability.P_kN is required for cantilever-tip-load.',
      });
    }
    const P_N = Number(load.value) * 1000;
    delta_mm = P_N * L_mm ** 3 / (3 * E * I);
    formula = 'δmax = P·L³/(3·E·I)';
    substitution =
      `${P_N} N · ${L_mm}³ / (3 · ${E} · ${I}) = ${delta_mm.toFixed(3)} mm`;
  } else {
    return makeNotChecked({
      id: 'member-deflection',
      label: 'Estimated serviceability deflection',
      clause: 'Elastic beam formula — preliminary estimate only',
      reason: `Unsupported serviceability.model "${model}".`,
    });
  }

  return makeResistanceCheck({
    id: 'member-deflection',
    label: 'Estimated serviceability deflection',
    clause: 'Elastic beam formula — preliminary estimate only',
    demandSymbol: 'δestimated',
    demandValue: delta_mm,
    demandUnit: 'mm',
    resistanceSymbol: 'δlim',
    resistanceValue: limit.value_mm,
    formula,
    substitution,
    values: {
      estimated: true,
      model,
      deltaEstimated_mm: delta_mm,
      limitSource: limit.source,
    },
    warnings: estimateWarnings,
    warningAt,
    forceWarn: true,
  });
}

function checkLateralTorsionalBuckling(actions, member, warningAt) {
  const moment = firstValue(actions, ['MEd_kNm', 'MyEd_kNm', 'MYEd_kNm']);
  if (!moment.present || !isFiniteNumber(Number(moment.value)) || Math.abs(Number(moment.value)) <= EPSILON) {
    return makeNotApplicable({
      id: 'member-ltb',
      label: 'Lateral-torsional buckling declaration',
      clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.3.2',
      reason: 'No non-zero major-axis bending action is present.',
    });
  }

  if (member.ltbNotRelevant === true) {
    return makeNotApplicable({
      id: 'member-ltb',
      label: 'Lateral-torsional buckling declaration',
      clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.3.2',
      reason: 'member.ltbNotRelevant is explicitly true; the caller is responsible for this declaration.',
    });
  }

  if (validPositive(member.MbRd_kNm)) {
    return makeResistanceCheck({
      id: 'member-ltb',
      label: 'Lateral-torsional buckling resistance supplied by caller',
      clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.3.2',
      demandSymbol: 'My,Ed',
      demandValue: Math.abs(Number(moment.value)),
      demandUnit: 'kN·m',
      resistanceSymbol: 'Mb,Rd',
      resistanceValue: member.MbRd_kNm,
      formula: 'ηLT = |My,Ed| / Mb,Rd',
      substitution: `${Math.abs(Number(moment.value))} / ${member.MbRd_kNm}`,
      values: { source: 'caller-supplied MbRd_kNm' },
      warningAt,
    });
  }

  if (member.requiresLTB === true) {
    return makeNotChecked({
      id: 'member-ltb',
      label: 'Lateral-torsional buckling',
      clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.3.2',
      reason:
        'LTB is declared relevant. Supply a separately validated MbRd_kNm; Mcr/χLT calculation ' +
        'requires restraint, moment-diagram and load-height data outside this preliminary module.',
    });
  }

  return makeUtilizationCheck({
    id: 'member-ltb',
    label: 'Lateral-torsional buckling scope declaration',
    clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.3.2',
    utilization: 0,
    formula: 'Scope declaration required',
    substitution: '',
    warnings: [warning(
      'LTB_SCOPE_UNDECLARED',
      'Major-axis bending is present, but requiresLTB/ltbNotRelevant/MbRd_kNm was not declared.',
      'blocking',
    )],
    forceWarn: true,
    warningAt,
  });
}

function checkMemberInteractions(checks, actions, warningAt) {
  const interactionChecks = [];
  const axial = checks.find((check) => check.id === 'member-axial');
  const bendY = checks.find((check) => check.id === 'member-bending-y');
  const bendZ = checks.find((check) => check.id === 'member-bending-z');
  const buckY = checks.find((check) => check.id === 'member-buckling-y');
  const buckZ = checks.find((check) => check.id === 'member-buckling-z');
  const shearZ = checks.find((check) => check.id === 'member-shear-z');

  const NEd = firstValue(actions, ['NEd_kN', 'N_Ed_kN']);
  const MyEd = firstValue(actions, ['MEd_kNm', 'MyEd_kNm', 'MYEd_kNm']);
  const MzEd = firstValue(actions, ['MzEd_kNm', 'MZEd_kNm']);
  const hasAxial = NEd.present && Math.abs(Number(NEd.value)) > EPSILON;
  const hasMoment =
    (MyEd.present && Math.abs(Number(MyEd.value)) > EPSILON) ||
    (MzEd.present && Math.abs(Number(MzEd.value)) > EPSILON);

  if (!hasAxial || !hasMoment) {
    interactionChecks.push(makeNotApplicable({
      id: 'member-section-interaction-screening',
      label: 'N–M cross-section interaction screening',
      clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.2.9 — simplified screening, not the final equation',
      reason: 'Combined non-zero axial force and bending are not both present.',
    }));
    interactionChecks.push(makeNotApplicable({
      id: 'member-stability-interaction-screening',
      label: 'N–M member stability interaction screening',
      clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.3.3 — simplified screening, not Method 1/2',
      reason: 'Combined compression and bending are not both present.',
    }));
  } else {
    const sectionParts = [axial, bendY, bendZ].filter(
      (check) => check?.applicable !== false && check?.required !== false,
    );
    if (
      sectionParts.length === 0 ||
      sectionParts.some((check) => !check?.utilization || check.status === CHECK_STATUS.NOT_CHECKED)
    ) {
      interactionChecks.push(makeNotChecked({
        id: 'member-section-interaction-screening',
        label: 'N–M cross-section interaction screening',
        clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.2.9 — simplified screening, not the final equation',
        reason: 'One or more component resistances are unavailable.',
      }));
    } else {
      const eta = sectionParts.reduce((sum, check) => sum + check.utilization.value, 0);
      interactionChecks.push(makeUtilizationCheck({
        id: 'member-section-interaction-screening',
        label: 'N–M cross-section interaction screening',
        clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.2.9 — simplified screening, not the final equation',
        utilization: eta,
        formula: 'ηscreen = ηN + ηMy + ηMz',
        substitution: sectionParts.map((check) => check.utilization.value.toFixed(4)).join(' + '),
        warnings: [warning(
          'SIMPLIFIED_INTERACTION',
          'Linear N–M summation is a preliminary screen; use the section-class-specific EC3 interaction.',
          'blocking',
        )],
        forceWarn: true,
        warningAt,
      }));
    }

    if (Number(NEd.value) <= 0) {
      interactionChecks.push(makeNotApplicable({
        id: 'member-stability-interaction-screening',
        label: 'N–M member stability interaction screening',
        clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.3.3',
        reason: 'The axial force is tensile, so compression-member interaction is not applicable.',
      }));
    } else {
      const usableBuckling = [buckY, buckZ].filter(
        (check) => check?.applicable !== false && check?.utilization,
      );
      const usableBending = [bendY, bendZ].filter(
        (check) => check?.applicable !== false && check?.utilization,
      );
      if (
        usableBuckling.length === 0 ||
        usableBending.length === 0 ||
        [...usableBuckling, ...usableBending].some((check) => check.status === CHECK_STATUS.NOT_CHECKED)
      ) {
        interactionChecks.push(makeNotChecked({
          id: 'member-stability-interaction-screening',
          label: 'N–M member stability interaction screening',
          clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.3.3 — simplified screening, not Method 1/2',
          reason: 'Buckling and bending component results are required.',
        }));
      } else {
        const etaBuckling = Math.max(...usableBuckling.map((check) => check.utilization.value));
        const etaBending = usableBending.reduce((sum, check) => sum + check.utilization.value, 0);
        const eta = etaBuckling + etaBending;
        interactionChecks.push(makeUtilizationCheck({
          id: 'member-stability-interaction-screening',
          label: 'N–M member stability interaction screening',
          clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.3.3 — simplified screening, not Method 1/2',
          utilization: eta,
          formula: 'ηscreen = max(ηNb,y, ηNb,z) + ηMy + ηMz',
          substitution: `${etaBuckling.toFixed(4)} + ${etaBending.toFixed(4)}`,
          warnings: [warning(
            'SIMPLIFIED_MEMBER_INTERACTION',
            'This does not calculate EC3 Method 1/2 interaction factors kij.',
            'blocking',
          )],
          forceWarn: true,
          warningAt,
        }));
      }
    }
  }

  const bendingPresent = hasMoment;
  if (
    bendingPresent &&
    shearZ?.utilization &&
    shearZ.utilization.value > 0.5 + EPSILON
  ) {
    interactionChecks.push(makeNotChecked({
      id: 'member-high-shear-bending',
      label: 'High-shear reduction of bending resistance',
      clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.2.8',
      reason:
        'VEd exceeds 0.5·VRd. Reduced bending resistance requires section-specific data and is not ' +
        'calculated by this preliminary module.',
      values: { shearUtilization: shearZ.utilization.value },
    }));
  } else {
    interactionChecks.push(makeNotApplicable({
      id: 'member-high-shear-bending',
      label: 'High-shear reduction of bending resistance',
      clause: 'Código Estructural · Anejo 22 · EN 1993-1-1 §6.2.8',
      reason: bendingPresent
        ? 'The checked shear utilization does not exceed 0.5.'
        : 'No non-zero bending action is present.',
    }));
  }

  return interactionChecks;
}

/**
 * Preliminary member check.
 *
 * Required input shape (all suffixes are units):
 * {
 *   actions: { NEd_kN, MEd_kNm, VEd_kN, MzEd_kNm? },
 *   section: {
 *     sectionClass, A_mm2, Aeff_mm2?, Anet_mm2?, fy_MPa, fu_MPa?,
 *     Av_mm2 or Avz_mm2, Iy_mm4, Iz_mm4,
 *     WplY_mm3/WelY_mm3/WeffY_mm3, WplZ_mm3/WelZ_mm3/WeffZ_mm3,
 *     E_MPa, holesAbsent?
 *   },
 *   member: {
 *     L_mm, LcrY_mm, LcrZ_mm, bucklingCurveY, bucklingCurveZ,
 *     ltbNotRelevant | requiresLTB | MbRd_kNm
 *   },
 *   serviceability: {
 *     deltaEd_mm and limit_mm|limitSpanRatio
 *     OR model + service load + limit
 *     OR notRequired: true
 *   },
 *   standardContext: { gammaM0?, gammaM1?, gammaM2? },
 *   options: { warningUtilization?: 0.85 }
 * }
 *
 * NEd sign convention: compression positive, tension negative.
 * MEd_kNm maps to major-axis My,Ed. VEd_kN maps to local Vz,Ed.
 */
export function checkMemberEC3(input = {}) {
  const actions = input.actions || {};
  const section = input.section || {};
  const member = input.member || {};
  const serviceability = input.serviceability || {};
  const context = resolveGamma(input.standardContext || input.designContext || {});
  const warningAt = validNonNegative(input.options?.warningUtilization)
    ? input.options.warningUtilization
    : DEFAULT_WARNING_UTILIZATION;
  const sectionClass = resolveSectionClass(section);

  // The singular M/V API is deliberately mapped to major-axis bending and its
  // associated local shear direction.
  const normalizedActions = { ...actions };
  if (hasOwn(actions, 'MEd_kNm') && !hasOwn(actions, 'MyEd_kNm')) {
    normalizedActions.MyEd_kNm = actions.MEd_kNm;
  }
  if (hasOwn(actions, 'VEd_kN') && !hasOwn(actions, 'VzEd_kN')) {
    normalizedActions.VzEd_kN = actions.VEd_kN;
  }

  const checks = [
    checkAxialResistance(normalizedActions, section, context, sectionClass, warningAt),
    checkBendingAxis(
      normalizedActions,
      section,
      context,
      sectionClass,
      'y',
      ['MyEd_kNm', 'MYEd_kNm'],
      warningAt,
    ),
    checkBendingAxis(
      normalizedActions,
      section,
      context,
      sectionClass,
      'z',
      ['MzEd_kNm', 'MZEd_kNm'],
      warningAt,
    ),
    checkShearAxis(
      normalizedActions,
      section,
      context,
      'z',
      ['VzEd_kN', 'VZEd_kN'],
      ['Avz_mm2', 'Av_mm2'],
      warningAt,
      true,
    ),
    checkShearAxis(
      normalizedActions,
      section,
      context,
      'y',
      ['VyEd_kN', 'VYEd_kN'],
      ['Avy_mm2'],
      warningAt,
      false,
    ),
    checkBucklingAxis(normalizedActions, section, member, context, sectionClass, 'y', warningAt),
    checkBucklingAxis(normalizedActions, section, member, context, sectionClass, 'z', warningAt),
    checkLateralTorsionalBuckling(normalizedActions, member, warningAt),
    checkDeflection(section, member, serviceability, warningAt),
  ];

  checks.push(...checkMemberInteractions(checks, normalizedActions, warningAt));
  const summary = summarizeChecks(checks);

  return {
    kind: 'member-check',
    scope: 'preliminary sizing; explicit checks only',
    standard: EC3_STANDARD.member,
    status: summary.status,
    unitSystem: INTERNAL_UNITS,
    inputConvention: {
      NEd_kN: 'compression positive; tension negative',
      MEd_kNm: 'major-axis My,Ed',
      VEd_kN: 'local Vz,Ed',
    },
    standardContext: context,
    inputs: {
      actions: normalizedActions,
      section,
      member,
      serviceability,
    },
    checks,
    summary,
    warnings: collectWarnings(checks, [
      warning(
        'PRELIMINARY_SCOPE',
        'No global analysis, second-order analysis, imperfections, fatigue, fire, seismic, or full Class 4 effective-section calculation is performed.',
        'info',
      ),
    ]),
  };
}

function resolveBoltData(bolt = {}) {
  const catalog = bolt.metric ? BOLT_SIZES[bolt.metric] : null;
  const gradeData = bolt.grade ? BOLT_GRADES[String(bolt.grade)] : null;
  const diameter_mm = validPositive(bolt.diameter_mm)
    ? bolt.diameter_mm
    : catalog?.diameter_mm;
  const stressArea_mm2 = validPositive(bolt.stressArea_mm2)
    ? bolt.stressArea_mm2
    : catalog?.stressArea_mm2;
  const grossArea_mm2 = validPositive(bolt.grossArea_mm2)
    ? bolt.grossArea_mm2
    : validPositive(diameter_mm)
      ? Math.PI * diameter_mm ** 2 / 4
      : null;
  const fub_MPa = validPositive(bolt.fub_MPa) ? bolt.fub_MPa : gradeData?.fub_MPa;
  const fyb_MPa = validPositive(bolt.fyb_MPa) ? bolt.fyb_MPa : gradeData?.fyb_MPa;
  const alphaV = validPositive(bolt.alphaV) ? bolt.alphaV : gradeData?.alphaV;
  const holeDiameter_mm = validPositive(bolt.holeDiameter_mm)
    ? bolt.holeDiameter_mm
    : catalog?.normalHoleDiameter_mm;

  return {
    metric: bolt.metric || null,
    grade: bolt.grade ? String(bolt.grade) : null,
    diameter_mm,
    stressArea_mm2,
    grossArea_mm2,
    normalHoleDiameter_mm: holeDiameter_mm,
    fub_MPa,
    fyb_MPa,
    alphaV,
    k2: validPositive(bolt.k2) ? bolt.k2 : bolt.countersunk === true ? 0.63 : 0.9,
    threadsInShearPlane: typeof bolt.threadsInShearPlane === 'boolean'
      ? bolt.threadsInShearPlane
      : null,
    shearPlanes: Number.isInteger(bolt.shearPlanes) && bolt.shearPlanes > 0
      ? bolt.shearPlanes
      : null,
    countersunk: bolt.countersunk === true,
  };
}

/**
 * Produces centered local bolt coordinates for an N×M matrix.
 * rows run along local y, columns along local x.
 */
export function generateBoltMatrix(matrix = {}) {
  if (Array.isArray(matrix.positions_mm) && matrix.positions_mm.length > 0) {
    const positions = [];
    const errors = [];
    matrix.positions_mm.forEach((position, index) => {
      if (!isFiniteNumber(position?.x_mm) || !isFiniteNumber(position?.y_mm)) {
        errors.push(`positions_mm[${index}] must contain finite x_mm and y_mm.`);
      } else {
        positions.push({
          id: position.id || `b${index + 1}`,
          row: position.row ?? null,
          column: position.column ?? null,
          x_mm: position.x_mm,
          y_mm: position.y_mm,
        });
      }
    });
    return {
      ok: errors.length === 0,
      positions,
      rows: null,
      columns: null,
      rowSpacing_mm: null,
      columnSpacing_mm: null,
      errors,
    };
  }

  const rows = Number(matrix.rows);
  const columns = Number(matrix.columns ?? matrix.cols);
  const rowSpacing_mm = Number(matrix.rowSpacing_mm ?? matrix.pitchY_mm);
  const columnSpacing_mm = Number(matrix.columnSpacing_mm ?? matrix.pitchX_mm);
  const errors = [];

  if (!Number.isInteger(rows) || rows < 1) errors.push('matrix.rows must be an integer ≥ 1.');
  if (!Number.isInteger(columns) || columns < 1) errors.push('matrix.columns must be an integer ≥ 1.');
  if (rows > 1 && !validPositive(rowSpacing_mm)) {
    errors.push('matrix.rowSpacing_mm must be > 0 when rows > 1.');
  }
  if (columns > 1 && !validPositive(columnSpacing_mm)) {
    errors.push('matrix.columnSpacing_mm must be > 0 when columns > 1.');
  }
  if (errors.length) {
    return {
      ok: false,
      positions: [],
      rows,
      columns,
      rowSpacing_mm,
      columnSpacing_mm,
      errors,
    };
  }

  const positions = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      positions.push({
        id: `r${row + 1}c${column + 1}`,
        row: row + 1,
        column: column + 1,
        x_mm: columns === 1 ? 0 : (column - (columns - 1) / 2) * columnSpacing_mm,
        y_mm: rows === 1 ? 0 : (row - (rows - 1) / 2) * rowSpacing_mm,
      });
    }
  }

  return {
    ok: true,
    positions,
    rows,
    columns,
    rowSpacing_mm: rows === 1 ? 0 : rowSpacing_mm,
    columnSpacing_mm: columns === 1 ? 0 : columnSpacing_mm,
    errors: [],
  };
}

function resolveBoltActions(actions = {}) {
  const normal = firstValue(actions, ['NEd_kN', 'FtEd_kN']);
  const scalarShear = firstValue(actions, ['VEd_kN']);
  const vx = firstValue(actions, ['VxEd_kN']);
  const vy = firstValue(actions, ['VyEd_kN']);
  const scalarMoment = firstValue(actions, ['MEd_kNm']);
  const mx = firstValue(actions, ['MxEd_kNm']);
  const my = firstValue(actions, ['MyEd_kNm']);
  const mz = firstValue(actions, ['MzEd_kNm', 'TEd_kNm']);

  return {
    presence: {
      normal: normal.present,
      shear: scalarShear.present || vx.present || vy.present,
      moment: scalarMoment.present || mx.present || my.present || mz.present,
    },
    NEd_kN: normal.present ? Number(normal.value) : null,
    VxEd_kN: vx.present ? Number(vx.value) : scalarShear.present ? Number(scalarShear.value) : 0,
    VyEd_kN: vy.present ? Number(vy.value) : 0,
    MxEd_kNm: mx.present ? Number(mx.value) : scalarMoment.present ? Number(scalarMoment.value) : 0,
    MyEd_kNm: my.present ? Number(my.value) : 0,
    MzEd_kNm: mz.present ? Number(mz.value) : 0,
    convention: {
      NEd_kN: 'positive tension normal to the plate; negative compression',
      VEd_kN: 'maps to local Vx',
      MEd_kNm: 'maps to Mx and creates a tension gradient along matrix rows (y)',
      MzEd_kNm: 'torsion about the bolt-group normal',
    },
  };
}

function distributeBoltGroupActions(matrixResult, actions) {
  const errors = [];
  const warnings = [];
  if (!matrixResult.ok || matrixResult.positions.length === 0) {
    return {
      ok: false,
      perBolt: [],
      errors: [...matrixResult.errors],
      warnings,
      properties: {},
    };
  }
  if (!actions.presence.normal) errors.push('actions.NEd_kN must be supplied explicitly; use 0 when absent.');
  if (!actions.presence.shear) errors.push('actions.VEd_kN or VxEd_kN/VyEd_kN must be supplied explicitly; use 0 when absent.');
  if (!actions.presence.moment) errors.push('actions.MEd_kNm or a moment component must be supplied explicitly; use 0 when absent.');

  const numericValues = [
    actions.NEd_kN,
    actions.VxEd_kN,
    actions.VyEd_kN,
    actions.MxEd_kNm,
    actions.MyEd_kNm,
    actions.MzEd_kNm,
  ];
  if (numericValues.some((value) => !isFiniteNumber(value))) {
    errors.push('All supplied bolt-group actions must be finite numbers.');
  }
  if (errors.length) {
    return { ok: false, perBolt: [], errors, warnings, properties: {} };
  }

  const positions = matrixResult.positions;
  const count = positions.length;
  const sumX2 = positions.reduce((sum, bolt) => sum + bolt.x_mm ** 2, 0);
  const sumY2 = positions.reduce((sum, bolt) => sum + bolt.y_mm ** 2, 0);
  const polarJ_mm2 = sumX2 + sumY2;

  if (Math.abs(actions.MxEd_kNm) > EPSILON && sumY2 <= EPSILON) {
    errors.push('MxEd cannot be distributed because all bolt y coordinates are zero.');
  }
  if (Math.abs(actions.MyEd_kNm) > EPSILON && sumX2 <= EPSILON) {
    errors.push('MyEd cannot be distributed because all bolt x coordinates are zero.');
  }
  if (Math.abs(actions.MzEd_kNm) > EPSILON && polarJ_mm2 <= EPSILON) {
    errors.push('MzEd/TEd cannot be distributed because the bolt-group polar coordinate sum is zero.');
  }
  if (errors.length) {
    return {
      ok: false,
      perBolt: [],
      errors,
      warnings,
      properties: { count, sumX2_mm2: sumX2, sumY2_mm2: sumY2, polarJ_mm2 },
    };
  }

  const N_N = actions.NEd_kN * 1000;
  const Vx_N = actions.VxEd_kN * 1000;
  const Vy_N = actions.VyEd_kN * 1000;
  const Mx_Nmm = actions.MxEd_kNm * 1e6;
  const My_Nmm = actions.MyEd_kNm * 1e6;
  const Mz_Nmm = actions.MzEd_kNm * 1e6;
  let compressionClipped = false;

  const perBolt = positions.map((bolt) => {
    const directNormal_N = N_N / count;
    const fromMx_N = sumY2 > EPSILON ? Mx_Nmm * bolt.y_mm / sumY2 : 0;
    const fromMy_N = sumX2 > EPSILON ? My_Nmm * bolt.x_mm / sumX2 : 0;
    const tensionRaw_N = directNormal_N + fromMx_N + fromMy_N;
    const tension_N = Math.max(0, tensionRaw_N);
    if (tensionRaw_N < -EPSILON) compressionClipped = true;

    const shearX_N = Vx_N / count - (polarJ_mm2 > EPSILON ? Mz_Nmm * bolt.y_mm / polarJ_mm2 : 0);
    const shearY_N = Vy_N / count + (polarJ_mm2 > EPSILON ? Mz_Nmm * bolt.x_mm / polarJ_mm2 : 0);
    const shear_N = Math.hypot(shearX_N, shearY_N);

    return {
      ...bolt,
      demand: {
        tensionRaw_kN: tensionRaw_N / 1000,
        tension_kN: tension_N / 1000,
        shearX_kN: shearX_N / 1000,
        shearY_kN: shearY_N / 1000,
        shear_kN: shear_N / 1000,
      },
      components: {
        directNormal_kN: directNormal_N / 1000,
        fromMx_kN: fromMx_N / 1000,
        fromMy_kN: fromMy_N / 1000,
      },
    };
  });

  if (compressionClipped) {
    warnings.push(warning(
      'BOLT_COMPRESSION_CLIPPED',
      'Negative elastic bolt tension was clipped to zero. Contact-block redistribution and prying are not modelled.',
      'blocking',
    ));
  }

  return {
    ok: true,
    perBolt,
    errors: [],
    warnings,
    properties: {
      count,
      sumX2_mm2: sumX2,
      sumY2_mm2: sumY2,
      polarJ_mm2,
      method:
        'Elastic bolt-group distribution: direct N/V plus Mx/My tension gradients and Mz tangential shear.',
    },
  };
}

function resolvePlateBearingGeometry(plate, matrixResult, holeDiameter_mm) {
  const columns = matrixResult.columns;
  const rows = matrixResult.rows;
  const p1 = validPositive(plate.p1_mm)
    ? plate.p1_mm
    : matrixResult.columnSpacing_mm > 0
      ? matrixResult.columnSpacing_mm
      : null;
  const p2 = validPositive(plate.p2_mm)
    ? plate.p2_mm
    : matrixResult.rowSpacing_mm > 0
      ? matrixResult.rowSpacing_mm
      : null;

  let e1 = validPositive(plate.e1_mm) ? plate.e1_mm : null;
  let e2 = validPositive(plate.e2_mm) ? plate.e2_mm : null;
  if (!e1 && validPositive(plate.width_mm) && Number.isInteger(columns)) {
    const occupied = Math.max(0, columns - 1) * (matrixResult.columnSpacing_mm || 0);
    e1 = (plate.width_mm - occupied) / 2;
  }
  if (!e2 && validPositive(plate.height_mm) && Number.isInteger(rows)) {
    const occupied = Math.max(0, rows - 1) * (matrixResult.rowSpacing_mm || 0);
    e2 = (plate.height_mm - occupied) / 2;
  }

  return {
    d0_mm: validPositive(plate.holeDiameter_mm) ? plate.holeDiameter_mm : holeDiameter_mm,
    e1_mm: e1,
    e2_mm: e2,
    p1_mm: p1,
    p2_mm: p2,
  };
}

function calculateBoltCapacities(boltData, plate, bearingGeometry, context) {
  const errors = [];
  const warnings = [];
  if (!validPositive(boltData.diameter_mm)) errors.push('bolt diameter_mm or a supported metric is required.');
  if (!validPositive(boltData.stressArea_mm2)) errors.push('bolt stressArea_mm2 or a supported metric is required.');
  if (!validPositive(boltData.grossArea_mm2)) errors.push('bolt grossArea_mm2 or diameter_mm is required.');
  if (!validPositive(boltData.fub_MPa)) errors.push('bolt fub_MPa or a supported grade is required.');
  if (!validPositive(boltData.alphaV)) errors.push('bolt alphaV or a supported grade is required.');
  if (boltData.threadsInShearPlane === null) {
    errors.push('bolt.threadsInShearPlane must be explicitly true or false.');
  }
  if (!Number.isInteger(boltData.shearPlanes)) {
    errors.push('bolt.shearPlanes must be an integer ≥ 1.');
  }

  let FvRd_kN = null;
  let FtRd_kN = null;
  let FbRd_kN = null;
  let alphaB = null;
  let k1 = null;
  let shearArea_mm2 = null;

  if (!errors.length) {
    shearArea_mm2 = boltData.threadsInShearPlane
      ? boltData.stressArea_mm2
      : boltData.grossArea_mm2;
    FvRd_kN =
      boltData.alphaV *
      boltData.fub_MPa *
      shearArea_mm2 *
      boltData.shearPlanes /
      context.gammaM2 /
      1000;
    FtRd_kN =
      boltData.k2 *
      boltData.fub_MPa *
      boltData.stressArea_mm2 /
      context.gammaM2 /
      1000;
  }

  const bearingMissing = [];
  if (!validPositive(plate.t_mm)) bearingMissing.push('plate.t_mm');
  if (!validPositive(plate.fu_MPa)) bearingMissing.push('plate.fu_MPa');
  if (!validPositive(bearingGeometry.d0_mm)) bearingMissing.push('plate.holeDiameter_mm or catalog d0');
  if (!validPositive(bearingGeometry.e1_mm)) bearingMissing.push('plate.e1_mm or plate.width_mm');
  if (!validPositive(bearingGeometry.e2_mm)) bearingMissing.push('plate.e2_mm or plate.height_mm');
  if (!validPositive(boltData.diameter_mm)) bearingMissing.push('bolt diameter_mm');
  if (!validPositive(boltData.fub_MPa)) bearingMissing.push('bolt fub_MPa');

  if (!bearingMissing.length) {
    const alphaCandidates = [
      bearingGeometry.e1_mm / (3 * bearingGeometry.d0_mm),
      boltData.fub_MPa / plate.fu_MPa,
      1,
    ];
    if (validPositive(bearingGeometry.p1_mm)) {
      alphaCandidates.push(bearingGeometry.p1_mm / (3 * bearingGeometry.d0_mm) - 0.25);
    }
    alphaB = Math.max(0, Math.min(...alphaCandidates));

    const k1Candidates = [
      2.8 * bearingGeometry.e2_mm / bearingGeometry.d0_mm - 1.7,
      2.5,
    ];
    if (validPositive(bearingGeometry.p2_mm)) {
      k1Candidates.push(1.4 * bearingGeometry.p2_mm / bearingGeometry.d0_mm - 1.7);
    }
    k1 = Math.max(0, Math.min(...k1Candidates));
    FbRd_kN =
      k1 *
      alphaB *
      plate.fu_MPa *
      boltData.diameter_mm *
      plate.t_mm /
      context.gammaM2 /
      1000;
  }

  if (boltData.metric === 'M16' && boltData.grade === '8.8' && !boltData.countersunk) {
    const reference = 0.9 * 800 * 157 / context.gammaM2 / 1000;
    if (FtRd_kN !== null && Math.abs(FtRd_kN - reference) > 1e-9) {
      warnings.push(warning(
        'M16_REFERENCE_MISMATCH',
        'Internal M16 8.8 tensile-resistance reference did not match the expected value.',
        'blocking',
      ));
    }
  }

  return {
    okForBolt: errors.length === 0,
    errors,
    bearingMissing,
    warnings,
    values: {
      shearArea_mm2,
      FvRd_kN,
      FtRd_kN,
      FbRd_kN,
      alphaB,
      k1,
      bearingGeometry,
    },
  };
}

function boltSpacingCheck(bearingGeometry, matrixResult, warningAt) {
  const d0 = bearingGeometry.d0_mm;
  if (!validPositive(d0) || !validPositive(bearingGeometry.e1_mm) || !validPositive(bearingGeometry.e2_mm)) {
    return makeNotChecked({
      id: 'bolt-spacing',
      label: 'Minimum bolt spacing and edge distances',
      clause: 'Código Estructural · Anejo 26 · EN 1993-1-8 Table 3.3 — normal round holes',
      reason: 'd0, e1 and e2 are required.',
    });
  }

  const ratios = [
    { name: '1.2d0/e1', value: 1.2 * d0 / bearingGeometry.e1_mm },
    { name: '1.2d0/e2', value: 1.2 * d0 / bearingGeometry.e2_mm },
  ];
  if (matrixResult.columns > 1) {
    if (!validPositive(bearingGeometry.p1_mm)) {
      return makeNotChecked({
        id: 'bolt-spacing',
        label: 'Minimum bolt spacing and edge distances',
        clause: 'Código Estructural · Anejo 26 · EN 1993-1-8 Table 3.3 — normal round holes',
        reason: 'p1_mm is required when the matrix has more than one column.',
      });
    }
    ratios.push({ name: '2.2d0/p1', value: 2.2 * d0 / bearingGeometry.p1_mm });
  }
  if (matrixResult.rows > 1) {
    if (!validPositive(bearingGeometry.p2_mm)) {
      return makeNotChecked({
        id: 'bolt-spacing',
        label: 'Minimum bolt spacing and edge distances',
        clause: 'Código Estructural · Anejo 26 · EN 1993-1-8 Table 3.3 — normal round holes',
        reason: 'p2_mm is required when the matrix has more than one row.',
      });
    }
    ratios.push({ name: '2.4d0/p2', value: 2.4 * d0 / bearingGeometry.p2_mm });
  }

  const utilization = Math.max(...ratios.map((item) => item.value));
  return makeUtilizationCheck({
    id: 'bolt-spacing',
    label: 'Minimum bolt spacing and edge distances',
    clause: 'Código Estructural · Anejo 26 · EN 1993-1-8 Table 3.3 — normal round holes',
    utilization,
    formula: 'e1,e2 ≥ 1.2d0; p1 ≥ 2.2d0; p2 ≥ 2.4d0',
    substitution: ratios.map((item) => `${item.name}=${item.value.toFixed(3)}`).join('; '),
    values: { ratios, ...bearingGeometry },
    warningAt,
  });
}

function governingBoltCheck({
  id,
  label,
  clause,
  perBolt,
  demandAccessor,
  resistanceSymbol,
  resistance_kN,
  formula,
  substitution,
  values,
  warnings,
  warningAt,
  forceWarn,
}) {
  if (!validPositive(resistance_kN)) {
    return makeNotChecked({
      id,
      label,
      clause,
      reason: `${resistanceSymbol} could not be calculated.`,
      formula,
      values,
      warnings,
    });
  }
  const governing = perBolt
    .map((bolt) => ({ bolt, demand: demandAccessor(bolt) }))
    .sort((a, b) => b.demand - a.demand)[0];

  return makeResistanceCheck({
    id,
    label,
    clause,
    demandSymbol: 'FEd,max',
    demandValue: governing?.demand || 0,
    demandUnit: 'kN/bolt',
    resistanceSymbol,
    resistanceValue: resistance_kN,
    resistanceUnit: 'kN/bolt',
    formula,
    substitution,
    values: {
      ...values,
      governingBoltId: governing?.bolt?.id || null,
    },
    warnings,
    warningAt,
    forceWarn,
  });
}

/**
 * Preliminary N×M bearing-type bolt group check.
 *
 * Required scalar action API:
 * actions: { NEd_kN, VEd_kN, MEd_kNm }
 * - NEd is positive for tension normal to the plate.
 * - VEd maps to local Vx.
 * - MEd maps to local Mx, generating a row-wise tension gradient.
 *
 * Full components Vx/Vy and Mx/My/Mz are also accepted.
 *
 * Example reference: a non-countersunk M16 8.8 bolt has
 * Ft,Rd = 0.9·800·157/1.25 = 90.432 kN, not 67.8 kN.
 */
export function checkBoltGroupEC3(input = {}) {
  const bolt = input.bolt || {};
  const plate = input.plate || {};
  const matrix = input.matrix || {};
  const context = resolveGamma(input.standardContext || input.designContext || {});
  const warningAt = validNonNegative(input.options?.warningUtilization)
    ? input.options.warningUtilization
    : DEFAULT_WARNING_UTILIZATION;
  const matrixResult = generateBoltMatrix(matrix);
  const actions = resolveBoltActions(input.actions || {});
  const distribution = distributeBoltGroupActions(matrixResult, actions);
  const boltData = resolveBoltData(bolt);
  const bearingGeometry = resolvePlateBearingGeometry(
    plate,
    matrixResult,
    boltData.normalHoleDiameter_mm,
  );
  const capacities = calculateBoltCapacities(boltData, plate, bearingGeometry, context);
  const checks = [];

  if (!distribution.ok) {
    checks.push(makeNotChecked({
      id: 'bolt-group-distribution',
      label: 'Elastic N/V/M distribution to bolt matrix',
      clause: 'Elastic preliminary bolt-group model',
      reason: distribution.errors.join(' '),
      formula:
        'Ft,i=N/n+Mx·yi/Σy²+My·xi/Σx²; ' +
        'Fvx,i=Vx/n−Mz·yi/J; Fvy,i=Vy/n+Mz·xi/J',
    }));
  } else {
    checks.push(makeUtilizationCheck({
      id: 'bolt-group-distribution',
      label: 'Elastic N/V/M distribution to bolt matrix',
      clause: 'Elastic preliminary bolt-group model',
      utilization: 0,
      formula:
        'Ft,i=N/n+Mx·yi/Σy²+My·xi/Σx²; ' +
        'Fvx,i=Vx/n−Mz·yi/J; Fvy,i=Vy/n+Mz·xi/J',
      substitution:
        `n=${distribution.properties.count}; Σx²=${distribution.properties.sumX2_mm2}; ` +
        `Σy²=${distribution.properties.sumY2_mm2}; J=${distribution.properties.polarJ_mm2}`,
      values: distribution.properties,
      warnings: distribution.warnings,
      forceWarn: distribution.warnings.some((item) => item.severity === 'blocking'),
      warningAt,
    }));
  }

  checks.push(boltSpacingCheck(bearingGeometry, matrixResult, warningAt));

  const perBolt = distribution.perBolt;
  const commonWarnings = [...capacities.warnings];
  const directionApproximation =
    distribution.ok &&
    (Math.abs(actions.VyEd_kN) > EPSILON || Math.abs(actions.MzEd_kNm) > EPSILON);
  if (directionApproximation) {
    commonWarnings.push(warning(
      'BEARING_DIRECTION_APPROXIMATION',
      'One conservative e1/e2/p1/p2 set is used although the resultant bolt shear direction varies.',
      'blocking',
    ));
  }

  if (!distribution.ok || !capacities.okForBolt) {
    const reason = !distribution.ok
      ? 'Bolt demands were not distributed.'
      : capacities.errors.join(' ');
    ['bolt-shear', 'bolt-tension', 'bolt-interaction'].forEach((id) => {
      checks.push(makeNotChecked({
        id,
        label: id === 'bolt-shear'
          ? 'Bolt shear resistance'
          : id === 'bolt-tension'
            ? 'Bolt tensile resistance'
            : 'Combined bolt shear and tension',
        clause: 'Código Estructural · Anejo 26 · EN 1993-1-8 Table 3.4',
        reason,
      }));
    });
  } else {
    checks.push(governingBoltCheck({
      id: 'bolt-shear',
      label: 'Bolt shear resistance',
      clause: 'Código Estructural · Anejo 26 · EN 1993-1-8 Table 3.4',
      perBolt,
      demandAccessor: (item) => item.demand.shear_kN,
      resistanceSymbol: 'Fv,Rd',
      resistance_kN: capacities.values.FvRd_kN,
      formula: 'Fv,Rd = αv · fub · A · nshearPlanes / γM2',
      substitution:
        `${boltData.alphaV} · ${boltData.fub_MPa} · ${capacities.values.shearArea_mm2} · ` +
        `${boltData.shearPlanes} / ${context.gammaM2} / 1000 = ` +
        `${capacities.values.FvRd_kN?.toFixed(3)} kN`,
      values: {
        alphaV: boltData.alphaV,
        shearArea_mm2: capacities.values.shearArea_mm2,
        threadsInShearPlane: boltData.threadsInShearPlane,
        shearPlanes: boltData.shearPlanes,
      },
      warnings: commonWarnings,
      warningAt,
      forceWarn: directionApproximation,
    }));

    checks.push(governingBoltCheck({
      id: 'bolt-tension',
      label: 'Bolt tensile resistance',
      clause: 'Código Estructural · Anejo 26 · EN 1993-1-8 Table 3.4',
      perBolt,
      demandAccessor: (item) => item.demand.tension_kN,
      resistanceSymbol: 'Ft,Rd',
      resistance_kN: capacities.values.FtRd_kN,
      formula: 'Ft,Rd = k2 · fub · As / γM2',
      substitution:
        `${boltData.k2} · ${boltData.fub_MPa} · ${boltData.stressArea_mm2} / ` +
        `${context.gammaM2} / 1000 = ${capacities.values.FtRd_kN?.toFixed(3)} kN`,
      values: {
        k2: boltData.k2,
        stressArea_mm2: boltData.stressArea_mm2,
        countersunk: boltData.countersunk,
      },
      warnings: distribution.warnings,
      warningAt,
      forceWarn: distribution.warnings.some((item) => item.severity === 'blocking'),
    }));

    const interactionPerBolt = perBolt.map((item) => ({
      boltId: item.id,
      utilization:
        item.demand.shear_kN / capacities.values.FvRd_kN +
        item.demand.tension_kN / (1.4 * capacities.values.FtRd_kN),
    }));
    const governingInteraction = interactionPerBolt
      .slice()
      .sort((a, b) => b.utilization - a.utilization)[0];
    checks.push(makeUtilizationCheck({
      id: 'bolt-interaction',
      label: 'Combined bolt shear and tension',
      clause: 'Código Estructural · Anejo 26 · EN 1993-1-8 Table 3.4',
      utilization: governingInteraction?.utilization ?? null,
      formula: 'Fv,Ed/Fv,Rd + Ft,Ed/(1.4·Ft,Rd) ≤ 1',
      substitution: governingInteraction
        ? `governing bolt ${governingInteraction.boltId}: ${governingInteraction.utilization.toFixed(4)}`
        : '',
      values: {
        governingBoltId: governingInteraction?.boltId || null,
        perBolt: interactionPerBolt,
      },
      warnings: distribution.warnings,
      forceWarn: distribution.warnings.some((item) => item.severity === 'blocking'),
      warningAt,
    }));
  }

  if (!distribution.ok || !validPositive(capacities.values.FbRd_kN)) {
    checks.push(makeNotChecked({
      id: 'plate-bearing',
      label: 'Plate bearing resistance at bolt holes',
      clause: 'Código Estructural · Anejo 26 · EN 1993-1-8 Table 3.4',
      reason: !distribution.ok
        ? 'Bolt demands were not distributed.'
        : `Missing or invalid: ${capacities.bearingMissing.join(', ')}.`,
      formula: 'Fb,Rd = k1 · αb · fu · d · t / γM2',
    }));
  } else {
    checks.push(governingBoltCheck({
      id: 'plate-bearing',
      label: 'Plate bearing resistance at bolt holes',
      clause: 'Código Estructural · Anejo 26 · EN 1993-1-8 Table 3.4',
      perBolt,
      demandAccessor: (item) => item.demand.shear_kN,
      resistanceSymbol: 'Fb,Rd',
      resistance_kN: capacities.values.FbRd_kN,
      formula: 'Fb,Rd = k1 · αb · fu · d · t / γM2',
      substitution:
        `${capacities.values.k1?.toFixed(4)} · ${capacities.values.alphaB?.toFixed(4)} · ` +
        `${plate.fu_MPa} · ${boltData.diameter_mm} · ${plate.t_mm} / ${context.gammaM2} / 1000 = ` +
        `${capacities.values.FbRd_kN?.toFixed(3)} kN`,
      values: {
        k1: capacities.values.k1,
        alphaB: capacities.values.alphaB,
        ...bearingGeometry,
      },
      warnings: commonWarnings,
      warningAt,
      forceWarn: directionApproximation,
    }));
  }

  const summary = summarizeChecks(checks);
  return {
    kind: 'bolt-group-check',
    scope: 'preliminary bearing-type, non-preloaded bolt group',
    standard: EC3_STANDARD.joints,
    status: summary.status,
    unitSystem: INTERNAL_UNITS,
    inputConvention: actions.convention,
    standardContext: context,
    inputs: {
      bolt: { ...bolt, resolved: boltData },
      plate,
      matrix,
      actions,
    },
    matrix: matrixResult,
    distribution: {
      method: distribution.properties.method || null,
      properties: distribution.properties,
      perBolt,
    },
    capacities: capacities.values,
    checks,
    summary,
    warnings: collectWarnings(checks, [
      warning(
        'PRELIMINARY_BOLT_SCOPE',
        'Block tearing, net-section failure, punching, prying, slip, fatigue, plate bending and the EC3 component method are outside this check.',
        'info',
      ),
    ]),
  };
}

function resolveWeldBeta(weld) {
  if (validPositive(weld.betaW)) return { betaW: weld.betaW, source: 'explicit betaW' };
  const grade = String(weld.steelGrade || '').toUpperCase().replace(/\s+/g, '');
  const key = Object.keys(WELD_CORRELATION_FACTORS).find((candidate) => grade.startsWith(candidate));
  return key
    ? { betaW: WELD_CORRELATION_FACTORS[key], source: `steelGrade ${key}` }
    : null;
}

/**
 * Preliminary fillet-weld check using the simplified Código Estructural · Anejo 26 · EN 1993-1-8 method.
 *
 * Input:
 * {
 *   actions: { FEd_kN },
 *   weld: {
 *     throat_mm,
 *     effectiveLength_mm, // total effective length of all checked weld segments
 *     fu_MPa, betaW | steelGrade
 *   },
 *   standardContext: { gammaM2?: 1.25 }
 * }
 */
export function checkFilletWeldEC3(input = {}) {
  const actions = input.actions || {};
  const weld = input.weld || {};
  const context = resolveGamma(input.standardContext || input.designContext || {});
  const warningAt = validNonNegative(input.options?.warningUtilization)
    ? input.options.warningUtilization
    : DEFAULT_WARNING_UTILIZATION;
  const action = firstValue(actions, ['FEd_kN', 'FwEd_kN']);
  const effectiveLength = firstValue(weld, ['effectiveLength_mm']);
  const grossLength = firstValue(weld, ['length_mm']);
  const length = effectiveLength.present ? effectiveLength : grossLength;
  const beta = resolveWeldBeta(weld);
  const checks = [];
  const inputWarnings = [];

  if (!effectiveLength.present && grossLength.present) {
    inputWarnings.push(warning(
      'GROSS_LENGTH_USED_AS_EFFECTIVE',
      'weld.length_mm was treated as effective length. Supply effectiveLength_mm after end deductions.',
      'blocking',
    ));
  }

  const missing = [];
  if (!action.present || !validNonNegative(Number(action.value))) missing.push('actions.FEd_kN');
  if (!validPositive(weld.throat_mm)) missing.push('weld.throat_mm');
  if (!validPositive(Number(length.value))) missing.push('weld.effectiveLength_mm');
  if (!validPositive(weld.fu_MPa)) missing.push('weld.fu_MPa');
  if (!beta) missing.push('weld.betaW or a supported steelGrade (S235/S275/S355)');

  if (missing.length) {
    checks.push(makeNotChecked({
      id: 'fillet-weld-resistance',
      label: 'Fillet weld resistance',
      clause: 'Código Estructural · Anejo 26 · EN 1993-1-8 §4.5.3.3 — simplified method',
      reason: `Missing or invalid: ${missing.join(', ')}.`,
      formula: 'fvw,d = fu/(√3·βw·γM2); Fw,Rd = fvw,d·a·Leff',
      warnings: inputWarnings,
    }));
  } else {
    const FEd_kN = Number(action.value);
    const throat_mm = weld.throat_mm;
    const length_mm = Number(length.value);
    const fvw_d_MPa = weld.fu_MPa / (Math.sqrt(3) * beta.betaW * context.gammaM2);
    const FwRd_kN = fvw_d_MPa * throat_mm * length_mm / 1000;
    const geometryWarnings = [...inputWarnings];
    let forceWarn = inputWarnings.length > 0;
    if (throat_mm < 3) {
      geometryWarnings.push(warning(
        'SMALL_WELD_THROAT',
        'The throat is below 3 mm; verify the applicable minimum throat and execution requirements.',
        'blocking',
      ));
      forceWarn = true;
    }

    checks.push(makeResistanceCheck({
      id: 'fillet-weld-resistance',
      label: 'Fillet weld resistance',
      clause: 'Código Estructural · Anejo 26 · EN 1993-1-8 §4.5.3.3 — simplified method',
      demandSymbol: 'Fw,Ed',
      demandValue: FEd_kN,
      demandUnit: 'kN',
      resistanceSymbol: 'Fw,Rd',
      resistanceValue: FwRd_kN,
      formula: 'fvw,d = fu/(√3·βw·γM2); Fw,Rd = fvw,d·a·Leff',
      substitution:
        `fvw,d=${weld.fu_MPa}/(√3·${beta.betaW}·${context.gammaM2})=` +
        `${fvw_d_MPa.toFixed(3)} MPa; Fw,Rd=${fvw_d_MPa.toFixed(3)}·${throat_mm}·` +
        `${length_mm}/1000=${FwRd_kN.toFixed(3)} kN`,
      values: {
        throat_mm,
        effectiveLength_mm: length_mm,
        betaW: beta.betaW,
        betaWSource: beta.source,
        fvw_d_MPa,
        FwRd_kN,
      },
      warnings: geometryWarnings,
      warningAt,
      forceWarn,
    }));

    const minimumEffectiveLength_mm = Math.max(30, 6 * throat_mm);
    checks.push(makeUtilizationCheck({
      id: 'fillet-weld-effective-length',
      label: 'Minimum effective weld length',
      clause: 'Código Estructural · Anejo 26 · EN 1993-1-8 §4.5.1',
      utilization: minimumEffectiveLength_mm / length_mm,
      formula: 'Leff ≥ max(30 mm, 6a)',
      substitution:
        `max(30, 6·${throat_mm})/${length_mm} = ` +
        `${(minimumEffectiveLength_mm / length_mm).toFixed(4)}`,
      values: { minimumEffectiveLength_mm, effectiveLength_mm: length_mm },
      warningAt,
    }));
  }

  const summary = summarizeChecks(checks);
  return {
    kind: 'fillet-weld-check',
    scope: 'preliminary simplified fillet-weld resistance',
    standard: EC3_STANDARD.joints,
    status: summary.status,
    unitSystem: INTERNAL_UNITS,
    standardContext: context,
    inputs: { actions, weld },
    checks,
    summary,
    warnings: collectWarnings(checks, [
      warning(
        'PRELIMINARY_WELD_SCOPE',
        'The simplified method assumes force per unit length can be represented by a resultant. Weld-group moment distribution, directional stresses, long-joint reduction, fatigue and execution are outside this check.',
        'info',
      ),
    ]),
  };
}

export class StructuralCalculator {
  static checkMember(input) {
    return checkMemberEC3(input);
  }

  static checkBoltGroup(input) {
    return checkBoltGroupEC3(input);
  }

  static checkFilletWeld(input) {
    return checkFilletWeldEC3(input);
  }

  checkMember(input) {
    return checkMemberEC3(input);
  }

  checkBoltGroup(input) {
    return checkBoltGroupEC3(input);
  }

  checkFilletWeld(input) {
    return checkFilletWeldEC3(input);
  }
}

export default StructuralCalculator;
