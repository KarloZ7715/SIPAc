import { ok } from '~~/server/utils/response'
import {
  getDefaultChatModelOptions,
  getDisabledChatModelOptions,
  getManualChatModelOptions,
} from '~~/server/services/chat/model-selection'

export default defineEventHandler(async (event) => {
  requireAuth(event)

  return ok({
    defaultChain: getDefaultChatModelOptions(),
    manualOptions: getManualChatModelOptions(),
    disabledOptions: getDisabledChatModelOptions(),
  })
})
