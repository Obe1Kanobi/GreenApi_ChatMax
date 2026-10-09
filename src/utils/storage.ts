import type { Credentials } from '../api/types'
import type { ChatMessage } from '../features/chat/types'
import type { ChatSummary } from '../features/chats/types'

/**
 * Хранение учётных данных (README, раздел 7 «Сценарии UI»):
 * - «Запомнить меня» → localStorage;
 * - иначе → sessionStorage (закрыл вкладку - вышел).
 */
const STORAGE_KEY = 'greenapi:credentials'

/**
 * Хранение чатов и сообщений - всегда в localStorage:
 * список чатов должен переживать перезагрузку страницы
 * (история сообщений дополнительно подтягивается из GetChatHistory).
 */
const CHATS_KEY = 'greenapi:chats:v1'

/** Снимок состояния чатов для localStorage */
export type PersistedChatState = {
  chats: ChatSummary[]
  messagesByChat: Record<string, ChatMessage[]>
  selectedId: string | null
}

/** Загрузить состояние чатов; null - нет валидных данных в localStorage. */
export function loadChatState(): PersistedChatState | null {
  const raw = localStorage.getItem(CHATS_KEY)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const v = parsed as Partial<PersistedChatState>
    if (!Array.isArray(v.chats)) return null
    return {
      chats: v.chats,
      messagesByChat: v.messagesByChat ?? {},
      selectedId: typeof v.selectedId === 'string' ? v.selectedId : null,
    }
  } catch {
    console.error('Invalid chat state')
    return null
  }
}

/** Сохранить состояние чатов в localStorage. */
export function saveChatState(state: PersistedChatState): void {
  localStorage.setItem(CHATS_KEY, JSON.stringify(state))
}

/** Очистить сохранённые чаты (при выходе). */
export function clearChatState(): void {
  localStorage.removeItem(CHATS_KEY)
}

function isValidCreds(value: unknown): value is Credentials {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.apiUrl === 'string' &&
    typeof v.idInstance === 'string' &&
    typeof v.apiTokenInstance === 'string'
  )
}

/** Креды из localStorage/sessionStorage. localStorage имеет приоритет. */
export function loadCredentials(): Credentials | null {
  for (const store of [localStorage, sessionStorage]) {
    const raw = store.getItem(STORAGE_KEY)
    if (!raw) continue
    try {
      const parsed: unknown = JSON.parse(raw)
      if (isValidCreds(parsed)) return parsed
    } catch {
      console.error('Invalid credentials');
    }
  }
  return null
}

/** Сохранить креды: remember → localStorage, иначе sessionStorage. */
export function saveCredentials(creds: Credentials, remember: boolean): void {
  const json = JSON.stringify(creds)
  if (remember) {
    localStorage.setItem(STORAGE_KEY, json)
    sessionStorage.removeItem(STORAGE_KEY)
  } else {
    sessionStorage.setItem(STORAGE_KEY, json)
    localStorage.removeItem(STORAGE_KEY)
  }
}

/** «Выйти» → очистка всего (README, раздел 7). */
export function clearCredentials(): void {
  localStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem(STORAGE_KEY)
}