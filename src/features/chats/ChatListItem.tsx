import { Avatar, Box, Stack } from '@mui/material'
import type { ChatSummary } from './types'

type ChatListItemProps = {
  chat: ChatSummary
  selected: boolean
  /** true - история чата ещё не загружена (нет HTTP 200): содержимое размыто */
  blurred?: boolean
  onClick: () => void
}

/** Одна строка списка чатов (mockup: .chat-row) */
export default function ChatListItem({
  chat,
  selected,
  blurred = false,
  onClick,
}: ChatListItemProps) {
  return (
    <Stack
      direction="row"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick()
      }}
      sx={{
        height: 76,
        px: 1.5,
        cursor: 'pointer',
        bgcolor: selected ? '#e7f3ff' : 'transparent',
        transition: 'background-color 0.15s',
        '&:hover': { bgcolor: selected ? '#e7f3ff' : '#f4f5f6' },
      }}
    >
      <Stack
        direction="row"
        sx={{
          flex: 1,
          minWidth: 0,
          gap: 1.25,
          alignItems: 'center',
          filter: blurred ? 'blur(5px)' : 'none',
          opacity: blurred ? 0.55 : 1,
          transition: 'filter 0.35s ease, opacity 0.35s ease',
        }}
      >
        <Avatar
          sx={{
            width: 50,
            height: 50,
            flex: 'none',
            bgcolor: chat.avatar.bg,
            color: chat.avatar.color ?? '#fff',
            fontWeight: 700,
            fontSize: chat.avatar.fontSize ?? 20,
            border: chat.avatar.border,
          }}
        >
          {chat.avatar.text}
        </Avatar>

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box
            sx={{
              fontSize: 14,
              fontWeight: 700,
              mb: 0.5,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {chat.name}
            {chat.marker && (
              <Box component="span" sx={{ color: chat.marker.color }}>
                {chat.marker.symbol}
              </Box>
            )}
          </Box>
          <Box
            sx={{
              fontSize: 14,
              color: '#92979c',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {chat.preview}
          </Box>
        </Box>

        <Box
          sx={{
            alignSelf: 'flex-start',
            pt: 1.5,
            fontSize: 12,
            color: '#999da0',
            whiteSpace: 'nowrap',
          }}
        >
          {chat.read && (
            <Box component="span" sx={{ color: '#0d8cff', fontSize: 14, mr: 0.375 }}>
              ✓✓
            </Box>
          )}
          {chat.time}
          {chat.unread ? (
            <Box
              component="span"
              sx={{
                display: 'inline-grid',
                placeItems: 'center',
                width: 19,
                height: 19,
                ml: 0.875,
                borderRadius: '50%',
                bgcolor: '#0d83fb',
                color: '#fff',
                fontSize: 12,
              }}
            >
              {chat.unread}
            </Box>
          ) : null}
        </Box>
      </Stack>
    </Stack>
  )
}
