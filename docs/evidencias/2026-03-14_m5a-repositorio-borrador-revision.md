# Evidencia de Desarrollo — M5A: Repositorio Estructurado (Borrador y Revision)

| Campo                   | Valor                                                                           |
| ----------------------- | ------------------------------------------------------------------------------- |
| **Proyecto**            | SIPAc — Sistema Inteligente de Productividad Academica                          |
| **Institucion**         | Universidad de Cordoba, Monteria, Colombia                                      |
| **Modulo**              | M5A — Repositorio estructurado                                                  |
| **Autor**               | Carlos A. Canabal Cordero                                                       |
| **Fecha**               | 2026-03-14                                                                      |
| **Version**             | 1.0                                                                             |
| **Estado**              | Implementado parcialmente (flujo de borrador/revision)                          |
| **Objetivo del modulo** | Consolidar metadatos extraidos en productos academicos editables y confirmables |

---

## 1. Proposito de la evidencia

Esta evidencia registra el estado real de M5A: la capa de repositorio esta operativa para flujo de borrador y revision por producto, pero aun no dispone de listado global completo ni eliminacion directa por endpoint dedicado de productos.

El objetivo es dejar trazabilidad clara de lo implementado y de lo pendiente, evitando sobredocumentar capacidades que todavia no existen en API.

## 2. Alcance implementado

Se implemento actualmente:

- persistencia de productos en `academic_products` con discriminator pattern de Mongoose;
- creacion/actualizacion automatica del producto desde pipeline documental;
- consulta del borrador actual por usuario con `GET /api/products/drafts/current`;
- consulta puntual por identificador con `GET /api/products/:id`;
- actualizacion de metadatos manuales, subtipo y confirmacion con `PATCH /api/products/:id`;
- cierre de revision con `reviewStatus: confirmed` cuando se cumplen campos minimos.

## 3. Trazabilidad con requisitos funcionales

| RF     | Requisito                                    | Implementacion actual                                  | Estado     |
| ------ | -------------------------------------------- | ------------------------------------------------------ | ---------- |
| RF-051 | Crear producto desde extraccion automatica   | `processUploadedFile` crea/actualiza `AcademicProduct` | Completado |
| RF-052 | Consultar repositorio/listado de productos   | No existe `GET /api/products`                          | Pendiente  |
| RF-053 | Filtrar por tipo                             | Depende de endpoint de listado no implementado         | Pendiente  |
| RF-054 | Buscar por titulo/autores/palabras clave     | Indice full-text existe, exposicion API no             | Pendiente  |
| RF-055 | Paginacion de repositorio                    | No implementada por ausencia de listado                | Pendiente  |
| RF-056 | Editar y revisar borrador                    | `GET /api/products/:id` + `PATCH /api/products/:id`    | Completado |
| RF-057 | Eliminar producto por endpoint dedicado      | No existe `DELETE /api/products/:id`                   | Pendiente  |
| RF-058 | Confirmar/publicar resultado de revision     | `action: 'confirm'` en `PATCH /api/products/:id`       | Parcial    |
| RF-059 | Ajuste manual de metadatos                   | `manualMetadata` editable por PATCH                    | Completado |
| RF-060 | Restriccion de acceso por propiedad          | Verificacion owner/admin en GET/PATCH por id           | Completado |
| RF-061 | Vision administrativa global del repositorio | Depende de endpoint de listado                         | Pendiente  |

## 4. Decisiones tecnicas relevantes

### 4.1 Discriminator pattern para subtipos academicos

Un unico modelo base `AcademicProduct` soporta subtipos (`article`, `thesis`, `conference_paper`, etc.) mediante discriminadores. Esto reduce fragmentacion y mantiene consulta unificada.

### 4.2 Separacion entre evidencia extraida y correccion humana

El modelo separa `extractedEntities` (salida IA con anchors) de `manualMetadata` (ajuste humano), preservando trazabilidad entre dato sugerido y dato confirmado.

### 4.3 Estado de revision explicito

`reviewStatus` (`draft`/`confirmed`) evita confundir extraccion automatica con registro validado por usuario.

### 4.4 Cambio de subtipo con saneamiento de campos

Cuando el usuario cambia `productType`, el backend limpia campos del subtipo previo (`$unset`) para evitar residuos inconsistentes en el documento.

## 5. Artefactos implementados

### 5.1 Backend

| Archivo                                     | Responsabilidad tecnica                                     |
| ------------------------------------------- | ----------------------------------------------------------- |
| `server/models/AcademicProduct.ts`          | Modelo base, subtipos, indices y contratos de persistencia  |
| `server/api/products/drafts/current.get.ts` | Recuperar borrador mas reciente del usuario                 |
| `server/api/products/[id].get.ts`           | Recuperar borrador/producto puntual con control de acceso   |
| `server/api/products/[id].patch.ts`         | Guardar cambios, confirmar borrador y auditar actualizacion |
| `server/utils/product.ts`                   | Construccion de DTO de workspace documental                 |

### 5.2 Integracion de pipeline

| Archivo                                           | Responsabilidad tecnica                         |
| ------------------------------------------------- | ----------------------------------------------- |
| `server/services/upload/process-uploaded-file.ts` | Crear/actualizar producto a partir de OCR + NER |

### 5.3 Frontend

| Archivo                             | Responsabilidad tecnica                               |
| ----------------------------------- | ----------------------------------------------------- |
| `app/stores/documents.ts`           | Cargar borrador, guardar cambios y confirmar revision |
| `app/pages/workspace-documents.vue` | Interfaz de revision y confirmacion                   |

## 6. Flujo funcional implementado

1. El pipeline documental termina OCR/NER y genera payload de producto.
2. Se crea o actualiza `AcademicProduct` con `reviewStatus: 'draft'`.
3. El usuario abre workspace y consulta `drafts/current` o `products/:id`.
4. Ajusta `manualMetadata`, subtipo y metadatos especificos.
5. Guarda cambios de borrador (`action: save-draft`) o confirma (`action: confirm`).
6. Si confirma y cumple campos minimos (tipo, titulo, autor), el estado pasa a `confirmed`.

## 7. Evidencia tecnica verificable

- indices relevantes en `AcademicProduct`: `idx_owner_type`, `idx_owner_review_status`, `idx_fulltext_search`, `ux_source_file`;
- validacion de payload PATCH con `updateProductSchema`;
- auditoria de actualizaciones y confirmacion de borradores (`resource: academic_product`);
- pruebas unitarias de esquema en `tests/unit/server/product-schema.test.ts`.

## 8. Resultados obtenidos

| Resultado                                               | Estado    |
| ------------------------------------------------------- | --------- |
| Persistencia estructurada multi-subtipo                 | Operativa |
| Flujo de borrador por documento procesado               | Operativo |
| Edicion y confirmacion por usuario                      | Operativa |
| Control de acceso por propietario/admin en rutas por id | Operativo |

## 9. Validacion realizada

- revision de discriminadores y campos en `server/models/AcademicProduct.ts`;
- revision de endpoints implementados en `server/api/products/*`;
- verificacion de integracion con flujo documental en `server/services/upload/process-uploaded-file.ts`;
- revision de pruebas unitarias de esquema.

## 10. Limitaciones y trabajo pendiente

- falta endpoint de listado global (`GET /api/products`) con filtros y paginacion;
- falta endpoint dedicado de eliminacion de producto (`DELETE /api/products/:id`);
- la vision de repositorio completo para usuario/admin depende de esos endpoints pendientes.

## 11. Conclusion tecnica

M5A ya cumple la parte critica de convertir resultados IA en borradores editables y confirmables, con modelo de datos robusto y trazabilidad de cambios. El modulo aun no se considera completo como repositorio navegable institucional hasta implementar listado global, filtros y eliminacion directa por producto.
