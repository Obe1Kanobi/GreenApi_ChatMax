import { Box } from '@mui/material'
import type { ChatMessage } from './types'

type MessageBubbleProps = {
  message: ChatMessage
}

/** Максимальная ширина пузыря по размеру (mockup: .msg, .msg.small/.medium/.wide) */
const SIZE_MAX_WIDTH: Record<NonNullable<ChatMessage['size']>, string> = {
  auto: '58%',
  small: '26%',
  medium: '48%',
  wide: '46%',
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const { direction, size = 'auto', quote, reaction, time, read, status } = message
  const out = direction === 'out'

  return (
    <Box
      sx={{
        position: 'relative',
        maxWidth: SIZE_MAX_WIDTH[size],
        mb: 1.125,
        px: 1.25,
        pt: 1.125,
        pb: 0.75,
        borderRadius: 1.75,
        fontSize: 14,
        lineHeight: 1.25,
        boxShadow: '0 1px 0 rgba(0,0,0,.06)',
        bgcolor: out ? '#dcf6ff' : '#fff',
        // Входящие — с отступом слева, исходящие — прижаты к правому краю
        ml: out ? 'auto' : '13%',
        '@media (max-width: 1000px)': {
          ml: out ? 'auto' : '18%',
          maxWidth: size === 'auto' ? '70%' : SIZE_MAX_WIDTH[size],
        },
        '@media (max-width: 760px)': {
          maxWidth: '82%',
          ml: out ? 'auto' : '8%',
        },
      }}
    >
      {quote && (
        <Box
          sx={{
            borderLeft: '3px solid',
            borderColor: quote.blue ? '#78c9f8' : '#f27a23',
            pl: 0.875,
            mb: 0.75,
            color: '#71787e',
            fontSize: 12,
          }}
        >
          {quote.author && (
            <Box
              component="b"
              sx={{
                display: 'block',
                color: quote.blue ? '#75bde9' : '#f27a23',
                fontSize: 12,
                mb: 0.375,
              }}
            >
              {quote.author}
            </Box>
          )}
          {quote.text}
        </Box>
      )}

      <Box sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.text}</Box>

      <Box
        sx={{
          float: 'right',
          ml: 1,
          mt: 0.25,
          fontSize: 10,
          lineHeight: 1,
          userSelect: 'none',
          color: out ? '#5a9cae' : '#8e999f',
        }}
      >
        {time}
        {out && status === 'sending' && (
          <Box component="span" sx={{ opacity: 0.6 }}>
            {' '}🕐
          </Box>
        )}
        {out && status === 'failed' && (
          <Box component="span" sx={{ color: '#e2574c' }}>
            {' '}⚠ не отправлено
          </Box>
        )}
        {out && status !== 'sending' && status !== 'failed' && read && (
          <Box component="span" sx={{ color: '#159ce8' }}>
            {' '}✓✓
          </Box>
        )}
      </Box>

      {reaction && (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            clear: 'both',
            mt: 0.625,
            px: 1.125,
            py: 0.5,
            borderRadius: 1.5,
            bgcolor: '#0a99df',
            color: '#fff',
            fontSize: 12,
          }}
        >
          <Box component="span" sx={{ fontSize: 14 }}>
            {reaction.emoji}
          </Box>
          {reaction.count}
        </Box>
      )}
    </Box>
  )
}