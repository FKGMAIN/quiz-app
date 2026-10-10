// Per-device preferences, kept in localStorage under the same keys the old app used,
// so existing players keep their phone number, timer, sound and theme.

export type ThemeChoice = 'dark' | 'light' | 'auto'

const read = (key: string): string | null => {
  try { return localStorage.getItem(key) } catch { return null }
}
const write = (key: string, value: string | null) => {
  try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value) } catch { /* private mode */ }
}

export function useSettings() {
  const phone = useState<string>('set-phone', () => read('soccer_phone_number') || '')
  const timer = useState<number>('set-timer', () => {
    const t = parseInt(read('soccer_timer_sec') || '', 10)
    return Number.isNaN(t) ? 45 : t                      // 0 = off
  })
  const soundOn = useState<boolean>('set-sound', () => read('soccer_sound') !== 'off')
  const hapticsOn = useState<boolean>('set-haptics', () => read('soccer_haptics') !== 'off')
  const theme = useState<ThemeChoice>('set-theme', () => {
    const t = read('soccer_theme')
    return t === 'light' || t === 'dark' ? t : 'auto'
  })

  return {
    phone, timer, soundOn, hapticsOn, theme,
    setPhone(v: string) { phone.value = v; write('soccer_phone_number', v) },
    setTimer(v: number) { timer.value = v; write('soccer_timer_sec', String(v)) },
    toggleSound() { soundOn.value = !soundOn.value; write('soccer_sound', soundOn.value ? 'on' : 'off'); return soundOn.value },
    toggleHaptics() { hapticsOn.value = !hapticsOn.value; write('soccer_haptics', hapticsOn.value ? 'on' : 'off'); return hapticsOn.value },
    setTheme(v: ThemeChoice) { theme.value = v; write('soccer_theme', v === 'auto' ? null : v) }
  }
}
