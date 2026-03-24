function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function sanitizeHref(value: string) {
  if (/^(https?:\/\/|\/)/i.test(value)) {
    return value
  }

  return '#'
}

function renderInlineMarkdown(text: string) {
  let html = escapeHtml(text)

  html = html.replace(
    /`([^`]+)`/g,
    (_match, content: string) =>
      `<code class="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[0.92em] text-neutral-900">${escapeHtml(content)}</code>`,
  )
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-text">$1</strong>')
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, label: string, href: string) =>
      `<a class="font-medium text-sipac-700 underline decoration-sipac-300 underline-offset-3" href="${sanitizeHref(
        href,
      )}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`,
  )
  html = html.replace(
    /\$([^$\n]+)\$/g,
    (_match, content: string) =>
      `<span class="rounded-md bg-earth-50 px-1.5 py-0.5 font-mono text-[0.92em] text-earth-700">${escapeHtml(
        content,
      )}</span>`,
  )

  return html
}

function renderParagraph(block: string[]) {
  return `<p>${renderInlineMarkdown(block.join(' '))}</p>`
}

function renderList(items: string[], ordered: boolean) {
  const tag = ordered ? 'ol' : 'ul'
  const listClass = ordered ? 'list-decimal' : 'list-disc'
  const renderedItems = items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')

  return `<${tag} class="${listClass} ml-5 space-y-2">${renderedItems}</${tag}>`
}

function renderTable(lines: string[]) {
  if (lines.length < 2) {
    return renderParagraph(lines)
  }

  const rows = lines
    .map((line) => line.trim().replace(/^\||\|$/g, ''))
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .filter((row) => row.length > 0)

  if (rows.length < 2) {
    return renderParagraph(lines)
  }

  const [header = [], , ...body] = rows
  const headerHtml = header
    .map(
      (cell) =>
        `<th class="border-b border-border/70 px-3 py-2 text-left text-xs font-semibold tracking-[0.14em] text-text-soft uppercase">${renderInlineMarkdown(
          cell,
        )}</th>`,
    )
    .join('')
  const bodyHtml = body
    .map((row) => {
      const cells = row
        .map(
          (cell) =>
            `<td class="border-b border-border/50 px-3 py-2 align-top text-sm text-text-muted">${renderInlineMarkdown(
              cell,
            )}</td>`,
        )
        .join('')
      return `<tr>${cells}</tr>`
    })
    .join('')

  return `<div class="overflow-x-auto rounded-2xl border border-border/60"><table class="min-w-full border-collapse bg-white"><thead class="bg-surface-elevated/70"><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`
}

export function renderChatMarkdown(markdown: string) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const htmlBlocks: string[] = []
  let paragraphBuffer: string[] = []
  let listBuffer: string[] = []
  let orderedList = false
  let quoteBuffer: string[] = []
  let codeFence: { language?: string; lines: string[] } | null = null
  let mathFence: string[] | null = null
  let tableBuffer: string[] = []

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      htmlBlocks.push(renderParagraph(paragraphBuffer))
      paragraphBuffer = []
    }
  }

  const flushList = () => {
    if (listBuffer.length > 0) {
      htmlBlocks.push(renderList(listBuffer, orderedList))
      listBuffer = []
    }
  }

  const flushQuote = () => {
    if (quoteBuffer.length > 0) {
      htmlBlocks.push(
        `<blockquote class="border-l-4 border-earth-300 bg-earth-50/70 px-4 py-3 text-sm text-text-muted">${quoteBuffer
          .map((line) => `<p>${renderInlineMarkdown(line)}</p>`)
          .join('')}</blockquote>`,
      )
      quoteBuffer = []
    }
  }

  const flushTable = () => {
    if (tableBuffer.length > 0) {
      htmlBlocks.push(renderTable(tableBuffer))
      tableBuffer = []
    }
  }

  for (const rawLine of lines) {
    const line = rawLine ?? ''

    if (line.trim().startsWith('```')) {
      flushParagraph()
      flushList()
      flushQuote()
      flushTable()

      if (codeFence) {
        htmlBlocks.push(
          `<pre class="overflow-x-auto rounded-2xl bg-neutral-950 px-4 py-4 text-sm text-neutral-100"><code data-language="${escapeHtml(
            codeFence.language ?? '',
          )}">${escapeHtml(codeFence.lines.join('\n'))}</code></pre>`,
        )
        codeFence = null
      } else {
        codeFence = {
          language: line.trim().slice(3).trim() || undefined,
          lines: [],
        }
      }
      continue
    }

    if (codeFence) {
      codeFence.lines.push(line)
      continue
    }

    if (line.trim() === '$$') {
      flushParagraph()
      flushList()
      flushQuote()
      flushTable()

      if (mathFence) {
        htmlBlocks.push(
          `<div class="rounded-2xl border border-earth-200 bg-earth-50 px-4 py-3 font-mono text-sm text-earth-700">${escapeHtml(
            mathFence.join('\n'),
          )}</div>`,
        )
        mathFence = null
      } else {
        mathFence = []
      }
      continue
    }

    if (mathFence) {
      mathFence.push(line)
      continue
    }

    if (!line.trim()) {
      flushParagraph()
      flushList()
      flushQuote()
      flushTable()
      continue
    }

    if (/^\|.+\|$/.test(line.trim())) {
      flushParagraph()
      flushList()
      flushQuote()
      tableBuffer.push(line)
      continue
    }

    if (tableBuffer.length > 0) {
      flushTable()
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      flushParagraph()
      flushList()
      flushQuote()
      const hashes = headingMatch[1] ?? '#'
      const level = hashes.length
      const text = headingMatch[2] ?? ''
      const headingClasses = {
        1: 'text-2xl font-display',
        2: 'text-xl font-display',
        3: 'text-lg font-semibold',
        4: 'text-base font-semibold',
        5: 'text-sm font-semibold',
        6: 'text-sm font-semibold uppercase tracking-[0.14em]',
      } as const
      htmlBlocks.push(
        `<h${level} class="${headingClasses[level as keyof typeof headingClasses]} text-text">${renderInlineMarkdown(
          text,
        )}</h${level}>`,
      )
      continue
    }

    const quoteMatch = line.match(/^>\s?(.*)$/)
    if (quoteMatch) {
      flushParagraph()
      flushList()
      quoteBuffer.push(quoteMatch[1] ?? '')
      continue
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/)
    if (orderedMatch) {
      flushParagraph()
      flushQuote()
      if (listBuffer.length === 0) {
        orderedList = true
      }
      listBuffer.push(orderedMatch[1] ?? '')
      continue
    }

    const unorderedMatch = line.match(/^[-*]\s+(.+)$/)
    if (unorderedMatch) {
      flushParagraph()
      flushQuote()
      if (listBuffer.length === 0) {
        orderedList = false
      }
      listBuffer.push(unorderedMatch[1] ?? '')
      continue
    }

    flushList()
    flushQuote()
    paragraphBuffer.push(line.trim())
  }

  flushParagraph()
  flushList()
  flushQuote()
  flushTable()

  if (codeFence) {
    htmlBlocks.push(
      `<pre class="overflow-x-auto rounded-2xl bg-neutral-950 px-4 py-4 text-sm text-neutral-100"><code>${escapeHtml(
        codeFence.lines.join('\n'),
      )}</code></pre>`,
    )
  }

  if (mathFence) {
    htmlBlocks.push(
      `<div class="rounded-2xl border border-earth-200 bg-earth-50 px-4 py-3 font-mono text-sm text-earth-700">${escapeHtml(
        mathFence.join('\n'),
      )}</div>`,
    )
  }

  return htmlBlocks.join('')
}
