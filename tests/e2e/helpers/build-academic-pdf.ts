export function buildAcademicPdfBuffer(): Buffer {
  const lines = [
    'Universidad Nacional de Colombia. Revista Latinoamericana de Educacion.',
    'Autores: Maria Fernandez Lopez y Carlos Gomez.',
    'Analisis de inteligencia artificial en educacion superior, 2023.',
    'DOI 10.1234/e2e.sipac. Keywords: pedagogia digital, evaluacion formativa.',
  ]

  const escaped = lines.map((line) =>
    line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'),
  )

  let stream = 'BT\n/F1 11 Tf\n48 720 Td\n'
  stream += `(${escaped[0]}) Tj\n`
  for (let i = 1; i < escaped.length; i += 1) {
    stream += '0 -16 Td\n'
    stream += `(${escaped[i]}) Tj\n`
  }
  stream += 'ET\n'

  const streamBody = Buffer.from(stream, 'latin1')

  const obj1 = Buffer.from('1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n', 'latin1')
  const obj2 = Buffer.from('2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n', 'latin1')
  const obj3 = Buffer.from(
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n',
    'latin1',
  )
  const obj4Head = Buffer.from(`4 0 obj<</Length ${streamBody.length}>>stream\n`, 'latin1')
  const obj4Tail = Buffer.from('\nendstream\nendobj\n', 'latin1')
  const obj5 = Buffer.from(
    '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n',
    'latin1',
  )

  const header = Buffer.from('%PDF-1.4\n', 'latin1')
  const objects = [obj1, obj2, obj3, obj4Head, streamBody, obj4Tail, obj5]

  const offsets: number[] = []
  let pos = header.length
  offsets.push(0)

  const objectBuffers: Buffer[] = [header]
  for (const ob of objects) {
    offsets.push(pos)
    objectBuffers.push(ob)
    pos += ob.length
  }

  const xrefStart = pos
  const objectCount = objects.length + 1
  let xref = `xref\n0 ${objectCount}\n0000000000 65535 f \n`
  for (let i = 1; i < objectCount; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }

  const xrefBuf = Buffer.from(xref, 'latin1')
  const trailer = Buffer.from(
    `trailer<</Size ${objectCount}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF\n`,
    'latin1',
  )

  return Buffer.concat([...objectBuffers, xrefBuf, trailer])
}
