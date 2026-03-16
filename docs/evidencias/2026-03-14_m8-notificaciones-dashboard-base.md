# Evidencia de Desarrollo — M8: Notificaciones (Base Operativa)

| Campo                   | Valor                                                             |
| ----------------------- | ----------------------------------------------------------------- |
| **Proyecto**            | SIPAc — Sistema Inteligente de Productividad Academica            |
| **Institucion**         | Universidad de Cordoba, Monteria, Colombia                        |
| **Modulo**              | M8 — Notificaciones                                               |
| **Autor**               | Carlos A. Canabal Cordero                                         |
| **Fecha**               | 2026-03-14                                                        |
| **Version**             | 1.0                                                               |
| **Estado**              | Implementado parcialmente (in-app operativo, correo best-effort)  |
| **Objetivo del modulo** | Informar al usuario sobre resultados del procesamiento documental |

---

## 1. Proposito de la evidencia

Esta evidencia documenta la implementacion real del modulo de notificaciones en SIPAc. El objetivo es demostrar como el sistema comunica exito/fallo del pipeline documental, como persiste esas alertas y como las expone en interfaz para seguimiento del usuario.

## 2. Alcance implementado

El alcance actual incluye:

- persistencia de notificaciones en `notifications`;
- endpoints operativos para consulta y marcado de lectura;
- disparo automatico de notificaciones desde el pipeline de procesamiento documental;
- envio de correo opcional via Resend cuando el entorno esta configurado;
- bandeja in-app en frontend con contador de no leidas y polling.

## 3. Trazabilidad con requisitos funcionales

| RF                    | Requisito                                       | Implementacion actual                                                           | Estado     |
| --------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------- | ---------- |
| RF-084                | Notificar por correo al completar procesamiento | Envio best-effort con Resend (`RESEND_API_KEY` + `RESEND_FROM_EMAIL`)           | Parcial    |
| RF-085                | Notificar error de procesamiento                | Notificacion persistida + correo opcional en caso de error                      | Completado |
| RF-086                | Mostrar notificaciones en interfaz              | `GET /api/notifications` + `PATCH /api/notifications/:id/read` + inbox frontend | Completado |
| RF-062 a RF-072 (M5B) | Dashboard analitico y exportes institucionales  | Sin endpoints ni vistas analiticas implementadas                                | Pendiente  |

## 4. Decisiones tecnicas relevantes

### 4.1 Persistencia primero, correo despues

La notificacion principal es la persistida en base de datos; el correo es complementario. Esto evita perder trazabilidad cuando falla el proveedor externo de email.

### 4.2 Integracion directa con pipeline documental

La emision de notificaciones ocurre al finalizar `processUploadedFile` en estado `completed` o `error`, garantizando relacion directa entre evento tecnico y alerta al usuario.

### 4.3 Polling en cliente para fase inicial

Se adopto polling periodico (15 segundos) en el store para simplificar operacion temprana y posponer complejidad de canales push.

### 4.4 Retencion automatica de historico

La coleccion `notifications` usa indice TTL (90 dias) para controlar crecimiento de datos sin eliminar trazas recientes.

## 5. Artefactos implementados

### 5.1 Backend

| Archivo                                                       | Responsabilidad tecnica                           |
| ------------------------------------------------------------- | ------------------------------------------------- |
| `server/services/notifications/notify-document-processing.ts` | Crear notificacion y enviar correo opcional       |
| `server/models/Notification.ts`                               | Modelo persistente, indices y TTL                 |
| `server/api/notifications/index.get.ts`                       | Listado de notificaciones del usuario autenticado |
| `server/api/notifications/[id]/read.patch.ts`                 | Marcar notificacion como leida                    |

### 5.2 Frontend

| Archivo                                           | Responsabilidad tecnica                                  |
| ------------------------------------------------- | -------------------------------------------------------- |
| `app/stores/notifications.ts`                     | Fetch, polling, conteo de no leidas y marcado de lectura |
| `app/components/dashboard/NotificationsInbox.vue` | Bandeja visual de notificaciones                         |
| `app/components/layout/AppHeader.vue`             | Exposicion del contador de no leidas en cabecera         |

## 6. Flujo funcional implementado

1. El pipeline documental finaliza una carga en estado `completed` o `error`.
2. Se invoca `notifyDocumentProcessing` con informacion de archivo y estado.
3. Se crea registro en `notifications` con titulo, mensaje, tipo y recurso relacionado.
4. Si hay configuracion Resend valida, se intenta envio de correo y se marca `emailSent`.
5. El frontend consulta `GET /api/notifications` y actualiza la bandeja por polling.
6. El usuario marca notificaciones como leidas con `PATCH /api/notifications/:id/read`.

## 7. Evidencia tecnica verificable

- modelo `Notification` con campos `recipientId`, `type`, `title`, `message`, `relatedResource`, `isRead`, `emailSent`;
- indice `idx_user_notifications` para consulta por usuario/estado;
- indice TTL `idx_ttl_cleanup` para depuracion automatica;
- integracion activa del store con polling cada 15 segundos.

## 8. Resultados obtenidos

| Resultado                                       | Estado                  |
| ----------------------------------------------- | ----------------------- |
| Notificaciones in-app por exito y error         | Operativas              |
| Marcado de lectura por usuario                  | Operativo               |
| Correo de notificacion condicionado por entorno | Operativo (best-effort) |
| Retencion controlada de historial               | Operativa               |

## 9. Validacion realizada

- revision de servicio de notificacion y logica de correo;
- verificacion de endpoints de lectura/marcado;
- validacion de modelo e indices en `Notification`;
- verificacion de consumo frontend en store e inbox.

## 10. Limitaciones y trabajo pendiente

- no existe canal push en tiempo real (SSE/WebSocket);
- el envio de correo no tiene cola/reintento avanzado;
- el dashboard analitico institucional de productividad (M5B) permanece pendiente.

## 11. Conclusion tecnica

M8 ya entrega valor operativo al usuario con alertas persistentes y seguimiento de estado del procesamiento documental. La base es suficiente para operacion inicial del sistema, y el siguiente salto de madurez consiste en notificaciones en tiempo real y consolidacion del dashboard analitico dependiente de M5B.
