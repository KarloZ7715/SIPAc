import type { WorkspaceStage } from '~~/app/stores/documents'

/** Textos de cabecera por etapa del flujo workspace (única fuente para UI). */
export const WORKSPACE_STAGE_COPY: Record<
  WorkspaceStage,
  { eyebrow: string; title: string; description: string }
> = {
  empty: {
    eyebrow: 'Paso 1',
    title: 'Sube tu archivo',
    description: 'PDF, office o imagen. Después verás la vista previa y la ficha para revisar.',
  },
  draft: {
    eyebrow: 'Paso 2',
    title: 'Archivo listo',
    description:
      'Si es el archivo que quieres registrar, pulsa para que lo leamos y preparemos la ficha (arriba o en el panel de la izquierda).',
  },
  analyzing: {
    eyebrow: 'Leyendo',
    title: 'Preparando la ficha',
    description: 'Suele tardar unos segundos o un minuto. Puedes seguir el avance en pantalla.',
  },
  review: {
    eyebrow: 'Paso 3',
    title: 'Revisa la ficha',
    description:
      'Ajusta título, autores y demás datos. En tablet o portátiles estrechos, alterna Vista previa y Ficha con las pestañas.',
  },
  ready: {
    eyebrow: 'Paso 3',
    title: 'Listo para guardar',
    description: 'Comprueba una última vez y confirma el resultado.',
  },
  confirmed: {
    eyebrow: 'Listo',
    title: 'Guardado',
    description: 'El documento ya está en tu registro.',
  },
}
