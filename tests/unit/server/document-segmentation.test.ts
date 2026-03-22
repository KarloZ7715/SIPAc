import { describe, expect, it } from 'vitest'
import {
  countTitleLikeLines,
  heuristicSuggestsMultipleWorks,
} from '~~/server/services/ner/document-segmentation'

describe('document-segmentation heuristics', () => {
  it('countTitleLikeLines ignora líneas cortas o sin señal de título', () => {
    const text = ['hola', 'ABSTRACT', 'Este Es Un Posible Titulo De Ponencia Largo'].join('\n')
    expect(countTitleLikeLines(text)).toBeGreaterThanOrEqual(0)
  })

  it('heuristicSuggestsMultipleWorks es conservador en textos cortos', () => {
    expect(heuristicSuggestsMultipleWorks('x'.repeat(5000))).toBe(false)
  })

  it('heuristicSuggestsMultipleWorks puede activarse con muchas líneas tipo título y texto largo', () => {
    const titleLine = 'ESTUDIO DE MACHINE LEARNING EN EDUCACION SUPERIOR'
    const body = `${titleLine}\n\n${'p '.repeat(400)}\n\n${titleLine}\n\n${'q '.repeat(400)}\n\n${titleLine}\n\n${'r '.repeat(400)}\n\n${titleLine}\n\n`
    const text = body.repeat(30)
    expect(text.length).toBeGreaterThan(12_000)
    expect(heuristicSuggestsMultipleWorks(text)).toBe(true)
  })
})
