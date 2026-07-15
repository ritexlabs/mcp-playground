export const TASKS_KEY  = 'dashboard_tasks'
export const CONFIG_KEY = 'dashboard_alarm_config'

export const DEFAULT_CONFIG = { animation: 'bounce', ringtone: 'chime', snooze: 5 }

export function loadTasks()  { try { return JSON.parse(localStorage.getItem(TASKS_KEY)  || '[]')  } catch { return [] } }
export function saveTasks(t) { localStorage.setItem(TASKS_KEY, JSON.stringify(t)) }

export function loadAlarmConfig()    { try { return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') } } catch { return DEFAULT_CONFIG } }
export function saveAlarmConfig(cfg) { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)) }

export function genId() { return Math.random().toString(36).slice(2, 10) }

export function playAlarmSound(ringtone) {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)()
    let maxEnd = 0
    const note = (freq, type, start, dur, vol = 0.25) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = type; osc.frequency.value = freq
      gain.gain.setValueAtTime(vol, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + dur + 0.05)
      if (start + dur > maxEnd) maxEnd = start + dur
    }
    if      (ringtone === 'chime') [440, 554, 659, 880].forEach((f, i) => note(f, 'sine', i * 0.3, 0.5, 0.3))
    else if (ringtone === 'bell')  { note(880, 'sine', 0, 2, 0.5); note(1100, 'sine', 0, 1.5, 0.15) }
    else if (ringtone === 'beep')  for (let i = 0; i < 5; i++) note(400 + i * 80, 'square', i * 0.15, 0.12, 0.12)
    else if (ringtone === 'alarm') for (let i = 0; i < 8; i++) note(i % 2 ? 800 : 600, 'sawtooth', i * 0.25, 0.2, 0.2)
    // Close the AudioContext once all oscillators have finished to release
    // browser audio resources. Browsers cap open AudioContexts (~6 total).
    setTimeout(() => ctx.close().catch(() => {}), (maxEnd + 0.5) * 1000)
  } catch {}
}
