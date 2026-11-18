import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema.Types;

const prestamoSchema = new mongoose.Schema({
  equipoId: { type: ObjectId, ref: "Equipo", required: true },
  usuarioId: { type: ObjectId, ref: "Usuario", required: true },
  fechaPrestamo: { type: Date, default: Date.now },
  fechaLimite: { type: Date, required: true },
  fechaDevolucion: { type: Date, default: null },
  estado: { type: String, enum: ["activo", "devuelto"], default: "activo" },
  observaciones: { type: String, trim: true, maxlength: 300, default: "" },
}, { timestamps: true });

// Índices para consultas por usuario y para la paginación (bonus)
prestamoSchema.index({ usuarioId: 1, estado: 1 });
prestamoSchema.index({ estado: 1, createdAt: -1 });

export default mongoose.model("Prestamo", prestamoSchema);