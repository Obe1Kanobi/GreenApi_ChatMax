import type {
  CheckAccountResponse,
  ChatHistoryItem,
  ContactItem,
  Credentials,
  DeleteNotificationResponse,
  GetStateInstanceResponse,
  LastMessageRecord,
  Notification,
  ReadChatResponse,
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
 * POST readChat — отметить сообщения чата прочитанными в инстансе.
 * Без idMessage отмечаются ВСЕ сообщения чата.
 * Требуется настройка инстанса «Получать уведомления о входящих
 * сообщениях и файлах» (docs: green-api.com/v3/docs/api/marks/ReadChat).
 */
export function readChat(
  creds: Credentials,
  chatId: string,
  idMessage?: string,
): Promise<ReadChatResponse> {
  return request<ReadChatResponse>(endpoint(creds, 'readChat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(idMessage ? { chatId, idMessage } : { chatId }),
  })
}

/**
 * Одно уведомление из FIFO-очереди (long-poll).
 * receiveTimeout 5–60 с; пустой ответ — норма, а не ошибка (вернём null).
 * Обязателен к разбору: без receiveNotification/deleteNotification
 * журналы чатов в инстансе обновляются с задержкой.
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

/** Подтверждение обработки уведомления — вызывать для каждого, иначе FIFO встанет. */
export function deleteNotification(
  creds: Credentials,
  receiptId: number,
): Promise<DeleteNotificationResponse> {
  return request<DeleteNotificationResponse>(
    `${endpoint(creds, 'deleteNotification')}/${receiptId}`,
    { method: 'DELETE' },
  )
}

/**
 * GET getContacts — список контактов (собеседников) аккаунта.
 * Это источник discovery новых чатов: включает и тех, от кого была
 * входящая переписка. Пустой массив — норма, повторить позже (docs).
 */
export function getContacts(creds: Credentials): Promise<ContactItem[]> {
  return request<ContactItem[]>(endpoint(creds, 'getContacts'), { method: 'GET' })
}

/**
 * POST getMessage — одно сообщение чата по его id
 * (docs: green-api.com/v3/docs/api/journals/GetMessage).
 * Тело ответа совпадает с элементом истории (ChatHistoryItem).
 * Используем для подтверждения статуса отправленных сообщений
 * (sent → delivered → read).
 */
export function getMessage(
  creds: Credentials,
  chatId: string,
  idMessage: string,
): Promise<ChatHistoryItem> {
  return request<ChatHistoryItem>(endpoint(creds, 'getMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, idMessage }),
  })
}

/** POST getChatHistory — история сообщений чата (сортировка по убыванию даты). */
export function getChatHistory(
  creds: Credentials,
  chatId: string,
  count = 100,
  signal?: AbortSignal,
): Promise<ChatHistoryItem[]> {
  return request<ChatHistoryItem[]>(endpoint(creds, 'getChatHistory'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, count }),
    signal,
  })
}

/**
 * GET lastIncomingMessages — журнал крайних входящих сообщений инстанса
 * (по умолчанию за последние 24 часа; docs: green-api.com/v3/docs/api/journals/LastIncomingMessages).
 * Используется сразу после getContacts для сопоставления с контактами:
 * у которых есть входящие — чаты показываются первыми (Этап 2).
 * Лимит 1 запрос в секунду — вызывать только через rateLimiter (api/queries.ts).
 */
export function lastIncomingMessages(
  creds: Credentials,
  minutes?: number,
  signal?: AbortSignal,
): Promise<LastMessageRecord[]> {
  const query = minutes ? `?minutes=${minutes}` : ''
  return request<LastMessageRecord[]>(
    `${endpoint(creds, 'lastIncomingMessages')}${query}`,
    { method: 'GET', signal },
  )
}

/**
 * GET lastOutgoingMessages — журнал крайних исходящих сообщений инстанса
 * (по умолчанию за последние 24 часа; docs: green-api.com/v3/docs/api/journals/LastOutgoingMessages).
 * Аналогично lastIncomingMessages: лимит 1 запрос в секунду —
 * вызывать только через rateLimiter (api/queries.ts).
 */
export function lastOutgoingMessages(
  creds: Credentials,
  minutes?: number,
  signal?: AbortSignal,
): Promise<LastMessageRecord[]> {
  const query = minutes ? `?minutes=${minutes}` : ''
  return request<LastMessageRecord[]>(
    `${endpoint(creds, 'lastOutgoingMessages')}${query}`,
    { method: 'GET', signal },
  )
}
