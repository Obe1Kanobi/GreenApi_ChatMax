import { useCallback, useEffect, useState } from 'react'
import { Stack } from '@mui/material'
import LoginPage from './features/auth/LoginPage'
import ChatWindow from './features/chat/ChatWindow'
import Sidebar from './features/chats/Sidebar'
import NewChatForm from './features/chats/NewChatForm'
import type { ChatMessage } from './features/chat/types'
import type { ChatSummary } from './features/chats/types'
import {
  clearChatState,
  clearCredentials,
  loadChatState,
  loadCredentials,
  saveChatState,
} from './utils/storage'
import { checkAccount, getMessage, sendMessage } from './api/greenApi'
import { useChatHistoriesQueue } from './hooks/useChatHistoriesQueue'
import type { Credentials } from './api/types'


/** Текущее время HH:MM для отправленных сообщений */
function nowTime(): string {
  return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

/** UNIX-время (сек) → 'HH:MM' — для превью чатов из истории */
function formatStamp(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

/** Красивый вывод номера: 79991234567 → +7 (999) 123-45-67 */
function formatPhone(digits: string): string {
  if (digits.startsWith('7') && digits.length === 11) {
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`
  }
  return digits
}

export default function App() {
  const [creds, setCreds] = useState<Credentials | null>(() => loadCredentials())
  // Чаты переживают перезагрузку: состояние чатов хранится в localStorage,
  // история сообщений подтягивается опросом GetChatHistory.
  // Моковые данные убраны: стартуем с пустого списка, чаты появляются
  // через создание по номеру (CheckAccount); discovery новых чатов —
  // по входящим сообщениям в истории.
  // Демо-чаты из старых сессий (без chatId) отфильтровываем.
  const [chats, setChats] = useState<ChatSummary[]>(() =>
    (loadChatState()?.chats ?? []).filter((c) => Boolean(c.chatId)),
  )
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const persisted = loadChatState()
    if (!persisted) return null
    const exists = persisted.chats.some((c) => c.id === persisted.selectedId && c.chatId)
    return exists ? persisted.selectedId : null
  })
  const [messagesByChat, setMessagesByChat] = useState<Record<string, ChatMessage[]>>(
    () => loadChatState()?.messagesByChat ?? {},
  )
  const [newChatOpen, setNewChatOpen] = useState(false)

  // Сохраняем чаты при каждом изменении состояния
  useEffect(() => {
    saveChatState({ chats, messagesByChat, selectedId })
  }, [chats, messagesByChat, selectedId])

  function handleLogout() {
    clearCredentials()
    clearChatState()
    setCreds(null)
  }

  /**
   * Слияние результата опроса истории чата с локальным состоянием.
   * Обновляет и превью чата в сайдбаре по последнему сообщению.
   */
  const handleMerged = useCallback((chatSummaryId: string, merged: ChatMessage[]) => {
    setMessagesByChat((prev) => ({ ...prev, [chatSummaryId]: merged }))
    const last = merged[merged.length - 1]
    if (last) {
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatSummaryId
            ? { ...c, preview: last.text, time: last.ts ? formatStamp(last.ts) : c.time }
            : c,
        ),
      )
    }
  }, [])

  /**
   * Очередь запросов GetChatHistory (см. useChatHistoriesQueue):
   * все чаты опрашиваются по очереди раз в 10 с, открытый — первым,
   * между запросами пауза 0.7 с — без 429. Видно и наши сообщения,
   * и сообщения собеседника; у чатов без chatId опрос выключен.
   */
  const histories = useChatHistoriesQueue({
    creds,
    chats,
    selectedId,
    messagesByChat,
    onMerged: handleMerged,
  })

  /** Выбор чата: сохранённые сообщения показываются сразу,
   * история подтягивается очередью useChatHistoriesQueue */
  function handleSelectChat(id: string) {
    setSelectedId(id)
    // Сбрасываем счётчик непрочитанных у открытого чата
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)))
  }

  /**
   * Отправка сообщения: POST ${apiUrl}/waInstance${idInstance}/sendMessage/${apiTokenInstance}
   * (README, раздел 5; docs: green-api.com/v3/docs/api/sending/SendMessage).
   * Добавляем сообщение локально сразу (status 'sending'), затем обновляем
   * статус по результату запроса. У демо-чатов без chatId API не вызывается.
   */
  async function handleSend(text: string) {
    const selected = selectedId
    if (!selected) return
    const localId = `local-${Date.now()}`
    const chatId = chats.find((c) => c.id === selected)?.chatId

    // Оптимистично показываем сообщение в ленте
    setMessagesByChat((prev) => {
      const list = prev[selected] ?? []
      const message: ChatMessage = {
        id: localId,
        direction: 'out',
        text,
        time: nowTime(),
        read: false,
        status: chatId ? 'sending' : 'sent',
      }
      return { ...prev, [selected]: [...list, message] }
    })
    setChats((prev) =>
      prev.map((c) => (c.id === selected ? { ...c, preview: text, time: 'сейчас' } : c)),
    )

    // Демо-чат без chatId — дальше только локально
    if (!creds || !chatId) return

    try {
      const res = await sendMessage(creds, chatId, text)
      setMessagesByChat((prev) => ({
        ...prev,
        [selected]: (prev[selected] ?? []).map((m) =>
          m.id === localId ? { ...m, id: res.idMessage, status: 'sent' } : m,
        ),
      }))
      // GetMessage: уточняем доставку/прочтение отправленного сообщения
      void confirmDelivery(selected, chatId, res.idMessage)
    } catch {
      setMessagesByChat((prev) => ({
        ...prev,
        [selected]: (prev[selected] ?? []).map((m) =>
          m.id === localId ? { ...m, status: 'failed' } : m,
        ),
      }))
    }
  }

  /**
   * POST getMessage: через паузу уточняем статус отправленного сообщения
   * (sent / delivered / read). Ошибки игнорируем — статус всё равно
   * обновится при следующем опросе истории.
   */
  function confirmDelivery(chatSummaryId: string, chatId: string, idMessage: string) {
    if (!creds) return
    setTimeout(async () => {
      try {
        const msg = await getMessage(creds, chatId, idMessage)
        if (msg.statusMessage === 'read') {
          setMessagesByChat((prev) => ({
            ...prev,
            [chatSummaryId]: (prev[chatSummaryId] ?? []).map((m) =>
              m.id === idMessage ? { ...m, read: true } : m,
            ),
          }))
        }
      } catch {
        // сообщение ещё в очереди или недоступно — не критично
      }
    }, 3000)
  }

  /**
   * Создание чата: CheckAccount (POST .../checkAccount) переводит
   * номер телефона в chatId (README, раздел 7).
   */
  async function handleCreateChat(phone: string) {
    if (!creds) throw new Error('Нет данных авторизации')
    const { exist, chatId } = await checkAccount(creds, Number(phone))
    if (!exist) {
      throw new Error('Аккаунт MAX с таким номером не найден')
    }

    const id = `local-${phone}`
    setChats((prev) => {
      if (prev.some((c) => c.id === id)) return prev
      const chat: ChatSummary = {
        id,
        chatId,
        name: formatPhone(phone),
        avatar: { bg: '#54a84a', text: phone.slice(-2).toUpperCase(), fontSize: 16 },
        preview: 'Нет сообщений',
        time: 'сейчас',
      }
      return [chat, ...prev]
    })
    setMessagesByChat((prev) => ({ ...prev, [id]: [] }))
    setSelectedId(id)
    setNewChatOpen(false)
    // История созданного чата подтянется очередью useChatHistoriesQueue
  }

  if (!creds) {
    return <LoginPage onLogin={setCreds} />
  }

  const selectedChat = chats.find((c) => c.id === selectedId) ?? null
  const selectedMessages = selectedId ? (messagesByChat[selectedId] ?? []) : []

  return (
    <>
      <Stack direction="row" sx={{ height: '100vh', bgcolor: '#fff', overflow: 'hidden' }}>
        <Sidebar
          chats={chats}
          selectedId={selectedId}
          onSelect={handleSelectChat}
          onNewChat={() => setNewChatOpen(true)}
          onLogout={handleLogout}
        />
        <ChatWindow
          chat={selectedChat}
          messages={selectedMessages}
          loadingHistory={histories.isFetchingSelected}
          onSend={handleSend}
        />
      </Stack>
      <NewChatForm
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onCreate={handleCreateChat}
      />
    </>
  )
}
