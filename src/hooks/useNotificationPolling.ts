import { useEffect, useRef } from 'react'

import type { Credentials } from '../api/types'
import { deleteNotification, receiveNotification } from '../api/greenApi'
import { parseNotification } from '../utils/parseNotification'
import type { ParsedNotification } from '../utils/parseNotification'

/**
 * Цикл получения сообщений (README, раздел 6 «Цикл получения сообщений»).
 *
 * Правила:
 * - FIFO-очередь: пока уведомление не удалено через deleteNotification,
 *   следующее не придёт (README 0.3) — удаляем ВСЕГДА, даже «неинтересные».
 * - Пустой ответ receiveNotification — норма, снова ждём.
 * - Ошибка сети → пауза 3 с и повтор (бэкофф).
 * - StrictMode в dev запускает эффект дважды: AbortController + флаг stopped
 *   в cleanup отменяют старый цикл (README 0.4).
 */

/** Пауза между повторами при ошибке сети, мс (README §6) */
export const RETRY_DELAY_MS = 3000

/** receiveTimeout для receiveNotification, сек (допустимо 5–60) */
export const DEFAULT_RECEIVE_TIMEOUT = 20

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type UseNotificationPollingOptions = {
  /** Креды инстанса; null — цикл выключен */
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
  // Свежий колбэк без перезапуска цикла при каждом ререндере
  const onNotificationRef = useRef(onNotification)

  useEffect(() => {
    onNotificationRef.current = onNotification
  })

  useEffect(() => {
    if (!creds || !enabled) return

    const ctrl = new AbortController()
    let stopped = false

    const run = async () => {
      while (!stopped) {
        try {
          const n = await receiveNotification(creds, receiveTimeout, ctrl.signal)
          if (!n) continue // очередь пуста — снова ждём

          try {
            const event = parseNotification(n.body)
            if (event) onNotificationRef.current(event)
          } finally {
            // Удаляем ВСЕГДА: иначе FIFO-очередь встанет (README 0.3)
            await deleteNotification(creds, n.receiptId)
          }
        } catch (e) {
          if (ctrl.signal.aborted) break
          console.error('[useNotificationPolling] ошибка цикла:', e)
          await sleep(RETRY_DELAY_MS)
        }
      }
    }

    void run()

    return () => {
      stopped = true
      ctrl.abort()
    }
  }, [creds, enabled, receiveTimeout])
}