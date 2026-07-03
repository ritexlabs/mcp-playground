import { useState, useMemo } from 'react'
import BentoCard, { CardHeader, CardSkeleton, CardError } from './BentoCard.jsx'
import { fmtCurrency } from '../utils/parsers.js'

const ACCENT = '#a78bfa'

// ─── Pseudo-random helper ─────────────────────────────────────────────────────
function pr(i, seed) {
  const x = Math.sin(i * seed + seed * 0.7) * 43758.5453
  return x - Math.floor(x)
}

// ─── Financial background scenes ─────────────────────────────────────────────
function FinanceRiseScene() {
  const dots = useMemo(() => Array.from({ length: 14 }, (_, i) => ({
    id: i,
    left:    `${pr(i, 7.3) * 95}%`,
    delay:   `${pr(i, 3.7) * 7}s`,
    dur:     `${7 + pr(i, 5.1) * 5}s`,
    size:    `${2 + Math.floor(pr(i, 2.9) * 3)}px`,
    drift:   `${(pr(i, 6.3) - 0.5) * 30}px`,
    opacity: 0.1 + pr(i, 4.1) * 0.12,
  })), [])

  return (
    <>
      {dots.map(d => (
        <div key={d.id} style={{
          position: 'absolute', left: d.left, bottom: 0,
          width: d.size, height: d.size, borderRadius: '50%',
          background: 'rgba(52,211,153,0.9)',
          boxShadow: '0 0 6px rgba(52,211,153,0.5)',
          opacity: d.opacity,
          willChange: 'transform',
          '--wx-drift': d.drift,
          animation: `wx-rise ${d.dur} ${d.delay} ease-in-out infinite`,
        }} />
      ))}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '120px',
        background: 'linear-gradient(to top, rgba(52,211,153,0.07), transparent)',
      }} />
      <div style={{
        position: 'absolute', top: '-20px', right: '-20px', width: '130px', height: '130px',
        background: 'radial-gradient(circle, rgba(52,211,153,0.09) 0%, transparent 70%)',
        animation: 'wx-sun-glow 6s ease-in-out infinite', borderRadius: '50%',
      }} />
    </>
  )
}

function FinanceFallScene() {
  const dots = useMemo(() => Array.from({ length: 14 }, (_, i) => ({
    id: i,
    left:    `${pr(i, 7.3) * 95}%`,
    delay:   `${pr(i, 3.7) * 6}s`,
    dur:     `${6 + pr(i, 5.1) * 5}s`,
    size:    `${2 + Math.floor(pr(i, 2.9) * 3)}px`,
    drift:   `${(pr(i, 6.3) - 0.5) * 25}px`,
    opacity: 0.08 + pr(i, 4.1) * 0.1,
  })), [])

  return (
    <>
      {dots.map(d => (
        <div key={d.id} style={{
          position: 'absolute', left: d.left, top: 0,
          width: d.size, height: d.size, borderRadius: '50%',
          background: 'rgba(251,113,133,0.9)',
          boxShadow: '0 0 5px rgba(251,113,133,0.4)',
          opacity: d.opacity,
          willChange: 'transform',
          '--wx-drift': d.drift,
          animation: `wx-snow ${d.dur} ${d.delay} linear infinite`,
        }} />
      ))}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '100px',
        background: 'linear-gradient(to bottom, rgba(251,113,133,0.06), transparent)',
      }} />
    </>
  )
}

function IndMoneyBackground({ state }) {
  const bgs = {
    auth:     'linear-gradient(150deg, #060410 0%, #0a0618 50%, #050310 100%)',
    positive: 'linear-gradient(150deg, #030c0a 0%, #051410 50%, #030c08 100%)',
    negative: 'linear-gradient(150deg, #0c0306 0%, #180508 50%, #0c0304 100%)',
    neutral:  'linear-gradient(150deg, #060410 0%, #0a0618 50%, #050310 100%)',
  }
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: bgs[state] || bgs.neutral }} />
      {state === 'positive' && <FinanceRiseScene />}
      {state === 'negative' && <FinanceFallScene />}
      {(state === 'auth' || state === 'neutral') && (
        <div style={{
          position: 'absolute', top: '-30px', right: '-20px', width: '180px', height: '180px',
          background: 'radial-gradient(circle, rgba(167,139,250,0.12) 0%, transparent 70%)',
          animation: 'wx-sun-glow 7s ease-in-out infinite', borderRadius: '50%',
        }} />
      )}
    </div>
  )
}

const NW_COLORS = {
  STOCK: '#38bdf8', US_STOCK: '#818cf8', US_STOCK_WALLET: '#6366f1',
  MF: '#a78bfa', EPF: '#34d399', NPS: '#22d3ee', PPF: '#4ade80',
  FD: '#fbbf24', CRYPTO: '#fb923c', REAL_ESTATE: '#94a3b8',
  VEHICLE: '#64748b', ESOPS_RSUS: '#c084fc', SA: '#f472b6',
  PHYSICAL_GOLD: '#fcd34d',
}
const NW_LABELS = {
  STOCK: 'Indian Stocks', US_STOCK: 'US Stocks', US_STOCK_WALLET: 'US Wallet',
  MF: 'Mutual Funds', EPF: 'EPF', NPS: 'NPS', PPF: 'PPF',
  FD: 'Fixed Deposits', CRYPTO: 'Crypto', REAL_ESTATE: 'Real Estate',
  VEHICLE: 'Vehicle', ESOPS_RSUS: 'ESOPs/RSUs', SA: 'Savings A/C',
  PHYSICAL_GOLD: 'Physical Gold',
}

function nwColor(t) { return NW_COLORS[t] || '#64748b' }
function nwLabel(t) { return NW_LABELS[t] || t }

// ── Arc-path donut (annular sectors) ─────────────────────────────────────────
function ArcDonut({ investments, hidden, totalNetworth }) {
  const [hovIdx, setHovIdx] = useState(-1)
  const S = 176, cx = 88, cy = 88, OR = 74, IR = 44
  const total = investments.reduce((s, inv) => s + inv.current_value, 0)
  if (!total) return null

  let angle = -Math.PI / 2
  const segments = investments.map((inv) => {
    const frac  = inv.current_value / total
    const sweep = frac * 2 * Math.PI
    const end   = angle + sweep
    const x1 = cx + OR * Math.cos(angle), y1 = cy + OR * Math.sin(angle)
    const x2 = cx + OR * Math.cos(end),   y2 = cy + OR * Math.sin(end)
    const x3 = cx + IR * Math.cos(end),   y3 = cy + IR * Math.sin(end)
    const x4 = cx + IR * Math.cos(angle), y4 = cy + IR * Math.sin(angle)
    const la = sweep > Math.PI ? 1 : 0
    const d  = [
      `M${x1.toFixed(2)},${y1.toFixed(2)}`,
      `A${OR},${OR} 0 ${la},1 ${x2.toFixed(2)},${y2.toFixed(2)}`,
      `L${x3.toFixed(2)},${y3.toFixed(2)}`,
      `A${IR},${IR} 0 ${la},0 ${x4.toFixed(2)},${y4.toFixed(2)}Z`,
    ].join(' ')
    const seg = { d, frac, inv }
    angle = end
    return seg
  })

  const hov      = hovIdx >= 0 ? investments[hovIdx] : null
  const ctrLabel = hov ? nwLabel(hov.asset_type) : 'Net Worth'
  const ctrVal   = hov ? hov.current_value : totalNetworth

  return (
    <div className="flex gap-3 items-start">
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} className="flex-shrink-0">
        {/* track ring */}
        <circle cx={cx} cy={cy} r={(OR + IR) / 2} fill="none"
          stroke="rgba(255,255,255,0.05)" strokeWidth={OR - IR} />
        {/* arc segments */}
        {segments.map((seg, i) => (
          <path
            key={i}
            d={seg.d}
            fill={nwColor(seg.inv.asset_type)}
            style={{
              opacity: hovIdx === -1 ? 1 : hovIdx === i ? 1 : 0.25,
              cursor: 'pointer',
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={() => setHovIdx(i)}
            onMouseLeave={() => setHovIdx(-1)}
          />
        ))}
        {/* centre label */}
        <text x={cx} y={cy - 8} textAnchor="middle"
          style={{ fill: '#64748b', fontSize: '9px', fontFamily: 'Inter,sans-serif' }}>
          {ctrLabel.length > 13 ? ctrLabel.slice(0, 13) + '…' : ctrLabel}
        </text>
        <text x={cx} y={cy + 9} textAnchor="middle"
          style={{ fill: '#e2e8f0', fontSize: '11px', fontWeight: 600, fontFamily: '"JetBrains Mono",monospace' }}>
          {hidden ? '••••••' : fmtCurrency(ctrVal, true)}
        </text>
      </svg>

      {/* Legend */}
      <div className="flex-1 min-w-0 flex flex-col gap-1 pt-0.5 overflow-y-auto max-h-44">
        {segments.map((seg, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg cursor-pointer transition-colors"
            style={{ background: hovIdx === i ? 'rgba(255,255,255,0.05)' : 'transparent' }}
            onMouseEnter={() => setHovIdx(i)}
            onMouseLeave={() => setHovIdx(-1)}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: nwColor(seg.inv.asset_type) }} />
            <span className="text-[11px] text-slate-400 truncate flex-1">
              {nwLabel(seg.inv.asset_type)}
            </span>
            <span className="text-[11px] font-mono font-semibold text-slate-300 flex-shrink-0">
              {hidden ? '••••' : fmtCurrency(seg.inv.current_value, true)}
            </span>
            <span className="text-[10px] text-slate-600 flex-shrink-0">
              {(seg.frac * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Chart view ────────────────────────────────────────────────────────────────
function ChartView({ data, hidden }) {
  const { totalNetworth, totalInvested, investments } = data
  const gain    = totalInvested ? totalNetworth - totalInvested : 0
  const gainPct = totalInvested > 0 ? (gain / totalInvested) * 100 : 0
  const isUp    = gain >= 0

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="card-label">Total Net Worth</p>
        <p className="text-3xl font-bold tabular-nums tracking-tight mt-1" style={{ color: ACCENT }}>
          {hidden ? '₹ ••••••' : fmtCurrency(totalNetworth)}
        </p>
        {totalInvested > 0 && (
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold mt-1.5 px-2 py-0.5 rounded-full"
            style={{
              color:      isUp ? '#34d399' : '#fb7185',
              background: isUp ? 'rgba(52,211,153,0.12)' : 'rgba(251,113,133,0.12)',
            }}
          >
            {isUp ? '▲' : '▼'} {hidden ? '••••' : fmtCurrency(Math.abs(gain), true)}
            &nbsp;({isUp ? '+' : ''}{gainPct.toFixed(2)}%)
          </span>
        )}
      </div>
      {investments.length > 0 && (
        <ArcDonut investments={investments} hidden={hidden} totalNetworth={totalNetworth} />
      )}
    </div>
  )
}

// ── Activity view ─────────────────────────────────────────────────────────────
function ActivityView({ data, hidden }) {
  const { investments, stockSips = [], mfSips = [] } = data
  const allSips = [...stockSips, ...mfSips]
  const maxVal  = investments[0]?.current_value || 1

  const withRet = investments.filter(i => i.return_percentage && i.invested_value > 0)
  const gainers = [...withRet].sort((a, b) => b.return_percentage - a.return_percentage).slice(0, 3)
  const losers  = withRet.filter(i => i.return_percentage < 0)
    .sort((a, b) => a.return_percentage - b.return_percentage).slice(0, 2)

  return (
    <div className="flex flex-col gap-4 overflow-y-auto max-h-72 pr-0.5">
      {gainers.length > 0 && (
        <div>
          <p className="card-label mb-1.5">Top Performers</p>
          {gainers.map((inv, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: nwColor(inv.asset_type) }} />
              <span className="text-xs text-slate-400 flex-1">{nwLabel(inv.asset_type)}</span>
              <span className="text-xs font-semibold" style={{ color: '#34d399' }}>
                +{inv.return_percentage.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {losers.length > 0 && (
        <div>
          <p className="card-label mb-1.5">Underperformers</p>
          {losers.map((inv, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: nwColor(inv.asset_type) }} />
              <span className="text-xs text-slate-400 flex-1">{nwLabel(inv.asset_type)}</span>
              <span className="text-xs font-semibold" style={{ color: '#fb7185' }}>
                {inv.return_percentage.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="card-label mb-2">Asset Breakdown</p>
        <div className="flex flex-col gap-2.5">
          {investments.map((inv, i) => {
            const barPct = (inv.current_value / maxVal) * 100
            const ret    = inv.return || 0
            const isUp   = ret >= 0
            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] text-slate-400">{nwLabel(inv.asset_type)}</span>
                  <span className="text-[11px] font-mono font-semibold text-slate-300">
                    {hidden ? '••••' : fmtCurrency(inv.current_value, true)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${barPct.toFixed(1)}%`, background: nwColor(inv.asset_type) }}
                  />
                </div>
                {inv.return_percentage ? (
                  <span className="text-[10px]" style={{ color: isUp ? '#34d399' : '#fb7185' }}>
                    {isUp ? '▲' : '▼'} {Math.abs(inv.return_percentage).toFixed(1)}%
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {allSips.length > 0 && (
        <div>
          <p className="card-label mb-1.5">Active SIPs</p>
          {allSips.slice(0, 6).map((s, i) => (
            <div key={i}
              className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
              <span className="text-xs text-slate-400 truncate flex-1 mr-2">
                {s.name || s.scheme_name || s.symbol || 'SIP'}
              </span>
              <span className="text-xs font-mono text-slate-300 flex-shrink-0">
                {hidden ? '••••' : fmtCurrency(s.amount || s.installment_amount || 0, true)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main card ─────────────────────────────────────────────────────────────────
export default function IndMoneyCard({ data, loading, error, onRetry, onConnect, delay = 0, syncedAt }) {
  const [hidden, setHidden] = useState(false)
  const [view,   setView]   = useState('chart')

  const isAuthRequired = data?.authRequired

  const bgState = useMemo(() => {
    if (!data || loading || error || isAuthRequired) return 'auth'
    const nw  = data.totalNetworth  ?? 0
    const inv = data.totalInvested  ?? 0
    if (!inv) return 'neutral'
    return nw >= inv ? 'positive' : 'negative'
  }, [data, loading, error, isAuthRequired])

  return (
    <BentoCard accent={ACCENT} delay={delay} syncedAt={syncedAt} className="p-5">
      <IndMoneyBackground state={bgState} />
      <div style={{ position: 'relative', zIndex: 1 }}>
      <CardHeader
        icon={
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        }
        title="My Networth"
        accent={ACCENT}
      >
        {!isAuthRequired && !loading && !error && data && (
          <>
            {/* Chart / Activity toggle */}
            <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
              {['chart', 'activity'].map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="text-[10px] px-2.5 py-1 font-medium transition-colors capitalize"
                  style={{
                    background: view === v ? `${ACCENT}22` : 'transparent',
                    color:      view === v ? ACCENT : '#64748b',
                  }}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Privacy toggle */}
            <button
              onClick={() => setHidden(h => !h)}
              className="btn-icon !py-1 !px-2"
              aria-label={hidden ? 'Show values' : 'Hide values'}
            >
              {hidden ? (
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              ) : (
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                </svg>
              )}
            </button>

            {/* Refresh */}
            <button onClick={onRetry} className="btn-icon !py-1 !px-2" aria-label="Refresh networth">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </button>
          </>
        )}
      </CardHeader>

      {loading && <CardSkeleton rows={4} />}
      {!loading && error && <CardError message={error} onRetry={onRetry} />}

      {/* Not connected */}
      {!loading && !error && isAuthRequired && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: `${ACCENT}15` }}>
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={ACCENT} strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-200">IndMoney not connected</p>
            <p className="text-xs text-slate-500 mt-0.5 max-w-[220px]">
              Link your account to see net worth and portfolio
            </p>
          </div>
          <button onClick={onConnect} className="btn-primary text-xs px-4 py-2">
            Connect IndMoney
          </button>
        </div>
      )}

      {/* Data */}
      {!loading && !error && data && !isAuthRequired && (
        view === 'chart'
          ? <ChartView data={data} hidden={hidden} />
          : <ActivityView data={data} hidden={hidden} />
      )}
      </div>
    </BentoCard>
  )
}
