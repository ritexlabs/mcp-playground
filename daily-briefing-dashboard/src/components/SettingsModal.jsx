import { useState, useEffect } from 'react'
import { playAlarmSound, loadAlarmConfig, saveAlarmConfig } from '../utils/alarmUtils.js'

const TABS = [
  { id: 'location', label: 'Location' },
  { id: 'gateway',  label: 'Gateway'  },
  { id: 'ai',       label: 'AI'       },
  { id: 'notes',    label: 'Notes'    },
  { id: 'layout',   label: 'Layout'   },
]

const MODAL_ACCENT = '#818cf8'

// ── Tab: Location ─────────────────────────────────────────────────────────────

function LocationTab({ location, onSave, onClose }) {
  const [city, setCity] = useState(location?.name || '')
  const [name, setName] = useState(() => localStorage.getItem('dashboard_user_name') || '')

  function handleSave() {
    const trimmedName = name.trim()
    localStorage.setItem('dashboard_user_name', trimmedName)
    window.dispatchEvent(new CustomEvent('dashboard-user-name-change', { detail: trimmedName }))
    onSave(city)
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-400">Personalise your dashboard with your name and location.</p>
      <div className="flex flex-col gap-1.5">
        <label className="card-label">Your Name</label>
        <input
          className="cfg-input"
          placeholder="e.g. Ritesh"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <p className="text-[11px] text-slate-600">Shown in the greeting — "Good Morning, Ritesh 👋"</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="card-label">City / Location</label>
        <input
          className="cfg-input"
          placeholder="e.g. Bengaluru, IN"
          value={city}
          onChange={e => setCity(e.target.value)}
        />
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={handleSave} className="btn-primary" disabled={!city.trim()}>
          Save
        </button>
      </div>
    </div>
  )
}

// ── Tab: Gateway ──────────────────────────────────────────────────────────────

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }).catch(() => {})
  }
  return (
    <button
      onClick={copy}
      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors flex-shrink-0"
      style={{
        background: copied ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.07)',
        color: copied ? MODAL_ACCENT : '#94a3b8',
      }}
    >
      {copied ? '✓ Copied' : (label || 'Copy')}
    </button>
  )
}

function GatewayTab({ onClose }) {
  const [status,     setStatus]     = useState('checking')
  const [gatewayUrl, setGatewayUrl] = useState('http://127.0.0.1:8000')

  useEffect(() => {
    fetch('/api/config/gateway-url')
      .then(r => r.json())
      .then(d => setGatewayUrl(d.url || 'http://127.0.0.1:8000'))
      .catch(() => {})
    checkStatus()
  }, [])

  async function checkStatus() {
    setStatus('checking')
    try {
      const d = await fetch('/api/status').then(r => r.json())
      setStatus(d.connected ? 'ok' : 'err')
    } catch {
      setStatus('err')
    }
  }

  const dashUrl = `${gatewayUrl}/dashboard`

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-400">
        All integrations (Google, WhatsApp, IndMoney, Stocks, Tunnel, API token) are managed in the{' '}
        <strong className="text-slate-300">MCP Gateway Dashboard</strong>.
      </p>

      {/* Connection status */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
        <span className={`status-dot ${status}`} />
        <span className="text-sm text-slate-300">
          {status === 'checking' ? 'Checking…' : status === 'ok' ? 'Gateway connected' : 'Gateway not reachable'}
        </span>
      </div>

      {/* Gateway URL */}
      <div className="flex flex-col gap-1.5">
        <label className="card-label">Gateway URL</label>
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
          <code className="text-[12px] text-slate-300 flex-1">{gatewayUrl}</code>
          <CopyButton text={gatewayUrl} />
        </div>
        <p className="text-[11px] text-slate-600">Set via <code className="text-slate-500">MCP_GATEWAY_URL</code> in <code className="text-slate-500">daily-briefing-dashboard/.env</code></p>
      </div>

      {/* Open gateway dashboard */}
      <a
        href={dashUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 p-3 rounded-xl border transition-colors no-underline"
        style={{ background: `${MODAL_ACCENT}08`, borderColor: `${MODAL_ACCENT}30` }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={MODAL_ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: MODAL_ACCENT }}>Open Gateway Dashboard ↗</p>
          <p className="text-[11px] text-slate-500 truncate">{dashUrl}</p>
        </div>
      </a>

      <p className="text-[11px] text-slate-600 leading-relaxed">
        To set the API token, copy <code className="text-slate-500">GATEWAY_API_TOKEN</code> from the gateway
        dashboard → API Token tab into <code className="text-slate-500">daily-briefing-dashboard/.env</code>,
        then restart the dashboard server.
      </p>

      <div className="flex gap-2 justify-end">
        <button onClick={checkStatus} className="btn-secondary">Refresh Status</button>
        <button onClick={onClose}     className="btn-secondary">Close</button>
      </div>
    </div>
  )
}

// ── Tab: AI Models ────────────────────────────────────────────────────────────

const AI_PROVIDERS = [
  { id: 'openai',    label: 'OpenAI',                     defaultModel: 'gpt-4o-mini',              needsBaseUrl: false },
  { id: 'anthropic', label: 'Anthropic',                  defaultModel: 'claude-haiku-4-5-20251001', needsBaseUrl: false },
  { id: 'custom',    label: 'Custom (OpenAI-compatible)', defaultModel: '',                          needsBaseUrl: true  },
]

function genId() { return Math.random().toString(36).slice(2, 10) }

function llmLoadModels()   { try { return JSON.parse(localStorage.getItem('dashboard_llm_models') || '[]') } catch { return [] } }
function llmSaveModels(m)  { localStorage.setItem('dashboard_llm_models', JSON.stringify(m)) }
function llmLoadActiveId() { return localStorage.getItem('dashboard_llm_active_id') || '' }
function llmSaveActiveId(id) { localStorage.setItem('dashboard_llm_active_id', id) }

const EMPTY_FORM = { label: '', provider: 'openai', apiKey: '', model: 'gpt-4o-mini', baseUrl: '' }

function AiTab() {
  const [models,    setModels]    = useState(llmLoadModels)
  const [activeId,  setActiveId]  = useState(llmLoadActiveId)
  const [editing,   setEditing]   = useState(null)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [testing,   setTesting]   = useState(false)
  const [testMsg,   setTestMsg]   = useState(null)
  const [dupErr,    setDupErr]    = useState(false)
  const [envStatus, setEnvStatus] = useState(null)

  useEffect(() => {
    fetch('/api/config/llm/env-status').then(r => r.json()).then(setEnvStatus).catch(() => {})
  }, [])

  function providerDef(id) { return AI_PROVIDERS.find(p => p.id === id) || AI_PROVIDERS[0] }

  function startAdd()   { setEditing('new'); setForm(EMPTY_FORM); setTestMsg(null); setDupErr(false) }
  function startEdit(m) {
    setEditing(m.id)
    setForm({ label: m.label, provider: m.provider, apiKey: m.apiKey, model: m.model, baseUrl: m.baseUrl || '' })
    setTestMsg(null); setDupErr(false)
  }
  function cancelEdit() { setEditing(null); setTestMsg(null); setDupErr(false) }

  function handleProviderChange(p) {
    setForm(f => ({ ...f, provider: p, model: providerDef(p).defaultModel }))
    setDupErr(false)
  }

  function saveModel() {
    const isDup = models.some(m =>
      m.id !== editing &&
      m.provider === form.provider &&
      m.model.trim().toLowerCase() === form.model.trim().toLowerCase()
    )
    if (isDup) { setDupErr(true); return }
    setDupErr(false)

    let updated
    if (editing === 'new') {
      const entry = { id: genId(), ...form }
      updated = [...models, entry]
      if (updated.length === 1) { setActiveId(entry.id); llmSaveActiveId(entry.id) }
    } else {
      updated = models.map(m => m.id === editing ? { ...m, ...form } : m)
    }
    setModels(updated); llmSaveModels(updated)
    setEditing(null); setTestMsg(null)
  }

  function deleteModel(id) {
    const updated = models.filter(m => m.id !== id)
    setModels(updated); llmSaveModels(updated)
    if (activeId === id) {
      const next = updated[0]?.id || ''
      setActiveId(next); llmSaveActiveId(next)
    }
  }

  function setActive(id) { setActiveId(id); llmSaveActiveId(id) }

  async function testConnection() {
    setTesting(true); setTestMsg(null)
    try {
      const r = await fetch('/api/wishes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Alex', type: 'birthday', subType: 'birthday',
          llmConfig: { provider: form.provider, apiKey: form.apiKey, model: form.model, baseUrl: form.baseUrl },
        }),
      })
      const d = await r.json()
      if (d.messages?.length) setTestMsg({ ok: true, text: `Connected — ${d.messages.length} messages received` })
      else setTestMsg({ ok: false, text: d.reason || 'No messages returned' })
    } catch (e) {
      setTestMsg({ ok: false, text: e.message })
    } finally { setTesting(false) }
  }

  const providerBadge = (id) => {
    const colors = { openai: '#34d399', anthropic: '#a78bfa', custom: '#22d3ee' }
    return (
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
        style={{ background: `${colors[id] || '#64748b'}20`, color: colors[id] || '#64748b' }}>
        {providerDef(id).label.split(' ')[0]}
      </span>
    )
  }

  const inlineForm = (
    <div className="flex flex-col gap-3 mt-2 p-3 rounded-xl border border-white/[0.1] bg-white/[0.03]">
      <div className="flex flex-col gap-1.5">
        <label className="card-label">Label</label>
        <input className="cfg-input" placeholder="e.g. My GPT-4o Mini"
          value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="card-label">Provider</label>
        <select className="cfg-select" value={form.provider} onChange={e => handleProviderChange(e.target.value)}>
          {AI_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="card-label">API Key</label>
        <input className="cfg-input" type="password" placeholder="sk-…"
          value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="card-label">Model</label>
        <input className="cfg-input" placeholder={providerDef(form.provider).defaultModel || 'model-name'}
          value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} />
      </div>
      {providerDef(form.provider).needsBaseUrl && (
        <div className="flex flex-col gap-1.5">
          <label className="card-label">Base URL</label>
          <input className="cfg-input" placeholder="http://localhost:11434/v1"
            value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))} />
        </div>
      )}
      {dupErr && <p className="text-xs" style={{ color: '#fb7185' }}>✗ A model with this provider and model name already exists.</p>}
      {testMsg && !dupErr && (
        <p className="text-xs" style={{ color: testMsg.ok ? '#34d399' : '#fb7185' }}>
          {testMsg.ok ? '✓' : '✗'} {testMsg.text}
        </p>
      )}
      <div className="flex gap-2 justify-end flex-wrap">
        <button onClick={cancelEdit} className="btn-secondary">Cancel</button>
        <button onClick={testConnection} className="btn-secondary" disabled={testing}>
          {testing ? 'Testing…' : 'Test'}
        </button>
        <button onClick={saveModel} className="btn-primary" disabled={!form.label.trim()}>Save</button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-400">
        Add LLM models to generate personalised wish messages for celebrations. The active model is used;
        falls back to built-in templates if none is active.
      </p>

      {envStatus && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
          <span className={`status-dot ${envStatus.configured ? 'ok' : 'err'}`} />
          <span className="text-xs text-slate-400">
            {envStatus.configured
              ? `Server .env: ${envStatus.provider || 'LLM'} configured (server-side fallback)`
              : 'No LLM configured in server .env — browser models only'}
          </span>
        </div>
      )}

      {models.length === 0 && editing !== 'new' && (
        <p className="text-sm text-slate-500 text-center py-3">No models added yet.</p>
      )}

      <div className="flex flex-col gap-2">
        {models.map(m => (
          <div key={m.id}>
            <div
              className="flex items-center gap-3 p-3 rounded-xl border transition-colors"
              style={{
                background:  m.id === activeId ? `${MODAL_ACCENT}08` : 'rgba(255,255,255,0.03)',
                borderColor: m.id === activeId ? `${MODAL_ACCENT}40` : 'rgba(255,255,255,0.08)',
              }}
            >
              <div className="w-4 flex-shrink-0">
                {m.id === activeId && (
                  <svg width="14" height="14" fill={MODAL_ACCENT} viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd"/>
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-200 truncate">{m.label}</span>
                  {providerBadge(m.provider)}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">{m.model || '—'}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {m.id !== activeId && (
                  <button onClick={() => setActive(m.id)} className="btn-secondary !py-1 !px-2 !text-[11px]">Use</button>
                )}
                <button onClick={() => editing === m.id ? cancelEdit() : startEdit(m)} className="btn-icon !py-1 !px-2" title="Edit">
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                  </svg>
                </button>
                <button onClick={() => deleteModel(m.id)} className="btn-icon !py-1 !px-2" title="Delete" style={{ color: '#fb7185' }}>
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </div>
            </div>
            {editing === m.id && inlineForm}
          </div>
        ))}
        {editing === 'new' && inlineForm}
      </div>

      {editing === null && (
        <button onClick={startAdd} className="btn-secondary w-full">+ Add Model</button>
      )}

      <p className="text-xs text-slate-600 leading-relaxed">
        API keys are stored in your browser only (localStorage). For a server-side fallback, set{' '}
        <code className="text-slate-500">LLM_PROVIDER</code>, <code className="text-slate-500">LLM_API_KEY</code>,
        and <code className="text-slate-500">LLM_MODEL</code> in the server <code className="text-slate-500">.env</code>.
      </p>
    </div>
  )
}

// ── Tab: Notes (alarm config) ─────────────────────────────────────────────────

const ANIMATIONS = [
  { id: 'bounce',    label: 'Bounce'    },
  { id: 'confetti',  label: 'Confetti'  },
  { id: 'fireworks', label: 'Fireworks' },
  { id: 'wave',      label: 'Wave'      },
  { id: 'shake',     label: 'Shake'     },
]
const RINGTONES = [
  { id: 'chime', label: 'Chime' },
  { id: 'bell',  label: 'Bell'  },
  { id: 'beep',  label: 'Beep'  },
  { id: 'alarm', label: 'Alarm' },
]
const SNOOZES = [5, 10, 15]

function NotesTab() {
  const [config, setConfig] = useState(loadAlarmConfig)

  function update(key, val) {
    const next = { ...config, [key]: val }
    setConfig(next)
    saveAlarmConfig(next)
    window.dispatchEvent(new CustomEvent('alarm-config-changed', { detail: next }))
  }

  function chipStyle(active) {
    return {
      padding:      '6px 12px',
      borderRadius: '8px',
      fontSize:     '13px',
      fontWeight:   500,
      cursor:       'pointer',
      background:   active ? `${MODAL_ACCENT}22` : 'rgba(255,255,255,0.05)',
      color:        active ? MODAL_ACCENT : '#94a3b8',
      border:       `1px solid ${active ? `${MODAL_ACCENT}40` : 'rgba(255,255,255,0.08)'}`,
      transition:   'all .15s',
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-slate-400">Configure how task reminders look and sound when they fire.</p>

      {/* Animation */}
      <div className="flex flex-col gap-2">
        <label className="card-label">Animation</label>
        <div className="flex flex-wrap gap-2">
          {ANIMATIONS.map(a => (
            <button key={a.id} onClick={() => update('animation', a.id)} style={chipStyle(config.animation === a.id)}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ringtone */}
      <div className="flex flex-col gap-2">
        <label className="card-label">Ringtone</label>
        <div className="flex flex-wrap gap-2">
          {RINGTONES.map(r => (
            <div key={r.id} className="flex items-center gap-1">
              <button onClick={() => update('ringtone', r.id)} style={chipStyle(config.ringtone === r.id)}>
                {r.label}
              </button>
              <button
                onClick={() => playAlarmSound(r.id)}
                title={`Preview ${r.label}`}
                style={{
                  padding: '6px 8px', borderRadius: '8px', fontSize: '11px', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.04)', color: '#64748b',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                ▶
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Snooze */}
      <div className="flex flex-col gap-2">
        <label className="card-label">Snooze Duration</label>
        <div className="flex gap-2">
          {SNOOZES.map(s => (
            <button key={s} onClick={() => update('snooze', s)} style={chipStyle(config.snooze === s)}>
              {s} min
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Tab: Layout ───────────────────────────────────────────────────────────────

function LayoutTab({ cardDefs, cardLayout, onLayoutChange, onClose }) {
  const [hidden, setHidden] = useState(new Set(cardLayout.hidden))

  function toggle(id) {
    setHidden(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function apply() {
    const layout = { hidden: [...hidden] }
    localStorage.setItem('dashboard_card_layout', JSON.stringify(layout))
    onLayoutChange({ hidden: new Set(hidden) })
    onClose()
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-400">Choose which cards to show. Layout is arranged automatically.</p>
      <div className="flex flex-col gap-2">
        {cardDefs.map(def => {
          const isHidden = hidden.has(def.id)
          return (
            <div
              key={def.id}
              className="flex items-center gap-3 p-3 rounded-xl border transition-colors"
              style={{
                background:  'rgba(255,255,255,0.03)',
                borderColor: isHidden ? 'rgba(255,255,255,0.05)' : `${MODAL_ACCENT}28`,
                opacity:     isHidden ? 0.45 : 1,
              }}
            >
              <span className="text-base">{def.icon}</span>
              <span className="text-sm text-slate-300 flex-1">{def.label}</span>
              <button
                onClick={() => toggle(def.id)}
                className="relative w-9 h-5 rounded-full flex-shrink-0 transition-colors"
                style={{ background: isHidden ? 'rgba(255,255,255,0.1)' : `${MODAL_ACCENT}70` }}
                aria-label={isHidden ? `Show ${def.label}` : `Hide ${def.label}`}
              >
                <span
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                  style={{ left: isHidden ? '2px' : 'calc(100% - 18px)' }}
                />
              </button>
            </div>
          )
        })}
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button onClick={() => setHidden(new Set())} className="btn-secondary">Show All</button>
        <button onClick={onClose}                    className="btn-secondary">Cancel</button>
        <button onClick={apply}                      className="btn-primary">Apply</button>
      </div>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function SettingsModal({
  open, onClose, location, onSaveLocation,
  initialTab = 'location',
  cardDefs = [], cardLayout = { order: [], hidden: new Set() }, onLayoutChange = () => {},
}) {
  const [activeTab, setActiveTab] = useState(initialTab)

  useEffect(() => { if (open) setActiveTab(initialTab) }, [open, initialTab])

  if (!open) return null

  function handleSaveLocation(city) {
    onSaveLocation({ name: city })
    onClose()
  }

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-label="Dashboard Settings"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl border border-white/[0.10] p-6 flex flex-col gap-5"
        style={{ background: 'rgba(9,14,30,0.92)', backdropFilter: 'blur(20px)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Dashboard Settings</h2>
          <button onClick={onClose} className="btn-icon !p-1.5" aria-label="Close settings">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex gap-1 flex-wrap">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`settings-tab ${activeTab === t.id ? 'active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div>
          {activeTab === 'location' && <LocationTab location={location} onSave={handleSaveLocation} onClose={onClose} />}
          {activeTab === 'gateway'  && <GatewayTab onClose={onClose} />}
          {activeTab === 'ai'       && <AiTab />}
          {activeTab === 'notes'    && <NotesTab />}
          {activeTab === 'layout'   && (
            <LayoutTab cardDefs={cardDefs} cardLayout={cardLayout} onLayoutChange={onLayoutChange} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  )
}
