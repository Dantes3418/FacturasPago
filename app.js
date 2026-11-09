// ===== CONFIGURACIÓN =====
const API = 'https://script.google.com/macros/s/AKfycbzZbIS-MSlyhbYFITpa1rdPRalNq_JYNE2C_Szx77Y46YYp5FWxyzfA1sb69GKqCSISZQ/exec';
const MESES = ['OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE'];
const CAL = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
const IDLE_MIN = 20; // minutos de inactividad antes de volver a pedir la contraseña
const PORTAL = 'https://tienda.nube.entel.bo/facturas';

const MSG = (n, c, obs) => {
  const partes = String(obs || '').split('|').map(x => x.trim());

  // Extraer el monto total de la observación
  const total = partes[0]
    .replace(/^MORA TOTAL:\s*/i, '')
    .replace(/^SIN MORA.*$/i, 'Bs0,00');

  // Extraer el detalle de las facturas por mes
  const detalle = partes.slice(1)
    .filter(x => x)
    .map(x => x.replace(/^([A-Z]{3}):\s*/, '$1. -- '))
    .join('\n');

  return `Estimado/a cliente:

Le saludamos cordialmente de Entel 😄

Le informamos que su cuenta presenta facturas pendientes de pago.

 Nombre del cliente: ${n}

 Número de cuenta: ${c}

 Monto total factura: ${total}${detalle ? '\n\n Detalle de facturas pendientes:\n' + detalle : ''}

Puede realizar su pago mediante cualquier aplicación bancaria, en una entidad financiera o a través de nuestro portal:

${PORTAL}

Si ya realizó su pago, puede ignorar este mensaje.

Si necesita ayuda con el pago o la generación de un código QR, estaremos a su disposición para brindarle asistencia.

¡Muchas gracias por su atención! 😃`;
};

const QUICK = ['No contesta', 'Promete pagar', 'Pagó, falta registrar'];

// Mensajes listos para copiar (m = nombre del mes en minúsculas)
const MSGS = [
  { c: 'ini', t: '1 · Factura disponible', d: 'Inicio de mes', f: m => `Estimado cliente \n\nLe saludamos cordialmente. Le escribimos para informarle que ya se encuentra disponible su factura correspondiente al mes de ${m}, para que pueda realizar su pago con total comodidad.\n\nPuede pagar desde cualquier aplicación bancaria o en una entidad financiera. \n\nQuedamos atentos ante cualquier consulta. ¡Que tenga un excelente día!` },
  { c: 'mid', t: '2 · Recordatorio', d: 'Mediados de mes', f: m => `Estimado cliente:\n\nLe escribimos para recordarle amablemente que su factura del mes de ${m} aún se encuentra pendiente de pago. Le invitamos a realizarla a la brevedad para mantener su cuenta al día.\n\nPuede pagar desde cualquier aplicación bancaria, en una entidad financiera o en nuestro portal:\n${PORTAL}\n\nSi ya realizó su pago, por favor ignore este mensaje y disculpe las molestias. Estamos para ayudarle.` },
  { c: 'fin', t: '3 · Último recordatorio', d: 'Fin de mes', f: m => `Estimado cliente:\n\nEste es el último recordatorio de pago de su factura del mes de ${m}, que se encuentra próxima a vencer. Le pedimos regularizar su pago en los próximos días para evitar inconvenientes con su servicio.\n\nPuede pagar desde cualquier aplicación bancaria, en una entidad financiera o en nuestro portal:\n${PORTAL}\n\nSi necesita ayuda con el pago o con la generación de un código QR, con gusto le asistiremos. Si ya pagó, por favor ignore este mensaje.` },
  { c: 'mor', t: '4 · Cliente moroso', d: 'Facturas vencidas', f: m => `Estimado cliente:\n\nLe informamos que a la fecha registra facturas vencidas pendientes de pago, entre ellas la del mes de ${m}. Le recordamos que no regularizar su deuda puede ocasionar el CORTE DEL SERVICIO.\n\nLe solicitamos realizar su pago de manera inmediata para evitar la suspensión:\n${PORTAL}\n\nSi tiene alguna dificultad para pagar, comuníquese con nosotros hoy mismo para buscar una solución. Si ya realizó su pago, envíenos su comprobante para actualizar su cuenta.` },
];

const SVG = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const PHONE = SVG('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>');
const EYE = SVG('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>');

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Almacenamiento: la sesión y los datos viven en sessionStorage (se borran al cerrar la pestaña/app).
const mem = {};
const SS = (() => { try { const s = window.sessionStorage; s.getItem('x'); return s; } catch (e) { return { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } }; } })();
const J = (k, d, st = localStorage) => { try { return JSON.parse(st.getItem(k)) ?? d; } catch (e) { return d; } };
const W = (k, v, st = localStorage) => { try { st.setItem(k, JSON.stringify(v)); } catch (e) { } };
// Limpia restos de versiones anteriores (sesión de 30 días y datos guardados en localStorage)
try { ['sess', 'act', ...MESES.map(m => 'data_' + m)].forEach(k => localStorage.removeItem(k)); } catch (e) { }

let tt; const toast = (m, e) => { const t = $('toast'); t.textContent = m; t.className = e ? 'err show' : 'show'; clearTimeout(tt); tt = setTimeout(() => t.className = '', 3800); };

let S = J('sess', null, SS), mes = J('mes', null) || CAL[new Date().getMonth()], D = [], DM = new Map(), H = '';
let F = { q: '', sit: 'todos', m: 0, inc: false, ojo: false }, LIM = 40, OPEN = new Set(), DRAFT = {}, pending = 0, loaded = false, pick;

// ===== API =====
async function api(b, ms = 20000) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token: S && S.token, ...b }), signal: c.signal });
    const j = await r.json();
    if (j.expired) logout();
    return j;
  } finally { clearTimeout(t); }
}

// ===== SESIÓN =====
const touch = () => W('act', Date.now(), SS);
const idleExpired = () => Date.now() - J('act', 0, SS) > IDLE_MIN * 60000;
async function login() {
  const b = $('b-login'); $('l-err').textContent = ''; b.disabled = true;
  try {
    const r = await api({ action: 'login', password: $('pass').value });
    if (!r.ok) { $('l-err').textContent = r.error; return; }
    S = { token: r.token }; W('sess', S, SS); touch(); $('pass').value = ''; start();
  } catch (e) { $('l-err').textContent = 'No se pudo conectar. Revisa tu conexión.'; } finally { b.disabled = false; }
}
function logout() {
  S = null; D = []; DM = new Map(); H = ''; DRAFT = {}; OPEN.clear(); closeSheet();
  ['sess', 'act', ...MESES.map(m => 'data_' + m)].forEach(k => SS.removeItem(k));
  $('pass').value = ''; $('app').hidden = true; $('login').hidden = false;
}
function lock() { logout(); toast('Sesión cerrada por inactividad'); }
function start() {
  $('login').hidden = true; $('app').hidden = false;
  $('months').innerHTML = MESES.map(m => `<button data-m="${m}" class="${m === mes ? 'on' : ''}">${m[0] + m.slice(1).toLowerCase()}</button>`).join('');
  setData(J('data_' + mes, [], SS), false); render(); renderMsgs(); centerMonth(); load();
}
const centerMonth = () => { const b = document.querySelector('#months .on'); if (b) b.scrollIntoView({ inline: 'center', block: 'nearest' }); };

// Actividad del usuario: renueva el reloj de inactividad
let lastT = 0;
['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(ev => addEventListener(ev, () => {
  if (!S) return; const n = Date.now(); if (n - lastT > 15000) { lastT = n; touch(); }
}, { passive: true, capture: true }));
setInterval(() => { if (S && idleExpired()) lock(); }, 30000);

// ===== DATOS =====
const key = d => d.nombre + '|' + d.cuenta;
function setData(a, save) {
  D = a; D.forEach((d, i) => { if (d.n == null) d.n = i + 1; if (d.ojo == null) d.ojo = false; });
  DM = new Map(D.map(d => [key(d), d])); if (save) W('data_' + mes, D, SS);
}
async function load() {
  const m = mes; $('h-sync').textContent = 'Actualizando...';
  try {
    const r = await api({ action: 'list', mes: m });
    if (!S) return; // la sesión se cerró mientras cargaba
    if (!r.ok) throw new Error(r.error);
    if (m !== mes) return;
    H = r.h; setData(r.data, true); loaded = true; render();
    $('h-sync').textContent = 'Actualizado ' + new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    $('h-sync').textContent = 'Sin conexión · datos guardados';
    if (!/abort|fetch|network|failed/i.test(String(e.message))) toast(e.message, true);
  }
}
function setMes(m) {
  mes = m; W('mes', m); H = ''; loaded = false; LIM = 40; OPEN.clear(); DRAFT = {};
  document.querySelectorAll('#months button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  setData(J('data_' + m, [], SS), false); render(); renderMsgs(); centerMonth(); load();
}
async function poll() {
  if (!S || document.hidden || pending) return;
  try { const r = await api({ action: 'ping', mes }, 10000); if (r.ok && H && r.h !== H) load(); } catch (e) { }
}
setInterval(poll, 60000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !S) return;
  if (idleExpired()) return lock();
  touch(); poll();
});

// ===== LÓGICA DE ESTADOS =====
const pend = d => d.m.some(v => v === 0), pag = d => !pend(d) && d.m.some(v => v === 1), sin = d => d.m.every(v => v === null);
const falt = d => [!d.celular && 'celular', !d.cuenta && 'cuenta', !d.ref && 'referencia'].filter(Boolean);
const cls = v => v === 1 ? 'ok' : v === 0 ? 'no' : 'na', lab = v => v === 1 ? 'Pagado' : v === 0 ? 'Pendiente' : 'No aplica';
function view() {
  const q = F.q.trim().toLowerCase();
  return D.filter(d => (F.sit === 'todos' || (F.sit === 'pend' && pend(d)) || (F.sit === 'pag' && pag(d)) || (F.sit === 'sin' && sin(d)))
    && (!F.m || d.m[F.m - 1] === 0) && (!F.inc || falt(d).length) && (!F.ojo || d.ojo)
    && (!q || (/^#\d+$/.test(q) ? d.n === +q.slice(1) : [d.nombre, d.celular, d.cuenta, d.ref].join(' ').toLowerCase().includes(q))));
}

// ===== RENDER =====
function render() { renderStats(); renderChips(); renderCards(); }
function renderStats() {
  const P = D.reduce((a, d) => a + d.m.filter(v => v === 1).length, 0), N = D.reduce((a, d) => a + d.m.filter(v => v === 0).length, 0), pc = P + N ? Math.round(P * 100 / (P + N)) : 0;
  const c = { todos: D.length, pend: D.filter(pend).length, pag: D.filter(pag).length, sin: D.filter(sin).length };
  $('stats').innerHTML = `<div class="prog"><div class="pr-top"><b>${pc}%</b><span>de cumplimiento</span><em>${P} pagadas · ${N} pendientes</em></div><div class="bar"><i style="width:${pc}%"></i></div></div>
  <div class="tiles">${[['todos', 'Clientes'], ['pend', 'Con pendientes'], ['pag', 'Al día'], ['sin', 'Sin marcar']].map(([k, l]) => `<button class="tile ${F.sit === k ? 'on' : ''}" data-s="${k}"><b>${c[k]}</b><span>${l}</span></button>`).join('')}</div>`;
}
function renderChips() {
  const n = D.filter(d => d.ojo).length;
  $('chips').innerHTML = `<span class="lb">Debe:</span>${[1, 2, 3, 4].map(i => `<button class="chip ${F.m === i ? 'on' : ''}" data-fm="${i}">M${i}</button>`).join('')}<button class="chip ${F.inc ? 'on' : ''}" data-inc="1">Incompletos</button><button class="chip ojo-chip ${F.ojo ? 'on' : ''}" data-ojo="1" aria-pressed="${F.ojo}">${EYE}OJO<em>${n}</em></button>`;
}
function renderCards() {
  const v = view(), s = v.slice(0, LIM);
  $('count').innerHTML = `<div class="crow"><span>${v.length} de ${D.length} clientes · ${mes[0] + mes.slice(1).toLowerCase()}</span></div>`;
  $('cards').innerHTML = s.map(card).join('') || `<div class="muted">${loaded || D.length ? 'Ningún cliente coincide con los filtros.' : 'Cargando…'}</div>`;
  $('more').hidden = v.length <= LIM; $('more').textContent = `Mostrar más (${v.length - LIM})`;
}
function renderMsgs() {
  const m = mes.toLowerCase();
  $('msg-list').innerHTML = MSGS.map((x, i) => `<div class="mg ${x.c}"><div class="mg-h"><b>${esc(x.t)}</b><span>${esc(x.d)}</span></div><p>${esc(x.f(m))}</p><button class="btn sm" data-c="${i}">Copiar</button></div>`).join('');
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch (e) { }
  try {
    const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, t.length); const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch (e) { return false; }
}
async function copyCuenta(numero, boton) {
  const ok = await copyText(String(numero));

  if (ok) {
    const original = boton.textContent;
    boton.textContent = '✓';
    toast('Número de cuenta copiado');

    setTimeout(() => {
      boton.textContent = original;
    }, 1500);
  } else {
    toast('No se pudo copiar el número de cuenta', true);
  }
}

function waBtn(n, d, sm) {
  const c = 'act wa' + (sm ? ' sm' : '');
  if (!n) return `<span class="${c} off"><img src="whatsapp.png" alt="">WhatsApp</span>`;
  return `<a class="${c}" target="_blank" rel="noopener" href="https://wa.me/591${n}?text=${encodeURIComponent(MSG(d.nombre, d.cuenta, d.obs))}"><img src="whatsapp.png" alt="">WhatsApp</a>`;
}
function telBtn(n, sm) {
  const c = 'act tel' + (sm ? ' sm' : '');
  return n ? `<a class="${c}" href="tel:+591${n}">${PHONE}Llamar</a>` : `<span class="${c} off">${PHONE}Llamar</span>`;
}
function card(d) {
  const k = key(d), o = OPEN.has(k), fl = falt(d), obs = DRAFT[k] ?? d.obs;
  return `<article class="card${o ? ' open' : ''}${d.ojo ? ' watch' : ''}" data-k="${esc(k)}">
  <div class="hd">
    <button class="who" data-a="tog" aria-expanded="${o}"><span class="id" title="Número de cliente">#${d.n}</span><span class="nm">${esc(d.nombre) || '(sin nombre)'}</span>${d.ojo ? `<span class="eye" title="Con OJO">${EYE}</span>` : ''}</button>
    <div class="pills">${d.m.map((v, i) => `<button class="pill ${cls(v)}" data-a="pay" data-i="${i + 1}" aria-label="M${i + 1}: ${lab(v)}">M${i + 1}<b>${v === 1 ? '✓' : v === 0 ? '✕' : '–'}</b></button>`).join('')}</div>
    <button class="chv" data-a="tog" aria-label="Desplegar"><i class="chev"></i></button>
  </div>
  <div class="meta">
    <span data-a="tog">${d.celular ? esc(d.celular) : 'Sin celular'}</span>
    <span class="cuenta-copy">
      Cta ${esc(d.cuenta) || '—'}
      ${d.cuenta ? `<button class="copy-cta" data-a="copycta" type="button" title="Copiar número de cuenta">⧉</button>` : ''}
    </span>
    ${fl.length ? `<span class="tag">${fl.map(esc).join(', ')}</span>` : ''}
  </div>  
  <div class="qa">${waBtn(d.celular, d)}${telBtn(d.celular)}</div>
  <div class="more"><div class="in"><div class="body">
    <dl class="info"><div><dt>Plan</dt><dd>${esc(d.plan) || '—'}</dd></div><div><dt>Estado de instalación</dt><dd>${esc(d.estado) || '—'}</dd></div>
      <div><dt>Ejecutivo</dt><dd>${esc(d.ejecutivo) || '—'}</dd></div></dl>
    <div class="refrow"><div><dt>Referencia</dt><dd>${esc(d.ref) || '—'}</dd></div><div class="refa">${waBtn(d.ref, d, 1)}${telBtn(d.ref, 1)}</div></div>
    <button class="ojo${d.ojo ? ' on' : ''}" data-a="ojo" aria-pressed="${!!d.ojo}">${EYE}<span>${d.ojo ? 'Quitar OJO' : 'Marcar con OJO (dar seguimiento)'}</span></button>
    <label class="ol">Observación<textarea rows="2" maxlength="300" data-o="${esc(d.obs)}">${esc(obs)}</textarea></label>
    <div class="qk">${QUICK.map(t => `<button class="chip" data-a="qk" data-t="${esc(t)}">${esc(t)}</button>`).join('')}<button class="btn sm" data-a="saveobs">Guardar</button></div>
    <button class="lnk" data-a="hist">Ver historial de cambios</button>
  </div></div></div></article>`;
}

// ===== HOJA INFERIOR =====
function sheet(html) { $('sh-body').innerHTML = html; $('back').hidden = false; requestAnimationFrame(() => $('sheet').classList.add('on')); }
function closeSheet() { $('sheet').classList.remove('on'); $('back').hidden = true; pick = null; }

// ===== CAMBIO DE PAGO (con confirmación) =====
function payDialog(d, i) {
  const cur = d.m[i - 1]; pick = { k: key(d), i, cur, to: undefined };
  sheet(`<h3>${esc(d.nombre)}</h3><p class="muted">Mensualidad M${i} · ahora: <b>${lab(cur)}</b></p>
    <div class="opts">${[1, 0, null].map(v => `<button class="opt ${cls(v)}${v === cur ? ' cur' : ''}" data-v="${v}" ${v === cur ? 'disabled' : ''}>${lab(v)}</button>`).join('')}</div>
    <button class="btn big" id="ok" disabled>Elige el nuevo estado</button><button class="btn ghost big" data-a="x">Cancelar</button>`);
}
async function setPay(d, i, to) {
  const from = d.m[i - 1], fp = key(d); d.m[i - 1] = to; pending++; render();
  try {
    const r = await api({ action: 'setm', mes, row: d.row, fp, k: i, from, to });
    if (r.d) Object.assign(d, r.d); else if (!r.ok) d.m[i - 1] = from;
    toast(r.ok ? `M${i} guardado: ${lab(to)}` : r.error, !r.ok);
  } catch (e) { d.m[i - 1] = from; toast('No se pudo guardar. Revisa tu conexión.', true); }
  pending--; setData(D, true); render();
}
async function saveObs(d, ta) {
  const k = key(d), from = ta.dataset.o, to = ta.value.trim(); if (from === to) { delete DRAFT[k]; return toast('Sin cambios'); }
  pending++;
  try {
    const r = await api({ action: 'setobs', mes, row: d.row, fp: k, from, to });
    if (r.d) Object.assign(d, r.d);
    if (r.ok) delete DRAFT[k];
    toast(r.ok ? 'Observación guardada' : r.error, !r.ok);
  } catch (e) { toast('No se pudo guardar. Revisa tu conexión.', true); }
  pending--; setData(D, true); render();
}
// Marca / desmarca "OJO" (cliente con seguimiento especial); se guarda en la hoja
async function setOjo(d) {
  const from = !!d.ojo, to = !from, fp = key(d); d.ojo = to; pending++; render();
  try {
    const r = await api({ action: 'setojo', mes, row: d.row, fp, from, to });
    if (r.d) Object.assign(d, r.d); else if (!r.ok) d.ojo = from;
    toast(r.ok ? (to ? 'Cliente marcado con OJO' : 'OJO quitado') : r.error, !r.ok);
  } catch (e) { d.ojo = from; toast('No se pudo guardar. Revisa tu conexión.', true); }
  pending--; setData(D, true); render();
}

// ===== HISTORIAL, MENÚ Y EXPORTACIÓN =====
async function histDialog(nombre) {
  sheet(`<h3>${nombre ? 'Historial · ' + esc(nombre) : 'Historial de cambios'}</h3><p class="muted">Cargando…</p>`);
  try {
    const r = await api({ action: 'hist' }); if (!r.ok) throw new Error(r.error);
    const a = r.data.filter(h => !nombre || h.nombre === nombre).slice(0, 60);
    $('sh-body').innerHTML = `<h3>${nombre ? 'Historial · ' + esc(nombre) : 'Historial de cambios'}</h3>` + (a.map(h => `<div class="hi"><b>${esc(h.campo)}: ${esc(h.antes) || '—'} → ${esc(h.despues) || '—'}</b><span>${esc(h.t)} · ${esc(h.mes)}${nombre ? '' : ' · ' + esc(h.nombre)}</span></div>`).join('') || '<p class="muted">Aún no hay cambios registrados.</p>') + '<button class="btn ghost big" data-a="x">Cerrar</button>';
  } catch (e) { $('sh-body').innerHTML = `<h3>Historial</h3><p class="err">${esc(e.message)}</p><button class="btn ghost big" data-a="x">Cerrar</button>`; }
}
// ===== MOROSIDAD (consulta automática: el userscript trae los datos de Entel; aquí se revisan y se aplican) =====
let MORA_ID = null;
async function moraDialog() {
  sheet(`<h3>Consultar morosidad</h3><p class="muted">Buscando resultados…</p>`);
  try {
    const r = await api({ action: 'moraplan' }, 60000); if (!r.ok) throw new Error(r.error);
    if (r.vacio) {
      MORA_ID = null;
      $('sh-body').innerHTML = `<h3>Consultar morosidad</h3><p class="muted">No hay resultados pendientes de revisar.</p>
        <p class="muted">1) Abre <a href="${PORTAL}" target="_blank" rel="noopener">el portal de Entel</a> (con el script instalado).<br>2) Haz una consulta manual de cualquier cuenta.<br>3) En el panel morado elige la hoja y pulsa «Probar 3» y luego «Consultar todas».<br>4) Vuelve aquí para revisar y aplicar.</p>
        <button class="btn ghost big" data-a="x">Cerrar</button>`;
      return;
    }
    MORA_ID = r.id; const c = r.cont, min = Math.max(0, Math.round((Date.now() - r.t) / 60000));
    const lista = r.items.map(i => `<div class="hi"><b>${esc(i.nombre)} · Cta ${esc(i.cuenta)}</b>${i.cambios.map(x => `<span>${esc(x.campo)}: ${esc(x.de) || '—'} → ${esc(x.a)}</span><br>`).join('')}</div>`).join('');
    const fall = r.fallidos.length ? `<p class="err">Fallidas (no se modifican): ${r.fallidos.map(f => esc(f.nombre) + ' (' + esc(f.e) + ')').join(', ')}</p>` : '';
    $('sh-body').innerHTML = `<h3>Vista previa · ${esc(r.mes)}</h3><p class="muted">Consultado hace ${min} min. Aún no se ha cambiado nada en la hoja.</p>
      <p><b>${c.consultados}</b> consultados · <b>${c.mora}</b> con mora · <b>${c.sin}</b> sin mora · <b>${c.err}</b> fallidas${c.omitidos ? ' · ' + c.omitidos + ' omitidos' : ''}</p>${fall}
      <div style="max-height:42vh;overflow:auto">${lista || '<p class="muted">No hay cambios por aplicar.</p>'}</div>${r.recortado ? '<p class="muted">Se muestran los primeros 400 clientes; se aplicarán todos.</p>' : ''}
      ${c.cambios ? `<button class="btn big" data-a="moraok">Aplicar cambios (${c.cambios} clientes)</button>` : ''}<button class="btn ghost big" data-a="x">Cancelar</button>`;
  } catch (e) { $('sh-body').innerHTML = `<h3>Consultar morosidad</h3><p class="err">${esc(e.message)}</p><button class="btn ghost big" data-a="x">Cerrar</button>`; }
}
async function moraAplicar() {
  if (!MORA_ID) return;
  const id = MORA_ID, b = document.querySelector('#sh-body [data-a="moraok"]'); if (b) { b.disabled = true; b.textContent = 'Aplicando…'; }
  try {
    const r = await api({ action: 'moraaplicar', id }, 120000); if (!r.ok) throw new Error(r.error);
    MORA_ID = null; closeSheet(); toast(`Morosidad aplicada: ${r.clientes} clientes, ${r.celdas} celdas`);
    if (r.mes !== mes) setMes(r.mes); else load();
  } catch (e) { toast(e.message, true); if (b) { b.disabled = false; b.textContent = 'Reintentar'; } }
}
function menu() {
  sheet(`<h3>Opciones</h3><button class="mi" data-a="csv">⬇ Exportar ${view().length} clientes filtrados (CSV)</button><button class="mi" data-a="mora">📡 Consultar morosidad</button><button class="mi" data-a="hist0">🕘 Historial de cambios</button><button class="mi" data-a="out">⎋ Cerrar sesión</button><button class="btn ghost big" data-a="x">Cerrar</button>`);
}
function exportCsv() {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['N°', 'Plan', 'Estado', 'Ejecutivo', 'Nombre Cliente', 'Celular', 'Nro. Cuenta', 'Referencia', 'M1', 'M2', 'M3', 'M4', 'OJO', 'Observacion'],
    ...view().map(d => [d.n, d.plan, d.estado, d.ejecutivo, d.nombre, d.celular, d.cuenta, d.ref, ...d.m.map(v => v === null ? '' : v), d.ojo ? 'SI' : '', d.obs])];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + rows.map(r => r.map(q).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  a.download = `pagos_${mes}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); closeSheet();
}

// ===== EVENTOS =====
$('b-login').onclick = login;
$('pass').onkeydown = e => { if (e.key === 'Enter') login(); };
$('b-sync').onclick = load;
$('b-menu').onclick = menu;
$('back').onclick = closeSheet;
$('more').onclick = () => { LIM += 40; renderCards(); };
$('q').oninput = e => { F.q = e.target.value; LIM = 40; renderCards(); };

$('months').onclick = e => {
  const b = e.target.closest('button');
  if (b && b.dataset.m !== mes) setMes(b.dataset.m);
};
$('stats').onclick = e => {
  const b = e.target.closest('.tile');
  if (b) { F.sit = b.dataset.s; LIM = 40; render(); }
};
$('chips').onclick = e => {
  const b = e.target.closest('.chip');
  if (!b) return;
  if (b.dataset.fm) F.m = F.m === +b.dataset.fm ? 0 : +b.dataset.fm;
  else if (b.dataset.ojo) F.ojo = !F.ojo;
  else F.inc = !F.inc;
  LIM = 40; renderChips(); renderCards();
};
$('msg-list').onclick = async e => {
  const b = e.target.closest('[data-c]'); if (!b) return;
  const ok = await copyText(MSGS[+b.dataset.c].f(mes.toLowerCase()));
  b.textContent = ok ? '¡Copiado!' : 'No se pudo'; toast(ok ? 'Mensaje copiado' : 'No se pudo copiar el mensaje', !ok);
  setTimeout(() => { b.textContent = 'Copiar'; }, 1800);
};
$('cards').oninput = e => {
  const ta = e.target.closest('textarea'), c = ta && ta.closest('.card'); if (c) DRAFT[c.dataset.k] = ta.value;
};
$('cards').onclick = e => {
  const b = e.target.closest('[data-a]');
  if (!b) return;
  const c = b.closest('.card'), d = c && DM.get(c.dataset.k);
  if (!d) return;
  const a = b.dataset.a;
  if (a === 'copycta') {
  e.stopPropagation();
  copyCuenta(d.cuenta, b);
  return;
  }
  if (a === 'tog') {
    const o = c.classList.toggle('open');
    o ? OPEN.add(c.dataset.k) : OPEN.delete(c.dataset.k);
    c.querySelector('.who').setAttribute('aria-expanded', o);
  }
  else if (a === 'pay') payDialog(d, +b.dataset.i);
  else if (a === 'ojo') setOjo(d);
  else if (a === 'qk') {
    const ta = c.querySelector('textarea');
    const t = new Date().toLocaleDateString('es', { day: '2-digit', month: '2-digit' }) + ': ' + b.dataset.t;
    ta.value = (ta.value.trim() ? ta.value.trim() + ' | ' : '') + t; DRAFT[c.dataset.k] = ta.value;
  }
  else if (a === 'saveobs') saveObs(d, c.querySelector('textarea'));
  else if (a === 'hist') histDialog(d.nombre);
};
$('sheet').onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.v !== undefined && pick) {
    pick.to = b.dataset.v === 'null' ? null : +b.dataset.v;
    document.querySelectorAll('#sh-body .opt').forEach(o => o.classList.toggle('pick', o === b));
    const ok = $('ok'); ok.disabled = false; ok.textContent = 'Confirmar: cambiar a ' + lab(pick.to);
  }
  else if (b.id === 'ok' && pick) { const p = pick, d = DM.get(p.k); closeSheet(); if (d) setPay(d, p.i, p.to); }
  else if (b.dataset.a === 'x') closeSheet();
  else if (b.dataset.a === 'csv') exportCsv();
  else if (b.dataset.a === 'hist0') histDialog();
  else if (b.dataset.a === 'mora') moraDialog();
  else if (b.dataset.a === 'moraok') moraAplicar();
  else if (b.dataset.a === 'out') logout();
};

// ===== ARRANQUE =====
// Solo se entra directo si hay una sesión de ESTA pestaña, reciente y con token. Si no, se pide la contraseña.
if (S && S.token && !idleExpired()) { touch(); start(); } else { logout(); }
