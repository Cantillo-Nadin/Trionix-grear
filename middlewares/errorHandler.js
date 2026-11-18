import mongoose from "mongoose";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Express 4 no captura promesas rechazadas: este wrapper las manda al errorHandler
export const ah = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const OID = /^[0-9a-fA-F]{24}$/;

// Se usa con router.param("id", validarIdParam)
export function validarIdParam(req, res, next, id) {
  if (!OID.test(id)) return next(new HttpError(400, "El id no es un ObjectId válido"));
  next();
}

export function validar(schema, data) {
  const { value, error } = schema.validate(data, { abortEarly: false, stripUnknown: true });
  if (error) throw error; // error.isJoi === true
  return value;
}

export function errorHandler(err, req, res, next) {
  if (err.isJoi) {
    return res.status(400).json({
      status: 400,
      message: err.details.map((d) => d.message).join("; "),
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ status: err.status, message: err.message });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ status: 400, message: "El JSON enviado no es válido" });
  }
  if (err.code === 11000) {
    const campo = Object.keys(err.keyValue || {})[0] || "campo";
    const entidad = req.baseUrl.includes("usuarios") ? "usuario" : "equipo";
    return res.status(409).json({ status: 409, message: `Ya existe un ${entidad} con ese ${campo}` });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      status: 400,
      message: Object.values(err.errors).map((e) => e.message).join("; "),
    });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ status: 400, message: `Valor inválido para ${err.path}` });
  }
  console.error(err);
  res.status(500).json({ status: 500, message: "Error interno del servidor" });
}