import { queryOptions, useQuery } from '@tanstack/react-query'

import {
  fetchLastIncomingMessages,
  fetchLastOutgoingMessages,
} from '../api/queries'
import type { ContactItem, Credentials, LastMessageRecord } from '../api/types'

/**
 * Этап 2: свежие чаты из журналов LastIncomingMessages + LastOutgoingMessages.
 *
 * Вместо полной истории каждого чата (GetChatHistory) сразу после getContacts
 * выполняются два журнальных запроса (по умолчанию за последние 24 часа),
 * записи сопоставляются с контактами по chatId, и формируется «сводка»
 * последнего сообщения для списка чатов:
 *   - совпавшие с контактами чаты отдаются первыми (для сортировки сайдбара);
 *   - сортировка по времени последнего сообщения — свежие вверху.
 *
 * Ошибки не роняют UI: оба запроса идут через Promise.allSettled, поэтому
 * при падении одного используется второй (частичный результат). isError —
 * только когда упали ОБА запроса. Повтор — через refetch (TanStack Query).
 *
 * Оба метода лимитированы 1 rps на инстанс — запросы идут параллельно,
 * общую очередь api/rateLimiter.ts разруливает сама.
 */

/** Глубина журналов, минут (по умолчанию API — 24 часа) */
const RECENT_MINUTES = 1440

/** Последнее сообщение чата в сводке */
export type RecentChatLastMessage = {
  /** idMessage из API */
  idMessage: string
  /** Текст превью (или заглушка для медиа) */
  text: string
  /** UNIX-время, секунды */
  timestamp: number
  /** Направление последнего сообщения */
  type: 'incoming' | 'outgoing'
}

/** Элемент списка свежих чатов */
export type RecentChat = {
  /** chatId чата в формате GREEN-API (79001234567@c.us), нормализованный */
  chatId: string
  /** Контакт из getContacts; undefined — журнал содержит чат, которого нет в контактах */
  contact?: ContactItem
  /** Последнее сообщение чата (из двух журналов — самое свежее) */
  lastMessage: RecentChatLastMessage
}

/** Результат двух журнальных запросов: данные + ошибки по отдельности */
type JournalsResult = {
  incoming: LastMessageRecord[] | null
  outgoing: LastMessageRecord[] | null
  incomingError: Error | null
  outgoingError: Error | null
}

/**
 * Нормализация chatId к единому виду для сопоставления:
 * трим + нижний регистр (GREEN-API присылает суффиксы '@c.us' в нижнем).
 * phone.ts пуст — нормализация живёт здесь, до появления общих утилит.
 */
function normalizeChatId(chatId: string | undefined): string | null {
  if (!chatId) return null
  const normalized = chatId.trim().toLowerCase()
  return normalized || null
}

/**
 * chatId записи журнала: основной — chatId (у исходящих это получатель,
 * у входящих — отправитель); при отсутствии — senderId (входящие).
 */
function recordChatId(record: LastMessageRecord): string | null {
  return normalizeChatId(record.chatId) ?? normalizeChatId(record.senderId)
}

/** Текст превью записи журнала по typeMessage-полям */
function recordText(record: LastMessageRecord): string {
  if (record.textMessage) return record.textMessage
  if (record.extendedTextMessage?.text) return record.extendedTextMessage.text
  if (record.caption) return record.caption
  if (record.fileName) return `📎 ${record.fileName}`
  return '[неподдерживаемый тип]'
}

/** Запись журнала → сводка последнего сообщения */
function toLastMessage(
  record: LastMessageRecord,
  type: 'incoming' | 'outgoing',
): RecentChatLastMessage {
  return {
    idMessage: record.idMessage,
    text: recordText(record),
    timestamp: record.timestamp,
    type,
  }
}

/**
 * Сопоставление журналов с контактами:
 *  1) индекс контактов по нормализованному chatId;
 *  2) каждая запись обоих журналов → chatId → последнее сообщение чата
 *     (при конфликте остаётся самое свежее по timestamp);
 *  3) сортировка по timestamp по убыванию — свежие вверху.
 */
function buildRecentChats(
  incoming: LastMessageRecord[] | null,
  outgoing: LastMessageRecord[] | null,
  contacts: ContactItem[],
): { recentChats: RecentChat[]; lastMessageByChat: Record<string, RecentChatLastMessage> } {
  const contactByChatId = new Map<string, ContactItem>()
  for (const contact of contacts) {
    const key = normalizeChatId(contact.chatId)
    if (key) contactByChatId.set(key, contact)
  }

  /** chatId → самое свежее сообщение из обоих журналов */
  const latestByChatId = new Map<string, RecentChatLastMessage>()

  const collect = (records: LastMessageRecord[] | null, type: 'incoming' | 'outgoing') => {
    if (!records) return
    for (const record of records) {
      const chatId = recordChatId(record)
      if (!chatId || !record.idMessage) continue
      const message = toLastMessage(record, type)
      const current = latestByChatId.get(chatId)
      if (!current || message.timestamp > current.timestamp) {
        latestByChatId.set(chatId, message)
      }
    }
  }

  collect(incoming, 'incoming')
  collect(outgoing, 'outgoing')

  const recentChats: RecentChat[] = []
  const lastMessageByChat: Record<string, RecentChatLastMessage> = {}

  for (const [chatId, lastMessage] of latestByChatId) {
    const contact = contactByChatId.get(chatId)
    recentChats.push({ chatId, contact, lastMessage })
    lastMessageByChat[chatId] = lastMessage
  }

  recentChats.sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp)

  return { recentChats, lastMessageByChat }
}

/** reason у отклонённого промиса — any: приводим к Error без unsafe-присваиваний */
function settledError(settled: PromiseSettledResult<unknown>): Error | null {
  if (settled.status !== 'rejected') return null
  const reason: unknown = settled.reason
  if (reason instanceof Error) return reason
  return new Error(typeof reason === 'string' ? reason : String(reason))
}

/** queryFn никогда не вызовется с null-creds: enabled гасит запрос до авторизации */
function recentMessagesQueryOptions(creds: Credentials) {
  return queryOptions({
    queryKey: ['recent-messages', creds],
    queryFn: async (): Promise<JournalsResult> => {
      // allSettled: падение одного журнала не мешает второму (частичный результат)
      const [incomingSettled, outgoingSettled] = await Promise.allSettled([
        fetchLastIncomingMessages(creds, RECENT_MINUTES),
        fetchLastOutgoingMessages(creds, RECENT_MINUTES),
      ])
      return {
        incoming: incomingSettled.status === 'fulfilled' ? incomingSettled.value : null,
        outgoing: outgoingSettled.status === 'fulfilled' ? outgoingSettled.value : null,
        incomingError: settledError(incomingSettled),
        outgoingError: settledError(outgoingSettled),
      }
    },
    // Краткоживущие данные: повторный монтаж хука в пределах минуты не бьёт по API
    staleTime: 60_000,
    retry: false,
  })
}

type UseRecentChatsOptions = {
  creds: Credentials | null
  /**
   * Результат getContacts (из useContactDiscovery). undefined — контакты ещё
   * не загружены, запросы журналов не стартуют; [] — норма, журналы грузим.
   */
  contacts: ContactItem[] | undefined
  enabled?: boolean
}

export function useRecentChats({
  creds,
  contacts,
  enabled = true,
}: UseRecentChatsOptions) {
  const contactsReady = contacts !== undefined

  const journalsQuery = useQuery({
    ...recentMessagesQueryOptions(creds as Credentials),
    enabled: Boolean(creds) && contactsReady && enabled,
  })

  const journals = journalsQuery.data

  // Мемоизация не нужна: пересборка — дешёвые Map/сорт поверх уже загруженных массивов
  const { recentChats, lastMessageByChat } = buildRecentChats(
    journals?.incoming ?? null,
    journals?.outgoing ?? null,
    contacts ?? [],
  )

  /** Ошибка только когда не удалось получить НИ ОДИН из журналов */
  const isError = journals != null && !journals.incoming && !journals.outgoing
  const error =
    journals?.incomingError && journals?.outgoingError
      ? journals.outgoingError
      : (journals?.incomingError ?? journals?.outgoingError ?? null)

  return {
    /** Свежие чаты, отсортированные по времени последнего сообщения (убывание) */
    recentChats,
    /** map: chatId (нормализованный) → последнее сообщение — для превью в списке */
    lastMessageByChat,
    /** Идёт загрузка журналов (контакты получены, но Last*-запросы ещё не завершены) */
    isLoading: journalsQuery.isPending,
    /** true — оба журнальных запроса упали; частичный результат ошибкой не считается */
    isError,
    /** Первая из ошибок (для отображения; при частичном результате тоже заполнена) */
    error,
    /** Повторная загрузка журналов (кнопка/refetch на этапе 3) */
    refetch: journalsQuery.refetch,
  }
}
