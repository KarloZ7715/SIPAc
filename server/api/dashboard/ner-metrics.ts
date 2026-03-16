import { defineEventHandler } from 'h3'
import AcademicProductModel from '~~/server/models/AcademicProduct'
import { PRODUCT_METADATA_LAYOUT } from '~~/app/utils/product-metadata-layout'
import type { ProductType, IUploadedFile } from '~~/app/types'

export default defineEventHandler(async (_event) => {
  const products = await AcademicProductModel.find({ isDeleted: false })
    .populate<{ sourceFile: IUploadedFile }>('sourceFile')
    .lean()

  const overall = {
    totalProducts: products.length,
    classificationSource: {
      heuristic: 0,
      llm: 0,
      hybrid: 0,
      uncertain: 0,
      total: 0,
    },
    extractionConfidenceHistogram: {
      '0.0-0.2': 0,
      '0.2-0.4': 0,
      '0.4-0.6': 0,
      '0.6-0.8': 0,
      '0.8-1.0': 0,
    },
    manualCorrections: {
      totalCommonFields: 0,
      correctedFields: 0,
      correctionRate: 0,
    },
    emptyRequiredFields: {
      totalRequired: 0,
      emptyRequired: 0,
      emptyRate: 0,
    },
  }

  const byProductType: Record<
    string,
    {
      total: number
      requiredTotal: number
      requiredEmpty: number
      requiredEmptyRate: number
      fieldCoverage: Record<string, { total: number; filled: number; coverage: number }>
    }
  > = {}

  for (const product of products) {
    const pType = product.productType as ProductType
    if (!byProductType[pType]) {
      byProductType[pType] = {
        total: 0,
        requiredTotal: 0,
        requiredEmpty: 0,
        requiredEmptyRate: 0,
        fieldCoverage: {},
      }
    }
    const typeMetrics = byProductType[pType]
    typeMetrics.total++

    const layout = PRODUCT_METADATA_LAYOUT[pType] || []

    // 1. Coverage
    for (const field of layout) {
      const fieldName = (field.name || field.id) as string
      if (!typeMetrics.fieldCoverage[fieldName]) {
        typeMetrics.fieldCoverage[fieldName] = { total: 0, filled: 0, coverage: 0 }
      }
      typeMetrics.fieldCoverage[fieldName].total++

      // Check if filled
      // Note: base fields are in manualMetadata, specific fields are at root
      // EventOrJournal is an exception, it maps to journalName, eventName, etc.
      let isFilled = false
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const manualMeta = (product.manualMetadata as Record<string, any>) || {}

      if (fieldName in manualMeta) {
        const val = manualMeta[fieldName]
        isFilled = Array.isArray(val) ? val.length > 0 : !!val
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const val = (product as Record<string, any>)[fieldName]
        isFilled = Array.isArray(val) ? val.length > 0 : !!val
      }

      if (isFilled) {
        typeMetrics.fieldCoverage[fieldName].filled++
      }

      if (field.level === 'required') {
        typeMetrics.requiredTotal++
        overall.emptyRequiredFields.totalRequired++
        if (!isFilled) {
          typeMetrics.requiredEmpty++
          overall.emptyRequiredFields.emptyRequired++
        }
      }
    }

    // 2. Classification Source
    const sourceFile = product.sourceFile
    if (sourceFile) {
      if (sourceFile.documentClassificationSource === 'heuristic')
        overall.classificationSource.heuristic++
      else if (sourceFile.documentClassificationSource === 'llm') overall.classificationSource.llm++
      else if (sourceFile.documentClassificationSource === 'hybrid')
        overall.classificationSource.hybrid++
      else overall.classificationSource.uncertain++

      overall.classificationSource.total++
    }

    // 3. Extraction Confidence Histogram
    const conf = product.extractedEntities?.extractionConfidence ?? 0
    if (conf < 0.2) overall.extractionConfidenceHistogram['0.0-0.2']++
    else if (conf < 0.4) overall.extractionConfidenceHistogram['0.2-0.4']++
    else if (conf < 0.6) overall.extractionConfidenceHistogram['0.4-0.6']++
    else if (conf < 0.8) overall.extractionConfidenceHistogram['0.6-0.8']++
    else overall.extractionConfidenceHistogram['0.8-1.0']++

    // 4. Manual Corrections (only common fields stored in manualMetadata vs extractedEntities)
    const extracted = product.extractedEntities || {}
    const manual = product.manualMetadata || {}

    const commonKeys = ['title', 'institution', 'date', 'doi']
    for (const key of commonKeys) {
      overall.manualCorrections.totalCommonFields++
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const extVal = (extracted as any)[key]?.value
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let manVal = (manual as any)[key]
      if (manVal instanceof Date) {
        manVal = manVal.toISOString()
        const extDate = extVal ? new Date(extVal) : null
        const extStr = extDate && !isNaN(extDate.getTime()) ? extDate.toISOString() : undefined
        if (manVal !== extStr && !!manVal !== !!extStr) {
          overall.manualCorrections.correctedFields++
        } else if (manVal !== extStr && extStr) {
          overall.manualCorrections.correctedFields++
        }
      } else {
        if ((manVal ?? '') !== (extVal ?? '')) {
          overall.manualCorrections.correctedFields++
        }
      }
    }
  }

  // Calculate rates
  overall.emptyRequiredFields.emptyRate =
    overall.emptyRequiredFields.totalRequired > 0
      ? overall.emptyRequiredFields.emptyRequired / overall.emptyRequiredFields.totalRequired
      : 0

  overall.manualCorrections.correctionRate =
    overall.manualCorrections.totalCommonFields > 0
      ? overall.manualCorrections.correctedFields / overall.manualCorrections.totalCommonFields
      : 0

  for (const mt of Object.values(byProductType)) {
    mt.requiredEmptyRate = mt.requiredTotal > 0 ? mt.requiredEmpty / mt.requiredTotal : 0
    for (const fc of Object.values(mt.fieldCoverage)) {
      fc.coverage = fc.total > 0 ? fc.filled / fc.total : 0
    }
  }

  return {
    overall,
    byProductType,
  }
})
