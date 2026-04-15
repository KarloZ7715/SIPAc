import type { DashboardInsightItem } from '~~/app/types'
import AcademicProduct from '~~/server/models/AcademicProduct'
import {
  CONFERENCE_COMPANION_PRODUCT_TYPES,
  countConferencePapersMissingLikelyCompanion,
} from '~~/server/services/dashboard/insight-heuristics'
import { workspaceDocumentsUrl } from '~~/server/utils/dashboard-workspace-links'

const NER_LOW_CONFIDENCE_THRESHOLD = 0.7
const NER_HIGH_CONFIDENCE_THRESHOLD = 0.95

/** Trim solo si el valor es string; si no, cadena vacía (evita $trim sobre objetos BSON). */
function trimmedStringOrEmpty(fieldPath: string): Record<string, unknown> {
  return {
    $cond: [{ $eq: [{ $type: fieldPath }, 'string'] }, { $trim: { input: fieldPath } }, ''],
  }
}

export async function computeDashboardInsights(
  match: Record<string, unknown>,
  totalFiltered: number,
): Promise<DashboardInsightItem[]> {
  const insights: DashboardInsightItem[] = []

  if (totalFiltered === 0) {
    insights.push({
      id: 'onboarding-empty',
      severity: 'info',
      title: 'Empieza tu línea base',
      description:
        'Aún no hay productos confirmados en el repositorio con los filtros actuales. Carga y confirma tus primeros documentos.',
      count: 0,
      ctaLabel: 'Ir al espacio de trabajo',
      href: workspaceDocumentsUrl({}),
      secondaryCtaLabel: 'Ver repositorio',
      secondaryHref: '/repository',
    })
    return insights
  }

  const [lowNerResult, missingDoiResult, highNerResult, thesisRepoResult, softwareRepoResult] =
    await Promise.all([
      AcademicProduct.aggregate<{
        lowCount: { n: number }[]
        lowFirst: { _id: unknown }[]
      }>([
        { $match: match },
        {
          $facet: {
            lowCount: [
              {
                $match: {
                  'extractedEntities.extractionConfidence': { $lt: NER_LOW_CONFIDENCE_THRESHOLD },
                },
              },
              { $count: 'n' },
            ],
            lowFirst: [
              {
                $match: {
                  'extractedEntities.extractionConfidence': { $lt: NER_LOW_CONFIDENCE_THRESHOLD },
                },
              },
              { $limit: 1 },
              { $project: { _id: 1 } },
            ],
          },
        },
      ]),
      AcademicProduct.aggregate<{
        doiCount: { n: number }[]
        doiFirst: { _id: unknown }[]
      }>([
        { $match: match },
        {
          $addFields: {
            __insManualDoi: trimmedStringOrEmpty('$manualMetadata.doi'),
            __insExtractedDoi: trimmedStringOrEmpty('$extractedEntities.doi.value'),
          },
        },
        {
          $match: {
            $expr: {
              $and: [
                { $in: ['$productType', ['article', 'conference_paper']] },
                {
                  $not: {
                    $regexMatch: { input: '$__insManualDoi', regex: '\\S' },
                  },
                },
                {
                  $not: {
                    $regexMatch: { input: '$__insExtractedDoi', regex: '\\S' },
                  },
                },
              ],
            },
          },
        },
        {
          $facet: {
            doiCount: [{ $count: 'n' }],
            doiFirst: [{ $limit: 1 }, { $project: { _id: 1 } }],
          },
        },
      ]),
      AcademicProduct.aggregate<{
        highCount: { n: number }[]
        highFirst: { _id: unknown }[]
      }>([
        { $match: match },
        {
          $match: {
            'extractedEntities.extractionConfidence': { $gte: NER_HIGH_CONFIDENCE_THRESHOLD },
          },
        },
        {
          $facet: {
            highCount: [{ $count: 'n' }],
            highFirst: [{ $limit: 1 }, { $project: { _id: 1 } }],
          },
        },
      ]),
      AcademicProduct.aggregate<{
        thesisCount: { n: number }[]
        thesisFirst: { _id: unknown }[]
      }>([
        { $match: match },
        {
          $addFields: {
            __insRepoUrl: trimmedStringOrEmpty('$repositoryUrl'),
          },
        },
        {
          $match: {
            productType: 'thesis',
            $expr: {
              $not: {
                $regexMatch: { input: '$__insRepoUrl', regex: '\\S' },
              },
            },
          },
        },
        {
          $facet: {
            thesisCount: [{ $count: 'n' }],
            thesisFirst: [{ $limit: 1 }, { $project: { _id: 1 } }],
          },
        },
      ]),
      AcademicProduct.aggregate<{
        softwareCount: { n: number }[]
        softwareFirst: { _id: unknown }[]
      }>([
        { $match: match },
        {
          $addFields: {
            __insSoftRepoUrl: trimmedStringOrEmpty('$softwareRepositoryUrl'),
          },
        },
        {
          $match: {
            productType: 'software',
            $expr: {
              $not: {
                $regexMatch: { input: '$__insSoftRepoUrl', regex: '\\S' },
              },
            },
          },
        },
        {
          $facet: {
            softwareCount: [{ $count: 'n' }],
            softwareFirst: [{ $limit: 1 }, { $project: { _id: 1 } }],
          },
        },
      ]),
    ])

  const lowN = lowNerResult[0]?.lowCount[0]?.n ?? 0
  const lowFirstId = lowNerResult[0]?.lowFirst[0]?._id
  const lowFirstStr =
    lowFirstId && typeof lowFirstId === 'object' && 'toString' in lowFirstId
      ? String((lowFirstId as { toString: () => string }).toString())
      : lowFirstId
        ? String(lowFirstId)
        : undefined

  if (lowN > 0) {
    insights.push({
      id: 'low-confidence-ner',
      severity: 'warning',
      title: 'Calidad de extracción por revisar',
      description: `${lowN} documento(s) tienen confianza de extracción de entidades menor al ${Math.round(NER_LOW_CONFIDENCE_THRESHOLD * 100)}% (incluye registros con puntuación 0 o sin recalibrar). En el espacio de trabajo puedes corregir metadatos o usar “Re-ejecutar extracción” para volver a lanzar el NER sobre el texto del archivo.`,
      count: lowN,
      ctaLabel: 'Revisar y corregir metadatos',
      href: workspaceDocumentsUrl({
        productId: lowFirstStr,
        extraParams: { fromInsight: 'low-confidence-ner' },
      }),
      sampleProductIds: lowFirstStr ? [lowFirstStr] : undefined,
    })
  }

  const doiN = missingDoiResult[0]?.doiCount[0]?.n ?? 0
  const doiFirstId = missingDoiResult[0]?.doiFirst[0]?._id
  const doiFirstStr = doiFirstId ? String(doiFirstId) : undefined

  if (doiN > 0) {
    insights.push({
      id: 'missing-doi',
      severity: 'info',
      title: 'Metadatos incompletos detectados',
      description: `${doiN} publicación(es) de tipo artículo o ponencia no tienen DOI confirmado en la ficha (ni manual ni extraído).`,
      count: doiN,
      ctaLabel: 'Completar DOI',
      href: workspaceDocumentsUrl({ productId: doiFirstStr, focus: 'doi' }),
      sampleProductIds: doiFirstStr ? [doiFirstStr] : undefined,
    })
  }

  const highN = highNerResult[0]?.highCount[0]?.n ?? 0
  const highFirstId = highNerResult[0]?.highFirst[0]?._id
  const highFirstStr = highFirstId ? String(highFirstId) : undefined
  const highPct = totalFiltered > 0 ? Math.round((highN / totalFiltered) * 100) : 0

  if (highN >= 3 || (totalFiltered > 0 && highN / totalFiltered >= 0.5 && highN >= 2)) {
    insights.push({
      id: 'high-ner-quality',
      severity: 'success',
      title: 'Tendencia de alta calidad',
      description: `${highN} de ${totalFiltered} documento(s) filtrado(s) alcanzan confianza de extracción igual o mayor al ${Math.round(NER_HIGH_CONFIDENCE_THRESHOLD * 100)}% (${highPct}% del conjunto).`,
      count: highN,
      ctaLabel: 'Abrir un registro destacado',
      href: workspaceDocumentsUrl({ productId: highFirstStr, focus: 'title' }),
      secondaryCtaLabel: 'Ver repositorio',
      secondaryHref: '/repository',
      sampleProductIds: highFirstStr ? [highFirstStr] : undefined,
    })
  }

  const companionMatch = {
    ...match,
    productType: { $in: CONFERENCE_COMPANION_PRODUCT_TYPES },
  }

  const conferencePool = await AcademicProduct.find(companionMatch)
    .select(
      '_id productType owner conferenceAcronym isbn proceedingsTitle eventDate manualMetadata extractedEntities',
    )
    .lean()

  const { count: conferenceMissing, sampleIds: conferenceSamples } =
    countConferencePapersMissingLikelyCompanion(
      conferencePool as Parameters<typeof countConferencePapersMissingLikelyCompanion>[0],
    )

  if (conferenceMissing > 0) {
    insights.push({
      id: 'conference-proceedings-heuristic',
      severity: 'info',
      title: 'Posible documentación complementaria de congreso',
      description: `${conferenceMissing} ponencia(s) muestran datos de actas o congreso (ISBN, acrónimo o título de memorias) pero no hay otra ficha en tu repositorio que coincida de forma heurística (mismo criterio ISBN o evento+año). Si aplica, sube memorias, actas o un informe técnico relacionado.`,
      count: conferenceMissing,
      ctaLabel: 'Subir o revisar documentos',
      href: workspaceDocumentsUrl({ productId: conferenceSamples[0] }),
      secondaryCtaLabel: 'Subir nuevo documento',
      secondaryHref: workspaceDocumentsUrl({}),
      sampleProductIds: conferenceSamples.length ? conferenceSamples : undefined,
    })
  }

  const thesisN = thesisRepoResult[0]?.thesisCount[0]?.n ?? 0
  const thesisFirstId = thesisRepoResult[0]?.thesisFirst[0]?._id
  const thesisFirstStr = thesisFirstId ? String(thesisFirstId) : undefined

  if (thesisN > 0) {
    insights.push({
      id: 'thesis-missing-repository-url',
      severity: 'info',
      title: 'Tesis sin enlace de repositorio institucional',
      description: `${thesisN} tesis confirmada(s) no tienen URL de repositorio. Si la institución publica la obra en línea, añadirla mejora la trazabilidad.`,
      count: thesisN,
      ctaLabel: 'Completar URL de repositorio',
      href: workspaceDocumentsUrl({ productId: thesisFirstStr, focus: 'repositoryUrl' }),
      sampleProductIds: thesisFirstStr ? [thesisFirstStr] : undefined,
    })
  }

  const softwareN = softwareRepoResult[0]?.softwareCount[0]?.n ?? 0
  const softwareFirstId = softwareRepoResult[0]?.softwareFirst[0]?._id
  const softwareFirstStr = softwareFirstId ? String(softwareFirstId) : undefined

  if (softwareN > 0) {
    insights.push({
      id: 'software-missing-repo-url',
      severity: 'info',
      title: 'Software sin URL de código o registro',
      description: `${softwareN} producto(s) de tipo software no tienen URL de repositorio (GitHub, GitLab, etc.). Si existe código público, conviene enlazarlo.`,
      count: softwareN,
      ctaLabel: 'Añadir URL del repositorio',
      href: workspaceDocumentsUrl({ productId: softwareFirstStr, focus: 'softwareRepositoryUrl' }),
      sampleProductIds: softwareFirstStr ? [softwareFirstStr] : undefined,
    })
  }

  const order: Record<DashboardInsightItem['severity'], number> = {
    warning: 0,
    info: 1,
    success: 2,
  }
  insights.sort((a, b) => order[a.severity] - order[b.severity])

  return insights
}

export async function getDashboardRepositoryTotal(match: Record<string, unknown>): Promise<number> {
  const rows = await AcademicProduct.aggregate<{ n: number }>([{ $match: match }, { $count: 'n' }])
  return rows[0]?.n ?? 0
}
