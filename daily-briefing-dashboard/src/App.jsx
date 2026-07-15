import { useState, useCallback, useEffect, useRef } from 'react'
import { useDashboard }      from './hooks/useDashboard.js'
import Header                from './components/Header.jsx'
import StatusPill            from './components/StatusPill.jsx'
import WeatherCard           from './components/WeatherCard.jsx'
import CalendarCard          from './components/CalendarCard.jsx'
import CelebrationsCard      from './components/CelebrationsCard.jsx'
import StocksCard            from './components/StocksCard.jsx'
import IndMoneyCard          from './components/IndMoneyCard.jsx'
import WhatsAppCard          from './components/WhatsAppCard.jsx'
import GmailCard             from './components/GmailCard.jsx'
import SystemCard            from './components/SystemCard.jsx'
import QuickNotesCard        from './components/QuickNotesCard.jsx'
import AlarmNotification     from './components/AlarmNotification.jsx'
import SettingsModal         from './components/SettingsModal.jsx'
import { loadTasks, saveTasks, loadAlarmConfig } from './utils/alarmUtils.js'

// ── Card catalogue ────────────────────────────────────────────────────────────

export const CARD_DEFS = [
  { id: 'weather',      label: 'Weather',             icon: '🌤️' },
  { id: 'notes',        label: 'Tasks & Reminders',   icon: '📝' },
  { id: 'system',       label: 'System Stats',        icon: '💻' },
  { id: 'gmail',        label: 'Gmail',               icon: '✉️'  },
  { id: 'calendar',     label: 'Schedule',            icon: '📅' },
  { id: 'celebrations', label: 'Celebrations',        icon: '🎉' },
  { id: 'whatsapp',     label: 'WhatsApp',            icon: '💬' },
  { id: 'stocks',       label: 'Stock Portfolio',     icon: '📈' },
  { id: 'indmoney',     label: 'Net Worth',           icon: '💰' },
]

// Fixed display order — never changes, only visibility is user-controlled
const FIXED_ORDER = CARD_DEFS.map(c => c.id)

// Row 1: Weather · Tasks & Reminders · System
// Row 2: Gmail · Schedule · Celebrations
// Row 3: WhatsApp · Stocks · Net Worth
function computeSpans(visible) {
  const has = id => visible.includes(id)
  const spans = {}

  // Row 1 — Weather · Tasks & Reminders · System
  const row1 = ['weather', 'notes', 'system'].filter(has)
  if (row1.length === 3) {
    row1.forEach(id => { spans[id] = 'col-span-12 md:col-span-4' })
  } else if (row1.length === 2) {
    row1.forEach(id => { spans[id] = 'col-span-12 md:col-span-6' })
  } else {
    row1.forEach(id => { spans[id] = 'col-span-12' })
  }

  // Row 2 — Gmail · Calendar · Celebrations as equal-width trio
  const row2 = ['gmail', 'calendar', 'celebrations'].filter(has)
  if (row2.length === 3) {
    row2.forEach(id => { spans[id] = 'col-span-12 md:col-span-4' })
  } else if (row2.length === 2) {
    row2.forEach(id => { spans[id] = 'col-span-12 md:col-span-6' })
  } else {
    row2.forEach(id => { spans[id] = 'col-span-12' })
  }

  // Row 3 — WhatsApp · Stocks · Net Worth
  const row3 = ['whatsapp', 'stocks', 'indmoney'].filter(has)
  if (row3.length === 3) {
    row3.forEach(id => { spans[id] = 'col-span-12 md:col-span-4' })
  } else if (row3.length === 2) {
    row3.forEach(id => { spans[id] = 'col-span-12 md:col-span-6' })
  } else {
    row3.forEach(id => { spans[id] = 'col-span-12' })
  }

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
  const [refreshing,  setRefreshing]  = useState(false)
  const [settings,    setSettings]    = useState({ open: false, tab: 'location' })
  const [cardLayout,  setCardLayout]  = useState(loadCardLayout)
  const [alarmTask,   setAlarmTask]   = useState(null)
  const [alarmConfig, setAlarmConfig] = useState(loadAlarmConfig)
  const alarmTaskRef  = useRef(null)

  // Alarm checker — runs every 10s
  useEffect(() => {
    const check = () => {
      if (alarmTaskRef.current) return
      const tasks = loadTasks()
      const now   = Date.now()
      const fired = tasks.find(t => !t.done && t.alarm && new Date(t.alarm).getTime() <= now)
      if (fired) { alarmTaskRef.current = fired; setAlarmTask(fired) }
    }
    check()
    const id = setInterval(check, 10000)
    return () => clearInterval(id)
  }, [])

  // Keep alarmConfig fresh when settings tab saves
  useEffect(() => {
    const handler = e => setAlarmConfig(e.detail)
    window.addEventListener('alarm-config-changed', handler)
    return () => window.removeEventListener('alarm-config-changed', handler)
  }, [])

  function handleSnooze(minutes) {
    const tasks = loadTasks()
    const task  = tasks.find(t => t.id === alarmTask?.id)
    if (task) { task.alarm = new Date(Date.now() + minutes * 60000).toISOString(); saveTasks(tasks) }
    window.dispatchEvent(new CustomEvent('tasks-updated'))
    alarmTaskRef.current = null
    setAlarmTask(null)
  }

  function handleDismiss() {
    const tasks = loadTasks()
    const task  = tasks.find(t => t.id === alarmTask?.id)
    if (task) { task.alarm = null; saveTasks(tasks) }
    window.dispatchEvent(new CustomEvent('tasks-updated'))
    alarmTaskRef.current = null
    setAlarmTask(null)
  }

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
                    indices={data.indices} indicesLoading={loading.indices}
                    onRetry={() => actions.refreshCard('stocks')}
                    onRefresh={() => actions.refreshCard('stocks')}
                    delay={delay}
                    syncedAt={syncedAt.stocks}
                  />
                )}
                {id === 'whatsapp' && (
                  <WhatsAppCard delay={delay} />
                )}
                {id === 'gmail' && (
                  <GmailCard
                    data={data.gmail} loading={loading.gmail} error={errors.gmail}
                    onRetry={() => actions.refreshCard('gmail')}
                    delay={delay}
                    syncedAt={syncedAt.gmail}
                  />
                )}
                {id === 'system' && (
                  <SystemCard delay={delay} />
                )}
                {id === 'notes' && (
                  <QuickNotesCard delay={delay} />
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

      {/* ── Alarm notification overlay ── */}
      {alarmTask && (
        <AlarmNotification
          task={alarmTask}
          config={alarmConfig}
          onSnooze={handleSnooze}
          onDismiss={handleDismiss}
        />
      )}
    </>
  )
}
