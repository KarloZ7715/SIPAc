import Notification from '~~/server/models/Notification'
import { NOTIFICATION_TYPES } from '~~/app/types'
import { ok } from '~~/server/utils/response'

function parseUnreadOnly(value: string | undefined): boolean {
  return value === 'true' || value === '1'
}

function parseLimit(value: string | undefined): number {
  if (!value) {
    return 20
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed)) {
    return 20
  }

  return Math.min(Math.max(parsed, 1), 50)
}

interface ParsedCursor {
  createdAt: Date
  id: string | null
}

function isValidCursorObjectId(value: string | null): value is string {
  return Boolean(value && /^[a-f0-9]{24}$/i.test(value))
}

function parseCursor(value: string | undefined): ParsedCursor | null {
  if (!value) {
    return null
  }

  const [rawDate, rawId] = value.includes('|') ? value.split('|', 2) : [value, null]
  const parsedDate = new Date(rawDate)

  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }

  return {
    createdAt: parsedDate,
    id: isValidCursorObjectId(rawId) ? rawId : null,
  }
}

function parseNotificationType(value: string | undefined) {
  if (!value || !NOTIFICATION_TYPES.includes(value as (typeof NOTIFICATION_TYPES)[number])) {
    return null
  }

  return value as (typeof NOTIFICATION_TYPES)[number]
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)
  const query = getQuery(event)
  const unreadOnly = parseUnreadOnly(
    typeof query.unreadOnly === 'string' ? query.unreadOnly : undefined,
  )
  const notificationType = parseNotificationType(
    typeof query.type === 'string' ? query.type : undefined,
  )
  const cursor = parseCursor(typeof query.cursor === 'string' ? query.cursor : undefined)
  const limit = parseLimit(typeof query.limit === 'string' ? query.limit : undefined)

  const cursorQuery: Record<string, unknown> =
    cursor && cursor.id
      ? {
          $or: [
            { createdAt: { $lt: cursor.createdAt } },
            {
              createdAt: cursor.createdAt,
              _id: { $lt: cursor.id },
            },
          ],
        }
      : cursor
        ? { createdAt: { $lt: cursor.createdAt } }
        : {}

  const findQuery: Record<string, unknown> = {
    recipientId: auth.sub,
    ...(unreadOnly ? { isRead: false } : {}),
    ...(notificationType ? { type: notificationType } : {}),
    ...cursorQuery,
  }

  const notifications = await Notification.find(findQuery)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)

  const lastNotification = notifications.at(-1)
  const nextCursor =
    notifications.length === limit && lastNotification?.createdAt
      ? `${lastNotification.createdAt.toISOString()}|${String(lastNotification._id)}`
      : null

  const unreadCount = await Notification.countDocuments({
    recipientId: auth.sub,
    isRead: false,
  })

  return ok({
    notifications: notifications.map((notification) =>
      (notification as { toJSON: () => unknown }).toJSON(),
    ),
    unreadCount,
    nextCursor,
  })
})
