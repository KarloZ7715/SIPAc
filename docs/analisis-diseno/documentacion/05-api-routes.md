# SIPAc — Mapa de API Routes

## Endpoints REST del Sistema

---

## Control de Versiones

| Versión | Fecha      | Autor                     | Descripción del cambio                                                                                                                                                                                                                                                   |
| ------- | ---------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.0     | 2026-03-02 | Carlos A. Canabal Cordero | Versión inicial — mapa completo de endpoints REST                                                                                                                                                                                                                        |
| 1.1     | 2026-03-04 | Carlos A. Canabal Cordero | Simplificación a 2 roles (`admin`, `docente`), eliminación del endpoint de verificación, nuevos endpoints de Chat Inteligente (M9) y archivos GridFS, actualización de permisos en dashboard                                                                             |
| 1.2     | 2026-03-06 | Carlos A. Canabal Cordero | Alineación a los cambios de la arquitectura: corrección de mecanismo de autenticación (cookie httpOnly en lugar de header Authorization), marcado de endpoints no implementados, adición de `GET /api/auth/me` y `GET /api/users/:id`, corrección de respuesta de perfil |
| 1.3     | 2026-03-11 | Carlos A. Canabal Cordero | Actualización de estado de endpoints implementados para M2 y M8; ajuste de contratos de estado de carga y notificaciones                                                                                                                                                 |
| 1.4     | 2026-03-13 | Carlos A. Canabal Cordero | Actualización de estrategia de fallback LLM para Chat (M9): `gpt-oss-120b` → `gemini-2.5-flash` → `qwen-3-235b-a22b-instruct-2507`                                                                                                                                       |
| 1.5     | 2026-03-13 | Carlos A. Canabal Cordero | Alineación de respuestas de estado de carga (`/api/upload/:id/status`) para incluir trazabilidad NER (`nerAttemptTrace`) y actualización de notas operativas de cuota multi-proveedor                                                                                    |
| 1.6     | 2026-03-14 | Carlos A. Canabal Cordero | Alineación al estado real de endpoints: previsualización autenticada de upload implementada y módulo M5A marcado como parcial (draft por ID sí, listado global aún pendiente)                                                                                            |
| 1.7     | 2026-03-20 | Carlos A. Canabal Cordero | Compendios multi-obra: `POST /api/upload` con `nerForceSingleDocument`; `GET /api/upload/:id/status` con `academicProductIds`, `sourceWorkCount`, `nerForceSingleDocument`; `DELETE /api/upload/:id` afecta todos los productos del archivo.                             |
| 1.8     | 2026-03-23 | Carlos A. Canabal Cordero | Alineación a endpoints implementados en sesión: `GET /api/products`, `DELETE /api/products/:id`, `GET /api/profile` con agregados, `GET /api/dashboard`, `GET /api/audit-logs`, `GET /api/notifications` con `unreadCount` y rate limiting específico en `auth`          |
| 1.9     | 2026-03-23 | Carlos A. Canabal Cordero | Alineación al estado implementado de M9: endpoints `/api/chat/*`, catálogo de proveedores/modelos, historial persistido, stream grounded y rate limiting específico en chat                                                                                               |

---

## 1. Convenciones

- **Base URL:** `/api/`
- **Autenticación:** JWT almacenado en cookie httpOnly `sipac_session` (configurada con `sameSite: 'strict'`, `secure: true` en producción, expiración de 8 horas). El middleware de servidor lee el token automáticamente desde la cookie — no se usa header `Authorization`.
- **Formato de respuesta exitosa:** `{ success: true, data: T, meta?: PaginationMeta }`
- **Formato de respuesta de error:** `{ success: false, error: { code: string, message: string, details?: any } }`
- **Paginación:** offset-based (page/limit) en los endpoints implementados actualmente

---

## 2. M1 — Autenticación (`/api/auth/`)

| Método | Ruta                 | Rol requerido | Request Body                              | Respuesta (200/201)           | Errores posibles   | RF asociados            | Estado       |
| ------ | -------------------- | ------------- | ----------------------------------------- | ----------------------------- | ------------------ | ----------------------- | ------------ |
| POST   | `/api/auth/register` | Público       | `{ fullName, email, password, program? }` | `{ token, user: UserPublic }` | 400, 409, 429      | RF-001 a RF-003, RF-082 | Implementado |
| POST   | `/api/auth/login`    | Público       | `{ email, password }`                     | `{ token, user: UserPublic }` | 400, 401, 403, 429 | RF-004, RF-012, RF-082  | Implementado |
| GET    | `/api/auth/me`       | Autenticado   | —                                         | `{ user: UserPublic }`        | 401, 404           | RF-006                  | Implementado |
| POST   | `/api/auth/logout`   | Autenticado   | —                                         | `{ message }`                 | 401                | RF-011                  | Implementado |

> **Nota:** `POST /api/auth/register` y `POST /api/auth/login` aplican un rate limit específico de **10 req/min por IP** además del rate limiting global, y responden con encabezados `X-RateLimit-Limit`, `X-RateLimit-Remaining` y `Retry-After` cuando corresponde.

> **Endpoints planificados (no implementados aún):**
>
> | Método | Ruta                        | RF asociado | Estado    |
> | ------ | --------------------------- | ----------- | --------- |
> | POST   | `/api/auth/forgot-password` | RF-013      | Pendiente |
> | POST   | `/api/auth/reset-password`  | RF-013      | Pendiente |

---

## 3. M2 — Carga de Documentos (`/api/upload/`)

| Método | Ruta                     | Rol requerido        | Request Body                                                                                              | Respuesta                                                                                                                                                                                 | Errores posibles | RF asociados    | Estado       |
| ------ | ------------------------ | -------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------- | ------------ |
| POST   | `/api/upload`            | docente              | `multipart/form-data { file, productType?, nerForceSingleDocument? }` (`true`/`1` = forzar una sola obra) | `{ uploadedFile }` (202)                                                                                                                                                                  | 400, 413         | RF-020 a RF-026 | Implementado |
| GET    | `/api/upload/:id/status` | Autenticado (propio) | —                                                                                                         | Estado de pipeline + `academicProductId?` (primera obra), `academicProductIds[]`, `sourceWorkCount`, `nerForceSingleDocument`, `reviewStatus?`, trazas OCR/NER y clasificación documental | 401, 403, 404    | RF-028          | Implementado |
| GET    | `/api/upload/:id/file`   | Autenticado (propio) | —                                                                                                         | `Archivo binario (stream autenticado para preview/descarga)`                                                                                                                              | 401, 403, 404    | RF-028, RF-101  | Implementado |
| DELETE | `/api/upload/:id`        | Autenticado (propio) | —                                                                                                         | `{ message }` — eliminación lógica del archivo y de **todos** los `academic_products` asociados a ese `sourceFile`                                                                        | 401, 403, 404    | RF-029          | Implementado |

---

## 4. M5A — Productos Académicos (`/api/products/`)

| Método | Ruta                           | Rol requerido                | Request Body / Query                                                       | Respuesta              | Errores posibles   | RF asociados           | Estado       |
| ------ | ------------------------------ | ---------------------------- | -------------------------------------------------------------------------- | ---------------------- | ------------------ | ---------------------- | ------------ |
| GET    | `/api/products`                | Autenticado                  | Query: `productType?, search?, institution?, owner?, year?, page?, limit?` | `{ products[], meta }` | 401                | RF-052 a RF-061        | Implementado |
| GET    | `/api/products/drafts/current` | Autenticado                  | —                                                                          | `{ draft o null }`     | 401                | RF-052, RF-056         | Implementado |
| GET    | `/api/products/:id`            | Autenticado                  | —                                                                          | `{ draft }`            | 401, 403, 404      | RF-052, RF-056, RF-060 | Implementado |
| PATCH  | `/api/products/:id`            | Autenticado (propio o admin) | `{ manualMetadata?, action?, productType?, ... }`                          | `{ draft }`            | 400, 401, 403, 404 | RF-056, RF-061         | Implementado |
| DELETE | `/api/products/:id`            | Autenticado (propio o admin) | —                                                                          | `{ deleted: true }`    | 401, 403, 404      | RF-057, RF-061         | Implementado |

> **Nota M5A (actualizado al 23/03/2026):** `GET /api/products` lista únicamente productos `confirmed` y no eliminados, con filtros, búsqueda y paginación. `GET /api/products/:id` permite consultar productos confirmados a cualquier autenticado y restringe borradores a propietario o `admin`. `PATCH` y `DELETE` permiten edición/eliminación a propietario o `admin`.

---

## 5. M5B — Dashboard (`/api/dashboard/`)

| Método | Ruta                        | Rol requerido | Query                              | Respuesta                                                                           | Errores posibles | RF asociados            | Estado       |
| ------ | --------------------------- | ------------- | ---------------------------------- | ----------------------------------------------------------------------------------- | ---------------- | ----------------------- | ------------ |
| GET    | `/api/dashboard`            | Autenticado   | `from?, to?, productType?, owner?` | `{ totalConfirmedProducts, totalOwners, dateRange, byType[], byOwner[], byYear[] }` | 401              | RF-062 a RF-069, RF-072 | Implementado |
| GET    | `/api/dashboard/export/pdf` | Autenticado   | `dateFrom?, dateTo?`               | Archivo PDF (stream)                                                                | 401, 403         | RF-070                  | Pendiente    |
| GET    | `/api/dashboard/export/csv` | Autenticado   | `dateFrom?, dateTo?`               | Archivo CSV (stream)                                                                | 401, 403         | RF-071                  | Pendiente    |

> **Nota M5B:** El dashboard implementado agrega exclusivamente productos `confirmed` y no eliminados lógicamente. La base analítica ya está operativa; las exportaciones siguen pendientes.

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

| Método | Ruta                           | Rol requerido | Request Body                       | Respuesta                                                            | Errores posibles | RF asociados   | Estado       |
| ------ | ------------------------------ | ------------- | ---------------------------------- | -------------------------------------------------------------------- | ---------------- | -------------- | ------------ |
| GET    | `/api/profile`                 | Autenticado   | —                                  | `{ user, totalOwnProducts, productSummaryByType[], latestDrafts[] }` | 401, 404         | RF-073, RF-076 | Implementado |
| PATCH  | `/api/profile`                 | Autenticado   | `{ fullName? }`                    | `{ user }`                                                           | 400, 401         | RF-074         | Implementado |
| POST   | `/api/profile/change-password` | Autenticado   | `{ currentPassword, newPassword }` | `{ message }`                                                        | 400, 401         | RF-075         | Implementado |

> **Nota:** `GET /api/profile` devuelve agregados calculados sobre productos propios `confirmed` (`totalOwnProducts`, `productSummaryByType`) y hasta 3 borradores recientes (`latestDrafts`) para reutilización en la UI de perfil.

---

## 8. M7 — Auditoría (`/api/audit-logs/`)

| Método | Ruta              | Rol requerido | Request Body / Query                                            | Respuesta          | Errores posibles | RF asociados    | Estado       |
| ------ | ----------------- | ------------- | --------------------------------------------------------------- | ------------------ | ---------------- | --------------- | ------------ |
| GET    | `/api/audit-logs` | admin         | Query: `resource?, action?, userId?, from?, to?, page?, limit?` | `{ logs[], meta }` | 401, 403         | RF-079 a RF-081 | Implementado |

> **Nota:** El endpoint de auditoría es de solo lectura y está restringido al rol `admin`. Soporta filtros por recurso, acción, usuario y rango de fechas.

---

## 9. M8 — Notificaciones (`/api/notifications/`)

| Método | Ruta                          | Rol requerido | Request Body         | Respuesta                          | Errores posibles | RF asociados | Estado       |
| ------ | ----------------------------- | ------------- | -------------------- | ---------------------------------- | ---------------- | ------------ | ------------ |
| GET    | `/api/notifications`          | Autenticado   | Query: `unreadOnly?` | `{ notifications[], unreadCount }` | 401              | RF-086       | Implementado |
| PATCH  | `/api/notifications/:id/read` | Autenticado   | —                    | `{ notification }`                 | 401, 404         | RF-086       | Implementado |

---

## 10. M9 — Chat Inteligente (`/api/chat/`)

| Método | Ruta                          | Rol requerido | Request Body / Query                                        | Respuesta                                                         | Errores posibles   | RF asociados    | Estado       |
| ------ | ----------------------------- | ------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- | ------------------ | --------------- | ------------ |
| POST   | `/api/chat`                   | Autenticado   | `{ id, messages[], trigger?, messageId?, selectedModel? }` | `UIMessageStream` grounded con metadata de modelo y tool outputs | 400, 401, 429, 500 | RF-090 a RF-099 | Implementado |
| GET    | `/api/chat/providers`         | Autenticado   | —                                                           | `{ defaultChain[], manualOptions[], disabledOptions[] }`         | 401                | RF-090          | Implementado |
| GET    | `/api/chat/conversations`     | Autenticado   | —                                                           | `{ conversations[] }`                                            | 401                | RF-100          | Implementado |
| GET    | `/api/chat/conversations/:id` | Autenticado   | —                                                           | `{ conversation }`                                               | 401, 404           | RF-099, RF-100  | Implementado |
| DELETE | `/api/chat/conversations/:id` | Autenticado   | —                                                           | `{ deleted: true }`                                              | 401, 404           | RF-100          | Implementado |

> **Nota técnica:** `POST /api/chat` usa `streamText` del Vercel AI SDK con tool calling, saneamiento previo de historial, sondeo de arranque del stream y fallback automático por candidato. El tool `searchRepositoryProducts` concentra la recuperación grounded híbrida sobre productos `confirmed`, con búsqueda estructurada exacta, ampliación diagnóstica y recuperación por texto OCR/nativo cuando aplica. La cadena automática vigente del chat es `qwen-3-235b-a22b-instruct-2507` (Cerebras) → candidatos NVIDIA → candidatos OpenRouter → candidatos Groq; `Gemini` queda expuesto solo como opción deshabilitada por política grounded vigente.

---

## 11. Archivos — Descarga y Previsualización

| Método | Ruta                   | Rol requerido        | Request Body / Query | Respuesta                                              | Errores posibles | RF asociados | Estado       |
| ------ | ---------------------- | -------------------- | -------------------- | ------------------------------------------------------ | ---------------- | ------------ | ------------ |
| GET    | `/api/upload/:id/file` | Autenticado (propio) | —                    | Archivo binario (stream autenticado para uso en visor) | 401, 403, 404    | RF-101       | Implementado |

> **Nota técnica:** Actualmente la descarga/previsualización se resuelve con `GET /api/upload/:id/file`. Los endpoints dedicados bajo `/api/files/*` no están implementados en el estado actual.

---

## 12. Códigos de Error Estándar

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

## 13. Rate Limiting

| Scope                     | Límite                  | Aplica a                                | RF/RNF asociado                             | Estado                                                             |
| ------------------------- | ----------------------- | --------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------ |
| Global por IP             | 150 tokens / 5 min      | Todos los endpoints                     | RNF-009                                     | Implementado (`nuxt-security`)                                     |
| Tamaño de request         | 2 MB body / 8 MB upload | Todos los endpoints                     | RF-023                                      | Implementado (`nuxt-security`)                                     |
| Autenticación por IP      | 10 req/min              | `/api/auth/register`, `/api/auth/login` | RF-082                                      | Implementado (`server/utils/auth-rate-limit.ts`)                   |
| Procesamiento por usuario | 15 documentos/hora      | `/api/upload`                           | Cuota proveedores IA del pipeline documental | Pendiente (configurado en runtimeConfig, sin enforcement granular) |
| Chat por usuario          | 30 req/hora             | `/api/chat`                             | Cuota proveedores IA multi-proveedor         | Implementado (`server/utils/chat-rate-limit.ts`)                   |
