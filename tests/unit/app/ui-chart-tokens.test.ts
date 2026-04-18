import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_CHART_AXIS_COLORS,
  DASHBOARD_CHART_COLORS,
  DASHBOARD_CHART_TOOLTIP_COLORS,
} from '~~/app/config/ui-chart-tokens'

describe('ui chart tokens', () => {
  it('provides reusable palette and semantic colors', () => {
    expect(DASHBOARD_CHART_COLORS.length).toBeGreaterThanOrEqual(8)
    expect(DASHBOARD_CHART_TOOLTIP_COLORS.background).toBeTruthy()
    expect(DASHBOARD_CHART_AXIS_COLORS.grid).toBeTruthy()
  })
})
