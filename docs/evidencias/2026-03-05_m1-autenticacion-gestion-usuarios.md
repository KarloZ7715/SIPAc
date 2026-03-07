# Evidencia de Desarrollo — M1: Autenticación y Gestión de Usuarios

| Campo                   | Valor                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| **Proyecto**            | SIPAc — Sistema Inteligente de Productividad Académica                                        |
| **Institución**         | Universidad de Córdoba, Montería, Colombia                                                    |
| **Módulo**              | M1 — Autenticación y Gestión de Usuarios                                                      |
| **Autor**               | Carlos A. Canabal Cordero                                                                     |
| **Fecha**               | 2026-03-05                                                                                    |
| **Versión**             | 1.1                                                                                           |
| **Estado**              | Implementado                                                                                  |
| **Objetivo del módulo** | Garantizar acceso autenticado, control de roles y administración segura de cuentas de usuario |

---

## 1. Propósito de la evidencia

Este documento registra, con enfoque técnico y académico, la implementación del módulo M1 del sistema SIPAc. La evidencia no solo enumera archivos creados, sino que justifica decisiones de diseño, relaciona los artefactos con los requisitos funcionales definidos en el SRS y documenta cómo la solución implementada responde a criterios de seguridad, mantenibilidad y trazabilidad.

El módulo M1 es fundamental para el resto del sistema porque establece la base de identidad, control de acceso y gestión de cuentas sobre la que se apoyan los módulos de documentos, perfil, dashboard y seguridad transversal.

## 2. Alcance implementado

El módulo implementado cubre los siguientes frentes:

- Registro de nuevos usuarios con validación de entrada.
- Inicio y cierre de sesión mediante JWT almacenado en cookie httpOnly.
- Consulta de sesión activa mediante endpoint de perfil autenticado.
- Gestión administrativa de usuarios con creación, edición, cambio de rol y activación/desactivación.
- Bloqueo temporal automático por intentos fallidos de autenticación.
- Integración con auditoría para registrar eventos críticos.
- Interfaz de usuario para login, registro y administración de cuentas.

Queda diferido dentro de M1 el flujo de recuperación de contraseña por correo, definido en RF-013.

## 3. Trazabilidad con requisitos funcionales

| RF     | Requisito                              | Implementación                                           | Evidencia de cumplimiento                                |
| ------ | -------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| RF-001 | Registro de usuarios                   | Endpoint `POST /api/auth/register` + formulario frontend | Validación Zod, creación de usuario y retorno de sesión  |
| RF-002 | Validación de email                    | `registerSchema`                                         | Rechazo de formatos inválidos antes de persistir         |
| RF-003 | Unicidad de email                      | índice único + verificación previa                       | Prevención de duplicados y error de conflicto            |
| RF-004 | Inicio de sesión con JWT               | `POST /api/auth/login`                                   | Emisión de JWT firmado y almacenamiento en cookie segura |
| RF-005 | Dos roles (`admin`, `docente`)         | `USER_ROLES` + schema de usuario                         | Restricción explícita de dominio de roles                |
| RF-006 | Autorización por rol                   | `requireRole`, middleware y navegación protegida         | Protección de rutas API y vistas admin                   |
| RF-007 | Crear usuarios como admin              | `POST /api/users`                                        | Creación administrativa desde API y UI                   |
| RF-008 | Editar usuarios                        | `PATCH /api/users/:id`                                   | Actualización controlada de atributos permitidos         |
| RF-009 | Activar/desactivar cuentas             | `isActive` en `User`                                     | Inhabilitación lógica sin borrado físico                 |
| RF-010 | Modificar roles                        | Campo `role` editable por admin                          | Gestión de privilegios desde panel administrativo        |
| RF-011 | Cierre de sesión                       | `POST /api/auth/logout`                                  | Eliminación de cookie de sesión                          |
| RF-012 | Bloqueo temporal por intentos fallidos | métodos del modelo `User`                                | Incremento de intentos, `lockUntil` y rechazo de login   |
| RF-013 | Recuperación de contraseña             | No implementado en esta iteración                        | Diferido de forma explícita                              |

## 4. Justificación de diseño

### 4.1 Estrategia de autenticación

Se decidió utilizar JWT firmado con `jose`, pero no almacenado en `localStorage`. En su lugar, el token se entrega al navegador en una cookie `httpOnly`. Esta decisión reduce exposición frente a XSS (Cross-Site Scripting) y se alinea mejor con un sistema institucional con datos sensibles de usuarios y, posteriormente, documentos académicos.

Características implementadas:

- Cookie `sipac_session` con `httpOnly: true`.
- `sameSite: 'strict'` para reducir riesgo CSRF.
- `secure: true` en producción.
- expiración de sesión de 8 horas.

### 4.2 Simplificación del modelo de roles

El análisis actualizado del proyecto redujo los roles del sistema a `admin` y `docente`. La implementación respeta esa simplificación y evita introducir complejidad innecesaria en autorización, navegación y mantenimiento. La decisión es coherente con la fase actual del proyecto y con el principio de construir un MVP (Producto Mínimo Viable) funcional antes de aumentar granularidad de permisos.

### 4.3 Control de fuerza bruta

En vez de delegar el bloqueo exclusivamente a infraestructura externa, se incorporó lógica de seguridad en el propio modelo `User`. Esto permite que el comportamiento sea auditable, verificable y portable entre entornos.

Elementos implementados:

- `failedLoginAttempts`.
- `lockUntil`.
- métodos `isLocked()`, `incrementLoginAttempts()` y `resetLoginAttempts()`.

### 4.4 Administración inicial del sistema

Se dejó implementado un seed administrativo controlado por variables de entorno. El objetivo es permitir bootstrap del entorno sin sembrar credenciales en código fuente. Posteriormente esta estrategia fue endurecida mediante validación de entorno y orden explícito de plugins.

## 5. Arquitectura implementada

### 5.1 Backend

| Archivo                            | Responsabilidad técnica                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| `server/models/User.ts`            | Modelo ODM de usuario, validaciones persistentes, métodos de seguridad de login |
| `server/plugins/02.admin-seed.ts`  | Creación opcional del administrador inicial a partir de variables seguras       |
| `server/api/auth/register.post.ts` | Registro de usuario, hash de contraseña, creación de sesión, auditoría          |
| `server/api/auth/login.post.ts`    | Validación de credenciales, bloqueo temporal, creación de sesión, auditoría     |
| `server/api/auth/logout.post.ts`   | Cierre de sesión y eliminación de cookie                                        |
| `server/api/auth/me.get.ts`        | Retorno del usuario autenticado desde sesión vigente                            |
| `server/api/users/index.get.ts`    | Listado administrativo con filtros, búsqueda y paginación                       |
| `server/api/users/index.post.ts`   | Alta administrativa de cuentas                                                  |
| `server/api/users/[id].get.ts`     | Consulta administrativa de cuenta puntual                                       |
| `server/api/users/[id].patch.ts`   | Edición administrativa controlada                                               |
| `server/middleware/auth.ts`        | Resolución de sesión desde cookie JWT y carga de contexto de autenticación      |
| `server/utils/authorize.ts`        | Reglas reutilizables `requireAuth` y `requireRole`                              |

### 5.2 Frontend

| Archivo                               | Responsabilidad técnica                                         |
| ------------------------------------- | --------------------------------------------------------------- |
| `app/stores/auth.ts`                  | Estado global de autenticación y sesión del usuario             |
| `app/stores/users.ts`                 | Estado global de administración de usuarios                     |
| `app/composables/useAuth.ts`          | API de consumo simplificada para componentes y páginas          |
| `app/middleware/auth.global.ts`       | Protección automática de rutas privadas                         |
| `app/middleware/admin.ts`             | Protección específica para vistas administrativas               |
| `app/pages/login.vue`                 | Formulario de inicio de sesión con validación integrada         |
| `app/pages/register.vue`              | Formulario de registro de nuevos usuarios                       |
| `app/pages/admin/users.vue`           | Pantalla de gestión administrativa con tabla, filtros y modales |
| `app/components/layout/AppHeader.vue` | Menú contextual del usuario autenticado                         |

### 5.3 Tipos y validación

| Archivo                        | Función dentro de la solución                 |
| ------------------------------ | --------------------------------------------- |
| `app/types/user.ts`            | Contrato tipado compartido de usuarios y DTOs |
| `server/utils/schemas/auth.ts` | Validación de payloads de registro y login    |
| `server/utils/schemas/user.ts` | Validación de payloads administrativos        |

## 6. Flujo funcional implementado

### 6.1 Registro

1. El usuario completa el formulario de registro.
2. El frontend valida el estado del formulario con Zod.
3. El backend valida nuevamente el payload.
4. Se comprueba unicidad del correo.
5. Se genera `passwordHash` con `bcrypt`.
6. Se crea el documento en `users`.
7. Se firma un JWT y se envía la cookie de sesión.
8. Se registra auditoría del evento de creación.

### 6.2 Login

1. El usuario envía correo y contraseña.
2. El servidor localiza la cuenta por email.
3. Se valida estado activo y estado de bloqueo.
4. Se verifica la contraseña con `bcrypt.compare`.
5. Si falla, se incrementa el contador de intentos.
6. Si el contador llega a 5, se establece bloqueo de 15 minutos.
7. Si autentica correctamente, se reinician intentos y se crea la sesión.

### 6.3 Gestión administrativa

1. Un usuario con rol `admin` accede al panel `/admin/users`.
2. El frontend consume `/api/users` con filtros y paginación.
3. Los formularios de creación/edición validan antes de enviar.
4. El backend aplica `requireRole(event, 'admin')`.
5. Toda modificación relevante genera entrada de auditoría.

## 7. Evidencia técnica verificable

### 7.1 Seguridad implementada

- Hash de contraseñas con `bcrypt` y 10 rondas de salt.
- Sesión basada en cookie httpOnly, no en almacenamiento accesible por JS.
- Verificación de rol en endpoints administrativos.
- Bloqueo por intentos fallidos antes de continuar el flujo de autenticación.
- Desactivación lógica de cuentas mediante `isActive`.

### 7.2 Calidad del código

- Compilación tipada verificada con `nuxi typecheck`.
- Revisión estática de frontend con ESLint.
- Corrección de interop Mongoose ESM/CJS para estabilidad en runtime.
- Validación de entorno reforzada para impedir arranque con configuración insegura o incompleta.

### 7.3 Coherencia con la documentación base del proyecto

La implementación es coherente con:

- el SRS del proyecto para los RF del módulo M1,
- la arquitectura monolítica Nuxt 4 documentada,
- el modelo de datos basado en MongoDB Atlas + Mongoose,
- y la estrategia de seguridad transversal introducida en M7 base.

## 8. Resultados obtenidos

| Resultado                     | Evidencia funcional                                     |
| ----------------------------- | ------------------------------------------------------- |
| Registro de usuario operativo | creación de cuenta y sesión válida                      |
| Login y logout operativos     | sesión activa y finalización controlada                 |
| Bloqueo temporal operativo    | rechazo de autenticación tras 5 intentos fallidos       |
| Gestión admin operativa       | alta, edición, cambio de rol y activación/desactivación |
| Protección de rutas operativa | vistas y endpoints restringidos por rol                 |

## 9. Validación realizada

- `npx nuxi typecheck` con resultado satisfactorio.
- `npx eslint app/` con resultado satisfactorio.
- Verificación de que los endpoints administrativos no son accesibles para usuarios sin rol `admin`.
- Verificación de persistencia del usuario en MongoDB.
- Verificación de entrega y uso de cookie de sesión.
- Verificación del bloqueo temporal por intentos fallidos.

## 10. Limitaciones y trabajo pendiente

- RF-013 permanece diferido: recuperación de contraseña por correo aún no implementada.
- Las pruebas automatizadas de integración específicas de auth deben ampliarse para soportar futuras regresiones.

## 11. Conclusión técnica

El módulo M1 quedó implementado como un bloque funcional y seguro dentro del estado actual del proyecto. La solución es consistente con el nivel de madurez esperado para una primera fase de pasantía: resuelve los requisitos críticos del MVP, reduce riesgos de seguridad en la gestión de sesión y deja bases sólidas para módulos posteriores que dependen del contexto de autenticación.

La evidencia demuestra que no se trató únicamente de una construcción visual o de endpoints aislados, sino de una solución integral que cubre persistencia, validación, seguridad, experiencia de usuario y trazabilidad.
