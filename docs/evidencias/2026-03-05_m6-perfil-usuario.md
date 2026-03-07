# Evidencia de Desarrollo — M6: Perfil de Usuario

| Campo                   | Valor                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| **Proyecto**            | SIPAc — Sistema Inteligente de Productividad Académica                                    |
| **Institución**         | Universidad de Córdoba, Montería, Colombia                                                |
| **Módulo**              | M6 — Perfil de Usuario                                                                    |
| **Autor**               | Carlos A. Canabal Cordero                                                                 |
| **Fecha**               | 2026-03-05                                                                                |
| **Versión**             | 1.1                                                                                       |
| **Estado**              | Implementado parcialmente según alcance actual                                            |
| **Objetivo del módulo** | Permitir al usuario autenticado gestionar su información básica y su credencial de acceso |

---

## 1. Propósito de la evidencia

Esta evidencia documenta la implementación del módulo M6 desde una perspectiva de usabilidad, seguridad y consistencia con el dominio del sistema. El perfil de usuario no es un componente aislado: su función es permitir que cada docente o administrador mantenga actualizada su identidad dentro del sistema sin depender de intervención administrativa para cambios básicos.

## 2. Alcance implementado

Se desarrollaron las capacidades necesarias para:

- consultar el perfil propio,
- editar el nombre completo del usuario autenticado,
- cambiar la contraseña verificando la contraseña actual,
- presentar una interfaz separada por responsabilidades: información general y credenciales.

El requisito RF-076, relacionado con el resumen de productos propios por tipo, no fue implementado todavía porque depende del desarrollo del repositorio estructurado y de las agregaciones del módulo M5A.

## 3. Trazabilidad con requisitos funcionales

| RF     | Requisito                                      | Implementación actual                | Estado     |
| ------ | ---------------------------------------------- | ------------------------------------ | ---------- |
| RF-073 | Consultar perfil propio                        | `GET /api/profile`                   | Completado |
| RF-074 | Editar datos personales                        | `PATCH /api/profile` para `fullName` | Completado |
| RF-075 | Cambiar contraseña con validación de la actual | `POST /api/profile/change-password`  | Completado |
| RF-076 | Ver resumen de productos propios               | No implementado aún                  | Pendiente  |

## 4. Decisiones de diseño

### 4.1 Separación funcional de endpoints

Se decidió mantener endpoints distintos para consulta, actualización de perfil y cambio de contraseña. Esta separación reduce ambigüedad de responsabilidades, simplifica validaciones y permite aplicar mensajes de error más claros según el tipo de operación.

### 4.2 Separación visual y semántica en la interfaz

La pantalla de perfil se dividió en dos bloques:

- información del usuario,
- cambio de contraseña.

Esto evita mezclar cambios de identidad con cambios de credenciales, lo cual mejora la experiencia de uso y reduce errores operativos.

### 4.3 Seguridad del cambio de contraseña

El cambio de contraseña no se resuelve como actualización directa de un campo. La operación exige:

- autenticación previa,
- validación del payload,
- recuperación del usuario con `passwordHash`,
- verificación de la contraseña actual con `bcrypt.compare`,
- generación del nuevo hash,
- registro del evento en auditoría.

## 5. Componentes implementados

### 5.1 Backend

| Archivo                                      | Responsabilidad                            |
| -------------------------------------------- | ------------------------------------------ |
| `server/api/profile/index.get.ts`            | Retornar el perfil del usuario autenticado |
| `server/api/profile/index.patch.ts`          | Actualizar atributos permitidos del perfil |
| `server/api/profile/change-password.post.ts` | Gestionar el cambio seguro de contraseña   |

### 5.2 Frontend

| Archivo                 | Responsabilidad                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `app/pages/profile.vue` | Renderizar información del usuario, formulario de edición y formulario de cambio de contraseña |

### 5.3 Validación y soporte

| Archivo                        | Responsabilidad                                          |
| ------------------------------ | -------------------------------------------------------- |
| `server/utils/schemas/auth.ts` | Definir `updateProfileSchema` y `changePasswordSchema`   |
| `app/composables/useAuth.ts`   | Exponer el usuario actual en la UI                       |
| `app/stores/auth.ts`           | Mantener sesión y sincronización del usuario autenticado |

## 6. Flujo funcional implementado

### 6.1 Consulta de perfil

1. El usuario autenticado navega a `/profile`.
2. El frontend solicita los datos del perfil.
3. El backend valida la sesión.
4. Se consulta el usuario por su identificador autenticado.
5. Se retornan datos seguros, excluyendo información sensible.

### 6.2 Edición de nombre

1. El usuario modifica su nombre completo.
2. El formulario valida el dato con Zod.
3. El backend vuelve a validar el payload.
4. Se actualiza el documento del usuario.
5. Se registra una entrada de auditoría.
6. La interfaz notifica el resultado mediante `useToast()`.

### 6.3 Cambio de contraseña

1. El usuario diligencia contraseña actual y nueva contraseña.
2. El backend valida estructura y longitud mínima.
3. Se recupera el `passwordHash` de forma explícita.
4. Se compara la contraseña actual enviada con el hash persistido.
5. Si coincide, se reemplaza por un nuevo hash.
6. La operación se registra en auditoría.

## 7. Evidencia técnica y criterios de calidad

### 7.1 Seguridad

- La contraseña actual nunca se retorna al cliente.
- El hash nunca se expone en la serialización del usuario.
- El cambio de contraseña está protegido por autenticación previa.
- La operación deja rastro en auditoría.

### 7.2 Experiencia de usuario

- Formularios diferenciados por tarea.
- Retroalimentación visual de éxito y error.
- Consistencia visual con el resto del sistema gracias a `@nuxt/ui`.

### 7.3 Coherencia con la arquitectura del proyecto

La solución se ajusta a la arquitectura monolítica Nuxt 4 y reutiliza contratos ya establecidos en M1: auth store, middleware global, sesión por cookie y validaciones tipadas compartidas entre cliente y servidor.

## 8. Resultados obtenidos

| Resultado                             | Estado                           |
| ------------------------------------- | -------------------------------- |
| Consulta del perfil propio            | Operativo                        |
| Edición del nombre del usuario        | Operativo                        |
| Cambio de contraseña con verificación | Operativo                        |
| Trazabilidad en auditoría             | Operativa                        |
| Resumen de productos del perfil       | Pendiente por dependencia de M5A |

## 9. Validación realizada

- Verificación funcional del endpoint `GET /api/profile`.
- Verificación funcional del endpoint `PATCH /api/profile`.
- Verificación funcional del endpoint `POST /api/profile/change-password`.
- Confirmación de rechazo cuando la contraseña actual no coincide.
- Confirmación de mensajes de retroalimentación en la interfaz.

## 10. Limitaciones y trabajo pendiente

- RF-076 aún no puede completarse sin la colección `academic_products` poblada y sin agregaciones del módulo M5A.
- La edición de perfil está intencionalmente acotada a atributos controlados; no se habilitó edición libre de campos críticos como correo o rol.
- Las evidencias visuales de la UI deben complementarse con capturas del perfil, del formulario de edición y de la confirmación de cambio de contraseña.

## 11. Conclusión técnica

El módulo M6 quedó resuelto de manera coherente con el estado actual del proyecto: cubre la autogestión básica del usuario, protege adecuadamente el cambio de credenciales y mantiene alineación con la arquitectura de seguridad del sistema. La implementación demuestra criterio técnico al separar responsabilidades, reutilizar infraestructura existente y no adelantar funcionalidades dependientes de módulos aún no construidos.
