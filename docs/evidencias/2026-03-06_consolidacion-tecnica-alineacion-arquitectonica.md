# Evidencia de Desarrollo — Consolidación Técnica y Alineación Arquitectónica

| Campo                   | Valor                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Proyecto**            | SIPAc — Sistema Inteligente de Productividad Académica                                                        |
| **Institución**         | Universidad de Córdoba, Montería, Colombia                                                                    |
| **Componente**          | Consolidación técnica del proyecto, tooling de calidad y alineación entre documentación y código real         |
| **Autor**               | Carlos A. Canabal Cordero                                                                                     |
| **Fecha**               | 2026-03-06                                                                                                    |
| **Versión**             | 1.0                                                                                                           |
| **Estado**              | Implementado parcialmente como base de ingeniería del proyecto                                                |
| **Objetivo del avance** | Alinear la arquitectura documentada con el estado real del sistema y consolidar su base técnica de desarrollo |

---

## 1. Propósito de la evidencia

Esta evidencia registra un avance que no introduce por sí mismo un módulo funcional nuevo para el usuario final, pero sí fortalece de forma directa la ingeniería del proyecto. El propósito es dejar trazabilidad de la consolidación técnica de SIPAc en su estado real: stack actualizado, estructura definitiva del monolito Nuxt, contratos tipados, configuración de seguridad, pipeline de calidad y documentación sincronizada con la implementación efectivamente existente.

Desde una perspectiva académica, esta evidencia es importante porque demuestra que el desarrollo no avanzó solo en funcionalidades visibles, sino también en la estabilización de la base técnica que soportará los módulos de documentos, OCR, NER, repositorio, dashboard, notificaciones y chat.

## 2. Alcance implementado

Se consolidaron los siguientes aspectos del proyecto:

- adopción explícita de la estructura `app/` + `server/` coherente con Nuxt 4,
- incorporación y configuración efectiva de `@nuxt/ui`, `Pinia`, `nuxt-security`, `Tailwind CSS 4` y `@ai-sdk/vue`,
- formalización de scripts de calidad, build, pruebas y formato en `package.json`,
- configuración inicial de integración continua en GitHub Actions,
- alineación documental del SRS, arquitectura técnica, modelo de datos y mapa de API Routes con el estado real del código,
- consolidación de contratos tipados del dominio en frontend y backend,
- preparación estructural de módulos futuros mediante directorios y tipos ya definidos,
- estandarización de validación, errores y configuración de entorno.

## 3. Relación con requisitos y objetivos del proyecto

Este avance es transversal y soporta especialmente los siguientes frentes:

| Área                            | Relación con este avance                                                              | Estado                     |
| ------------------------------- | ------------------------------------------------------------------------------------- | -------------------------- |
| OE-1                            | Prepara la base técnica para OCR, NER y procesamiento inteligente                     | Parcialmente preparado     |
| OE-2                            | Prepara la estructura de repositorio y dashboard en frontend, tipos y rutas           | Parcialmente preparado     |
| OE-3                            | Fortalece infraestructura funcional del sistema con seguridad, calidad y organización | Consolidado en base actual |
| RNF de mantenibilidad y calidad | Tipado, lint, format, build, CI y documentación alineada                              | Consolidado en base actual |

## 4. Decisiones técnicas relevantes

### 4.1 Alineación a la arquitectura real y no a una arquitectura aspiracional

Se actualizó la documentación para reflejar el sistema tal como está construido realmente. Esta decisión es metodológicamente importante porque evita una brecha entre el diseño escrito y la implementación efectiva, situación frecuente en proyectos académicos cuando la documentación queda desactualizada frente al código.

### 4.2 Monolito modular en TypeScript como eje de crecimiento

La consolidación del proyecto en Nuxt 4 con separación entre `app/` y `server/` permitió fijar una estructura única para interfaz, API, middleware, modelos, servicios y utilidades. Esta decisión facilita el crecimiento incremental del sistema sin fragmentar el despliegue ni multiplicar entornos de ejecución.

### 4.3 Calidad integrada desde scripts y CI

Se configuró una base de control de calidad compuesta por:

- ESLint,
- Prettier,
- Typecheck de Nuxt,
- Vitest con cobertura,
- Playwright para E2E,
- workflow de GitHub Actions.

La intención fue que la calidad deje de depender exclusivamente de validación manual local y comience a institucionalizarse como parte del flujo del proyecto.

### 4.4 Tipado y contratos como mecanismo de estabilidad

La definición de tipos compartidos y DTOs en `app/types` y de esquemas Zod en `server/utils/schemas` reduce ambigüedad entre cliente y servidor. Esto es especialmente relevante en SIPAc, donde la complejidad futura del dominio aumentará por tipos de productos académicos, OCR, metadatos y consultas inteligentes.

## 5. Artefactos consolidados

### 5.1 Configuración principal del proyecto

| Archivo                    | Responsabilidad                                                        |
| -------------------------- | ---------------------------------------------------------------------- |
| `package.json`             | Scripts, dependencias, herramientas de calidad y testing               |
| `nuxt.config.ts`           | Configuración de módulos, runtime config, seguridad y límites globales |
| `eslint.config.mjs`        | Reglas estáticas del proyecto                                          |
| `vitest.config.ts`         | Configuración base de pruebas unitarias e integración                  |
| `.github/workflows/ci.yml` | Pipeline de calidad e integración continua                             |

### 5.2 Contratos y tipado del dominio

| Archivo / Área             | Responsabilidad                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `app/types/*`              | Tipos compartidos del dominio de usuario, productos, auditoría, archivos y notificaciones |
| `server/utils/schemas/*`   | Validación de payloads y contratos de entrada del backend                                 |
| `server/utils/errors.ts`   | Estandarización de errores HTTP                                                           |
| `server/utils/response.ts` | Estandarización de respuestas exitosas                                                    |

### 5.3 Preparación estructural de módulos futuros

| Área                                                              | Estado actual                                        |
| ----------------------------------------------------------------- | ---------------------------------------------------- |
| `server/services/ocr/`                                            | Estructura preparada para proveedor OCR              |
| `server/services/ner/`                                            | Estructura preparada para extracción de entidades    |
| `server/services/storage/`                                        | Estructura preparada para almacenamiento de archivos |
| `server/api/dashboard/`, `notifications/`, `products/`, `upload/` | Directorios reservados para módulos posteriores      |
| `app/components/dashboard/`, `forms/`, `ui/`                      | Base preparada para ampliación de interfaz           |

## 6. Consolidación del flujo de desarrollo

### 6.1 Flujo local de ingeniería

1. El desarrollador instala dependencias con `pnpm`.
2. Ejecuta entorno de desarrollo con `pnpm dev`.
3. Valida calidad con `pnpm lint`, `pnpm format:check` y `pnpm typecheck`.
4. Ejecuta pruebas con Vitest y Playwright según corresponda.
5. El proyecto conserva una estructura única de frontend y backend bajo Nuxt 4.

### 6.2 Flujo de control de calidad automatizado

1. Un cambio llega a `push` o `pull_request`.
2. GitHub Actions instala dependencias y ejecuta lint.
3. El workflow ejecuta verificación de formato.
4. Se ejecuta `typecheck`.
5. Se corre Vitest con cobertura y tolerancia explícita a ausencia de pruebas en la fase actual.
6. Se valida build de producción.
7. En `push` a rama principal se reserva additionally una fase E2E con Playwright.

## 7. Evidencia técnica verificable

### 7.1 Stack efectivamente integrado

- Nuxt 4 y Vue 3 como framework principal.
- `@nuxt/ui` como base de componentes.
- Pinia para estado global.
- `nuxt-security` para endurecimiento y rate limiting global.
- `ai`, `@ai-sdk/google` y `@ai-sdk/vue` incorporados en la base del proyecto.
- `pdfjs-dist` y proveedor OCR previstos desde dependencias y arquitectura.

### 7.2 Calidad y automatización

- Scripts formales de build, lint, format, typecheck, unit tests, coverage y E2E.
- Workflow CI para ejecutar validaciones automáticamente.
- Integración de Husky, lint-staged y commitlint dentro de la base de desarrollo.

### 7.3 Coherencia documental lograda

- El SRS actualizado distingue mejor entre requisitos completados y pendientes.
- La arquitectura técnica refleja la estructura real del proyecto.
- El mapa de API Routes identifica con claridad qué endpoints están implementados y cuáles siguen pendientes.
- El modelo de datos se alinea con decisiones vigentes como GridFS, dos roles y flujo actual del sistema.

## 8. Resultados obtenidos

| Resultado                                         | Estado                         |
| ------------------------------------------------- | ------------------------------ |
| Estructura técnica del monolito Nuxt estabilizada | Operativa                      |
| Tooling base de calidad y formato                 | Operativo                      |
| Integración continua inicial                      | Operativa                      |
| Documentación técnica alineada con código real    | Operativa                      |
| Base lista para nuevos módulos                    | Operativa como infraestructura |

## 9. Validación realizada

- Revisión del `package.json` y de scripts disponibles para desarrollo y calidad.
- Verificación de configuración principal del proyecto en `nuxt.config.ts`.
- Verificación del workflow de CI y de su secuencia de validaciones.
- Revisión de la estructura de carpetas `app/` y `server/` y su correspondencia con la arquitectura documentada.
- Revisión del estado real de los endpoints implementados frente al mapa de API Routes.

## 10. Limitaciones y trabajo pendiente

- Ya existe una base de pruebas unitarias e integración para pipeline/OCR/NER, pero la cobertura aún no es homogénea entre módulos.
- El workflow usa `--passWithNoTests`, lo que evidencia una fase de preparación más que de cobertura madura.
- Esta evidencia corresponde al corte del 2026-03-06; a la fecha actual varios de esos módulos avanzaron (M2-M4 y M8), por lo que debe leerse junto a las evidencias de actualización de 2026-03-14.
- La existencia de dependencias y estructura para OCR, NER o chat no debe interpretarse como culminación de esos módulos.

## 11. Conclusión técnica

La consolidación técnica registrada en esta evidencia muestra un progreso importante en la madurez ingenieril de SIPAc. El proyecto no solo avanza en funciones aisladas, sino también en orden interno, calidad, documentación confiable y capacidad de evolución. Este tipo de avance es especialmente valioso porque demuestra disciplina técnica, trazabilidad entre diseño y código y preparación realista para etapas posteriores de implementación compleja.
