# Trionix Gear

**Estudiante:** TU NOMBRE AQUÍ
**Curso:** Electiva Web Avanzada · Parcial Final · Universidad Simón Bolívar

Trionix Gear es una aplicación web para gestionar el inventario de equipos de Trionix Labs (portátiles, proyectores, cámaras, audio y redes) y sus préstamos a estudiantes, docentes y administrativos. Incluye una API REST en Express con validación Joi, tres colecciones en MongoDB relacionadas por referencias, reglas de negocio de préstamo y devolución, reportes con agregación y un frontend estático. Todo corre con Docker Compose en un equipo personal y se publica con Cloudflare Tunnel.

## Requisitos

- Docker Desktop (Windows con WSL2, macOS) o Docker Engine (Linux), con Docker Compose v2.
- No hace falta instalar Node.js ni MongoDB en el equipo: corren en contenedores.

## Cómo levantarlo

1. Copia `.env.example` a `.env` (los valores por defecto sirven para Quick Tunnel):

   ```bash
   cp .env.example .env
   ```

2. Construye y levanta todo con un solo comando:

   ```bash
   docker compose up -d --build
   ```

3. Verifica que `api` y `mongo` estén `healthy`:

   ```bash
   docker compose ps
   ```

4. Carga los datos de prueba (8 equipos, 5 usuarios, 6 préstamos):

   ```bash
   docker compose exec api node seed.js
   ```

5. Abre http://localhost:3000.

Para detener sin perder datos: `docker compose down`. Para borrar también la base de datos: `docker compose down -v`.

## URL pública (Cloudflare Quick Tunnel)

El servicio `tunnel` usa un Quick Tunnel (sin cuenta ni dominio). La URL `https://<algo>.trycloudflare.com` se obtiene con:

```bash
docker compose logs tunnel
```

La URL **cambia cada vez que se reinicia el contenedor `tunnel`**, por eso la que se entrega es la que estaba activa durante la sustentación.

## Variables de entorno

Definidas en `.env` (no se sube al repositorio). `.env.example` muestra los nombres sin valores reales.

| Variable | Descripción |
|---|---|
| `PORT` | Puerto en el que escucha la API (3000). |
| `MONGODB_URI` | Cadena de conexión. Apunta al servicio de Compose: `mongodb://mongo:27017/trionixgear`. |
| `TUNNEL_TOKEN` | Solo para un túnel con nombre (bonus). Vacío con Quick Tunnel. Nunca se sube. |

## Flujo de red

```
Celular / Internet
        |  HTTPS
        v
   Cloudflare (trycloudflare.com)
        ^
        |  conexión SALIENTE iniciada por cloudflared
        |
  [contenedor tunnel]  -->  http://api:3000  -->  [contenedor api]  -->  mongo:27017  -->  [contenedor mongo]
                                   (red interna trionix-net)                              (volumen mongo-data)
```

El túnel funciona sin abrir puertos en el router ni tener IP pública porque `cloudflared` abre la conexión hacia Cloudflare desde dentro de la red. Cloudflare reenvía por esa misma conexión las peticiones que llegan a la URL pública, así que nada entra directamente al equipo.

## Endpoints

### Salud

| Método | Ruta | Respuestas |
|---|---|---|
| GET | `/api/health` | 200, 503 |

### Equipos

| Método | Ruta | Descripción | Respuestas |
|---|---|---|---|
| GET | `/api/equipos` | Lista, filtros `?categoria=` y `?estado=` | 200 |
| POST | `/api/equipos` | Crea un equipo | 201, 400, 409 |
| GET | `/api/equipos/:id` | Un equipo | 200, 400, 404 |
| PUT | `/api/equipos/:id` | Actualiza (no permite pasar a/desde `prestado`) | 200, 400, 404, 409 |
| DELETE | `/api/equipos/:id` | Elimina (409 si está prestado) | 200, 400, 404, 409 |
| GET | `/api/equipos/:id/prestamos` | Historial del equipo | 200, 400, 404 |

### Usuarios

| Método | Ruta | Descripción | Respuestas |
|---|---|---|---|
| GET | `/api/usuarios` | Lista, filtros `?tipo=` y `?activo=` | 200 |
| POST | `/api/usuarios` | Crea un usuario | 201, 400, 409 |
| GET | `/api/usuarios/:id` | Un usuario | 200, 400, 404 |
| PUT | `/api/usuarios/:id` | Actualiza | 200, 400, 404, 409 |
| DELETE | `/api/usuarios/:id` | Elimina (409 si tiene préstamos activos) | 200, 400, 404, 409 |
| GET | `/api/usuarios/:id/prestamos` | Historial del usuario | 200, 400, 404 |

### Préstamos

| Método | Ruta | Descripción | Respuestas |
|---|---|---|---|
| GET | `/api/prestamos` | Lista con `equipo` y `usuario` resueltos y campo `vencido`. Filtros `?estado=`, `?vencidos=true`, paginación `?page=&limit=` | 200 |
| POST | `/api/prestamos` | Crea un préstamo (reglas R1 a R4, R8) | 201, 400, 404, 409 |
| GET | `/api/prestamos/:id` | Un préstamo | 200, 400, 404 |
| PATCH | `/api/prestamos/:id/devolver` | Registra la devolución | 200, 400, 404, 409 |

### Reportes

| Método | Ruta | Descripción | Respuestas |
|---|---|---|---|
| GET | `/api/reportes/top-equipos?limit=5` | Equipos más prestados (`$group`, `$sort`, `$limit`, `$lookup`) | 200 |
| GET | `/api/reportes/resumen` | Equipos por estado, préstamos activos y vencidos, activos por tipo de usuario | 200 |

## Decisiones de diseño

- **Duplicados (error 11000):** el middleware de errores los traduce a 409 indicando el campo repetido.
- **Atomicidad (R8):** el equipo se reserva con `findOneAndUpdate({ _id, estado: "disponible" }, { estado: "prestado" })`. Si devuelve `null`, otro préstamo ganó la carrera y se responde 409. Leer con `findById` y luego guardar no es suficiente porque dos solicitudes simultáneas podrían leer `disponible` antes de que cualquiera escriba. Si falla la creación del préstamo, el equipo vuelve a `disponible` (compensación).
- **Vencido (R6):** no se guarda; se calcula al consultar (`estado === "activo"` y `fechaLimite` en el pasado).
- **Dockerfile:** imagen `node:22-alpine`, se copian primero `package.json` y `package-lock.json` para reutilizar la capa de `npm ci --omit=dev` cuando solo cambia el código, y el proceso corre con el usuario `node`.
- **Seguridad:** `.env` está en `.gitignore` y `.dockerignore`; MongoDB solo se publica en `127.0.0.1`.

## Bonus implementados

- **Paginación (+3):** `GET /api/prestamos?page=&limit=` responde `{ data, page, limit, total }`. La soporta el índice compuesto `{ estado: 1, createdAt: -1 }` en `Prestamo`: la lista filtra por `estado` y ordena por `createdAt` descendente, así que el índice cubre filtro y orden sin ordenar en memoria. También hay un índice `{ usuarioId: 1, estado: 1 }` para contar los préstamos activos de un usuario (R3).
