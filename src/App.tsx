import { useState } from 'react'
import { Stack } from '@mui/material'
import LoginPage from './features/auth/LoginPage'
import ChatWindow from './features/chat/ChatWindow'
import Sidebar from './features/chats/Sidebar'
import NewChatForm from './features/chats/NewChatForm'
import type { ChatMessage } from './features/chat/types'
import type { ChatSummary } from './features/chats/types'
import { clearCredentials, loadCredentials } from './utils/storage'
import { checkAccount, sendMessage } from './api/greenApi'
import type { Credentials } from './api/types'

/*
 * ВРЕМЕННЫЕ демо-данные из chat_mockup.html — до интеграции со стором
 * (README, разделы 3–7). Компоненты уже принимают данные через пропсы,
 * поэтому после появления стора заменим только состояние в этом файле.
 */
const DEMO_CHATS: ChatSummary[] = [
  {
    id: 'security',
    name: 'Безопасность',
    marker: { symbol: ' ✦', color: '#0d83fb' },
    avatar: { bg: 'linear-gradient(135deg,#4d4dff,#7d35df)', text: '✓', fontSize: 28 },
    preview: 'Новый вход в MAX Обнаружили вход в профиль с вашим номером...',
    time: '15:37',
    unread: 1,
  },
  {
    id: 'ekaterina',
    name: 'Екатерина Бабинцева',
    avatar: { bg: 'linear-gradient(135deg,#d9b18a,#6c4a36)' },
    preview: 'посмотрено',
    time: '6 окт.',
    read: true,
  },
  {
    id: 'metalgranta',
    name: 'ИТ Металлагрант',
    marker: { symbol: ' ♨', color: '#aaa' },
    avatar: { bg: '#18bdd5', text: 'ИМ' },
    preview: 'производство Профлист: спасибо',
    time: '6 окт.',
  },
  {
    id: 'alena',
    name: 'Алёна юрист',
    avatar: { bg: '#fff', text: 'МГ', color: '#a73a3a', fontSize: 13, border: '1px solid #ddd' },
    preview: '▣ Стикер',
    time: '5 окт.',
  },
  {
    id: 'maria',
    name: 'Мария Третьякова',
    avatar: { bg: '#9d2a4d', text: 'МТ' },
    preview: 'сейчас в табель отгишусь',
    time: '5 окт.',
    read: true,
  },
  {
    id: 'dmitry',
    name: 'Дмитрий Карамышев',
    avatar: { bg: '#1e2932', text: 'ДК' },
    preview: 'не за что)',
    time: '1 окт.',
    read: true,
  },
  {
    id: 'svetlana',
    name: 'Светлана Валерьевна',
    avatar: { bg: '#7758dc', text: 'СВ' },
    preview: 'Да',
    time: '1 окт.',
  },
  {
    id: 'zhenechka',
    name: 'Женечка💗',
    avatar: { bg: '#9d2a4d', text: 'Ж' },
    preview: 'Теперь в MAX! 👉 Напишите что-нибудь!',
    time: '30 сент.',
  },
  {
    id: 'evgeny',
    name: 'Евгений Дубиков механик',
    avatar: { bg: '#1e2932', text: 'ЕД' },
    preview: 'Жень, вот твой пароль от 1С: Ву5д...',
    time: '28 сент.',
    read: true,
  },
  {
    id: 'olga',
    name: 'Ольга Толстых рабочий',
    avatar: { bg: '#54a84a', text: 'ОТ' },
    preview: '8-905-855-89-54 Дубиков Евгений',
    time: '28 сент.',
  },
]

const DEMO_MESSAGES: ChatMessage[] = [
  {
    id: 'm1',
    direction: 'out',
    text: 'Потому что у Романа вылезла задача, что оказывать услугу можно в платежном календаре выставлять сумму самому. Напрямую в поле нельзя вписать, 1С не даёт, а вот через калькулятор рядом, спокойно можно. Также в некоторых заказах с копейками проблемы, где-то +1 копейка, где-то -1 в заказах.',
    time: '15:22',
    read: true,
  },
  { id: 'm2', direction: 'in', text: 'Привет', time: '16:06', size: 'small' },
  {
    id: 'm3',
    direction: 'in',
    text: 'Да. Помню. Отчет в главном расширении прям как Роман пишешь',
    time: '16:06',
    size: 'medium',
    reaction: { emoji: '🤣', count: 1 },
  },
  {
    id: 'm4',
    direction: 'out',
    text: 'там короче прикол, в том, что остатки меняют и почему-то в некоторых случаях копейки слетают',
    time: '16:06',
    size: 'medium',
    read: true,
  },
  {
    id: 'm5',
    direction: 'out',
    text: '🤣',
    time: '16:07',
    size: 'medium',
    read: true,
    quote: {
      author: 'Екатерина Бабинцева',
      text: 'Да. Помню. Отчет в главном расширении прям как Роман пишешь',
      blue: true,
    },
    reaction: { emoji: '🤣', count: 1 },
  },
  {
    id: 'm6',
    direction: 'in',
    text: 'Не подскажу тебе. Вообще не пойму где там что',
    time: '16:08',
    size: 'wide',
    quote: {
      author: 'Александр Кудинов',
      text: 'там короче прикол, в том, что остатки меняют и почему-то в некоторых случаях копейки слетают',
    },
    reaction: { emoji: '👍', count: 1 },
  },
  {
    id: 'm7',
    direction: 'out',
    text: 'это не срочная задача, до пятницы ждёт. Просто делаю анонс)',
    time: '16:08',
    size: 'medium',
    read: true,
  },
  { id: 'm8', direction: 'in', text: 'А может ты сам покопаешься в копии?', time: '16:09', size: 'small' },
  { id: 'm9', direction: 'out', text: 'окей', time: '16:09', size: 'small', read: true },
  { id: 'm10', direction: 'out', text: 'посмотрю', time: '16:09', size: 'small', read: true },
]

/** Текущее время HH:MM для отправленных сообщений */
function nowTime(): string {
  return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
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
  const [chats, setChats] = useState<ChatSummary[]>(DEMO_CHATS)
  const [selectedId, setSelectedId] = useState<string>('ekaterina')
  const [messagesByChat, setMessagesByChat] = useState<Record<string, ChatMessage[]>>({
    ekaterina: DEMO_MESSAGES,
  })
  const [newChatOpen, setNewChatOpen] = useState(false)

  function handleLogout() {
    clearCredentials()
    setCreds(null)
  }

  /**
   * Отправка сообщения: POST ${apiUrl}/waInstance${idInstance}/sendMessage/${apiTokenInstance}
   * (README, раздел 5; docs: green-api.com/v3/docs/api/sending/SendMessage).
   * Добавляем сообщение локально сразу (status 'sending'), затем обновляем
   * статус по результату запроса. У демо-чатов без chatId API не вызывается.
   */
  async function handleSend(text: string) {
    const localId = `local-${Date.now()}`
    const chatId = chats.find((c) => c.id === selectedId)?.chatId

    // Оптимистично показываем сообщение в ленте
    setMessagesByChat((prev) => {
      const list = prev[selectedId] ?? []
      const message: ChatMessage = {
        id: localId,
        direction: 'out',
        text,
        time: nowTime(),
        read: false,
        status: chatId ? 'sending' : 'sent',
      }
      return { ...prev, [selectedId]: [...list, message] }
    })
    setChats((prev) =>
      prev.map((c) => (c.id === selectedId ? { ...c, preview: text, time: 'сейчас' } : c)),
    )

    // Демо-чат без chatId — дальше только локально
    if (!creds || !chatId) return

    try {
      const res = await sendMessage(creds, chatId, text)
      setMessagesByChat((prev) => ({
        ...prev,
        [selectedId]: (prev[selectedId] ?? []).map((m) =>
          m.id === localId ? { ...m, id: res.idMessage, status: 'sent' } : m,
        ),
      }))
    } catch {
      setMessagesByChat((prev) => ({
        ...prev,
        [selectedId]: (prev[selectedId] ?? []).map((m) =>
          m.id === localId ? { ...m, status: 'failed' } : m,
        ),
      }))
    }
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
  }

  if (!creds) {
    return <LoginPage onLogin={setCreds} />
  }

  const selectedChat = chats.find((c) => c.id === selectedId) ?? null

  return (
    <>
      <Stack direction="row" sx={{ height: '100vh', bgcolor: '#fff', overflow: 'hidden' }}>
        <Sidebar
          chats={chats}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onNewChat={() => setNewChatOpen(true)}
          onLogout={handleLogout}
        />
        <ChatWindow
          chat={selectedChat}
          messages={messagesByChat[selectedId] ?? []}
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