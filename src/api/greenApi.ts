import type {
  CheckAccountResponse,
  Credentials,
  DeleteNotificationResponse,
  GetStateInstanceResponse,
  Notification,
  SendMessageResponse,
} from './types'

/**
 * Слой API GREEN-API (README, раздел 5).
 * URL строится по шаблону:
 *   ${apiUrl}/waInstance${idInstance}/${method}/${apiTokenInstance}
 */

/** Лимит длины сообщения, символов (README, раздел 5) */
const MESSAGE_LIMIT = 4000

/** Читаемые сообщения для известных HTTP-кодов (README, раздел 5) */
const ERROR_MESSAGES: Record<number, string> = {
  401: 'Неверные данные или аккаунт ограничен',
  403: 'Неверные данные или аккаунт ограничен',
  429: 'Слишком много запросов, попробуйте позже',
  466: 'Достигнут лимит чатов на тарифе Developer',
  469: 'Слишком много проверок номеров, попробуйте через 2 часа',
}

/** Ошибка GREEN-API: HTTP-статус + текст от сервера (reason) */
export class GreenApiError extends Error {
  readonly status?: number
  readonly reason?: string

  constructor(message: string, status?: number, reason?: string) {
    super(message)
    this.name = 'GreenApiError'
    this.status = status
    this.reason = reason
  }
}

function endpoint(creds: Credentials, method: string): string {
  return `${creds.apiUrl}/waInstance${creds.idInstance}/${method}/${creds.apiTokenInstance}`
}

/**
 * Базовая обёртка над fetch.
 * - сетевые ошибки → GreenApiError;
 * - 401/403/429/466/469 → понятное сообщение по таблице;
 * - пустое тело ответа (например, очередь уведомлений пуста) → undefined.
 */
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    throw new GreenApiError('Нет соединения с сервером', undefined, reason)
  }

  if (!res.ok) {
    const status = res.status
    let reason: string | undefined
    try {
      const data = (await res.json()) as { reason?: string }
      reason = data?.reason
    } catch {
      // тело не JSON — оставляем reason пустым
    }

    if (reason && /not authorized|notAuthorized/i.test(reason)) {
      throw new GreenApiError('Инстанс не авторизован', status, reason)
    }

    const message =
      ERROR_MESSAGES[status] ??
      (status >= 500
        ? 'Сервер временно недоступен, попробуйте позже'
        : `Ошибка запроса (${status})`)
    throw new GreenApiError(message, status, reason)
  }

  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

/** Проверка учётных данных. Это и есть «логин»: ждём stateInstance === 'authorized'. */
export function getStateInstance(creds: Credentials): Promise<GetStateInstanceResponse> {
  return request<GetStateInstanceResponse>(endpoint(creds, 'getStateInstance'))
}

/**
 * Номер телефона → chatId при создании чата.
 * phoneNumber передаётся числом, например 79991234567.
 */
export function checkAccount(creds: Credentials, phone: number): Promise<CheckAccountResponse> {
  return request<CheckAccountResponse>(endpoint(creds, 'checkAccount'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: phone }),
  })
}

/** Отправка текстового сообщения. Лимит 4000 символов — проверяем на фронте. */
export async function sendMessage(
  creds: Credentials,
  chatId: string,
  message: string,
): Promise<SendMessageResponse> {
  if (message.length > MESSAGE_LIMIT) {
    throw new GreenApiError(`Сообщение длиннее ${MESSAGE_LIMIT} символов`)
  }
  return request<SendMessageResponse>(endpoint(creds, 'sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message }),
  })
}

/**
 * Одно уведомление из очереди FIFO.
 * receiveTimeout 5–60 с; пустой ответ — норма, а не ошибка (вернём null).
 */
export async function receiveNotification(
  creds: Credentials,
  receiveTimeout = 20,
  signal?: AbortSignal,
): Promise<Notification | null> {
  const url = `${endpoint(creds, 'receiveNotification')}?receiveTimeout=${receiveTimeout}`
  const data = await request<Notification | null>(url, { method: 'GET', signal })
  return data ?? null
}

/** Подтверждение обработки уведомления — вызывать для каждого, иначе очередь встанет. */
export function deleteNotification(
  creds: Credentials,
  receiptId: number,
): Promise<DeleteNotificationResponse> {
  return request<DeleteNotificationResponse>(`${endpoint(creds, 'deleteNotification')}/${receiptId}`, {
    method: 'DELETE',
  })
}