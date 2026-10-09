import { useState, type FormEvent } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material'
import { NotRegisteredError } from '../../api/greenApi'

type NewChatFormProps = {
  open: boolean
  onClose: () => void
  /** Вызывается с нормализованным номером (79991234567);
   * асинхронный - CheckAccount GREEN-API; бросает ошибку при неудаче,
   * NotRegisteredError - когда аккаунта с таким номером нет (exist: false) */
  onCreate: (phone: string) => Promise<void>
}

/** Нормализация: убрать лишнее, ведущую 8 заменить на 7 (README, раздел 7) */
function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('8') && digits.length === 11) {
    digits = `7${digits.slice(1)}`
  }
  return digits
}

/**
 * Диалог создания нового чата.
 *
 * CheckAccount exist: true - чат создаётся (handleCreateChat в App) и
 * становится первым в списке: пользователь сразу пишет ему сообщение.
 * exist: false - показываем сообщение, что пользователь не зарегистрирован
 * и ему нужно зарегистрироваться, с кнопкой «ОК», закрывающей диалог.
 */
export default function NewChatForm({ open, onClose, onCreate }: NewChatFormProps) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notRegistered, setNotRegistered] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const normalized = normalizePhone(phone)
    if (!/^7\d{10}$|^375\d{9}$/.test(normalized)) {
      setError('Введите номер в формате +7 (999) 123-45-67');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onCreate(normalized);
      setPhone('');
    } catch (err) {
      if (err instanceof NotRegisteredError) {
        setNotRegistered(true);
      } else {
        setError(err instanceof Error ? err.message : 'Не удалось создать чат');
      }
    } finally {
      setLoading(false);
    }
  }

  /** Закрытие диалога: сбрасываем состояние, включая экран «не зарегистрирован» */
  function handleClose() {
    setNotRegistered(false);
    setError(null);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      {notRegistered ? (
        <>
          <DialogTitle>Пользователь не зарегистрирован</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mt: 1 }}>
              Пользователь с этим номером не зарегистрирован в MAX.
              Чтобы начать переписку, ему нужно зарегистрироваться.
            </Alert>
          </DialogContent>
          <DialogActions>
            <Button variant="contained" onClick={handleClose}>
              ОК
            </Button>
          </DialogActions>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            void handleSubmit(e)
          }}
        >
          <DialogTitle>Новый чат</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              fullWidth
              margin="dense"
              label="Номер телефона"
              placeholder="+7 (999) 123-45-67"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                setError(null)
              }}
              error={Boolean(error)}
              helperText={error}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} disabled={loading}>
              Отмена
            </Button>
            <Button type="submit" variant="contained" loading={loading}>
              Создать
            </Button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  )
}
