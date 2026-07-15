import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { playAlarmSound } from '../utils/alarmUtils.js'

// ── CSS keyframes (injected once) ─────────────────────────────────────────────
const ANIM_CSS = `
  @keyframes confetti-fall {
    0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
    100% { transform: translateY(140px) rotate(360deg); opacity: 0; }
  }
  @keyframes alarm-bounce {
    0%,100% { transform: translateY(0)     scale(1);    }
    50%     { transform: translateY(-22px) scale(1.15); }
  }
  @keyframes firework-ring {
    0%   { transform: scale(0.2); opacity: 1; }
    100% { transform: scale(3);   opacity: 0; }
  }
  @keyframes alarm-wave {
    0%   { transform: rotate(-22deg) scale(1);   }
    100% { transform: rotate(22deg)  scale(1.2); }
  }
  @keyframes alarm-shake {
    0%,100% { transform: translateX(0);    }
    20%,60% { transform: translateX(-9px); }
    40%,80% { transform: translateX(9px);  }
  }
`

// ── Animation components ──────────────────────────────────────────────────────

const PALETTE = ['#f472b6','#60a5fa','#34d399','#fbbf24','#a78bfa','#fb7185','#22d3ee']

function ConfettiAnim() {
  return (
    <div style={{ position: 'relative', height: '110px', overflow: 'hidden' }}>
      {Array.from({ length: 28 }).map((_, i) => (
        <div key={i} style={{
          position:     'absolute',
          left:         `${(i * 37) % 100}%`,
          top:          '-16px',
          width:        `${6 + (i % 4) * 2}px`,
          height:       `${6 + (i % 4) * 2}px`,
          background:   PALETTE[i % PALETTE.length],
          borderRadius: i % 3 === 0 ? '50%' : '2px',
          animation:    `confetti-fall ${1.2 + (i % 8) * 0.15}s ${(i % 6) * 0.08}s ease-in infinite`,
        }} />
      ))}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '52px' }}>⏰</span>
      </div>
    </div>
  )
}

function BounceAnim() {
  return (
    <div style={{ height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: '72px', display: 'inline-block', animation: 'alarm-bounce 0.55s ease-in-out infinite' }}>⏰</span>
    </div>
  )
}

function FireworksAnim() {
  return (
    <div style={{ position: 'relative', height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {PALETTE.slice(0, 5).map((c, i) => (
        <div key={i} style={{
          position:     'absolute',
          width:        '48px',
          height:       '48px',
          borderRadius: '50%',
          border:       `3px solid ${c}`,
          animation:    `firework-ring 1.2s ${i * 0.24}s ease-out infinite`,
        }} />
      ))}
      <span style={{ fontSize: '48px', position: 'relative', zIndex: 1 }}>⏰</span>
    </div>
  )
}

function WaveAnim() {
  return (
    <div style={{ height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
      {['⏰','🔔','📣','🔊','⏰'].map((e, i) => (
        <span key={i} style={{
          fontSize:  '28px',
          display:   'inline-block',
          animation: `alarm-wave 0.45s ${i * 0.09}s ease-in-out infinite alternate`,
        }}>{e}</span>
      ))}
    </div>
  )
}

function ShakeAnim() {
  return (
    <div style={{ height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: '72px', display: 'inline-block', animation: 'alarm-shake 0.4s ease-in-out infinite' }}>⏰</span>
    </div>
  )
}

const ANIMS = { confetti: ConfettiAnim, bounce: BounceAnim, fireworks: FireworksAnim, wave: WaveAnim, shake: ShakeAnim }

// ── Notification overlay ──────────────────────────────────────────────────────

export default function AlarmNotification({ task, config, onSnooze, onDismiss }) {
  const played = useRef(false)
  const Anim   = ANIMS[config?.animation] || BounceAnim
  const snooze = config?.snooze || 5

  useEffect(() => {
    if (!played.current) {
      played.current = true
      playAlarmSound(config?.ringtone || 'chime')
    }
  }, [config?.ringtone])

  if (!task) return null

  const alarmTime = task.alarm
    ? new Date(task.alarm).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    : ''

  return createPortal(
    <>
      <style>{ANIM_CSS}</style>
      <div
        style={{
          position:       'fixed',
          inset:          0,
          zIndex:         9999,
          background:     'rgba(0,0,0,0.78)',
          backdropFilter: 'blur(8px)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          padding:        '20px',
        }}
        onClick={onDismiss}
      >
        <div
          style={{
            background:   'rgba(12,16,30,0.97)',
            border:       '1px solid rgba(251,191,36,0.3)',
            borderRadius: '24px',
            padding:      '28px 32px',
            maxWidth:     '400px',
            width:        '100%',
            boxShadow:    '0 0 80px rgba(251,191,36,0.1)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <Anim />

          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <p style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              Reminder
            </p>
            <p style={{ fontSize: '18px', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.35, wordBreak: 'break-word' }}>
              {task.text}
            </p>
            {alarmTime && (
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>{alarmTime}</p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '28px' }}>
            <button
              onClick={() => onSnooze(snooze)}
              style={{
                flex:         1,
                padding:      '11px',
                borderRadius: '12px',
                border:       '1px solid rgba(255,255,255,0.1)',
                background:   'rgba(255,255,255,0.05)',
                color:        '#94a3b8',
                fontSize:     '13px',
                fontWeight:   600,
                cursor:       'pointer',
              }}
            >
              Snooze {snooze}m
            </button>
            <button
              onClick={onDismiss}
              style={{
                flex:         1,
                padding:      '11px',
                borderRadius: '12px',
                border:       '1px solid rgba(251,191,36,0.35)',
                background:   'rgba(251,191,36,0.12)',
                color:        '#fbbf24',
                fontSize:     '13px',
                fontWeight:   600,
                cursor:       'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
