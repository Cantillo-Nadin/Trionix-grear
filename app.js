import express from "express";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./db.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import equipos from "./routes/equipos.js";
import usuarios from "./routes/usuarios.js";
import prestamos from "./routes/prestamos.js";
import reportes from "./routes/reportes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => {
  const ok = mongoose.connection.readyState === 1;
  res.status(ok ? 200 : 503).json({ status: ok ? "ok" : "error", db: ok ? "connected" : "disconnected" });
});

app.use("/api/equipos", equipos);
app.use("/api/usuarios", usuarios);
app.use("/api/prestamos", prestamos);
app.use("/api/reportes", reportes);

app.use("/api", (req, res) => res.status(404).json({ status: 404, message: "Ruta no encontrada" }));
app.use(errorHandler); // siempre al final

const PORT = process.env.PORT || 3000;
const URI = process.env.MONGODB_URI || "mongodb://localhost:27017/trionixgear";

connectDB(URI)
  .then(() => app.listen(PORT, () => console.log(`API escuchando en el puerto ${PORT}`)))
  .catch((err) => {
    console.error("No se pudo conectar a MongoDB:", err.message);
    process.exit(1);
  });