import { SoundController } from '~/utils/sound'

let ctrl: SoundController | null = null

/** Sound and haptics, respecting the player's settings. Calls never throw. */
export function useSound() {
  const { soundOn, hapticsOn } = useSettings()
  const sync = () => {
    if (!ctrl) ctrl = new SoundController()
    ctrl.soundEnabled = soundOn.value
    ctrl.hapticsEnabled = hapticsOn.value
    return ctrl
  }
  return {
    play(name: 'playWhistle' | 'playTap' | 'playSlot' | 'playUnslot' | 'playCorrect' | 'playWrong' | 'playTick' | 'playFanfare' | 'playTimeBonus', ...args: any[]) {
      try { (sync() as any)[name](...args) } catch { /* audio is optional */ }
    },
    buzz(pattern: number | number[]) {
      try { sync().vibrate(pattern) } catch { /* haptics are optional */ }
    }
  }
}
