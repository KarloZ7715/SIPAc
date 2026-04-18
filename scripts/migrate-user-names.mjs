import mongoose from 'mongoose'

const uri = process.env.MONGODB_URI?.trim()
if (!uri) {
  throw new Error('MONGODB_URI es requerido para migrar nombres de usuario')
}

/**
 * Best-effort split of a single string into first/middle/last/secondLast.
 *
 * - 1 word   → firstName
 * - 2 words  → firstName + lastName
 * - 3 words  → firstName + lastName + secondLastName
 * - 4+ words → firstName + middleName (center) + lastName + secondLastName
 */
function splitFullName(fullName) {
  const words = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return {}
  if (words.length === 1) return { firstName: words[0] }
  if (words.length === 2) return { firstName: words[0], lastName: words[1] }
  if (words.length === 3) {
    return { firstName: words[0], lastName: words[1], secondLastName: words[2] }
  }
  const [first, ...rest] = words
  const secondLastName = rest.pop()
  const lastName = rest.pop()
  const middleName = rest.join(' ')
  return { firstName: first, middleName, lastName, secondLastName }
}

async function main() {
  await mongoose.connect(uri)
  const users = mongoose.connection.collection('users')

  const cursor = users.find({
    $or: [
      { firstName: { $in: [null, undefined, ''] } },
      { emailVerifiedAt: { $in: [null, undefined] } },
      { tokenVersion: { $in: [null, undefined] } },
      { twoFactorEnabled: { $in: [null, undefined] } },
    ],
  })

  let migrated = 0
  let verified = 0

  while (await cursor.hasNext()) {
    const user = await cursor.next()
    if (!user) break

    const update = {}

    if (!user.firstName) {
      const parts = splitFullName(user.fullName ?? '')
      Object.assign(update, {
        firstName: parts.firstName ?? '',
        middleName: parts.middleName ?? null,
        lastName: parts.lastName ?? null,
        secondLastName: parts.secondLastName ?? null,
      })
      migrated++
    }

    if (!user.emailVerifiedAt) {
      update.emailVerifiedAt = user.createdAt ?? new Date()
      verified++
    }

    if (user.tokenVersion == null) update.tokenVersion = 0
    if (user.twoFactorEnabled == null) update.twoFactorEnabled = false

    if (Object.keys(update).length > 0) {
      await users.updateOne({ _id: user._id }, { $set: update })
    }
  }

  console.info(`[migrate-user-names] nombres migrados: ${migrated}`)
  console.info(`[migrate-user-names] emailVerifiedAt backfill: ${verified}`)

  await mongoose.disconnect()
}

main().catch((error) => {
  console.error('[migrate-user-names] failed', error)
  process.exitCode = 1
})
