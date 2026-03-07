# SIPAc — Mapa de API Routes

## Endpoints REST del Sistema

---

## Control de Versiones

| Versión | Fecha      | Autor                     | Descripción del cambio                                                                                                                                                                                                                                                   |
| ------- | ---------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.0     | 2026-03-02 | Carlos A. Canabal Cordero | Versión inicial — mapa completo de endpoints REST                                                                                                                                                                                                                        |
| 1.1     | 2026-03-04 | Carlos A. Canabal Cordero | Simplificación a 2 roles (`admin`, `docente`), eliminación del endpoint de verificación, nuevos endpoints de Chat Inteligente (M9) y archivos GridFS, actualización de permisos en dashboard                                                                             |
| 1.2     | 2026-03-06 | Carlos A. Canabal Cordero | Alineación a los cambios de la arquitectura: corrección de mecanismo de autenticación (cookie httpOnly en lugar de header Authorization), marcado de endpoints no implementados, adición de `GET /api/auth/me` y `GET /api/users/:id`, corrección de respuesta de perfil |

---

## 1. Convenciones

- **Base URL:** `/api/`
- **Autenticación:** JWT almacenado en cookie httpOnly `sipac_session` (configurada con `sameSite: 'strict'`, `secure: true` en producción, expiración de 8 horas). El middleware de servidor lee el token automáticamente desde la cookie — no se usa header `Authorization`.
- **Formato de respuesta exitosa:** `{ success: true, data: T, meta?: PaginationMeta }`
- **Formato de respuesta de error:** `{ success: false, error: { code: string, message: string, details?: any } }`
- **Paginación:** offset-based (page/limit) en los endpoints implementados actualmente

---

## 2. M1 — Autenticación (`/api/auth/`)

| Método | Ruta                 | Rol requerido | Request Body                              | Respuesta (200/201)           | Errores posibles | RF asociados    | Estado       |
| ------ | -------------------- | ------------- | ----------------------------------------- | ----------------------------- | ---------------- | --------------- | ------------ |
| POST   | `/api/auth/register` | Público       | `{ fullName, email, password, program? }` | `{ token, user: UserPublic }` | 400, 409         | RF-001 a RF-003 | Implementado |
| POST   | `/api/auth/login`    | Público       | `{ email, password }`                     | `{ token, user: UserPublic }` | 400, 401, 403    | RF-004, RF-012  | Implementado |
| GET    | `/api/auth/me`       | Autenticado   | —                                         | `{ user: UserPublic }`        | 401, 404         | RF-006          | Implementado |
| POST   | `/api/auth/logout`   | Autenticado   | —                                         | `{ message }`                 | 401              | RF-011          | Implementado |

> **Endpoints planificados (no implementados aún):**
>
> | Método | Ruta                        | RF asociado | Estado    |
> | ------ | --------------------------- | ----------- | --------- |
> | POST   | `/api/auth/forgot-password` | RF-013      | Pendiente |
> | POST   | `/api/auth/reset-password`  | RF-013      | Pendiente |

---

## 3. M2 — Carga de Documentos (`/api/upload/`)

| Método | Ruta                     | Rol requerido        | Request Body                                | Respuesta                   | Errores posibles | RF asociados    | Estado    |
| ------ | ------------------------ | -------------------- | ------------------------------------------- | --------------------------- | ---------------- | --------------- | --------- |
| POST   | `/api/upload`            | docente              | `multipart/form-data { file, productType }` | `{ uploadedFile }` (202)    | 400, 413         | RF-020 a RF-026 | Pendiente |
| GET    | `/api/upload/:id/status` | Autenticado (propio) | —                                           | `{ processingStatus, ... }` | 401, 404         | RF-028          | Pendiente |
| DELETE | `/api/upload/:id`        | Autenticado (propio) | —                                           | `{ message }`               | 401, 403, 404    | RF-029          | Pendiente |

---

## 4. M5A — Productos Académicos (`/api/products/`)

| Método | Ruta                | Rol requerido        | Request Body / Query                             | Respuesta              | Errores posibles   | RF asociados    | Estado    |
| ------ | ------------------- | -------------------- | ------------------------------------------------ | ---------------------- | ------------------ | --------------- | --------- |
| GET    | `/api/products`     | Autenticado          | Query: `productType, search, cursor, limit, ...` | `{ products[], meta }` | 401                | RF-052 a RF-061 | Pendiente |
| GET    | `/api/products/:id` | Autenticado          | —                                                | `{ product }`          | 401, 404           | RF-052          | Pendiente |
| PATCH  | `/api/products/:id` | Autenticado (propio) | `{ manualMetadata }`                             | `{ product }`          | 400, 401, 403, 404 | RF-056          | Pendiente |
| DELETE | `/api/products/:id` | Autenticado (propio) | —                                                | `{ message }`          | 401, 403, 404      | RF-057          | Pendiente |

---

## 5. M5B — Dashboard (`/api/dashboard/`)

| Método | Ruta                        | Rol requerido | Query                                       | Respuesta            | Errores posibles | RF asociados    | Estado    |
| ------ | --------------------------- | ------------- | ------------------------------------------- | -------------------- | ---------------- | --------------- | --------- |
| GET    | `/api/dashboard/summary`    | Autenticado   | `dateFrom?, dateTo?, productType?, userId?` | `{ summary }`        | 401, 403         | RF-062 a RF-069 | Pendiente |
| GET    | `/api/dashboard/export/pdf` | Autenticado   | `dateFrom?, dateTo?`                        | Archivo PDF (stream) | 401, 403         | RF-070          | Pendiente |
| GET    | `/api/dashboard/export/csv` | Autenticado   | `dateFrom?, dateTo?`                        | Archivo CSV (stream) | 401, 403         | RF-071          | Pendiente |

---

## 6. M1 — Gestión de Usuarios (`/api/users/`) — Solo Admin

| Método | Ruta             | Rol requerido | Request Body / Query                              | Respuesta           | Errores posibles   | RF asociados    | Estado       |
| ------ | ---------------- | ------------- | ------------------------------------------------- | ------------------- | ------------------ | --------------- | ------------ |
| GET    | `/api/users`     | admin         | Query: `page?, limit?, role?, isActive?, search?` | `{ users[], meta }` | 401, 403           | RF-007          | Implementado |
| POST   | `/api/users`     | admin         | `{ fullName, email, password, role?, program? }`  | `{ user }`          | 400, 401, 403, 409 | RF-007          | Implementado |
| GET    | `/api/users/:id` | admin         | —                                                 | `{ user }`          | 401, 403, 404      | RF-007          | Implementado |
| PATCH  | `/api/users/:id` | admin         | `{ fullName?, role?, isActive?, program? }`       | `{ user }`          | 400, 401, 403, 404 | RF-008 a RF-010 | Implementado |

---

## 7. M6 — Perfil (`/api/profile/`)

| Método | Ruta                           | Rol requerido | Request Body                       | Respuesta     | Errores posibles | RF asociados | Estado       |
| ------ | ------------------------------ | ------------- | ---------------------------------- | ------------- | ---------------- | ------------ | ------------ |
| GET    | `/api/profile`                 | Autenticado   | —                                  | `{ user }`    | 401, 404         | RF-073       | Implementado |
| PATCH  | `/api/profile`                 | Autenticado   | `{ fullName? }`                    | `{ user }`    | 400, 401         | RF-074       | Implementado |
| POST   | `/api/profile/change-password` | Autenticado   | `{ currentPassword, newPassword }` | `{ message }` | 400, 401         | RF-075       | Implementado |

> **Nota:** El campo `productsSummary` (RF-076) aún no se incluye en la respuesta de `GET /api/profile`. Se agregará cuando el módulo M5A esté implementado.

---

## 8. M8 — Notificaciones (`/api/notifications/`)

| Método | Ruta                          | Rol requerido | Request Body         | Respuesta             | Errores posibles | RF asociados | Estado    |
| ------ | ----------------------------- | ------------- | -------------------- | --------------------- | ---------------- | ------------ | --------- |
| GET    | `/api/notifications`          | Autenticado   | Query: `unreadOnly?` | `{ notifications[] }` | 401              | RF-086       | Pendiente |
| PATCH  | `/api/notifications/:id/read` | Autenticado   | —                    | `{ notification }`    | 401, 404         | RF-086       | Pendiente |

---

## 9. M9 — Chat Inteligente (`/api/chat/`)

| Método | Ruta                          | Rol requerido | Request Body / Query           | Respuesta                   | Errores posibles | RF asociados    | Estado    |
| ------ | ----------------------------- | ------------- | ------------------------------ | --------------------------- | ---------------- | --------------- | --------- |
| POST   | `/api/chat`                   | Autenticado   | `{ message, conversationId? }` | `ReadableStream` (SSE)      | 400, 401, 500    | RF-090 a RF-099 | Pendiente |
| GET    | `/api/chat/conversations`     | Autenticado   | Query: `limit?, cursor?`       | `{ conversations[], meta }` | 401              | RF-100          | Pendiente |
| GET    | `/api/chat/conversations/:id` | Autenticado   | —                              | `{ conversation }`          | 401, 404         | RF-100          | Pendiente |
| DELETE | `/api/chat/conversations/:id` | Autenticado   | —                              | `{ message }`               | 401, 404         | RF-100          | Pendiente |

> **Nota técnica (diseño previsto):** El endpoint `POST /api/chat` utilizará `streamText` del Vercel AI SDK con tool calling. La respuesta será un stream SSE que el frontend consumirá mediante el hook `useChat` de `@ai-sdk/vue`. El LLM (Gemini 2.0 Flash) invocará herramientas de búsqueda tipadas con Zod.

---

## 10. Archivos — Descarga y Previsualización (`/api/files/`)

| Método | Ruta                      | Rol requerido | Request Body / Query | Respuesta                             | Errores posibles | RF asociados | Estado    |
| ------ | ------------------------- | ------------- | -------------------- | ------------------------------------- | ---------------- | ------------ | --------- |
| GET    | `/api/files/:id/download` | Autenticado   | —                    | Archivo binario (stream) `attachment` | 401, 404         | RF-101       | Pendiente |
| GET    | `/api/files/:id/preview`  | Autenticado   | —                    | Archivo binario (stream) `inline`     | 401, 404         | RF-101       | Pendiente |

> **Nota técnica (diseño previsto):** Ambos endpoints leerán el archivo desde el servicio de almacenamiento y lo servirán como stream HTTP. La diferencia será el header `Content-Disposition`: `attachment` para descarga y `inline` para previsualización.

---

## 11. Códigos de Error Estándar

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

## 12. Rate Limiting

| Scope                     | Límite                  | Aplica a                 | RF/RNF asociado | Estado                                                    |
| ------------------------- | ----------------------- | ------------------------ | --------------- | --------------------------------------------------------- |
| Global por IP             | 150 tokens / 5 min      | Todos los endpoints      | RNF-009         | Implementado (`nuxt-security`)                            |
| Tamaño de request         | 2 MB body / 8 MB upload | Todos los endpoints      | RF-023          | Implementado (`nuxt-security`)                            |
| Autenticación por IP      | 10 req/min              | `/api/auth/*`            | RF-082          | Pendiente (rate limiting granular)                        |
| Procesamiento por usuario | 15 documentos/hora      | `/api/upload, /api/chat` | Cuota Gemini    | Pendiente (configurado en runtimeConfig, sin enforcement) |
| Chat por usuario          | 30 req/hora             | `/api/chat`              | Cuota Gemini    | Pendiente                                                 |
