import { useState, useMemo, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import BentoCard, { CardHeader, CardSkeleton, CardError } from './BentoCard.jsx'
import { getFallbackMessages } from '../data/wishMessages.js'

const ACCENT = '#f59e0b'

function pr(i, seed) {
  const x = Math.sin(i * seed + seed * 0.7) * 43758.5453
  return x - Math.floor(x)
}

// ─── Backgrounds ──────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ['#f59e0b','#fb7185','#34d399','#818cf8','#22d3ee','#a78bfa','#fbbf24','#f472b6']

function ConfettiScene() {
  const pieces = useMemo(() => Array.from({ length: 30 }, (_, i) => ({
    id: i, left: `${pr(i,7.3)*100}%`, delay: `${pr(i,3.7)*3.5}s`,
    dur: `${2.5+pr(i,5.1)*2.5}s`, width: `${3+Math.floor(pr(i,2.9)*4)}px`,
    height: `${5+Math.floor(pr(i,6.3)*7)}px`,
    color: CONFETTI_COLORS[Math.floor(pr(i,8.1)*CONFETTI_COLORS.length)],
    opacity: 0.3+pr(i,4.1)*0.35, borderRadius: pr(i,9.3) > 0.5 ? '50%' : '2px',
  })), [])
  return (
    <>
      {pieces.map(p => (
        <div key={p.id} style={{ position:'absolute', left:p.left, top:0, width:p.width, height:p.height, background:p.color, borderRadius:p.borderRadius, opacity:p.opacity, willChange:'transform', animation:`wx-confetti ${p.dur} ${p.delay} linear infinite` }} />
      ))}
      <div style={{ position:'absolute', top:'-20px', right:'-20px', width:'180px', height:'180px', background:'radial-gradient(circle, rgba(245,158,11,0.18) 0%, rgba(251,113,133,0.1) 45%, transparent 70%)', animation:'wx-sun-glow 4s ease-in-out infinite', borderRadius:'50%' }} />
    </>
  )
}

function PeacefulGlow() {
  return (
    <div style={{ position:'absolute', bottom:'-30px', right:'-30px', width:'210px', height:'200px', background:'radial-gradient(ellipse, rgba(245,158,11,0.14) 0%, rgba(251,146,60,0.07) 45%, transparent 70%)', animation:'wx-sun-glow 6s ease-in-out infinite', borderRadius:'50%' }} />
  )
}

function CelebrationsBackground({ hasCelebrations }) {
  const bg = hasCelebrations
    ? 'linear-gradient(150deg, #0a0504 0%, #120808 40%, #080510 100%)'
    : 'linear-gradient(150deg, #0c0804 0%, #120a05 50%, #080508 100%)'
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: bg }} />
      {hasCelebrations ? <ConfettiScene /> : <PeacefulGlow />}
    </div>
  )
}

// ─── LLM config ───────────────────────────────────────────────────────────────

function getActiveLlmConfig() {
  try {
    const models   = JSON.parse(localStorage.getItem('dashboard_llm_models') || '[]')
    const activeId = localStorage.getItem('dashboard_llm_active_id') || ''
    const model    = models.find(m => m.id === activeId)
    if (!model) return null
    return { provider: model.provider, apiKey: model.apiKey, model: model.model, baseUrl: model.baseUrl || '' }
  } catch { return null }
}

// ─── Wish panel ───────────────────────────────────────────────────────────────

function WishPanel({ msg }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(msg).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }
  return (
    <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
      <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">{msg}</pre>
      <button onClick={handleCopy}
        className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all"
        style={{ color: copied?'#34d399':ACCENT, background: copied?'rgba(52,211,153,0.12)':`${ACCENT}18` }}>
        {copied ? (
          <><svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>Copied!</>
        ) : (
          <><svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>Copy</>
        )}
      </button>
    </div>
  )
}

// ─── Celebration item with wish generator ─────────────────────────────────────

function CelebItem({ cel }) {
  const [msgIndex,   setMsgIndex]   = useState(0)
  const [msgs,       setMsgs]       = useState(null)
  const [aiUsed,     setAiUsed]     = useState(false)
  const [generating, setGenerating] = useState(false)

  const fallback   = getFallbackMessages(cel.name, cel.type, cel.subType)
  const isBirthday = cel.type === 'birthday'
  const emoji      = isBirthday ? '🎂' : (cel.subType === 'work-anniversary' ? '🏆' : '💝')
  const typeLabel  = isBirthday ? 'Birthday' : (cel.subType === 'work-anniversary' ? 'Work Anniversary' : 'Anniversary')
  const gifUrl     = `https://giphy.com/search/${encodeURIComponent(isBirthday ? 'happy birthday' : 'happy anniversary')}`

  const generate = useCallback(async () => {
    setGenerating(true)
    try {
      const llmConfig = getActiveLlmConfig()
      const body = { name: cel.name, type: cel.type, subType: cel.subType }
      if (llmConfig) body.llmConfig = llmConfig
      const res  = await fetch('/api/wishes/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
      const data = await res.json()
      if (data.messages?.length) {
        setMsgs(data.messages); setAiUsed(data.source === 'ai'); setMsgIndex(0)
      } else { setMsgs(null); setAiUsed(false) }
    } catch { setMsgs(null); setAiUsed(false) }
    finally  { setGenerating(false) }
  }, [cel.name, cel.type, cel.subType])

  useEffect(() => { generate() }, [generate])

  const displayMsgs = msgs || fallback

  return (
    <div className="flex flex-col gap-3 pb-4 mb-4 border-b border-white/[0.06] last:border-0 last:mb-0 last:pb-0">
      <div className="flex items-center gap-2.5">
        <span className="text-xl flex-shrink-0">{emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-200 truncate">{cel.name}</p>
          <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5"
            style={{ background:`${ACCENT}20`, color:ACCENT }}>
            {typeLabel}
          </span>
        </div>
        <a href={gifUrl} target="_blank" rel="noopener noreferrer"
          className="text-[10px] text-slate-500 hover:text-amber-400 transition-colors flex-shrink-0"
          title="Find a GIF on Giphy">Find GIF ↗</a>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              {generating && !msgs ? 'Generating…' : 'Ready Wishes'}
            </span>
            {!generating && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                style={aiUsed ? { background:'rgba(129,140,248,0.15)', color:'#818cf8' } : { background:'rgba(100,116,139,0.15)', color:'#64748b' }}>
                {aiUsed ? '✨ AI' : '📄 Templates'}
              </span>
            )}
          </div>
          {!generating && (
            <button
              onClick={() => aiUsed ? generate() : setMsgIndex(i => (i + 1) % displayMsgs.length)}
              className="flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-lg transition-colors"
              style={aiUsed ? { background:'rgba(129,140,248,0.1)', color:'#818cf8' } : { background:`${ACCENT}18`, color:ACCENT }}>
              <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              {aiUsed ? 'Regenerate' : 'Next'}
            </button>
          )}
        </div>

        {generating && !msgs ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            <svg className="animate-spin" width="14" height="14" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke={ACCENT} strokeWidth="4"/>
              <path className="opacity-75" fill={ACCENT} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span className="text-xs text-slate-500">Generating personalised message…</span>
          </div>
        ) : (
          <WishPanel msg={displayMsgs[msgIndex] ?? displayMsgs[0]} />
        )}
      </div>
    </div>
  )
}

// ─── Celebrations popup ───────────────────────────────────────────────────────

function CelebrationsPopup({ items, onClose }) {
  const [activeTab, setActiveTab] = useState(0)
  const safeTab = Math.min(activeTab, items.length - 1)

  function tabEmoji(cel) {
    if (cel.type === 'birthday') return '🎂'
    return cel.subType === 'work-anniversary' ? '🏆' : '💝'
  }

  return createPortal(
    <div
      style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={onClose}
    >
      <div
        style={{ background:'rgba(9,14,20,0.97)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:20, width:'100%', maxWidth:520, height:'min(620px,90vh)', display:'flex', flexDirection:'column', overflow:'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]" style={{ flexShrink:0 }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">🎉</span>
            <span className="font-semibold text-slate-200">Today's Celebrations</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background:`${ACCENT}18`, color:ACCENT }}>{items.length}</span>
          </div>
          <button onClick={onClose} className="btn-icon !py-1 !px-2" aria-label="Close">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Person tabs */}
        {items.length > 1 && (
          <div className="flex gap-1.5 px-6 pt-3 pb-2 overflow-x-auto" style={{ flexShrink:0 }}>
            {items.map((cel, i) => (
              <button key={i} onClick={() => setActiveTab(i)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0"
                style={{
                  background:  i === safeTab ? `${ACCENT}22` : 'rgba(255,255,255,0.05)',
                  color:       i === safeTab ? ACCENT : '#64748b',
                  border:      `1px solid ${i === safeTab ? `${ACCENT}40` : 'rgba(255,255,255,0.06)'}`,
                }}>
                <span>{tabEmoji(cel)}</span>
                <span className="truncate max-w-[80px]">{cel.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        )}

        {/* Active celebration */}
        <div style={{ flex:1, overflowY:'auto', padding:'12px 24px 24px' }}>
          <CelebItem key={safeTab} cel={items[safeTab]} />
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export default function CelebrationsCard({ data, loading, error, onRetry, delay = 0, syncedAt }) {
  const [popupOpen, setPopupOpen] = useState(false)
  const items = data || []

  function typeLabel(cel) {
    if (cel.type === 'birthday') return 'Birthday'
    return cel.subType === 'work-anniversary' ? 'Work Anniv.' : 'Anniversary'
  }
  function typeEmoji(cel) {
    if (cel.type === 'birthday') return '🎂'
    return cel.subType === 'work-anniversary' ? '🏆' : '💝'
  }

  return (
    <>
      <BentoCard accent={ACCENT} delay={delay} syncedAt={syncedAt} className="p-5 flex flex-col h-full">
        <CelebrationsBackground hasCelebrations={!loading && !error && items.length > 0} />

        <div style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column', flex:1 }}>
          <CardHeader
            icon={
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0A2 2 0 013 13V4a2 2 0 012-2h14a2 2 0 012 2v11.5"/>
              </svg>
            }
            title="Celebrations"
            accent={ACCENT}
          >
            {!loading && !error && items.length > 0 && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background:`${ACCENT}18`, color:ACCENT }}>
                {items.length} today
              </span>
            )}
          </CardHeader>

          {loading && <CardSkeleton rows={3} />}
          {!loading && error && <CardError message={error} onRetry={onRetry} />}

          {!loading && !error && items.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-6 text-center flex-1">
              <span className="text-3xl">🌞</span>
              <p className="text-sm text-slate-400">No celebrations today</p>
              <p className="text-xs text-slate-600">Enjoy your day!</p>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="flex flex-col flex-1">
              {/* Compact list */}
              <div className="flex flex-col gap-2 flex-1">
                {items.map((cel, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                    style={{ background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.14)' }}>
                    <span className="text-lg flex-shrink-0">{typeEmoji(cel)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-200 truncate">{cel.name}</p>
                      <p className="text-[11px] text-amber-500/70 mt-0.5">{typeLabel(cel)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Open popup */}
              <button
                onClick={() => setPopupOpen(true)}
                className="text-xs font-semibold mt-3 transition-colors"
                style={{ color: ACCENT }}>
                Send wishes & view messages →
              </button>
            </div>
          )}
        </div>
      </BentoCard>

      {popupOpen && items.length > 0 && (
        <CelebrationsPopup items={items} onClose={() => setPopupOpen(false)} />
      )}
    </>
  )
}
