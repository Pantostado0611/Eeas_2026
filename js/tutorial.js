// Mini tutorial al empezar (unos 30 segundos): tres pasos cortos que avanzan cuando los haces.
// Se puede saltar (Enter o el botón "Saltar") y se recuerda si ya lo viste (localStorage 'scout_tutorial_visto').
const TUTO_KEY = 'scout_tutorial_visto';
const TUTO_PASOS = [
  () => 'Abre tu pasaporte con ' + tecla_entre_corchetes('mapa') + ' para ver el mapa del bosque.',
  () => 'La brújula de arriba a la derecha te dice hacia dónde miras. Gira un poco para ver cómo se mueve.',
  () => 'Las ramas se recogen solas: pasa caminando encima de una (son la leña de la fogata).',
];
let tuto = null, tuto_saltar = null; // tuto: { paso, giro, ang, madera } o null; tuto_saltar: dónde está el botón

function tuto_visto() { try { return localStorage.getItem(TUTO_KEY) === '1'; } catch (_) { return false; } }
function tuto_terminar(saltado) {
  tuto = null;
  try { localStorage.setItem(TUTO_KEY, '1'); } catch (_) { /* sin localStorage: se vuelve a mostrar la próxima vez */ }
  if (!saltado) toast('¡Listo! Ahora prende la fogata: acércate y presiona ' + tecla_entre_corchetes('usar') + '.', 6);
}
function tuto_empezar() { tuto = tuto_visto() ? null : { paso: 0, giro: 0, ang: player.ang, madera: wood }; }

// Cada cuadro de juego (antes de las ventanitas, para enterarse de que abriste el pasaporte)
function tuto_actualizar() {
  if (!tuto) return;
  const libre = !reto && !book && !prender && !reveal && !mapa_abierto && !(canoa && canoa.manual); // (Enter también sirve en el reto)
  if (libre && (kp('enter') || (tactil && tuto_saltar && toque_pulsado() && toque_dentro(tuto_saltar)))) {
    if (tactil) toque_usado = true;
    tuto_terminar(true); return;
  }
  // cuánto has girado (para el paso de la brújula)
  const d = Math.atan2(Math.sin(player.ang - tuto.ang), Math.cos(player.ang - tuto.ang));
  tuto.ang = player.ang;
  if (tuto.paso === 0 && mapa_abierto) tuto.paso = 1;
  else if (tuto.paso === 1 && !mapa_abierto) { tuto.giro += Math.abs(d); if (tuto.giro > 1.2) { tuto.paso = 2; tuto.madera = wood; } }
  else if (tuto.paso === 2) {
    ramas_aviso = true; // (el aviso de las ramas ya lo da el tutorial)
    if (wood > tuto.madera) tuto_terminar(false);
  }
}

// Recuadro arriba al centro con el paso actual y cómo saltarlo
function tuto_dibujar() {
  tuto_saltar = null;
  if (!tuto || mapa_abierto) return;
  const k = hud_k(), px = fk(16, k), w = Math.min(W - 24, 560 * k), x = W / 2, y = Math.max(70 * k, H * 0.17);
  const texto_paso = 'Paso ' + (tuto.paso + 1) + ' de ' + TUTO_PASOS.length + ': ' + TUTO_PASOS[tuto.paso]();
  // en renglones que quepan en el recuadro
  const lineas = []; let l = '';
  for (const p of texto_paso.split(' ')) { const t = l ? l + ' ' + p : p; if (texto_ancho(t, px, true) > w - 30 && l) { lineas.push(l); l = p; } else l = t; }
  if (l) lineas.push(l);
  const lh = px * 1.35, alto = lineas.length * lh;
  rect_redondo(x - w / 2, y - px * 1.4, w, alto + px * 2.9, 10 * k, '#173a24', 0.88);
  lineas.forEach((t, i) => texto(x, y + i * lh, t, px, true, 'center', '#fff'));
  const ys = y + alto + px * 0.3;
  if (tactil) {
    const bw = 96 * k, bh = 28 * k;
    tuto_saltar = { x: x - bw / 2, y: ys - bh * 0.7, w: bw, h: bh };
    rect_redondo(tuto_saltar.x, tuto_saltar.y, bw, bh, 8 * k, '#4a5f45', 1);
    texto(x, tuto_saltar.y + bh / 2 + 5 * k, 'Saltar', fk(14, k), true, 'center', '#fff');
  } else texto(x, ys, 'Enter: saltar el tutorial', fk(12, k), false, 'center', '#cfe3c8');
}
