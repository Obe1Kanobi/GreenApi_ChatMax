import { Box } from '@mui/material'
import MessageBubble from './MessageBubble'
import type { ChatMessage } from './types'

type MessageListProps = {
  messages: ChatMessage[]
}

/**
 * Фон ленты - SVG-паттерн из mockup (chat_mockup.html, .messages).
 */
const MESSAGE_BG = `url("data:image/svg+xml,%3Csvg width='260' height='220' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%235eb6ed' stroke-width='2' opacity='.95'%3E%3Ccircle cx='35' cy='35' r='9'/%3E%3Cpath d='M15 85h42M27 73v24M33 73l15 12-15 12'/%3E%3Cpath d='M95 28l12 18-18-3zM140 50c15-12 30 0 30 0s-15 12-30 0z'/%3E%3Ccircle cx='220' cy='35' r='16'/%3E%3Cpath d='M215 20v30M205 30h30M215 35h10'/%3E%3Cpath d='M70 150l15-16 15 16-15 16zM22 180c9-9 18-9 27 0M125 170c18 0 20 20 20 20s-20 0-20-20z'/%3E%3Cpath d='M190 155h25l-8 14h-25zM210 155l10-14'/%3E%3Cpath d='M60 205c8-12 23-12 31 0M175 190l10 10 18-25'/%3E%3C/g%3E%3C/svg%3E")`

export default function MessageList({ messages }: MessageListProps) {
  return (
    <Box
      className="chat-messages"
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        p: '16px 12px 100px',
        bgcolor: '#7bc8f3',
        backgroundImage: MESSAGE_BG,
      }}
    >
      <Box className="chat-messages-inner">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </Box>
    </Box>
  )
}
