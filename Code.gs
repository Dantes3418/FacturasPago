// ===== PAGOS ENTEL · BACKEND COMPLETO =====
// Pega este código en Extensiones > Apps Script del Google Sheet de PAGOS (reemplaza el anterior), guarda y:
// 1) Ejecuta configurar() una vez (autoriza permisos nuevos si los pide; también crea la columna OJO en las 12 hojas).
// 2) Implementar > Administrar implementaciones > Editar > Nueva versión.
// La URL de la API no cambia. La contraseña sigue en Propiedades del script > PASSWORD.
// NOVEDADES: columna OJO (cliente con seguimiento especial), número de cliente (n) y sesión más corta (SESION_HORAS).
const TZ = 'America/La_Paz', SESION_HORAS = 12, HIST = 'HISTORIAL';
const MESES = ['OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE'];
const ALIAS = { plan: 'plan', est: 'estado', estado: 'estado', ejecutivo: 'ejecutivo', nombrecliente: 'nombre', celular: 'celular',
  nrocuenta: 'cuenta', referencia: 'ref', m1: 'm1', m2: 'm2', m3: 'm3', m4: 'm4', observacion: 'obs', ojo: 'ojo' };
const REQUERIDOS = ['nombre', 'celular', 'cuenta', 'm1', 'm2', 'm3', 'm4'];
const P = PropertiesService.getScriptProperties();

function configurar() {
  if (!P.getProperty('SECRET')) P.setProperty('SECRET', Utilities.getUuid() + Utilities.getUuid());
  if (!P.getProperty('PASSWORD')) {
    const pw = Utilities.getUuid().replace(/-/g, '').slice(0, 8);
    P.setProperty('PASSWORD', pw);
    Logger.log('Contraseña inicial: ' + pw);
  }
  histHoja_();
  MESES.forEach(m => {
    try { const sh = hoja_(m), c = asegurarOjo_(sh); Logger.log('OK ' + m + ': ' + (sh.getLastRow() - c.hdr) + ' filas' + ('obs' in c.idx ? '' : ' (SIN columna Observacion)')); }
    catch (e) { Logger.log('PROBLEMA ' + m + ': ' + e.message); }
  });
}

function doGet() { return out_({ ok: true, msg: 'API pagos activa' }); }

function doPost(e) {
  try {
    const r = JSON.parse(e.postData.contents);
    if (r.action === 'login') return out_({ ok: true, token: login_(String(r.password || '').trim()) });
    if (!who_(r.token)) return out_({ ok: false, expired: true, error: 'Sesión expirada' });
    if (r.action === 'list') return out_(leer_(r.mes));
    if (r.action === 'ping') { const sh = hoja_(r.mes); return out_({ ok: true, h: hash_(vals_(sh, cols_(sh))) }); }
    if (r.action === 'hist') return out_({ ok: true, data: hist_() });
    if (r.action === 'setm' || r.action === 'setobs' || r.action === 'setojo') {
      const lock = LockService.getScriptLock(); lock.waitLock(15000);
      try { return out_(escribir_(r)); } finally { lock.releaseLock(); }
    }
    throw new Error('Acción desconocida');
  } catch (err) { return out_({ ok: false, error: String(err.message || err) }); }
}

// ===== SESIÓN =====
function login_(pw) {
  const c = CacheService.getScriptCache(), f = Number(c.get('fails')) || 0;
  if (f >= 5) throw new Error('Demasiados intentos. Espera 10 minutos.');
  if (!pw || pw !== P.getProperty('PASSWORD')) { c.put('fails', String(f + 1), 600); Utilities.sleep(800); throw new Error('Contraseña incorrecta'); }
  c.remove('fails');
  const exp = Date.now() + SESION_HORAS * 36e5;
  return exp + '.' + sign_(String(exp));
}
function sign_(s) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s, P.getProperty('SECRET'))); }
function who_(t) { const p = String(t || '').split('.'); return p.length === 2 && +p[0] > Date.now() && sign_(p[0]) === p[1]; }

// ===== HOJAS Y COLUMNAS (por nombre de encabezado) =====
const norm_ = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
function hoja_(mes) {
  if (MESES.indexOf(mes) < 0) throw new Error('Mes inválido');
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(mes);
  if (!sh) throw new Error('No existe la hoja ' + mes);
  return sh;
}
function cols_(sh) {
  const w = sh.getLastColumn(), top = sh.getRange(1, 1, Math.min(5, sh.getMaxRows()), w).getValues();
  for (let i = 0; i < top.length; i++) {
    const idx = {};
    top[i].forEach((h, j) => { const k = ALIAS[norm_(h)]; if (k && !(k in idx)) idx[k] = j; });
    if ('nombre' in idx) {
      const falta = REQUERIDOS.filter(k => !(k in idx));
      if (falta.length) throw new Error('Faltan columnas: ' + falta.join(', '));
      return { hdr: i + 1, idx: idx, w: w };
    }
  }
  throw new Error('No se encontró la fila de encabezados (Nombre Cliente)');
}
const txt_ = v => String(v == null ? '' : v).trim();
const tel_ = v => { const d = txt_(v).replace(/\D/g, ''); return d.length === 11 && d.indexOf('591') === 0 ? d.slice(3) : d; };
const pago_ = v => (v === 1 || v === true || txt_(v) === '1') ? 1 : (v === 0 || v === false || txt_(v) === '0') ? 0 : null;
const lab_ = v => v === 1 ? 'Pagado' : v === 0 ? 'Pendiente' : 'No aplica';
const ojo_ = v => v === true || ['si', '1', 'true', 'x', 'ojo'].indexOf(norm_(v)) >= 0;
const bool_ = v => v === true || v === 'true' || v === 1;

function vals_(sh, c) { const n = sh.getLastRow() - c.hdr; return n < 1 ? [] : sh.getRange(c.hdr + 1, 1, n, c.w).getValues(); }
function hash_(v) { return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(v))); }
function fila_(f, row, c) {
  const g = k => k in c.idx ? f[c.idx[k]] : '';
  return { row: row, plan: txt_(g('plan')), estado: txt_(g('estado')), ejecutivo: txt_(g('ejecutivo')), nombre: txt_(g('nombre')),
    celular: tel_(g('celular')), cuenta: txt_(g('cuenta')), ref: tel_(g('ref')), m: [1, 2, 3, 4].map(k => pago_(g('m' + k))), obs: txt_(g('obs')), ojo: ojo_(g('ojo')) };
}
function leer_(mes) {
  const sh = hoja_(mes), c = cols_(sh), v = vals_(sh, c);
  // n = número de cliente (posición en la hoja, sin contar filas vacías); no cambia al filtrar
  const data = v.map((f, i) => fila_(f, c.hdr + 1 + i, c)).filter(d => d.nombre || d.celular || d.cuenta).map((d, i) => { d.n = i + 1; return d; });
  return { ok: true, mes: mes, data: data, h: hash_(v) };
}

// ===== ESCRITURA (solo la celda, verificando cliente y valor previo) =====
const huella_ = (f, c) => txt_(f[c.idx.nombre]) + '|' + txt_(f[c.idx.cuenta]);
function ubicar_(sh, c, row, fp) {
  const v = vals_(sh, c), i = row - c.hdr - 1;
  if (i >= 0 && i < v.length && huella_(v[i], c) === fp) return row;
  for (let j = 0; j < v.length; j++) if (huella_(v[j], c) === fp) return c.hdr + 1 + j;
  throw new Error('El cliente cambió de lugar o ya no está en la hoja. Actualiza la lista.');
}
// Crea la columna OJO al final de los encabezados si la hoja aún no la tiene
function asegurarOjo_(sh) {
  const c = cols_(sh);
  if ('ojo' in c.idx) return c;
  const col = sh.getLastColumn() + 1;
  if (col > sh.getMaxColumns()) sh.insertColumnAfter(sh.getMaxColumns());
  sh.getRange(c.hdr, col - 1).copyTo(sh.getRange(c.hdr, col), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  sh.getRange(c.hdr, col).setValue('OJO');
  SpreadsheetApp.flush();
  return cols_(sh);
}
function escribir_(r) {
  const sh = hoja_(r.mes), esPago = r.action === 'setm', esOjo = r.action === 'setojo';
  const c = esOjo ? asegurarOjo_(sh) : cols_(sh), row = ubicar_(sh, c, Number(r.row), String(r.fp));
  const k = esPago ? 'm' + Number(r.k) : esOjo ? 'ojo' : 'obs';
  if (esPago && [1, 2, 3, 4].indexOf(Number(r.k)) < 0) throw new Error('Mensualidad inválida');
  if (!(k in c.idx)) throw new Error('La hoja no tiene la columna Observacion');
  const cell = sh.getRange(row, c.idx[k] + 1), nombre = txt_(sh.getRange(row, c.idx.nombre + 1).getValue()), cuenta = txt_(sh.getRange(row, c.idx.cuenta + 1).getValue());
  const conflicto = msg => ({ ok: false, error: msg, d: fila_(sh.getRange(row, 1, 1, c.w).getValues()[0], row, c) });
  const dv = cell.getDataValidation(), cb = dv && dv.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.CHECKBOX;
  let antes, despues, campo;
  if (esPago) {
    const to = r.to === null ? null : Number(r.to), from = r.from === null ? null : Number(r.from);
    if (to !== null && to !== 0 && to !== 1) throw new Error('Valor inválido');
    antes = pago_(cell.getValue());
    if (antes !== from) return conflicto('Ese pago ya había cambiado en la hoja. Se actualizó la vista.');
    if (to === null) cell.clearContent(); else cell.setValue(cb ? to === 1 : to);
    campo = 'M' + Number(r.k); antes = lab_(antes); despues = lab_(to);
  } else if (esOjo) {
    const to = bool_(r.to), from = bool_(r.from);
    antes = ojo_(cell.getValue());
    if (antes !== from) return conflicto('El OJO ya había cambiado en la hoja. Se actualizó la vista.');
    if (cb) cell.setValue(to); else if (to) cell.setValue('SI'); else cell.clearContent();
    campo = 'OJO'; antes = antes ? 'Sí' : 'No'; despues = to ? 'Sí' : 'No';
  } else {
    antes = txt_(cell.getValue());
    if (antes !== txt_(r.from)) return conflicto('La observación ya había cambiado en la hoja. Se actualizó la vista.');
    despues = txt_(r.to).slice(0, 300); cell.setValue(despues); campo = 'Observación';
  }
  SpreadsheetApp.flush();
  histHoja_().appendRow([new Date(), r.mes, nombre, cuenta, campo, antes, despues]);
  return { ok: true, d: fila_(sh.getRange(row, 1, 1, c.w).getValues()[0], row, c) };
}

// ===== HISTORIAL (pestaña nueva, no toca las 12 hojas) =====
function histHoja_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(HIST);
  if (!sh) {
    sh = ss.insertSheet(HIST);
    sh.getRange(1, 1, 1, 7).setValues([['FECHA', 'MES', 'CLIENTE', 'CUENTA', 'CAMPO', 'ANTES', 'DESPUES']]).setFontWeight('bold').setBackground('#6D3FD1').setFontColor('#FFFFFF');
    sh.setFrozenRows(1); sh.getRange('A2:A').setNumberFormat('dd/MM/yyyy HH:mm'); sh.getRange('D2:D').setNumberFormat('@');
  }
  return sh;
}
function hist_() {
  const sh = histHoja_(), n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const k = Math.min(n, 300);
  return sh.getRange(sh.getLastRow() - k + 1, 1, k, 7).getValues().reverse().map(f => ({
    t: Utilities.formatDate(new Date(f[0]), TZ, 'dd/MM HH:mm'), mes: f[1], nombre: f[2], cuenta: String(f[3]), campo: f[4], antes: String(f[5]), despues: String(f[6]) }));
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
