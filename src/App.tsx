import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Stack } from '@mui/material'
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
import {
  useCheckAccountMutation,
  useGetMessageMutation,
  useReadChatMutation,
  useSendMessageMutation,
} from './api/queries'
import { NotRegisteredError } from './api/greenApi'
import { useChatHistories } from './hooks/useChatHistories'
import { useContactDiscovery } from './hooks/useContactDiscovery'
import { useNotificationPolling } from './hooks/useNotificationPolling'
import { useRecentChats } from './hooks/useRecentChats'
import type { ParsedNotification } from './utils/parseNotification'
import type { ContactItem, Credentials } from './api/types'


/** Текущее время HH:MM для отправленных сообщений */
function nowTime(): string {
  return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

/** UNIX-время (сек) → 'HH:MM' - для превью чатов из истории */
function formatStamp(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

/** UNIX-время (сек) → 'HH:MM' для сегодняшних сообщений, иначе дата ('6 окт.') */
function formatChatListTime(ts: number): string {
  const date = new Date(ts * 1000)
  if (date.toDateString() === new Date().toDateString()) return formatStamp(ts)
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

/** Красивый вывод номера: 79991234567 → +7 (999) 123-45-67 */
function formatPhone(digits: string): string {
  if (digits.startsWith('7') && digits.length === 11) {
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`
  }
  return digits
}

/** id оптимистичного сообщения: `local-${Date.now()}` (Date.now impure -
 * вызывается на уровне модуля, не в теле компонента) */
function makeLocalId(): string {
  return `local-${Date.now()}`
}

/** Текущее UNIX-время в секундах (Date.now impure - вызывается на уровне модуля) */
function nowUnix(): number {
  return Math.floor(Date.now() / 1000)
}

export default function App() {
  const [creds, setCreds] = useState<Credentials | null>(() => loadCredentials())
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
  const [mobileChatOpen, setMobileChatOpen] = useState(false)

  useEffect(() => {
    saveChatState({ chats, messagesByChat, selectedId })
  }, [chats, messagesByChat, selectedId])

  function handleLogout() {
    clearCredentials()
    clearChatState()
    setCreds(null)
  }

  const selectedIdRef = useRef(selectedId)
  useEffect(() => {
    selectedIdRef.current = selectedId
  })
  const chatsRef = useRef(chats)
  useEffect(() => {
    chatsRef.current = chats
  })

  const readChatMutation = useReadChatMutation()
  const sendMessageMutation = useSendMessageMutation()
  const getMessageMutation = useGetMessageMutation()
  const checkAccountMutation = useCheckAccountMutation()

  /**
   * POST readChat: отмечаем чат прочитанным в ИНСТАНСЕ (все сообщения).
   * Вызывается при открытии чата и при приходе новых входящих в открытый чат.
   */
  const markChatRead = useCallback(
    (summaryId: string) => {
      if (!creds) return
      const chat = chatsRef.current.find((c) => c.id === summaryId)
      if (!chat?.chatId) return
      readChatMutation
        .mutateAsync({ creds, chatId: chat.chatId })
        .catch((e: unknown) => console.warn('[App] readChat failed:', e))
    },
    [creds, readChatMutation],
  )

  /**
   * Слияние результата опроса истории чата (GetChatHistory) с локальным состоянием.
   * Обновляет превью, время последнего сообщения (для сортировки списка)
   * и счётчик непрочитанных.
   *
   * Непрочитанные считаются ТОЛЬКО по флагу isRead из GetChatHistory:
   * элемент с isRead === false - непрочитан, true/undefined - прочитан.
   * Счётчик АБСОЛЮТНЫЙ (сколько непрочитанных в чате сейчас), а не накопительный:
   * он не суммируется с журнальным unreadByChat (useRecentChats) и уведомлениями,
   * иначе прочитанные сообщения истории показывали бы цифру повторно.
   * Если непрочитанные есть в ОТКРЫТОМ чате - счётчик 0 и readChat в инстансе.
   */
  const handleMerged = useCallback(
    (chatSummaryId: string, merged: ChatMessage[]) => {
      setMessagesByChat((prev) => ({ ...prev, [chatSummaryId]: merged }))

      const last = merged[merged.length - 1]
      const selected = selectedIdRef.current

      const unreadCount = merged.filter(
        (m) => m.direction === 'in' && m.read !== true,
      ).length

      if (chatSummaryId === selected && unreadCount > 0) {
        markChatRead(chatSummaryId)
      }

      setChats((prev) =>
        prev.map((c) =>
          c.id === chatSummaryId
            ? {
                ...c,
                preview: last?.text ?? c.preview,
                time: last?.ts ? formatStamp(last.ts) : c.time,
                lastTs: last?.ts ?? c.lastTs,
                unread: chatSummaryId === selected ? 0 : unreadCount,
              }
            : c,
        ),
      )
    },
    [markChatRead],
  )

  /**
   * Discovery новых чатов: GetContacts раз в 60 с. В список добавляются
   * только новые собеседники (в т.ч. те, кто написал первым); их историю
   * далее подхватывает очередь GetChatHistory.
   */
  const handleContacts = useCallback((contacts: ContactItem[]) => {
    if (!contacts.length) return
    setChats((prev) => {
      const known = new Set(prev.map((c) => c.chatId))
      const additions: ChatSummary[] = []
      for (const c of contacts) {
        if (!c.chatId || known.has(c.chatId)) continue
        const digits =
          c.phoneNumber && c.phoneNumber > 0 ? String(c.phoneNumber) : c.chatId.replace(/@.*/, '')
        const name = c.contactName || c.name || formatPhone(digits)
        additions.push({
          id: `contact-${c.chatId}`,
          chatId: c.chatId,
          name,
          avatar: { bg: '#7bc8f3', text: name.slice(0, 2).toUpperCase(), fontSize: 16 },
          preview: 'Нет сообщений',
          time: '',
        })
      }
      return additions.length ? [...additions, ...prev] : prev
    })
  }, [])

  const discovery = useContactDiscovery({ creds, onContacts: handleContacts, enabled: Boolean(creds) })

  /**
   * Этап 3: свежие чаты из журналов LastIncoming/LastOutgoing за 24 ч.
   * Строго ПОСЛЕ getContacts (в useRecentChats застворено contactsReady),
   * и ДО GetChatHistory (в useChatHistories застворено journalsSettled):
   * порядок запросов - getContacts → Last*Messages → GetChatHistory.
   */
  const {
    recentChats,
    unreadByChat,
    isSettled: journalsSettled,
  } = useRecentChats({
    creds,
    contacts: discovery.contacts,
    enabled: Boolean(creds),
  })

  const recentChatIds = useMemo(() => recentChats.map((r) => r.chatId), [recentChats])

  const matchedChatIds = useMemo(
    () => new Set<string>(recentChatIds),
    [recentChatIds],
  )

  const recentChatSummaries = useMemo<ChatSummary[]>(() => {
    return recentChats.map((recent) => {
      const existing = chats.find(
        (c) => c.chatId && c.chatId.trim().toLowerCase() === recent.chatId,
      )
      const digits = recent.chatId.replace(/@.*/, '')
      const name =
        recent.contact?.contactName || recent.contact?.name || existing?.name || formatPhone(digits)
      const time = formatChatListTime(recent.lastMessage.timestamp)
      const summary: ChatSummary = {
        id: existing?.id ?? `recent-${recent.chatId}`,
        chatId: recent.chatId,
        name,
        avatar: existing?.avatar ?? {
          bg: '#7bc8f3',
          text: name.slice(0, 2).toUpperCase(),
          fontSize: 16,
        },
        preview: recent.lastMessage.text,
        time,
        lastTs: recent.lastMessage.timestamp,
        read: recent.lastMessage.type === 'outgoing',
        unread: existing?.unread ?? unreadByChat[recent.chatId],
      }
      return existing && (existing.lastTs ?? 0) >= recent.lastMessage.timestamp
        ? existing
        : summary
    })
  }, [recentChats, chats, unreadByChat])

  const recentSummariesRef = useRef(recentChatSummaries)
  useEffect(() => {
    recentSummariesRef.current = recentChatSummaries
  })

  /**
   * Входящие уведомления (FIFO receiveNotification) - мгновенный канал.
   * Сообщение появляется в UI сразу (превью, чат создаётся при отсутствии),
   * не дожидаясь опроса истории. Дедуп по idMessage: то же сообщение позже
   * придёт и через GetChatHistory.
   *
   * Счётчик непрочитанных здесь НЕ увеличиваем: уведомление не несёт isRead,
   * а в FIFO-очереди на старте сессии лежат старые сообщения, которые уже
   * есть в GetChatHistory. Непрочитанные считаются только по isRead из
   * GetChatHistory (handleMerged) и журналов Last* (unreadByChat
   * в useRecentChats) - уведомления цифру не задают.
   */
  const handleNotification = useCallback(
    (event: ParsedNotification) => {
      if (event.kind === 'outgoing-status' || event.kind === 'outgoing-echo') {
        const summaryId = chatsRef.current.find(
          (c) => c.chatId && c.chatId.trim().toLowerCase() === event.chatId.trim().toLowerCase(),
        )?.id
        if (!summaryId) return
        setMessagesByChat((prev) => {
          const list = prev[summaryId]
          if (!list) return prev
          return {
            ...prev,
            [summaryId]: list.map((m) => {
              if (m.id !== event.idMessage) return m
              if (event.kind === 'outgoing-echo') {
                return m.status === 'sending' ? { ...m, status: 'sent' } : m
              }
              if (event.status === 'read') {
                return { ...m, status: 'read', read: true }
              }
              return m.status === 'sending' ? { ...m, status: 'sent' } : m
            }),
          }
        })
        return
      }

      if (event.kind !== 'incoming-message') return

      const chatId = event.chatId
      const summaryId =
        chatsRef.current.find(
          (c) => c.chatId && c.chatId.trim().toLowerCase() === chatId.trim().toLowerCase(),
        )?.id ?? `remote-${chatId}`
      const message: ChatMessage = {
        id: event.message.id,
        direction: 'in',
        text: event.message.text,
        time: formatStamp(event.message.timestamp),
        ts: event.message.timestamp,
        read: false,
      }

      setMessagesByChat((prev) => {
        const list = prev[summaryId] ?? []
        if (list.some((m) => m.id === message.id)) return prev
        return { ...prev, [summaryId]: [...list, message] }
      })

      setChats((prev) => {
        if (prev.some((c) => c.id === summaryId)) {
          return prev.map((c) =>
            c.id === summaryId
              ? {
                  ...c,
                  preview: message.text,
                  time: formatStamp(event.message.timestamp),
                  lastTs: event.message.timestamp,
                }
              : c,
          )
        }
        const digits = chatId.replace(/@.*/, '')
        const name = event.chatName ?? event.phone ?? formatPhone(digits)
        const newChat: ChatSummary = {
          id: summaryId,
          chatId,
          name,
          avatar: { bg: '#7bc8f3', text: name.slice(0, 2).toUpperCase(), fontSize: 16 },
          preview: message.text,
          time: formatStamp(event.message.timestamp),
          lastTs: event.message.timestamp,
        }
        return [newChat, ...prev]
      })

      if (selectedIdRef.current === summaryId) markChatRead(summaryId)
    },
    [markChatRead],
  )

  useNotificationPolling({ creds, onNotification: handleNotification, enabled: Boolean(creds) })

  const histories = useChatHistories({
    creds,
    chats,
    selectedId,
    messagesByChat,
    onMerged: handleMerged,
    recentChatIds,
    ready: journalsSettled,
  })

  const chatsWithChatIdCount = chats.filter((c) => c.chatId).length
  const historyTarget = Math.min(5, chatsWithChatIdCount)
  const isListLoading =
    (discovery.contacts !== undefined && !journalsSettled) ||
    (journalsSettled && recentChats.length === 0 &&
      historyTarget > 0 && histories.loadedIds.size < historyTarget)

  /** Выбор чата: сохранённые сообщения показываются сразу,
   * история загружена однократно при старте (useChatHistories) */
  function handleSelectChat(id: string) {
    if (!chatsRef.current.some((c) => c.id === id)) {
      const recent = recentSummariesRef.current.find((c) => c.id === id)
      if (recent) {
        setChats((prev) => (prev.some((c) => c.id === id) ? prev : [recent, ...prev]))
      }
    }
    const hasUnread = (chats.find((c) => c.id === id)?.unread ?? 0) > 0
    setSelectedId(id)
    setMobileChatOpen(true)
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)))
    if (hasUnread) markChatRead(id)
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
    const localId = makeLocalId()
    const chatId = chats.find((c) => c.id === selected)?.chatId

    const ts = nowUnix()
    setMessagesByChat((prev) => {
      const list = prev[selected] ?? []
      const message: ChatMessage = {
        id: localId,
        direction: 'out',
        text,
        time: nowTime(),
        ts,
        read: false,
        status: chatId ? 'sending' : 'sent',
      }
      return { ...prev, [selected]: [...list, message] }
    })
    setChats((prev) =>
      prev.map((c) =>
        c.id === selected
          ? { ...c, preview: text, time: 'сейчас', lastTs: ts, unread: 0 }
          : c,
      ),
    )

    if (!creds || !chatId) return

    try {
      const res = await sendMessageMutation.mutateAsync({ creds, chatId, message: text })
      setMessagesByChat((prev) => ({
        ...prev,
        [selected]: (prev[selected] ?? []).map((m) =>
          m.id === localId ? { ...m, id: res.idMessage, status: 'sent' } : m,
        ),
      }))
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
   * (sent / delivered / read). Ошибки игнорируем - статус всё равно
   * обновится при следующем опросе истории.
   */
  function confirmDelivery(chatSummaryId: string, chatId: string, idMessage: string) {
    if (!creds) return
    setTimeout(async () => {
      try {
        const msg = await getMessageMutation.mutateAsync({ creds, chatId, idMessage })
        if (msg.statusMessage === 'read') {
          setMessagesByChat((prev) => ({
            ...prev,
            [chatSummaryId]: (prev[chatSummaryId] ?? []).map((m) =>
              m.id === idMessage ? { ...m, read: true, status: 'read' } : m,
            ),
          }))
        }
      } catch {
        // сообщение ещё в очереди или недоступно - не критично
      }
    }, 3000)
  }

  /**
   * Создание чата: CheckAccount (POST .../checkAccount) переводит
   * номер телефона в chatId (README, раздел 7).
   */
  async function handleCreateChat(phone: string) {
    if (!creds) throw new Error('Нет данных авторизации')
    const { exist, chatId } = await checkAccountMutation.mutateAsync({
      creds,
      phone: Number(phone),
    })
    if (!exist) {
      throw new NotRegisteredError()
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
    setMobileChatOpen(true)
    setNewChatOpen(false)
  }

  if (!creds) {
    return <LoginPage onLogin={setCreds} />
  }

  const selectedChat = chats.find((c) => c.id === selectedId) ?? null
  const selectedMessages = selectedId ? (messagesByChat[selectedId] ?? []) : []

  return (
    <>
      <Stack
        direction="row"
        className={mobileChatOpen ? 'mobile-chat-view' : 'mobile-list-view'}
        sx={{ height: '100vh', bgcolor: '#fff', overflow: 'hidden' }}
      >
          <Box className="pane-sidebar" sx={{ flex: 'none', display: 'flex', height: '100%' }}>
            <Sidebar
              chats={chats}
              recentChats={recentChatSummaries}
              selectedId={selectedId}
              loadedIds={histories.loadedIds}
              matchedChatIds={matchedChatIds}
              isLoading={isListLoading}
              onSelect={handleSelectChat}
              onNewChat={() => setNewChatOpen(true)}
              onLogout={handleLogout}
            />
          </Box>
          <Box className="pane-chat" sx={{ flex: 1, minWidth: 0, display: 'flex', height: '100%' }}>
            <ChatWindow
              chat={selectedChat}
              messages={selectedMessages}
              loadingHistory={histories.isFetchingSelected}
              historyLoaded={
                !selectedChat?.chatId || (selectedChat ? histories.loadedIds.has(selectedChat.id) : true)
              }
              onSend={(text) => {
                void handleSend(text)
              }}
              onBack={() => {
                setMobileChatOpen(false)
                if (!window.matchMedia('(max-width: 760px)').matches) {
                  setSelectedId(null)
                }
              }}
            />
          </Box>
        </Stack>
      <NewChatForm
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onCreate={handleCreateChat}
      />
    </>
  )
}
