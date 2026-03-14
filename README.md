# SIPAc — Sistema Inteligente de Productividad Académica

Sistema de gestión, extracción y análisis de la producción intelectual de docentes y estudiantes de la Maestría en Innovación Educativa con Tecnología e IA — Universidad de Córdoba, Colombia.

Proyecto de pasantía profesional (Semestre 2026-I).

---

## Qué hace

SIPAc automatiza un proceso que hoy es completamente manual: capturar, clasificar y analizar los productos académicos de un programa de posgrado. El docente sube un PDF o imagen de su artículo, ponencia, tesis o certificado, y el sistema:

1. **Extrae el texto** del documento (OCR con Gemini Vision para escaneados, `pdfjs-dist` para PDFs nativos)
2. **Identifica entidades** académicas automáticamente (autores, título, DOI, revista, indexación, etc.) usando NER con `generateText` + `Output.object` + Zod
3. **Permite revisión humana** de los metadatos extraídos antes de almacenar
4. **Organiza un repositorio** estructurado con filtros, búsqueda full-text y control por roles
5. **Genera un dashboard** analítico con indicadores de productividad y exportación de reportes

### Fallback LLM vigente

- **NER (implementado):** `gemini-2.5-flash` -> `openai/gpt-oss-120b` (Groq) -> `gemini-2.5-flash-lite` -> `openai/gpt-oss-20b` (Groq)
- **Chat (planificado en M9):** `gpt-oss-120b` (Cerebras) -> `gemini-2.5-flash` -> `qwen-3-235b-a22b-instruct-2507` (Cerebras)
- **Nota de compatibilidad:** para structured outputs se usa esquema estricto (campos requeridos y `null` explicito cuando aplica) para evitar errores de `response_format` en proveedores OpenAI-compatible

---

## Stack

| Capa          | Tecnología                                         |
| ------------- | -------------------------------------------------- |
| Framework     | Nuxt 4 · Vue 3 · TypeScript 5                      |
| UI            | @nuxt/ui 4 · Tailwind CSS 4                        |
| Estado        | Pinia                                              |
| Base de datos | MongoDB (Atlas) · Mongoose ODM                     |
| Auth          | JWT (jose) · bcrypt                                |
| OCR           | pdfjs-dist · Gemini 2.5 Flash · Mistral OCR        |
| NER           | Vercel AI SDK · generateText + Output.object + Zod |
| LLM providers | Google Gemini · Groq (NER) · Cerebras (Chat M9)    |
| Testing       | Vitest · @nuxt/test-utils · Playwright             |
| Calidad       | ESLint · Prettier · Husky · commitlint             |

---

## Desarrollo

```bash
pnpm dev
```

El servidor arranca en `http://localhost:3000`.

### Variables de entorno IA (resumen)

- `GOOGLE_API_KEY`: requerido para OCR multimodal y candidatos Gemini en fallback
- `GROQ_API_KEY`: habilita candidatos Groq en NER (`openai/gpt-oss-120b`, `openai/gpt-oss-20b`)
- `CEREBRAS_API_KEY`: habilita candidatos Cerebras para chat (M9)
- `OCR_PROVIDER`: `gemini` (default) o `mistral`
- `NER_REQUEST_TIMEOUT_MS`, `NER_MAX_CANDIDATE_ATTEMPTS`, `NER_CONFIDENCE_THRESHOLD`: control operativo del pipeline NER

### Scripts disponibles

| Comando              | Descripción                              |
| -------------------- | ---------------------------------------- |
| `pnpm dev`           | Servidor de desarrollo con HMR           |
| `pnpm build`         | Build de producción                      |
| `pnpm preview`       | Preview del build de producción          |
| `pnpm generate`      | Generación estática (SSG)                |
| `pnpm lint`          | Ejecutar ESLint                          |
| `pnpm lint:fix`      | Corregir errores de lint automáticamente |
| `pnpm format`        | Formatear código con Prettier            |
| `pnpm format:check`  | Verificar formato sin modificar          |
| `pnpm typecheck`     | Verificación de tipos TypeScript         |
| `pnpm test`          | Tests unitarios/integración con Vitest   |
| `pnpm test:watch`    | Tests en modo watch                      |
| `pnpm test:e2e`      | Tests end-to-end con Playwright          |
| `pnpm test:e2e:ui`   | Tests E2E con interfaz de Playwright     |
| `pnpm test:coverage` | Tests con reporte de cobertura           |

---

## Estructura del proyecto

### Árbol de directorios

```
├── server/                          # Código exclusivo del servidor (Nuxt / Node.js)
│   ├── api/                         # API Routes REST
│   │   ├── auth/                    # login, logout, me, register
│   │   ├── profile/                 # perfil, cambio de contraseña
│   │   ├── users/                   # CRUD usuarios
│   │   ├── dashboard/
│   │   ├── notifications/
│   │   ├── products/
│   │   └── upload/
│   ├── middleware/                  # Auth: JWT en cookie httpOnly
│   ├── models/                      # Mongoose: User, AuditLog
│   ├── services/                    # OCR, NER, Storage (preparados)
│   ├── plugins/                     # MongoDB, seed de admin
│   └── utils/                       # JWT, authorize, schemas Zod, audit, errors
│
├── app/                             # Aplicación cliente (Nuxt app directory)
│   ├── app.vue
│   ├── app.config.ts                # @nuxt/ui, design tokens SIPAc
│   ├── assets/css/main.css          # Estilos globales, paleta, utilidades
│   ├── components/
│   │   ├── layout/                  # AppHeader, AppSidebar
│   │   ├── sipac/                   # SipacBadge, SipacButton, SipacCard, etc.
│   │   ├── dashboard/
│   │   ├── forms/
│   │   └── ui/
│   ├── composables/                # useAuth, etc.
│   ├── layouts/                    # default (sidebar + header)
│   ├── middleware/                 # auth.global, admin
│   ├── pages/                      # index, login, register, profile, admin/users
│   ├── stores/                     # Pinia: auth, users
│   ├── types/                      # Tipos TS del dominio (user, api, product, …)
│   └── utils/                     # Utilidades cliente
│
├── tests/                          # Tests unitarios e integración (Vitest)
├── e2e/                            # Tests end-to-end (Playwright)
├── docs/                           # Documentación
│   ├── analisis-diseno/            # Especificación, diagramas UML, evidencias
│   └── evidencias/
│
├── public/                         # Archivos estáticos
├── nuxt.config.ts
├── package.json
├── vitest.config.ts
└── playwright.config.ts
```

### Resumen de carpetas

| Carpeta   | Descripción                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------------------------- |
| `server/` | API REST, middleware de auth, modelos Mongoose, servicios (OCR/NER/storage), plugins y utilidades de servidor. |
| `app/`    | UI Vue 3: componentes SIPAc y layout, páginas, stores Pinia, composables, tipos y estilos.                     |
| `tests/`  | Tests unitarios e integración con Vitest.                                                                      |
| `e2e/`    | Tests end-to-end con Playwright.                                                                               |
| `docs/`   | Documentación de análisis y diseño, diagramas y evidencias de pasantía.                                        |

---

## Documentación

Toda la documentación de análisis y diseño está en `docs/analisis-diseno/`:

- [Descripción del sistema](docs/analisis-diseno/documentacion/01-descripcion-sistema.md)
- [Requisitos funcionales (SRS IEEE 29148)](docs/analisis-diseno/documentacion/02-requisitos-funcionales.md)
- [Arquitectura técnica y ADRs](docs/analisis-diseno/documentacion/03-arquitectura-tecnica.md)
- [Modelo de datos MongoDB](docs/analisis-diseno/documentacion/04-modelo-datos.md)
- [Mapa de API Routes](docs/analisis-diseno/documentacion/05-api-routes.md)
- [Diagramas UML (PlantUML)](docs/analisis-diseno/diagramas/puml/)

---

## Autor

**Carlos Alberto Canabal Cordero**
Ingeniería de Sistemas — Universidad de Córdoba

Tutores: Daniel José Salas Álvarez (académico), Martha Cecilia Pacheco Lora y Raúl Emiro Toscano Miranda (empresa)
