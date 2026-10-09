import { useState, type FormEvent } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material'

type NewChatFormProps = {
  open: boolean
  onClose: () => void
  /** Вызывается с нормализованным номером (79991234567);
   * асинхронный — CheckAccount GREEN-API; бросает ошибку при неудаче */
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
 * Диалог создания нового чата. Пока добавляет чат локально;
 * интеграция с CheckAccount (GREEN-API) — отдельный шаг (стор).
 */
export default function NewChatForm({ open, onClose, onCreate }: NewChatFormProps) {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const normalized = normalizePhone(phone)
    if (!/^7\d{10}$|^375\d{9}$/.test(normalized)) {
      setError('Введите номер в формате +7 (999) 123-45-67')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await onCreate(normalized)
      setPhone('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать чат')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      {/* handleSubmit async: промис не передаём напрямую в onSubmit */}
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
          <Button onClick={onClose} disabled={loading}>
            Отмена
          </Button>
          <Button type="submit" variant="contained" loading={loading}>
            Создать
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}