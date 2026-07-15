import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import BentoCard, { CardHeader, CardSkeleton, CardError } from './BentoCard.jsx'
import { formatTime } from '../utils/parsers.js'

const ACCENT = '#818cf8'

function pr(i, seed) {
  const x = Math.sin(i * seed + seed * 0.7) * 43758.5453
  return x - Math.floor(x)
}

// ─── Backgrounds ──────────────────────────────────────────────────────────────

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
    id: i, left: `${pr(i,7.3)*100}%`, top: `${pr(i,5.1)*75}%`,
    delay: `${pr(i,3.7)*3.5}s`, dur: `${1.5+pr(i,2.9)*2.5}s`, size: `${1+Math.floor(pr(i,6.3)*1.5)}px`,
  })), [])
  return (
    <>
      <div style={{ position:'absolute', top:'-15px', right:'24px', width:'95px', height:'95px', background:'radial-gradient(circle, rgba(129,140,248,0.22) 0%, transparent 70%)', animation:'wx-moon-pulse 6s ease-in-out infinite', borderRadius:'50%' }} />
      {stars.map(s => (
        <div key={s.id} style={{ position:'absolute', left:s.left, top:s.top, width:s.size, height:s.size, borderRadius:'50%', background:'rgba(200,210,255,0.9)', animation:`wx-twinkle ${s.dur} ${s.delay} ease-in-out infinite` }} />
      ))}
      <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 75% 5%, rgba(99,102,241,0.1) 0%, transparent 55%)' }} />
    </>
  )
}

function CalMorningScene() {
  return (
    <div style={{ position:'absolute', top:'-55px', right:'-35px', width:'200px', height:'200px', background:'radial-gradient(circle, rgba(147,213,253,0.15) 0%, rgba(99,102,241,0.07) 45%, transparent 70%)', animation:'wx-sun-glow 6s ease-in-out infinite', borderRadius:'50%' }} />
  )
}

function CalEveningScene() {
  return (
    <div style={{ position:'absolute', bottom:'-25px', right:'-25px', width:'240px', height:'210px', background:'radial-gradient(ellipse, rgba(245,158,11,0.22) 0%, rgba(244,63,94,0.13) 40%, transparent 70%)', animation:'wx-sun-glow 5s ease-in-out infinite', borderRadius:'50%' }} />
  )
}

function CalendarBackground() {
  const slot = getTimeSlot()
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: CAL_BG[slot] }} />
      {slot === 'night'   && <CalNightScene />}
      {slot === 'morning' && <CalMorningScene />}
      {slot === 'evening' && <CalEveningScene />}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function getStatus(event) {
  if (event.allDay || !event.start || !event.end) return null
  const now = new Date()
  if (now > event.end)                             return 'passed'
  if (now >= event.start && now <= event.end)      return 'ongoing'
  return 'upcoming'
}

// ─── Full event row (popup) ───────────────────────────────────────────────────

function EventRow({ event, isLast }) {
  const accent    = eventAccent(event)
  const statusKey = getStatus(event)
  const st        = statusKey ? STATUS_MAP[statusKey] : null

  return (
    <div className={`flex gap-3 py-2 ${!isLast ? 'border-b border-white/[0.05]' : ''}`}>
      <div className="pt-0.5 w-[70px] flex-shrink-0">
        {event.allDay ? (
          <span className="text-[10px] font-semibold uppercase" style={{ color: accent }}>All day</span>
        ) : (
          <span className="text-[10px] font-mono text-slate-400 tabular-nums whitespace-nowrap">
            {formatTime(event.start)}{event.end ? `–${formatTime(event.end)}` : ''}
          </span>
        )}
      </div>
      <div className="w-0.5 rounded-full flex-shrink-0 self-stretch"
        style={{ background: accent, opacity: statusKey === 'passed' ? 0.35 : 1 }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium truncate flex-1"
            style={{ color: statusKey === 'passed' ? '#64748b' : '#e2e8f0' }}>
            {event.title}
          </p>
          {st && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 uppercase tracking-wide"
              style={{ color: st.color, background: st.bg }}>
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

// ─── Compact event row (card face) ───────────────────────────────────────────

function CompactEventRow({ event }) {
  const accent    = eventAccent(event)
  const statusKey = getStatus(event)
  const st        = statusKey ? STATUS_MAP[statusKey] : null
  const now       = new Date()
  const isOngoing = statusKey === 'ongoing'

  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: accent }} />
      <span className="text-[11px] font-mono text-slate-500 flex-shrink-0 w-[54px]">
        {event.allDay ? 'All day' : formatTime(event.start)}
      </span>
      <span className="text-xs text-slate-300 truncate flex-1">{event.title}</span>
      {isOngoing && (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{ color:'#34d399', background:'rgba(52,211,153,0.14)' }}>NOW</span>
      )}
    </div>
  )
}

// ─── Schedule popup ───────────────────────────────────────────────────────────

function CalendarPopup({ events, onClose }) {
  return createPortal(
    <div
      style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={onClose}
    >
      <div
        style={{ background:'rgba(9,14,20,0.97)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:20, width:'100%', maxWidth:520, height:'min(600px,85vh)', display:'flex', flexDirection:'column', overflow:'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]" style={{ flexShrink:0 }}>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={ACCENT} strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="font-semibold text-slate-200">Today's Schedule</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background:`${ACCENT}18`, color:ACCENT }}>
              {events.length} event{events.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button onClick={onClose} className="btn-icon !py-1 !px-2" aria-label="Close">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Event list */}
        <div style={{ flex:1, overflowY:'auto', padding:'8px 24px 24px' }}>
          {events.map((ev, i) => (
            <EventRow key={i} event={ev} isLast={i === events.length - 1} />
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

const CARD_LIMIT = 3

export default function CalendarCard({ data, loading, error, onRetry, delay = 0, syncedAt }) {
  const [popupOpen, setPopupOpen] = useState(false)
  const events = data || []
  const shown  = events.slice(0, CARD_LIMIT)
  const extra  = events.length - CARD_LIMIT

  return (
    <>
      <BentoCard accent={ACCENT} delay={delay} syncedAt={syncedAt} className="p-5 flex flex-col h-full">
        <CalendarBackground />

        <div style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column', flex:1 }}>
          <CardHeader
            icon={
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
            title="Schedule"
            accent={ACCENT}
          >
            {!loading && !error && events.length > 0 && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background:`${ACCENT}18`, color:ACCENT }}>
                {events.length}
              </span>
            )}
          </CardHeader>

          {loading && <CardSkeleton rows={3} />}
          {!loading && error && <CardError message={error} onRetry={onRetry} />}

          {!loading && !error && events.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-center flex-1">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background:`${ACCENT}15` }}>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={ACCENT} strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-300">All clear today</p>
              <p className="text-xs text-slate-500">No events scheduled</p>
            </div>
          )}

          {!loading && !error && events.length > 0 && (
            <div className="flex flex-col flex-1">
              <div className="flex-1">
                {shown.map((ev, i) => (
                  <CompactEventRow key={i} event={ev} />
                ))}
              </div>
              <button
                onClick={() => setPopupOpen(true)}
                className="text-xs font-semibold mt-3 text-left transition-colors"
                style={{ color: ACCENT }}
              >
                {extra > 0 ? `View all ${events.length} events →` : 'View details →'}
              </button>
            </div>
          )}
        </div>
      </BentoCard>

      {popupOpen && (
        <CalendarPopup events={events} onClose={() => setPopupOpen(false)} />
      )}
    </>
  )
}
