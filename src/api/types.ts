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
  /** idMessage из API (или временный локальный id) */
  id: string;
  chatId: string;
  text: string;
  direction: 'in' | 'out';
  /** секунды, как в API */
  timestamp: number;
  status?: 'sending' | 'sent' | 'failed';
};

/** Чат */
export type Chat = {
  /** из CheckAccount */
  chatId: string;
  /** номер телефона, например 79991234567 */
  phone: string;
  /** senderName из входящих, когда появится */
  name?: string;
  messages: Message[];
  unread: number;
};

/**
 * Ответы GREEN-API (README, раздел 5 «Слой API»).
 */

/** GET getStateInstance — проверка учётных данных при входе */
export type GetStateInstanceResponse = {
  stateInstance: string;
};

/** POST checkAccount — номер телефона → chatId */
export type CheckAccountResponse = {
  exist: boolean;
  chatId: string;
  fromCache?: boolean;
};

/** POST sendMessage — отправка текста */
export type SendMessageResponse = {
  idMessage: string;
};

/**
 * POST getChatHistory — элемент истории сообщений чата.
 * Сортировка в ответе — по убыванию даты; глубина выгрузки —
 * до 5000 сообщений за 3 месяца (README, раздел 5).
 */
export type ChatHistoryItem = {
  /** outgoing — исходящее, incoming — входящее */
  type: "outgoing" | "incoming";
  idMessage: string;
  /** UNIX-время, секунды */
  timestamp: number;
  typeMessage: string;
  chatId: string;
  chatType?: string;
  /** Статус исходящего: sent / delivered / read */
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
  /** Прочитано (у входящих; у исходящих — statusMessage) */
  isRead?: boolean;
  isReadTimestamp?: number;
};
