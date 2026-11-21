// Supervivencia: leña, raciones, fogata, energía (hambre y frío), lluvia y mensajes. (La comida de verdad es en el comedor: comedor.js)
// También: prender la fogata, río (chaleco, canoa y rescate) y Cerro del Coyote (sendero, cuerda y rapel).

const WOOD_MAX = 8;    // leña que puedes cargar
const FOOD_MAX = RACIONES_MAX; // raciones que puedes cargar (te las dan en el comedor)

// ---------- Mensajes cortos ----------
function toast(text, t = 3) { toasts.push({ text, t }); if (toasts.length > 3) toasts.shift(); }
function toasts_actualizar(dt) {
  for (let i = toasts.length - 1; i >= 0; i--) { toasts[i].t -= dt; if (toasts[i].t <= 0) toasts.splice(i, 1); }
}
// "[E]" con la tecla que tenga asignada esa acción (en el celular, el nombre del botón: "[Usar]")
function tecla_entre_corchetes(accion) {
  if (tactil) {
    const nombres = { usar: 'Usar', comer: 'Ración', mapa: 'Pasaporte', libreta: 'Libreta', marcar: 'Marcar', reto: 'Reto', correr: 'Correr' };
    if (nombres[accion]) return '[' + nombres[accion] + ']';
  }
  return '[' + nombre_tecla(settings.binds[accion]) + ']';
}

// ---------- Usar / recoger ----------
// ¿Hay algo cerca con lo que se pueda interactuar? Devuelve { kind, obj, label } o null
function cerca_de_algo() {
  const u = tecla_entre_corchetes('usar') + ' ';
  const mc = monte_cerca();
  if (mc) return mc;
  if (adentro) return comedor_cerca();
  if (monte_modo !== '') return null;
  if (dist(player, camp) < 80) {
    if (!fire.lit) return { kind: 'fire', label: u + 'Prender la fogata' };
    return { kind: 'fire', label: wood > 0 ? u + 'Echar leña' : 'Necesitas leña' };
  }
  const m = muelle_cerca();
  if (m) {
    const dr = dist(player, m.rack), da = dist(player, m.abordar);
    if (dr < 70 && dr <= da) return { kind: 'chaleco', obj: m, label: u + (chaleco ? 'Dejar el chaleco' : 'Ponerte el chaleco salvavidas') };
    if (da < 75) return { kind: 'canoa', obj: m, label: u + 'Subirte a la canoa' };
  }
  return null;
}
function usar() {
  const n = cerca_de_algo();
  if (!n) return;
  if (n.kind === 'chaleco') { chaleco = !chaleco; toast(chaleco ? 'Te pusiste el chaleco salvavidas. ¡Ya te puedes subir a la canoa!' : 'Dejaste el chaleco en el muelle.', 4); return; }
  if (n.kind === 'canoa') { canoa_subir(n.obj); return; }
  if (n.kind === 'cuerda') { if (cuerda !== n.obj.k) { cuerda = n.obj.k; toast('Te enganchaste a la cuerda. ¡Ahora sí puedes pasar!', 3); } return; }
  if (n.kind === 'rapel') { rapel_empezar(); return; }
  if (n.kind === 'ventanilla' || n.kind === 'mesa') { comedor_usar(n); return; }
  if (n.kind === 'fire') {
    if (!fire.lit) { abrir_prender(); return; }
    if (wood <= 0) { toast('No traes leña. Busca ramas en el bosque.'); return; }
    const need = Math.ceil((100 - fire.fuel) / 20);
    const used = Math.max(1, Math.min(wood, need));
    wood -= used; fire.fuel = Math.min(100, fire.fuel + used * 20);
    toast('Echaste ' + used + ' de leña al fuego.');
  }
}
// Comer una ración de la mochila (te las dan en el comedor, en la ventanilla de Agua y raciones)
function comer() {
  if (food <= 0) { toast('No traes raciones. Ve al comedor a la hora de comer: ahí te dan para el camino.', 4); return; }
  if (energy >= 95) { toast('No tienes hambre. Guarda tu ración para después.'); return; }
  food--; energy = Math.min(100, energy + ENERGIA_RACION);
  toast('Te comiste una ración. +energía (te ' + (food === 1 ? 'queda 1' : 'quedan ' + food) + ')');
}

// ---------- Cada cuadro (solo mientras se juega) ----------
function clima_actualizar(dt) {
  if (rain) {
    rain_timer -= dt;
    if (rain_timer <= 0) { rain = false; next_rain = (90 + random(120)) * cat.rain; toast('Dejó de llover.'); }
  } else {
    next_rain -= dt;
    if (next_rain <= 0) { rain = true; rain_timer = 30 + random(35); toast('Empezó a llover: el fuego se gasta más rápido.', 4); }
  }
}
function supervivencia_actualizar(dt, running) {
  // Al entrar a un lugar conocido te dice su nombre
  let pn = '';
  for (const l of landmarks) if (dist(player, l) < l.zone) { pn = l.name; break; }
  if (pn !== player.place) { if (pn !== '' && player.place !== null) toast(pn); player.place = pn; }

  // Ramas: se recogen solas al pasar
  for (let i = sticks.length - 1; i >= 0; i--) {
    if (wood < WOOD_MAX && dist(player, sticks[i]) < 26) {
      sticks.splice(i, 1); wood++; mundo_poner_rama();
      if (wood === WOOD_MAX) toast('Ya llevas toda la leña que puedes cargar (8).');
    }
  }

  // Fogata: si se apaga, se acaba el juego
  if (fire.lit) {
    const antes = fire.fuel;
    // Recién prendida (70) dura 7:00 sin lluvia y 5:30 con lluvia en Tropa (el doble que en el mapa chico, ESC);
    // las demás categorías por fire_dur
    fire.fuel -= dt * (rain ? 70 / 165 : 70 / 210) / cat.fire_dur / ESC;
    if (antes > 25 && fire.fuel <= 25) toast('¡La fogata se está apagando! Échale leña.', 4);
    if (antes > 10 && fire.fuel <= 10) toast('¡Ya casi se apaga la fogata! Corre con leña.', 4);
    if (fire.fuel <= 0) { fire.fuel = 0; lose_reason = 'fogata'; state = 'lose'; return; }
  }

  // Energía (hambre + frío). Llena te dura unas 9 horas del juego en Tropa (en tiempo real depende de la modalidad).
  // Dentro del comedor no hace frío ni te mojas.
  const cold = !adentro && es_noche() && (fire.fuel <= 0 || dist(player, camp) > 320);
  let drain = comiendo ? 0 : 100 / 9 * cat.energy * 24 / dia_len(); // sentado comiendo no se gasta
  if (running && player.moving) drain *= 1.8;
  if (cold) drain *= 1.6;
  if (rain && !adentro) drain *= 1.15;
  energy -= dt * drain;
  if (cold && Math.random() < dt / 20) toast('Tienes frío... acércate a la fogata.');
  if (energy <= 25 && energy + dt * drain > 25) toast('Tienes mucha hambre. ' + (food > 0 ? 'Cómete una ración con ' + tecla_entre_corchetes('comer') + '.' : 'Ve al comedor.'), 4);
  if (energy <= 0) { energy = 0; lose_reason = 'energia'; state = 'lose'; }
}
// Gotas de lluvia (en coordenadas de pantalla)
function lluvia_actualizar(dt) {
  if (rain) for (let i = 0; i < 6; i++) drops.push({ x: random(W), y: -10, v: 700 + random(300) });
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.y += d.v * dt; d.x -= d.v * dt * 0.15;
    if (d.y >= H + 20) drops.splice(i, 1);
  }
}

// ---------- Prender la fogata (al principio de la partida) ----------
// Hasta que la prendes no cuentan las bases. Se puede con encendedor (suerte) o con fricción (arco).
function abrir_prender() {
  prender = { metodo: null, calor: 0, brasa: false, soplos: 0, intentos: 0, msg: '', chispa: 0, lado: 0, hits: [] };
  soltar_raton();
}
function prender_listo() {
  prender = null;
  fire.lit = true; fire.fuel = 70;
  toast('¡Prendiste la fogata! Si se apaga, se acaba el juego.', 5);
  if (cat.hint === 'ruta') toast('Resuelve el reto ' + tecla_entre_corchetes('reto') + ' para saber dónde está cada base. Luego marca con ' + tecla_entre_corchetes('marcar') + '.', 7);
  else toast('Ahora sí: llega a las 5 bases y resuelve su reto.', 6);
  toast('El comedor está al sur del campamento. Los horarios vienen en tu pasaporte ' + tecla_entre_corchetes('mapa') + '.', 7);
}
function prender_elegir(metodo) {
  Object.assign(prender, { metodo, calor: 0, brasa: false, soplos: 0, intentos: 0, lado: 0, msg: '' });
}
function prender_actualizar(dt) {
  const p = prender, b = settings.binds;
  p.chispa = Math.max(0, p.chispa - dt);
  if (kp('escape')) { prender = null; return; }
  let toque_accion = false, toque_izq = false, toque_der = false; // botones del celular
  if (toque_pulsado()) {
    for (const h of p.hits) {
      if (!toque_dentro(h)) continue;
      if (h.act === 'accion') { toque_accion = true; break; }
      if (h.act === 'izq') { toque_izq = true; break; }
      if (h.act === 'der') { toque_der = true; break; }
      if (h.act === 'salir') prender = null;
      else if (h.act === 'cambiar') p.metodo = null;
      else prender_elegir(h.arg);
      return;
    }
  }
  if (!p.metodo) {
    if (kp('1')) prender_elegir('encendedor');
    if (kp('2')) prender_elegir('friccion');
    return;
  }
  const accion = kp(b.usar) || kp(' ') || toque_accion;
  if (p.metodo === 'encendedor') {
    // cada intento prende con la probabilidad de la categoría (la mitad si llueve). Nunca más de 5 (u 8 con lluvia) intentos.
    if (accion) {
      p.intentos++; p.chispa = 0.3;
      if (Math.random() < cat.lighter * (rain ? 0.5 : 1) || p.intentos >= (rain ? 8 : 5)) { prender_listo(); return; }
      p.msg = elegir(['Sólo salieron chispas... otra vez.', 'Casi... vuelve a intentar.', 'El viento la apagó. Otra vez.']);
    }
  } else if (!p.brasa) {
    // fricción: alterna izquierda y derecha para mover el arco; el calor se va bajando solo
    const izq = kp(b.izquierda) || kp('arrowleft') || toque_izq;
    const der = kp(b.derecha) || kp('arrowright') || toque_der;
    if (izq && p.lado !== -1) { p.lado = -1; p.calor += 7; }
    else if (der && p.lado !== 1) { p.lado = 1; p.calor += 7; }
    p.calor = clamp(p.calor - dt * (rain ? 14 : 9), 0, 100);
    if (p.calor >= 100) { p.brasa = true; p.msg = '¡Salió una brasa! Ponla en la yesca y sopla.'; }
    else if (p.calor > 60) p.msg = '¡Ya sale humo! No pares.';
    else p.msg = '';
  } else if (accion) {
    p.soplos++; p.chispa = 0.3;
    if (p.soplos >= 4) { prender_listo(); return; }
    p.msg = 'Sopla otra vez...';
  }
}
// Botón de la ventanita (usa las mismas medidas escaladas que el reto)
function prender_boton(x, y, w, h, text, act, arg, col) {
  rect_redondo(rx(x), ry(y), w * reto_s, h * reto_s, 9 * reto_s, col, 1);
  rtexto(x + w / 2, y + h / 2 + 6, text, 16, true, 'center', '#fff');
  prender.hits.push({ x: rx(x), y: ry(y), w: w * reto_s, h: h * reto_s, act, arg });
}
function prender_dibujar() {
  const p = prender, VW = 560, VH = 380;
  reto_s = Math.min(1.2, (W - 12) / VW, (H - 12) / VH);
  reto_ox = (W - VW * reto_s) / 2; reto_oy = (H - VH * reto_s) / 2;
  p.hits = [];
  const cafe = '#3a2a14', gris = '#6b5a3a', verde = '#4a5f45', naranja = '#e8692a';
  const u = tecla_entre_corchetes('usar'), k = reto_s, cx = rx(VW / 2), by = ry(250);
  rect(0, 0, W, H, '#000', 0.6);
  panel_borde(rx(0), ry(0), VW * reto_s, VH * reto_s, 14 * reto_s, '#f4ecd2', '#8e7a4a', 3 * reto_s);
  rtexto(VW / 2, 38, 'Prende la fogata', 24, true, 'center', cafe);

  if (!p.metodo) {
    rtexto(VW / 2, 66, '¿Con qué la vas a prender?', 16, false, 'center', gris);
    prender_boton(40, 95, 230, 48, (tactil ? '' : '1. ') + 'Encendedor', 'metodo', 'encendedor', verde);
    prender_boton(290, 95, 230, 48, (tactil ? '' : '2. ') + 'Fricción (arco)', 'metodo', 'friccion', verde);
    rtexto(155, 172, 'Rápido, pero a veces', 14, false, 'center', gris);
    rtexto(155, 192, 'sólo saca chispas.', 14, false, 'center', gris);
    rtexto(405, 172, 'Como los scouts de antes:', 14, false, 'center', gris);
    rtexto(405, 192, 'frota hasta sacar una brasa.', 14, false, 'center', gris);
    if (rain) rtexto(VW / 2, 236, 'Está lloviendo: va a costar más trabajo.', 14, true, 'center', '#2a4a8a');
  } else if (p.metodo === 'encendedor') {
    rtexto(VW / 2, 66, tactil ? 'Toca "Girar ruedita" una y otra vez' : 'Presiona ' + u + ' o Espacio para girar la ruedita', 16, false, 'center', gris);
    if (tactil) prender_boton(VW / 2 + 70, 160, 170, 52, 'Girar ruedita', 'accion', null, verde);
    rect_redondo(cx - 22 * k, by - 80 * k, 44 * k, 80 * k, 8 * k, '#c0392b', 1);
    rect_redondo(cx - 20 * k, by - 104 * k, 40 * k, 26 * k, 4 * k, '#a8a8a8', 1);
    blob(cx + 8 * k, by - 108 * k, 8 * k, '#5a5a5a');
    if (p.chispa > 0) for (let i = 0; i < 7; i++)
      blob(cx - 6 * k + (Math.random() * 36 - 18) * k, by - 118 * k - random(24) * k, (1.5 + Math.random() * 2) * k, elegir([naranja, '#ffd34d']));
    rtexto(VW / 2, 282, 'Intentos: ' + p.intentos, 14, false, 'center', gris);
  } else {
    // tabla, palito y arco que se mueve de un lado a otro
    const off = p.lado * 40 * k;
    rect_redondo(cx - 90 * k, by - 14 * k, 180 * k, 18 * k, 4 * k, '#8a5a30', 1);
    linea_redonda(cx, by - 14 * k, cx, by - 110 * k, 7 * k, '#b0844a');
    linea_redonda(cx - 70 * k + off, by - 62 * k, cx + 70 * k + off, by - 62 * k, 5 * k, '#5a3a20');
    if (p.calor > 40 || p.brasa) {
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 3; i++) blob(cx + Math.sin(ahora() / 300 + i) * 10 * k, by - (24 + i * 18) * k, (6 + i * 3) * k, '#808080');
      ctx.globalAlpha = 1;
    }
    if (p.brasa) {
      blob(cx, by - 16 * k, (5 + p.chispa * 10) * k, naranja);
      rtexto(VW / 2, 66, tactil ? 'Toca "Soplar" varias veces' : 'Sopla con ' + u + ' o Espacio', 16, false, 'center', gris);
      if (tactil) prender_boton(VW / 2 + 90, 160, 150, 52, 'Soplar', 'accion', null, verde);
      rtexto(VW / 2, 282, 'Soplos: ' + p.soplos + ' / 4', 14, false, 'center', gris);
    } else {
      const b = settings.binds, bw = 300;
      if (tactil) {
        rtexto(VW / 2, 66, 'Toca Izquierda y Derecha, una y otra, rápido para frotar', 15, false, 'center', gris);
        prender_boton(30, 150, 120, 64, 'Izquierda', 'izq', null, p.lado === -1 ? gris : verde);
        prender_boton(VW - 150, 150, 120, 64, 'Derecha', 'der', null, p.lado === 1 ? gris : verde);
      } else rtexto(VW / 2, 66, 'Alterna ' + nombre_tecla(b.izquierda) + ' y ' + nombre_tecla(b.derecha) + ' (o las flechas) rápido para frotar', 15, false, 'center', gris);
      rect_redondo(rx((VW - bw) / 2), ry(270), bw * k, 18 * k, 6 * k, '#000', 0.4);
      if (p.calor >= 1) rect_redondo(rx((VW - bw) / 2) + 2 * k, ry(272), (bw - 4) * k * p.calor / 100, 14 * k, 5 * k, naranja, 1);
      rtexto(VW / 2, 305, 'Calor', 13, true, 'center', gris);
    }
  }
  if (p.msg) rtexto(VW / 2, p.metodo ? 96 : 256, p.msg, 15, true, 'center', '#c0392b');
  if (p.metodo) prender_boton(30, VH - 50, 170, 34, 'Cambiar de método', 'cambiar', null, gris);
  prender_boton(VW - 140, VH - 50, 110, 34, 'Salir', 'salir', null, '#c0392b');
}

// ---------- Río: chaleco salvavidas, canoa y rescate ----------
// En cada muelle hay chalecos y una canoa. Regla scout: sin chaleco no te subes.
// Remar con el mouse: clic izquierdo = remo del lado derecho (la canoa gira a la izquierda),
// clic derecho = remo del lado izquierdo (gira a la derecha). Si remas muchas veces seguidas
// del mismo lado la canoa se tambalea y se puede voltear: entonces flotas con el chaleco y
// esperas a la canoa de seguridad. La corriente y el tambaleo dependen de la sección y de la lluvia.
const remo_corriente = () => cat.corriente * (rain ? 1.5 : 1);
const remo_tambaleo = () => cat.tambaleo * (rain ? 1.3 : 1);

// Muelle más cercano (si estás a menos de 200)
function muelle_cerca() {
  let best = null, bd = 200;
  for (const m of muelles) { const d = dist(player, m); if (d < bd) { bd = d; best = m; } }
  return best;
}
function canoa_subir(m) {
  if (!chaleco) { toast('¡Primero ponte el chaleco salvavidas! Regla scout: nadie se sube a una canoa sin chaleco.', 5); return; }
  const ang = Math.atan2(-m.oy, -m.ox); // mirando hacia el otro lado del río
  // manual: la primera vez de cada partida se explica cómo remar antes de empezar (el juego se pausa)
  canoa = { x: m.agua.x, y: m.agua.y, ang, v: 0, w: 0, bal: 0, lado: 0, remo_t: 9, desde: m, t: 0, manual: !canoa_manual_visto };
  player.x = canoa.x; player.y = canoa.y; player.ang = ang; player.pitch = 0; player.moving = false;
  soltar_raton();
  if (canoa_manual_visto) toast('Rema hasta el ' + m.otro.name + '. ' + (tactil ? 'Toca un lado y luego el otro' : 'Alterna los clics') + ' para ir derecho.', 5);
}
function canoa_bajar(m) {
  const origen = canoa.desde;
  canoa = null; chaleco = false;
  player.x = m.x; player.y = m.y; player.ang = Math.atan2(m.oy, m.ox); player.pitch = 0; player.moving = false;
  toast((m === origen ? 'Regresaste al ' : '¡Llegaste al ') + m.name + '! Dejaste el chaleco en el muelle.', 4);
}
function canoa_voltear() {
  const m = canoa.desde, s = rios[m.rio].seguridad;
  canoa = null;
  rescate = { desde: m, bx: s.x, by: s.y, bi: s.i, ax: s.ax, ay: s.ay, agit: 0, t: 0 };
  toast('¡Se volteó la canoa! Mantén la calma: el chaleco te mantiene a flote.', 6);
}
function rescatado() {
  const m = rescate.desde;
  rescate = null; chaleco = false;
  player.x = m.x; player.y = m.y; player.ang = Math.atan2(m.oy, m.ox); player.pitch = 0; player.moving = false;
  toast('La canoa de seguridad te regresó al ' + m.name + '. ¡El chaleco te salvó!', 5);
}
// Cada cuadro mientras vas en la canoa o esperando el rescate
function rio_actualizar(dt) {
  if (rescate) { rescate_actualizar(dt); return; }
  const c = canoa;
  if (c.manual) { // leyendo el manual: con un toque, clic, Enter o Espacio se empieza a remar
    if (toque_pulsado() || kp('enter') || kp(' ')) { c.manual = false; canoa_manual_visto = true; }
    return;
  }
  c.t += dt; c.remo_t += dt;
  let lado = 0;
  if (tactil) lado = tactil_remo;            // celular: mitad izquierda o derecha de la pantalla
  else if (raton.pulsado[0]) lado = -1;      // remo del lado derecho: gira a la izquierda
  else if (raton.pulsado[2]) lado = 1;       // remo del lado izquierdo: gira a la derecha
  if (lado !== 0) {
    c.v = Math.min(130, c.v + 42);
    c.w += lado * 0.55;
    if (lado === c.lado) c.bal += remo_tambaleo(); else c.bal = Math.max(0, c.bal - 0.05);
    c.lado = lado; c.remo_t = 0;
    if (c.bal >= 1) { canoa_voltear(); return; }
  }
  c.bal = Math.max(0, c.bal - 0.22 * dt);
  c.v *= Math.exp(-0.7 * dt); c.w *= Math.exp(-3 * dt);
  c.ang += c.w * dt;
  const f = rio_corriente(c.x, c.y), C = remo_corriente();
  const nx = c.x + (Math.cos(c.ang) * c.v + f[0] * C) * dt, ny = c.y + (Math.sin(c.ang) * c.v + f[1] * C) * dt;
  if (agua_en(nx, ny, 22)) { c.x = nx; c.y = ny; }          // la orilla no deja pasar
  else if (agua_en(nx, c.y, 22)) { c.x = nx; c.v *= 0.5; }
  else if (agua_en(c.x, ny, 22)) { c.y = ny; c.v *= 0.5; }
  else c.v *= 0.3;
  player.x = c.x; player.y = c.y; player.ang = c.ang; player.moving = false;
  // llegar al muelle de enfrente (o regresar al mismo)
  for (const m of muelles) {
    if (m === c.desde && c.t < 3) continue;
    if (dist(c, m.agua) < 60) { canoa_bajar(m); return; }
  }
}
function rescate_actualizar(dt) {
  const r = rescate, b = settings.binds;
  r.t += dt;
  // la corriente te lleva despacio; puedes nadar despacio hacia donde miras
  player.ang += clamp((kd(b.derecha) ? 1 : 0) - (kd(b.izquierda) ? 1 : 0) + tactil_giro, -1, 1) * 1.6 * dt;
  const f = rio_corriente(player.x, player.y), C = remo_corriente() * 0.5, nado = (kd(b.adelante) || tactil_avance > 0.3) ? 35 : 0;
  const nx = player.x + (Math.cos(player.ang) * nado + f[0] * C) * dt, ny = player.y + (Math.sin(player.ang) * nado + f[1] * C) * dt;
  if (agua_en(nx, ny, 10)) { player.x = nx; player.y = ny; }
  player.moving = false;
  // agitarse (clics, correr, apretar teclas de golpe) cansa
  if ((!tactil && (raton.pulsado[0] || raton.pulsado[2])) || tactil_agita || kp(b.correr) || kp(b.usar) || kp(' ')) r.agit += 0.35;
  r.agit = Math.max(0, r.agit - 0.5 * dt);
  if (r.agit >= 1) { r.agit = 0; energy = Math.max(0, energy - 4); toast('¡Calma! Si te agitas te cansas. Flota y espera.', 4); }
  energy -= dt * 0.8; // el agua está fría
  // la canoa de seguridad va por ti siguiendo el cauce del río, punto por punto (así nunca pasa por tierra);
  // solo cuando ya está cerca va derecho hacia ti. r.bi = último punto del río al que llegó.
  if (pdist(r.bx, r.by, player.x, player.y) < 55) { rescatado(); return; }
  const lin = rios[r.desde.rio].linea, ti = rio_mas_cercano(lin, player.x, player.y);
  let paso = 75 * dt;
  for (let it = 0; it < 6 && paso > 0.001; it++) {
    let gx, gy, sig = -1;
    if (Math.abs(r.bi - ti) <= 1) { gx = player.x; gy = player.y; }
    else { sig = r.bi + Math.sign(ti - r.bi); gx = lin[sig][0]; gy = lin[sig][1]; }
    const d = pdist(r.bx, r.by, gx, gy);
    if (d < 0.001) { if (sig >= 0) r.bi = sig; else break; continue; }
    r.ax = (gx - r.bx) / d; r.ay = (gy - r.by) / d;
    if (d <= paso) { r.bx = gx; r.by = gy; paso -= d; if (sig >= 0) r.bi = sig; else break; }
    else { r.bx += r.ax * paso; r.by += r.ay * paso; paso = 0; }
  }
}

// ---------- Dibujo: lo que se ve en la canoa o en el agua ----------
function chaleco_dibujar() {
  poligono([0, H, W * 0.13, H, W * 0.07, H * 0.8, 0, H * 0.83], '#f07a1a');
  poligono([W, H, W * 0.87, H, W * 0.93, H * 0.8, W, H * 0.83], '#f07a1a');
  linea_redonda(W * 0.012, H * 0.92, W * 0.1, H * 0.9, Math.max(3, H * 0.012), '#e8e8e8');
  linea_redonda(W * 0.988, H * 0.92, W * 0.9, H * 0.9, Math.max(3, H * 0.012), '#e8e8e8');
}
function rio_vista_dibujar() {
  if (canoa) {
    const c = canoa, cx = W / 2;
    // proa de la canoa
    poligono([cx, H * 0.76, cx + W * 0.17, H, cx - W * 0.17, H], '#b5462e');
    poligono([cx, H * 0.82, cx + W * 0.115, H, cx - W * 0.115, H], '#6b2a1a');
    // el remo se ve del lado donde remaste
    const k = clamp(c.remo_t / 0.45, 0, 1);
    if (c.lado !== 0 && k < 1) {
      const s = -c.lado, x0 = cx + s * W * 0.2, y0 = H * 0.99;
      const bx = cx + s * W * (0.33 - 0.06 * k), by = H * (0.72 + 0.2 * k);
      linea_redonda(x0, y0, bx, by, Math.max(4, W * 0.008), '#c9a36b');
      blob(bx, by, W * 0.024, '#a8804a');
    }
    chaleco_dibujar();
    // equilibrio y ayuda
    const bw = 260, bx0 = W / 2 - bw / 2;
    barra(bx0, 150, bw, 'Equilibrio', (1 - c.bal) * 100, c.bal > 0.6 ? '#d9432f' : '#3fae4a');
    pastilla(W / 2, 112, 'Rema hasta el ' + c.desde.otro.name, 17, 1);
    if (!tactil) texto(W / 2, 196, 'Clic izquierdo: remo derecho (giras a la izquierda) · Clic derecho: remo izquierdo (giras a la derecha)', 14, true, 'center', '#fff', 0.95);
    texto(W / 2, tactil ? 196 : 216, 'Alterna para ir derecho. Muchas veces del mismo lado = la canoa se tambalea.', 13, false, 'center', '#fff', 0.85);
  } else if (rescate) {
    rect(0, H * 0.72, W, H * 0.28, '#2f6e98', 0.65);
    ctx.strokeStyle = 'rgba(156,203,232,0.7)'; ctx.lineWidth = 3; ctx.lineCap = 'butt'; ctx.beginPath();
    for (let x = 0; x < W; x += 40) {
      ctx.moveTo(x, H * 0.72 + Math.sin(ahora() / 300 + x * 0.05) * 6);
      ctx.lineTo(x + 30, H * 0.72 + Math.sin(ahora() / 300 + (x + 30) * 0.05) * 6);
    }
    ctx.stroke();
    chaleco_dibujar();
    rect_redondo(W / 2 - Math.min(300, W / 2 - 6), 100, Math.min(600, W - 12), 130, 14, '#000', 0.55);
    texto(W / 2, 140, '¡Mantén la calma!', 28, true, 'center', '#ffe9b0');
    texto(W / 2, 170, 'Flota con el chaleco y espera a la canoa de seguridad. No te agites: te cansa.', 15, false, 'center', '#fff');
    const pasos = Math.round(pdist(rescate.bx, rescate.by, player.x, player.y) / STEP), b = settings.binds;
    texto(W / 2, 198, 'La canoa de seguridad está a ' + pasos + ' pasos · ' + (tactil ? 'palanca: nadar despacio y girar'
      : nombre_tecla(b.adelante) + ': nadar despacio · ' + nombre_tecla(b.izquierda) + '/' + nombre_tecla(b.derecha) + ': girar'), 14, false, 'center', '#fff', 0.9);
  } else if (chaleco) chaleco_dibujar();
}
// Manual de la canoa: sale antes de remar por primera vez en cada partida
function canoa_manual_dibujar() {
  const VW = 600, VH = 380;
  reto_s = Math.min(1.1, (W - 16) / VW, (H - 16) / VH); reto_ox = (W - VW * reto_s) / 2; reto_oy = (H - VH * reto_s) / 2;
  rect(0, 0, W, H, '#000', 0.5);
  panel_borde(rx(0), ry(0), VW * reto_s, VH * reto_s, 14 * reto_s, '#f4ecd2', '#8e7a4a', 3 * reto_s);
  const cafe = '#3a2a14', rojo = '#c0392b';
  rtexto(VW / 2, 40, 'Cómo remar en la canoa', 24, true, 'center', cafe);
  rtexto(VW / 2, 66, 'Meta: llegar al ' + canoa.desde.otro.name, 15, true, 'center', '#2a4a8a');
  const l = tactil
    ? ['Toca la mitad izquierda de la pantalla: giras a la izquierda.', 'Toca la mitad derecha: giras a la derecha.', 'Cada toque es una remada.']
    : ['Clic izquierdo: remas del lado derecho y giras a la izquierda.', 'Clic derecho: remas del lado izquierdo y giras a la derecha.', 'Cada clic es una remada.'];
  l.push('Alterna los dos lados para ir derecho.', 'La corriente del río te empuja: apunta un poco contra ella.');
  l.forEach((s, i) => rtexto(36, 108 + i * 30, '- ' + s, 15, false, 'left', cafe));
  rtexto(36, 268, 'Si remas muchas veces del mismo lado la canoa se tambalea', 15, true, 'left', rojo);
  rtexto(36, 290, 'y se puede voltear. Fíjate en la barra de Equilibrio.', 15, true, 'left', rojo);
  rect_redondo(rx(VW / 2 - 100), ry(VH - 70), 200 * reto_s, 38 * reto_s, 9 * reto_s, '#3fae4a', 1);
  rtexto(VW / 2, VH - 45, '¡A remar!', 18, true, 'center', '#fff');
  rtexto(VW / 2, VH - 12, tactil ? 'Toca en cualquier lugar para empezar' : 'Clic, Enter o Espacio para empezar', 13, false, 'center', '#6b5a3a');
}

// ---------- Cerro del Coyote: subir por el sendero, cuerda en los pasos angostos y rapel ----------
// monte_modo: '' = en el suelo, 'repisa' = en el sendero, 'cima' = arriba, 'rapel' = bajando. player.alt = altura.
// cuerda = paso angosto al que estás enganchado (-1 = a ninguno).
function monte_poner(x, y, alt) { player.x = x; player.y = y; player.alt = alt; }

// Cada cuadro después de moverte. ox, oy = dónde estabas antes de moverte.
function monte_mover(ox, oy) {
  if (!montana) return;
  const m = montana, d = pdist(player.x, player.y, m.x, m.y);
  if (monte_modo === 'repisa') {
    const p = monte_proyectar(player.x, player.y);
    // bajar del sendero por donde empieza
    if (p.antes) { monte_salir(); return; }
    // al final se llega a la cima
    if (p.s >= m.largo - 30 && d < m.rc - 4) { monte_modo = 'cima'; player.alt = m.H; toast('¡Llegaste a la cima del ' + m.name + '!', 4); return; }
    // paso angosto: sin cuerda no se pasa
    const k = monte_angosto_en(p.s);
    if (k >= 0 && cuerda !== k) {
      player.x = ox; player.y = oy;
      if (ahora() - monte_aviso_t > 2500) { monte_aviso_t = ahora(); toast('¡Engánchate a la cuerda antes de pasar! Usa el poste con ' + tecla_entre_corchetes('usar') + '.', 4); }
      return;
    }
    // al salir del paso angosto te desenganchas
    if (cuerda >= 0 && (p.s < m.angostos[cuerda][0] - 70 || p.s > m.angostos[cuerda][1] + 70)) { cuerda = -1; toast('Te desenganchaste de la cuerda.', 3); }
    // quedarse en el sendero (no te sales a la ladera)
    const w = monte_ancho_en(p.s) / 2 - 8, e = Math.min(p.e, w);
    monte_poner(p.x + p.nx * e, p.y + p.ny * e, monte_altura(p.x, p.y));
  } else if (monte_modo === 'cima') {
    if (d > m.rc - 6) {
      // bajar por el sendero
      const p = monte_proyectar(player.x, player.y);
      if (p.e < m.ancho / 2 && p.s < m.largo - 2) { monte_modo = 'repisa'; player.alt = monte_altura(p.x, p.y); return; }
      // en la orilla no te caes
      const ang = Math.atan2(player.y - m.y, player.x - m.x);
      monte_poner(m.x + Math.cos(ang) * (m.rc - 6), m.y + Math.sin(ang) * (m.rc - 6), m.H);
    }
  } else {
    // en el suelo: subirse al sendero por donde empieza (si caminas hacia él)
    if (d < m.Rb + 40) {
      const p = monte_proyectar(player.x, player.y);
      const acercando = pdist(ox, oy, m.x, m.y) > d + 0.01;
      if (!p.antes && p.s < 60 && p.e < m.ancho / 2 && acercando) {
        monte_modo = 'repisa'; player.alt = monte_altura(p.x, p.y);
        toast('Sendero a la cima del ' + m.name + '. En los pasos angostos engánchate a la cuerda.', 5);
        return;
      }
    }
    // las laderas son muy empinadas: no se puede subir por fuera del sendero
    const R = monte_R(Math.atan2(player.y - m.y, player.x - m.x));
    if (d < R + 16 && d > 0.001) monte_poner(m.x + (player.x - m.x) / d * (R + 16), m.y + (player.y - m.y) / d * (R + 16), 0);
  }
}
function monte_salir() { monte_modo = ''; player.alt = 0; cuerda = -1; }

// Poste de cuerda o punto de rapel cerca (para el aviso de [E])
function monte_cerca() {
  if (!montana) return null;
  const u = tecla_entre_corchetes('usar') + ' ';
  if (monte_modo === 'repisa') {
    // el paso angosto más cercano (si estás a menos de 60 de él): con E te enganchas a su cuerda
    const s = monte_proyectar(player.x, player.y).s;
    let bk = -1, bd = 60;
    montana.angostos.forEach((a, k) => { const dd = s < a[0] ? a[0] - s : s > a[1] ? s - a[1] : 0; if (dd < bd) { bd = dd; bk = k; } });
    if (bk >= 0) return { kind: 'cuerda', obj: { k: bk }, label: cuerda === bk ? 'Estás enganchado a la cuerda' : u + 'Engancharte a la cuerda' };
  } else if (monte_modo === 'cima') {
    if (dist(player, montana.rapel) < 45) return { kind: 'rapel', obj: montana.rapel, label: u + 'Bajar en rapel' };
  }
  return null;
}
// Rapel: bajas por la cara norte; la distancia a la pared depende de la altura
function rapel_pos(alt) {
  const m = montana, a = m.rapel.ang, R = monte_R(a);
  const d = m.rc + (R - m.rc) * (1 - Math.pow(clamp(alt / m.H, 0, 1), 1 / 1.15)) + 14;
  return [m.x + Math.cos(a) * d, m.y + Math.sin(a) * d];
}
function rapel_empezar() {
  const m = montana, p = rapel_pos(m.H);
  monte_modo = 'rapel'; cuerda = -1;
  rapel = { v: 0, ras: 0, golpe: 0, aviso_t: 0, listo: false }; // listo: ya soltaste todo (para que no baje solo al empezar)
  monte_poner(p[0], p[1], m.H);
  player.ang = m.rapel.ang + PI; player.pitch = -0.25; player.moving = false; // mirando la roca
  soltar_raton();
  toast(tactil ? 'Mantén el dedo en la pantalla para soltar cuerda y bajar. Levántalo para frenar.' : 'Mantén el clic izquierdo para soltar cuerda y bajar. Suéltalo para frenar.', 6);
}
// Cada cuadro bajando en rapel
function rapel_actualizar(dt) {
  const r = rapel, seguro = cat.rapel_seguro * (rain ? 0.8 : 1);
  let suelta = (tactil ? tactil_cuerda : raton.abajo[0]) || kd(' ');
  if (!r.listo) { if (!suelta) r.listo = true; suelta = false; } // no baja hasta que sueltes y vuelvas a apretar
  if (suelta) r.v = Math.min(170, r.v + 50 * dt); // poco a poco: suelta cuerda despacio
  else r.v = Math.max(0, r.v - (rain ? 220 : 400) * dt); // al soltar frenas (con lluvia la cuerda resbala y frena menos)
  const alt = Math.max(0, player.alt - r.v * dt), p = rapel_pos(alt);
  monte_poner(p[0], p[1], alt);
  r.golpe = Math.max(0, r.golpe - dt);
  if (r.v > seguro) {
    r.ras += dt;
    if (r.ras >= 0.6) {
      r.ras = 0; r.golpe = 0.35; energy = Math.max(0, energy - 4);
      if (ahora() - r.aviso_t > 2500) { r.aviso_t = ahora(); toast('¡Te raspaste contra la roca! Frena ' + (tactil ? 'levantando el dedo.' : 'soltando el clic.'), 3); }
    }
  } else r.ras = 0;
  if (alt <= 0) {
    if (r.v > seguro * 1.2) { energy = Math.max(0, energy - 8); toast('¡Aterrizaste muy fuerte! Baja más despacio.', 4); }
    else toast('¡Bajaste en rapel!', 3);
    rapel = null; monte_salir(); player.pitch = 0;
    const a = montana.rapel.ang, R = monte_R(a) + 24; // un pasito lejos de la roca
    player.x = montana.x + Math.cos(a) * R; player.y = montana.y + Math.sin(a) * R;
  }
}
// Lo que se ve bajando en rapel: la cuerda, velocidad y ayuda
function monte_vista_dibujar() {
  if (!rapel) return;
  const seguro = cat.rapel_seguro * (rain ? 0.8 : 1);
  linea_redonda(W * 0.56, -10, W * 0.53, H + 10, Math.max(4, W * 0.006), '#d9c27a');
  if (rapel.golpe > 0) rect(0, 0, W, H, '#f00', rapel.golpe * 0.6);
  const bw = 260, bx = W / 2 - bw / 2;
  barra(bx, 150, bw, 'Velocidad', rapel.v / 170 * 100, rapel.v > seguro ? '#d9432f' : '#3fae4a');
  const mx = bx + 2 + (bw - 4) * seguro / 170; // hasta dónde es seguro
  linea_redonda(mx, 146, mx, 174, 2, '#fff');
  pastilla(W / 2, 112, 'Rapel · faltan ' + Math.ceil(player.alt / STEP) + ' pasos hasta el suelo', 17, 1);
  texto(W / 2, 196, tactil ? 'Mantén el dedo en la pantalla para bajar · levántalo para frenar' : 'Mantén clic izquierdo (o Espacio) para soltar cuerda · suéltalo para frenar', 14, true, 'center', '#fff', 0.95);
  texto(W / 2, 216, 'Si pasas la raya blanca vas muy rápido y te raspas con la roca.', 13, false, 'center', '#fff', 0.85);
}
