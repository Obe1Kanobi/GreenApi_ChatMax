import type { NotificationBody } from '../api/types'
import type { Message } from '../api/types'

/**
 * Разбор тела уведомления в модель приложения (README, раздел 6).
 *
 * | typeWebhook                 | Действие                                          |
 * |-----------------------------|---------------------------------------------------|
 * | incomingMessageReceived     | text / extendedText → входящее; прочее → заглушка |
 * | outgoingAPIMessageReceived  | эхо наших отправок - не дублировать               |
 * | остальное                   | игнорировать (из очереди удаляет сам цикл)        |
 */

/** Заглушка для фото, стикеров и прочих неподдерживаемых типов сообщений */
export const UNSUPPORTED_TEXT = '[неподдерживаемый тип]'

/** Входящее текстовое сообщение → кандидат на добавление в чат */
export type IncomingMessageEvent = {
  kind: 'incoming-message'
  chatId: string
  chatName?: string
  phone?: string
  message: Message
}

/** Эхо отправки через API - не добавляем сообщение */
export type OutgoingEchoEvent = {
  kind: 'outgoing-echo'
  chatId: string
  idMessage: string
  timestamp: number
}

/**
 * Статус исходящего сообщения (уведомление outgoingMessageStatus):
 * отправлено или прочитано собеседником. read → 1 тёмно-синяя галочка,
 * всё остальное - 2 серые (статус не «понижаем» ниже sent).
 */
export type OutgoingStatusEvent = {
  kind: 'outgoing-status'
  chatId: string
  idMessage: string
  status: 'sent' | 'read'
  timestamp: number
}

/** Результат разбора: событие для стора или null, если уведомление неинтересное */
export type ParsedNotification =
  | IncomingMessageEvent
  | OutgoingEchoEvent
  | OutgoingStatusEvent

/** Текст в зависимости от typeMessage; null - текста нет вовсе */
function extractText(messageData: NotificationBody['messageData']): string | null {
  if (!messageData) return null

  switch (messageData.typeMessage) {
    case 'textMessage':
      return messageData.textMessageData?.textMessage ?? null
    case 'extendedTextMessage':
      return messageData.extendedTextMessageData?.text ?? null
    default:
      return UNSUPPORTED_TEXT
  }
}

export function parseNotification(body: NotificationBody): ParsedNotification | null {
  const { typeWebhook } = body

  if (typeWebhook === 'incomingMessageReceived') {
    const chatId = body.senderData?.chatId
    if (!chatId || !body.idMessage) return null

    const text = extractText(body.messageData)
    if (text === null) return null

    return {
      kind: 'incoming-message',
      chatId,
      chatName: body.senderData?.senderName ?? body.senderData?.chatName,
      phone: body.senderData?.senderPhoneNumber?.toString(),
      message: {
        id: body.idMessage,
        chatId,
        text,
        direction: 'in',
        timestamp: body.timestamp,
      },
    }
  }

  if (typeWebhook === 'outgoingAPIMessageReceived') {
    const chatId = body.senderData?.chatId
    if (!chatId || !body.idMessage) return null

    return {
      kind: 'outgoing-echo',
      chatId,
      idMessage: body.idMessage,
      timestamp: body.timestamp,
    }
  }

  if (typeWebhook === 'outgoingMessageStatus') {
    const chatId = body.senderData?.chatId
    if (!chatId || !body.idMessage) return null

    const raw = body.statusMessage ?? body.status
    return {
      kind: 'outgoing-status',
      chatId,
      idMessage: body.idMessage,
      status: raw === 'read' ? 'read' : 'sent',
      timestamp: body.timestamp,
    }
  }

  return null
}
