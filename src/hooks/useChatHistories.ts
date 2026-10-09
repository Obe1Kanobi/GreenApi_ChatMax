import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { chatHistoryQueryOptions } from '../api/queries'
import { GreenApiError } from '../api/greenApi'
import type { Credentials } from '../api/types'
import { mergeHistory } from '../utils/history'
import type { ChatMessage } from '../features/chat/types'

/**
 * Приоритетная дозагрузка истории чатов (GetChatHistory).
 *
 * Источники чатов: getContacts (useContactDiscovery), свежие чаты из журналов
 * за 24 ч (useRecentChats), чаты, созданные по номеру или входящим. Для КАЖДОГО
 * нового chatId выполняется ровно ОДИН запрос GetChatHistory за сессию.
 *
 * Приоритетная очередь (меньше уровень - раньше грузится):
 *   0. selected - чат, открытый пользователем; ставится в начало очереди
 *      немедленно при открытии (даже если он уже ждал в фоне - пере-приоритизация);
 *   1. recent - верхние свежие чаты из журналов (в порядке свежести, самые
 *      свежие первыми); их история догружается сразу после отображения списка;
 *   2. background - остальные чаты; дозагружаются фоном после приоритетов 0–1.
 *
 * Гарантии последовательности:
 *  - сетевые запросы идут СТРОГО по одному: следующий chatId не запускается,
 *    пока предыдущий не завершится статусом 200 (плюс общий rate-limiter
 *    api/rateLimiter.ts - 1 rps для всех журнальных методов);
 *  - неудачный запрос (429/сеть/5xx) повторяется до успеха - пауза между
 *    повторами RETRY_DELAY_MS (для 429 - RATE_LIMIT_RETRY_DELAY_MS);
 *  - среднее время не считается: каждый чат грузится столько, сколько нужно
 *    (размер истории у всех разный), UI показывает блюр, пока нет 200.
 *
 * Отсутствие дублей: requestedRef (chatId уже в очереди / в полёте / готов),
 * inFlightRef (выполняется прямо сейчас). Повышение приоритета у ждущего
 * chatId передвигает его в очереди, НЕ создавая второй запрос.
 *
 * Состояние для UI: loadedIds - чаты, чья история успешно загружена (получен
 * 200). Чаты, которых нет в loadedIds, показываются размытыми.
 *
 * Дальнейшие входящие приходят мгновенно через FIFO-цикл
 * receiveNotification (useNotificationPolling) и к истории не обращаются.
 */

/** Пауза между повторами неуспешного запроса, мс */
const RETRY_DELAY_MS = 1500

/** Пауза после 429 (слишком много запросов), мс */
const RATE_LIMIT_RETRY_DELAY_MS = 5000

/** Уровни приоритета очереди истории (меньше число - раньше грузится) */
const HISTORY_PRIORITY = {
  /** Открытый пользователем чат */
  selected: 0,
  /** Свежие чаты из журналов за 24 ч (в порядке свежести) */
  recent: 1,
  /** Остальные чаты - фоновая догрузка */
  background: 2,
} as const

type HistoryPriority = (typeof HISTORY_PRIORITY)[keyof typeof HISTORY_PRIORITY]

/** Элемент очереди ожидания (ключ - нормализованный chatId) */
type QueueItem = {
  chatId: string
  priority: HistoryPriority
}

type ChatRef = {
  id: string
  chatId?: string
}

type UseChatHistoriesOptions = {
  creds: Credentials | null
  /** Список чатов UI (источник - getContacts, создание по номеру, входящие) */
  chats: ChatRef[]
  /** id открытого чата - для индикатора загрузки и приоритета 0 */
  selectedId: string | null
  /** Локальные сообщения - сливаются с ответами API */
  messagesByChat: Record<string, ChatMessage[]>
  /** Вызывается после слияния истории чата */
  onMerged: (chatSummaryId: string, merged: ChatMessage[]) => void
  /**
   * Нормализованные chatId свежих чатов (useRecentChats) в порядке свежести -
   * приоритет 1: самые свежие грузятся первыми.
   */
  recentChatIds?: string[]
  /**
   * Створка порядка загрузки: GetChatHistory стартует ТОЛЬКО после завершения
   * журнальных запросов LastIncoming/LastOutgoing (useRecentChats.isSettled).
   * Пока ready === false, все три приоритета ждут; при открытии створки
   * эффекты перезапускаются и очередь наполняется в прежнем порядке.
   */
  ready?: boolean
}

/**
 * Вставка элемента по приоритету: после всех элементов с приоритетом <= своего
 * (сохраняет порядок внутри одного уровня, например свежесть recent-чатов),
 * перед первым элементом с более низким приоритетом.
 */
function insertByPriority(queue: QueueItem[], item: QueueItem) {
  let insertAt = queue.length
  for (let i = 0; i < queue.length; i += 1) {
    if (queue[i].priority > item.priority) {
      insertAt = i
      break
    }
  }
  queue.splice(insertAt, 0, item)
}

export function useChatHistories({
  creds,
  chats,
  selectedId,
  messagesByChat,
  onMerged,
  recentChatIds = [],
  ready = true,
}: UseChatHistoriesOptions) {
  const queryClient = useQueryClient()
  const [loadingIds, setLoadingIds] = useState<ReadonlySet<string>>(new Set())
  const [loadedIds, setLoadedIds] = useState<ReadonlySet<string>>(new Set())

  const localRef = useRef(messagesByChat)
  useEffect(() => {
    localRef.current = messagesByChat
  })

  const onMergedRef = useRef(onMerged)
  useEffect(() => {
    onMergedRef.current = onMerged
  })

  const chatsRef = useRef(chats)
  useEffect(() => {
    chatsRef.current = chats
  })

  const credsRef = useRef(creds)
  useEffect(() => {
    credsRef.current = creds
  })

  const requestedRef = useRef<Set<string>>(new Set())

  const inFlightRef = useRef<Set<string>>(new Set())

  const queueRef = useRef<QueueItem[]>([])

  const pumpingRef = useRef(false)

  const generationRef = useRef(0)

  const sessionResetRef = useRef(-1)

  /**
   * Загрузка истории одного chatId через TanStack Query + слияние.
   * Повторяет запрос до HTTP 200; следующий chatId стартует только после успеха.
   * summaryId вычисляется в момент СТАРТА загрузки: чат мог появиться в списке
   * позже постановки в очередь (например, создан кликом по «свежему» чату).
   */
  const loadChatUntilSuccess = useCallback(
    async (chatId: string, generation: number) => {
      const summaryId =
        chatsRef.current.find(
          (c) => c.chatId && c.chatId.trim().toLowerCase() === chatId,
        )?.id ?? `recent-${chatId}`

      if (sessionResetRef.current !== generation) {
        sessionResetRef.current = generation
        setLoadingIds(new Set([summaryId]))
        setLoadedIds(new Set())
      } else {
        setLoadingIds((prev) => new Set(prev).add(summaryId))
      }
      try {
        for (;;) {
          const currentCreds = credsRef.current
          if (!currentCreds || generationRef.current !== generation) return

          try {
            const items = await queryClient.fetchQuery(
              chatHistoryQueryOptions(currentCreds, chatId),
            )
            if (generationRef.current !== generation) return

            const resolvedId =
              chatsRef.current.find(
                (c) => c.chatId && c.chatId.trim().toLowerCase() === chatId,
              )?.id ?? summaryId
            const merged = mergeHistory(items, localRef.current[resolvedId] ?? [])
            onMergedRef.current(resolvedId, merged)

            setLoadedIds((prev) => new Set(prev).add(resolvedId))
            return
          } catch (e) {
            const status = e instanceof GreenApiError ? e.status : undefined
            const delay = status === 429 ? RATE_LIMIT_RETRY_DELAY_MS : RETRY_DELAY_MS
            console.warn(
              `[chatHistory] ${chatId}: ${status ?? 'сеть'} - повтор через ${delay} мс`,
            )
            await new Promise((resolve) => setTimeout(resolve, delay))
          }
        }
      } finally {
        setLoadingIds((prev) => {
          const next = new Set(prev)
          next.delete(summaryId)
          return next
        })
      }
    },
    [queryClient],
  )

  /**
   * Серийный цикл очереди: берёт самый приоритетный ждущий chatId, грузит до
   * 200, берёт следующий. Появившиеся во время загрузки элементы с более
   * высоким приоритетом подхватываются на следующей итерации.
   */
  const pump = useCallback(async () => {
    if (pumpingRef.current) return
    pumpingRef.current = true
    try {
      for (;;) {
        const item = queueRef.current.shift()
        if (!item) break

        inFlightRef.current.add(item.chatId)
        try {
          await loadChatUntilSuccess(item.chatId, generationRef.current)
        } finally {
          inFlightRef.current.delete(item.chatId)
        }
      }
    } finally {
      pumpingRef.current = false
    }
  }, [loadChatUntilSuccess])

  /**
   * Постановка chatId в очередь с приоритетом. Идемпотентна: повторный вызов
   * для того же chatId НЕ создаёт второй запрос - при повышении приоритета
   * ждущий элемент пере-приоритизируется (передвигается в начало очереди).
   */
  const schedule = useCallback(
    (rawChatId: string, priority: HistoryPriority) => {
      const chatId = rawChatId.trim().toLowerCase()
      if (!chatId) return

      if (requestedRef.current.has(chatId)) {
        const idx = queueRef.current.findIndex((q) => q.chatId === chatId)
        if (idx >= 0 && priority < queueRef.current[idx].priority) {
          const [item] = queueRef.current.splice(idx, 1)
          item.priority = priority
          insertByPriority(queueRef.current, item)
        }
        return
      }

      requestedRef.current.add(chatId)
      insertByPriority(queueRef.current, { chatId, priority })
      void pump()
    },
    [pump],
  )

  useEffect(() => {
    if (!creds || !ready || !selectedId) return
    const chat = chats.find((c) => c.id === selectedId)
    if (!chat?.chatId) return
    schedule(chat.chatId, HISTORY_PRIORITY.selected)
  }, [creds, ready, selectedId, chats, schedule])

  const recentKey = recentChatIds.join('|')
  useEffect(() => {
    if (!creds || !ready || !recentKey) return
    for (const chatId of recentChatIds) {
      schedule(chatId, HISTORY_PRIORITY.recent)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creds, ready, recentKey, schedule])

  useEffect(() => {
    if (!creds || !ready) return
    for (const chat of chats) {
      if (!chat.chatId) continue
      schedule(chat.chatId, HISTORY_PRIORITY.background)
    }
  }, [creds, ready, chats, schedule])

  useEffect(() => {
    if (creds) return
    generationRef.current += 1
    queueRef.current = []
    inFlightRef.current.clear()
    requestedRef.current.clear()
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] === 'chat-history',
    })
  }, [creds, queryClient])

  return {
    isFetchingSelected: selectedId ? loadingIds.has(selectedId) : false,
    loadedIds,
  }
}
