#!/usr/bin/env node

/**
 * check-bundle-size.mjs
 *
 * Parses the output of `pnpm build` and fails if any JS chunk exceeds the
 * gzip budget or if entry.css exceeds its budget. Intended for CI.
 *
 * Usage:
 *   pnpm build 2>&1 | node scripts/check-bundle-size.mjs
 *   # or
 *   node scripts/check-bundle-size.mjs < build-output.log
 *
 * Budgets (gzip KB):
 *   - JS chunk max:  100 KB gzip
 *   - entry.css max:  35 KB gzip
 */

import { createInterface } from 'node:readline'

const JS_CHUNK_BUDGET_KB = 100
const CSS_BUDGET_KB = 35

const violations = []

// Match lines like:  dist/... 459.32 kB │ gzip: 139.12 kB
// or:                _nuxt/xxx.js   123.45 kB │ gzip: 45.67 kB
const sizeLineRegex =
  /(?<file>\S+)\s+[\d,.]+\s*(?:kB|KB)\s*│\s*gzip:\s*(?<gzip>[\d,.]+)\s*(?:kB|KB)/

const rl = createInterface({ input: process.stdin })
const lines = []

rl.on('line', (line) => {
  lines.push(line)

  const match = sizeLineRegex.exec(line)
  if (!match?.groups) return

  const file = match.groups.file.trim()
  const gzipKB = parseFloat(match.groups.gzip.replace(',', ''))

  if (Number.isNaN(gzipKB)) return

  const isCSS = file.endsWith('.css')
  const isJS = file.endsWith('.js') || file.endsWith('.mjs')

  if (isCSS && file.includes('entry')) {
    if (gzipKB > CSS_BUDGET_KB) {
      violations.push({ file, gzipKB, budget: CSS_BUDGET_KB, type: 'CSS' })
    }
  } else if (isJS) {
    if (gzipKB > JS_CHUNK_BUDGET_KB) {
      violations.push({ file, gzipKB, budget: JS_CHUNK_BUDGET_KB, type: 'JS' })
    }
  }
})

rl.on('close', () => {
  if (violations.length === 0) {
    console.log('✅ Bundle size check passed — all chunks within budget.')
    console.log(
      `   JS budget: ${JS_CHUNK_BUDGET_KB} KB gzip | CSS budget: ${CSS_BUDGET_KB} KB gzip`,
    )
    process.exit(0)
  }

  console.error('❌ Bundle size check FAILED — the following chunks exceed budget:\n')
  for (const v of violations) {
    console.error(`  ${v.type} ${v.file}: ${v.gzipKB.toFixed(2)} KB gzip (budget: ${v.budget} KB)`)
  }
  console.error('')
  process.exit(1)
})
