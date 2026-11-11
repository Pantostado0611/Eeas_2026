// Bases (banderas), pistas, miniretos con claves scout y libreta del Rover.

// ---------- Direcciones y pistas ----------
const DIRS = ['este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste', 'norte', 'noreste'];
const DIRS4 = ['este', 'sur', 'oeste', 'norte'];
// Dirección de b vista desde a (el norte es arriba)
const dir_name = (a, b) => DIRS[(Math.round(Math.atan2(b.y - a.y, b.x - a.x) / (PI / 4)) + 8) % 8];
const dir_name4 = (a, b) => DIRS4[(Math.round(Math.atan2(b.y - a.y, b.x - a.x) / (PI / 2)) + 4) % 4];
// Pasos en línea recta desde un punto
const steps_from = p => Math.round(dist(player, p) / STEP);
// "de" + "el Lago Espejo" -> "del Lago Espejo"
const con_art = (prep, l) => (prep + ' ' + l.art + ' ' + l.name).replace('de el ', 'del ').replace('a el ', 'al ');

const base_siguiente = () => flags.find(f => !f.done);               // primera base que falta
const base_sin_marcar = () => flags.find(f => !f.done && !f.mark);   // Rover: primera sin hacer y sin marcar
const bases_hechas = () => flags.filter(f => f.done).length;

// ¿La línea recta de a a b va toda por tierra? (sin cruzar ríos ni lagos)
function ruta_por_tierra(a, b) {
  const n = Math.max(1, Math.ceil(dist(a, b) / 30));
  for (let k = 0; k <= n; k++) if (agua_en(lerp(a.x, b.x, k / n), lerp(a.y, b.y, k / n), -20)) return false;
  return true;
}
// Rover: cada vez que ganas una pista, se mide desde un lugar distinto (nunca el campamento ni los lagos).
// Se prefieren lugares desde donde se pueda caminar en línea recta hasta la base sin cruzar agua.
function pick_ref(f) {
  let c = [], todos = [];
  // pasadas: [distancia mínima, 2 = por tierra / 1 = mismo lado del río / 0 = cualquiera]
  for (const [min, regla] of [[400, 2], [120, 2], [120, 1], [400, 0]]) {
    if (todos.length) break;
    for (const l of landmarks) {
      let ok = ['claro', 'roca', 'arbol', 'pinar', 'muelle', 'cascada'].includes(l.kind) && dist(l, f) > min;
      if (ok && regla >= 1) ok = mismo_lado(l, f);
      if (ok && regla === 2) ok = ruta_por_tierra(l, f);
      if (ok) { todos.push(l); if (l !== last_ref) c.push(l); }
    }
  }
  if (!c.length) c = todos;
  if (!c.length) c = [mundo_lugar('camp')];
  const ref = elegir(c);
  last_ref = ref;
  f.ref = ref;
  f.route = { deg: bearing(ref, f), steps: Math.round(dist(ref, f) / STEP) };
}
// Lugar desde donde se cuentan los pasos ahora (Rover)
function cur_ref() { const f = base_sin_marcar(); return f && f.unlocked ? f.ref : null; }

function flag_hint(f) {
  if (f.cima && cat.hint !== 'ruta') return 'en la cima ' + con_art('de', { art: 'el', name: montana.name }) + ' (sube por el camino)';
  const l = f.lm;
  if (!l) return '';
  switch (cat.hint) {
    case '4': return 'al ' + dir_name4(l, f) + ' ' + con_art('de', l);
    case '8': return 'al ' + dir_name(l, f) + ' ' + con_art('de', l);
    case 'ruta': return f.route ? f.route.deg + '° y ' + f.route.steps + ' pasos ' + con_art('desde', f.ref) : '';
  }
  return 'a ' + bearing(l, f) + '° ' + con_art('de', l);
}
// A dónde ir ahora: { name, hint }
function target() {
  if (!fire.lit) return { name: 'Fogata', hint: 'Préndela para empezar' };
  if (cat.hint === 'ruta') {
    const r = base_sin_marcar();
    if (r) return { name: 'Base ' + r.n, hint: r.unlocked ? flag_hint(r) : 'Resuelve el reto ' + tecla_entre_corchetes('reto') + ' para la pista' };
    if (base_siguiente()) { const mc = muelle_para_cruzar(player, camp); return { name: 'Campamento', hint: mc ? 'Cruza el ' + rios[mc.rio].name + ' en el ' + mc.name : 'Ahí se revisa tu libreta' }; }
  }
  // si hay un río en medio, la pista dice dónde cruzarlo
  const f = base_siguiente(), m = muelle_para_cruzar(player, f || camp);
  const cruce = m ? 'Cruza el ' + rios[m.rio].name + ' en el ' + m.name : '';
  if (!f) return { name: 'Campamento', hint: cruce };
  return { name: 'Base ' + f.n, hint: cruce || flag_hint(f) };
}

// ---------- Claves scout ----------
const RETO_WORDS = ['FOGATA', 'BRUJULA', 'TIENDA', 'MOCHILA', 'LINTERNA', 'BOSQUE', 'NUDO', 'PATRULLA', 'MAPA', 'LAGO',
  'ARBOL', 'ESTRELLA', 'LUNA', 'AGUILA', 'LOBO', 'SCOUT', 'TROPA', 'MANADA', 'RUTA', 'HUELLA', 'CUERDA', 'NORTE',
  'FUEGO', 'AVENTURA', 'CAMPAMENTO', 'SIEMPRE LISTOS', 'BUENA ACCION', 'RIO', 'SOL', 'CANTIMPLORA'];
const MORSE = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
  N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..' };
const CENIT = { C: 'P', P: 'C', E: 'O', O: 'E', N: 'L', L: 'N', I: 'A', A: 'I', T: 'R', R: 'T' };
const CLAVE_KEYS = ['morse', 'murcielago', 'cenit', 'numeros'];
const CLAVE_NOMBRES = { morse: 'Morse', murcielago: 'Murciélago', cenit: 'Cenit-Polar', numeros: 'Números' };

// Escribe la palabra en la clave pedida
function cifrar(key, w) {
  const res = w.split(' ').map(pal => {
    const letras = [...pal].map(c => {
      switch (key) {
        case 'morse': return MORSE[c] || c;
        case 'murcielago': { const k = 'MURCIELAGO'.indexOf(c); return k >= 0 ? String(k) : c; }
        case 'cenit': return CENIT[c] || c;
        default: return String(c.charCodeAt(0) - 64);
      }
    });
    return letras.join(key === 'morse' ? ' ' : key === 'numeros' ? '-' : '');
  });
  // en morse y números las palabras se separan con " / "
  return res.join(key === 'morse' || key === 'numeros' ? ' / ' : ' ');
}
const reto_con_opciones = () => cat.hint === '4' || cat.hint === '8';   // Manada y Tropa eligen entre 4
const opciones_largas = c => reto_con_opciones() && c.form === 'cif' && (c.key === 'morse' || c.key === 'numeros');

// Reto nuevo para la base; si ya hubo uno, sale otro distinto (otra palabra, otra clave o al revés)
function nuevo_reto(f) {
  const last = f.used[f.used.length - 1];
  let c;
  for (let t = 0; t < 60; t++) {
    c = { key: elegir(CLAVE_KEYS), word: elegir(RETO_WORDS), form: 'des' };
    if (last) {
      const v = irandom(2);
      if (v === 0) { c.key = last.key; c.form = last.form; }
      if (v === 1) { c.word = last.word; c.form = last.form; }
      if (v === 2) { c.key = last.key; c.form = last.form === 'des' ? 'cif' : 'des'; }
    }
    if (opciones_largas(c) && c.word.length > 6 && t < 50) continue; // no caben en los botones
    if (!f.used.some(u => u.key === c.key && u.word === c.word && u.form === c.form)) break;
  }
  f.used.push({ key: c.key, word: c.word, form: c.form });
  const enc = cifrar(c.key, c.word);
  c.shown = c.form === 'des' ? enc : c.word;
  c.answer = c.form === 'des' ? c.word : enc;
  if (reto_con_opciones()) {
    const otras = mezclar(RETO_WORDS.filter(w => w !== c.word && cifrar(c.key, w) !== enc && (!opciones_largas(c) || w.length <= 6)));
    c.options = mezclar([c.word, otras[0], otras[1], otras[2]]).map(o => c.form !== 'des' ? cifrar(c.key, o) : o);
  }
  return c;
}

function abrir_reto(f) {
  reto = { f, c: nuevo_reto(f), msg: '', hits: [] };
  texto_tecleado = '';
  soltar_raton();
}
function cerrar_reto() { if (reto) reto.f.wait = true; reto = null; }

// Quita acentos y deja todo en mayúsculas
function normalizar(s) {
  return String(s).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/…/g, '...').replace(/[—–_]/g, '-').trim();
}
// Parte el texto en pedazos según qué caracteres cuentan como parte de un pedazo
const trozos = (s, re) => s.split(re).filter(Boolean).join(' ');
// Compara sin importar mayúsculas, acentos ni espacios de más
function reto_correcto(c, ans) {
  const a = normalizar(ans), b = normalizar(c.answer);
  if (c.form === 'cif' && c.key === 'morse') return trozos(a, /[\s/]+/) === trozos(b, /[\s/]+/);
  if (c.form === 'cif' && c.key === 'numeros') return trozos(a, /[^0-9]+/) === trozos(b, /[^0-9]+/);
  return a.replace(/ /g, '') === b.replace(/ /g, '');
}
function responder_reto(ans) {
  if (!reto) return;
  if (String(ans).trim() === '') { reto.msg = 'Escribe tu respuesta primero.'; return; }
  const f = reto.f;
  if (reto_correcto(reto.c, ans)) {
    cerrar_reto(); f.wait = false;
    if (cat.hint === 'ruta') { f.unlocked = true; pick_ref(f); toast('Pista de la Base ' + f.n + ': ' + flag_hint(f), 7); }
    else {
      f.done = true;
      const left = NUM_FLAGS - bases_hechas();
      toast(left > 0 ? '¡Base ' + f.n + ' completada! Faltan ' + left + '.' : '¡Todas las bases! Regresa al campamento.', 4);
    }
  } else {
    reto.c = nuevo_reto(f); texto_tecleado = '';
    reto.msg = 'No era. Prueba con este otro reto.';
  }
}
// Teclas y clics mientras el reto está abierto
function reto_teclas() {
  if (kp('escape')) { cerrar_reto(); return; }
  if (toque_pulsado()) {
    for (const h of reto.hits) {
      if (!toque_dentro(h)) continue;
      if (h.act === 'salir') cerrar_reto();
      else if (h.act === 'comprobar') responder_reto(texto_tecleado);
      else if (h.act === 'tecla') { if (texto_tecleado.length < 80) texto_tecleado += h.arg; } // teclado del celular
      else if (h.act === 'borrar') texto_tecleado = texto_tecleado.slice(0, -1);
      else responder_reto(h.arg);
      return;
    }
  }
  if (reto_con_opciones()) {
    for (let k = 0; k < 4; k++) if (kp(String(k + 1))) { responder_reto(reto.c.options[k]); return; }
  } else if (kp('enter')) responder_reto(texto_tecleado);
}

// ---------- Cada cuadro: llegar a las bases, revisar la libreta, ganar ----------
function bases_actualizar() {
  if (cat.hint === 'ruta') { // Rover: al volver al campamento con la libreta llena, se revisa
    const llena = flags.every(f => f.done || f.mark);
    if (base_siguiente() && llena && dist(player, camp) < CAMP_ZONE) { book = true; reveal = { t: 0, i: 0 }; soltar_raton(); }
  } else for (const f of flags) { // al llegar a una base se abre su reto
    const d = dist(player, f);
    if (f.wait && d > 120) f.wait = false; // si saliste del reto, se vuelve a abrir al regresar
    if (!f.done && !f.wait && d < 60) { abrir_reto(f); break; }
  }
  if (!base_siguiente() && dist(player, camp) < 120) state = 'win';
}

// ---------- Rover: libreta ----------
function marcar_base() {
  if (dist(player, camp) < CAMP_ZONE) { toast('Sal del campamento para marcar.'); return; }
  const f = base_sin_marcar();
  if (!f) { toast('Ya marcaste todas. Vuelve al campamento a revisar tu libreta.'); return; }
  if (!f.unlocked) { toast('Primero resuelve el reto de la Base ' + f.n + ' con ' + tecla_entre_corchetes('reto') + ' para saber dónde está.', 4); return; }
  f.mark = { deg: bearing(f.ref, player), steps: steps_from(f.ref) };
  toast('Base ' + f.n + ' anotada: ' + f.mark.deg + '°, ' + f.mark.steps + ' pasos ' + con_art('desde', f.ref), 4);
  if (!base_sin_marcar()) toast('¡Libreta completa! Regresa al campamento.', 4);
}
function borrar_ultima_marca() {
  const f = flags.filter(f => !f.done && f.mark).pop();
  if (f) { f.mark = null; toast('Borraste la marca de la Base ' + f.n + '.'); }
}
function pedir_reto() {
  const r = base_sin_marcar();
  if (!r) toast('Ya tienes todas las pistas. Vuelve al campamento.');
  else if (r.unlocked) toast('Ya tienes la pista de la Base ' + r.n + ': ' + flag_hint(r), 4);
  else abrir_reto(r);
}
function revisar_libreta(dt) {
  reveal.t += dt;
  if (reveal.i < NUM_FLAGS) {
    if (reveal.t < 0.9) return;
    reveal.t = 0;
    const f = flags[reveal.i++];
    if (f.done) return;
    const ok = Math.abs(f.mark.steps - f.route.steps) <= TOL_STEPS && ang_diff(f.mark.deg, f.route.deg) <= TOL_DEG;
    if (ok) { f.done = true; f.result = 'ok'; }
    else { f.result = 'mal'; f.mark = null; f.unlocked = false; } // si falla, hay que hacer otro reto
  } else if (reveal.t > 1.6) {
    reveal = null;
    if (!base_siguiente()) { book = false; state = 'win'; }
    else toast('Las que salieron mal se borraron: haz otro reto y búscalas otra vez.', 5);
  }
}

// ---------- Dibujo: ventanita del reto ----------
// Se dibuja en un tamaño fijo (640 x 470) escalado con reto_s
let reto_s = 1, reto_ox = 0, reto_oy = 0;
const rx = x => reto_ox + x * reto_s;
const ry = y => reto_oy + y * reto_s;
function rtexto(x, y, str, px, tipo, halign, col, alpha = 1) { texto(rx(x), ry(y), str, px * reto_s, tipo, halign, col, alpha); }

// act: 'opcion' (con arg), 'comprobar' o 'salir'
function reto_boton(x, y, w, h, text, act, arg, col, tipo) {
  rect_redondo(rx(x), ry(y), w * reto_s, h * reto_s, 9 * reto_s, col, 1);
  let f = 16;
  while (texto_ancho(text, f * reto_s, tipo) > (w - 16) * reto_s && f > 9) f--;
  rtexto(x + w / 2, y + h / 2 + 6, text, f, tipo, 'center', '#fff');
  reto.hits.push({ x: rx(x), y: ry(y), w: w * reto_s, h: h * reto_s, act, arg });
}
// Parte un texto en renglones que quepan en max_w (en unidades de la ventanita)
function partir_texto(text, px, tipo, max_w) {
  const lines = []; let line = '';
  for (const w of text.split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (texto_ancho(t, px * reto_s, tipo) > max_w * reto_s && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}
function tabla_clave(key, x, y, w) {
  const cafe = '#3a2a14', rojo = '#c0392b', gris = '#6b5a3a';
  if (key === 'morse') {
    for (let i = 0; i < 26; i++) { const l = String.fromCharCode(65 + i); rtexto(x + (i % 7 + 0.5) * w / 7, y + 18 + Math.floor(i / 7) * 24, l + ' ' + MORSE[l], 14, 2, 'center', cafe); }
  } else if (key === 'murcielago') {
    for (let i = 0; i < 10; i++) {
      const cx = x + (i + 0.5) * w / 10;
      rtexto(cx, y + 30, 'MURCIELAGO'[i], 20, 2, 'center', cafe);
      rtexto(cx, y + 62, String(i), 20, 2, 'center', rojo);
    }
    rtexto(x + w / 2, y + 92, 'Las letras que no están en MURCIÉLAGO se quedan igual', 12, false, 'center', gris);
  } else if (key === 'cenit') {
    for (let i = 0; i < 5; i++) {
      const cx = x + (i + 0.5) * w / 5;
      rtexto(cx, y + 30, 'CENIT'[i], 20, 2, 'center', cafe);
      rtexto(cx, y + 52, '↕', 16, false, 'center', '#8e7a4a');
      rtexto(cx, y + 74, 'POLAR'[i], 20, 2, 'center', rojo);
    }
    rtexto(x + w / 2, y + 98, 'Se cambia una por la otra; las demás letras se quedan igual', 12, false, 'center', gris);
  } else {
    for (let i = 0; i < 26; i++) rtexto(x + (i % 9 + 0.5) * w / 9, y + 20 + Math.floor(i / 9) * 26, String.fromCharCode(65 + i) + '=' + (i + 1), 14, 2, 'center', cafe);
  }
}

// ---------- Teclado del celular para los retos en que se escribe ----------
// Solo trae las teclas que sirven para esa clave: Morse (punto, raya y / entre palabras), Números, o letras.
// Espacio y Borrar siempre están.
function teclado_teclas(c) {
  if (c.form === 'cif' && c.key === 'morse') return ['.', '-', '/'];
  if (c.form === 'cif' && c.key === 'numeros') return ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '/'];
  const t = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
  if (c.form === 'cif' && c.key === 'murcielago') for (let i = 0; i <= 9; i++) t.push(String(i));
  return t;
}
// Dibuja el teclado dentro del rectángulo (x0, y0, w, h) y guarda sus teclas en reto.hits
function teclado_dibujar(x0, y0, w, h) {
  const teclas = teclado_teclas(reto.c), n = teclas.length;
  const cols = n <= 3 ? 3 : n <= 12 ? 4 : n <= 26 ? 6 : 7;
  const filas = Math.ceil(n / cols) + 1; // +1: la fila de Espacio y Borrar
  const g = 5, kw = (w - g * (cols - 1)) / cols, kh = Math.min(kw * 0.9, (h - g * (filas - 1)) / filas);
  const alto = filas * kh + (filas - 1) * g, yy = y0 + (h - alto) / 2;
  rect_redondo(x0 - 8, yy - 8, w + 16, alto + 16, 12, '#2a3a2c', 0.92);
  const verde = '#4a5f45', px = clamp(kh * 0.45, 11, 26);
  teclas.forEach((t, i) => {
    const x = x0 + (i % cols) * (kw + g), y = yy + Math.floor(i / cols) * (kh + g);
    rect_redondo(x, y, kw, kh, 7, verde, 1);
    const lbl = t === '.' ? 'punto .' : (t === '-' && reto.c.key === 'morse') ? 'raya -' : t;
    let p = px;
    while (p > 9 && texto_ancho(lbl, p, 2) > kw - 6) p--;
    texto(x + kw / 2, y + kh / 2 + p * 0.36, lbl, p, 2, 'center', '#fff');
    reto.hits.push({ x, y, w: kw, h: kh, act: 'tecla', arg: t });
  });
  const y = yy + (filas - 1) * (kh + g), mw = (w - g) / 2, bp = clamp(kh * 0.36, 11, 20);
  rect_redondo(x0, y, mw, kh, 7, verde, 1);
  texto(x0 + mw / 2, y + kh / 2 + bp * 0.36, 'Espacio', bp, true, 'center', '#fff');
  reto.hits.push({ x: x0, y, w: mw, h: kh, act: 'tecla', arg: ' ' });
  rect_redondo(x0 + mw + g, y, mw, kh, 7, '#8a5a30', 1);
  texto(x0 + mw + g + mw / 2, y + kh / 2 + bp * 0.36, 'Borrar', bp, true, 'center', '#fff');
  reto.hits.push({ x: x0 + mw + g, y, w: mw, h: kh, act: 'borrar' });
}
function reto_dibujar() {
  const VW = 640, VH = 470, c = reto.c;
  reto.hits = [];
  rect(0, 0, W, H, '#000', 0.6);
  // en el celular, si hay que escribir, el teclado va a la derecha (o abajo si el celular está parado)
  let aw = W, ah = H;
  if (tactil && !reto_con_opciones()) {
    if (W >= H) { aw = W * 0.6; teclado_dibujar(aw + 10, 14, W - aw - 24, H - 28); }
    else { ah = H * 0.58; teclado_dibujar(14, ah + 10, W - 28, H - ah - 24); }
  }
  reto_s = Math.min(1.2, (aw - 12) / VW, (ah - 12) / VH);
  reto_ox = (aw - VW * reto_s) / 2; reto_oy = (ah - VH * reto_s) / 2;
  panel_borde(rx(0), ry(0), VW * reto_s, VH * reto_s, 14 * reto_s, '#f4ecd2', '#8e7a4a', 3 * reto_s);
  const nombre = CLAVE_NOMBRES[c.key];
  rtexto(VW / 2, 36, 'Base ' + reto.f.n + ' · Clave ' + nombre, 22, true, 'center', '#3a2a14');
  rtexto(VW / 2, 62, c.form === 'des' ? 'Descifra este mensaje:' : 'Escribe esta palabra en clave ' + nombre + ':', 15, false, 'center', '#6b5a3a');
  partir_texto(c.shown, 22, 2, VW - 60).slice(0, 2).forEach((l, i) => rtexto(VW / 2, 96 + i * 28, l, 22, 2, 'center', '#2a4a8a'));

  if (reto_con_opciones()) {
    c.options.forEach((o, i) => reto_boton(30 + (i % 2) * 300, 150 + Math.floor(i / 2) * 48, 280, 40, (tactil ? '' : (i + 1) + '.  ') + o, 'opcion', o, '#4a5f45', 2));
  } else {
    // cajita de texto
    panel_borde(rx(30), ry(150), 430 * reto_s, 42 * reto_s, 8 * reto_s, '#fffaf0', '#8e7a4a', 2 * reto_s);
    let txt = texto_tecleado;
    const px = 18 * reto_s, max = 430 * reto_s - 24 * reto_s;
    while (txt && texto_ancho(txt, px, 2) > max) txt = txt.slice(1); // si no cabe, se ve el final
    if (!txt) texto(rx(40), ry(177), c.form === 'des' ? 'Escribe la palabra...' : c.key === 'morse' ? 'Usa . y - con espacios' : 'Escribe la clave...', px, 2, 'left', '#a09a8a');
    else texto(rx(40), ry(177), txt, px, 2, 'left', '#2a2a2a');
    if (Math.floor(ahora() / 500) % 2 === 0) { // cursor que parpadea
      const cx = rx(40) + (txt ? texto_ancho(txt, px, 2) : 0) + 1;
      linea_redonda(cx, ry(160), cx, ry(182), Math.max(1, reto_s * 1.5), '#2a2a2a');
    }
    reto_boton(475, 150, 135, 42, 'Comprobar', 'comprobar', null, '#4a5f45', true);
  }
  if (reto.msg) rtexto(VW / 2, 268, reto.msg, 15, true, 'center', '#c0392b');
  linea_redonda(rx(30), ry(284), rx(VW - 30), ry(284), Math.max(1, reto_s), 'rgba(142,122,74,0.5)');
  rtexto(30, 302, 'Tabla de la clave', 13, true, 'left', '#6b5a3a');
  tabla_clave(c.key, 30, 308, VW - 60);
  reto_boton(VW - 140, VH - 46, 110, 32, 'Salir', 'salir', null, '#c0392b', true);
  let ayuda = reto_con_opciones() ? '1-4 o clic para elegir · Esc: salir' : 'Enter: comprobar · Esc: salir';
  if (tactil) ayuda = reto_con_opciones() ? 'Toca la respuesta' : (c.key === 'morse' && c.form === 'cif' ? 'Letras separadas con Espacio, palabras con /' : 'Escribe con el teclado y toca Comprobar');
  rtexto(30, VH - 24, ayuda, 13, false, 'left', '#6b5a3a');
}

// ---------- Dibujo: libreta del Rover ----------
// Se dibuja en un tamaño fijo (560 x 400) achicado con reto_s, para que quepa en el celular.
let libreta_borrar = null; // botón de borrar la última marca (en el celular)
function libreta_dibujar() {
  rect(0, 0, W, H, '#000', 0.6);
  const w = 560, h = 400;
  reto_s = Math.min(1, (W - 20) / w, (H - 20) / h); reto_ox = (W - w * reto_s) / 2; reto_oy = (H - h * reto_s) / 2;
  libreta_borrar = null;
  const hay_marca = flags.some(f => !f.done && f.mark);
  panel_borde(rx(0), ry(0), w * reto_s, h * reto_s, 12 * reto_s, '#f4ecd2', '#8e7a4a', 3 * reto_s);
  for (let y = 90; y < h - 50; y += 28) linea_redonda(rx(20), ry(y), rx(w - 20), ry(y), 1, 'rgba(80,120,180,0.25)'); // renglones
  rtexto(w / 2, 42, 'Libreta de campo', 24, true, 'center', '#3a2a14');
  rtexto(w / 2, 66, 'Se vale fallar hasta ' + TOL_STEPS + ' pasos y ' + TOL_DEG + '°', 13, false, 'center', '#6b5a3a');
  flags.forEach((f, i) => {
    const y = 110 + i * 52;
    const checking = reveal && ((reveal.i === i + 1 && reveal.t < 0.9) || reveal.i <= i);
    rtexto(24, y, 'Base ' + f.n, 16, true, 'left', '#3a2a14');
    const pista = (f.unlocked || f.done) && f.route ? 'Pista: ' + f.route.deg + '°, ' + f.route.steps + ' pasos desde ' + f.ref.name : 'Pista: ??? (resuelve el reto)';
    rtexto(24, y + 20, pista, 14, false, 'left', '#6b5a3a');
    let txt, col;
    if (f.done) { txt = '¡Encontrada!'; col = '#2e8b3a'; }
    else if (reveal && reveal.i <= i && f.mark) { txt = f.mark.deg + '°, ' + f.mark.steps + ' pasos  ...'; col = '#3a2a14'; }
    else if (f.mark) { txt = 'Tu marca: ' + f.mark.deg + '°, ' + f.mark.steps + ' pasos'; col = '#2a4a8a'; }
    else if (f.result === 'mal') { txt = 'Mal, búscala otra vez'; col = '#c0392b'; }
    else { txt = '- sin marcar -'; col = '#9a8a6a'; }
    if (checking && f.mark && !f.done) col = '#b07a10';
    rtexto(w - 24, y, txt, 15, true, 'right', col);
  });
  if (reveal) { rtexto(w / 2, h - 18, 'Revisando...', 13, false, 'center', '#6b5a3a'); return; }
  if (!tactil) { rtexto(w / 2, h - 18, nombre_tecla(settings.binds.libreta) + ' o clic: cerrar · Borrar: quitar la última marca', 13, false, 'center', '#6b5a3a'); return; }
  // celular: tocar afuera cierra; si hay marcas, un botón para borrar la última
  rtexto(24, h - 20, 'Toca afuera para cerrar', 13, false, 'left', '#6b5a3a');
  if (hay_marca) {
    const bx = w - 214, by = h - 44, bw = 190, bh = 32;
    rect_redondo(rx(bx), ry(by), bw * reto_s, bh * reto_s, 8 * reto_s, '#c0392b', 1);
    rtexto(bx + bw / 2, by + bh / 2 + 6, 'Borrar última marca', 15, true, 'center', '#fff');
    libreta_borrar = { x: rx(bx), y: ry(by), w: bw * reto_s, h: bh * reto_s };
  }
}
