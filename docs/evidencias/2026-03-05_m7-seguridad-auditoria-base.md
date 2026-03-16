# Evidencia de Desarrollo — M7 Base: Seguridad y Auditoría

| Campo                   | Valor                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| **Proyecto**            | SIPAc — Sistema Inteligente de Productividad Académica                                   |
| **Institución**         | Universidad de Córdoba, Montería, Colombia                                               |
| **Módulo**              | M7 — Seguridad y Auditoría (base)                                                        |
| **Autor**               | Carlos A. Canabal Cordero                                                                |
| **Fecha**               | 2026-03-05                                                                               |
| **Versión**             | 1.1                                                                                      |
| **Estado**              | Implementado parcialmente — infraestructura base                                         |
| **Objetivo del módulo** | Proveer controles transversales de seguridad, validación y trazabilidad sobre el sistema |

---

## 1. Propósito de la evidencia

Esta evidencia documenta la implementación de la base de seguridad y auditoría del sistema SIPAc. El propósito no es demostrar una lista de configuraciones aisladas, sino evidenciar que la seguridad fue tratada como una preocupación arquitectónica transversal desde la primera fase de desarrollo.

La implementación actual cubre los cimientos: autenticación segura, autorización, endurecimiento HTTP, control básico de abuso, auditoría de acciones críticas y validación robusta del entorno. No representa todavía la totalidad del módulo M7, pero sí la base necesaria para que los módulos posteriores operen con garantías mínimas de seguridad y trazabilidad.

## 2. Alcance implementado

Se implementaron los siguientes componentes base:

- endurecimiento HTTP con `nuxt-security`,
- middleware de autenticación basado en cookie httpOnly,
- utilidades de autorización por rol,
- modelo persistente de auditoría,
- registro automático de eventos críticos,
- validación reforzada de variables de entorno,
- control de configuración de conexión MongoDB,
- limitación de tamaño de requests,
- rate limiting base configurado a nivel del servidor.

Quedan pendientes elementos de la fase completa del módulo, especialmente consulta administrativa de logs (RF-081) y granularidad de rate limiting específica para autenticación (RF-082).

## 3. Trazabilidad con requisitos funcionales

| RF     | Requisito                                      | Implementación actual                                                                                           | Estado                    |
| ------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------- |
| RF-077 | Sanitización / prevención de XSS               | mitigación por diseño con cookies httpOnly, validación estricta, headers y no exposición de secretos en cliente | Completado en base actual |
| RF-078 | Prevención de inyección                        | validación Zod + restricciones ODM + control de payloads permitidos                                             | Completado en base actual |
| RF-079 | Registro de operaciones críticas               | `logAudit(event, entry)`                                                                                        | Completado                |
| RF-080 | Auditoría con usuario, acción, timestamp e IP  | modelo `AuditLog`                                                                                               | Completado                |
| RF-081 | Consulta de log solo por admin                 | No implementado aún                                                                                             | Pendiente                 |
| RF-082 | Rate limiting en autenticación                 | configuración activa de seguridad en servidor (`nuxt-security` global)                                          | Parcial                   |
| RF-083 | Rechazo de extensión real inválida en archivos | validación de contenido binario real + MIME permitido en flujo de upload                                        | Completado                |

## 4. Decisiones de ingeniería de seguridad

### 4.1 Seguridad por configuración declarativa

Se adoptó `nuxt-security` como mecanismo base de endurecimiento. La principal razón fue evitar una colección dispersa de headers y controles manuales propensos a omisiones. Centralizar esta configuración en `nuxt.config.ts` reduce inconsistencias y facilita auditoría técnica posterior.

### 4.2 Sesión segura por cookie

La sesión se resolvió mediante cookie `httpOnly` y no mediante token persistido en almacenamiento del navegador. Esta decisión reduce superficie frente a XSS y mejora el alineamiento con un sistema institucional que maneja datos de usuarios y, posteriormente, repositorios documentales.

### 4.3 Auditoría como mecanismo transversal

La auditoría no se dejó como módulo posterior ni como característica opcional. Se integró desde los primeros endpoints sensibles para garantizar trazabilidad temprana de eventos como registro, login, fallos de autenticación, creación de usuarios y cambios de perfil.

### 4.4 Configuración segura del entorno

Se endureció el arranque del sistema mediante validación explícita de variables críticas. Esto evita que la aplicación se ejecute con configuraciones ambiguas o inseguras, por ejemplo:

- `MONGODB_URI` sin nombre de base explícito,
- `JWT_SECRET` débil,
- credenciales parciales del admin seed,
- contraseñas administrativas por debajo del umbral mínimo definido.

### 4.5 Orden explícito de inicialización

La conexión a MongoDB y el seed administrativo se ordenaron mediante plugins con prefijos (`01.mongodb.ts`, `02.admin-seed.ts`). La motivación fue evitar dependencia implícita entre conexión y siembra inicial de datos. Esto mejora previsibilidad del arranque y reduce fallos intermitentes o difíciles de diagnosticar.

## 5. Artefactos implementados

### 5.1 Seguridad de infraestructura

| Archivo                           | Responsabilidad                                                    |
| --------------------------------- | ------------------------------------------------------------------ |
| `nuxt.config.ts`                  | Headers de seguridad, rate limiting y límites de tamaño de request |
| `server/plugins/01.mongodb.ts`    | Conexión segura a MongoDB Atlas con validación previa de entorno   |
| `server/plugins/02.admin-seed.ts` | Bootstrap controlado del administrador inicial                     |
| `server/utils/env.ts`             | Validación tipada y segura de variables de entorno                 |

### 5.2 Autenticación y autorización

| Archivo                     | Responsabilidad                                              |
| --------------------------- | ------------------------------------------------------------ |
| `server/middleware/auth.ts` | Lectura de cookie de sesión y carga del contexto autenticado |
| `server/utils/jwt.ts`       | Firma y verificación de tokens JWT                           |
| `server/utils/authorize.ts` | Reglas reutilizables de autorización                         |

### 5.3 Auditoría

| Archivo                     | Responsabilidad                              |
| --------------------------- | -------------------------------------------- |
| `server/models/AuditLog.ts` | Persistencia del log de auditoría            |
| `server/utils/audit.ts`     | Registro no bloqueante de eventos auditables |

### 5.4 Gestión de errores segura

| Archivo                    | Responsabilidad                                              |
| -------------------------- | ------------------------------------------------------------ |
| `server/utils/errors.ts`   | Estandarización de errores HTTP sin abuso de `statusMessage` |
| `server/utils/response.ts` | Estandarización de respuestas exitosas                       |

## 6. Configuración de seguridad aplicada

### 6.1 `nuxt-security`

La aplicación incorpora controles tales como:

- headers de protección de contenido,
- rate limiting a nivel del servidor,
- límites de tamaño de payload,
- restricciones para carga de archivos,
- política explícita para recursos `img-src`.

### 6.2 Validación de entorno

La configuración endurecida obliga a que:

- `MONGODB_URI` use protocolo Mongo válido,
- `MONGODB_URI` incluya nombre explícito de base,
- `JWT_SECRET` tenga longitud mínima,
- `ADMIN_EMAIL` y `ADMIN_PASSWORD` se configuren juntos o ambos queden vacíos,
- la contraseña de administrador cumpla un mínimo razonable para entorno realista.

### 6.3 Auditoría activa

Se registran actualmente, entre otros, los siguientes eventos:

| Acción         | Recurso | Origen                            |
| -------------- | ------- | --------------------------------- |
| `create`       | `user`  | registro de usuario               |
| `login`        | `user`  | autenticación exitosa             |
| `login_failed` | `user`  | autenticación fallida             |
| `create`       | `user`  | creación administrativa de cuenta |
| `update`       | `user`  | edición administrativa            |
| `update`       | `user`  | edición de perfil                 |
| `update`       | `user`  | cambio de contraseña              |

## 7. Evidencia técnica verificable

### 7.1 Hallazgos corregidos durante el desarrollo

Durante la implementación se identificaron y corrigieron aspectos relevantes para la robustez del módulo:

- corrección de interop ESM/CJS con Mongoose en runtime,
- eliminación de índice duplicado de email en `User`,
- validación más estricta del `MONGODB_URI`,
- ajuste de mensajes de error para evitar warnings de `h3`,
- arranque más seguro del backend ante configuración incompleta.

### 7.2 Criterios de calidad alcanzados

- configuración centralizada y mantenible,
- trazabilidad de eventos críticos,
- reducción de superficie de exposición de credenciales,
- control explícito del arranque de la aplicación,
- coherencia entre seguridad de sesión, autorización y persistencia.

## 8. Validación realizada

- Confirmación de que las rutas no públicas requieren sesión válida.
- Confirmación de que las rutas administrativas requieren rol `admin`.
- Confirmación de que la auditoría registra usuario, acción, IP, user-agent y timestamp.
- Confirmación de que la conexión a MongoDB Atlas falla temprano si el entorno es inválido.
- Confirmación de que el backend arranca correctamente cuando `MONGODB_URI` incluye base explícita.
- Confirmación de presencia de headers y límites de request definidos.

## 9. Limitaciones y trabajo pendiente

- RF-081 aún no está cubierto: falta la consulta administrativa del log de auditoría.
- RF-082 aún no está cubierto al nivel granular solicitado por SRS (10 req/min en `/api/auth/*`), ya que la protección actual es global.
- La configuración de rate limiting debe refinarse en fases posteriores para ajustarse milimétricamente a todos los RF/RNF del sistema.

## 10. Conclusión técnica

La base de seguridad y auditoría implementada demuestra que la seguridad no fue tratada como un agregado tardío, sino como un componente estructural del proyecto. Desde una perspectiva de ingeniería de sistemas, la solución actual aporta un nivel de madurez adecuado para una pasantía profesional: controla riesgos razonables, documenta decisiones, registra trazabilidad y deja preparado el terreno para extender el módulo M7 sin rehacer fundamentos críticos.
