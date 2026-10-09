# MAX Chat - веб-интерфейс для MAX на GREEN-API 

Тестовое задание: пользовательский интерфейс для отправки и получения текстовых сообщений в мессенджере MAX через сервис [GREEN-API](https://green-api.com/max). Внешний вид повторяет [web.max.ru](https://web.max.ru/).

**Сценарий из задания:**

1. Пользователь вводит учётные данные GREEN-API (`idInstance`, `apiTokenInstance`).
2. Вводит номер телефона получателя и создаёт новый чат.
3. Пишет текстовое сообщение и отправляет его получателю в MAX.
4. Получатель отвечает в мессенджере MAX.
5. Пользователь видит ответ в чате.

**Полезные ссылки на документацию:**

| Метод | Назначение | Документация |
|---|---|---|
| `getStateInstance` | Проверка учётных данных при входе | [GetStateInstance](https://green-api.com/v3/docs/api/account/GetStateInstance/) |
| `checkAccount` | Номер телефона → `chatId` | [CheckAccount](https://green-api.com/v3/docs/api/service/CheckAccount/) |
| `sendMessage` | Отправка текста | [SendMessage](https://green-api.com/v3/docs/api/sending/SendMessage/) |
| `receiveNotification` | Получение входящего уведомления | [ReceiveNotification](https://green-api.com/v3/docs/api/receiving/technology-http-api/ReceiveNotification/) |
| `deleteNotification` | Подтверждение обработки уведомления | [DeleteNotification](https://green-api.com/v3/docs/api/receiving/technology-http-api/DeleteNotification/) |

Также: [Технология HTTP API](https://green-api.com/v3/docs/api/receiving/technology-http-api/) · [Идентификатор чата](https://green-api.com/v3/docs/api/chat-id/) · [Перед началом работы](https://green-api.com/v3/docs/before-start/)

## Установка и запуск

### Предварительные требования

- [Node.js](https://nodejs.org/) версии 18 или выше
- [yarn](https://yarnpkg.com/)
- Git (опционально, для клонирования репозитория)

### Быстрый старт

```bash
# Клонировать репозиторий
git clone https://github.com/your-username/GreenApi_ChatMax.git
cd GreenApi_ChatMax

# Установить зависимости
npm install
# или
yarn install
# или
pnpm install

# Создать файл конфигурации из примера
cp .env.example .env

# Запустить в режиме разработки
npm run dev
```

Приложение будет доступно по адресу [http://localhost:5173](http://localhost:5173) (или другом порту, если 5173 занят).


### Доступные скрипты

```
| Команда | Описание |
|---|---|
| `npm run dev` | Запуск сервера разработки |
| `npm run build` | Сборка проекта для production |
| `npm run preview` | Локальный просмотр production сборки |
| `npm run lint` | Проверка кода линтером |
| `npm run test` | Запуск тестов |
---
```

### Возникшие проблемы

```
Ограничение метода getHistoryChat. Один запрос раз в секунду и частое падение запросов
со ссылкой на частые запросы.
---
```