'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { formatThaiDate, parseThaiDate } from '@/lib/format'
import { th } from '@/lib/th'

type Props = {
  value: string | null
  onChange: (iso: string | null) => void
  invalid?: boolean
}

/** Digits only; inserts `/` after day and month while typing. Max dd/mm/yyyy. */
function mask(raw: string, previous: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  const text = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/')
  // add the trailing slash only while typing forward, so backspace still works
  const typingForward = raw.length > previous.length
  return typingForward && (digits.length === 2 || digits.length === 4) ? `${text}/` : text
}

export function ThaiDateInput({ value, onChange, invalid }: Props) {
  const [text, setText] = useState(value ? formatThaiDate(value) : '')
  const [touchedInvalid, setTouchedInvalid] = useState(false)

  function handle(raw: string) {
    const next = mask(raw, text)
    setText(next)
    const iso = parseThaiDate(next)
    setTouchedInvalid(next !== '' && iso === null && /^\d{2}\/\d{2}\/(\d{2}|\d{4})$/.test(next))
    onChange(iso)
  }

  return (
    <Input
      inputMode="numeric"
      placeholder={th.common.datePlaceholder}
      value={text}
      onChange={(e) => handle(e.target.value)}
      aria-invalid={invalid || touchedInvalid || undefined}
    />
  )
}
