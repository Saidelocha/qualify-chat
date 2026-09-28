import chatConfig from '../../../../chat.config'
import { createQualifyHandler } from '@/lib/chat/handler'
import { createLeadSender, createProspectConfirmationSender } from '@/lib/chat/lead-email'
import { createUnderstander } from '@/lib/chat/understand'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const POST = createQualifyHandler({
  config: chatConfig,
  understand: createUnderstander(chatConfig),
  sendLead: createLeadSender(chatConfig),
  sendProspectConfirmation: createProspectConfirmationSender(chatConfig),
})

export { POST }
