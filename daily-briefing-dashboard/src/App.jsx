import { useState, useCallback } from 'react'
import { useDashboard }      from './hooks/useDashboard.js'
import Header                from './components/Header.jsx'
import StatusPill            from './components/StatusPill.jsx'
import WeatherCard           from './components/WeatherCard.jsx'
import CalendarCard          from './components/CalendarCard.jsx'
import CelebrationsCard      from './components/CelebrationsCard.jsx'
import StocksCard            from './components/StocksCard.jsx'
import IndMoneyCard          from './components/IndMoneyCard.jsx'
import WhatsAppCard          from './components/WhatsAppCard.jsx'
import SettingsModal         from './components/SettingsModal.jsx'

// ── Card catalogue ────────────────────────────────────────────────────────────

export const CARD_DEFS = [
  { id: 'weather',      label: 'Weather',          icon: '🌤️' },
  { id: 'calendar',     label: 'Calendar',          icon: '📅' },
  { id: 'celebrations', label: 'Celebrations',      icon: '🎉' },
  { id: 'indmoney',     label: 'Net Worth',         icon: '💰' },
  { id: 'whatsapp',     label: 'WhatsApp',          icon: '💬' },
  { id: 'stocks',       label: 'Stock Portfolio',   icon: '📈' },
]

// Fixed display order — never changes, only visibility is user-controlled
const FIXED_ORDER = CARD_DEFS.map(c => c.id)

// Compute col-span classes dynamically so the grid stays balanced no matter
// which cards are enabled. Cards are paired: weather+calendar, celebrations+indmoney.
// When one partner is hidden the other expands to full width.
function computeSpans(visible) {
  const has = id => visible.includes(id)
  const spans = {}

  // Row 1 — Weather · Calendar · Celebrations as equal-width trio
  const trio = ['weather', 'calendar', 'celebrations'].filter(has)
  if (trio.length === 3) {
    spans.weather      = 'col-span-12 md:col-span-4'
    spans.calendar     = 'col-span-12 md:col-span-4'
    spans.celebrations = 'col-span-12 md:col-span-4'
  } else if (trio.length === 2) {
    trio.forEach(id => { spans[id] = 'col-span-12 md:col-span-6' })
  } else {
    trio.forEach(id => { spans[id] = 'col-span-12' })
  }

  // Row 2 — IndMoney + WhatsApp side by side; each expands if the other is hidden
  const pair = ['indmoney', 'whatsapp'].filter(has)
  if (pair.length === 2) {
    spans.indmoney  = 'col-span-12 md:col-span-6'
    spans.whatsapp  = 'col-span-12 md:col-span-6'
  } else {
    pair.forEach(id => { spans[id] = 'col-span-12' })
  }

  // Row 3 — Stocks full width
  if (has('stocks')) spans.stocks = 'col-span-12'

  return spans
}

function loadCardLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem('dashboard_card_layout') || 'null')
    if (!saved) return { hidden: new Set() }
    return { hidden: new Set((saved.hidden || []).filter(id => FIXED_ORDER.includes(id))) }
  } catch { return { hidden: new Set() } }
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const { state, actions, syncedAt } = useDashboard()
  const [refreshing, setRefreshing] = useState(false)
  const [settings,   setSettings]   = useState({ open: false, tab: 'location' })
  const [cardLayout, setCardLayout] = useState(loadCardLayout)

  const openSettings = useCallback((tab = 'location') => {
    setSettings({ open: true, tab })
  }, [])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await actions.refreshAll()
    setRefreshing(false)
  }, [actions])

  const { data, loading, errors, mcp, location } = state

  const visibleCards = FIXED_ORDER.filter(id => !cardLayout.hidden.has(id))
  const cardSpans    = computeSpans(visibleCards)

  return (
    <>
      {/* ── Animated background orbs ── */}
      <div aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* ── App shell ── */}
      <div className="relative min-h-dvh flex flex-col max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-16">

        <Header
          onRefresh={handleRefresh}
          onSettings={() => openSettings('location')}
          refreshing={refreshing}
        />

        {/* ── Bento grid ── */}
        <main className="grid grid-cols-12 gap-4 mt-4 flex-1">
          {visibleCards.map((id, i) => {
            const delay = i * 60
            const span  = cardSpans[id] || 'col-span-12'

            return (
              <div key={id} className={`${span} h-full`}>
                {id === 'weather' && (
                  <WeatherCard
                    data={data.weather} loading={loading.weather} error={errors.weather}
                    location={location}
                    onRetry={() => actions.refreshCard('weather')}
                    onChangeLocation={() => openSettings('location')}
                    delay={delay}
                    syncedAt={syncedAt.weather}
                  />
                )}
                {id === 'calendar' && (
                  <CalendarCard
                    data={data.calendar} loading={loading.calendar} error={errors.calendar}
                    onRetry={() => actions.refreshCard('calendar')}
                    delay={delay}
                    syncedAt={syncedAt.calendar}
                  />
                )}
                {id === 'celebrations' && (
                  <CelebrationsCard
                    data={data.celebrations} loading={loading.celebrations} error={errors.celebrations}
                    onRetry={() => actions.refreshCard('celebrations')}
                    delay={delay}
                    syncedAt={syncedAt.celebrations}
                  />
                )}
                {id === 'indmoney' && (
                  <IndMoneyCard
                    data={data.indmoney} loading={loading.indmoney} error={errors.indmoney}
                    onRetry={() => actions.refreshCard('indmoney')}
                    onConnect={() => openSettings('indmoney')}
                    delay={delay}
                    syncedAt={syncedAt.indmoney}
                  />
                )}
                {id === 'stocks' && (
                  <StocksCard
                    data={data.stocks} loading={loading.stocks} error={errors.stocks}
                    onRetry={() => actions.refreshCard('stocks')}
                    onRefresh={() => actions.refreshCard('stocks')}
                    delay={delay}
                    syncedAt={syncedAt.stocks}
                  />
                )}
                {id === 'whatsapp' && (
                  <WhatsAppCard delay={delay} />
                )}
              </div>
            )
          })}
        </main>
      </div>

      {/* ── MCP status pill ── */}
      <StatusPill connected={mcp.connected} checkedAt={mcp.checkedAt} />

      {/* ── Settings modal ── */}
      <SettingsModal
        open={settings.open}
        initialTab={settings.tab}
        location={location}
        onSaveLocation={actions.setLocation}
        onClose={() => setSettings(s => ({ ...s, open: false }))}
        cardDefs={CARD_DEFS}
        cardLayout={cardLayout}
        onLayoutChange={setCardLayout}
      />
    </>
  )
}
