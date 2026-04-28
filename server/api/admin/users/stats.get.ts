import User from '~~/server/models/User'
import { requireRole } from '~~/server/utils/authorize'
import { ok } from '~~/server/utils/response'

/**
 * GET /api/admin/users/stats
 *
 * Returns global user statistics aggregated from the database.
 * Unlike the paginated users list, these counts are always accurate
 * regardless of current filters or pagination state.
 */
export default defineEventHandler(async (event) => {
  requireRole(event, 'admin')

  const [stats] = await User.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: ['$isActive', 1, 0] } },
        inactive: { $sum: { $cond: ['$isActive', 0, 1] } },
        admins: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
        docentes: { $sum: { $cond: [{ $eq: ['$role', 'docente'] }, 1, 0] } },
      },
    },
  ])

  return ok(stats ?? { total: 0, active: 0, inactive: 0, admins: 0, docentes: 0 })
})
