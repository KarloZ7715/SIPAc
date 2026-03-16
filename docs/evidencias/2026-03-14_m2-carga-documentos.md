# Evidencia de Desarrollo — M2: Carga de Documentos

| Campo                   | Valor                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------- |
| **Proyecto**            | SIPAc — Sistema Inteligente de Productividad Academica                                 |
| **Institucion**         | Universidad de Cordoba, Monteria, Colombia                                             |
| **Modulo**              | M2 — Carga de Documentos                                                               |
| **Autor**               | Carlos A. Canabal Cordero                                                              |
| **Fecha**               | 2026-03-14                                                                             |
| **Version**             | 1.0                                                                                    |
| **Estado**              | Implementado con alcance funcional principal                                           |
| **Objetivo del modulo** | Permitir la carga segura de documentos academicos y activar su procesamiento asincrono |

---

## 1. Proposito de la evidencia

Esta evidencia documenta la implementacion real del modulo M2 en su estado actual de codigo. El objetivo no es solo listar rutas o archivos, sino dejar trazabilidad tecnica de como se recibe un documento, como se valida, donde se almacena y como se conecta con el pipeline OCR/NER para continuar el flujo academico.

El modulo M2 es la puerta de entrada del sistema: sin una carga robusta y auditable, los modulos posteriores (M3, M4, M5A y M8) no pueden operar de forma confiable.

## 2. Alcance implementado

Se implementaron las capacidades siguientes:

- carga de archivos mediante `POST /api/upload` con formulario multipart;
- validacion binaria de tipo real de archivo (`PDF`, `JPG`, `PNG`) y tamano maximo de 20 MB;
- persistencia binaria en MongoDB GridFS y metadatos en coleccion `uploaded_files`;
- disparo asincrono del procesamiento documental via `event.waitUntil(processUploadedFile(...))`;
- consulta de estado del pipeline con `GET /api/upload/:id/status`;
- acceso autenticado al archivo con `GET /api/upload/:id/file`;
- eliminacion logica del archivo y eliminacion derivada del producto asociado con `DELETE /api/upload/:id`.

## 3. Trazabilidad con requisitos funcionales

| RF     | Requisito                               | Implementacion actual                                                                | Estado     |
| ------ | --------------------------------------- | ------------------------------------------------------------------------------------ | ---------- |
| RF-020 | Cargar documento desde interfaz         | `app/pages/workspace-documents.vue` + `app/stores/documents.ts` + `POST /api/upload` | Completado |
| RF-021 | Aceptar formatos permitidos             | Validacion de MIME detectado (`application/pdf`, `image/jpeg`, `image/png`)          | Completado |
| RF-022 | Verificar tipo real de archivo          | `detectAllowedMimeType()` y `validateUploadedBinary()`                               | Completado |
| RF-023 | Limitar tamano maximo                   | `MAX_FILE_SIZE_BYTES` (20 MB) en validacion backend y config de seguridad            | Completado |
| RF-024 | Asociar archivo al usuario autenticado  | `uploadedBy` se define desde `requireRole(event, 'docente')`                         | Completado |
| RF-025 | Registrar metadatos base de carga       | `originalFilename`, `mimeType`, `fileSizeBytes`, `gridfsFileId`, timestamps          | Completado |
| RF-026 | Asociar tipo de producto desde metadata | `productType` opcional en metadata de upload                                         | Parcial    |
| RF-027 | Carga multiple por operacion            | No existe endpoint batch de carga                                                    | Pendiente  |
| RF-028 | Consultar estado de procesamiento       | `GET /api/upload/:id/status` con polling en frontend                                 | Parcial    |
| RF-029 | Eliminar archivo cargado                | `DELETE /api/upload/:id` marca `isDeleted` y limpia GridFS                           | Completado |
| RF-030 | Almacenamiento binario centralizado     | GridFS como almacenamiento efectivo                                                  | Completado |

## 4. Decisiones tecnicas relevantes

### 4.1 Persistencia en GridFS

Se eligio GridFS para evitar dependencia de filesystem local y mantener consistencia entre entornos. Esto permite que el archivo fuente quede versionado en la misma infraestructura de datos del sistema.

### 4.2 Respuesta asincrona del upload

La ruta de carga responde con `202 Accepted`, dejando el procesamiento OCR/NER en segundo plano. Esta decision reduce latencia percibida en interfaz y evita timeouts largos en la solicitud inicial.

### 4.3 Control de acceso por propiedad y rol

Las rutas de estado, descarga y eliminacion validan propietario o rol `admin`, evitando exposicion de documentos entre usuarios no autorizados.

### 4.4 Eliminacion derivada del producto

La eliminacion de un archivo tambien marca como eliminado el `academic_product` asociado si existe. Esta decision mantiene coherencia entre evidencia fuente y producto estructurado.

## 5. Artefactos implementados

### 5.1 Backend

| Archivo                                | Responsabilidad tecnica                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| `server/api/upload/index.post.ts`      | Recepcion multipart, validacion binaria, persistencia inicial y disparo de pipeline |
| `server/api/upload/[id]/status.get.ts` | Estado de procesamiento, trazas OCR/NER y referencia de borrador                    |
| `server/api/upload/[id]/file.get.ts`   | Streaming seguro del archivo desde GridFS                                           |
| `server/api/upload/[id].delete.ts`     | Eliminacion logica, limpieza GridFS y auditoria                                     |
| `server/models/UploadedFile.ts`        | Modelo persistente de archivo y observabilidad de pipeline                          |
| `server/services/storage/gridfs.ts`    | Operaciones de almacenamiento y lectura de binarios                                 |
| `server/utils/upload.ts`               | Parsing multipart y validacion de archivo                                           |

### 5.2 Frontend

| Archivo                                           | Responsabilidad tecnica                                      |
| ------------------------------------------------- | ------------------------------------------------------------ |
| `app/pages/workspace-documents.vue`               | Flujo de carga y seguimiento del documento                   |
| `app/stores/documents.ts`                         | Estado de carga, polling de estado y acciones de eliminacion |
| `app/components/dashboard/DocumentsWorkspace.vue` | Orquestacion de experiencia de carga/revision                |

## 6. Flujo funcional implementado

1. El docente selecciona archivo en la interfaz de workspace.
2. El frontend envia multipart a `POST /api/upload`.
3. El backend detecta MIME real, valida tamano y guarda binario en GridFS.
4. Se crea registro en `uploaded_files` con estado `pending`.
5. Se retorna respuesta `202` y se dispara `processUploadedFile` en segundo plano.
6. El frontend consulta `GET /api/upload/:id/status` de forma periodica.
7. Al finalizar, el estado pasa a `completed` o `error` y se expone informacion de OCR/NER para la siguiente etapa de revision.

## 7. Evidencia tecnica verificable

- Persistencia de observabilidad por etapas en `uploaded_files`: `processingStatus`, `processingAttempt`, `processingStartedAt`, `ocrCompletedAt`, `nerStartedAt`, `processingCompletedAt`.
- Registro de proveedor/modelo OCR y NER (`ocrProvider`, `ocrModel`, `nerProvider`, `nerModel`) para trazabilidad de IA.
- Registro de trazas de intento NER (`nerAttemptTrace`) por pasada y candidato.
- Auditoria de operaciones de carga y eliminacion con `logAudit`.

## 8. Resultados obtenidos

| Resultado                                         | Estado    |
| ------------------------------------------------- | --------- |
| Carga segura con validacion binaria               | Operativo |
| Almacenamiento en GridFS + metadatos en MongoDB   | Operativo |
| Procesamiento asincrono post-upload               | Operativo |
| Consulta de estado y avance de procesamiento      | Operativo |
| Eliminacion logica con consistencia de artefactos | Operativo |

## 9. Validacion realizada

- verificacion de rutas en `server/api/upload/*`;
- validacion del modelo `UploadedFile` y sus indices;
- verificacion del flujo UI/Store en workspace documental;
- validacion de integracion del pipeline en `tests/integration/process-uploaded-file.integration.test.ts`.

## 10. Limitaciones y trabajo pendiente

- RF-027 pendiente: no existe carga multiple en una sola operacion.
- RF-028 parcial: la actualizacion es por polling, no por canal push en tiempo real.
- Persisten mejoras de UX para confirmaciones de eliminacion en toda la experiencia.

## 11. Conclusion tecnica

El modulo M2 esta implementado como base robusta de ingreso documental para SIPAc. La solucion actual cumple los controles criticos de validacion, seguridad y trazabilidad, y deja habilitado el encadenamiento tecnico con OCR, NER, repositorio borrador y notificaciones sin bloquear la experiencia inicial del usuario.
