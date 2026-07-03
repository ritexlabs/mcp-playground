import { useState, useEffect } from 'react'

const TABS = [
  { id: 'location',  label: 'Location' },
  { id: 'google',    label: 'Google'   },
  { id: 'stocks',    label: 'Stocks'   },
  { id: 'indmoney',  label: 'IndMoney' },
  { id: 'ai',        label: 'AI'       },
  { id: 'layout',    label: 'Layout'   },
]

const MODAL_ACCENT = '#818cf8'

async function getGatewayUrl() {
  try {
    const r = await fetch('/api/config/gateway-url')
    const d = await r.json()
    return d.url || 'http://127.0.0.1:8000'
  } catch {
    return 'http://127.0.0.1:8000'
  }
}

// ── Reusable status row ───────────────────────────────────────────────────────

function StatusRow({ state }) {
  const cls = { ok: 'ok', err: 'err', checking: 'checking' }[state] ?? 'err'
  const labels = { ok: 'Connected', err: 'Not connected', checking: 'Checking…' }
  return (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
      <span className={`status-dot ${cls}`} />
      <span className="text-sm text-slate-300">{labels[state]}</span>
    </div>
  )
}

// ── Tab: Location ─────────────────────────────────────────────────────────────

function LocationTab({ location, onSave, onClose }) {
  const [city, setCity] = useState(location?.name || '')
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-400">Set your city to fetch local weather conditions.</p>
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
        <button onClick={onClose}  className="btn-secondary">Cancel</button>
        <button onClick={() => onSave(city)} className="btn-primary" disabled={!city.trim()}>Save Location</button>
      </div>
    </div>
  )
}

// ── Tab: Google ───────────────────────────────────────────────────────────────

function GoogleTab({ onClose }) {
  const [status, setStatus]   = useState('checking')
  const [label, setLabel]     = useState('Checking…')
  const [showConnect, setConnect] = useState(false)
  const [showDisconn, setDisconn] = useState(false)

  async function load() {
    setStatus('checking')
    try {
      const r = await fetch('/api/config/auth/status')
      const d = await r.json()
      if (d.authenticated) {
        setStatus('ok'); setLabel('Connected')
        setConnect(false); setDisconn(true)
      } else {
        setStatus('err'); setLabel('Not connected')
        setConnect(true);  setDisconn(false)
      }
    } catch {
      setStatus('err'); setLabel('Could not reach gateway')
    }
  }

  useEffect(() => { load() }, [])

  async function disconnect() {
    await fetch('/api/config/auth/token', { method: 'DELETE' })
    load()
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-400">Authorise Google access for Gmail, Calendar, Drive, and Sheets.</p>
      <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
        <span className={`status-dot ${status}`} />
        <span className="text-sm text-slate-300">{label}</span>
      </div>
      <div className="flex gap-2 justify-end flex-wrap">
        <button onClick={onClose}  className="btn-secondary">Close</button>
        <button onClick={load}     className="btn-secondary">Refresh</button>
        {showConnect && (
          <button
            onClick={async () => {
              const base = await getGatewayUrl()
              window.open(`${base}/auth/google`, '_blank', 'noopener,noreferrer')
            }}
            className="btn-primary"
          >
            Connect Google
          </button>
        )}
        {showDisconn && (
          <button onClick={disconnect} className="btn-danger">Disconnect</button>
        )}
      </div>
      {showConnect && (
        <p className="text-xs text-slate-500">
          Click <strong className="text-slate-400">Connect Google</strong> — a browser tab opens. Sign in, grant all permissions, then return and click Refresh.
        </p>
      )}
    </div>
  )
}

// ── Tab: Stocks ───────────────────────────────────────────────────────────────

function StocksTab({ onClose }) {
  const [status, setStatus] = useState('checking')
  const [label,  setLabel]  = useState('Checking…')
  const [sheets, setSheets] = useState([])
  const [selected, setSelected] = useState('')
  const [showPicker, setShowPicker] = useState(false)

  async function loadStatus() {
    try {
      const r = await fetch('/api/config/auth/status')
      const d = await r.json()
      const id = d.spreadsheet_id
      if (id) { setStatus('ok');  setLabel(`Sheet: ${id}`) }
      else     { setStatus('err'); setLabel('No sheet configured') }
    } catch { setStatus('err'); setLabel('Could not reach gateway') }
  }

  async function browseSheets() {
    try {
      const r = await fetch('/api/config/sheets')
      const d = await r.json()
      // gateway returns array directly or wrapped as {sheets:[...]}
      const list = Array.isArray(d) ? d : (d.sheets || [])
      if (!r.ok) {
        if (r.status === 401) alert('Google session expired.\n\nGo to the Google tab and click Connect Google to re-authenticate.')
        else alert(d?.message || d?.error || 'Could not load sheets')
        return
      }
      if (list.length === 0) { alert('No Google Sheets found in your Drive.'); return }
      setSheets(list)
      setShowPicker(true)
    } catch (e) {
      alert(`Failed to load sheets: ${e.message}`)
    }
  }

  async function saveSheet() {
    if (!selected) return
    await fetch(`/api/config/sheets/${encodeURIComponent(selected)}`, { method: 'POST' })
    setShowPicker(false)
    loadStatus()
  }

  useEffect(() => { loadStatus() }, [])

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-400">Choose which Google Sheet holds your stock portfolio.</p>
      <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
        <span className={`status-dot ${status}`} />
        <span className="text-sm text-slate-300">{label}</span>
      </div>
      {!showPicker && (
        <div className="flex gap-2 justify-end">
          <button onClick={onClose}       className="btn-secondary">Close</button>
          <button onClick={browseSheets}  className="btn-secondary">Browse Sheets</button>
        </div>
      )}
      {showPicker && (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="card-label">Select a spreadsheet</label>
            <select className="cfg-select" value={selected} onChange={e => setSelected(e.target.value)}>
              <option value="">-- choose a sheet --</option>
              {sheets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={onClose}   className="btn-secondary">Close</button>
            <button onClick={saveSheet} className="btn-primary" disabled={!selected}>Save Sheet</button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Tab: IndMoney ─────────────────────────────────────────────────────────────

function IndMoneyTab({ onClose }) {
  const [status, setStatus]  = useState('checking')
  const [label,  setLabel]   = useState('Checking…')
  const [tools,  setTools]   = useState([])
  const [url,    setUrl]     = useState('https://mcp.indmoney.com/mcp')
  const [displayTool, setDisplayTool] = useState('')
  const [showConn, setShowConn] = useState(false)
  const [showDisc, setShowDisc] = useState(false)

  async function load() {
    setStatus('checking')
    try {
      const r = await fetch('/api/config/indmoney/status')
      const d = await r.json()
      if (d.url) setUrl(d.url)
      if (d.display_tool) setDisplayTool(d.display_tool)
      if (d.connected && d.auth_configured) {
        setStatus('ok');  setLabel(`Connected — ${d.tools?.length ?? 0} tools`)
        setTools(d.tools || [])
        setShowConn(false); setShowDisc(true)
      } else if (!d.auth_configured) {
        setStatus('err'); setLabel('Not connected — click Connect IndMoney')
        setShowConn(true);  setShowDisc(false)
      } else {
        setStatus('err'); setLabel(d.error || 'Connection failed')
        setShowConn(true);  setShowDisc(false)
      }
    } catch { setStatus('err'); setLabel('Could not reach gateway') }
  }

  async function disconnect() {
    await fetch('/api/config/indmoney/token', { method: 'DELETE' })
    load()
  }

  async function saveSettings() {
    await fetch('/api/config/indmoney/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, display_tool: displayTool }),
    })
    load()
  }

  useEffect(() => { load() }, [])

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-400">Connect IndMoney via OAuth to see investments and net worth.</p>
      <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
        <span className={`status-dot ${status}`} />
        <span className="text-sm text-slate-300">{label}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="card-label">MCP Server URL</label>
        <input className="cfg-input" value={url} onChange={e => setUrl(e.target.value)} />
      </div>

      {tools.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="card-label">Dashboard card display tool</label>
          <select className="cfg-select" value={displayTool} onChange={e => setDisplayTool(e.target.value)}>
            <option value="">-- select a tool --</option>
            {tools.map(t => <option key={t} value={t.replace('indmoney_', '')}>{t}</option>)}
          </select>
        </div>
      )}

      <div className="flex gap-2 justify-end flex-wrap">
        <button onClick={onClose}       className="btn-secondary">Close</button>
        <button onClick={load}          className="btn-secondary">Refresh</button>
        <button onClick={saveSettings}  className="btn-secondary">Save</button>
        {showConn && (
          <button
            onClick={async () => {
              const base = await getGatewayUrl()
              window.open(`${base}/auth/indmoney`, '_blank', 'noopener,noreferrer')
            }}
            className="btn-primary"
          >
            Connect IndMoney
          </button>
        )}
        {showDisc && <button onClick={disconnect} className="btn-danger">Disconnect</button>}
      </div>

      <p className="text-xs text-slate-500">
        Sign in with your IndMoney mobile number, OTP, and MPIN.
        The gateway self-registers — no developer account needed.
      </p>
    </div>
  )
}

// ── Tab: AI Models ────────────────────────────────────────────────────────────

const AI_PROVIDERS = [
  { id: 'openai',    label: 'OpenAI',                   defaultModel: 'gpt-4o-mini',               needsBaseUrl: false },
  { id: 'anthropic', label: 'Anthropic',                defaultModel: 'claude-haiku-4-5-20251001',  needsBaseUrl: false },
  { id: 'custom',    label: 'Custom (OpenAI-compatible)', defaultModel: '',                        needsBaseUrl: true  },
]

function genId() { return Math.random().toString(36).slice(2, 10) }

function llmLoadModels() {
  try { return JSON.parse(localStorage.getItem('dashboard_llm_models') || '[]') } catch { return [] }
}
function llmSaveModels(m) { localStorage.setItem('dashboard_llm_models', JSON.stringify(m)) }
function llmLoadActiveId() { return localStorage.getItem('dashboard_llm_active_id') || '' }
function llmSaveActiveId(id) { localStorage.setItem('dashboard_llm_active_id', id) }

const EMPTY_FORM = { label: '', provider: 'openai', apiKey: '', model: 'gpt-4o-mini', baseUrl: '' }

function AiTab() {
  const [models,   setModels]   = useState(llmLoadModels)
  const [activeId, setActiveId] = useState(llmLoadActiveId)
  const [editing,  setEditing]  = useState(null)   // model id or 'new' or null
  const [form,     setForm]     = useState(EMPTY_FORM)
  const [testing,  setTesting]  = useState(false)
  const [testMsg,  setTestMsg]  = useState(null)    // { ok, text }
  const [dupErr,   setDupErr]   = useState(false)
  const [envStatus, setEnvStatus] = useState(null)

  useEffect(() => {
    fetch('/api/config/llm/env-status').then(r => r.json()).then(setEnvStatus).catch(() => {})
  }, [])

  function providerDef(id) { return AI_PROVIDERS.find(p => p.id === id) || AI_PROVIDERS[0] }

  function startAdd() { setEditing('new'); setForm(EMPTY_FORM); setTestMsg(null); setDupErr(false) }
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
      if (d.messages?.length) {
        setTestMsg({ ok: true, text: `Connected — ${d.messages.length} messages received` })
      } else {
        setTestMsg({ ok: false, text: d.reason || 'No messages returned' })
      }
    } catch (e) {
      setTestMsg({ ok: false, text: e.message })
    } finally {
      setTesting(false)
    }
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
      {dupErr && (
        <p className="text-xs" style={{ color: '#fb7185' }}>
          ✗ A model with this provider and model name already exists.
        </p>
      )}
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
        Add LLM models to generate personalised wish messages for celebrations. The active model is used; falls back to built-in templates if none is active.
      </p>

      {/* Server .env status */}
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

      {/* Model list */}
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
              {/* Active checkmark */}
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
                  <button onClick={() => setActive(m.id)} className="btn-secondary !py-1 !px-2 !text-[11px]">
                    Use
                  </button>
                )}
                <button onClick={() => editing === m.id ? cancelEdit() : startEdit(m)}
                  className="btn-icon !py-1 !px-2" title="Edit">
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                  </svg>
                </button>
                <button onClick={() => deleteModel(m.id)} className="btn-icon !py-1 !px-2" title="Delete"
                  style={{ color: '#fb7185' }}>
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
        <code className="text-slate-500">LLM_PROVIDER</code>,{' '}
        <code className="text-slate-500">LLM_API_KEY</code>, and{' '}
        <code className="text-slate-500">LLM_MODEL</code>{' '}
        in the server <code className="text-slate-500">.env</code> file.
      </p>
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

  function reset() { setHidden(new Set()) }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-400">
        Choose which cards to show. The layout is arranged automatically for the best look.
      </p>
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
        <button onClick={reset}   className="btn-secondary">Show All</button>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={apply}   className="btn-primary">Apply</button>
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Dashboard Settings</h2>
          <button onClick={onClose} className="btn-icon !p-1.5" aria-label="Close settings">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
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

        {/* Tab content */}
        <div>
          {activeTab === 'location' && <LocationTab location={location} onSave={handleSaveLocation} onClose={onClose} />}
          {activeTab === 'google'   && <GoogleTab onClose={onClose} />}
          {activeTab === 'stocks'   && <StocksTab onClose={onClose} />}
          {activeTab === 'indmoney' && <IndMoneyTab onClose={onClose} />}
          {activeTab === 'ai'       && <AiTab />}
          {activeTab === 'layout'   && (
            <LayoutTab
              cardDefs={cardDefs}
              cardLayout={cardLayout}
              onLayoutChange={onLayoutChange}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  )
}
