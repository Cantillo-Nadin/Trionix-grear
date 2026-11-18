import { Router } from "express";
import Joi from "joi";
import Equipo from "../models/Equipo.js";
import Usuario from "../models/Usuario.js";
import Prestamo from "../models/Prestamo.js";
import { ah, HttpError, validar, validarIdParam } from "../middlewares/errorHandler.js";
import { poblar, formatear } from "../utils.js";

const router = Router();
router.param("id", validarIdParam);

const TOPES = { estudiante: 2, docente: 4, administrativo: 3 }; // R3
const DIAS_MAX = { estudiante: 7, docente: 15, administrativo: 7 }; // R4
const DIA_MS = 24 * 60 * 60 * 1000;

const crearSchema = Joi.object({
  equipoId: Joi.string().hex().length(24).required(),
  usuarioId: Joi.string().hex().length(24).required(),
  fechaLimite: Joi.date().iso().required(),
  observaciones: Joi.string().trim().max(300).allow(""),
});

router.get("/", ah(async (req, res) => {
  const { estado, vencidos, page, limit } = req.query;
  const filtro = {};
  if (estado === "activo" || estado === "devuelto") filtro.estado = estado;
  if (vencidos === "true") {
    filtro.estado = "activo";
    filtro.fechaLimite = { $lt: new Date() }; // R6
  }
  const consulta = poblar(Prestamo.find(filtro).sort({ createdAt: -1 }));

  // Bonus: paginación
  if (page || limit) {
    const p = Math.max(1, parseInt(page) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit) || 10));
    const [docs, total] = await Promise.all([
      consulta.skip((p - 1) * l).limit(l),
      Prestamo.countDocuments(filtro),
    ]);
    return res.json({ data: docs.map(formatear), page: p, limit: l, total });
  }
  const docs = await consulta;
  res.json(docs.map(formatear));
}));

router.post("/", ah(async (req, res) => {
  const { equipoId, usuarioId, fechaLimite, observaciones } = validar(crearSchema, req.body);

  const usuario = await Usuario.findById(usuarioId);
  if (!usuario) throw new HttpError(404, "Usuario no encontrado");
  if (!usuario.activo) throw new HttpError(400, "El usuario está inactivo y no puede recibir préstamos");

  const equipo = await Equipo.findById(equipoId);
  if (!equipo) throw new HttpError(404, "Equipo no encontrado");
  if (equipo.estado !== "disponible") { // R1
    throw new HttpError(409, `El equipo no está disponible (estado actual: ${equipo.estado})`);
  }

  const tope = TOPES[usuario.tipo]; // R3
  const activos = await Prestamo.countDocuments({ usuarioId, estado: "activo" });
  if (activos >= tope) {
    throw new HttpError(409, `El usuario alcanzó su tope de ${tope} préstamos activos (${usuario.tipo})`);
  }

  const ahora = Date.now(); // R4
  const diasMax = DIAS_MAX[usuario.tipo];
  const limite = new Date(fechaLimite).getTime();
  if (limite <= ahora) throw new HttpError(400, "La fecha límite debe estar en el futuro");
  if (limite > ahora + diasMax * DIA_MS) {
    throw new HttpError(400, `La fecha límite no puede superar ${diasMax} días para un ${usuario.tipo}`);
  }

  // R8: cambio de estado ATÓMICO (una sola operación condicional)
  const reservado = await Equipo.findOneAndUpdate(
    { _id: equipoId, estado: "disponible" },
    { estado: "prestado" },
    { new: true }
  );
  if (!reservado) throw new HttpError(409, "El equipo acaba de ser prestado a otro usuario");

  let prestamo;
  try {
    prestamo = await Prestamo.create({ equipoId, usuarioId, fechaLimite, observaciones });
  } catch (err) {
    // Compensación: si falla la escritura, el equipo vuelve a disponible
    await Equipo.findByIdAndUpdate(equipoId, { estado: "disponible" });
    throw err;
  }

  const completo = await poblar(Prestamo.findById(prestamo._id), true);
  res.status(201).json(formatear(completo));
}));

router.get("/:id", ah(async (req, res) => {
  const prestamo = await poblar(Prestamo.findById(req.params.id));
  if (!prestamo) throw new HttpError(404, "Préstamo no encontrado");
  res.json(formatear(prestamo));
}));

router.patch("/:id/devolver", ah(async (req, res) => {
  const existente = await Prestamo.findById(req.params.id);
  if (!existente) throw new HttpError(404, "Préstamo no encontrado");
  if (existente.estado === "devuelto") throw new HttpError(409, "El préstamo ya fue devuelto");

  // Condicional para que dos devoluciones simultáneas no se pisen
  const prestamo = await Prestamo.findOneAndUpdate(
    { _id: req.params.id, estado: "activo" },
    { estado: "devuelto", fechaDevolucion: new Date() },
    { new: true }
  );
  if (!prestamo) throw new HttpError(409, "El préstamo ya fue devuelto");

  await Equipo.findByIdAndUpdate(prestamo.equipoId, { estado: "disponible" });
  const completo = await poblar(Prestamo.findById(prestamo._id), true);
  res.json(formatear(completo));
}));

export default router;