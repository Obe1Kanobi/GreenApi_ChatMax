/** Убрать лишнее, ведущую 8 заменить на 7 (README, раздел 7) */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  return digits.startsWith('8') && digits.length === 11 ? `7${digits.slice(1)}` : digits
}

/** Россия (7 + 10 цифр) или Беларусь (375 + 9 цифр) */
export function isValidPhone(normalized: string): boolean {
  return /^7\d{10}$|^375\d{9}$/.test(normalized)
}