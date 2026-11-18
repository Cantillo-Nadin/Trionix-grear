import { Router } from "express";
import Joi from "joi";
import Equipo from "../models/Equipo.js";
import Prestamo from "../models/Prestamo.js";
import { ah, HttpError, validar, validarIdParam } from "../middlewares/errorHandler.js";
import { poblar, formatear } from "../utils.js";

const router = Router();
router.param("id", validarIdParam);

const CATEGORIAS = ["portatil", "proyector", "camara", "audio", "redes"];

const crearSchema = Joi.object({
  codigo: Joi.string().trim().uppercase().pattern(/^EQ-\d{4}$/).required()
    .messages({ "string.pattern.base": "El código debe tener el formato EQ-0000" }),
  nombre: Joi.string().trim().min(3).max(100).required(),
  categoria: Joi.string().valid(...CATEGORIAS).required(),
  // Solo disponible/mantenimiento: "prestado" lo gestiona el flujo de préstamo
  estado: Joi.string().valid("disponible", "mantenimiento"),
  ubicacion: Joi.string().trim().allow(""),
});

const actualizarSchema = Joi.object({
  codigo: Joi.string().trim().uppercase().pattern(/^EQ-\d{4}$/),
  nombre: Joi.string().trim().min(3).max(100),
  categoria: Joi.string().valid(...CATEGORIAS),
  estado: Joi.string().valid("disponible", "mantenimiento"),
  ubicacion: Joi.string().trim().allow(""),
}).min(1);

router.get("/", ah(async (req, res) => {
  const filtro = {};
  if (req.query.categoria) filtro.categoria = String(req.query.categoria);
  if (req.query.estado) filtro.estado = String(req.query.estado);
  res.json(await Equipo.find(filtro).sort({ codigo: 1 }));
}));

router.post("/", ah(async (req, res) => {
  const datos = validar(crearSchema, req.body);
  const equipo = await Equipo.create(datos);
  res.status(201).json(equipo);
}));

router.get("/:id", ah(async (req, res) => {
  const equipo = await Equipo.findById(req.params.id);
  if (!equipo) throw new HttpError(404, "Equipo no encontrado");
  res.json(equipo);
}));

router.put("/:id", ah(async (req, res) => {
  const datos = validar(actualizarSchema, req.body);
  const actual = await Equipo.findById(req.params.id);
  if (!actual) throw new HttpError(404, "Equipo no encontrado");
  if (datos.estado && actual.estado === "prestado") {
    throw new HttpError(409, "No se puede cambiar el estado de un equipo prestado; use la devolución");
  }
  const equipo = await Equipo.findByIdAndUpdate(req.params.id, datos, {
    new: true,
    runValidators: true,
  });
  res.json(equipo);
}));

router.delete("/:id", ah(async (req, res) => {
  const equipo = await Equipo.findById(req.params.id);
  if (!equipo) throw new HttpError(404, "Equipo no encontrado");
  if (equipo.estado === "prestado") {
    throw new HttpError(409, "No se puede eliminar un equipo que está prestado");
  }
  await equipo.deleteOne();
  res.json({ message: "Equipo eliminado" });
}));

router.get("/:id/prestamos", ah(async (req, res) => {
  const equipo = await Equipo.findById(req.params.id);
  if (!equipo) throw new HttpError(404, "Equipo no encontrado");
  const prestamos = await poblar(
    Prestamo.find({ equipoId: req.params.id }).sort({ createdAt: -1 })
  );
  res.json(prestamos.map(formatear));
}));

export default router;