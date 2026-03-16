# Evidencia de Desarrollo — Refuerzo NER OCR y Metadatos por Subtipo

| Campo                   | Valor                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Proyecto**            | SIPAc — Sistema Inteligente de Productividad Académica                                                          |
| **Institución**         | Universidad de Córdoba, Montería, Colombia                                                                      |
| **Componente**          | Hardening transversal del pipeline OCR -> NER -> persistencia                                                   |
| **Autor**               | Carlos A. Canabal Cordero                                                                                       |
| **Fecha**               | 2026-03-15                                                                                                      |
| **Versión**             | 1.0                                                                                                             |
| **Estado**              | Implementado y validado con pruebas unitarias, integración y eval baseline                                      |
| **Objetivo del avance** | Mejorar precisión, robustez, trazabilidad y control de calidad en extracción de metadatos comunes y específicos |

---

## 1. Propósito de la evidencia

Esta evidencia registra el refuerzo técnico aplicado al pipeline documental para pasar de una extracción funcional a una extracción robusta, auditable y gobernable por métricas. El foco no fue solo agregar más campos, sino introducir controles de calidad por etapa (OCR y NER), endurecimiento de contratos estructurados, políticas de reintento por tipo de error y validación semántica antes de persistir.

## 2. Alcance implementado

El refuerzo cubre seis frentes principales:

- validación semántica de metadatos comunes (DOI, fecha, coherencia de eventOrJournal por tipo);
- calibración de confianza de extracción combinando señal del modelo, cobertura de evidencia y penalización semántica;
- endurecimiento de esquemas estructurados con objetos estrictos para rechazar claves extra y enums inválidos;
- reintento NER guiado por tipo de error (`schema_validation` con estrategia estricta en mismo candidato);
- quality gate OCR con decisión explícita y reintento único previo a NER cuando la calidad es pobre;
- post-validación de metadatos específicos por subtipo antes de persistencia final.

Además, se creó un arnés de evaluación base por campos para medir calidad mínima esperada y se documentó una scorecard operativa.

## 3. Trazabilidad funcional del refuerzo

| Área                      | Implementación                                                               | Resultado                                                           |
| ------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Integridad semántica base | `applySemanticValidation()` y normalizadores dedicados                       | Evita persistir DOI/fecha inválidos                                 |
| Confianza explicable      | `calculateCalibratedConfidence()` con `semanticPenalty` y `evidenceCoverage` | Señal de confianza menos frágil que promedio simple                 |
| Contratos estrictos       | `.strict()` + `schema.parse(result.output)` en runtime                       | Rechazo de payloads fuera de contrato                               |
| Retry inteligente NER     | rama `schema_tight_retry` cuando falla esquema                               | Recuperación más precisa sin saltar de inmediato de candidato       |
| Control de calidad OCR    | `evaluateOcrQuality()` + eventos de decisión                                 | Reintento OCR solo cuando hay evidencia de mala calidad             |
| Saneamiento por subtipo   | `validateProductSpecificMetadata()` antes de mapear                          | Prevención de incoherencias de dominio (ejemplo: fechas de patente) |

## 4. Decisiones técnicas relevantes

### 4.1 Contrato fuerte en extracción estructurada

Se mantuvo structured output con Zod, pero se eliminó permisividad residual: ahora cada salida se valida explícitamente con `schema.parse` incluso después de la respuesta del proveedor. Esto evita que payloads malformados “pasen” por rutas felices.

### 4.2 Reintento por causa y no por azar

Se introdujo política de recuperación para `schema_validation` con prompt de refuerzo y menor temperatura, conservando el mismo candidato antes de degradar al siguiente. La estrategia reduce costo y mejora estabilidad cuando el problema es de formato, no de contenido.

### 4.3 Calidad OCR como puerta previa a NER

El pipeline ahora calcula score y estado de calidad OCR (`good`/`poor`) y decide una única repetición controlada cuando la calidad inicial compromete extracción posterior.

### 4.4 Persistencia con validación de dominio

Antes de construir payload de `AcademicProduct`, la metadata específica pasa por validación por subtipo. Esto reduce errores silenciosos como fechas cronológicamente imposibles.

## 5. Artefactos desarrollados

### 5.1 Nuevos módulos

| Archivo                                              | Responsabilidad                                             |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| `server/services/ner/semantic-validation.ts`         | Normalización y penalización semántica de metadatos comunes |
| `server/services/ocr/quality-gates.ts`               | Evaluación de calidad OCR y score de decisión               |
| `server/services/ner/product-specific-validation.ts` | Validación post-extracción por subtipo                      |
| `tests/evals/ner-field-evals.test.ts`                | Arnés de evaluación por campo                               |
| `tests/evals/fixtures/ner-golden-set.json`           | Set baseline de evaluación                                  |

### 5.2 Archivos reforzados

| Archivo                                                       | Cambios clave                                                                            |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `server/services/ner/extract-academic-entities.ts`            | strict schemas, parse explícito, retry policy, confianza calibrada, telemetría extendida |
| `server/services/upload/process-uploaded-file.ts`             | quality gate OCR, retry, validación de metadata específica antes de persistir            |
| `tests/unit/server/extract-academic-entities.test.ts`         | cobertura de strictness, saneamiento, retry por schema                                   |
| `tests/integration/process-uploaded-file.integration.test.ts` | cobertura de quality gate OCR y post-validación de patente                               |
| `package.json`                                                | script de evaluación dedicado `test:eval:ner`                                            |
| `README.md`                                                   | runbook operativo de triage OCR/NER                                                      |

## 6. Flujo reforzado de extremo a extremo

1. OCR genera texto y metadatos de proveedor.
2. Quality gate OCR evalúa score y decide aceptar o reintentar una vez.
3. Clasificación documental determina `documentClassification` y `productType`.
4. NER común ejecuta con fallback por candidatos.
5. Si hay falla de esquema, se aplica `schema_tight_retry` en el mismo candidato.
6. Si la confianza global cae bajo umbral, se ejecuta segundo pase inferencial.
7. Se aplica validación semántica y se recalibra `extractionConfidence`.
8. Se extrae metadata específica por subtipo.
9. Se valida metadata específica de dominio antes de persistencia.
10. Se persiste producto académico con trazabilidad completa de decisión.

## 7. Validación técnica ejecutada

Se validó el cambio con suites enfocadas:

- `pnpm exec vitest --run tests/unit/server/extract-academic-entities.test.ts`
- `pnpm exec vitest --run tests/integration/process-uploaded-file.integration.test.ts`
- `pnpm exec vitest --run tests/evals/ner-field-evals.test.ts`

Resultado observado en esta iteración: todas las pruebas en verde en los tres niveles (unit, integration, eval).

## 8. Incidencia detectada y corrección aplicada

Durante la revisión posterior a formateo se detectó error de tipado en IDE dentro de la estrategia de reintentos NER:

- archivo afectado: `server/services/ner/extract-academic-entities.ts`
- síntoma: `strategy is possibly undefined`
- causa raíz: acceso por índice dinámico en array de estrategias con crecimiento durante iteración
- corrección: guard clause con `candidateStrategies.at(strategyIndex)` y verificación explícita antes de uso
- estado final: error eliminado en revisión de problemas del archivo

## 9. Limitaciones y trabajo pendiente

- El eval baseline actual es pequeño y debe crecer con casos reales de producción y correcciones humanas.
- La calibración de confianza es heurística; requiere ajuste continuo con datos reales.
- La validación específica por subtipo puede ampliarse con más reglas cruzadas de consistencia temporal y de formato.

## 10. Conclusión técnica

El refuerzo implementado eleva el pipeline de una extracción funcional a una arquitectura de extracción gobernada por calidad y evidencia. Se introdujeron controles previos, durante y posteriores a la extracción, con trazabilidad suficiente para diagnóstico operativo y mejora continua. El sistema queda mejor preparado para reducir metadatos inválidos persistidos y para escalar ajustes basados en evaluación objetiva.
