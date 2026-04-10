import mongoose from 'mongoose'

const uri = process.env.MONGODB_URI?.trim()

if (!uri) {
  throw new Error('MONGODB_URI es requerido para migrar índices de ChatConversation')
}

async function main() {
  await mongoose.connect(uri)

  const collection = mongoose.connection.collection('chatconversations')
  const indexes = await collection.indexes()

  const legacyChatIdIndex = indexes.find((index) => {
    const keys = Object.keys(index.key ?? {})
    return keys.length === 1 && keys[0] === 'chatId'
  })

  if (legacyChatIdIndex?.name) {
    await collection.dropIndex(legacyChatIdIndex.name)
    console.info(`[chat-index] dropped legacy index ${legacyChatIdIndex.name}`)
  }

  const hasCompoundIndex = indexes.some((index) => index.name === 'ux_user_chat')
  if (!hasCompoundIndex) {
    await collection.createIndex({ userId: 1, chatId: 1 }, { unique: true, name: 'ux_user_chat' })
    console.info('[chat-index] created ux_user_chat')
  }

  await mongoose.disconnect()
}

main().catch((error) => {
  console.error('[chat-index] migration failed', error)
  process.exitCode = 1
})
