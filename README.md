# SIPAc — Sistema Inteligente de Productividad Académica

Sistema de gestión, extracción y análisis de la producción intelectual de docentes y estudiantes de la Maestría en Innovación Educativa con Tecnología e IA — Universidad de Córdoba, Colombia.

Proyecto de pasantía profesional (Semestre 2026-I).

---

## Qué hace

SIPAc automatiza un proceso que hoy es completamente manual: capturar, clasificar y analizar los productos académicos de un programa de posgrado. El docente sube un PDF o imagen de su artículo, ponencia, tesis o certificado, y el sistema:

1. **Extrae el texto** del documento (OCR con Gemini Vision para escaneados, `pdfjs-dist` para PDFs nativos)
2. **Identifica entidades** académicas automáticamente (autores, título, DOI, revista, indexación, etc.) usando NER con `generateObject` + Zod
3. **Permite revisión humana** de los metadatos extraídos antes de almacenar
4. **Organiza un repositorio** estructurado con filtros, búsqueda full-text y control por roles
5. **Genera un dashboard** analítico con indicadores de productividad y exportación de reportes

---

## Stack

| Capa          | Tecnología                                         |
| ------------- | -------------------------------------------------- |
| Framework     | Nuxt 4 · Vue 3 · TypeScript 5                      |
| UI            | @nuxt/ui 4 · Tailwind CSS 4                        |
| Estado        | Pinia                                              |
| Base de datos | MongoDB (Atlas) · Mongoose ODM                     |
| Auth          | JWT (jose) · bcrypt                                |
| OCR           | pdfjs-dist · Gemini 2.0 Flash Vision · Mistral OCR |
| NER           | Vercel AI SDK · generateObject + Zod               |
| Testing       | Vitest · @nuxt/test-utils · Playwright             |
| Calidad       | ESLint · Prettier · Husky · commitlint             |

---

## Desarrollo

```bash
pnpm dev
```

El servidor arranca en `http://localhost:3000`.

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
