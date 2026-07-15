import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import BentoCard, { CardHeader, CardSkeleton, CardError } from './BentoCard.jsx'
import { fmtCurrency, fmtPct } from '../utils/parsers.js'

const ACCENT = '#34d399'

function pr(i, seed) {
  const x = Math.sin(i * seed + seed * 0.7) * 43758.5453
  return x - Math.floor(x)
}

// ─── Backgrounds ──────────────────────────────────────────────────────────────

function StocksRiseScene() {
  const dots = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    id: i, left: `${pr(i,7.3)*96}%`, delay: `${pr(i,3.7)*8}s`,
    dur: `${8+pr(i,5.1)*6}s`, size: `${2+Math.floor(pr(i,2.9)*3)}px`,
    drift: `${(pr(i,6.3)-0.5)*28}px`, opacity: 0.07+pr(i,4.1)*0.1,
  })), [])
  return (
    <>
      {dots.map(d => (
        <div key={d.id} style={{ position:'absolute', left:d.left, bottom:0, width:d.size, height:d.size, borderRadius:'50%', background:'rgba(52,211,153,0.9)', boxShadow:'0 0 5px rgba(52,211,153,0.4)', opacity:d.opacity, willChange:'transform', '--wx-drift':d.drift, animation:`wx-rise ${d.dur} ${d.delay} ease-in-out infinite` }} />
      ))}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'100px', background:'linear-gradient(to top, rgba(52,211,153,0.06), transparent)' }} />
      <div style={{ position:'absolute', bottom:'-20px', right:'-20px', width:'180px', height:'160px', background:'radial-gradient(ellipse, rgba(52,211,153,0.08) 0%, transparent 70%)', animation:'wx-sun-glow 7s ease-in-out infinite', borderRadius:'50%' }} />
    </>
  )
}

function StocksFallScene() {
  const dots = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    id: i, left: `${pr(i,7.3)*96}%`, delay: `${pr(i,3.7)*7}s`,
    dur: `${7+pr(i,5.1)*5}s`, size: `${2+Math.floor(pr(i,2.9)*3)}px`,
    drift: `${(pr(i,6.3)-0.5)*24}px`, opacity: 0.07+pr(i,4.1)*0.09,
  })), [])
  return (
    <>
      {dots.map(d => (
        <div key={d.id} style={{ position:'absolute', left:d.left, top:0, width:d.size, height:d.size, borderRadius:'50%', background:'rgba(251,113,133,0.9)', boxShadow:'0 0 5px rgba(251,113,133,0.3)', opacity:d.opacity, willChange:'transform', '--wx-drift':d.drift, animation:`wx-snow ${d.dur} ${d.delay} linear infinite` }} />
      ))}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:'80px', background:'linear-gradient(to bottom, rgba(251,113,133,0.05), transparent)' }} />
    </>
  )
}

function StocksBackground({ pnl }) {
  const bg = pnl === null
    ? 'linear-gradient(150deg, #020a06 0%, #040e0a 50%, #020a06 100%)'
    : pnl >= 0
      ? 'linear-gradient(150deg, #030c07 0%, #05140a 50%, #030c07 100%)'
      : 'linear-gradient(150deg, #0c0303 0%, #140506 50%, #0c0303 100%)'
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: bg }} />
      {pnl !== null && pnl >= 0 && <StocksRiseScene />}
      {pnl !== null && pnl < 0  && <StocksFallScene />}
    </div>
  )
}

// ─── Full portfolio popup ─────────────────────────────────────────────────────

function SortIcon({ active, dir }) {
  return (
    <span className="inline-flex flex-col ml-1" style={{ opacity: active ? 1 : 0.3 }}>
      <span style={{ fontSize:8, color: active && dir === 'asc' ? ACCENT : undefined }}>▲</span>
      <span style={{ fontSize:8, color: active && dir === 'desc' ? ACCENT : undefined }}>▼</span>
    </span>
  )
}

function StocksPopup({ rows, onClose }) {
  const [activeBroker,  setActiveBroker]  = useState('all')
  const [sort,          setSort]          = useState({ key: null, dir: 'asc' })
  const [valuesHidden,  setValuesHidden]  = useState(false)

  const brokers = useMemo(() => ['all', ...new Set(rows.map(r => r.broker).filter(Boolean))], [rows])

  const filtered = useMemo(() => {
    let list = activeBroker === 'all' ? rows : rows.filter(r => r.broker === activeBroker)
    if (sort.key) {
      list = [...list].sort((a, b) => {
        const av = a[sort.key] ?? 0, bv = b[sort.key] ?? 0
        return sort.dir === 'asc' ? av - bv : bv - av
      })
    }
    return list
  }, [rows, activeBroker, sort])

  const totals = useMemo(() => {
    const invested = filtered.reduce((s, r) => s + (r.buy || 0) * (r.qty || 0), 0)
    const current  = filtered.reduce((s, r) => s + (r.curr || 0) * (r.qty || 0), 0)
    return { invested, current, pnl: current - invested, pnlPct: invested ? ((current - invested) / invested) * 100 : 0 }
  }, [filtered])

  function toggleSort(key) {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  }

  const Th = ({ label, sortKey }) => (
    <th className="py-2 px-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-slate-300 transition-colors"
      onClick={() => sortKey && toggleSort(sortKey)}>
      {label}{sortKey && <SortIcon active={sort.key === sortKey} dir={sort.dir} />}
    </th>
  )

  return createPortal(
    <div
      style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={onClose}
    >
      <div
        style={{ background:'rgba(9,14,20,0.97)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:20, width:'100%', maxWidth:700, height:'min(640px,90vh)', display:'flex', flexDirection:'column', overflow:'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]" style={{ flexShrink:0 }}>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={ACCENT} strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
            </svg>
            <span className="font-semibold text-slate-200">Stock Portfolio</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background:`${ACCENT}18`, color:ACCENT }}>{rows.length} holdings</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setValuesHidden(v => !v)} className="btn-icon !py-1 !px-2" aria-label="Toggle values">
              {valuesHidden ? (
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              ) : (
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                </svg>
              )}
            </button>
            <button onClick={onClose} className="btn-icon !py-1 !px-2" aria-label="Close">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Broker tabs */}
        {brokers.length > 2 && (
          <div className="flex gap-1.5 px-6 py-3 overflow-x-auto border-b border-white/[0.06]" style={{ flexShrink:0 }}>
            {brokers.map(b => (
              <button key={b} onClick={() => setActiveBroker(b)}
                className={`broker-tab ${activeBroker === b ? 'active' : ''}`}>
                {b === 'all' ? 'All Brokers' : b}
              </button>
            ))}
          </div>
        )}

        {/* Table */}
        <div style={{ flex:1, overflowY:'auto' }}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead className="sticky top-0" style={{ background:'rgba(9,14,20,0.95)' }}>
                <tr className="border-b border-white/[0.06]">
                  <Th label="Symbol" />
                  <Th label="Qty"       sortKey="qty" />
                  <Th label="Buy ₹"     sortKey="buy" />
                  <Th label="Current ₹" sortKey="curr" />
                  <Th label="P&L"       sortKey="pnl" />
                  <Th label="%" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const positive = r.pnl >= 0
                  return (
                    <tr key={r.sym + i} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-200 font-mono text-xs">{r.sym}</span>
                        {r.name !== r.sym && <p className="text-[10px] text-slate-500 truncate max-w-[100px]">{r.name}</p>}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-300 text-xs">{r.qty}</td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-300 text-xs">{valuesHidden ? '••••' : fmtCurrency(r.buy)}</td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-200 font-medium text-xs">{valuesHidden ? '••••' : fmtCurrency(r.curr)}</td>
                      <td className="py-2.5 px-3 font-mono tabular-nums font-semibold text-xs" style={{ color: positive ? '#34d399' : '#fb7185' }}>
                        {positive ? '+' : ''}{valuesHidden ? '••••' : fmtCurrency(r.pnl)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ color: positive?'#34d399':'#fb7185', background: positive?'rgba(52,211,153,0.12)':'rgba(251,113,133,0.12)' }}>
                          {fmtPct(r.pnlPct)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer totals */}
        <div className="grid grid-cols-3 gap-3 px-6 py-4 border-t border-white/[0.06]" style={{ flexShrink:0 }}>
          {[
            { label:'Invested',      value: fmtCurrency(totals.invested, true), color:'#94a3b8' },
            { label:'Current Value', value: fmtCurrency(totals.current,  true), color:'#e2e8f0' },
            { label:'Overall P&L',   value: fmtCurrency(totals.pnl, true),      color: totals.pnl >= 0 ? '#34d399' : '#fb7185' },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-0.5">{label}</p>
              <p className="text-sm font-bold tabular-nums font-mono" style={{ color }}>
                {valuesHidden ? '••••••' : value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Compact portfolio donut (card face — no legend) ─────────────────────────

const STOCK_PALETTE = [
  '#34d399', '#38bdf8', '#a78bfa', '#fbbf24', '#fb923c',
  '#f472b6', '#22d3ee', '#818cf8', '#4ade80', '#e879f9',
]

function CompactStocksDonut({ brokerTotals, totals }) {
  const [hovIdx, setHovIdx] = useState(-1)

  const segments = brokerTotals.map((b, i) => ({
    label:  b.broker,
    curVal: b.current,
    pnl:    b.pnl,
    pnlPct: b.pnlPct,
    color:  STOCK_PALETTE[i % STOCK_PALETTE.length],
  }))

  const total = segments.reduce((s, seg) => s + seg.curVal, 0)
  if (!total) return null

  const S = 120, cx = 60, cy = 60, OR = 50, IR = 30
  let angle = -Math.PI / 2
  const arcs = segments.map(seg => {
    const sweep = (seg.curVal / total) * 2 * Math.PI
    const end   = angle + sweep
    const x1 = cx + OR * Math.cos(angle), y1 = cy + OR * Math.sin(angle)
    const x2 = cx + OR * Math.cos(end),   y2 = cy + OR * Math.sin(end)
    const x3 = cx + IR * Math.cos(end),   y3 = cy + IR * Math.sin(end)
    const x4 = cx + IR * Math.cos(angle), y4 = cy + IR * Math.sin(angle)
    const la  = sweep > Math.PI ? 1 : 0
    const d   = [
      `M${x1.toFixed(2)},${y1.toFixed(2)}`,
      `A${OR},${OR} 0 ${la},1 ${x2.toFixed(2)},${y2.toFixed(2)}`,
      `L${x3.toFixed(2)},${y3.toFixed(2)}`,
      `A${IR},${IR} 0 ${la},0 ${x4.toFixed(2)},${y4.toFixed(2)}Z`,
    ].join(' ')
    angle = end
    return { d, seg }
  })

  const hov      = hovIdx >= 0 ? segments[hovIdx] : null
  const ctrLabel = hov ? hov.label : 'P&L'
  const ctrPct   = hov ? hov.pnlPct : totals.pnlPct
  const ctrColor = (hov ? hov.pnl : totals.pnl) >= 0 ? '#34d399' : '#fb7185'

  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} className="flex-shrink-0">
      <circle cx={cx} cy={cy} r={(OR + IR) / 2} fill="none"
        stroke="rgba(255,255,255,0.05)" strokeWidth={OR - IR} />
      {arcs.map((arc, i) => (
        <path key={i} d={arc.d} fill={arc.seg.color}
          style={{ opacity: hovIdx === -1 ? 1 : hovIdx === i ? 1 : 0.25, cursor: 'pointer', transition: 'opacity 0.15s' }}
          onMouseEnter={() => setHovIdx(i)} onMouseLeave={() => setHovIdx(-1)} />
      ))}
      <text x={cx} y={cy - 7} textAnchor="middle"
        style={{ fill: '#64748b', fontSize: '8px', fontFamily: 'Inter,sans-serif' }}>
        {ctrLabel.length > 7 ? ctrLabel.slice(0, 7) + '…' : ctrLabel}
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle"
        style={{ fill: ctrColor, fontSize: '11px', fontWeight: 700, fontFamily: '"JetBrains Mono",monospace' }}>
        {ctrPct >= 0 ? '+' : ''}{ctrPct.toFixed(1)}%
      </text>
    </svg>
  )
}

// ─── Market indices strip ─────────────────────────────────────────────────────

const IDX_SHORT = { 'NIFTY 50': 'NIFTY', 'BANKNIFTY': 'BANK N', 'SENSEX': 'SENSEX' }

function fmtIdx(n) {
  if (n == null) return '--'
  return n.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function IndicesStrip({ indices, loading }) {
  if (loading && !indices?.length) {
    return (
      <div className="flex flex-col gap-1.5 pb-3 mb-3 border-b border-white/[0.06]">
        {[70, 85, 78].map((w, i) => (
          <div key={i} className="skeleton h-3.5 rounded" style={{ width: `${w}%` }} />
        ))}
      </div>
    )
  }
  if (!indices?.length) return null

  return (
    <div className="flex flex-col pb-3 mb-3 border-b border-white/[0.06]">
      {indices.map(idx => {
        const up  = idx.change >= 0
        const clr = up ? '#34d399' : '#fb7185'
        const pts = idx.change != null
          ? (up ? '+' : '') + idx.change.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '--'
        return (
          <div key={idx.label} className="flex items-center gap-1 py-0.5">
            <span className="text-[10px] font-bold text-slate-500 w-[46px] flex-shrink-0">
              {IDX_SHORT[idx.label] || idx.label}
            </span>
            <span className="text-[11px] font-mono tabular-nums text-slate-200 w-[60px] flex-shrink-0">
              {fmtIdx(idx.price)}
            </span>
            <span style={{ color: clr, fontSize: 8 }} className="flex-shrink-0">{up ? '▲' : '▼'}</span>
            <span className="text-[10px] font-mono tabular-nums flex-shrink-0" style={{ color: clr }}>
              {pts}
            </span>
            <span className="text-[10px] font-mono tabular-nums font-semibold flex-shrink-0 ml-auto" style={{ color: clr }}>
              ({up ? '+' : ''}{idx.changePct?.toFixed(2)}%)
            </span>
          </div>
        )
      })}
      <p className="text-[9px] text-slate-700 mt-1">Live · NSE / BSE</p>
    </div>
  )
}

// ─── Eye icon SVGs ────────────────────────────────────────────────────────────

function EyeOpen({ size = 13 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
    </svg>
  )
}

function EyeOff({ size = 13 }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
    </svg>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export default function StocksCard({ data, loading, error, indices, indicesLoading, onRetry, onRefresh, delay = 0, syncedAt }) {
  const [popupOpen, setPopupOpen] = useState(false)
  const [hidden,    setHidden]    = useState(false)

  const rows = data || []

  const overallPnl = useMemo(() => {
    if (!rows.length) return null
    const inv = rows.reduce((s, r) => s + (r.buy  || 0) * (r.qty || 0), 0)
    const cur = rows.reduce((s, r) => s + (r.curr || 0) * (r.qty || 0), 0)
    return cur - inv
  }, [rows])

  const totals = useMemo(() => {
    const invested = rows.reduce((s, r) => s + (r.buy  || 0) * (r.qty || 0), 0)
    const current  = rows.reduce((s, r) => s + (r.curr || 0) * (r.qty || 0), 0)
    const pnl      = current - invested
    const pnlPct   = invested ? (pnl / invested) * 100 : 0
    return { invested, current, pnl, pnlPct }
  }, [rows])

  // Per-broker totals
  const brokerTotals = useMemo(() => {
    const map = {}
    for (const r of rows) {
      const b = r.broker || 'Unknown'
      if (!map[b]) map[b] = { broker: b, invested: 0, current: 0 }
      map[b].invested += (r.buy  || 0) * (r.qty || 0)
      map[b].current  += (r.curr || 0) * (r.qty || 0)
    }
    return Object.values(map).map(b => ({
      ...b,
      pnl:    b.current - b.invested,
      pnlPct: b.invested > 0 ? ((b.current - b.invested) / b.invested) * 100 : 0,
    })).sort((a, b) => b.current - a.current)
  }, [rows])

  // Profit / loss counts
  const { inProfit, inLoss } = useMemo(() => {
    let inProfit = 0, inLoss = 0
    for (const r of rows) {
      if ((r.pnl || 0) > 0) inProfit++
      else if ((r.pnl || 0) < 0) inLoss++
    }
    return { inProfit, inLoss }
  }, [rows])

  // Top gainer / loser
  const { topGainer, topLoser } = useMemo(() => {
    if (!rows.length) return { topGainer: null, topLoser: null }
    const withPnl = rows.filter(r => (r.buy || 0) > 0).map(r => ({
      sym: r.sym, pnl: r.pnl || 0, pnlPct: r.pnlPct || 0,
    }))
    if (!withPnl.length) return { topGainer: null, topLoser: null }
    const sorted = [...withPnl].sort((a, b) => b.pnlPct - a.pnlPct)
    return { topGainer: sorted[0], topLoser: sorted[sorted.length - 1] }
  }, [rows])

  return (
    <>
      <BentoCard accent={ACCENT} delay={delay} syncedAt={syncedAt} className="p-5 flex flex-col h-full">
        <StocksBackground pnl={loading || error ? null : overallPnl} />
        <div style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column', flex:1 }}>

          <CardHeader
            icon={
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
            }
            title="Stocks"
            accent={ACCENT}
          >
            {!loading && !error && rows.length > 0 && (
              <div className="flex items-center gap-2">
                <button onClick={() => setHidden(h => !h)} className="btn-icon !py-1 !px-2" aria-label="Toggle values">
                  {hidden ? <EyeOpen /> : <EyeOff />}
                </button>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background:`${ACCENT}18`, color:ACCENT }}>
                  {rows.length}
                </span>
              </div>
            )}
          </CardHeader>

          <IndicesStrip indices={indices} loading={indicesLoading} />

          {loading && <CardSkeleton rows={4} />}
          {!loading && error && <CardError message={error} onRetry={onRetry} />}

          {!loading && !error && rows.length === 0 && (
            <div className="py-8 text-center flex-1 flex flex-col items-center justify-center">
              <p className="text-sm text-slate-400">No portfolio data</p>
              <p className="text-xs text-slate-600 mt-1">Configure in Settings → Stocks</p>
            </div>
          )}

          {!loading && !error && rows.length > 0 && (
            <div className="flex flex-col flex-1 gap-3 mt-1">
              {/* Donut + right column */}
              <div className="flex items-start gap-3">
                {/* Compact donut (overall P&L % in centre) */}
                <CompactStocksDonut brokerTotals={brokerTotals} totals={totals} />

                {/* Right: broker breakdown */}
                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                  {brokerTotals.map(b => {
                    const isUp = b.pnl >= 0
                    return (
                      <div key={b.broker}
                        className="flex flex-col gap-0.5 px-2.5 py-2 rounded-xl"
                        style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}
                      >
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{b.broker}</span>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] text-slate-600">Invested</span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {hidden ? '••••••' : fmtCurrency(b.invested, true)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] text-slate-600">P&L</span>
                          <span className="text-[10px] font-mono font-semibold"
                            style={{ color: isUp ? '#34d399' : '#fb7185' }}>
                            {isUp ? '+' : ''}{hidden ? '••••••' : fmtCurrency(b.pnl, true)}
                            {' '}({isUp ? '+' : ''}{b.pnlPct.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Profit / loss count */}
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                  <span style={{ fontSize: 9 }}>▲</span>{inProfit} profit
                </span>
                <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(251,113,133,0.12)', color: '#fb7185' }}>
                  <span style={{ fontSize: 9 }}>▼</span>{inLoss} loss
                </span>
              </div>

              {/* Top gainer / loser */}
              {(topGainer || topLoser) && (
                <div className="flex flex-col gap-1 pt-2 border-t border-white/[0.06]">
                  <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Highlights</p>
                  <div className="flex gap-2">
                    {topGainer && (
                      <div className="flex-1 flex items-center gap-1.5 min-w-0">
                        <span style={{ color:'#34d399', fontSize:10 }}>▲</span>
                        <span className="text-[11px] font-mono text-slate-300 truncate">{topGainer.sym}</span>
                        <span className="text-[10px] font-semibold flex-shrink-0" style={{ color:'#34d399' }}>
                          +{topGainer.pnlPct.toFixed(1)}%
                        </span>
                      </div>
                    )}
                    {topLoser && topLoser.sym !== topGainer?.sym && (
                      <div className="flex-1 flex items-center gap-1.5 min-w-0">
                        <span style={{ color:'#fb7185', fontSize:10 }}>▼</span>
                        <span className="text-[11px] font-mono text-slate-300 truncate">{topLoser.sym}</span>
                        <span className="text-[10px] font-semibold flex-shrink-0" style={{ color:'#fb7185' }}>
                          {topLoser.pnlPct.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={() => setPopupOpen(true)}
                className="text-xs font-semibold transition-colors text-left mt-auto"
                style={{ color: ACCENT }}>
                View all {rows.length} holdings →
              </button>
            </div>
          )}
        </div>
      </BentoCard>

      {popupOpen && rows.length > 0 && (
        <StocksPopup rows={rows} onClose={() => setPopupOpen(false)} />
      )}
    </>
  )
}
