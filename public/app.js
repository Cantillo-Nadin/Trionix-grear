const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fecha = (d) => new Date(d).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });

let timer;
function mostrar(texto, tipo = "error") {
  const m = $("#mensaje");
  m.textContent = texto;
  m.className = tipo;
  m.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => (m.hidden = true), 4500);
}

async function api(url, { method = "GET", body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
  return data;
}

const badge = (e) => `<span class="estado ${esc(e)}">${esc(e)}</span>`;

async function cargarEquipos() {
  const equipos = await api("/api/equipos");
  $("#tabla-equipos").innerHTML = equipos.map((e) => `
    <tr><td>${esc(e.codigo)}</td><td>${esc(e.nombre)}</td><td>${esc(e.categoria)}</td>
    <td>${badge(e.estado)}</td><td>${esc(e.ubicacion)}</td></tr>`).join("");
}

async function cargarUsuarios() {
  const usuarios = await api("/api/usuarios");
  $("#tabla-usuarios").innerHTML = usuarios.map((u) => `
    <tr><td>${esc(u.nombre)}</td><td>${esc(u.documento)}</td><td>${esc(u.email)}</td>
    <td>${esc(u.tipo)}</td><td>${u.activo ? "Sí" : "No"}</td></tr>`).join("");
}

async function cargarPrestamos() {
  const [equipos, usuarios, prestamos] = await Promise.all([
    api("/api/equipos?estado=disponible"),
    api("/api/usuarios?activo=true"),
    api("/api/prestamos?estado=activo"),
  ]);
  $("#sel-equipos").innerHTML = '<option value="">Equipo disponible</option>' +
    equipos.map((e) => `<option value="${e._id}">${esc(e.codigo)} - ${esc(e.nombre)}</option>`).join("");
  $("#sel-usuarios").innerHTML = '<option value="">Usuario activo</option>' +
    usuarios.map((u) => `<option value="${u._id}">${esc(u.nombre)} (${esc(u.tipo)})</option>`).join("");
  $("#tabla-prestamos").innerHTML = prestamos.map((p) => `
    <tr class="${p.vencido ? "vencido" : ""}">
      <td>${esc(p.equipo?.codigo)} - ${esc(p.equipo?.nombre)}</td>
      <td>${esc(p.usuario?.nombre)} (${esc(p.usuario?.tipo)})</td>
      <td>${fecha(p.fechaLimite)}</td>
      <td>${p.vencido ? "Vencido" : "Al día"}</td>
      <td><button class="btn-dev" data-id="${p._id}">Devolver</button></td>
    </tr>`).join("") || '<tr><td colspan="5">No hay préstamos activos</td></tr>';
}

async function cargarResumen() {
  const [r, top] = await Promise.all([api("/api/reportes/resumen"), api("/api/reportes/top-equipos?limit=5")]);
  const t = (n, label) => `<div class="tarjeta"><b>${n}</b><span>${label}</span></div>`;
  $("#tarjetas").innerHTML =
    t(r.equiposPorEstado.disponible, "Equipos disponibles") +
    t(r.equiposPorEstado.prestado, "Equipos prestados") +
    t(r.equiposPorEstado.mantenimiento, "En mantenimiento") +
    t(r.prestamosActivos, "Préstamos activos") +
    t(r.prestamosVencidos, "Préstamos vencidos") +
    t(r.activosPorTipoUsuario.estudiante, "Activos de estudiantes") +
    t(r.activosPorTipoUsuario.docente, "Activos de docentes") +
    t(r.activosPorTipoUsuario.administrativo, "Activos de administrativos");
  $("#tabla-top").innerHTML = top.map((e) => `
    <tr><td>${esc(e.codigo)}</td><td>${esc(e.nombre)}</td><td>${e.totalPrestamos}</td></tr>`).join("");
}

const cargadores = { inventario: cargarEquipos, usuarios: cargarUsuarios, prestamos: cargarPrestamos, resumen: cargarResumen };

async function irA(vista) {
  document.querySelectorAll(".vista").forEach((s) => (s.hidden = s.id !== vista));
  document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("activo", b.dataset.vista === vista));
  try { await cargadores[vista](); } catch (e) { mostrar(e.message); }
}

document.querySelectorAll("nav button").forEach((b) => b.addEventListener("click", () => irA(b.dataset.vista)));

function enviar(formId, url, vista, textoOk, transformar = (d) => d) {
  $(formId).addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const datos = Object.fromEntries(new FormData(ev.target));
    Object.keys(datos).forEach((k) => datos[k] === "" && delete datos[k]);
    try {
      await api(url, { method: "POST", body: transformar(datos) });
      ev.target.reset();
      mostrar(textoOk, "exito");
      await cargadores[vista]();
    } catch (e) { mostrar(e.message); }
  });
}

enviar("#form-equipo", "/api/equipos", "inventario", "Equipo creado");
enviar("#form-usuario", "/api/usuarios", "usuarios", "Usuario creado");
enviar("#form-prestamo", "/api/prestamos", "prestamos", "Préstamo registrado", (d) => ({
  ...d, fechaLimite: new Date(d.fechaLimite).toISOString(),
}));

$("#tabla-prestamos").addEventListener("click", async (ev) => {
  const btn = ev.target.closest(".btn-dev");
  if (!btn) return;
  try {
    await api(`/api/prestamos/${btn.dataset.id}/devolver`, { method: "PATCH" });
    mostrar("Equipo devuelto", "exito");
    await cargarPrestamos();
  } catch (e) { mostrar(e.message); }
});

irA("inventario");