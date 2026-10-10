/**
 * Модель данных приложения.
 * README, раздел 4 «Модель данных».
 */

/** Учётные данные GREEN-API */
export type Credentials = {
  apiUrl: string;
  idInstance: string;
  apiTokenInstance: string;
};

/** Сообщение в чате */
export type Message = {
  id: string;
  chatId: string;
  text: string;
  direction: 'in' | 'out';
  timestamp: number;
  status?: 'sending' | 'sent' | 'failed';
};

/** Чат */
export type Chat = {
  chatId: string;
  phone: string;
  name?: string;
  messages: Message[];
  unread: number;
};

/**
 * Ответы GREEN-API (README, раздел 5 «Слой API»).
 */

/** GET getStateInstance - проверка учётных данных при входе */
export type GetStateInstanceResponse = {
  stateInstance: string;
};

/** POST checkAccount - номер телефона → chatId */
export type CheckAccountResponse = {
  exist: boolean;
  chatId: string;
  fromCache?: boolean;
};

/** POST sendMessage - отправка текста */
export type SendMessageResponse = {
  idMessage: string;
};

/** POST readChat - отметка сообщений чата прочитанными */
export type ReadChatResponse = {
  setRead: boolean;
};

/**
 * Уведомления (README, раздел 6 «Цикл получения сообщений»).
 * FIFO-очередь receiveNotification/deleteNotification - основной канал
 * входящих: без её разбора журналы чатов (GetChatHistory) обновляются
 * в инстансе с задержкой.
 */

/** senderData из тела уведомления */
export type SenderData = {
  chatId: string;
  chatName?: string;
  sender?: string;
  senderName?: string;
  senderPhoneNumber?: number;
};

/** messageData из тела уведомления */
export type MessageData = {
  typeMessage: string;
  textMessageData?: { textMessage: string };
  extendedTextMessageData?: { text?: string };
};

/** body уведомления */
export type NotificationBody = {
  typeWebhook: string;
  timestamp: number;
  idMessage: string;
  senderData?: SenderData;
  messageData?: MessageData;
  statusMessage?: string;
  status?: string;
};

/** GET receiveNotification - одно уведомление из очереди FIFO */
export type Notification = {
  receiptId: number;
  body: NotificationBody;
};

/** DELETE deleteNotification - подтверждение обработки уведомления */
export type DeleteNotificationResponse = {
  result: boolean;
  reason?: string;
};

/** GET getContacts - контакт аккаунта (элемент списка собеседников) */
export type ContactItem = {
  chatId: string;
  name?: string;
  contactName?: string;
  type?: string;
  phoneNumber?: number;
};

/**
 * POST getChatHistory - элемент истории сообщений чата.
 * Сортировка в ответе - по убыванию даты; глубина выгрузки -
 * до 5000 сообщений за 3 месяца (README, раздел 5).
 */
export type ChatHistoryItem = {
  type: "outgoing" | "incoming";
  idMessage: string;
  timestamp: number;
  typeMessage: string;
  chatId: string;
  chatType?: string;
  statusMessage?: string;
  sendByApi?: boolean;
  senderId?: string;
  senderName?: string;
  senderContactName?: string;
  textMessage?: string;
  caption?: string;
  fileName?: string;
  extendedTextMessage?: { text?: string; title?: string; description?: string };
  isDeleted?: boolean;
  isEdited?: boolean;
  isRead?: boolean;
  isReadTimestamp?: number;
};

/**
 * Ответы LastIncomingMessages / LastOutgoingMessages - запись журнала
 * последних сообщений инстанса (по умолчанию за последние 24 часа).
 * Структура совпадает с элементом истории (ChatHistoryItem) + данные
 * отправителя/файла; в зависимости от typeMessage часть полей отсутствует.
 * Лимит метода - 1 запрос в секунду (см. api/rateLimiter.ts).
 * Docs: green-api.com/v3/docs/api/journals/LastIncomingMessages,
 *       green-api.com/v3/docs/api/journals/LastOutgoingMessages.
 */
export type LastMessageRecord = ChatHistoryItem & {
  senderType?: string;
  downloadUrl?: string;
  downloadUrlJpeg?: string;
  jpegThumbnail?: string;
  mimeType?: string;
  isAnimated?: boolean;
  isForwarded?: boolean;
  forwardingScore?: number;
};
