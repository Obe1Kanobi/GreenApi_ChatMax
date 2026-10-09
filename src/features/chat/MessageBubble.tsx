import { Box } from '@mui/material'
import type { ChatMessage } from './types'

type MessageBubbleProps = {
  message: ChatMessage
}

/** Максимальная ширина пузыря по размеру (mockup: .msg, .msg.small/.medium/.wide) */
const SIZE_MAX_WIDTH: Record<NonNullable<ChatMessage['size']>, string> = {
  auto: '64%',
  small: '30%',
  medium: '54%',
  wide: '52%',
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const { direction, size = 'auto', quote, reaction, time } = message
  const out = direction === 'out'

  return (
    <Box
      sx={{
        position: 'relative',
        width: 'fit-content',
        maxWidth: SIZE_MAX_WIDTH[size],
        mb: 1.125,
        ml: out ? 'auto' : '18%',
        mr: out ? 0 : 'auto',
        '@media (max-width: 1000px)': {
          ml: out ? 'auto' : '23%',
          maxWidth: size === 'auto' ? '76%' : SIZE_MAX_WIDTH[size],
        },
        '@media (max-width: 760px)': {
          maxWidth: '88%',
          ml: out ? 'auto' : '9%',
        },
      }}
    >
      <Box
        sx={{
          px: 1.875,
          pt: 1.125,
          pb: 1.125,
          borderRadius: 1.75,
          fontSize: 14,
          lineHeight: 1.25,
          boxShadow: '0 1px 0 rgba(0,0,0,.06)',
          bgcolor: out ? '#dcf6ff' : '#fff',
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

        {reaction && (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
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

      <Box
        sx={{
          mt: 0.375,
          fontSize: 10,
          lineHeight: 1,
          userSelect: 'none',
          textAlign: out ? 'left' : 'right',
          color: '#3f5560',
        }}
      >
        {time}
      </Box>
    </Box>
  )
}