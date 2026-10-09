import { useEffect, useRef } from 'react'
import { useDeleteNotificationMutation, useReceiveNotificationMutation } from '../api/queries'
import type { Credentials } from '../api/types'
import { parseNotification } from '../utils/parseNotification'
import type { ParsedNotification } from '../utils/parseNotification'

/**
 * Цикл получения сообщений (README, раздел 6 «Цикл получения сообщений»)
 * через TanStack Query: receiveNotification и deleteNotification - useMutation.
 *
 * Обязателен к работе: FIFO-очередь receiveNotification/deleteNotification -
 * основной канал входящих; без её разбора журналы чатов (GetChatHistory)
 * в инстансе обновляются с задержкой.
 *
 * Правила:
 * - FIFO: пока уведомление не удалено через deleteNotification, следующее
 *   не придёт - удаляем ВСЕГДА, даже «неинтересные»;
 * - пустой ответ receiveNotification - норма, снова ждём;
 * - ошибка сети/таймаут → пауза RETRY_DELAY_MS и повтор;
 * - StrictMode в dev запускает эффект дважды: AbortController + флаг stopped
 *   в cleanup отменяют старый цикл (отменённый long-poll в DevTools - норма).
 */

/** Пауза между повторами при ошибке сети, мс */
export const RETRY_DELAY_MS = 3000

/** receiveTimeout для receiveNotification, сек (допустимо 5–60) */
export const DEFAULT_RECEIVE_TIMEOUT = 20

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type UseNotificationPollingOptions = {
  /** Креды инстанса; null - цикл выключен */
  creds: Credentials | null
  /** Обработчик разобранного уведомления (см. parseNotification) */
  onNotification: (event: ParsedNotification) => void
  /** Дополнительное выключение цикла (например, на время логина) */
  enabled?: boolean
  /** receiveTimeout, сек (5–60) */
  receiveTimeout?: number
}

export function useNotificationPolling({
  creds,
  onNotification,
  enabled = true,
  receiveTimeout = DEFAULT_RECEIVE_TIMEOUT,
}: UseNotificationPollingOptions): void {
  const onNotificationRef = useRef(onNotification)

  useEffect(() => {
    onNotificationRef.current = onNotification
  })

  const receiveMutation = useReceiveNotificationMutation()
  const deleteMutation = useDeleteNotificationMutation()

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!creds || !enabled) return

    const ctrl = new AbortController()
    abortRef.current = ctrl
    let stopped = false

    const run = async () => {
      while (!stopped) {
        try {
          const n = await receiveMutation.mutateAsync({ creds, receiveTimeout, signal: ctrl.signal })
          if (stopped) break
          if (!n) continue

          try {
            const event = parseNotification(n.body)
            if (event) onNotificationRef.current(event)
          } finally {
            await deleteMutation.mutateAsync({ creds, receiptId: n.receiptId })
          }
        } catch (e) {
          if (stopped || ctrl.signal.aborted) break
          console.error('[useNotificationPolling] ошибка цикла:', e)
          await sleep(RETRY_DELAY_MS)
        }
      }
    }

    void run()

    return () => {
      stopped = true
      ctrl.abort()
      abortRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creds, enabled, receiveTimeout])
}
