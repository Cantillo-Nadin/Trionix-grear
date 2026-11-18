import { Router } from "express";
import Joi from "joi";
import Usuario from "../models/Usuario.js";
import Prestamo from "../models/Prestamo.js";
import { ah, HttpError, validar, validarIdParam } from "../middlewares/errorHandler.js";
import { poblar, formatear } from "../utils.js";

const router = Router();
router.param("id", validarIdParam);

const TIPOS = ["estudiante", "docente", "administrativo"];

const crearSchema = Joi.object({
  nombre: Joi.string().trim().min(3).max(100).required(),
  documento: Joi.string().trim().pattern(/^\d{6,12}$/).required()
    .messages({ "string.pattern.base": "El documento debe tener entre 6 y 12 dígitos" }),
  email: Joi.string().trim().lowercase().email().required(),
  tipo: Joi.string().valid(...TIPOS).required(),
  activo: Joi.boolean(),
});

const actualizarSchema = Joi.object({
  nombre: Joi.string().trim().min(3).max(100),
  documento: Joi.string().trim().pattern(/^\d{6,12}$/),
  email: Joi.string().trim().lowercase().email(),
  tipo: Joi.string().valid(...TIPOS),
  activo: Joi.boolean(),
}).min(1);

router.get("/", ah(async (req, res) => {
  const filtro = {};
  if (req.query.tipo) filtro.tipo = String(req.query.tipo);
  if (req.query.activo !== undefined) filtro.activo = req.query.activo === "true";
  res.json(await Usuario.find(filtro).sort({ nombre: 1 }));
}));

router.post("/", ah(async (req, res) => {
  const usuario = await Usuario.create(validar(crearSchema, req.body));
  res.status(201).json(usuario);
}));

router.get("/:id", ah(async (req, res) => {
  const usuario = await Usuario.findById(req.params.id);
  if (!usuario) throw new HttpError(404, "Usuario no encontrado");
  res.json(usuario);
}));

router.put("/:id", ah(async (req, res) => {
  const datos = validar(actualizarSchema, req.body);
  const usuario = await Usuario.findByIdAndUpdate(req.params.id, datos, {
    new: true,
    runValidators: true,
  });
  if (!usuario) throw new HttpError(404, "Usuario no encontrado");
  res.json(usuario);
}));

router.delete("/:id", ah(async (req, res) => {
  const usuario = await Usuario.findById(req.params.id);
  if (!usuario) throw new HttpError(404, "Usuario no encontrado");
  if (await Prestamo.exists({ usuarioId: usuario._id, estado: "activo" })) {
    throw new HttpError(409, "No se puede eliminar un usuario con préstamos activos");
  }
  await usuario.deleteOne();
  res.json({ message: "Usuario eliminado" });
}));

router.get("/:id/prestamos", ah(async (req, res) => {
  const usuario = await Usuario.findById(req.params.id);
  if (!usuario) throw new HttpError(404, "Usuario no encontrado");
  const prestamos = await poblar(
    Prestamo.find({ usuarioId: req.params.id }).sort({ createdAt: -1 })
  );
  res.json(prestamos.map(formatear));
}));

export default router;