import { queryOptions, useMutation, useQuery } from '@tanstack/react-query'

import {
  checkAccount,
  deleteNotification,
  getChatHistory,
  getContacts,
  getMessage,
  getStateInstance,
  lastIncomingMessages,
  lastOutgoingMessages,
  readChat,
  receiveNotification,
  sendMessage,
} from './greenApi'
import { withRateLimit } from './rateLimiter'
import type {
  ChatHistoryItem,
  CheckAccountResponse,
  Credentials,
  DeleteNotificationResponse,
  GetStateInstanceResponse,
  LastMessageRecord,
  Notification,
  ReadChatResponse,
  SendMessageResponse,
} from './types'

/**
 * Слой TanStack Query над fetch-функциями greenApi.ts.
 * ВСЕ сетевые запросы приложения идут через эти хуки:
 *  - мутации (useMutation) - действия: логин, отправка, прочтение и т.д.;
 *  - запросы (useQuery) - данные: контакты, история чатов.
 * Fetch-функции greenApi.ts используются строго как queryFn/mutationFn.
 */

/** Ключи запросов - единая точка, чтобы не рассинхронить invalidate/remove.
 * creds входит в ключ целиком: объект стабилен за сессию (useState в App),
 * кэш истории вычищается на логауте (useChatHistories). */
export const queryKeys = {
  contacts: (creds: Credentials) => ['contacts', creds] as const,
  chatHistory: (creds: Credentials, chatId: string) => ['chat-history', creds, chatId] as const,
}

/* ----------------------------- Мутации ----------------------------- */

/** Логин: проверка учётных данных через getStateInstance (stateInstance === 'authorized') */
export function useLoginMutation() {
  return useMutation<GetStateInstanceResponse, Error, Credentials>({
    mutationFn: (creds) => getStateInstance(creds),
  })
}

/** Создание чата: phoneNumber → chatId */
export function useCheckAccountMutation() {
  return useMutation<CheckAccountResponse, Error, { creds: Credentials; phone: number }>({
    mutationFn: ({ creds, phone }) => checkAccount(creds, phone),
  })
}

/** Отправка текстового сообщения (лимит 4000 символов проверяется в greenApi) */
export function useSendMessageMutation() {
  return useMutation<SendMessageResponse, Error, { creds: Credentials; chatId: string; message: string }>({
    mutationFn: ({ creds, chatId, message }) => sendMessage(creds, chatId, message),
  })
}

/** Отметить сообщения чата прочитанными в инстансе */
export function useReadChatMutation() {
  return useMutation<ReadChatResponse, Error, { creds: Credentials; chatId: string; idMessage?: string }>({
    mutationFn: ({ creds, chatId, idMessage }) => readChat(creds, chatId, idMessage),
  })
}

/** Статус одного отправленного сообщения (sent → delivered → read) */
export function useGetMessageMutation() {
  return useMutation<ChatHistoryItem, Error, { creds: Credentials; chatId: string; idMessage: string }>({
    mutationFn: ({ creds, chatId, idMessage }) => getMessage(creds, chatId, idMessage),
  })
}

/** Одно уведомление из FIFO-очереди (long-poll); пустой ответ - норма (null) */
export function useReceiveNotificationMutation() {
  return useMutation<Notification | null, Error, { creds: Credentials; receiveTimeout: number; signal?: AbortSignal }>({
    mutationFn: ({ creds, receiveTimeout, signal }) =>
      receiveNotification(creds, receiveTimeout, signal),
  })
}

/** Подтверждение обработки уведомления - иначе FIFO-очередь встанет */
export function useDeleteNotificationMutation() {
  return useMutation<DeleteNotificationResponse, Error, { creds: Credentials; receiptId: number }>({
    mutationFn: ({ creds, receiptId }) => deleteNotification(creds, receiptId),
  })
}

/* ----------------------------- Запросы ----------------------------- */

/**
 * Журнальные методы GetChatHistory, LastIncomingMessages, LastOutgoingMessages
 * имеют лимит «1 запрос в секунду» на инстанс - все вызовы идут через общий
 * rate-limiter (api/rateLimiter.ts), единый для всех трёх методов.
 */

/** История чата с троттлингом 1 rps (дозагрузка истории на следующих этапах) */
export function fetchChatHistory(
  creds: Credentials,
  chatId: string,
  count = 100,
): Promise<ChatHistoryItem[]> {
  return withRateLimit(() => getChatHistory(creds, chatId, count))
}

/**
 * Журнал крайних входящих сообщений (LastIncomingMessages) с троттлингом 1 rps.
 * Вызывается сразу после getContacts и сопоставляется с контактами (Этап 2):
 * у кого есть входящие - те чаты показываются первыми в списке.
 */
export function fetchLastIncomingMessages(
  creds: Credentials,
  minutes?: number,
): Promise<LastMessageRecord[]> {
  return withRateLimit(() => lastIncomingMessages(creds, minutes))
}

/**
 * Журнал крайних исходящих сообщений (LastOutgoingMessages) с троттлингом 1 rps.
 * Вызывается сразу после getContacts (вместе с LastIncomingMessages).
 */
export function fetchLastOutgoingMessages(
  creds: Credentials,
  minutes?: number,
): Promise<LastMessageRecord[]> {
  return withRateLimit(() => lastOutgoingMessages(creds, minutes))
}

/** queryOptions истории чата (используется в useChatHistories через queryClient.fetchQuery) */
export function chatHistoryQueryOptions(creds: Credentials, chatId: string) {
  return {
    queryKey: queryKeys.chatHistory(creds, chatId),
    queryFn: () => fetchChatHistory(creds, chatId, 100),
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    retry: false,
  } as const
}

/** queryOptions списка контактов (discovery): key+queryFn в одном месте */
export function contactsQueryOptions(creds: Credentials) {
  return queryOptions({
    queryKey: queryKeys.contacts(creds),
    queryFn: () => getContacts(creds),
    retry: false,
  })
}

/** Периодический опрос списка контактов (discovery новых собеседников) */
export function useContactsQuery(creds: Credentials | null, enabled: boolean, refetchIntervalMs: number) {
  return useQuery({
    ...contactsQueryOptions(creds as Credentials),
    enabled: Boolean(creds) && enabled,
    refetchInterval: refetchIntervalMs,
  })
}
