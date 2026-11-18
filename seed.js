import mongoose from "mongoose";
import Equipo from "./models/Equipo.js";
import Usuario from "./models/Usuario.js";
import Prestamo from "./models/Prestamo.js";

const dia = 24 * 60 * 60 * 1000;
const desde = (d) => new Date(Date.now() + d * dia);

await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/trionixgear");
await Promise.all([Equipo.deleteMany({}), Usuario.deleteMany({}), Prestamo.deleteMany({})]);
await Promise.all([Equipo.syncIndexes(), Usuario.syncIndexes(), Prestamo.syncIndexes()]);

const eq = await Equipo.insertMany([
  { codigo: "EQ-0001", nombre: "Portátil Lenovo ThinkPad", categoria: "portatil", estado: "prestado" },
  { codigo: "EQ-0002", nombre: "Proyector Epson X49", categoria: "proyector", estado: "prestado" },
  { codigo: "EQ-0003", nombre: "Cámara Canon EOS R50", categoria: "camara", estado: "prestado" },
  { codigo: "EQ-0004", nombre: "Kit de audio Behringer", categoria: "audio" },
  { codigo: "EQ-0005", nombre: "Router Cisco RV340", categoria: "redes" },
  { codigo: "EQ-0006", nombre: "Portátil HP ProBook", categoria: "portatil", estado: "mantenimiento" },
  { codigo: "EQ-0007", nombre: "Proyector BenQ MX550", categoria: "proyector" },
  { codigo: "EQ-0008", nombre: "Switch TP-Link 24 puertos", categoria: "redes" },
]);

const us = await Usuario.insertMany([
  { nombre: "Ana Torres", documento: "1001001001", email: "ana@mail.com", tipo: "estudiante" },
  { nombre: "Carlos Ruiz", documento: "1002002002", email: "carlos@mail.com", tipo: "docente" },
  { nombre: "Marta Díaz", documento: "1003003003", email: "marta@mail.com", tipo: "administrativo" },
  { nombre: "Luis Peña", documento: "1004004004", email: "luis@mail.com", tipo: "estudiante" },
  { nombre: "Sofía Gil", documento: "1005005005", email: "sofia@mail.com", tipo: "docente", activo: false },
]);

await Prestamo.insertMany([
  // activo
  { equipoId: eq[0]._id, usuarioId: us[0]._id, fechaPrestamo: desde(-1), fechaLimite: desde(3) },
  // activo y VENCIDO
  { equipoId: eq[1]._id, usuarioId: us[1]._id, fechaPrestamo: desde(-10), fechaLimite: desde(-3), observaciones: "Entrega tardía" },
  // activo
  { equipoId: eq[2]._id, usuarioId: us[2]._id, fechaPrestamo: desde(-1), fechaLimite: desde(5) },
  // devueltos
  { equipoId: eq[3]._id, usuarioId: us[0]._id, fechaPrestamo: desde(-20), fechaLimite: desde(-14), fechaDevolucion: desde(-15), estado: "devuelto" },
  { equipoId: eq[0]._id, usuarioId: us[3]._id, fechaPrestamo: desde(-15), fechaLimite: desde(-9), fechaDevolucion: desde(-10), estado: "devuelto" },
  { equipoId: eq[3]._id, usuarioId: us[1]._id, fechaPrestamo: desde(-8), fechaLimite: desde(-2), fechaDevolucion: desde(-3), estado: "devuelto" },
]);

console.log("Seed listo: 8 equipos, 5 usuarios, 6 préstamos");
await mongoose.disconnect();