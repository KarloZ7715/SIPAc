# Evidencia de Desarrollo — M4: Extraccion de Entidades (NER)

| Campo                   | Valor                                                                    |
| ----------------------- | ------------------------------------------------------------------------ |
| **Proyecto**            | SIPAc — Sistema Inteligente de Productividad Academica                   |
| **Institucion**         | Universidad de Cordoba, Monteria, Colombia                               |
| **Modulo**              | M4 — Extraccion semantica de entidades academicas                        |
| **Autor**               | Carlos A. Canabal Cordero                                                |
| **Fecha**               | 2026-03-14                                                               |
| **Version**             | 1.0                                                                      |
| **Estado**              | Implementado con fallback y trazabilidad de intentos                     |
| **Objetivo del modulo** | Convertir texto OCR en metadatos estructurados con confianza y evidencia |

---

## 1. Proposito de la evidencia

Esta evidencia registra la implementacion efectiva del modulo NER en SIPAc: clasificacion inicial del documento, extraccion de metadatos comunes, enriquecimiento por tipo de producto y persistencia de evidencia con anchors. El documento busca mostrar trazabilidad real de decisiones de IA y no solo resultado final.

## 2. Alcance implementado

Se implementaron los componentes siguientes:

- clasificacion documental (`academic`, `non_academic`, `uncertain`) y deteccion de `productType`;
- extraccion estructurada con `generateText` + `Output.object` y validacion Zod;
- fallback por candidatos de modelo para mejorar resiliencia;
- segundo pase de extraccion cuando la confianza global cae bajo umbral;
- evidencia por entidad (valor, confianza, anchors) y persistencia de trazas de intentos (`nerAttemptTrace`);
- extraccion de metadatos especificos por tipo de producto y validacion posterior.

## 3. Trazabilidad con requisitos funcionales

| RF     | Requisito                              | Implementacion actual                                         | Estado     |
| ------ | -------------------------------------- | ------------------------------------------------------------- | ---------- |
| RF-040 | Extraer autores                        | `authors[]` con confianza y anchors                           | Completado |
| RF-041 | Extraer titulo                         | `title` con evidencia                                         | Completado |
| RF-042 | Extraer institucion                    | `institution` con evidencia                                   | Completado |
| RF-043 | Extraer fecha                          | `date` normalizada con evidencia                              | Completado |
| RF-044 | Extraer palabras clave                 | `keywords[]` con confianza                                    | Completado |
| RF-045 | Extraer DOI                            | `doi` con evidencia                                           | Completado |
| RF-046 | Extraer evento/revista                 | `eventOrJournal` con evidencia                                | Completado |
| RF-047 | Guardar evidencia por entidad          | Anchors con pagina y coordenadas en `extractedEntities`       | Completado |
| RF-048 | Reintentar NER por baja confianza      | Segundo pase bajo `NER_CONFIDENCE_THRESHOLD`                  | Completado |
| RF-049 | Revision/correccion manual en interfaz | Edicion por borrador existe; revision por entidad aun parcial | Parcial    |
| RF-050 | Registrar fuente de extraccion         | `extractionSource` persistido en `AcademicProduct`            | Completado |

## 4. Decisiones tecnicas relevantes

### 4.1 Salidas estructuradas con contrato fuerte

El uso de Zod + `Output.object` evita parseo fragil de texto libre y fuerza un contrato consistente para la capa de datos.

### 4.2 Estrategia de candidatos para resiliencia

La extraccion NER utiliza candidatos en orden de intento: `gemini-2.5-flash`, `openai/gpt-oss-120b` (Groq), `gemini-2.5-flash-lite`, `openai/gpt-oss-20b` (Groq). Esto reduce fallos cuando un modelo no responde o degrada salida.

### 4.3 Politica de bloqueo documental

Si la clasificacion retorna `non_academic` con confianza alta, el pipeline marca error y no crea/actualiza producto academico. Esta regla protege calidad del repositorio ante cargas no pertinentes.

### 4.4 Observabilidad de intentos

Cada intento NER persiste proveedor, modelo, estado, duracion y mensaje de error truncado para facilitar diagnostico tecnico.

## 5. Artefactos implementados

### 5.1 Servicios NER

| Archivo                                              | Responsabilidad tecnica                                  |
| ---------------------------------------------------- | -------------------------------------------------------- |
| `server/services/ner/extract-academic-entities.ts`   | Clasificacion, extraccion comun, fallback y segundo pase |
| `server/services/ner/semantic-validation.ts`         | Validaciones semanticas post-extraccion                  |
| `server/services/ner/product-specific-validation.ts` | Saneamiento de metadatos especificos por subtipo         |
| `server/services/llm/provider.ts`                    | Definicion de candidatos de modelo NER                   |

### 5.2 Persistencia y consumo

| Archivo                                           | Responsabilidad tecnica                                                     |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| `server/services/upload/process-uploaded-file.ts` | Guarda resultados NER y crea/actualiza borrador en `AcademicProduct`        |
| `server/models/UploadedFile.ts`                   | Persistencia de `nerProvider`, `nerModel`, `nerAttemptTrace`, clasificacion |
| `server/models/AcademicProduct.ts`                | Persistencia de `extractedEntities`, `manualMetadata`, `reviewStatus`       |

## 6. Flujo funcional implementado

1. El pipeline recibe texto OCR y bloques de evidencia.
2. Ejecuta clasificacion inicial de documento y tipo de producto.
3. Intenta extraccion de entidades comunes con candidatos de modelo.
4. Si la confianza global cae bajo umbral, ejecuta segundo pase.
5. Extrae metadatos especificos del subtipo detectado.
6. Aplica validaciones semanticas y saneamiento de campos.
7. Persiste entidades extraidas y trazas de intento.
8. Si documento no academico de alta confianza, el proceso se marca como error y se notifica.

## 7. Evidencia tecnica verificable

- esquema de entidades comunes con confianza por campo y listas estructuradas;
- anchors con `page`, `x`, `y`, `width`, `height`, `provider`, `sourceText`;
- trazabilidad `nerAttemptTrace` con alcance por pasada (`extraction_first_pass` / `extraction_second_pass`);
- pruebas unitarias de fallback y segundo pase en `tests/unit/server/extract-academic-entities.test.ts`.

## 8. Resultados obtenidos

| Resultado                                     | Estado    |
| --------------------------------------------- | --------- |
| Extraccion de entidades comunes con evidencia | Operativa |
| Fallback multi-candidato de NER               | Operativo |
| Segundo pase por baja confianza               | Operativo |
| Enriquecimiento por subtipo de producto       | Operativo |

## 9. Validacion realizada

- revision de `server/services/ner/extract-academic-entities.ts`;
- verificacion de candidatos en `server/services/llm/provider.ts`;
- revision de persistencia final en `server/services/upload/process-uploaded-file.ts`;
- pruebas unitarias en `tests/unit/server/extract-academic-entities.test.ts`.

## 10. Limitaciones y trabajo pendiente

- la revision UI centrada por entidad con workflow dedicado aun no cubre todos los escenarios de correccion avanzada;
- la calidad final de extraccion depende de la calidad OCR de entrada;
- el ultimo fallback puede aumentar variabilidad de salida en casos limite.

## 11. Conclusion tecnica

M4 se encuentra implementado como un bloque funcional de extraccion semantica con control de calidad y trazabilidad suficiente para uso institucional. La arquitectura actual combina contrato tipado, evidencia georreferenciada sobre documento y resiliencia por candidatos, dejando como principal frente pendiente la profundizacion de UX para revision fina por entidad.
