import { Router } from "express";
import Equipo from "../models/Equipo.js";
import Usuario from "../models/Usuario.js";
import Prestamo from "../models/Prestamo.js";
import { ah } from "../middlewares/errorHandler.js";

const router = Router();

router.get("/top-equipos", ah(async (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 5));
  const top = await Prestamo.aggregate([
    { $group: { _id: "$equipoId", totalPrestamos: { $sum: 1 } } },
    { $sort: { totalPrestamos: -1 } },
    { $limit: limit },
    { $lookup: { from: Equipo.collection.name, localField: "_id", foreignField: "_id", as: "equipo" } },
    { $unwind: "$equipo" },
    { $project: { _id: 0, codigo: "$equipo.codigo", nombre: "$equipo.nombre", totalPrestamos: 1 } },
  ]);
  res.json(top);
}));

router.get("/resumen", ah(async (req, res) => {
  const [porEstado, prestamosActivos, prestamosVencidos, porTipo] = await Promise.all([
    Equipo.aggregate([{ $group: { _id: "$estado", total: { $sum: 1 } } }]),
    Prestamo.countDocuments({ estado: "activo" }),
    Prestamo.countDocuments({ estado: "activo", fechaLimite: { $lt: new Date() } }),
    Prestamo.aggregate([
      { $match: { estado: "activo" } },
      { $lookup: { from: Usuario.collection.name, localField: "usuarioId", foreignField: "_id", as: "u" } },
      { $unwind: "$u" },
      { $group: { _id: "$u.tipo", total: { $sum: 1 } } },
    ]),
  ]);

  const equiposPorEstado = { disponible: 0, prestado: 0, mantenimiento: 0 };
  porEstado.forEach((e) => (equiposPorEstado[e._id] = e.total));
  const activosPorTipoUsuario = { estudiante: 0, docente: 0, administrativo: 0 };
  porTipo.forEach((t) => (activosPorTipoUsuario[t._id] = t.total));

  res.json({ equiposPorEstado, prestamosActivos, prestamosVencidos, activosPorTipoUsuario });
}));

export default router;