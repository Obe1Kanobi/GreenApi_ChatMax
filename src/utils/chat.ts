import type { ChatSummary } from "../features/chats/types";


export const normalizeChatId = (chatId?: string | null) =>
  chatId?.trim().toLowerCase() ?? '';

/** Недавние сверху, остальные по убыванию lastTs, без повторов недавних */
export function orderChats(chats: ChatSummary[], recentChats: ChatSummary[]) {
  const recentIds = new Set(
    recentChats.map(c => normalizeChatId(c.chatId)).filter(Boolean),
  )
  const others = chats
    .filter(c => !recentIds.has(normalizeChatId(c.chatId)))
    .toSorted((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0))

  return [...recentChats, ...others]
}

/** Блюр чата, пока не загрузили историю */
export function isChatBlurred(
  chat: ChatSummary,
  loadedIds?: ReadonlySet<string>,
  matchedChatIds?: ReadonlySet<string>,
) {
  const normalized = normalizeChatId(chat.chatId)
  const matched = normalized !== '' && (matchedChatIds?.has(normalized) ?? false)
  return Boolean(chat.chatId) && !(loadedIds?.has(chat.id) ?? false) && !matched
}