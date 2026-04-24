import { describe, expect, it } from 'vitest'
import { renderChatMarkdown } from '~~/app/utils/chat-markdown'

describe('renderChatMarkdown', () => {
  it('renderiza listas, encabezados y negritas sin aceptar HTML arbitrario', () => {
    const html = renderChatMarkdown(`# Resultado

- **Coincidencia**
- Segunda línea

<script>alert('xss')</script>`)

    expect(html).toContain('<h1')
    expect(html).toContain('<ul')
    expect(html).toContain('<strong')
    expect(html).toContain('&lt;script&gt;alert')
    expect(html).not.toContain('<script>')
  })

  it('renderiza tablas y enlaces seguros', () => {
    const html = renderChatMarkdown(`| Campo | Valor |
| --- | --- |
| Fuente | [Documento](/api/upload/123/file) |`)

    expect(html).toContain('<table')
    expect(html).toContain('href="/api/upload/123/file"')
  })

  it('neutraliza enlaces con payload malicioso y esquemas no permitidos', () => {
    const html = renderChatMarkdown(
      `[Exploit](https://example.com" onclick="alert('xss'))\n[Unsafe](javascript:alert(1))`,
    )

    expect(html).not.toContain('onclick=')
    expect(html).toContain('href="#"')
  })
})
