import type { NotificationBody } from '../api/types'
import type { Message } from '../api/types'

/**
 * Разбор тела уведомления в модель приложения (README, раздел 6).
 *
 * | typeWebhook                 | Действие                                          |
 * |-----------------------------|---------------------------------------------------|
 * | incomingMessageReceived     | text / extendedText → входящее; прочее → заглушка |
 * | outgoingAPIMessageReceived  | эхо наших отправок — не дублировать               |
 * | остальное                   | игнорировать (из очереди удаляет сам цикл)        |
 */

/** Заглушка для фото, стикеров и прочих неподдерживаемых типов сообщений */
export const UNSUPPORTED_TEXT = '[неподдерживаемый тип]'

/** Входящее текстовое сообщение → кандидат на добавление в чат */
export type IncomingMessageEvent = {
  kind: 'incoming-message'
  /** senderData.chatId — сопоставляем чат именно по нему */
  chatId: string
  /** senderName / chatName для нового чата */
  chatName?: string
  /** senderPhoneNumber, если пришёл */
  phone?: string
  message: Message
}

/** Эхо отправки через API — не добавляем сообщение */
export type OutgoingEchoEvent = {
  kind: 'outgoing-echo'
  chatId: string
  idMessage: string
  timestamp: number
}

/** Результат разбора: событие для стора или null, если уведомление неинтересное */
export type ParsedNotification = IncomingMessageEvent | OutgoingEchoEvent

/** Текст в зависимости от typeMessage; null — текста нет вовсе */
function extractText(messageData: NotificationBody['messageData']): string | null {
  if (!messageData) return null

  switch (messageData.typeMessage) {
    case 'textMessage':
      return messageData.textMessageData?.textMessage ?? null
    case 'extendedTextMessage':
      return messageData.extendedTextMessageData?.text ?? null
    default:
      // Фото/стикер и т.п.: не роняем цикл — показываем заглушку
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

  return null
}
