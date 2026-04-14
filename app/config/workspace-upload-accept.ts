/**
 * Atributo `accept` para cargas en el flujo de documentos de trabajo.
 * Debe alinearse con `ALLOWED_MIME_TYPES` y la detección por firma en servidor (`file-type`).
 */
export const WORKSPACE_UPLOAD_ACCEPT = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.docx',
  '.dotx',
  '.docm',
  '.dotm',
  '.xlsx',
  '.xlsm',
  '.xltx',
  '.xltm',
  '.pptx',
  '.potx',
  '.ppsx',
  '.pptm',
  '.potm',
  '.ppsm',
  '.odt',
  '.ott',
  '.ods',
  '.ots',
  '.odp',
  '.otp',
].join(',')
