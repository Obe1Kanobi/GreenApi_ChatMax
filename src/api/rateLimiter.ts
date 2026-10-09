/**
 * Глобальный rate-limiter GREEN-API.
 *
 * Журнальные методы GetChatHistory, LastIncomingMessages и LastOutgoingMessages
 * имеют лимит «1 запрос в секунду» на инстанс, поэтому ВСЕ вызовы этих методов
 * должны идти через единую последовательную очередь: каждый следующий запрос
 * стартует не раньше, чем через RATE_LIMIT_INTERVAL_MS после старта предыдущего.
 *
 * Модуль не знает про fetch/creds — он просто throttling-обёртка над любой
 * асинхронной задачей, поэтому переиспользуется на следующих этапах.
 */

/** Минимальный интервал между запусками запросов, мс (лимит GREEN-API: 1 rps) */
export const RATE_LIMIT_INTERVAL_MS = 1000

type ThrottledTask<T> = () => Promise<T>

/** Хвост общей очереди: следующий запрос всегда стартует после этого промиса */
let queueTail: Promise<unknown> = Promise.resolve()

/** Время старта последнего пропущенного запроса, мс */
let lastStartAt = 0

/**
 * Пропустить задачу через глобальный троттлинг «не чаще 1 запроса в секунду».
 * Возвращает промис, который резолвится результатом task (или reject с её ошибкой).
 * Ошибка задачи НЕ ломает очередь — последующие запросы выполняются как обычно.
 */
export function withRateLimit<T>(task: ThrottledTask<T>): Promise<T> {
  const run = queueTail.then(async () => {
    const waitMs = lastStartAt + RATE_LIMIT_INTERVAL_MS - performance.now()
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs))
    }
    lastStartAt = performance.now()
    return task()
  })
  // Ошибка задачи не должна остановить очередь для последующих запросов
  queueTail = run.catch(() => undefined)
  return run
}
