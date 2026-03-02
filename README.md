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
| Estilos       | Tailwind CSS 4                                     |
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
| `pnpm lint`          | Ejecutar ESLint                          |
| `pnpm lint:fix`      | Corregir errores de lint automáticamente |
| `pnpm format`        | Formatear código con Prettier            |
| `pnpm typecheck`     | Verificación de tipos TypeScript         |
| `pnpm test`          | Tests unitarios/integración con Vitest   |
| `pnpm test:e2e`      | Tests end-to-end con Playwright          |
| `pnpm test:coverage` | Tests con reporte de cobertura           |

---

## Estructura del proyecto

```
server/
  api/           → API Routes REST (auth, upload, products, dashboard, users, notifications)
  middleware/    → Auth middleware (JWT)
  models/        → Modelos Mongoose (discriminator pattern)
  services/      → OCR, NER, Storage
  utils/         → JWT, errores, auditoría, validación, schemas Zod
  plugins/       → Conexión MongoDB
app/
  components/    → Componentes Vue (ui, layout, forms, dashboard)
  composables/   → Composables Vue 3
  layouts/       → Layouts de la app
  pages/         → Páginas Nuxt
  stores/        → Pinia stores
  types/         → Tipos TypeScript del dominio
  utils/         → Utilidades cliente
tests/           → Tests unitarios e integración
e2e/             → Tests end-to-end (Playwright)
docs/            → Documentación de análisis y diseño
```

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
