import { buildDashboardRepositoryMatch } from '~~/server/utils/dashboard-repository-match'
import {
  computeDashboardInsights,
  getDashboardRepositoryTotal,
} from '~~/server/services/dashboard/compute-dashboard-insights'
import type { DashboardInsightItem } from '~~/app/types'
import { ok } from '~~/server/utils/response'

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const query = getQuery(event)
  const { match } = buildDashboardRepositoryMatch(auth, query as Record<string, unknown>)

  const totalFiltered = await getDashboardRepositoryTotal(match)
  const insights: DashboardInsightItem[] = await computeDashboardInsights(match, totalFiltered)

  return ok(insights)
})
