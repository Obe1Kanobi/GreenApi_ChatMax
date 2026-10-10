import { useState, type FormEvent } from 'react'
import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
} from '@mui/material'
import { useLoginMutation } from '../../api/queries'
import type { Credentials } from '../../api/types'
import { saveCredentials } from '../../utils/storage'

/** Стандартный адрес API GREEN-API (README, раздел 0.2: у инстанса может быть свой). */
const DEFAULT_API_URL = 'https://api.green-api.com'

type LoginPageProps = {
  onLogin: (creds: Credentials) => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [idInstance, setIdInstance] = useState('')
  const [apiTokenInstance, setApiTokenInstance] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loginMutation = useLoginMutation()
  const loading = loginMutation.isPending

  const canSubmit =
    idInstance.trim() !== '' && apiTokenInstance.trim() !== '' && !loading

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setError(null)
    const creds: Credentials = {
      apiUrl: DEFAULT_API_URL,
      idInstance: idInstance.trim(),
      apiTokenInstance: apiTokenInstance.trim(),
    }
    try {
      const state = await loginMutation.mutateAsync(creds)
      if (state.stateInstance !== 'authorized') {
        throw new Error('Инстанс не авторизован: отсканируйте QR-код в кабинете GREEN-API')
      }
      saveCredentials(creds, remember)
      onLogin(creds)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти')
    }
  }

  return (
    <Stack
      component="form"
      onSubmit={(e) => void handleSubmit(e)}
      sx={{
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        bgcolor: 'background.default',
      }}
    >
      <Stack
        spacing={2.5}
        sx={{
          width: '100%',
          maxWidth: 420,
          p: 4,
          borderRadius: 3,
          boxShadow: 4,
          bgcolor: 'background.paper',
        }}
      >
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="idInstance"
          value={idInstance}
          onChange={(e) => setIdInstance(e.target.value)}
          fullWidth
          required
        />
        <TextField
          label="apiTokenInstance"
          type="password"
          value={apiTokenInstance}
          onChange={(e) => setApiTokenInstance(e.target.value)}
          fullWidth
          required
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
          }
          label="Запомнить меня"
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={!canSubmit}
          loading={loading}
        >
          Войти
        </Button>
      </Stack>
    </Stack>
  )
}