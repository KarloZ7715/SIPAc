# SIPAc — Sistema Inteligente de Productividad Académica

## Descripción del Sistema

---

## Control de Versiones

| Versión | Fecha      | Autor                     | Descripción del cambio                                                                                                                                                                                                                                                     |
| ------- | ---------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-02-09 | Carlos A. Canabal Cordero | Versión inicial — descripción general del sistema, alcance y stakeholders                                                                                                                                                                                                  |
| 1.1     | 2026-02-27 | Carlos A. Canabal Cordero | Revisión completa — alineación con stack tecnológico final, eliminación de referencias obsoletas                                                                                                                                                                           |
| 1.2     | 2026-03-04 | Carlos A. Canabal Cordero | Simplificación a 2 roles (`admin`, `docente`), eliminación de roles `coordinador` y `estudiante`, nuevo módulo M9 — Chat Inteligente con IA, almacenamiento de archivos en MongoDB GridFS, eliminación del flujo de verificación/aprobación, actualización de stakeholders |
| 1.3     | 2026-03-06 | Carlos A. Canabal Cordero | Alineación a los cambios de la arquitectura: adición de @nuxt/ui en stack UI, @ai-sdk/vue instalada como dependencia                                                                                                                                                       |

---

## 1. Qué es SIPAc

**SIPAc** (Sistema Inteligente de Productividad Académica) es una plataforma web fullstack que automatiza la gestión, extracción y análisis de la producción intelectual de los docentes de la **Maestría en Innovación Educativa con Tecnología e Inteligencia Artificial** de la Universidad de Córdoba (Colombia).

El sistema aplica **OCR** (Reconocimiento Óptico de Caracteres) y **NER** (Named Entity Recognition) para extraer metadatos estructurados desde documentos académicos probatorios (PDFs e imágenes), eliminando la transcripción manual y garantizando consistencia, trazabilidad y disponibilidad de evidencias para procesos de acreditación institucional. Además, incorpora un **chat inteligente** que permite a los usuarios buscar y explorar los documentos almacenados mediante consultas en lenguaje natural.

Se desarrolla como proyecto de **pasantía de grado** del Programa de Ingeniería de Sistemas, Semestre 2026-I (febrero–mayo 2026).

---

## 2. Problema que Resuelve

La productividad académica del programa se materializa en artículos, ponencias, tesis, certificados y proyectos de investigación. La gestión actual presenta:

- **Captura manual dispersa** — los integrantes transcriben metadatos a mano desde PDFs y certificados escaneados, generando errores e inconsistencias.
- **Fragmentación de información** — evidencias dispersas en carpetas personales, correos y repositorios desarticulados, sin consolidación.
- **Ausencia de extracción inteligente** — no existe un sistema que identifique automáticamente autores, títulos, DOI, indexaciones, fechas o instituciones desde los documentos.
- **Sin analítica institucional** — no hay dashboard que permita visualizar indicadores de productividad, tendencias temporales ni distribución por tipo de producto.

Estas carencias dificultan los procesos de autoevaluación y acreditación ante el CNA (Consejo Nacional de Acreditación), que exigen evidencias cuantificables y organizadas.

---

## 3. Contexto Institucional

El proyecto responde a recomendaciones del proyecto de investigación **FINV-012**: _"Cambios en la cultura institucional desde el aprendizaje individual y colectivo a partir de experiencias investigativas en instituciones educativas del departamento de Córdoba"_, que concluyó:

> _"Las tecnologías de mediación digital pueden convertirse en infraestructura de memoria y aprendizaje colectivo"_ y que se requieren _"sistemas de gestión del conocimiento desde los modelos de formación en investigación."_

| Dato                | Valor                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| **Autor**           | Carlos Alberto Canabal Cordero                                            |
| **Tutor docente**   | Daniel José Salas Álvarez                                                 |
| **Tutores empresa** | Martha Cecilia Pacheco Lora y Raúl Emiro Toscano Miranda                  |
| **Institución**     | Universidad de Córdoba — Facultad de Ingenierías — Ingeniería de Sistemas |
| **Período**         | Semestre 2026-I — Semanas 1 a 9 (febrero–abril 2026)                      |

---

## 4. Alcance Funcional

| Módulo                             | Descripción                                                                                                                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M1 — Autenticación y roles**     | Registro, login JWT, gestión de usuarios y 2 roles (`admin`, `docente`)                                                                                                     |
| **M2 — Carga de documentos**       | Upload de PDFs e imágenes (JPG/PNG) con validación MIME, límite de 20 MB, almacenamiento en MongoDB GridFS y tracking de estado                                             |
| **M3 — OCR**                       | Extracción de texto: `pdfjs-dist` para PDFs nativos, Gemini 2.0 Flash Vision para escaneados/imágenes                                                                       |
| **M4 — NER**                       | Extracción de entidades académicas vía `generateObject` (Vercel AI SDK) + esquemas Zod                                                                                      |
| **M5A — Repositorio estructurado** | CRUD de productos académicos con discriminator pattern, filtros por tipo/usuario/año y full-text search                                                                     |
| **M5B — Dashboard analítico**      | Indicadores de productividad, gráficas interactivas, exportación de reportes PDF/Excel                                                                                      |
| **M6 — Perfil de usuario**         | Consulta y edición de datos personales, cambio de contraseña                                                                                                                |
| **M7 — Seguridad y auditoría**     | Sanitización de inputs, log de auditoría inmutable, rate limiting                                                                                                           |
| **M8 — Notificaciones**            | Alertas en interfaz y correo electrónico sobre estado de procesamiento                                                                                                      |
| **M9 — Chat Inteligente**          | Búsqueda conversacional de documentos académicos mediante IA (Gemini) con consultas en lenguaje natural sobre metadatos, historial de conversaciones y enlaces a documentos |

---

## 5. Productos Académicos Gestionados

| Tipo (`productType`) | Campos específicos clave                                           |
| -------------------- | ------------------------------------------------------------------ |
| `article`            | Revista, volumen, ISSN, DOI, indexación (Scopus, WoS, SciELO)      |
| `conference_paper`   | Evento, ciudad, país, tipo de presentación (oral, poster, keynote) |
| `thesis`             | Nivel (maestría, doctorado), director, facultad, URL repositorio   |
| `certificate`        | Entidad emisora, tipo (participación, ponente, asistencia), horas  |
| `research_project`   | Código, fuente de financiación, estado, co-investigadores          |

---

## 6. Stack Tecnológico (resumen)

| Capa                       | Tecnologías principales                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| **UI**                     | Nuxt 4 (SSR) + Vue 3 + TypeScript 5 + @nuxt/ui 4 + TailwindCSS 4 + Pinia                   |
| **Backend**                | Nuxt Server Routes (`/server/api`) + H3 Multipart + JWT (`jose`) + bcrypt                  |
| **Base de datos**          | MongoDB + Mongoose ODM (discriminator pattern)                                             |
| **OCR (PDF nativo)**       | `pdfjs-dist` — extracción local sin API                                                    |
| **OCR (escaneado/imagen)** | Gemini 2.0 Flash Vision (Vercel AI SDK) — free tier 1.500 req/día                          |
| **NER**                    | `generateObject` (Vercel AI SDK) + Zod → objetos TypeScript tipados                        |
| **OCR opcional**           | Mistral OCR 3 — activable vía `OCR_PROVIDER=mistral` en `.env`                             |
| **Chat IA**                | `streamText` + tool calling (Vercel AI SDK) + Gemini 2.0 Flash + `useChat` (`@ai-sdk/vue`) |
| **Almacenamiento**         | MongoDB GridFS — archivos almacenados directamente en la base de datos                     |
| **DevOps**                 | MongoDB Atlas (cloud) + pnpm + Git/GitHub                                                  |

> Arquitectura de **servicio único** — un solo lenguaje (TypeScript), un solo proceso (Node.js), un solo despliegue.

---

## 7. Partes Interesadas

| Rol               | Tipo                 | Relación con el sistema                                                                                                                 |
| ----------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Docente**       | Usuario principal    | Carga y gestiona producción académica, consulta el repositorio de todos los usuarios, accede al dashboard analítico, usa el chat con IA |
| **Administrador** | Usuario técnico      | Gestiona usuarios, roles, configuración, mantenimiento y log de auditoría                                                               |
| **Comité CNA**    | Beneficiario externo | Recibe reportes e indicadores generados por el sistema (sin acceso directo)                                                             |

---

## 8. Objetivos Específicos del Plan de Pasantía

| Código   | Objetivo                                                                                      |
| -------- | --------------------------------------------------------------------------------------------- |
| **OE-1** | Desarrollar un sistema de captura de productividad con OCR y NLP para extracción de metadatos |
| **OE-2** | Implementar un repositorio estructurado y dashboard analítico de indicadores                  |
| **OE-3** | Garantizar infraestructura funcional del sistema (autenticación, seguridad, despliegue)       |

---

## 9. Restricciones

| Restricción              | Valor                                           |
| ------------------------ | ----------------------------------------------- |
| Framework obligatorio    | Nuxt 4                                          |
| Base de datos            | MongoDB con Mongoose ODM                        |
| Idioma de los documentos | Español                                         |
| Gestor de paquetes       | pnpm                                            |
| Período de desarrollo    | 9 semanas — Semestre 2026-I (febrero–mayo 2026) |

---

## 10. Documentación Relacionada

| Documento                    | Ruta                                                              |
| ---------------------------- | ----------------------------------------------------------------- |
| Plan de Pasantía             | `docs/PlanPasantíaMaestríaInnovación.md`                          |
| Requisitos funcionales (SRS) | `docs/analisis-diseno/documentacion/02-requisitos-funcionales.md` |
| Arquitectura técnica         | `docs/analisis-diseno/documentacion/03-arquitectura-tecnica.md`   |
| Modelo de datos              | `docs/analisis-diseno/documentacion/04-modelo-datos.md`           |
