/**
 * Типы для вёрстки окна чата (по mockup chat_mockup.html).
 * Это UI-модель сообщения; в дальнейшем будет строиться из
 * Message из api/types.ts (README, раздел 4).
 */

/** Ширина пузыря: auto - обычный, small/medium/wide - из mockup */
export type BubbleSize = 'auto' | 'small' | 'medium' | 'wide'

/** Цитируемое сообщение в пузыре */
export type Quote = {
  author?: string
  text: string
  /** true - цитата «нашего» сообщения (синяя рамка), иначе оранжевая */
  blue?: boolean
}

/** Реакция на сообщение */
export type Reaction = {
  emoji: string
  count: number
}

/** Сообщение в ленте чата */
export type ChatMessage = {
  id: string
  direction: 'in' | 'out'
  text: string
  /** Метка времени: '15:22', 'сейчас' */
  time: string
  /** UNIX-время в секундах (из API) - для сортировки при слиянии с историей */
  ts?: number
  size?: BubbleSize
  quote?: Quote
  reaction?: Reaction
  /** Галочки «прочитано» у исходящих */
  read?: boolean
  /**
   * Статус исходящего сообщения (только у исходящих):
   * - sending - POST sendMessage в полёте;
   * - sent - отправлено, но НЕ прочитано (2 серые галочки);
   * - read - прочитано/подтверждено (1 тёмно-синяя галочка);
   * - failed - не отправлено.
   * Статус приходит из GetChatHistory (statusMessage) и уведомлений
   * outgoingMessageStatus / outgoingAPIMessageReceived.
   */
  status?: 'sending' | 'sent' | 'failed' | 'read'
}