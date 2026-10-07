/**
 * Модель «сводки» чата для списка в сайдбаре.
 * Отдельно от модели Chat (README, раздел 4): сюда добавлены
 * поля для вёрстки (аватар, маркер, галочки), которых нет в API.
 */

/** Настройки аватара в списке чатов */
export type ChatAvatar = {
  /** CSS-фон: цвет или градиент (из mockup) */
  bg: string
  /** Текст внутри (инициалы, ✓) или пусто — «фото»-аватар */
  text?: string
  /** Цвет текста, по умолчанию #fff */
  color?: string
  /** Размер шрифта, по умолчанию 20 */
  fontSize?: number
  /** Тонкая обводка, например '1px solid #ddd' */
  border?: string
}

/** Один элемент списка чатов */
export type ChatSummary = {
  id: string
  name: string
  /** Маркер после имени: символ и цвет (✦ синий, ♨ серый и т.п.) */
  marker?: { symbol: string; color: string }
  avatar: ChatAvatar
  preview: string
  /** Метка времени в списке: '15:37', '6 окт.' */
  time: string
  /** Галочки «прочитано» ✓✓ */
  read?: boolean
  /** Счётчик непрочитанных сообщений */
  unread?: number
}