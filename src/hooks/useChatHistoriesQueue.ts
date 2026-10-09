import { useCallback, useEffect, useRef, useState } from 'react'

import { getChatHistory } from '../api/greenApi'
import type { Credentials } from '../api/types'
import { mergeHistory } from '../utils/history'
import type { ChatMessage } from '../features/chat/types'

/**
 * Единая ОЧЕРЕДЬ запросов GetChatHistory (вместо параллельных useQueries).
 *
 * Зачем: GREEN-API ограничивает частоту запросов (429 Too Many Requests),
 * а сообщения появляются в инстансе с задержкой ~10 с после отправки из MAX.
 * Поэтому:
 * - все чаты опрашиваются ПО ОЧЕРЕДИ из одной очереди (никаких параллельных
 *   запросов — bursts и вызывают 429);
 * - цикл опроса — раз в HISTORY_CYCLE_MS (~10 с), независимо от того,
 *   открыт чат или нет;
 * - между запросами внутри цикла — пауза HISTORY_REQUEST_GAP_MS;
 * - открытый чат идёт первым в очереди + сразу запрашивается при выборе;
 * - 429/ошибки не ретраятся мгновенно — чат просто дождётся следующего цикла.
 */

/** Период полного цикла опроса всех чатов, мс */
export const HISTORY_CYCLE_MS = 10000

/** Пауза между соседними запросами внутри цикла, мс */
export const HISTORY_REQUEST_GAP_MS = 700

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type UseChatHistoriesQueueOptions = {
  creds: Credentials | null
  /** Список чатов UI; опрашиваются только с заполненным chatId */
  chats: { id: string; chatId?: string }[]
  /** id открытого чата (первый в очереди + мгновенный запрос при выборе) */
  selectedId: string | null
  /** Локальные сообщения — сливаются с ответами API */
  messagesByChat: Record<string, ChatMessage[]>
  /** Вызывается после слияния истории чата */
  onMerged: (chatSummaryId: string, merged: ChatMessage[]) => void
}

export function useChatHistoriesQueue({
  creds,
  chats,
  selectedId,
  messagesByChat,
  onMerged,
}: UseChatHistoriesQueueOptions) {
  const [fetchingIds, setFetchingIds] = useState<ReadonlySet<string>>(new Set())

  // Свежие значения для колбэков очереди без пересоздания интервалов
  const localRef = useRef(messagesByChat)
  useEffect(() => {
    localRef.current = messagesByChat
  })

  const chatsRef = useRef(chats)
  useEffect(() => {
    chatsRef.current = chats
  })

  const selectedRef = useRef(selectedId)
  useEffect(() => {
    selectedRef.current = selectedId
  })

  const onMergedRef = useRef(onMerged)
  useEffect(() => {
    onMergedRef.current = onMerged
  })

  const fetchingIdsRef = useRef(fetchingIds)
  fetchingIdsRef.current = fetchingIds

  /** Один запрос истории чата + слияние результата */
  const fetchChat = useCallback(
    async (chatId: string, summaryId: string) => {
      if (!creds) return
      setFetchingIds((prev) => new Set(prev).add(summaryId))
      try {
        const items = await getChatHistory(creds, chatId)
        onMergedRef.current(summaryId, mergeHistory(items, localRef.current[summaryId] ?? []))
      } catch (e) {
        // 429 и прочее — чат дождётся следующего цикла очереди
        console.warn('[historyQueue] getChatHistory failed:', chatId, e)
      } finally {
        setFetchingIds((prev) => {
          const next = new Set(prev)
          next.delete(summaryId)
          return next
        })
      }
    },
    [creds],
  )

  // Защита от наложения циклов (эффект может перезапуститься, пока цикл идёт)
  const runningRef = useRef(false)

  /** Полный цикл: последовательно опрашиваем все чаты, открытый — первым */
  const runCycle = useCallback(async () => {
    if (!creds || runningRef.current) return
    const targets = chatsRef.current
      .filter((c): c is { id: string; chatId: string } => Boolean(c.chatId))
      .slice()
      .sort((a, b) => Number(b.id === selectedRef.current) - Number(a.id === selectedRef.current))
    if (targets.length === 0) return

    runningRef.current = true
    try {
      for (const chat of targets) {
        await fetchChat(chat.chatId, chat.id)
        await sleep(HISTORY_REQUEST_GAP_MS)
      }
    } finally {
      runningRef.current = false
    }
  }, [creds, fetchChat])

  // Цикл опроса: сразу при старте/логине, затем раз в HISTORY_CYCLE_MS
  useEffect(() => {
    if (!creds) return
    void runCycle()
    const timer = setInterval(() => void runCycle(), HISTORY_CYCLE_MS)
    return () => clearInterval(timer)
  }, [creds, runCycle])

  // Мгновенный запрос истории при выборе чата (вне цикла)
  useEffect(() => {
    if (!creds || !selectedId) return
    const chat = chatsRef.current.find((c) => c.id === selectedId)
    if (chat?.chatId && !fetchingIdsRef.current.has(chat.id)) {
      void fetchChat(chat.chatId, chat.id)
    }
  }, [creds, selectedId, fetchChat])

  const targetsCount = chats.filter((c) => Boolean(c.chatId)).length

  return {
    /** true — идёт загрузка/опрос истории открытого чата */
    isFetchingSelected: selectedId ? fetchingIds.has(selectedId) : false,
    /** Сколько чатов в очереди */
    queuedCount: targetsCount,
  }
}
