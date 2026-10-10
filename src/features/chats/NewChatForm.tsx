import { useState, type FormEvent } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material'
import { NotRegisteredError } from '../../api/greenApi'
import { isValidPhone, normalizePhone } from '../../utils/phone'

type NewChatFormProps = {
  open: boolean
  onClose: () => void
  onCreate: (phone: string) => Promise<void>
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
    e.preventDefault();
    const normalized = normalizePhone(phone);
    if (!isValidPhone(normalized)) {
      setError('Введите номер в формате +7 (999) 123-45-67');
      return
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

  function handleClose() {
    setNotRegistered(false);
    setError(null);
    onClose();
  }

  function handlePhoneChange(value: string) {
    setPhone(value);
    setError(null);
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      {notRegistered ? (
        <NotRegisteredView onOk={handleClose} />
      ) : (
        <PhoneForm
          phone={phone}
          error={error}
          loading={loading}
          onPhoneChange={handlePhoneChange}
          onSubmit={(e) => void handleSubmit(e)}
          onCancel={handleClose}
        />
      )}
    </Dialog>
  )
}

/* ---------- Компоненты отображения: на верхнем уровне, не внутри NewChatForm ---------- */

function NotRegisteredView({ onOk }: { onOk: () => void }) {
  return (
    <>
      <DialogTitle>Пользователь не зарегистрирован</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mt: 1 }}>
          Пользователь с этим номером не зарегистрирован в MAX.
          Чтобы начать переписку, ему нужно зарегистрироваться.
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onOk}>ОК</Button>
      </DialogActions>
    </>
  )
}

type PhoneFormProps = {
  phone: string
  error: string | null
  loading: boolean
  onPhoneChange: (value: string) => void
  onSubmit: (e: FormEvent) => void
  onCancel: () => void
}

function PhoneForm({ phone, error, loading, onPhoneChange, onSubmit, onCancel }: PhoneFormProps) {
  return (
    <form onSubmit={onSubmit}>
      <DialogTitle>Новый чат</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          label="Номер телефона"
          placeholder="+7 (999) 123-45-67"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          error={Boolean(error)}
          helperText={error}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>Отмена</Button>
        <Button type="submit" variant="contained" loading={loading}>Создать</Button>
      </DialogActions>
    </form>
  )
}
