// Resuelve equipo y usuario con populate
export function poblar(query, completo = false) {
  return query
    .populate("equipoId", completo ? "codigo nombre categoria estado" : "codigo nombre categoria")
    .populate("usuarioId", completo ? "nombre tipo email" : "nombre tipo");
}

// Renombra equipoId/usuarioId -> equipo/usuario y calcula "vencido" (R6)
export function formatear(p) {
  const o = p.toObject ? p.toObject() : p;
  const { equipoId, usuarioId, ...resto } = o;
  return {
    ...resto,
    equipo: equipoId,
    usuario: usuarioId,
    vencido: o.estado === "activo" && new Date(o.fechaLimite) < new Date(),
  };
}