# SIPAc — Mapa de API Routes

## Endpoints REST del Sistema

---

## Control de Versiones

| Versión | Fecha      | Autor                     | Descripción del cambio                            |
| ------- | ---------- | ------------------------- | ------------------------------------------------- |
| 1.0     | 2026-03-02 | Carlos A. Canabal Cordero | Versión inicial — mapa completo de endpoints REST |

---

## 1. Convenciones

- **Base URL:** `/api/`
- **Autenticación:** JWT en header `Authorization: Bearer <token>` (salvo rutas públicas)
- **Formato de respuesta exitosa:** `{ success: true, data: T, meta?: PaginationMeta }`
- **Formato de respuesta de error:** `{ success: false, error: { code: string, message: string, details?: any } }`
- **Paginación:** cursor-based para repositorio, offset-based para dashboard y búsqueda

---

## 2. M1 — Autenticación (`/api/auth/`)

| Método | Ruta                        | Rol requerido | Request Body                              | Respuesta (200/201)           | Errores posibles | RF asociados    |
| ------ | --------------------------- | ------------- | ----------------------------------------- | ----------------------------- | ---------------- | --------------- |
| POST   | `/api/auth/register`        | Público       | `{ fullName, email, password, program? }` | `{ token, user: UserPublic }` | 400, 409         | RF-001 a RF-003 |
| POST   | `/api/auth/login`           | Público       | `{ email, password }`                     | `{ token, user: UserPublic }` | 400, 401, 403    | RF-004, RF-012  |
| POST   | `/api/auth/logout`          | Autenticado   | —                                         | `{ message }`                 | 401              | RF-011          |
| POST   | `/api/auth/forgot-password` | Público       | `{ email }`                               | `{ message }`                 | 400              | RF-013          |
| POST   | `/api/auth/reset-password`  | Público       | `{ token, newPassword }`                  | `{ message }`                 | 400, 401         | RF-013          |

---

## 3. M2 — Carga de Documentos (`/api/upload/`)

| Método | Ruta                     | Rol requerido        | Request Body                                | Respuesta                   | Errores posibles | RF asociados    |
| ------ | ------------------------ | -------------------- | ------------------------------------------- | --------------------------- | ---------------- | --------------- |
| POST   | `/api/upload`            | docente, estudiante  | `multipart/form-data { file, productType }` | `{ uploadedFile }` (202)    | 400, 413         | RF-020 a RF-026 |
| GET    | `/api/upload/:id/status` | Autenticado (propio) | —                                           | `{ processingStatus, ... }` | 401, 404         | RF-028          |
| DELETE | `/api/upload/:id`        | Autenticado (propio) | —                                           | `{ message }`               | 401, 403, 404    | RF-029          |

---

## 4. M5A — Productos Académicos (`/api/products/`)

| Método | Ruta                       | Rol requerido        | Request Body / Query                             | Respuesta              | Errores posibles   | RF asociados    |
| ------ | -------------------------- | -------------------- | ------------------------------------------------ | ---------------------- | ------------------ | --------------- |
| GET    | `/api/products`            | Autenticado          | Query: `productType, search, cursor, limit, ...` | `{ products[], meta }` | 401                | RF-052 a RF-061 |
| GET    | `/api/products/:id`        | Autenticado          | —                                                | `{ product }`          | 401, 404           | RF-052          |
| PATCH  | `/api/products/:id`        | Autenticado (propio) | `{ manualMetadata }`                             | `{ product }`          | 400, 401, 403, 404 | RF-056          |
| DELETE | `/api/products/:id`        | Autenticado (propio) | —                                                | `{ message }`          | 401, 403, 404      | RF-057          |
| PATCH  | `/api/products/:id/verify` | coordinador, admin   | `{ verificationStatus, rejectionReason? }`       | `{ product }`          | 400, 401, 403, 404 | RF-060          |

---

## 5. M5B — Dashboard (`/api/dashboard/`)

| Método | Ruta                        | Rol requerido      | Query                                       | Respuesta            | Errores posibles | RF asociados    |
| ------ | --------------------------- | ------------------ | ------------------------------------------- | -------------------- | ---------------- | --------------- |
| GET    | `/api/dashboard/summary`    | coordinador, admin | `dateFrom?, dateTo?, productType?, userId?` | `{ summary }`        | 401, 403         | RF-062 a RF-069 |
| GET    | `/api/dashboard/export/pdf` | coordinador, admin | `dateFrom?, dateTo?`                        | Archivo PDF (stream) | 401, 403         | RF-070          |
| GET    | `/api/dashboard/export/csv` | admin              | `dateFrom?, dateTo?`                        | Archivo CSV (stream) | 401, 403         | RF-071          |

---

## 6. M1 — Gestión de Usuarios (`/api/users/`) — Solo Admin

| Método | Ruta             | Rol requerido | Request Body                                | Respuesta           | Errores posibles   | RF asociados    |
| ------ | ---------------- | ------------- | ------------------------------------------- | ------------------- | ------------------ | --------------- |
| GET    | `/api/users`     | admin         | Query: `page?, limit?, role?, isActive?`    | `{ users[], meta }` | 401, 403           | RF-007          |
| POST   | `/api/users`     | admin         | `{ fullName, email, password, role }`       | `{ user }`          | 400, 401, 403, 409 | RF-007          |
| PATCH  | `/api/users/:id` | admin         | `{ fullName?, role?, isActive?, program? }` | `{ user }`          | 400, 401, 403, 404 | RF-008 a RF-010 |

---

## 7. M6 — Perfil (`/api/profile/`)

| Método | Ruta                           | Rol requerido | Request Body                       | Respuesta                   | Errores posibles | RF asociados   |
| ------ | ------------------------------ | ------------- | ---------------------------------- | --------------------------- | ---------------- | -------------- |
| GET    | `/api/profile`                 | Autenticado   | —                                  | `{ user, productsSummary }` | 401              | RF-073, RF-076 |
| PATCH  | `/api/profile`                 | Autenticado   | `{ fullName? }`                    | `{ user }`                  | 400, 401         | RF-074         |
| POST   | `/api/profile/change-password` | Autenticado   | `{ currentPassword, newPassword }` | `{ message }`               | 400, 401         | RF-075         |

---

## 8. M8 — Notificaciones (`/api/notifications/`)

| Método | Ruta                          | Rol requerido | Request Body         | Respuesta             | Errores posibles | RF asociados |
| ------ | ----------------------------- | ------------- | -------------------- | --------------------- | ---------------- | ------------ |
| GET    | `/api/notifications`          | Autenticado   | Query: `unreadOnly?` | `{ notifications[] }` | 401              | RF-086       |
| PATCH  | `/api/notifications/:id/read` | Autenticado   | —                    | `{ notification }`    | 401, 404         | RF-086       |

---

## 9. Códigos de Error Estándar

| Código HTTP | Código interno         | Descripción                                 |
| ----------- | ---------------------- | ------------------------------------------- |
| 400         | `VALIDATION_ERROR`     | Datos de entrada inválidos (schema Zod)     |
| 401         | `AUTHENTICATION_ERROR` | Token ausente, inválido o expirado          |
| 403         | `AUTHORIZATION_ERROR`  | Rol insuficiente para la operación          |
| 403         | `ACCOUNT_LOCKED`       | Cuenta bloqueada por intentos fallidos      |
| 404         | `NOT_FOUND`            | Recurso no encontrado                       |
| 409         | `CONFLICT`             | Conflicto de unicidad (ej: email duplicado) |
| 413         | `PAYLOAD_TOO_LARGE`    | Archivo supera los 20 MB                    |
| 429         | `RATE_LIMIT_EXCEEDED`  | Demasiadas solicitudes                      |
| 500         | `INTERNAL_ERROR`       | Error interno del servidor                  |

---

## 10. Rate Limiting

| Scope                     | Límite             | Aplica a            | RF/RNF asociado |
| ------------------------- | ------------------ | ------------------- | --------------- |
| Autenticación por IP      | 10 req/min         | `/api/auth/*`       | RF-082          |
| Global por IP             | 100 req/min        | Todos los endpoints | RNF-009         |
| Procesamiento por usuario | 15 documentos/hora | `/api/upload`       | Cuota Gemini    |
