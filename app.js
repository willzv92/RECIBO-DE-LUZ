// =============================================
//  RECIBO LUZ DEL SUR — app.js
// =============================================

// --- Inicialización ---

document.addEventListener('DOMContentLoaded', () => {
  poblarAnios();
  inicializarInputsNumericos();
  inicializarSubtotalesLive();
  document.getElementById('print_emision').textContent = getFechaEmision();
});

// =============================================
//  AÑOS Y PERÍODO
// =============================================

function poblarAnios() {
  const select = document.getElementById('anio');
  const anioActual = new Date().getFullYear();
  for (let y = 2025; y <= 2125; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (y === anioActual) opt.selected = true;
    select.appendChild(opt);
  }
  // Actualizar print_periodo al cambiar selects
  ['mes', 'anio'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      const p = getPeriodo();
      document.getElementById('print_periodo').textContent = p || '—';
    });
  });
}

function getPeriodo() {
  const mes  = document.getElementById('mes').value;
  const anio = document.getElementById('anio').value;
  if (!mes) return '';
  return mes + ' ' + anio;
}

// =============================================
//  FORMATO DE NÚMEROS
// =============================================

function unformatValue(valor) {
  if (!valor) return NaN;
  let str = valor.toString().trim();

  const tienePunto = str.includes('.');
  const tieneComa  = str.includes(',');

  if (tienePunto && tieneComa) {
    const ultimoPunto = str.lastIndexOf('.');
    const ultimaComa  = str.lastIndexOf(',');
    if (ultimaComa > ultimoPunto) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (tieneComa) {
    const partes = str.split(',');
    if (partes.length === 2 && partes[1].length === 3 && partes[0].length > 0) {
      str = str.replace(',', '');
    } else {
      str = str.replace(',', '.');
    }
  }
  return parseFloat(str);
}

function formatValue(valor) {
  if (isNaN(valor)) return '';
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
}

function normalizarDecimal(input) {
  const pos    = input.selectionStart;
  const antes  = input.value;
  const despues = antes.replace(/\./g, ',');
  if (antes !== despues) {
    input.value = despues;
    input.setSelectionRange(pos, pos);
  }
}

function formatearInput(input) {
  const raw = input.value.trim();
  // Permitir signo negativo seguido de número
  const esNegativo = raw.startsWith('-');
  const num = unformatValue(esNegativo ? raw.slice(1) : raw);
  if (!isNaN(num)) {
    input.value = (esNegativo ? '-' : '') + formatValue(num);
  }
}

// IDs de todos los inputs numéricos editables
const IDS_NUMERICOS = [
  'kwh_total', 'kwh_a',
  'consumo_energia',
  'cargo_fijo', 'mant_conexion', 'alumbrado', 'electrif_rural',
  'interes_comp', 'ajuste_ant', 'ajuste_act',
  'total_recibo'
];

function inicializarInputsNumericos() {
  IDS_NUMERICOS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => normalizarDecimal(el));
  });
}

// =============================================
//  SUBTOTALES EN VIVO
// =============================================

function getVal(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  // Puede ser un <input> o un <div> de subtotal calculado
  const raw = el.tagName === 'INPUT' ? el.value : el.textContent.replace('S/ ', '').trim();
  const v = unformatValue(raw);
  return isNaN(v) ? 0 : v;
}

function setSubtotal(id, valor) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = isNaN(valor) ? '—' : 'S/ ' + formatValue(valor);
}

// =============================================
//  CÁLCULO AUTOMÁTICO DE IGV
// =============================================

const IGV = 0.18;

function calcularIGV() {
  // IGV sobre Consumo = 18% del consumo de energía
  const baseConsumo = getVal('consumo_energia');
  const igvConsumo  = baseConsumo * IGV;
  const elIgvC = document.getElementById('igv_consumo');
  if (elIgvC) elIgvC.textContent = baseConsumo > 0 ? 'S/ ' + formatValue(igvConsumo) : '—';

  // IGV sobre Cargos Fijos = 18% de (Cargo Fijo + Mant. + Alumbrado + Interés Comp.)
  const baseFijos  = getVal('cargo_fijo') + getVal('mant_conexion')
                   + getVal('alumbrado')  + getVal('interes_comp');
  const igvFijos   = baseFijos * IGV;
  const elIgvF = document.getElementById('igv_fijos');
  if (elIgvF) elIgvF.textContent = baseFijos > 0 ? 'S/ ' + formatValue(igvFijos) : '—';
}

function recalcularSubtotales() {
  calcularIGV(); // primero actualizar IGV automático
  const prop = getVal('consumo_energia') + getVal('igv_consumo');
  const fijo = getVal('cargo_fijo') + getVal('mant_conexion') + getVal('alumbrado')
             + getVal('electrif_rural') + getVal('igv_fijos');
  const esp  = getVal('interes_comp') + getVal('ajuste_ant') + getVal('ajuste_act');
  const total = prop + fijo + esp;

  setSubtotal('total_proporcional', prop);
  setSubtotal('total_fijos',        fijo);
  setSubtotal('total_especiales',   esp);

  // Total calculado y comparación con recibo
  const elCalc = document.getElementById('total_calculado');
  elCalc.textContent = 'S/ ' + formatValue(total);

  const totalRecibo = getVal('total_recibo');
  const diffMsg     = document.getElementById('diff_msg');

  if (totalRecibo !== 0) {
    const diff = Math.abs(total - totalRecibo);
    if (diff < 0.02) {
      diffMsg.textContent = '✔ Coincide con el recibo oficial';
      diffMsg.className = 'diff-msg ok';
    } else {
      const signo = total > totalRecibo ? '+' : '';
      diffMsg.textContent = `⚠ Diferencia: S/ ${signo}${formatValue(total - totalRecibo)}`;
      diffMsg.className = 'diff-msg error';
    }
  } else {
    diffMsg.className = 'diff-msg';
  }
}

function inicializarSubtotalesLive() {
  IDS_NUMERICOS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', recalcularSubtotales);
    el.addEventListener('blur',  recalcularSubtotales);
  });
}

// =============================================
//  ACTUALIZAR DPTO 2 (kWh)
// =============================================

function actualizarDepto2() {
  const kwhTotal = unformatValue(document.getElementById('kwh_total').value);
  const kwhA     = unformatValue(document.getElementById('kwh_a').value);
  const previewA = document.getElementById('preview_a');
  const previewB = document.getElementById('preview_b');

  if (!isNaN(kwhA) && kwhA >= 0) {
    previewA.textContent = formatValue(kwhA) + ' kWh';
    previewA.classList.add('activo');
  } else {
    previewA.textContent = '— kWh';
    previewA.classList.remove('activo');
  }

  if (isNaN(kwhTotal) || isNaN(kwhA)) {
    document.getElementById('kwh_b').value = '';
    previewB.textContent = '— kWh';
    previewB.classList.remove('activo');
    return;
  }

  const kwhB = kwhTotal - kwhA;
  if (kwhB >= 0) {
    document.getElementById('kwh_b').value = formatValue(kwhB);
    previewB.textContent = formatValue(kwhB) + ' kWh';
    previewB.classList.add('activo');
  } else {
    document.getElementById('kwh_b').value = '0,00';
    previewB.textContent = '0,00 kWh';
    previewB.classList.add('activo');
  }
}

// =============================================
//  CALCULAR REPARTO
// =============================================

function calcular() {

  // Validar período
  if (!document.getElementById('mes').value) {
    mostrarError('Por favor, selecciona el mes de facturación.');
    return;
  }

  const kwhTotal = unformatValue(document.getElementById('kwh_total').value);
  const kwhA     = unformatValue(document.getElementById('kwh_a').value);

  if (isNaN(kwhTotal) || kwhTotal <= 0) {
    mostrarError('Ingresa la energía total a facturar (kWh).');
    return;
  }
  if (isNaN(kwhA) || kwhA < 0) {
    mostrarError('Ingresa el consumo de energía del Dpto 1 (ArqCopy).');
    return;
  }
  if (kwhA > kwhTotal) {
    mostrarError('Los kWh del Dpto 1 no pueden superar los kWh totales.');
    return;
  }

  const kwhB = kwhTotal - kwhA;
  const porcA = kwhA / kwhTotal;
  const porcB = kwhB / kwhTotal;

  // Leer conceptos
  const consumoEnergia = getVal('consumo_energia');
  const igvConsumo     = getVal('igv_consumo');
  const cargoFijo      = getVal('cargo_fijo');
  const mantConexion   = getVal('mant_conexion');
  const alumbrado      = getVal('alumbrado');
  const electrifRural  = getVal('electrif_rural');
  const igvFijos       = getVal('igv_fijos');
  const interesComp    = getVal('interes_comp');
  const ajusteAnt      = getVal('ajuste_ant');
  const ajusteAct      = getVal('ajuste_act');

  const totalProp = consumoEnergia + igvConsumo;
  const totalFijo = cargoFijo + mantConexion + alumbrado + electrifRural + igvFijos;
  const totalEsp  = interesComp + ajusteAnt + ajusteAct;
  const totalGral = totalProp + totalFijo + totalEsp;

  // Reparto proporcional
  const propA = totalProp * porcA;
  const propB = totalProp * porcB;

  // Reparto fijo (50/50)
  const fijoA = (totalFijo + totalEsp) / 2;
  const fijoB = (totalFijo + totalEsp) / 2;

  // Totales por dpto (exactos, para la tabla de detalle)
  const montoA = propA + fijoA;
  const montoB = propB + fijoB;

  // Redondeo a S/ 0,10 (menor denominación de pago)
  // Se redondea al múltiplo de 0,10 más cercano: ≥ 0,05 sube, < 0,05 baja
  const montoA_r = redondear10(montoA);
  const montoB_r = redondear10(montoB);

  // ---- Tabla de detalle ----
  const conceptos = [
    // [etiqueta, criterio, total, montoA, montoB, clase-fila]
    { grupo: 'PROPORCIONALES AL CONSUMO (kWh)' },
    { label: 'Consumo de Energía',         tag: 'prop', total: consumoEnergia, a: consumoEnergia * porcA, b: consumoEnergia * porcB, cls: 'fila-prop' },
    { label: 'IGV sobre Consumo',          tag: 'prop', total: igvConsumo,     a: igvConsumo * porcA,     b: igvConsumo * porcB,     cls: 'fila-prop' },
    { grupo: 'FIJOS (50 / 50)' },
    { label: 'Cargo Fijo',                 tag: 'fijo', total: cargoFijo,     a: cargoFijo / 2,     b: cargoFijo / 2,     cls: 'fila-fijo' },
    { label: 'Mant. y Reposición Conexión',tag: 'fijo', total: mantConexion,  a: mantConexion / 2,  b: mantConexion / 2,  cls: 'fila-fijo' },
    { label: 'Alumbrado Público',          tag: 'fijo', total: alumbrado,     a: alumbrado / 2,     b: alumbrado / 2,     cls: 'fila-fijo' },
    { label: 'Interés Compensatorio',      tag: 'fijo', total: interesComp,   a: interesComp / 2,   b: interesComp / 2,   cls: 'fila-fijo' },
    { label: 'IGV sobre Cargos Fijos',     tag: 'fijo', total: igvFijos,      a: igvFijos / 2,      b: igvFijos / 2,      cls: 'fila-fijo' },
    { grupo: 'ESPECIALES (50 / 50)' },
    { label: 'Electrificación Rural (Ley 28749)', tag: 'esp', total: electrifRural, a: electrifRural / 2, b: electrifRural / 2, cls: 'fila-esp' },
    { label: 'Ajuste Redondeo Mes Anterior', tag: 'esp', total: ajusteAnt,   a: ajusteAnt / 2,     b: ajusteAnt / 2,     cls: 'fila-esp' },
    { label: 'Ajuste Redondeo Mes Actual', tag: 'esp', total: ajusteAct,     a: ajusteAct / 2,     b: ajusteAct / 2,     cls: 'fila-esp' },
  ];

  const tagLabel = { prop: 'Proporcional', fijo: '50 / 50', esp: '50 / 50' };

  const tbody = document.getElementById('tbody_detalle');
  tbody.innerHTML = '';

  conceptos.forEach(c => {
    if (c.grupo !== undefined) {
      const tr = document.createElement('tr');
      tr.className = 'tbody-group-header';
      tr.innerHTML = `<td colspan="5">${c.grupo}</td>`;
      tbody.appendChild(tr);
      return;
    }
    // Solo mostrar filas donde el total es distinto de 0
    if (c.total === 0) return;

    const tr = document.createElement('tr');
    tr.className = c.cls;
    tr.innerHTML = `
      <td class="texto-izq">${c.label}</td>
      <td><span class="tag-criterio tag-${c.tag}">${tagLabel[c.tag]}</span></td>
      <td>${formatValue(c.total)}</td>
      <td>${formatValue(c.a)}</td>
      <td>${formatValue(c.b)}</td>
    `;
    tbody.appendChild(tr);
  });

  // Fila total del tfoot — muestra redondeado
  document.getElementById('tfoot_total').textContent = formatValue(totalGral);
  document.getElementById('tfoot_a').textContent     = formatValue(montoA_r);
  document.getElementById('tfoot_b').textContent     = formatValue(montoB_r);

  // ---- Tabla resumen ----
  document.getElementById('td_kwh_a').textContent   = formatValue(kwhA);
  document.getElementById('td_kwh_b').textContent   = formatValue(kwhB);
  document.getElementById('td_porc_a').textContent  = fmtPorc(porcA);
  document.getElementById('td_porc_b').textContent  = fmtPorc(porcB);
  document.getElementById('td_prop_a').textContent  = formatValue(propA);
  document.getElementById('td_prop_b').textContent  = formatValue(propB);
  document.getElementById('td_fijo_a').textContent  = formatValue(fijoA);
  document.getElementById('td_fijo_b').textContent  = formatValue(fijoB);
  // Total a pagar: redondeado a S/ 0,10
  document.getElementById('td_monto_a').textContent = formatValue(montoA_r);
  document.getElementById('td_monto_b').textContent = formatValue(montoB_r);

  // ---- Chips ----
  const periodo = getPeriodo() || '(sin especificar)';
  document.getElementById('resumen_periodo').textContent = 'Período: ' + periodo;
  document.getElementById('chip_kwh').textContent   = formatValue(kwhTotal) + ' kWh';
  document.getElementById('chip_monto').textContent = 'S/ ' + formatValue(totalGral);
  document.getElementById('chip_prop').textContent  = 'S/ ' + formatValue(totalProp);
  document.getElementById('chip_fijo').textContent  = 'S/ ' + formatValue((totalFijo + totalEsp) / 2);

  // Datos del print-header
  document.getElementById('print_periodo').textContent = periodo || '—';
  document.getElementById('print_emision').textContent = getFechaEmision();

  // ---- Barra ----
  document.getElementById('barra_a').style.width = (porcA * 100).toFixed(2) + '%';

  // ---- Mostrar ----
  const resultado = document.getElementById('resultado');
  resultado.style.display = 'block';
  resultado.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// =============================================
//  HELPERS
// =============================================

/**
 * Redondea al múltiplo de S/ 0,10 más cercano.
 * Centésimos ≥ 0,05 → sube; < 0,05 → baja.
 * Ej: 758,08 → 758,10 | 507,27 → 507,30 | 123,44 → 123,40
 */
/**
 * Devuelve la fecha actual formateada como "dd/mm/aaaa".
 */
function getFechaEmision() {
  const hoy = new Date();
  const d = String(hoy.getDate()).padStart(2, '0');
  const m = String(hoy.getMonth() + 1).padStart(2, '0');
  const a = hoy.getFullYear();
  return `${d}/${m}/${a}`;
}

function redondear10(valor) {
  return Math.round(valor * 10) / 10;
}

function fmtPorc(valor) {
  return (valor * 100).toFixed(2).replace('.', ',') + '%';
}

function mostrarError(mensaje) {
  alert('⚠️ ' + mensaje);
}
