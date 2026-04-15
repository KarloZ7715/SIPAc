# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Behavioral Guidelines

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Project Overview

SIPAc (Sistema Inteligente de Productividad Académica) is a Nuxt 4 + Vue 3 + TypeScript full-stack application for academic document processing. Professors upload PDFs/images of academic works; the system extracts text (OCR), identifies entities (NER), and builds a searchable repository with analytics.

## Commands

```bash
# Development
pnpm dev                    # Dev server at localhost:3000
pnpm build                  # Production build
pnpm preview                # Preview production build

# Quality
pnpm lint && pnpm lint:fix  # ESLint
pnpm typecheck              # TypeScript strict check
pnpm format                 # Prettier

# Testing
pnpm test                   # Unit/integration tests (Vitest)
pnpm test tests/unit/server/semantic-validation.test.ts  # Single test file
pnpm test -- -t "should validate"  # Run tests matching pattern
pnpm test:watch             # Watch mode
pnpm test:coverage          # Coverage report
pnpm test:e2e               # E2E smoke tests (Playwright, excluye flujos completos)
pnpm test:e2e:full          # Flujos completos OCR/NER en desarrollo, opt-in
pnpm test:e2e:ui            # E2E with Playwright UI
pnpm test:eval:ner          # NER field extraction evals
```

### Testing Policy

- `pnpm test:e2e` debe quedarse rápido y apto para CI.
- `pnpm test:e2e:full` se reserva para desarrollo manual con OCR/NER real.
- No agregues los flujos completos al camino por defecto de CI.

## Architecture

### Directory Structure

- `app/` — Vue 3 client: pages, components (`sipac/` for design system), composables, Pinia stores, types
- `server/` — Nuxt server: API routes, Mongoose models, services (OCR/NER/chat), middleware
- `tests/unit/`, `tests/integration/`, `tests/evals/` — Test files mirroring source structure
- `tests/e2e/` — Playwright E2E tests; smoke por defecto, flujos completos sólo con `pnpm test:e2e:full`
- `docs/analisis-diseno/` — Project documentation, UML diagrams, ADRs

### Core Services (server/services/)

**OCR Pipeline** (`ocr/`): Extracts text from documents. Uses `pdfjs-dist` for native PDFs, Gemini Vision for scanned images. Quality gates trigger retries on low confidence.

**NER Pipeline** (`ner/`): Multi-pass entity extraction using Vercel AI SDK (`generateText` + `Output.object`) with Zod schemas. Supports LLM fallback chain across multiple providers (Gemini, Groq, Cerebras, NVIDIA, OpenRouter).

**Chat** (`chat/`): Conversational interface with RAG using hybrid retrieval (keyword + semantic).

### API Pattern

Routes follow Nuxt convention (`server/api/[name].[method].ts`):

```typescript
export default defineEventHandler(async (event) => {
  enforceAuthRateLimit(event, 'resource:action') // Rate limiting
  const body = await readBody(event)
  const result = schema.safeParse(body) // Zod validation
  if (!result.success) throw createValidationError(result.error)
  // Business logic
  await logAudit(event, { userId, action, resource })
  return ok({ data }) // Response helpers: ok(), created(), noContent()
})
```

Error factories in `server/utils/errors.ts`: `createValidationError`, `createAuthenticationError`, `createAuthorizationError`, `createNotFoundError`, `createRateLimitError`.

## Environment Variables

Required:

- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — Minimum 32 characters
- `GOOGLE_API_KEY` — For OCR (Gemini Vision) and NER
- `GOOGLE_API_KEY_TEST` — Optional; if set, used instead of `GOOGLE_API_KEY` (CI/E2E/Vitest) so tests do not consume the production quota

Optional providers (enable fallback chains):

- `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `NVIDIA_API_KEY`, `OPENROUTER_API_KEY`, `MISTRAL_API_KEY`

Pipeline tuning:

- `OCR_PROVIDER=gemini|mistral`
- `NER_CONFIDENCE_THRESHOLD=0.7`
- `NER_REQUEST_TIMEOUT_MS=35000`
- `NER_MAX_CANDIDATE_ATTEMPTS=4`

See `.env.example` for full list.

## NER Pipeline Notes

When modifying NER:

1. Check `semanticPenalty` and `evidenceCoverage` in pipeline telemetry
2. If `semanticPenalty > 0.35`, fix normalization rules before touching prompts
3. Run `pnpm test:eval:ner` to validate field extraction quality
4. Fallback order and timeouts configured in `nuxt.config.ts` runtimeConfig

## Conventions

### Commits

Enforced by commitlint:

```
<type>(<scope>): <description in lowercase imperative>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
Scopes: `auth`, `ui`, `api`, `ner`, `ocr`, `upload`, `profile`, `chat`, `deps`

### TypeScript

- Strict mode enabled
- Shared types in `app/types/`
- Zod schemas in `server/utils/schemas/`
- Use `~~/` alias for project root imports

### UI

Uses `@nuxt/ui` v4 with custom theme in `app/app.config.ts`. Primary color: `sipac` (green palette). Icons: Lucide (`@iconify-json/lucide`).

## RTK (Token Optimization)

Shell commands are automatically proxied through RTK for compressed output:

```bash
rtk git status
rtk git diff
rtk pnpm test
```

Meta: `rtk gain` (savings), `rtk discover` (missed opportunities)
