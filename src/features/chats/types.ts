/**
 * Модель «сводки» чата для списка в сайдбаре.
 * Отдельно от модели Chat (README, раздел 4): сюда добавлены
 * поля для вёрстки (аватар, маркер, галочки), которых нет в API.
 */

/** Настройки аватара в списке чатов */
export type ChatAvatar = {
  bg: string
  text?: string
  color?: string
  fontSize?: number
  border?: string
}

/** Один элемент списка чатов */
export type ChatSummary = {
  id: string
  chatId?: string
  name: string
  marker?: { symbol: string; color: string }
  avatar: ChatAvatar
  preview: string
  time: string
  lastTs?: number
  read?: boolean
  unread?: number
}