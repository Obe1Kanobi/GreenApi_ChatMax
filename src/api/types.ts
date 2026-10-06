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

/** DELETE deleteNotification — подтверждение обработки уведомления */
export type DeleteNotificationResponse = {
  result: boolean;
  reason?: string;
};

/**
 * Уведомления (README, раздел 6 «Цикл получения сообщений»).
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
};

/** GET receiveNotification — одно уведомление из очереди FIFO */
export type Notification = {
  receiptId: number;
  body: NotificationBody;
};