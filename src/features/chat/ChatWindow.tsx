import { Avatar, Box, IconButton, LinearProgress, Stack, Typography } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import type { ChatSummary } from '../chats/types'
import MessageInput from './MessageInput'
import MessageList from './MessageList'
import type { ChatMessage } from './types'

type ChatWindowProps = {
  chat: ChatSummary | null
  messages: ChatMessage[]
  loadingHistory?: boolean
  historyLoaded?: boolean
  onSend: (text: string) => void
  onBack?: () => void
}

/**
 * Окно одного чата (mockup: .main): топбар + лента сообщений + композер.
 */
export default function ChatWindow({
  chat,
  messages,
  loadingHistory,
  historyLoaded = true,
  onSend,
  onBack,
}: ChatWindowProps) {
  if (!chat) {
    return (
      <Stack
        sx={{
          flex: 1,
          minWidth: 0,
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#f3f5f7',
        }}
      >
        <Typography sx={{ color: '#8b9298', fontSize: 15 }}>
          Выберите чат или создайте новый
        </Typography>
      </Stack>
    )
  }

  return (
    <Stack sx={{ 
      flex: 1, 
      minWidth: 0, 
      position: 'relative', 
      bgcolor: '#7fc9f4', 
      minHeight: 0 
    }}>
      <Stack
        direction="row"
        sx={{
          height: 62,
          flex: 'none',
          alignItems: 'center',
          px: '10px 10px 0 18px',
          gap: 1.75,
          bgcolor: '#fff',
          borderBottom: '1px solid #e2e5e8',
        }}
      >
        <IconButton aria-label="Назад" 
          onClick={onBack} 
          sx={{ 
            p: 0.5, 
            color: '#222' 
          }}>
          <ChevronLeftIcon sx={{ fontSize: 28 }} />
        </IconButton>

        <Stack direction="row" 
          sx={{ 
            alignItems: 'center', 
            gap: 1.25, 
            minWidth: 0 
            }}>
          <Avatar
            sx={{
              width: 38,
              height: 38,
              background: 'linear-gradient(135deg,#ffd6b0,#ad7254)',
              border: '1px solid #ddd',
            }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: 15, fontWeight: 700 }}>
              {chat.name}
            </Typography>
            <Typography 
              sx={{ 
                fontSize: 11, 
                color: '#989ea3', 
                mt: 0.25 
              }}>
                Недавно
              </Typography>
          </Box>
        </Stack>
      </Stack>

      {loadingHistory && (
        <LinearProgress 
          sx={{ 
            position: 'absolute', 
            top: 62, 
            left: 0, 
            right: 0, 
            zIndex: 2 
          }} />
      )}

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          filter: historyLoaded ? 'none' : 'blur(6px)',
          opacity: historyLoaded ? 1 : 0.6,
          transition: 'filter 0.35s ease, opacity 0.35s ease',
          pointerEvents: historyLoaded ? 'auto' : 'none',
        }}
      >
        <MessageList messages={messages} />
      </Box>

      <Box className="chat-fade" />

      {historyLoaded ? <MessageInput onSend={onSend} /> : null}
    </Stack>
  )
}
