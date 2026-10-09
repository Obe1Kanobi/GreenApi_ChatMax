import { useEffect, useRef } from 'react'

import type { ContactItem, Credentials } from '../api/types'
import { useContactsQuery } from '../api/queries'

/**
 * Discovery новых чатов: периодический опрос GetContacts через TanStack Query
 * (useQuery + refetchInterval).
 *
 * GetChatHistory работает только по известному chatId, поэтому список
 * собеседников (в т.ч. тех, кто написал первым) берётся из getContacts.
 * Новые контакты передаются в onContacts — App добавляет их как чаты,
 * и дальше их историю однократно загружает useChatHistories.
 *
 * Docs: пустой массив — норма, обновление контактов может занимать
 * до 5 минут; метод просто опрашивается дальше по интервалу.
 */

/** Период опроса списка контактов, мс */
export const CONTACTS_INTERVAL_MS = 60000

type UseContactDiscoveryOptions = {
  creds: Credentials | null
  /** Вызывается с полным списком контактов после каждого успешного ответа */
  onContacts: (contacts: ContactItem[]) => void
  enabled?: boolean
}

export function useContactDiscovery({
  creds,
  onContacts,
  enabled = true,
}: UseContactDiscoveryOptions): { contacts: ContactItem[] | undefined } {
  const onContactsRef = useRef(onContacts)
  useEffect(() => {
    onContactsRef.current = onContacts
  })

  // TanStack Query: опрос по refetchInterval, дедуп и отмена — на стороне библиотеки
  const contactsQuery = useContactsQuery(creds, enabled, CONTACTS_INTERVAL_MS)

  // Передаём результат наверх после каждого успешного ответа
  useEffect(() => {
    if (contactsQuery.data) {
      onContactsRef.current(contactsQuery.data)
    }
  }, [contactsQuery.data])

  // Список контактов наружу (этап 3): сопоставление журналов с контактами
  // в useRecentChats. undefined — контакты ещё не загружены.
  return { contacts: contactsQuery.data }
}
