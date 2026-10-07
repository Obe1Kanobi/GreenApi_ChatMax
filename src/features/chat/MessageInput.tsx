import { useState } from 'react'
import { IconButton, InputBase, Stack } from '@mui/material'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import GraphicEqIcon from '@mui/icons-material/GraphicEq'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt'

type MessageInputProps = {
  onSend: (text: string) => void
}

/**
 * Композер из mockup (chat_mockup.html, .composer):
 * абсолютно позиционирован внизу по центру ленты сообщений.
 */
export default function MessageInput({ onSend }: MessageInputProps) {
  const [value, setValue] = useState('')

  function handleSend() {
    const text = value.trim()
    if (!text) return
    onSend(text)
    setValue('')
  }

  return (
    <Stack
      direction="row"
      sx={{
        position: 'absolute',
        left: '50%',
        bottom: 14,
        transform: 'translateX(-50%)',
        width: 'min(72%, 720px)',
        height: 44,
        zIndex: 2,
        alignItems: 'center',
        px: 1.5,
        bgcolor: '#fff',
        borderRadius: 2.125,
        boxShadow: '0 2px 8px rgba(0,0,0,.08)',
        '@media (max-width: 1000px)': { width: '78%' },
        '@media (max-width: 760px)': { width: '92%', bottom: 10 },
      }}
    >
      <IconButton size="small" aria-label="Прикрепить" sx={{ color: '#93999e', mr: 0.875 }}>
        <AttachFileIcon sx={{ fontSize: 20 }} />
      </IconButton>

      <InputBase
        placeholder="Сообщение"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
          }
        }}
        sx={{
          flex: 1,
          fontSize: 15,
          '& input::placeholder': { color: '#a1a5a9', opacity: 1 },
        }}
      />

      <Stack direction="row" sx={{ gap: 1.75, color: '#8d9499' }}>
        <SentimentSatisfiedAltIcon sx={{ width: 20, height: 20 }} />
        <PhotoCameraIcon sx={{ width: 20, height: 20 }} />
        <GraphicEqIcon sx={{ width: 20, height: 20 }} />
      </Stack>
    </Stack>
  )
}