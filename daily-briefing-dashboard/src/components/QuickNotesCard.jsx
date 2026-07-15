import { useState, useEffect, useRef } from 'react'
import BentoCard, { CardHeader } from './BentoCard.jsx'
import { loadTasks, saveTasks, genId } from '../utils/alarmUtils.js'

const ACCENT = '#a78bfa'

export default function QuickNotesCard({ delay = 0 }) {
  const [tasks,       setTasks]       = useState(loadTasks)
  const [inputText,   setInputText]   = useState('')
  const [editAlarmId, setEditAlarmId] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const refresh = () => setTasks(loadTasks())
    window.addEventListener('tasks-updated', refresh)
    return () => window.removeEventListener('tasks-updated', refresh)
  }, [])

  function persist(next) { saveTasks(next); setTasks(next) }

  function addTask() {
    const text = inputText.trim()
    if (!text) return
    persist([...tasks, { id: genId(), text, done: false, alarm: null }])
    setInputText('')
    inputRef.current?.focus()
  }

  function toggleDone(id) { persist(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t)) }
  function deleteTask(id) { persist(tasks.filter(t => t.id !== id)) }
  function clearDone()    { persist(tasks.filter(t => !t.done)) }

  function setAlarm(id, iso) {
    persist(tasks.map(t => t.id === id ? { ...t, alarm: iso || null } : t))
    setEditAlarmId(null)
  }

  function clearAlarm(id) {
    persist(tasks.map(t => t.id === id ? { ...t, alarm: null } : t))
  }

  const pending = tasks.filter(t => !t.done).length
  const hasDone = tasks.some(t => t.done)

  return (
    <BentoCard accent={ACCENT} delay={delay} className="p-5 flex flex-col h-full">
      <CardHeader
        icon={
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        }
        title="Tasks"
        accent={ACCENT}
      >
        {pending > 0 && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: `${ACCENT}20`, color: ACCENT }}>
            {pending} pending
          </span>
        )}
      </CardHeader>

      {/* Task list */}
      <div className="flex flex-col gap-0.5 flex-1 overflow-y-auto min-h-0" style={{ maxHeight: '240px' }}>
        {tasks.length === 0 ? (
          <p className="text-xs text-slate-600 py-6 text-center">No tasks yet. Add one below.</p>
        ) : (
          tasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              editingAlarm={editAlarmId === task.id}
              onToggle={()    => toggleDone(task.id)}
              onDelete={()    => deleteTask(task.id)}
              onAlarmClick={()=> setEditAlarmId(editAlarmId === task.id ? null : task.id)}
              onAlarmSet={(iso) => setAlarm(task.id, iso)}
              onAlarmCancel={()=> setEditAlarmId(null)}
              onAlarmClear={()=> clearAlarm(task.id)}
            />
          ))
        )}
      </div>

      {hasDone && (
        <button onClick={clearDone}
          className="text-[10px] text-slate-600 hover:text-slate-400 mt-1 text-left transition-colors self-start">
          Clear completed ✕
        </button>
      )}

      {/* Add task */}
      <div className="flex gap-2 mt-3">
        <input
          ref={inputRef}
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
          placeholder="Add a task…"
          className="flex-1 text-sm rounded-lg px-3 py-1.5"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border:     '1px solid rgba(255,255,255,0.1)',
            color:      '#e2e8f0',
            outline:    'none',
          }}
        />
        <button
          onClick={addTask}
          className="px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: `${ACCENT}22`, color: ACCENT }}>
          Add
        </button>
      </div>
    </BentoCard>
  )
}

function TaskRow({ task, editingAlarm, onToggle, onDelete, onAlarmClick, onAlarmSet, onAlarmCancel, onAlarmClear }) {
  const dtRef     = useRef(null)
  const alarmDate = task.alarm ? new Date(task.alarm) : null
  const alarmPast = alarmDate && alarmDate < new Date()
  const alarmStr  = alarmDate
    ? alarmDate.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  const localDefault = task.alarm
    ? task.alarm.slice(0, 16)
    : new Date(Date.now() + 3600000).toISOString().slice(0, 16)

  return (
    <div className="group flex items-start gap-2 px-2 py-1.5 rounded-lg transition-colors hover:bg-white/[0.03]">
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className="mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors"
        style={{ background: task.done ? ACCENT : 'transparent', borderColor: task.done ? ACCENT : 'rgba(255,255,255,0.2)' }}
      >
        {task.done && (
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      {/* Text + alarm */}
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug"
          style={{ color: task.done ? '#475569' : '#e2e8f0', textDecoration: task.done ? 'line-through' : 'none' }}>
          {task.text}
        </p>

        {alarmStr && !editingAlarm && (
          <button onClick={onAlarmClear}
            className="flex items-center gap-1 mt-0.5 transition-opacity hover:opacity-60"
            style={{ color: alarmPast ? '#fb7185' : '#fbbf24' }}
            title="Click to clear alarm">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            <span className="text-[10px]">{alarmStr}</span>
          </button>
        )}

        {editingAlarm && (
          <div className="flex items-center gap-1 mt-1">
            <input
              ref={dtRef}
              type="datetime-local"
              defaultValue={localDefault}
              min={new Date().toISOString().slice(0, 16)}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Escape') onAlarmCancel()
                if (e.key === 'Enter')  onAlarmSet(dtRef.current?.value ? new Date(dtRef.current.value).toISOString() : null)
              }}
              className="text-[11px] rounded px-2 py-0.5 flex-1"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0', outline: 'none' }}
            />
            <button
              onClick={() => onAlarmSet(dtRef.current?.value ? new Date(dtRef.current.value).toISOString() : null)}
              className="text-[11px] px-1.5 py-0.5 rounded transition-opacity hover:opacity-80"
              style={{ background: `${ACCENT}22`, color: ACCENT }}>
              ✓
            </button>
            <button
              onClick={onAlarmCancel}
              className="text-[11px] px-1.5 py-0.5 rounded transition-opacity hover:opacity-80"
              style={{ color: '#64748b' }}>
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
        <button onClick={onAlarmClick}
          className="p-1 rounded transition-colors hover:bg-white/10"
          style={{ color: task.alarm ? '#fbbf24' : 'rgba(255,255,255,0.25)' }}
          title={task.alarm ? 'Edit alarm' : 'Set alarm'}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
        </button>
        <button onClick={onDelete}
          className="p-1 rounded transition-colors hover:bg-white/10"
          style={{ color: 'rgba(255,255,255,0.2)' }}
          title="Delete">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
