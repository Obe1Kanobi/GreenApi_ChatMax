import { useState, type ReactNode } from 'react'
import { Box, CircularProgress, IconButton, InputBase, Stack, Tooltip } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ForumIcon from '@mui/icons-material/Forum'
import LogoutIcon from '@mui/icons-material/Logout'
import SearchIcon from '@mui/icons-material/Search'
import ChatListItem from './ChatListItem'
import type { ChatSummary } from './types'

type SidebarProps = {
  chats: ChatSummary[]
  /** Свежие чаты из журналов за 24 ч (этап 3) - выводятся вверху списка */
  recentChats?: ChatSummary[]
  selectedId: string | null
  /** Чаты с успешно загруженной историей (HTTP 200) - без блюра */
  loadedIds?: ReadonlySet<string>
  /**
   * Нормализованные chatId из объединения LastOutgoing/LastIncomingMessages,
   * совпавшие с контактами: такие чаты снимаются с блюра сразу, с превью
   * последнего сообщения, не дожидаясь загрузки истории.
   */
  matchedChatIds?: ReadonlySet<string>
  /** true - идёт сопоставление журналов / ожидание первых 5 GetChatHistory: спиннер */
  isLoading?: boolean
  onSelect: (id: string) => void
  onNewChat: () => void
  onLogout: () => void
}

type RailItemDef = {
  id: string
  label: string
  icon: ReactNode
}

/** Пункты левой рейки навигации (mockup: .rail-item) */
const RAIL_ITEMS: RailItemDef[] = [
  { id: 'all', label: 'Все', icon: <ForumIcon /> },
]

function RailItem({
  item,
  active,
  onClick,
}: {
  item: RailItemDef
  active: boolean
  onClick: () => void
}) {
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick()
      }}
      sx={{
        width: '100%',
        py: 1,
        textAlign: 'center',
        fontSize: 12,
        cursor: 'pointer',
        userSelect: 'none',
        color: active ? '#121416' : '#8a9095',
        '& svg': { display: 'block', margin: '0 auto 5px', fontSize: 25 },
      }}
    >
      {item.icon}
      {item.label}
    </Box>
  )
}

/** Логотип-«бомбочка» из mockup (mockup: .brand-mark) */
function BrandMark() {
  return (
    <Box
      sx={{
        height: 64,
        width: '100%',
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottom: '1px solid #e2e5e8',
      }}
    >
      <Box sx={{ position: 'relative', width: 32, height: 25 }}>
        <Box
          sx={{
            position: 'absolute',
            left: 2,
            top: 6,
            width: 20,
            height: 15,
            borderRadius: '6px',
            bgcolor: '#202326',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: 13,
            height: 13,
            borderRadius: '50%',
            bgcolor: '#0d83f8',
            boxShadow: '0 0 0 2px #fff',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            zIndex: 2,
            left: 7,
            top: 11,
            width: 4,
            height: 4,
            borderRadius: '50%',
            bgcolor: '#fff',
            boxShadow: '6px 0 #fff',
          }}
        />
      </Box>
    </Box>
  )
}

/**
 * Левая часть экрана: рейка навигации + список чатов.
 * Раскладка и размеры повторяют chat_mockup.html (.app: 70px 364px 1fr).
 */
export default function Sidebar({
  chats,
  recentChats = [],
  selectedId,
  loadedIds,
  matchedChatIds,
  isLoading = false,
  onSelect,
  onNewChat,
  onLogout,
}: SidebarProps) {
  const [activeRail, setActiveRail] = useState('all')

  const sortedChats = [...chats].sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0))

  const recentChatIds = new Set<string>()
  for (const chat of recentChats) {
    if (chat.chatId) recentChatIds.add(chat.chatId.trim().toLowerCase())
  }
  const otherChats = sortedChats.filter(
    (chat) => !chat.chatId || !recentChatIds.has(chat.chatId.trim().toLowerCase()),
  )

  return (
    <Stack direction="row" sx={{ height: '100%', flex: 'none' }}>
      <Stack
        sx={{
          width: 70,
          flex: 'none',
          alignItems: 'center',
          bgcolor: '#f7f8f9',
          borderRight: '1px solid #e2e5e8',
          '@media (max-width: 1000px)': { width: 60 },
          '@media (max-width: 760px)': { display: 'none' },
        }}
      >
        <BrandMark />
        {RAIL_ITEMS.map((item) => (
          <RailItem
            key={item.id}
            item={item}
            active={activeRail === item.id}
            onClick={() => setActiveRail(item.id)}
          />
        ))}
        <Box 
          sx={{ 
            height: 1, 
            width: 54, 
            my: 0.5 
          }} 
        />
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Выйти">
          <IconButton onClick={onLogout} sx={{ my: 1, color: '#8a9095' }}>
            <LogoutIcon sx={{ fontSize: 22 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      <Box
        sx={{
          width: 364,
          flex: 'none',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          bgcolor: '#fff',
          borderRight: '1px solid #e2e5e8',
          '@media (max-width: 1000px)': { width: 320 },
          '@media (max-width: 760px)': { width: '100%', flex: 1, borderRight: 'none' },
        }}
      >
        <Stack
          direction="row"
          sx={{
            height: 64,
            flex: 'none',
            alignItems: 'center',
            px: 1.5,
            gap: 1.25,
          }}
        >
          <Box sx={{ fontSize: 22, fontWeight: 700 }}>Чаты</Box>
          <IconButton
            onClick={onNewChat}
            aria-label="Новый чат"
            sx={{
              ml: 'auto',
              width: 32,
              height: 32,
              bgcolor: '#0c7ff4',
              color: '#fff',
              '&:hover': { bgcolor: '#0a6fd8' },
            }}
          >
            <AddIcon sx={{ fontSize: 22 }} />
          </IconButton>
        </Stack>

        <InputBase
          placeholder="Найти"
          startAdornment={<SearchIcon sx={{ fontSize: 18, color: '#8e9499', mr: 1 }} />}
          sx={{
            mx: 1.5,
            mb: 1.25,
            px: 1.5,
            height: 35,
            flex: 'none',
            bgcolor: '#f1f2f3',
            borderRadius: 3,
            fontSize: 15,
            color: '#8e9499',
            '& input::placeholder': { color: '#8e9499', opacity: 1 },
          }}
        />

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {isLoading && (
            <Stack sx={{ py: 2.5, alignItems: 'center' }}>
              <CircularProgress size={24} sx={{ color: '#0c7ff4' }} />
            </Stack>
          )}
          {[...recentChats, ...otherChats].map((chat) => {
            const normalized = chat.chatId?.trim().toLowerCase() ?? ''
            const matched = normalized !== '' && (matchedChatIds?.has(normalized) ?? false)
            return (
              <ChatListItem
                key={chat.id}
                chat={chat}
                selected={chat.id === selectedId}
                blurred={
                  Boolean(chat.chatId) &&
                  !(loadedIds?.has(chat.id) ?? false) &&
                  !matched
                }
                onClick={() => onSelect(chat.id)}
              />
            )
          })}
        </Box>
      </Box>
    </Stack>
  )
}