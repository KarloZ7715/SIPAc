# Evidencia de Desarrollo — Estrategia Multi-Proveedor LLM (Cerebras + Gemini Fallback)

| Campo                   | Valor                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Proyecto**            | SIPAc — Sistema Inteligente de Productividad Académica                                                                  |
| **Institución**         | Universidad de Córdoba, Montería, Colombia                                                                              |
| **Componente**          | Rediseño de la capa de procesamiento inteligente — estrategia multi-proveedor LLM para M4 (NER) y M9 (Chat IA)          |
| **Autor**               | Carlos A. Canabal Cordero                                                                                               |
| **Fecha**               | 2026-03-07                                                                                                              |
| **Versión**             | 1.0                                                                                                                     |
| **Estado**              | Decisión arquitectónica documentada — pendiente de implementación en código                                             |
| **Objetivo del avance** | Definir y documentar la estrategia de distribución de carga entre proveedores LLM gratuitos para NER y Chat Inteligente |

---

## 1. Propósito de la evidencia

Esta evidencia registra una decisión arquitectónica de alto impacto sobre la estrategia de proveedores de modelos de lenguaje (LLM) para los módulos M4 (NER — Extracción de Entidades) y M9 (Chat Inteligente). El cambio surge del análisis de resiliencia del sistema ante uso concurrente: un único proveedor LLM (Gemini 2.5 Flash) representa un punto de falla para un sistema multiusuario académico si se concentra toda la carga en un solo proveedor.

La decisión introduce **Cerebras Inference** como proveedor LLM primario para NER y Chat, con **Gemini 2.5 Flash** como fallback automático ante errores de rate limit (HTTP 429) o indisponibilidad. Esta estrategia distribuye la carga entre dos proveedores de alta calidad sin incrementar innecesariamente el costo operativo durante la fase de pasantía.

---

## 2. Contexto y motivación

### 2.1 Problema identificado

El diseño original de SIPAc utilizaba **Gemini 2.5 Flash** como único proveedor LLM para:

- **M4 — NER:** `generateObject` + esquema Zod para extracción de metadatos académicos
- **M9 — Chat IA:** `streamText` + tool calling para búsqueda conversacional de documentos

Este enfoque tiene una limitación crítica para el contexto de uso del sistema: la Maestría en Innovación Educativa con Tecnología e IA cuenta con múltiples docentes que podrían cargar documentos simultáneamente. En ese escenario, concentrar OCR, NER y Chat en un solo proveedor aumenta el riesgo de saturar límites de uso, degradar disponibilidad o depender de cambios de cuota ajenos al sistema.

### 2.2 Solución propuesta

La solución adoptada es una arquitectura **multi-proveedor con fallback automático**:

| Capa              | Proveedor primario                                     | Fallback automático      |
| ----------------- | ------------------------------------------------------ | ------------------------ |
| M4 — NER          | Cerebras `gpt-oss-120b` (producción)                   | Gemini 2.5 Flash         |
| M9 — Chat         | Cerebras `gpt-oss-120b` (producción)                   | Gemini 2.5 Flash         |
| M3 — OCR imágenes | Gemini 2.5 Flash (único con visión en el stack actual) | Mistral OCR 3 (opcional) |

El OCR de imágenes y PDFs escaneados **no cambia**: Cerebras no ofrece capacidad multimodal/visión, por lo que Gemini 2.5 Flash sigue siendo el proveedor multimodal del stack para M3.

---

## 3. Cerebras Inference — Proveedor seleccionado

### 3.1 Por qué Cerebras

Cerebras Inference es una plataforma de inferencia de modelos LLM que opera sobre hardware de silicio especializado (Cerebras Wafer-Scale Engine), lo que le permite ofrecer velocidades de inferencia significativamente superiores a las plataformas convencionales. Sus características principales relevantes para SIPAc:

- **API 100% compatible con OpenAI:** La API de Cerebras (`https://api.cerebras.ai/v1`) implementa la misma interfaz que OpenAI. Esto permite integrarla con el Vercel AI SDK usando el paquete `@ai-sdk/openai-compatible` sin necesidad de un SDK propietario ni cambios en la lógica de negocio existente.
- **Free tier sin restricciones de alta demanda en modelos de producción:** Los modelos marcados como `Production` tienen cuotas normales, a diferencia de los modelos `Preview` que están temporalmente limitados.
- **Soporte de structured outputs y tool calling:** Ambas capacidades son requeridas por SIPAc — `generateObject` (NER) depende de structured outputs, y el chat (M9) depende de tool calling.

### 3.2 Catálogo de modelos Cerebras (estado actual: 2026-03)

| Nombre comercial         | Model ID                         | Tier       | Parámetros | Velocidad    | Estado en SIPAc                                     |
| ------------------------ | -------------------------------- | ---------- | ---------- | ------------ | --------------------------------------------------- |
| **OpenAI GPT OSS**       | `gpt-oss-120b`                   | Producción | 120B       | ~3.000 tok/s | ✅ **Activo por defecto** — NER + Chat IA           |
| **Qwen 3 235B Instruct** | `qwen-3-235b-a22b-instruct-2507` | Preview    | 235B MoE   | ~1.400 tok/s | ⚠️ Rate limit reducido                              |
| **Z.ai GLM 4.7**         | `zai-glm-4.7`                    | Preview    | 355B       | ~1.000 tok/s | ⚠️ Rate limit reducido                              |
| **Llama 3.1 8B**         | `llama3.1-8b`                    | Producción | 8B         | ~2.200 tok/s | Reserva — menor capacidad de reasoning estructurado |

> **Nota sobre modelos Preview:** Qwen 3 235B y Z.ai GLM 4.7 tienen el free tier temporalmente reducido por alta demanda según la documentación oficial de Cerebras (2026-03). `gpt-oss-120b` es el modelo de producción estable recomendado para uso inmediato. Cuando Qwen 3 235B se estabilice, se priorizará para NER por su mayor capacidad en extracción estructurada en español.

### 3.3 Justificación de la selección de modelos

**`gpt-oss-120b` para NER y Chat (default):**

- Modelo en tier de **producción** — disponible sin restricciones de alta demanda
- 120B parámetros con ~3.000 tokens/s: suficiente capacidad de razonamiento estructurado para extracción de metadatos académicos y tool calling en chat
- Soporta structured outputs requeridos por `generateObject` del Vercel AI SDK

**`qwen-3-235b-a22b-instruct-2507` para NER (futuro preferido):**

- 235B parámetros MoE con mejoras documentadas en instrucción estructurada, razonamiento lógico y codificación
- Mayor capacidad multilingüe — relevante para documentos académicos en español con terminología técnica
- Se activará como modelo preferido para NER mediante variable de entorno cuando el modelo salga de Preview con cuotas normales

---

## 4. Decisión de integración técnica

### 4.1 Paquete de integración

La integración de Cerebras con el Vercel AI SDK se realiza mediante el paquete oficial `@ai-sdk/openai-compatible`:

```typescript
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

export const cerebras = createOpenAICompatible({
  name: 'cerebras',
  apiKey: process.env.CEREBRAS_API_KEY,
  baseURL: 'https://api.cerebras.ai/v1',
})

// Uso idéntico al de cualquier otro proveedor del AI SDK:
const model = cerebras('gpt-oss-120b')
```

Este enfoque tiene ventajas clave sobre usar el SDK oficial de Node.js de Cerebras:

1. **Cero fricciones de integración:** El Vercel AI SDK ya está en el proyecto; no se añade un framework nuevo
2. **API uniforme:** `generateObject`, `streamText` y `streamObject` funcionan idéntico independientemente del proveedor
3. **Fallback trivial:** Cambiar de proveedor es cambiar una sola referencia de modelo

### 4.2 Patrón de fábrica `LLMProvider`

Se define una abstracción `LLMProvider` en `server/services/llm/` análoga al `OCRProvider` ya documentado:

```typescript
// server/services/llm/types.ts
import type { LanguageModel } from 'ai'

export interface LLMProvider {
  readonly name: string
  getModel(modelId?: string): LanguageModel
  getStreamingModel(modelId?: string): LanguageModel
}
```

La fábrica selecciona el proveedor según variables de entorno con lógica de fallback automático:

```typescript
// server/services/llm/factory.ts
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { google } from '@ai-sdk/google'
import type { LLMProvider } from './types'

export const cerebras = createOpenAICompatible({
  name: 'cerebras',
  apiKey: process.env.CEREBRAS_API_KEY,
  baseURL: 'https://api.cerebras.ai/v1',
})

export function createLLMProvider(task: 'ner' | 'chat'): LLMProvider {
  const envKey = task === 'ner' ? 'LLM_NER_PROVIDER' : 'LLM_CHAT_PROVIDER'
  const selected = process.env[envKey] ?? 'cerebras'
  if (selected === 'cerebras') return new CerebrasLLMProvider()
  return new GeminiLLMProvider()
}
```

El fallback automático se implementa en la capa de servicio llamadora:

```typescript
// Patrón de fallback en el servicio NER
async function extractEntities(text: string, schema: ZodSchema) {
  try {
    const provider = createLLMProvider('ner')
    return await generateObject({ model: provider.getModel(), schema, prompt: text })
  } catch (error) {
    if (isRateLimitError(error)) {
      // Fallback automático a Gemini 2.5 Flash
      const fallback = new GeminiLLMProvider()
      return await generateObject({ model: fallback.getModel(), schema, prompt: text })
    }
    throw error
  }
}
```

### 4.3 Variables de entorno

Las nuevas variables de entorno requeridas para la estrategia multi-proveedor son:

```
# Obligatorias (ya existía GEMINI_API_KEY — se añade CEREBRAS_API_KEY)
GEMINI_API_KEY=...           # Google AI Studio
CEREBRAS_API_KEY=...         # Cerebras Cloud (https://cloud.cerebras.ai)

# Selección de proveedores (opcionales — defaults indicados)
LLM_NER_PROVIDER=cerebras    # cerebras | gemini
LLM_CHAT_PROVIDER=cerebras   # cerebras | gemini
OCR_PROVIDER=gemini          # gemini | mistral (sin cambio)
```

---

## 5. Alcance de los cambios documentales realizados

### 5.1 Documentos actualizados en esta evidencia

| Documento                                                              | Cambios aplicados                                                                                                                                                                                                 |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/analisis-diseno/documentacion/03-arquitectura-tecnica.md` (v1.4) | Control de versiones, diagrama de arquitectura general, sección 2.3 (stack), ADR-09, flowchart de procesamiento, sección 5 expandida, sección 7 (directorios), sección 8 (herramientas), sección 9 (resoluciones) |
| `docs/analisis-diseno/documentacion/01-descripcion-sistema.md` (v1.4)  | Control de versiones, tabla de módulos M9, tabla de stack tecnológico                                                                                                                                             |

### 5.2 Cambios documentales por sección

**`03-arquitectura-tecnica.md`:**

| Sección                         | Cambio                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Control de versiones            | Versión 1.4 añadida                                                                                                     |
| §1 — Diagrama de arquitectura   | Nodos `CerebrasPrimary` y `GeminiFallback` reemplazan a `GeminiText`/`GeminiChat`; aristas de fallback punteadas        |
| §2.3 — Stack: capa inteligente  | Añadidos: `@ai-sdk/openai-compatible`, `Cerebras GPT-OSS 120B`, `Cerebras Qwen 3 235B`, Gemini renombrado como fallback |
| §3 — ADRs                       | Nuevo ADR-09 sobre estrategia multi-proveedor LLM                                                                       |
| §4 — Flowchart de procesamiento | Paso NER actualizado con bifurcación por `LLM_NER_PROVIDER` y fallback automático                                       |
| §5 — Estrategia de proveedores  | Sección expandida: §5.1 OCRProvider (sin cambio funcional), §5.2 LLMProvider (nuevo), §5.3 Plan de costos y env vars    |
| §7 — Estructura de directorios  | Añadido `server/services/llm/` para la fábrica multi-proveedor                                                          |
| §8 — Herramientas               | Añadidos: `@ai-sdk/openai-compatible`, Cerebras Inference API                                                           |
| §9 — Decisiones resueltas       | Nota de rate limiting actualizada para reflejar distribución multi-proveedor                                            |

---

## 6. Impacto en módulos del sistema

| Módulo         | Impacto                                                                                          | Estado de implementación |
| -------------- | ------------------------------------------------------------------------------------------------ | ------------------------ |
| M3 — OCR       | Sin cambio funcional. Gemini Vision sigue siendo el único proveedor para imágenes/escaneados     | Pendiente (sin cambio)   |
| M4 — NER       | Proveedor LLM cambia de Gemini exclusivo a Cerebras primario + Gemini fallback vía `LLMProvider` | Pendiente                |
| M9 — Chat IA   | Proveedor LLM cambia de Gemini exclusivo a Cerebras primario + Gemini fallback vía `LLMProvider` | Pendiente                |
| M7 — Seguridad | El log de auditoría debe registrar el proveedor efectivamente usado y si se activó el fallback   | Pendiente (ajuste menor) |
| Otros módulos  | Sin impacto                                                                                      | —                        |

---

## 7. Relación con requisitos y objetivos del proyecto

| Área                  | Relación con este avance                                                                                   | Estado           |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------- |
| OE-1 (OCR y NLP)      | Fortalece la capa de NER y Chat con proveedor de mayor disponibilidad y velocidad                          | Mejora en diseño |
| RNF de disponibilidad | Introducir fallback automático reduce el riesgo de indisponibilidad del servicio de extracción inteligente | Mejora directa   |
| RNF de escalabilidad  | Distribución de carga entre dos proveedores gratuitos aumenta el número de solicitudes diarias soportadas  | Mejora directa   |
| RNF de mantenibilidad | Patrón fábrica `LLMProvider` facilita añadir nuevos proveedores sin modificar lógica de negocio            | Mejora directa   |

---

## 8. Dependencias y paquetes nuevos requeridos

| Paquete                     | Versión | Razón                                                               | Instalación                          |
| --------------------------- | ------- | ------------------------------------------------------------------- | ------------------------------------ |
| `@ai-sdk/openai-compatible` | latest  | Conectar Vercel AI SDK a Cerebras Inference (API OpenAI-compatible) | `pnpm add @ai-sdk/openai-compatible` |

> El paquete `@ai-sdk/google` (ya instalado) y `ai` (ya instalado) no requieren cambio de versión. No se añade el SDK oficial de Cerebras para Node.js — la integración es vía la interfaz OpenAI estándar.

---

## 9. Limitaciones y trabajo pendiente

- La implementación de `server/services/llm/` (tipos, fábrica, providers concretos) queda **pendiente** para la semana 5 del cronograma, cuando se aborden los módulos M3 y M4 de OCR y NER.
- La capacidad de structured outputs (`generateObject`) con `gpt-oss-120b` en Cerebras debe validarse durante el desarrollo de M4 con documentos reales del programa.
- La lógica de fallback automático (detección de error 429 vs. error genérico) debe implementarse cuidadosamente para evitar llamadas duplicadas que aumenten latencia.
- La variable `CEREBRAS_API_KEY` debe obtenerse en `https://cloud.cerebras.ai` y añadirse al archivo `.env` local y a los secretos de GitHub Actions antes de implementar M4.
- Qwen 3 235B (`qwen-3-235b-a22b-instruct-2507`) queda como **modelo diferido**: se activará cuando Cerebras lo promueva de Preview a producción con cuotas normales, configurando `LLM_NER_PROVIDER=cerebras` con el nuevo model ID.

---

## 10. Conclusión técnica

La decisión de adoptar una estrategia multi-proveedor LLM para SIPAc representa una mejora significativa en la resiliencia y escalabilidad del sistema sin incrementar su complejidad operativa ni sus costos. La compatibilidad de Cerebras con la interfaz OpenAI, combinada con el paquete `@ai-sdk/openai-compatible` del Vercel AI SDK, permite integrar el nuevo proveedor de forma transparente usando las mismas primitivas (`generateObject`, `streamText`) ya previstas en la arquitectura original.

El patrón fábrica `LLMProvider` — análogo al `OCRProvider` ya definido — garantiza que la lógica de negocio de NER y Chat permanezca completamente desacoplada del proveedor concreto. Esto habilita no solo el fallback entre Cerebras y Gemini, sino también la futura incorporación de otros proveedores OpenAI-compatibles sin modificaciones en los servicios de dominio.

Desde el punto de vista del proyecto de pasantía, esta decisión demuestra pensamiento proactivo sobre resiliencia de sistemas reales, anticipando limitaciones de rate limiting que serían críticas en un sistema multiusuario institucional.
