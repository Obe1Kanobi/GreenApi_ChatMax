import type { ChatHistoryItem } from '../api/types'
import type { ChatMessage } from '../features/chat/types'

/**
 * Преобразование ответа GetChatHistory в UI-модель сообщения.
 * API отдаёт сообщения по убыванию даты; реакции и удалённые пропускаем.
 */
export function mapHistoryItem(item: ChatHistoryItem): ChatMessage | null {
  if (item.typeMessage === 'reactionMessage' || item.isDeleted) return null

  let text = item.textMessage ?? item.extendedTextMessage?.text ?? item.caption ?? ''
  if (!text && item.fileName) text = `📎 ${item.fileName}`
  if (!text) text = '[неподдерживаемый тип сообщения]'

  return {
    id: item.idMessage,
    direction: item.type === 'outgoing' ? 'out' : 'in',
    text,
    time: formatStamp(item.timestamp),
    ts: item.timestamp,
    read:
      item.type === 'outgoing'
        ? item.statusMessage === 'read' || item.isRead === true
        // Входящие: непрочитанным считается только сообщение с isRead === false.
        // isRead undefined (старые записи API) — считаем прочитанным, чтобы
        // не показывать цифру у ранее прочитанных сообщений.
        : item.isRead !== false,
    status: item.type === 'outgoing' ? 'sent' : undefined,
  }
}

/** UNIX-время (сек) → 'HH:MM' */
function formatStamp(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Слияние истории API с локальными сообщениями:
 * - локальные «в полёте» (sending) и неуспешные (failed) сохраняем как есть;
 * - остальное берём из истории (dedupe по idMessage);
 * - сортировка по возрастанию UNIX-времени.
 */
export function mergeHistory(items: ChatHistoryItem[], existing: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>()

  for (const m of existing) {
    if (m.status === 'sending' || m.status === 'failed') byId.set(m.id, m)
  }
  for (const item of items) {
    const mapped = mapHistoryItem(item)
    if (mapped) byId.set(mapped.id, mapped)
  }

  return [...byId.values()].sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))
}
