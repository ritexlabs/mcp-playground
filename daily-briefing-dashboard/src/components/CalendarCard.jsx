import { useMemo } from 'react'
import BentoCard, { CardHeader, CardSkeleton, CardError } from './BentoCard.jsx'
import { formatTime } from '../utils/parsers.js'

const ACCENT = '#818cf8'

// ─── Pseudo-random helper ─────────────────────────────────────────────────────
function pr(i, seed) {
  const x = Math.sin(i * seed + seed * 0.7) * 43758.5453
  return x - Math.floor(x)
}

// ─── Time-of-day backgrounds ──────────────────────────────────────────────────
function getTimeSlot() {
  const h = new Date().getHours()
  if (h >= 5  && h < 8)  return 'dawn'
  if (h >= 8  && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  if (h >= 17 && h < 20) return 'evening'
  return 'night'
}

const CAL_BG = {
  night:     'linear-gradient(150deg, #01020c 0%, #030614 50%, #010309 100%)',
  dawn:      'linear-gradient(150deg, #0c031a 0%, #1a0b28 40%, #1e0e06 100%)',
  morning:   'linear-gradient(150deg, #020a14 0%, #051020 50%, #020c18 100%)',
  afternoon: 'linear-gradient(150deg, #030c14 0%, #050f1c 50%, #030b12 100%)',
  evening:   'linear-gradient(150deg, #150604 0%, #220d06 40%, #0e0c1c 100%)',
}

function CalNightScene() {
  const stars = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    id: i,
    left:  `${pr(i, 7.3) * 100}%`,
    top:   `${pr(i, 5.1) * 75}%`,
    delay: `${pr(i, 3.7) * 3.5}s`,
    dur:   `${1.5 + pr(i, 2.9) * 2.5}s`,
    size:  `${1 + Math.floor(pr(i, 6.3) * 1.5)}px`,
  })), [])
  return (
    <>
      <div style={{
        position: 'absolute', top: '-15px', right: '24px',
        width: '95px', height: '95px',
        background: 'radial-gradient(circle, rgba(129,140,248,0.22) 0%, transparent 70%)',
        animation: 'wx-moon-pulse 6s ease-in-out infinite',
        borderRadius: '50%',
      }} />
      {stars.map(s => (
        <div key={s.id} style={{
          position: 'absolute', left: s.left, top: s.top,
          width: s.size, height: s.size, borderRadius: '50%',
          background: 'rgba(200,210,255,0.9)',
          animation: `wx-twinkle ${s.dur} ${s.delay} ease-in-out infinite`,
        }} />
      ))}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 75% 5%, rgba(99,102,241,0.1) 0%, transparent 55%)',
      }} />
    </>
  )
}

function CalDawnScene() {
  return (
    <>
      <div style={{
        position: 'absolute', bottom: '-40px', left: '50%', transform: 'translateX(-50%)',
        width: '300px', height: '210px',
        background: 'radial-gradient(ellipse, rgba(244,114,182,0.18) 0%, rgba(245,158,11,0.13) 45%, transparent 70%)',
        animation: 'wx-sun-glow 5s ease-in-out infinite',
        borderRadius: '50%',
      }} />
      <div style={{
        position: 'absolute', top: '-30px', right: '-20px',
        width: '150px', height: '150px',
        background: 'radial-gradient(circle, rgba(139,92,246,0.16) 0%, transparent 70%)',
        borderRadius: '50%',
      }} />
    </>
  )
}

function CalMorningScene() {
  return (
    <>
      <div style={{
        position: 'absolute', top: '-55px', right: '-35px',
        width: '200px', height: '200px',
        background: 'radial-gradient(circle, rgba(147,213,253,0.15) 0%, rgba(99,102,241,0.07) 45%, transparent 70%)',
        animation: 'wx-sun-glow 6s ease-in-out infinite',
        borderRadius: '50%',
      }} />
      <div style={{
        position: 'absolute', top: '-35px', right: '-35px',
        width: '180px', height: '180px',
        animation: 'wx-sun-rays 32s linear infinite',
        opacity: 0.055,
      }}>
        {[0, 45, 90, 135].map(deg => (
          <div key={deg} style={{
            position: 'absolute', top: '50%', left: '50%',
            width: '2px', height: '115px', marginLeft: '-1px',
            background: 'linear-gradient(to bottom, rgba(147,213,253,1), transparent)',
            transformOrigin: 'top center', transform: `rotate(${deg}deg)`,
          }} />
        ))}
      </div>
    </>
  )
}

function CalAfternoonScene() {
  return (
    <>
      <div style={{
        position: 'absolute', top: '15%', right: '-25px',
        width: '155px', height: '155px',
        background: 'radial-gradient(ellipse, rgba(34,211,238,0.08) 0%, transparent 70%)',
        animation: 'wx-sun-glow 8s ease-in-out infinite',
        borderRadius: '50%',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 60% 30%, rgba(99,102,241,0.05) 0%, transparent 60%)',
      }} />
    </>
  )
}

function CalEveningScene() {
  return (
    <>
      <div style={{
        position: 'absolute', bottom: '-25px', right: '-25px',
        width: '240px', height: '210px',
        background: 'radial-gradient(ellipse, rgba(245,158,11,0.22) 0%, rgba(244,63,94,0.13) 40%, transparent 70%)',
        animation: 'wx-sun-glow 5s ease-in-out infinite',
        borderRadius: '50%',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(99,102,241,0.06) 0%, transparent 50%)',
      }} />
    </>
  )
}

function CalendarBackground() {
  const slot = getTimeSlot()
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: CAL_BG[slot] }} />
      {slot === 'night'     && <CalNightScene />}
      {slot === 'dawn'      && <CalDawnScene />}
      {slot === 'morning'   && <CalMorningScene />}
      {slot === 'afternoon' && <CalAfternoonScene />}
      {slot === 'evening'   && <CalEveningScene />}
    </div>
  )
}

// ─── Event list ───────────────────────────────────────────────────────────────

function eventAccent(event) {
  if (event.allDay) return '#fbbf24'
  const h = event.start?.getHours() ?? 12
  if (h < 9)  return '#22d3ee'
  if (h < 12) return '#34d399'
  if (h < 17) return '#818cf8'
  return '#fb7185'
}

const STATUS_MAP = {
  ongoing:  { label: 'Now',      color: '#34d399', bg: 'rgba(52,211,153,0.14)' },
  upcoming: { label: 'Upcoming', color: '#818cf8', bg: 'rgba(129,140,248,0.14)' },
  passed:   { label: 'Passed',   color: '#475569', bg: 'rgba(71,85,105,0.18)' },
}

function EventRow({ event, isLast }) {
  const accent = eventAccent(event)
  const now    = new Date()

  let statusKey = null
  if (!event.allDay && event.start && event.end) {
    if (now > event.end)                             statusKey = 'passed'
    else if (now >= event.start && now <= event.end) statusKey = 'ongoing'
    else                                             statusKey = 'upcoming'
  }
  const st = statusKey ? STATUS_MAP[statusKey] : null

  return (
    <div className={`flex gap-3 py-1.5 ${!isLast ? 'border-b border-white/[0.05]' : ''}`}>
      <div className="pt-0.5 w-[66px] flex-shrink-0">
        {event.allDay ? (
          <span className="text-[10px] font-semibold uppercase whitespace-nowrap" style={{ color: accent }}>All day</span>
        ) : (
          <span className="text-[10px] font-mono text-slate-400 tabular-nums whitespace-nowrap">
            {formatTime(event.start)}{event.end ? `–${formatTime(event.end)}` : ''}
          </span>
        )}
      </div>

      <div
        className="w-0.5 rounded-full flex-shrink-0 self-stretch"
        style={{ background: accent, opacity: statusKey === 'passed' ? 0.35 : 1 }}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className="text-sm font-medium truncate flex-1"
            style={{ color: statusKey === 'passed' ? '#64748b' : '#e2e8f0' }}
          >
            {event.title}
          </p>
          {st && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 uppercase tracking-wide"
              style={{ color: st.color, background: st.bg }}
            >
              {st.label}
            </span>
          )}
        </div>
        {event.location && (
          <p className="text-[11px] text-slate-500 truncate mt-0.5">{event.location}</p>
        )}
      </div>
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export default function CalendarCard({ data, loading, error, onRetry, delay = 0, syncedAt }) {
  const events = data || []

  return (
    <BentoCard accent={ACCENT} delay={delay} syncedAt={syncedAt} className="p-5 flex flex-col h-full">
      <CalendarBackground />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <CardHeader
          icon={
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
          title="Today's Schedule"
          accent={ACCENT}
        >
          {!loading && !error && (
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: `${ACCENT}18`, color: ACCENT }}
            >
              {events.length} event{events.length !== 1 ? 's' : ''}
            </span>
          )}
        </CardHeader>

        {loading && <CardSkeleton rows={5} />}
        {!loading && error && <CardError message={error} onRetry={onRetry} />}

        {!loading && !error && events.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-4 text-center flex-1">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: `${ACCENT}15` }}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={ACCENT} strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-300">All clear today</p>
            <p className="text-xs text-slate-500">No events scheduled</p>
          </div>
        )}

        {!loading && !error && events.length > 0 && (
          <div className="flex flex-col overflow-y-auto flex-1 -mr-1 pr-1">
            {events.map((ev, i) => (
              <EventRow key={i} event={ev} isLast={i === events.length - 1} />
            ))}
          </div>
        )}
      </div>
    </BentoCard>
  )
}
