// ── Weather ───────────────────────────────────────────────────────────────────

export function parseWeather(raw) {
  const text = raw?.content?.[0]?.text || ''
  const m = (re) => { const r = text.match(re); return r ? r[1].trim() : '--' }
  return {
    condition: m(/\*\*Condition:\*\*\s*(.*)/i),
    temp:      m(/\*\*Temperature:\*\*\s*(.*)/i).replace(/[^\d.\-°C F]/g, '').replace(/°?C?$/,''),
    feelsLike: m(/\*\*Feels Like:\*\*\s*(.*)/i),
    humidity:  m(/\*\*Humidity:\*\*\s*(.*)/i),
    precip:    m(/\*\*Precipitation:\*\*\s*(.*)/i),
    wind:      m(/\*\*Wind Speed:\*\*\s*(.*)/i),
    location:  m(/Weather for \*\*(.*?)\*\*/i),
  }
}

export function weatherIcon(condition = '') {
  const d = condition.toLowerCase()
  if (d.includes('thunder') || d.includes('storm'))  return 'storm'
  if (d.includes('snow') || d.includes('sleet'))     return 'snow'
  if (d.includes('rain') || d.includes('drizzle') || d.includes('shower')) return 'rain'
  if (d.includes('fog') || d.includes('mist') || d.includes('haze'))       return 'fog'
  if (d.includes('cloud') || d.includes('overcast')) return d.includes('partly') ? 'partly-cloudy' : 'cloudy'
  if (d.includes('clear') || d.includes('sunny'))    return isDay() ? 'sunny' : 'night'
  return isDay() ? 'sunny' : 'night'
}

function isDay() {
  const h = new Date().getHours()
  return h >= 6 && h < 18
}

// ── Calendar ──────────────────────────────────────────────────────────────────

export function parseCalendar(raw) {
  if (raw?.isError) throw new Error(raw.content?.[0]?.text || 'Calendar error')
  const text = raw?.content?.[0]?.text || ''
  if (!text || text.includes('No events')) return []

  const events = []
  const blocks = text.split(/(?=•\s+\*\*)/)
  for (const block of blocks) {
    if (!block.trim()) continue
    const titleMatch = block.match(/^•\s+\*\*(.+?)\*\*/)
    if (!titleMatch) continue
    const title      = titleMatch[1].trim()
    const startMatch = block.match(/\*\*Start:\*\*\s*([\d\-T:+Z.]+)/i)
    const endMatch   = block.match(/\*\*End:\*\*\s*([\d\-T:+Z.]+)/i)
    const locMatch   = block.match(/\*\*Location:\*\*\s*(.+)/i)
    const allDayMatch = block.match(/\*\*All.day:\*\*\s*true/i)

    const start = startMatch ? parseIso(startMatch[1]) : null
    const end   = endMatch   ? parseIso(endMatch[1])   : null

    events.push({
      title,
      start,
      end,
      location: locMatch ? locMatch[1].trim() : '',
      allDay:   !!allDayMatch || !startMatch,
    })
  }
  return events.sort((a, b) => {
    if (!a.start) return 1
    if (!b.start) return -1
    return a.start - b.start
  })
}

function parseIso(str) {
  if (!str) return null
  // handle "YYYY-MM-DD" (date-only) as local midnight
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, mo, d] = str.split('-').map(Number)
    return new Date(y, mo - 1, d)
  }
  return new Date(str)
}

// ── Stocks ────────────────────────────────────────────────────────────────────

export function parseStocks(raw) {
  if (raw?.isError) throw new Error(raw.content?.[0]?.text || 'Stocks error')
  const text = raw?.content?.[0]?.text || ''
  if (!text || text.includes('No stocks') || text.includes('not configured')) return []

  // Pipe-table format (primary MCP get_stocks response format)
  const tableLines = text.split('\n').map(l => l.trim()).filter(l => l.startsWith('|'))
  if (tableLines.length >= 3) {
    let hdr = -1
    for (let i = 0; i < tableLines.length; i++) {
      if (tableLines[i].toLowerCase().includes('broker')) { hdr = i; break }
    }
    if (hdr >= 0) return _tableToStocks(tableLines, hdr)
  }

  // Bullet / block fallback
  const rows = []
  const blocks = text.split(/\n(?=•?\s*\*\*[A-Z])/).filter(Boolean)
  for (const block of blocks) {
    const sym    = block.match(/\*\*([A-Z0-9.&:-]+)\*\*/)?.[1] || ''
    if (!sym) continue
    const name   = block.match(/Name:\s*(.+)/i)?.[1]?.trim()   || sym
    const broker = block.match(/Broker:\s*(.+)/i)?.[1]?.trim() || 'Unknown'
    const qty    = parseNum(block.match(/Qty(?:uantity)?:\s*([\d.,]+)/i)?.[1])
    const buy    = parseNum(block.match(/(?:Purchase|Buy|Avg\.?)\s*Price:\s*₹?([\d.,]+)/i)?.[1])
    const curr   = parseNum(block.match(/Current\s*Price:\s*₹?([\d.,]+)/i)?.[1])
    const pnl    = parseNum(block.match(/P&L:\s*[₹]?([-\d.,]+)/i)?.[1])
    const pnlPct = parseNum(block.match(/P&L.*?%[^-\d]*([-\d.]+)%/i)?.[1]
                         || block.match(/\(([-\d.]+)%\)/)?.[1])
    rows.push({ sym, name, broker, qty, buy, curr, pnl, pnlPct })
  }
  return rows
}

function _findCol(headers, kws) {
  for (let i = 0; i < headers.length; i++)
    for (const kw of kws) if (headers[i].includes(kw)) return i
  return -1
}

function _tableToStocks(lines, hdr) {
  const headers = lines[hdr].split('|').map(h => h.trim().toLowerCase())
    .filter((_, i, a) => i > 0 && i < a.length - 1)

  const ci = {
    broker: _findCol(headers, ['broker']),
    symbol: _findCol(headers, ['exchange:symbol', 'symbol', 'stock', 'ticker']),
    qty:    _findCol(headers, ['qty', 'quantity', 'shares']),
    rate:   _findCol(headers, ['rate']),
    buy:    _findCol(headers, ['buy']),
    curr:   _findCol(headers, ['current price', 'current']),
    pnlAmt: _findCol(headers, ['p&l', 'pnl']),
    pnlPct: _findCol(headers, ['% change', 'change', '%']),
  }

  const rows = []
  for (let i = hdr + 2; i < lines.length; i++) {
    const cells = lines[i].split('|').map(c => c.trim())
      .filter((_, j, a) => j > 0 && j < a.length - 1)
    if (!cells.length) continue

    const get = (idx) => (idx >= 0 && idx < cells.length ? cells[idx] : '')
    const toN = (s) => parseFloat(s.replace(/[^0-9.\-]/g, '')) || 0

    const broker = get(ci.broker)
    if (!broker) continue
    const rawSym = get(ci.symbol)
    const sym = rawSym.includes(':') ? rawSym.split(':')[1] : rawSym
    if (!sym) continue

    const qty    = toN(get(ci.qty))
    const rate   = toN(get(ci.rate))
    const buyTot = toN(get(ci.buy))
    const curr   = toN(get(ci.curr))
    const pnlA   = toN(get(ci.pnlAmt))
    const pnlP   = toN(get(ci.pnlPct))

    const invested = buyTot > 0 ? buyTot : qty * rate
    const current  = curr > 0 ? qty * curr : 0
    const pnl      = pnlA !== 0 ? pnlA : current - invested
    const pnlPct   = pnlP !== 0 ? pnlP : (invested > 0 ? (pnl / invested) * 100 : 0)

    rows.push({ sym, name: sym, broker, qty, buy: rate, curr, pnl, pnlPct })
  }
  return rows
}

function parseNum(str) {
  if (!str) return 0
  return parseFloat(str.replace(/,/g, '')) || 0
}

// ── Celebrations ──────────────────────────────────────────────────────────────

export function parseCelebrations(raw) {
  if (Array.isArray(raw)) return raw
  if (raw?.isError) return []
  const text = raw?.content?.[0]?.text || ''
  if (!text || text.includes('No celebrations')) return []

  const items = []
  const blocks = text.split(/\n(?=•)/).filter(Boolean)
  for (const b of blocks) {
    const name = b.match(/\*\*(.+?)\*\*/)?.[1] || 'Unknown'
    const type = b.match(/Birthday|Anniversary/i)?.[0] || 'Event'
    const days = parseInt(b.match(/(\d+)\s*day/i)?.[1] ?? '0', 10)
    items.push({ name, type, daysAway: days })
  }
  return items
}

// ── IndMoney ──────────────────────────────────────────────────────────────────

export function parseIndMoney(raw) {
  if (!raw) return null
  if (raw.auth_required) return { authRequired: true }
  const snap = raw.snapshot || {}
  const investments = (snap.investments || [])
    .filter(inv => inv.current_value > 0)
    .sort((a, b) => b.current_value - a.current_value)
  return {
    authRequired:  false,
    totalNetworth: snap.total_networth ?? snap.total_current_value ?? null,
    totalInvested: snap.total_invested ?? null,
    investments,
    stockSips:     raw.stock_sips || [],
    mfSips:        raw.mf_sips   || [],
    lastUpdated:   raw.last_updated ?? null,
  }
}

// ── Number formatting ─────────────────────────────────────────────────────────

export function fmtCurrency(n, compact = false) {
  if (n == null || isNaN(n)) return '--'
  const abs = Math.abs(n)
  if (compact) {
    if (abs >= 1e7) return (n / 1e7).toFixed(2) + ' Cr'
    if (abs >= 1e5) return (n / 1e5).toFixed(2) + ' L'
    if (abs >= 1e3) return (n / 1e3).toFixed(1) + ' K'
  }
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtPct(n) {
  if (n == null || isNaN(n)) return '--'
  return (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%'
}

export function formatTime(date) {
  if (!date) return ''
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function formatDate(date) {
  if (!date) return ''
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
