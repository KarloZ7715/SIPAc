# SIPAc — Copilot Instructions

Sistema Inteligente de Productividad Académica. Nuxt 4 + Vue 3 + TypeScript full-stack app for academic document processing with AI-powered OCR and Named Entity Recognition (NER).

## Commands

```bash
pnpm dev                      # Dev server at localhost:3000
pnpm build                    # Production build
pnpm lint && pnpm lint:fix    # ESLint
pnpm typecheck                # TypeScript check
pnpm test                     # Unit/integration tests (Vitest)
pnpm test tests/unit/server/services/ner/semantic-validation.test.ts  # Single test file
pnpm test:e2e                 # E2E tests (Playwright)
pnpm test:e2e:ui              # E2E with Playwright UI
```

## Architecture

### Directory Layout

- `app/` — Vue 3 client: pages, components, composables, stores (Pinia), types
- `server/` — Nuxt server: API routes, models (Mongoose), services, middleware
- `tests/unit/`, `tests/integration/`, `tests/e2e/` — Test files mirror source structure

### Core Services (server/services/)

- **OCR pipeline** (`ocr/`): Document text extraction via `pdfjs-dist` (native PDF) or Gemini Vision (scanned). Quality gates trigger retries on low confidence.
- **NER pipeline** (`ner/`): Multi-pass entity extraction using Vercel AI SDK (`generateText` + `Output.object`) with Zod schemas. Supports LLM fallback chain: `gemini-3.1-flash-lite-preview` → Groq models → `gemini-3-flash-preview` → Another providers (NVIDIA, OpenRouter, Groq, Gemini).
- **Chat** (`chat/`): Conversational interface (planned M9) with Cerebras/Gemini fallback.

### API Pattern

Routes in `server/api/` follow Nuxt conventions (`[name].[method].ts`). Standard pattern:

```typescript
export default defineEventHandler(async (event) => {
  // 1. Rate limiting (if needed)
  enforceAuthRateLimit(event, 'auth:login')

  // 2. Parse & validate with Zod
  const body = await readBody(event)
  const result = schema.safeParse(body)
  if (!result.success) throw createValidationError(result.error)

  // 3. Business logic
  // 4. Audit logging
  await logAudit(event, { userId, action, resource })

  // 5. Return via response helpers
  return ok({ data }) // or created(), noContent()
})
```

### Error Handling

Use typed error factories from `server/utils/errors.ts`:

- `createValidationError(zodError)` — 400
- `createAuthenticationError()` — 401
- `createAuthorizationError()` — 403
- `createNotFoundError(resource)` — 404
- `createRateLimitError()` — 429

### State Management

- Server: Mongoose models in `server/models/` with methods and indexes
- Client: Pinia stores in `app/stores/`, composables in `app/composables/`

### UI Components

Uses `@nuxt/ui` v4 with custom theme in `app/app.config.ts`. Primary color: `sipac` (green palette). Icon set: Lucide.

## Conventions

### Commit Messages

Enforced by commitlint (CI will fail on violations):

```
<type>(<scope>): <description in lowercase imperative>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

Common scopes: `auth`, `ui`, `api`, `ner`, `ocr`, `upload`, `profile`, `deps`

### TypeScript

- Strict mode enabled
- Shared types in `app/types/`
- Zod schemas for validation in `server/utils/schemas/`
- Use `~~/` alias for imports from project root

### Testing

- Unit tests: `tests/unit/` — test isolated functions
- Integration tests: `tests/integration/` — test services with dependencies
- Evals: `tests/evals/` — LLM output quality evaluation

### NER Pipeline Notes

When modifying NER:

1. Check `semanticPenalty` and `evidenceCoverage` metrics in pipeline telemetry
2. If `semanticPenalty > 0.35`, focus on normalization rules before touching prompts
3. Fallback order and timeouts are configured in `nuxt.config.ts` runtime config

## RTK (Token Optimization)

Prefix shell commands with `rtk` for compressed output:

```bash
rtk git status
rtk git diff
rtk pnpm test
```

Meta commands: `rtk gain` (savings dashboard), `rtk discover` (missed opportunities)
