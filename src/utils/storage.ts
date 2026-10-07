import type { Credentials } from '../api/types'

/**
 * Хранение учётных данных (README, раздел 7 «Сценарии UI»):
 * - «Запомнить меня» → localStorage;
 * - иначе → sessionStorage (закрыл вкладку — вышел).
 */
const STORAGE_KEY = 'greenapi:credentials'

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