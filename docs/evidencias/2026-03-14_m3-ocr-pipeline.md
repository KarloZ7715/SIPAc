# Evidencia de Desarrollo — M3: Pipeline OCR

| Campo                   | Valor                                                                   |
| ----------------------- | ----------------------------------------------------------------------- |
| **Proyecto**            | SIPAc — Sistema Inteligente de Productividad Academica                  |
| **Institucion**         | Universidad de Cordoba, Monteria, Colombia                              |
| **Modulo**              | M3 — OCR y extraccion de texto documental                               |
| **Autor**               | Carlos A. Canabal Cordero                                               |
| **Fecha**               | 2026-03-14                                                              |
| **Version**             | 1.0                                                                     |
| **Estado**              | Implementado con fallback operativo a OCR visual                        |
| **Objetivo del modulo** | Obtener texto util desde PDF e imagenes como entrada confiable para NER |

---

## 1. Proposito de la evidencia

Esta evidencia describe la implementacion vigente del OCR en SIPAc, incluyendo la extraccion nativa de PDF, la degradacion controlada a OCR visual y la telemetria registrada en pipeline. El enfoque es mostrar como el sistema decide la estrategia de lectura y como deja rastro tecnico de esa decision.

## 2. Alcance implementado

El modulo M3 implementa actualmente:

- extraccion nativa de texto en PDF con `pdfjs-dist`;
- evaluacion de confiabilidad del texto extraido mediante heuristicas de longitud, cantidad de palabras y proporcion de letras;
- fallback a OCR visual con Gemini cuando el texto nativo no es confiable o no existe;
- normalizacion de texto para reducir ruido de espacios/saltos;
- registro de proveedor, modelo y confianza OCR en `uploaded_files`.

## 3. Trazabilidad con requisitos funcionales

| RF     | Requisito                                        | Implementacion actual                                                     | Estado     |
| ------ | ------------------------------------------------ | ------------------------------------------------------------------------- | ---------- |
| RF-031 | Extraer texto en PDF nativo sin OCR visual       | `extractNativePdfText()` con `pdfjs-dist`                                 | Completado |
| RF-032 | Detectar cuando el texto nativo no es suficiente | `isNativeTextReliable()` antes de fallback                                | Completado |
| RF-033 | OCR para escaneados/imagenes con proveedor IA    | `extractWithGemini()` operativo; OCR Mistral no conectado al flujo actual | Parcial    |
| RF-034 | Extraccion orientada a espanol                   | Prompt OCR en espanol en `extractWithGemini()`                            | Completado |
| RF-035 | Normalizar texto extraido                        | `normalizeExtractedText()`                                                | Completado |
| RF-036 | Persistir texto OCR bruto                        | `rawExtractedText` en `UploadedFile`                                      | Completado |
| RF-037 | Persistir confianza OCR                          | `ocrConfidence` registrado (heuristico por proveedor)                     | Parcial    |
| RF-038 | Exponer resultado OCR para revision previa       | No existe etapa UI separada previa a NER                                  | Pendiente  |

## 4. Decisiones tecnicas relevantes

### 4.1 Estrategia nativo primero

Para PDFs, el sistema intenta primero lectura nativa con PDF.js. Esta decision reduce costo de IA y preserva mejor la estructura textual cuando el documento tiene capa de texto.

### 4.2 Fallback visual controlado

Cuando la lectura nativa falla o no alcanza umbral de calidad, se ejecuta OCR visual con Gemini. Esta degradacion evita perder procesamiento completo en documentos escaneados.

### 4.3 Timeout explicito en llamadas OCR IA

Las llamadas OCR con Gemini usan `withTimeout` y valor configurable (`ocrRequestTimeoutMs`) validado por entorno. Esto evita bloqueos indefinidos en escenarios de red/proveedor.

### 4.4 Trazabilidad por proveedor y calidad

Cada ejecucion deja evidencia del proveedor (`pdfjs_native` o `gemini_vision`), modelo OCR y confianza estimada para permitir analisis posterior de calidad.

## 5. Artefactos implementados

### 5.1 Servicios y utilidades

| Archivo                                        | Responsabilidad tecnica                          |
| ---------------------------------------------- | ------------------------------------------------ |
| `server/services/ocr/extract-document-text.ts` | Orquestacion OCR nativo + fallback visual        |
| `server/services/ocr/quality-gates.ts`         | Evaluacion de calidad OCR para reintento interno |
| `server/services/llm/provider.ts`              | Resolucion de modelo Gemini Vision               |
| `server/utils/pipeline-observability.ts`       | Timeout y telemetria de eventos OCR              |
| `server/utils/env.ts`                          | Configuracion y validacion de parametros OCR     |

### 5.2 Persistencia de resultados

| Archivo                                           | Responsabilidad tecnica                                                                 |
| ------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `server/models/UploadedFile.ts`                   | Campos `rawExtractedText`, `ocrProvider`, `ocrModel`, `ocrConfidence`, marcas de tiempo |
| `server/services/upload/process-uploaded-file.ts` | Guarda resultado OCR y encadena NER                                                     |

## 6. Flujo funcional implementado

1. El pipeline recibe buffer y `mimeType` del documento cargado.
2. Si es PDF, intenta `extractNativePdfText()`.
3. Evalua confiabilidad del texto nativo con criterios heuristicas.
4. Si no es confiable, ejecuta OCR visual (`extractWithGemini`).
5. Normaliza texto final y calcula `ocrConfidence`.
6. Persiste resultados OCR en `uploaded_files`.
7. Entrega texto al modulo NER para extraccion estructurada.

## 7. Evidencia tecnica verificable

- uso de `withTimeout` para OCR de proveedor IA;
- eventos de observabilidad OCR (`start`, `native_pdf_completed`, `vision_fallback_triggered`, `completed`);
- soporte de anchors cuando la lectura proviene de PDF nativo (bloques con pagina y coordenadas);
- pruebas unitarias de OCR en `tests/unit/server/extract-document-text.test.ts`.

## 8. Resultados obtenidos

| Resultado                            | Estado    |
| ------------------------------------ | --------- |
| Extraccion nativa de PDF             | Operativa |
| Fallback visual cuando aplica        | Operativo |
| Texto normalizado para NER           | Operativo |
| Trazabilidad de proveedor/modelo OCR | Operativa |

## 9. Validacion realizada

- revision de implementacion en `server/services/ocr/extract-document-text.ts`;
- verificacion de persistencia OCR en `server/services/upload/process-uploaded-file.ts` y `server/models/UploadedFile.ts`;
- revision de pruebas unitarias en `tests/unit/server/extract-document-text.test.ts`.

## 10. Limitaciones y trabajo pendiente

- la rama configurable `OCR_PROVIDER=mistral` existe en entorno, pero no esta conectada al flujo efectivo de `extractDocumentText`;
- la confianza OCR se calcula por heuristica y debe homogenizarse entre proveedores futuros;
- no hay una vista separada para revisar OCR antes de NER (la revision ocurre sobre borrador integrado).

## 11. Conclusion tecnica

M3 cumple el objetivo principal de transformar documentos heterogeneos en texto util para extraccion semantica. La combinacion de PDF nativo + fallback visual ofrece resiliencia practica, mientras que la telemetria y los campos persistidos dejan evidencia suficiente para auditoria y mejora incremental del pipeline.
