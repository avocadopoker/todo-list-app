import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

/* ---------- date helpers ---------- */
function ymd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const today = () => ymd(new Date())
function shiftDays(baseYmd, n) {
  const d = new Date(baseYmd + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return ymd(d)
}
// whole days from a -> b (b later), calendar-based
function daysBetween(aYmd, bYmd) {
  const a = new Date(aYmd + 'T00:00:00')
  const b = new Date(bYmd + 'T00:00:00')
  return Math.round((b - a) / 86400000)
}
function daysInMonth(year, monthIdx) {
  return new Date(year, monthIdx + 1, 0).getDate()
}
// Monday-first 6x7 grid of date strings covering the given month,
// padded with the trailing/leading days of neighboring months.
function monthGrid(year, monthIdx) {
  const first = new Date(year, monthIdx, 1)
  const firstWeekday = (first.getDay() + 6) % 7 // 0 = Monday
  const gridStart = new Date(year, monthIdx, 1 - firstWeekday)
  const cells = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    cells.push({ date: ymd(d), inMonth: d.getMonth() === monthIdx })
  }
  return cells
}
// add whole months, clamping to anchor day. anchorDay is the ORIGINAL
// day-of-month so a Jan 31 series clamps to Feb 28 but snaps back to Mar 31
// instead of drifting to the 28th forever.
function addMonths(dateStr, n, anchorDay) {
  const d = new Date(dateStr + 'T00:00:00')
  const anchor = anchorDay || d.getDate()
  let total = d.getFullYear() * 12 + d.getMonth() + n
  const y = Math.floor(total / 12)
  const m = ((total % 12) + 12) % 12
  return ymd(new Date(y, m, Math.min(anchor, daysInMonth(y, m))))
}
// next occurrence for "every N day/week/month/year"
function nextOccurrence(dateStr, interval, unit, anchorDay) {
  const n = Math.max(1, Number(interval) || 1)
  if (unit === 'day') return shiftDays(dateStr, n)
  if (unit === 'week') return shiftDays(dateStr, n * 7)
  if (unit === 'month') return addMonths(dateStr, n, anchorDay)
  if (unit === 'year') return addMonths(dateStr, n * 12, anchorDay)
  return dateStr
}
function prettyDate(dateStr) {
  const t0 = today()
  if (dateStr === t0) return 'Today'
  if (dateStr === shiftDays(t0, 1)) return 'Tomorrow'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
function weekdayLabel(dateStr) {
  const t0 = today()
  if (dateStr === t0) return 'Today'
  if (dateStr === shiftDays(t0, 1)) return 'Tomorrow'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'long' })
}
function fullDayLabel(dateStr) {
  const t0 = today()
  if (dateStr === t0) return 'Today'
  if (dateStr === shiftDays(t0, 1)) return 'Tomorrow'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
function dailySeed() {
  const s = today()
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

// a "habit" is a recurring task that repeats at least monthly (not yearly)
function isHabit(task) {
  return task.repeat_unit === 'day' || task.repeat_unit === 'week' || task.repeat_unit === 'month'
}
// next slot strictly AFTER `bound` (used when a task is marked Done today)
function slotAfter(dueDate, interval, unit, anchor, bound) {
  let d = dueDate
  let guard = 0
  while (d <= bound && guard < 1000) {
    d = nextOccurrence(d, interval, unit, anchor)
    guard++
  }
  return d
}
// next slot ON OR AFTER `bound` (used when an occurrence was missed)
function slotOnOrAfter(dueDate, interval, unit, anchor, bound) {
  let d = dueDate
  let guard = 0
  while (d < bound && guard < 1000) {
    d = nextOccurrence(d, interval, unit, anchor)
    guard++
  }
  return d
}

const UNITS = [
  { value: 'day', label: 'day/s' },
  { value: 'week', label: 'week/s' },
  { value: 'month', label: 'month/s' },
  { value: 'year', label: 'year/s' },
]
// e.g. "every 3 weeks" / "every day"
function repeatLabel(interval, unit) {
  if (!unit) return ''
  const n = Number(interval) || 1
  const names = { day: 'day', week: 'week', month: 'month', year: 'year' }
  const base = names[unit] || unit
  if (n === 1) return `every ${base}`
  return `every ${n} ${base}s`
}
// approximate span in days, used to sort recurring tasks quick -> long
function recurrenceDays(interval, unit) {
  const n = Number(interval) || 1
  const perUnit = { day: 1, week: 7, month: 30, year: 365 }
  return n * (perUnit[unit] || 0)
}

const DURATIONS = [
  { value: '1', label: '1h' },
  { value: '2', label: '2h' },
  { value: '3', label: '3h' },
  { value: '4', label: '4h' },
  { value: '5', label: '5h' },
  { value: '5+', label: '5h+' },
]
// "14:00:00" (Postgres time) -> "2:00 PM"
function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':')
  const d = new Date(2000, 0, 1, Number(h), Number(m))
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

const VIEWS = [
  { key: 'today', label: 'Today' },
  { key: 'next7', label: '7 Days' },
  { key: 'calendar', label: 'Calendar' },
]

function filterForView(tasks, view) {
  const t0 = today()
  if (view === 'today') return tasks.filter((x) => x.due_date && x.due_date <= t0)
  if (view === 'next7') {
    const end = shiftDays(t0, 6)
    return tasks.filter((x) => x.due_date && x.due_date >= t0 && x.due_date <= end)
  }
  return []
}
// group sorted tasks by due_date into [{date, label, tasks}] for separated views
function groupByDay(sorted, labelFn) {
  const groups = []
  let cur = null
  for (const t of sorted) {
    if (!cur || cur.date !== t.due_date) {
      cur = { date: t.due_date, label: labelFn(t.due_date), tasks: [] }
      groups.push(cur)
    }
    cur.tasks.push(t)
  }
  return groups
}
// Sort by date first, then - within the same day - earliest time first,
// with untimed tasks trailing after every timed one on that day.
function sortTasks(list) {
  return [...list].sort((a, b) => {
    if ((a.due_date || '') !== (b.due_date || ''))
      return (a.due_date || '').localeCompare(b.due_date || '')
    if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time)
    if (a.due_time && !b.due_time) return -1
    if (!a.due_time && b.due_time) return 1
    return (a.created_at || '').localeCompare(b.created_at || '')
  })
}

/* ---------- login ---------- */
function Login() {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    const mail = email.trim().toLowerCase()
    if (mode === 'reset') {
      // Always send people to the web app for the reset. On the website this
      // is the same origin; inside the iOS app the email link opens Safari
      // (where the reset works), then they return to the app and log in.
      const resetTarget = window.location.origin.startsWith('http')
        ? window.location.origin
        : 'https://tdltodolist.netlify.app'
      const { error } = await supabase.auth.resetPasswordForEmail(mail, {
        redirectTo: resetTarget,
      })
      setMsg(error ? error.message : 'Reset link sent. Check your email.')
      setBusy(false)
      return
    }
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email: mail,
        password,
      })
      if (error) setMsg(error.message)
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: mail,
        password,
        options: { data: { name: name.trim() } },
      })
      if (error) setMsg(error.message)
      else if (data.session && data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: mail,
          name: name.trim(),
        })
      } else if (!data.session) {
        setMsg('Account made. Check your email to confirm, then log in.')
      }
    }
    setBusy(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-mark">/</span>list
        </div>
        <p className="auth-tag">Get it done, in order.</p>

        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && (
            <label>
              Name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Your name"
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          {mode !== 'reset' && (
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
                minLength={6}
              />
            </label>
          )}
          {msg && <p className="auth-msg">{msg}</p>}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy
              ? '...'
              : mode === 'login'
              ? 'Log in'
              : mode === 'signup'
              ? 'Create account'
              : 'Send reset link'}
          </button>
        </form>

        {mode === 'login' && (
          <button
            className="auth-switch"
            onClick={() => {
              setMode('reset')
              setMsg('')
            }}
          >
            Forgot password?
          </button>
        )}
        <button
          className="auth-switch"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setMsg('')
          }}
        >
          {mode === 'login'
            ? 'No account? Create one'
            : mode === 'signup'
            ? 'Have an account? Log in'
            : 'Back to log in'}
        </button>
      </div>
    </div>
  )
}

/* ---------- set new password ---------- */
function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setMsg(error.message)
    else onDone()
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-mark">/</span>list
        </div>
        <p className="auth-tag">Choose a new password.</p>
        <form onSubmit={submit} className="auth-form">
          <label>
            New password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              autoFocus
            />
          </label>
          {msg && <p className="auth-msg">{msg}</p>}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? '...' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ---------- task row ---------- */
function TaskRow({ task, selected, onSelect, timeless, fromName, groupName, onEdit, readOnly }) {
  const overdue = task.due_date && task.due_date < today()
  const overdueDays = overdue ? daysBetween(task.due_date, today()) : 0
  return (
    <li className={`task ${selected ? 'is-selected' : ''}`}>
      <span className="spine" aria-hidden="true" />
      <label className={`task-check${readOnly ? ' read-only' : ''}`}>
        <input
          type="checkbox"
          checked={!!selected}
          disabled={readOnly}
          onChange={() => onSelect && onSelect(task.id)}
          aria-label={`Select ${task.title}`}
        />
        <span className="box" />
      </label>
      <div className="task-body">
        <span className="task-title">{task.title}</span>
        <span className="task-meta">
          {task.due_date && (
            <span className={overdue ? 'overdue' : ''}>
              {overdue
                ? `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`
                : prettyDate(task.due_date)}
            </span>
          )}
          {task.due_time && (
            <span className="time-tag">
              {formatTime(task.due_time)}
              {task.duration && ` · ${DURATIONS.find((d) => d.value === task.duration)?.label || ''}`}
            </span>
          )}
          {timeless && <span className="timeless-tag">timeless pick</span>}
          {groupName && <span className="group-tag">👥 {groupName}</span>}
          {fromName && <span className="from-tag">from {fromName}</span>}
          {task.repeat_unit && (
            <span className="repeat-tag">
              {repeatLabel(task.repeat_interval, task.repeat_unit)}
            </span>
          )}
          {isHabit(task) && task.streak > 0 && (
            <span className="streak-tag">🔥 {task.streak}</span>
          )}
          {task.reward && (
            <span className="reward-tag">🎁 {task.reward}</span>
          )}
        </span>
      </div>
      {onEdit && (
        <button
          className="edit-btn"
          onClick={() => onEdit(task)}
          aria-label={`Edit ${task.title}`}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d="M13.5 6.5l4 4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </li>
  )
}

/* ---------- add task ---------- */
function AddTask({ onDone, onCancel, people, groups, myId, presetDate, presetRecurring }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(presetDate || '')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState('2')
  const [recurring, setRecurring] = useState(!!presetRecurring)
  const [repeatInterval, setRepeatInterval] = useState(1)
  const [repeatUnit, setRepeatUnit] = useState('week')
  const [assignee, setAssignee] = useState(`u:${myId}`)
  const [reward, setReward] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const showAssign = (people && people.length > 1) || (groups && groups.length > 0)
  const assigningToOther = assignee !== `u:${myId}`

  // a time only makes sense alongside a date - clearing the date clears it too
  function changeDate(v) {
    setDate(v)
    if (!v) setTime('')
  }

  async function save(e) {
    e.preventDefault()
    const name = title.trim()
    if (!name) return
    setBusy(true)
    setErr('')
    const due = recurring ? date || today() : date || null
    const useTime = due ? time : ''
    const isGroup = assignee.startsWith('g:')
    const targetId = assignee.slice(2)
    const { error } = await supabase.from('tasks').insert([
      {
        title: name,
        due_date: due,
        due_time: useTime || null,
        duration: useTime ? duration : null,
        repeat_interval: recurring ? Math.max(1, Number(repeatInterval) || 1) : null,
        repeat_unit: recurring ? repeatUnit : null,
        repeat_anchor: recurring && due ? Number(due.slice(8, 10)) : null,
        reward: assigningToOther && reward.trim() ? reward.trim() : null,
        user_id: isGroup ? null : targetId,
        assigned_group_id: isGroup ? targetId : null,
      },
    ])
    setBusy(false)
    if (error) setErr(error.message)
    else onDone()
  }

  return (
    <div className="add-screen">
      <div className="add-head">
        <button className="ghost" onClick={onCancel}>
          ← Back
        </button>
        <h2>{presetRecurring ? 'New habit' : 'New task'}</h2>
      </div>

      <form onSubmit={save} className="add-form">
        <label>
          Task
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            autoFocus
            required
          />
        </label>

        <label>
          Date
          <input type="date" value={date} onChange={(e) => changeDate(e.target.value)} />
          <span className="hint">
            Leave empty for a timeless task - no deadline, surfaced over time.
          </span>
        </label>

        {date && (
          <label>
            Time (optional)
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
        )}

        {date && time && (
          <div className="field">
            <span className="field-label">How long will it take?</span>
            <div className="duration-picker">
              {DURATIONS.map((d) => (
                <label key={d.value} className={`duration-opt${duration === d.value ? ' active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={duration === d.value}
                    onChange={() => setDuration(d.value)}
                  />
                  <span>{d.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {showAssign && (
          <label>
            Task for
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              {people.map((p) => (
                <option key={p.id} value={`u:${p.id}`}>
                  {p.id === myId ? `${p.name || 'Me'} (me)` : p.name}
                </option>
              ))}
              {groups && groups.length > 0 && (
                <optgroup label="Whole group">
                  {groups.map((g) => (
                    <option key={g.id} value={`g:${g.id}`}>
                      {g.name} (everyone)
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {assignee.startsWith('g:') && (
              <span className="hint">
                Anyone in this group can mark it done - it clears for everyone at once.
              </span>
            )}
          </label>
        )}

        {assigningToOther && (
          <label>
            Reward (optional)
            <input
              type="text"
              value={reward}
              onChange={(e) => setReward(e.target.value)}
              placeholder="A little thank-you for doing it"
            />
          </label>
        )}

        <div className="field">
          <label className="switch-row">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
            />
            <span>Recurring</span>
          </label>
          {recurring && (
            <>
              <div className="repeat-row">
                <span>Every</span>
                <input
                  type="number"
                  min="1"
                  value={repeatInterval}
                  onChange={(e) => setRepeatInterval(e.target.value)}
                  className="repeat-num"
                />
                <select
                  value={repeatUnit}
                  onChange={(e) => setRepeatUnit(e.target.value)}
                >
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
              <span className="hint">
                {repeatUnit === 'month' || repeatUnit === 'year'
                  ? 'Repeats on the same date. Short months fall back to the last day.'
                  : 'Repeats on this schedule from the chosen date.'}
              </span>
            </>
          )}
        </div>

        {err && <p className="auth-msg">{err}</p>}

        <div className="add-actions">
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving...' : 'Add task'}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ---------- streak celebration overlay ---------- */
// shown once a day, whenever the day's list gets fully cleared. The line
// shown comes from a per-user shuffled order through the shared
// reward_lines pool (profiles.reward_order / reward_position) - guarantees
// no repeat until every line has been seen, then reshuffles.
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
// picks the next line for this user, advancing (and persisting) their
// shuffle state; reshuffles using the CURRENT pool once exhausted, so
// lines added later only join in at the next reshuffle. Returns null if
// the pool is empty (nothing configured yet).
async function pickAndAdvanceReward(profile, rewardLines, myId) {
  if (!rewardLines || rewardLines.length === 0) return null
  const validIds = new Set(rewardLines.map((r) => r.id))
  let order = Array.isArray(profile?.reward_order)
    ? profile.reward_order.filter((id) => validIds.has(id))
    : []
  let pos = profile?.reward_position || 0

  if (order.length === 0 || pos >= order.length) {
    order = shuffle(rewardLines.map((r) => r.id))
    pos = 0
  }

  const lineId = order[pos]
  const lineObj = rewardLines.find((r) => r.id === lineId)
  await supabase
    .from('profiles')
    .update({ reward_order: order, reward_position: pos + 1 })
    .eq('id', myId)

  return lineObj ? lineObj.text : null
}

function StreakBurst({ n, line, rewards, onEnd }) {
  // `rewards` was fetched before today's clear, so its days_remaining /
  // reached values are one day stale - recompute them against the new
  // streak (n) so the popup shows today's real numbers.
  const freshRewards = (rewards || []).map((r) => ({
    ...r,
    days_remaining: Math.max(r.target_streak - n, 0),
    reached: n >= r.target_streak,
  }))
  return (
    <div className="streak-overlay">
      <div className="streak-pop">
        <div className="burst" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} style={{ '--i': i }} />
          ))}
        </div>
        <div className="streak-hero">
          <svg className="streak-hero-fire" viewBox="0 0 340 220" aria-hidden="true">
            <defs>
              <linearGradient id="flameOuterGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffb03d" />
                <stop offset="45%" stopColor="#ff5a2e" />
                <stop offset="100%" stopColor="#8a0f06" />
              </linearGradient>
              <radialGradient id="flameInnerGrad" cx="50%" cy="55%" r="60%">
                <stop offset="0%" stopColor="#fff6c9" />
                <stop offset="55%" stopColor="#ffc447" />
                <stop offset="100%" stopColor="#ff7a1a" />
              </radialGradient>
              <radialGradient id="impactGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fffef0" />
                <stop offset="60%" stopColor="#ffd97a" />
                <stop offset="100%" stopColor="#ff9d3d" stopOpacity="0" />
              </radialGradient>
            </defs>

            <g className="flame-side flame-side-left">
              <g>
                <path
                  d="M15,150 C0,150 -2,58 15,42 C35,18 72,8 108,14 C142,20 162,46 160,88 C158,126 140,152 102,158 C66,164 30,160 15,150 Z"
                  fill="url(#flameOuterGrad)"
                />
                <path
                  d="M55,140 C40,128 34,102 42,78 C50,56 70,42 92,44 C112,46 126,64 124,88 C122,112 106,132 80,140 C71,143 62,143 55,140 Z"
                  fill="url(#flameInnerGrad)"
                />
                <path d="M70,16 C62,-4 66,-20 78,-30 C82,-16 84,-2 76,14 Z" fill="url(#flameOuterGrad)" />
                <path d="M108,15 C106,-2 114,-16 128,-22 C128,-8 126,6 116,18 Z" fill="url(#flameOuterGrad)" />
              </g>
            </g>

            <g className="flame-side flame-side-right" transform="translate(340,0) scale(-1,1)">
              <g>
                <path
                  d="M15,150 C0,150 -2,58 15,42 C35,18 72,8 108,14 C142,20 162,46 160,88 C158,126 140,152 102,158 C66,164 30,160 15,150 Z"
                  fill="url(#flameOuterGrad)"
                />
                <path
                  d="M55,140 C40,128 34,102 42,78 C50,56 70,42 92,44 C112,46 126,64 124,88 C122,112 106,132 80,140 C71,143 62,143 55,140 Z"
                  fill="url(#flameInnerGrad)"
                />
                <path d="M70,16 C62,-4 66,-20 78,-30 C82,-16 84,-2 76,14 Z" fill="url(#flameOuterGrad)" />
                <path d="M108,15 C106,-2 114,-16 128,-22 C128,-8 126,6 116,18 Z" fill="url(#flameOuterGrad)" />
              </g>
            </g>

            <g className="flame-impact" transform="translate(170,95)">
              <circle r="46" fill="url(#impactGrad)" />
              <g stroke="#ffe9a8" strokeWidth="3" strokeLinecap="round">
                <line x1="0" y1="-58" x2="0" y2="-38" />
                <line x1="0" y1="38" x2="0" y2="58" />
                <line x1="-58" y1="0" x2="-38" y2="0" />
                <line x1="58" y1="0" x2="38" y2="0" />
                <line x1="-41" y1="-41" x2="-27" y2="-27" />
                <line x1="41" y1="-41" x2="27" y2="-27" />
                <line x1="-41" y1="41" x2="-27" y2="27" />
                <line x1="41" y1="41" x2="27" y2="27" />
              </g>
            </g>
          </svg>
          <div className="streak-num">{n}</div>
        </div>
        {line && <div className="streak-line-box"><div className="streak-line">{line}</div></div>}
        {freshRewards.length > 0 && (
          <div className="burst-rewards">
            {freshRewards.map((r) => (
              <div key={r.id} className="burst-reward-line">
                <span className="burst-reward-icon" aria-hidden="true">🎁</span>
                {r.reached ? (
                  r.visibility === 'visible' ? (
                    <span>
                      You earned <strong>{r.reward_text}</strong> from {r.giver_name}!
                    </span>
                  ) : (
                    <span>You earned a reward from {r.giver_name}!</span>
                  )
                ) : r.visibility === 'visible' ? (
                  <span>
                    {r.days_remaining} more day{r.days_remaining === 1 ? '' : 's'} to
                    receive <strong>{r.reward_text}</strong> from {r.giver_name}
                  </span>
                ) : (
                  <span>
                    {r.days_remaining} more day{r.days_remaining === 1 ? '' : 's'} to get
                    a reward from {r.giver_name}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        <button className="streak-continue" onClick={onEnd}>
          Nice!
        </button>
      </div>
    </div>
  )
}

/* ---------- edit task ---------- */
function EditTask({ task, onDone, onCancel, people, groups, myId }) {
  const [title, setTitle] = useState(task.title)
  const [date, setDate] = useState(task.due_date || '')
  const [time, setTime] = useState(task.due_time ? task.due_time.slice(0, 5) : '')
  const [duration, setDuration] = useState(task.duration || '2')
  const [recurring, setRecurring] = useState(!!task.repeat_unit)
  const [repeatInterval, setRepeatInterval] = useState(task.repeat_interval || 1)
  const [repeatUnit, setRepeatUnit] = useState(task.repeat_unit || 'week')
  const [assignee, setAssignee] = useState(
    task.assigned_group_id ? `g:${task.assigned_group_id}` : `u:${task.user_id}`
  )
  const [reward, setReward] = useState(task.reward || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const showAssign = (people && people.length > 1) || (groups && groups.length > 0)
  const assigningToOther = assignee !== `u:${myId}`

  function changeDate(v) {
    setDate(v)
    if (!v) setTime('')
  }

  async function save(e) {
    e.preventDefault()
    const name = title.trim()
    if (!name) return
    setBusy(true)
    setErr('')
    const due = recurring ? date || today() : date || null
    const useTime = due ? time : ''
    const willBeHabit = recurring && (repeatUnit === 'day' || repeatUnit === 'week' || repeatUnit === 'month')
    const isGroup = assignee.startsWith('g:')
    const targetId = assignee.slice(2)
    const { error } = await supabase
      .from('tasks')
      .update({
        title: name,
        due_date: due,
        due_time: useTime || null,
        duration: useTime ? duration : null,
        repeat_interval: recurring ? Math.max(1, Number(repeatInterval) || 1) : null,
        repeat_unit: recurring ? repeatUnit : null,
        repeat_anchor: recurring && due ? Number(due.slice(8, 10)) : null,
        // the streak stays put when it's still a habit; otherwise it no
        // longer applies, so it's cleared
        streak: willBeHabit ? task.streak : null,
        reward: assigningToOther && reward.trim() ? reward.trim() : null,
        user_id: isGroup ? null : targetId,
        assigned_group_id: isGroup ? targetId : null,
      })
      .eq('id', task.id)
    setBusy(false)
    if (error) setErr(error.message)
    else onDone()
  }

  return (
    <div className="add-screen">
      <div className="add-head">
        <button className="ghost" onClick={onCancel}>
          ← Back
        </button>
        <h2>Edit task</h2>
      </div>

      <form onSubmit={save} className="add-form">
        <label>
          Task
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            autoFocus
            required
          />
        </label>

        <label>
          Date
          <input type="date" value={date} onChange={(e) => changeDate(e.target.value)} />
          <span className="hint">
            Leave empty for a timeless task - no deadline, surfaced over time.
          </span>
        </label>

        {date && (
          <label>
            Time (optional)
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
        )}

        {date && time && (
          <div className="field">
            <span className="field-label">How long will it take?</span>
            <div className="duration-picker">
              {DURATIONS.map((d) => (
                <label key={d.value} className={`duration-opt${duration === d.value ? ' active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={duration === d.value}
                    onChange={() => setDuration(d.value)}
                  />
                  <span>{d.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {showAssign && (
          <label>
            Task for
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              {people.map((p) => (
                <option key={p.id} value={`u:${p.id}`}>
                  {p.id === myId ? `${p.name || 'Me'} (me)` : p.name}
                </option>
              ))}
              {groups && groups.length > 0 && (
                <optgroup label="Whole group">
                  {groups.map((g) => (
                    <option key={g.id} value={`g:${g.id}`}>
                      {g.name} (everyone)
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {assignee.startsWith('g:') && (
              <span className="hint">
                Anyone in this group can mark it done - it clears for everyone at once.
              </span>
            )}
          </label>
        )}

        {assigningToOther && (
          <label>
            Reward (optional)
            <input
              type="text"
              value={reward}
              onChange={(e) => setReward(e.target.value)}
              placeholder="A little thank-you for doing it"
            />
          </label>
        )}

        <div className="field">
          <label className="switch-row">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
            />
            <span>Recurring</span>
          </label>
          {recurring && (
            <>
              <div className="repeat-row">
                <span>Every</span>
                <input
                  type="number"
                  min="1"
                  value={repeatInterval}
                  onChange={(e) => setRepeatInterval(e.target.value)}
                  className="repeat-num"
                />
                <select
                  value={repeatUnit}
                  onChange={(e) => setRepeatUnit(e.target.value)}
                >
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
              <span className="hint">
                {isHabit(task) && task.streak > 0
                  ? `Current streak (🔥 ${task.streak}) is kept as long as this stays a day/week/month habit.`
                  : repeatUnit === 'month' || repeatUnit === 'year'
                  ? 'Repeats on the same date. Short months fall back to the last day.'
                  : 'Repeats on this schedule from the chosen date.'}
              </span>
            </>
          )}
        </div>

        {err && <p className="auth-msg">{err}</p>}

        <div className="add-actions">
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ---------- calendar view ---------- */
function CalendarView({ tasks, selected, toggleSelect, onAddForDate, onEditTask, myId, nameFor, groupNameFor, readOnly }) {
  const t0 = today()
  const now = new Date(t0 + 'T00:00:00')
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [selectedDate, setSelectedDate] = useState(t0)

  const grid = monthGrid(cursor.y, cursor.m)
  const tasksByDate = {}
  for (const t of tasks) {
    if (!t.due_date) continue
    ;(tasksByDate[t.due_date] = tasksByDate[t.due_date] || []).push(t)
  }

  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  function shiftMonth(n) {
    setCursor((c) => {
      let total = c.y * 12 + c.m + n
      return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 }
    })
  }

  const dayTasks = sortTasks(tasksByDate[selectedDate] || [])
  const headRef = useRef(null)
  const gridRef = useRef(null)
  const MAX_DOTS = 5

  function selectDate(d) {
    setSelectedDate(d)
    // wait two frames so the new day's tasks have painted before we measure,
    // then land exactly at the day header (just below the sticky top nav).
    // scrollIntoView tends to overshoot in the iOS webview when the target
    // panel's height changes between the call and the paint, so we compute
    // the scroll position ourselves instead.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const headEl = headRef.current
        if (!headEl) return
        const topbar = document.querySelector('.topbar')
        const clearance = (topbar ? topbar.getBoundingClientRect().height : 0) + 8
        const y = headEl.getBoundingClientRect().top + window.pageYOffset - clearance
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' })
      })
    })
  }
  function backToCalendar() {
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="calendar">
      <div className="cal-header" ref={gridRef}>
        <button className="cal-nav" onClick={() => shiftMonth(-1)} aria-label="Previous month">
          ‹
        </button>
        <span className="cal-title">{monthLabel}</span>
        <button className="cal-nav" onClick={() => shiftMonth(1)} aria-label="Next month">
          ›
        </button>
      </div>

      <div className="cal-weekdays">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div className="cal-grid">
        {grid.map((cell) => {
          const count = (tasksByDate[cell.date] || []).length
          const isToday = cell.date === t0
          const isSel = cell.date === selectedDate
          return (
            <button
              key={cell.date}
              className={
                'cal-cell' +
                (cell.inMonth ? '' : ' dim') +
                (isToday ? ' is-today' : '') +
                (isSel ? ' is-selected' : '')
              }
              onClick={() => selectDate(cell.date)}
            >
              <span className="cal-daynum">{Number(cell.date.slice(8, 10))}</span>
              {count > 0 && (
                <span className="cal-dots">
                  {Array.from({ length: Math.min(count, MAX_DOTS) }).map((_, i) => (
                    <span key={i} className="cal-dot" />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="cal-day-panel">
        <div className="cal-day-head" ref={headRef}>
          <span>{fullDayLabel(selectedDate)}</span>
          {!readOnly && (
            <button className="cal-add" onClick={() => onAddForDate(selectedDate)}>
              + Add
            </button>
          )}
        </div>
        {dayTasks.length === 0 ? (
          <p className="empty">Nothing scheduled.</p>
        ) : (
          <ul className="task-list">
            {dayTasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                selected={selected.has(t.id)}
                onSelect={readOnly ? undefined : toggleSelect}
                timeless={false}
                fromName={
                  t.created_by && t.created_by !== myId ? nameFor(t.created_by) : null
                }
                groupName={t.assigned_group_id ? groupNameFor(t.assigned_group_id) : null}
                onEdit={readOnly ? undefined : onEditTask}
                readOnly={readOnly}
              />
            ))}
          </ul>
        )}
        <button className="cal-back" onClick={backToCalendar}>
          ↑ Back to calendar
        </button>
      </div>
    </div>
  )
}

/* ---------- TDL screen ---------- */
function Tdl({ tasks, loading, refresh, people, groups, myId, nameFor, profile, viewablePeople, rewardLines, incomingRewards }) {
  const [view, setView] = useState('today')
  const [selected, setSelected] = useState(new Set())
  const [adding, setAdding] = useState(false)
  const [addDate, setAddDate] = useState(null)
  const [editing, setEditing] = useState(null)
  const [burst, setBurst] = useState(null)
  const [burstLine, setBurstLine] = useState(null)
  const [viewingUserId, setViewingUserId] = useState(null) // null = viewing myself

  const readOnly = viewingUserId !== null
  // Show exactly what that person sees: their own tasks plus anything
  // assigned to a group they're in (which, if I can see it at all, is a
  // group I'm also a member of).
  const scopedTasks = readOnly
    ? tasks.filter((t) => t.user_id === viewingUserId || t.assigned_group_id)
    : tasks.filter((t) => t.user_id === myId || t.assigned_group_id)

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Mark selected tasks Done: habits advance their streak to the next
  // occurrence (+1); missed-independent one-offs are simply removed.
  async function doneSelected() {
    const t0 = today()
    const chosen = scopedTasks.filter((t) => selected.has(t.id))

    // required Today items (dated <= today) that are NOT being cleared now
    const requiredToday = scopedTasks.filter((t) => t.due_date && t.due_date <= t0)
    const clearedNow = requiredToday.filter((t) => selected.has(t.id))
    const remaining = requiredToday.length - clearedNow.length

    for (const t of chosen) {
      if (t.repeat_unit) {
        const anchor = t.repeat_anchor || Number((t.due_date || t0).slice(8, 10))
        const nextDate = slotAfter(
          t.due_date || t0,
          t.repeat_interval,
          t.repeat_unit,
          anchor,
          t0
        )
        const nextStreak = isHabit(t) ? (t.streak || 0) + 1 : null
        await supabase.from('tasks').insert([
          {
            title: t.title,
            due_date: nextDate,
            due_time: t.due_time,
            duration: t.duration,
            repeat_interval: t.repeat_interval,
            repeat_unit: t.repeat_unit,
            repeat_anchor: anchor,
            streak: nextStreak,
            reward: t.reward,
            user_id: t.user_id,
            assigned_group_id: t.assigned_group_id,
            created_by: t.created_by,
          },
        ])
      }
      await supabase.from('tasks').delete().eq('id', t.id)
    }

    // daily "clear the list" streak: fired when this action empties Today
    if (requiredToday.length > 0 && remaining === 0 && profile) {
      if (profile.clear_last !== t0) {
        const newStreak = (profile.clear_streak || 0) + 1
        let newProgress = (profile.token_progress || 0) + 1
        let newTokens = profile.streak_tokens || 0
        if (newProgress >= 10) {
          newTokens += 1
          newProgress = 0
        }
        await supabase
          .from('profiles')
          .update({
            clear_streak: newStreak,
            clear_last: t0,
            token_progress: newProgress,
            streak_tokens: newTokens,
            streak_checked_through: t0,
          })
          .eq('id', myId)
        const line = await pickAndAdvanceReward(profile, rewardLines, myId)
        setBurstLine(line)
        setBurst(newStreak)
      }
    }

    setSelected(new Set())
    refresh()
  }

  if (adding)
    return (
      <AddTask
        people={people}
        groups={groups}
        myId={myId}
        presetDate={addDate}
        onCancel={() => {
          setAdding(false)
          setAddDate(null)
        }}
        onDone={() => {
          setAdding(false)
          setAddDate(null)
          refresh()
        }}
      />
    )

  if (editing)
    return (
      <EditTask
        task={editing}
        people={people}
        groups={groups}
        myId={myId}
        onCancel={() => setEditing(null)}
        onDone={() => {
          setEditing(null)
          refresh()
        }}
      />
    )

  let visible = sortTasks(filterForView(scopedTasks, view))

  let timelessPick = null
  if (view === 'today') {
    const timeless = scopedTasks.filter((t) => !t.due_date)
    if (timeless.length) {
      timelessPick = timeless[dailySeed() % timeless.length]
      if (!visible.some((v) => v.id === timelessPick.id))
        visible = [timelessPick, ...visible]
    }
  }

  const grouped = view === 'next7'
  const dayGroups = grouped
    ? groupByDay(visible, view === 'next7' ? weekdayLabel : fullDayLabel)
    : null

  const groupNameFor = (id) => (groups.find((g) => g.id === id) || {}).name

  const renderRow = (t) => (
    <TaskRow
      key={t.id}
      task={t}
      selected={selected.has(t.id)}
      onSelect={readOnly ? undefined : toggleSelect}
      timeless={timelessPick && t.id === timelessPick.id && !t.due_date}
      fromName={t.created_by && t.created_by !== myId ? nameFor(t.created_by) : null}
      groupName={t.assigned_group_id ? groupNameFor(t.assigned_group_id) : null}
      onEdit={readOnly ? undefined : setEditing}
      readOnly={readOnly}
    />
  )

  const viewingName = readOnly
    ? (viewablePeople.find((p) => p.id === viewingUserId) || {}).name
    : null

  return (
    <div className="tdl">
      {viewablePeople && viewablePeople.length > 0 ? (
        <div className="viewer-row">
          {readOnly ? (
            <span className="readonly-tag">👁 Viewing {viewingName}</span>
          ) : (
            profile && (
              <span className="day-streak inline">
                {profile.clear_streak > 0
                  ? `🔥 ${profile.clear_streak} day streak`
                  : '0 Day streak 😭'}
                {profile.streak_tokens > 0 && (
                  <span className="token-tag"> · 🛡️ {profile.streak_tokens}</span>
                )}
              </span>
            )
          )}
          <select
            className="viewer-select"
            value={viewingUserId || 'me'}
            onChange={(e) =>
              setViewingUserId(e.target.value === 'me' ? null : e.target.value)
            }
          >
            <option value="me">My tasks</option>
            {viewablePeople.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}'s tasks
              </option>
            ))}
          </select>
        </div>
      ) : (
        profile && (
          <div className="day-streak">
            {profile.clear_streak > 0
              ? `🔥 ${profile.clear_streak} day streak`
              : '0 Day streak 😭'}
            {profile.streak_tokens > 0 && (
              <span className="token-tag"> · 🛡️ {profile.streak_tokens}</span>
            )}
          </div>
        )
      )}

      <div className="view-switch">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            className={view === v.key ? 'active' : ''}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'calendar' ? (
        <CalendarView
          tasks={scopedTasks}
          selected={selected}
          toggleSelect={readOnly ? () => {} : toggleSelect}
          onAddForDate={(d) => {
            setAddDate(d)
            setAdding(true)
          }}
          onEditTask={readOnly ? () => {} : setEditing}
          myId={myId}
          nameFor={nameFor}
          groupNameFor={groupNameFor}
          readOnly={readOnly}
        />
      ) : loading ? (
        <p className="empty">Loading...</p>
      ) : visible.length === 0 ? (
        <p className="empty">
          {readOnly ? `Nothing here for ${viewingName}.` : 'Nothing here. Add something with the + button.'}
        </p>
      ) : grouped ? (
        <div className="day-groups">
          {dayGroups.map((g) => (
            <div key={g.date} className="day-group">
              <div className="day-sep">{g.label}</div>
              <ul className="task-list">{g.tasks.map(renderRow)}</ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="task-list">{visible.map(renderRow)}</ul>
      )}

      {!readOnly && (
        <button className="fab" onClick={() => setAdding(true)} aria-label="Add task">
          +
        </button>
      )}

      {!readOnly && selected.size > 0 && (
        <div className="delete-bar done-bar">
          <span>{selected.size} selected</span>
          <button onClick={doneSelected}>{selected.size} Done</button>
        </div>
      )}

      {burst !== null && (
        <StreakBurst
          n={burst}
          line={burstLine}
          rewards={!readOnly ? incomingRewards : null}
          onEnd={() => {
            setBurst(null)
            setBurstLine(null)
          }}
        />
      )}
    </div>
  )
}

/* ---------- a single custom checklist ---------- */
function CustomList({ list, items, refresh, onDeleted, readOnly }) {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')

  const sorted = [...items].sort((a, b) => {
    if ((a.position || 0) !== (b.position || 0)) return (a.position || 0) - (b.position || 0)
    return (a.created_at || '').localeCompare(b.created_at || '')
  })

  async function addItem(e) {
    e.preventDefault()
    const title = text.trim()
    if (!title) return
    setBusy(true)
    const nextPos = sorted.length ? (sorted[sorted.length - 1].position || 0) + 1 : 1
    await supabase.from('list_items').insert([{ list_id: list.id, title, position: nextPos }])
    setText('')
    setBusy(false)
    setAdding(false)
    refresh()
  }

  async function toggleItem(item) {
    if (readOnly) return
    await supabase
      .from('list_items')
      .update({ is_complete: !item.is_complete })
      .eq('id', item.id)
    refresh()
  }

  async function removeItem(id) {
    await supabase.from('list_items').delete().eq('id', id)
    refresh()
  }

  async function moveItem(item, direction) {
    const idx = sorted.findIndex((i) => i.id === item.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const other = sorted[swapIdx]
    await Promise.all([
      supabase.from('list_items').update({ position: other.position || 0 }).eq('id', item.id),
      supabase.from('list_items').update({ position: item.position || 0 }).eq('id', other.id),
    ])
    refresh()
  }

  function startEdit(item) {
    if (readOnly) return
    setEditingId(item.id)
    setEditText(item.title)
  }

  async function saveEdit() {
    const title = editText.trim()
    const id = editingId
    setEditingId(null)
    if (!title || !id) return
    await supabase.from('list_items').update({ title }).eq('id', id)
    refresh()
  }

  async function deleteThisList() {
    await supabase.from('lists').delete().eq('id', list.id)
    refresh()
    onDeleted()
  }

  return (
    <div className="ideas">
      {sorted.length === 0 ? (
        <p className="empty">Nothing on this list yet.</p>
      ) : (
        <ul className="task-list">
          {sorted.map((item, i) => (
            <li key={item.id} className={`task ${item.is_complete ? 'idea-done' : ''}`}>
              <span className="spine" aria-hidden="true" />
              <label className={`task-check${readOnly ? ' read-only' : ''}`}>
                <input
                  type="checkbox"
                  checked={item.is_complete}
                  disabled={readOnly}
                  onChange={() => toggleItem(item)}
                  aria-label={`Mark ${item.title} done`}
                />
                <span className="box" />
              </label>
              <div className="task-body">
                {editingId === item.id ? (
                  <input
                    type="text"
                    className="item-edit-input"
                    value={editText}
                    autoFocus
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                  />
                ) : (
                  <span
                    className="task-title task-title-editable"
                    onClick={() => startEdit(item)}
                  >
                    {item.title}
                  </span>
                )}
              </div>
              {!readOnly && (
                <div className="item-actions">
                  <div className="item-reorder">
                    <button
                      className="item-move"
                      onClick={() => moveItem(item, 'up')}
                      disabled={i === 0}
                      aria-label={`Move ${item.title} up`}
                    >
                      ▲
                    </button>
                    <button
                      className="item-move"
                      onClick={() => moveItem(item, 'down')}
                      disabled={i === sorted.length - 1}
                      aria-label={`Move ${item.title} down`}
                    >
                      ▼
                    </button>
                  </div>
                  <button
                    className="list-remove"
                    onClick={() => removeItem(item.id)}
                    aria-label={`Delete ${item.title}`}
                  >
                    ×
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly &&
        (adding ? (
          <form onSubmit={addItem} className="add-item-row">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add an item..."
              autoFocus
            />
            <button type="submit" className="btn-primary" disabled={busy}>
              Add
            </button>
            <button type="button" className="ghost" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <button className="fab" onClick={() => setAdding(true)} aria-label="Add item">
            +
          </button>
        ))}

      {!readOnly && (
        <div className="list-delete-zone">
          {confirmDelete ? (
            <div className="delete-confirm">
              <p className="setup-note">
                Delete "{list.name}" and everything on it? This can't be undone.
              </p>
              <div className="invite-actions">
                <button className="btn-danger" onClick={deleteThisList}>
                  Yes, delete this list
                </button>
                <button className="btn-outline" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button className="list-delete-btn" onClick={() => setConfirmDelete(true)}>
              Delete this list
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------- Lists screen: Ideas + custom checklists as subtabs ---------- */
function ListsScreen({
  lists,
  listItems,
  refresh,
  myId,
  viewablePeople,
}) {
  const [activeTab, setActiveTab] = useState(null)
  const [creating, setCreating] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [viewingUserId, setViewingUserId] = useState(null) // null = viewing myself
  const [renamingTab, setRenamingTab] = useState(null) // a list id, or null
  const [renameText, setRenameText] = useState('')

  const readOnly = viewingUserId !== null
  const scopedLists = readOnly
    ? lists.filter((l) => l.user_id === viewingUserId)
    : lists.filter((l) => l.user_id === myId)

  const activeList = scopedLists.find((l) => l.id === activeTab) || null

  // a list may have been deleted, or we switched who we're viewing - fall
  // back to whichever list is first (or nothing) once the active one no
  // longer resolves
  useEffect(() => {
    if (activeTab && !scopedLists.some((l) => l.id === activeTab)) {
      setActiveTab(scopedLists[0]?.id || null)
    } else if (!activeTab && scopedLists.length > 0) {
      setActiveTab(scopedLists[0].id)
    }
  }, [activeTab, scopedLists])

  async function createList(e) {
    e.preventDefault()
    const name = newListName.trim()
    if (!name) return
    const { data, error } = await supabase
      .from('lists')
      .insert([{ name, user_id: myId }])
      .select()
    setNewListName('')
    setCreating(false)
    refresh()
    if (!error && data && data[0]) setActiveTab(data[0].id)
  }

  function startRename(tabKey, currentName) {
    setRenamingTab(tabKey)
    setRenameText(currentName)
  }

  async function saveTabRename() {
    const name = renameText.trim()
    const tabKey = renamingTab
    setRenamingTab(null)
    if (!name) return
    const current = scopedLists.find((l) => l.id === tabKey)
    if (current && name === current.name) return
    await supabase.from('lists').update({ name }).eq('id', tabKey)
    refresh()
  }

  const viewingName = readOnly
    ? (viewablePeople.find((p) => p.id === viewingUserId) || {}).name
    : null

  return (
    <div className="tdl">
      {viewablePeople && viewablePeople.length > 0 && (
        <div className="viewer-row">
          <span className={readOnly ? 'readonly-tag' : 'day-streak inline'}>
            {readOnly ? `👁 Viewing ${viewingName}` : 'My lists'}
          </span>
          <select
            className="viewer-select"
            value={viewingUserId || 'me'}
            onChange={(e) => {
              setViewingUserId(e.target.value === 'me' ? null : e.target.value)
              setActiveTab(null)
            }}
          >
            <option value="me">My lists</option>
            {viewablePeople.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}'s lists
              </option>
            ))}
          </select>
        </div>
      )}

      {creating ? (
        <form onSubmit={createList} className="new-list-row">
          <input
            type="text"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="New list name"
            autoFocus
          />
          <button type="submit" className="btn-primary">
            Create
          </button>
          <button type="button" className="ghost" onClick={() => setCreating(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <div className="view-switch lists-switch">
          {scopedLists.map((l) =>
            renamingTab === l.id ? (
              <input
                key={l.id}
                type="text"
                className="tab-rename-input"
                value={renameText}
                autoFocus
                onChange={(e) => setRenameText(e.target.value)}
                onBlur={saveTabRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') setRenamingTab(null)
                }}
              />
            ) : (
              <button
                key={l.id}
                className={activeTab === l.id ? 'active' : ''}
                onClick={() =>
                  activeTab === l.id && !readOnly
                    ? startRename(l.id, l.name)
                    : setActiveTab(l.id)
                }
              >
                {l.name}
              </button>
            )
          )}
          {!readOnly && (
            <button
              className="lists-add-btn"
              onClick={() => setCreating(true)}
              aria-label="New list"
            >
              +
            </button>
          )}
        </div>
      )}

      {activeList ? (
        <CustomList
          key={activeList.id}
          list={activeList}
          items={listItems.filter((it) => it.list_id === activeList.id)}
          refresh={refresh}
          onDeleted={() => setActiveTab(null)}
          readOnly={readOnly}
        />
      ) : (
        <p className="empty">
          {readOnly ? `Nothing here for ${viewingName}.` : 'Add a list with the + button.'}
        </p>
      )}
    </div>
  )
}

/* ---------- recurring screen ---------- */
function Habits({ tasks, taskLoading, refresh, myId, nameFor, people, groups }) {
  const [selected, setSelected] = useState(new Set())
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)

  const recurring = tasks
    .filter((t) => t.repeat_unit)
    .sort((a, b) => {
      const da = recurrenceDays(a.repeat_interval, a.repeat_unit)
      const db = recurrenceDays(b.repeat_interval, b.repeat_unit)
      if (da !== db) return da - db
      return (a.due_date || '').localeCompare(b.due_date || '')
    })

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function deleteSelected() {
    await supabase.from('tasks').delete().in('id', [...selected])
    setSelected(new Set())
    refresh()
  }

  const groupNameFor = (id) => (groups.find((g) => g.id === id) || {}).name

  if (adding)
    return (
      <AddTask
        people={people}
        groups={groups}
        myId={myId}
        presetRecurring
        onCancel={() => setAdding(false)}
        onDone={() => {
          setAdding(false)
          refresh()
        }}
      />
    )

  if (editing)
    return (
      <EditTask
        task={editing}
        people={people}
        groups={groups}
        myId={myId}
        onCancel={() => setEditing(null)}
        onDone={() => {
          setEditing(null)
          refresh()
        }}
      />
    )

  return (
    <div className="tdl">
      {taskLoading ? (
        <p className="empty">Loading...</p>
      ) : recurring.length === 0 ? (
        <p className="empty">No habits yet. Add one with the + button.</p>
      ) : (
        <ul className="task-list">
          {recurring.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              selected={selected.has(t.id)}
              onSelect={toggleSelect}
              timeless={false}
              fromName={
                t.created_by && t.created_by !== myId ? nameFor(t.created_by) : null
              }
              groupName={t.assigned_group_id ? groupNameFor(t.assigned_group_id) : null}
              onEdit={setEditing}
            />
          ))}
        </ul>
      )}

      <button className="fab" onClick={() => setAdding(true)} aria-label="Add habit">
        +
      </button>

      {selected.size > 0 && (
        <div className="delete-bar">
          <span>{selected.size} selected</span>
          <button onClick={deleteSelected}>Delete selected</button>
        </div>
      )}
    </div>
  )
}

/* ---------- setup screen (just name / sign out / delete) ---------- */
function Setup({ profile, myId, refresh, rewardLines, incomingRewards, friends, givenRewards }) {
  const [nameInput, setNameInput] = useState(profile?.name || '')
  const [savingName, setSavingName] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteErr, setDeleteErr] = useState('')
  const [preview, setPreview] = useState(null)
  const [previewFriendId, setPreviewFriendId] = useState('')

  // Preview the clear-the-day celebration on demand, using real current
  // data. Picks a line at random WITHOUT advancing the saved shuffle
  // cursor, so previewing never burns through the real rotation. Can
  // preview as myself, or as any friend (using their real streak and any
  // rewards I've personally set for them).
  function openPreview() {
    const pool = rewardLines || []
    const line = pool.length
      ? pool[Math.floor(Math.random() * pool.length)].text
      : null

    if (!previewFriendId) {
      setPreview({ n: (profile?.clear_streak || 0) + 1, line, rewards: incomingRewards })
      return
    }

    const friend = (friends || []).find((f) => f.id === previewFriendId)
    const rewards = (givenRewards || [])
      .filter((r) => r.recipient_id === previewFriendId)
      .map((r) => ({
        id: r.id,
        target_streak: r.target_streak,
        reward_text: r.reward_text,
        visibility: r.visibility,
        giver_name: profile?.name || 'a friend',
      }))
    setPreview({ n: (friend?.streak || 0) + 1, line, rewards })
  }

  async function saveName() {
    setSavingName(true)
    await supabase.from('profiles').update({ name: nameInput.trim() }).eq('id', myId)
    setSavingName(false)
    refresh()
  }

  async function deleteAccount() {
    setDeleting(true)
    setDeleteErr('')
    const { error } = await supabase.rpc('delete_current_user')
    if (error) {
      setDeleteErr(error.message)
      setDeleting(false)
      return
    }
    try {
      localStorage.removeItem(CACHE_KEY)
    } catch {
      /* ignore */
    }
    await supabase.auth.signOut()
  }

  return (
    <div className="setup">
      <section className="setup-section">
        <span className="section-title">Your name</span>
        <div className="name-row">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Your name"
          />
          <button className="btn-primary" onClick={saveName} disabled={savingName}>
            {savingName ? '...' : 'Save'}
          </button>
        </div>
      </section>

      {profile?.email === 'larsnickolai@gmail.com' && (
        <section className="setup-section">
          <span className="section-title">Preview</span>
          {friends && friends.length > 0 && (
            <select
              className="viewer-select"
              value={previewFriendId}
              onChange={(e) => setPreviewFriendId(e.target.value)}
              style={{ alignSelf: 'flex-start' }}
            >
              <option value="">Preview as me</option>
              {friends.map((f) => (
                <option key={f.id} value={f.id}>
                  Preview as {f.name}
                </option>
              ))}
            </select>
          )}
          <button className="btn-outline" onClick={openPreview}>
            Show celebration screen
          </button>
          <span className="hint">
            Shows what you'll see when you clear your day - safe to open any time,
            it doesn't change your streak or use up a message.
          </span>
        </section>
      )}

      <button className="btn-outline signout" onClick={() => { try { localStorage.removeItem(CACHE_KEY) } catch { /* ignore */ } supabase.auth.signOut() }}>
        Sign out
      </button>

      <section className="setup-section danger">
        {!confirmDelete ? (
          <button className="btn-danger" onClick={() => setConfirmDelete(true)}>
            Delete account
          </button>
        ) : (
          <div className="delete-confirm">
            <p className="setup-note">
              This permanently deletes your account and all your tasks, lists, and
              groups you own. This can't be undone.
            </p>
            {deleteErr && <p className="auth-msg">{deleteErr}</p>}
            <div className="invite-actions">
              <button
                className="btn-danger"
                onClick={deleteAccount}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Yes, delete everything'}
              </button>
              <button
                className="btn-outline"
                onClick={() => {
                  setConfirmDelete(false)
                  setDeleteErr('')
                }}
                disabled={deleting}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {preview && (
        <StreakBurst
          n={preview.n}
          line={preview.line}
          rewards={preview.rewards}
          onEnd={() => setPreview(null)}
        />
      )}
    </div>
  )
}

/* ---------- social screen: Groups + Friends subtabs ---------- */
function Social({
  groups,
  members,
  invites,
  myId,
  refresh,
  friends,
  friendInvites,
  givenRewards,
  incomingRewards,
}) {
  const [tab, setTab] = useState('friends')
  const [newGroup, setNewGroup] = useState('')
  const [inviteEmail, setInviteEmail] = useState({})
  const [note, setNote] = useState('')
  const [friendEmail, setFriendEmail] = useState('')
  const [friendNote, setFriendNote] = useState('')
  const [rewardStreak, setRewardStreak] = useState(7)
  const [rewardText, setRewardText] = useState('')
  const [rewardVisibility, setRewardVisibility] = useState('secret')
  const [expandedGroupId, setExpandedGroupId] = useState(null)
  const [selectedFriendId, setSelectedFriendId] = useState(null)
  const [confirmRemoveFriend, setConfirmRemoveFriend] = useState(false)
  const [creatingReward, setCreatingReward] = useState(false)

  async function createGroup(e) {
    e.preventDefault()
    const gname = newGroup.trim()
    if (!gname) return
    const { data, error } = await supabase
      .from('groups')
      .insert([{ name: gname }])
      .select()
    if (!error && data && data[0]) {
      await supabase
        .from('group_members')
        .insert([{ group_id: data[0].id, user_id: myId }])
    }
    setNewGroup('')
    refresh()
  }

  async function sendInvite(group) {
    const mail = (inviteEmail[group.id] || '').trim().toLowerCase()
    if (!mail) return
    const { error } = await supabase.from('group_invites').insert([
      { group_id: group.id, group_name: group.name, invited_email: mail },
    ])
    setInviteEmail({ ...inviteEmail, [group.id]: '' })
    setNote(error ? error.message : `Invite sent to ${mail}`)
    setTimeout(() => setNote(''), 2500)
  }

  async function acceptInvite(inv) {
    await supabase
      .from('group_members')
      .insert([{ group_id: inv.group_id, user_id: myId }])
    await supabase
      .from('group_invites')
      .update({ status: 'accepted' })
      .eq('id', inv.id)
    refresh()
  }

  async function declineInvite(inv) {
    await supabase
      .from('group_invites')
      .update({ status: 'declined' })
      .eq('id', inv.id)
    refresh()
  }

  const membersOf = (gid) => members.filter((m) => m.group_id === gid)
  const myRowIn = (gid) => members.find((m) => m.group_id === gid && m.user_id === myId)

  async function toggleShareTasks(gid, next) {
    await supabase
      .from('group_members')
      .update({ share_tasks: next })
      .eq('group_id', gid)
      .eq('user_id', myId)
    refresh()
  }

  async function inviteFriend(e) {
    e.preventDefault()
    const mail = friendEmail.trim().toLowerCase()
    if (!mail) return
    const { error } = await supabase.from('friend_invites').insert([
      { invited_email: mail },
    ])
    setFriendEmail('')
    setFriendNote(error ? error.message : `Invite sent to ${mail}`)
    setTimeout(() => setFriendNote(''), 2500)
  }

  async function acceptFriendInvite(invite) {
    await supabase
      .from('friendships')
      .insert([{ user_a: invite.invited_by, user_b: myId }])
    await supabase
      .from('friend_invites')
      .update({ status: 'accepted' })
      .eq('id', invite.id)
    refresh()
  }

  async function declineFriendInvite(invite) {
    await supabase
      .from('friend_invites')
      .update({ status: 'declined' })
      .eq('id', invite.id)
    refresh()
  }

  async function removeFriend(friendshipId) {
    await supabase.from('friendships').delete().eq('id', friendshipId)
    setSelectedFriendId(null)
    setConfirmRemoveFriend(false)
    refresh()
  }

  async function createReward(e) {
    e.preventDefault()
    const text = rewardText.trim()
    if (!selectedFriendId || !text || !rewardStreak) return
    await supabase.from('streak_rewards').insert([
      {
        recipient_id: selectedFriendId,
        target_streak: Math.max(1, Number(rewardStreak) || 1),
        reward_text: text,
        visibility: rewardVisibility,
      },
    ])
    setRewardText('')
    setRewardStreak(7)
    setRewardVisibility('secret')
    setCreatingReward(false)
    refresh()
  }

  async function deleteReward(id) {
    await supabase.from('streak_rewards').delete().eq('id', id)
    refresh()
  }

  const selectedFriend = selectedFriendId
    ? friends.find((f) => f.id === selectedFriendId)
    : null
  const myRewardsForFriend = selectedFriendId
    ? givenRewards.filter((r) => r.recipient_id === selectedFriendId)
    : []
  const friendRewardsForMe = selectedFriendId
    ? incomingRewards.filter((r) => r.giver_id === selectedFriendId)
    : []

  if (creatingReward && selectedFriend)
    return (
      <div className="add-screen">
        <div className="add-head">
          <button className="ghost" onClick={() => setCreatingReward(false)}>
            ← Back
          </button>
          <h2>New reward for {selectedFriend.name}</h2>
        </div>

        <form onSubmit={createReward} className="add-form">
          <div className="reward-form-row">
            <span>At</span>
            <input
              type="number"
              min="1"
              className="repeat-num"
              value={rewardStreak}
              onChange={(e) => setRewardStreak(e.target.value)}
            />
            <span>day streak, give</span>
          </div>
          <label>
            Reward
            <input
              type="text"
              placeholder="What's the reward?"
              value={rewardText}
              onChange={(e) => setRewardText(e.target.value)}
              autoFocus
              required
            />
          </label>
          <div className="prio-picker">
            {[
              { value: 'secret', label: 'Secret' },
              { value: 'semi', label: 'Semi-secret' },
              { value: 'visible', label: 'Visible' },
            ].map((v) => (
              <button
                type="button"
                key={v.value}
                className={rewardVisibility === v.value ? 'active' : ''}
                onClick={() => setRewardVisibility(v.value)}
              >
                {v.label}
              </button>
            ))}
          </div>
          <span className="hint">
            {rewardVisibility === 'secret'
              ? "They won't know this reward exists at all"
              : rewardVisibility === 'semi'
              ? "Shows a countdown but not the reward"
              : "Shows the countdown and what the reward is."}
          </span>
          <div className="add-actions">
            <button
              type="button"
              className="ghost"
              onClick={() => setCreatingReward(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Set reward
            </button>
          </div>
        </form>
      </div>
    )

  return (
    <div className="setup">
      <div className="view-switch" style={{ marginBottom: '22px' }}>
        <button className={tab === 'friends' ? 'active' : ''} onClick={() => setTab('friends')}>
          Friends
        </button>
        <button className={tab === 'groups' ? 'active' : ''} onClick={() => setTab('groups')}>
          Groups
        </button>
      </div>

      {tab === 'groups' ? (
        <>
          {invites.length > 0 && (
            <section className="setup-section">
              <span className="section-title">Invites</span>
              {invites.map((inv) => (
                <div key={inv.id} className="invite-card">
                  <span>
                    Join <strong>{inv.group_name}</strong>
                  </span>
                  <div className="invite-actions">
                    <button className="btn-primary" onClick={() => acceptInvite(inv)}>
                      Accept
                    </button>
                    <button className="btn-outline" onClick={() => declineInvite(inv)}>
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className="setup-section">
            {groups.length === 0 && (
              <p className="setup-note">No groups yet. Create one below.</p>
            )}
            {groups.map((g) => {
              const owner = g.owner_id === myId
              const open = expandedGroupId === g.id
              return (
                <div key={g.id} className={`group-card${open ? ' open' : ''}`}>
                  <button
                    className="group-head group-head-btn"
                    onClick={() => setExpandedGroupId(open ? null : g.id)}
                    aria-expanded={open}
                  >
                    <span className="group-head-left">
                      <strong>{g.name}</strong>
                      <span className={owner ? 'owner-tag' : 'member-tag'}>
                        {owner ? 'owner' : 'member'}
                      </span>
                    </span>
                    <span className="group-caret">{open ? '▾' : '▸'}</span>
                  </button>
                  {open && (
                    <div className="group-body">
                      <div className="member-chips">
                        {membersOf(g.id).map((m) => (
                          <span key={m.user_id} className="chip">
                            {m.user_id === myId ? 'You' : m.name || m.user_id.slice(0, 6)}
                          </span>
                        ))}
                      </div>
                      <label className="switch-row share-row">
                        <input
                          type="checkbox"
                          checked={!!myRowIn(g.id)?.share_tasks}
                          onChange={(e) => toggleShareTasks(g.id, e.target.checked)}
                        />
                        <span>Let this group view my tasks and lists (read-only)</span>
                      </label>
                      {owner && (
                        <div className="invite-row">
                          <input
                            type="email"
                            placeholder="Invite by email"
                            value={inviteEmail[g.id] || ''}
                            onChange={(e) =>
                              setInviteEmail({ ...inviteEmail, [g.id]: e.target.value })
                            }
                          />
                          <button className="btn-outline" onClick={() => sendInvite(g)}>
                            Invite
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            <form onSubmit={createGroup} className="new-group-row">
              <input
                type="text"
                placeholder="New group name"
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
              />
              <button type="submit" className="btn-primary">
                Create
              </button>
            </form>
            {note && <p className="setup-note">{note}</p>}
          </section>
        </>
      ) : (
        <>
          {selectedFriend ? (
            <section className="setup-section">
              <button className="ghost friend-back" onClick={() => setSelectedFriendId(null)}>
                ← Back
              </button>
              <div className="friend-name-row">
                <h3 className="friend-detail-name">{selectedFriend.name}</h3>
                <button
                  className="reward-add-btn"
                  onClick={() => setCreatingReward(true)}
                  aria-label="Add a reward"
                >
                  +
                </button>
              </div>

              <span className="section-title">Your rewards for {selectedFriend.name}</span>

              {myRewardsForFriend.length === 0 && (
                <p className="setup-note">No rewards set yet.</p>
              )}

              {myRewardsForFriend.map((r) => (
                <div key={r.id} className="reward-card given">
                  <div className="reward-given-top">
                    <span>At {r.target_streak}-day streak</span>
                    <button
                      className="list-remove"
                      onClick={() => deleteReward(r.id)}
                      aria-label="Delete reward"
                    >
                      ×
                    </button>
                  </div>
                  <span className="reward-given-detail">
                    {r.current_streak}/{r.target_streak} days
                    {r.reached ? ' reached!' : ''} ·{' '}
                    {r.visibility === 'secret'
                      ? 'secret'
                      : r.visibility === 'semi'
                      ? 'semi-secret'
                      : 'visible'}{' '}
                    · {r.reward_text}
                  </span>
                </div>
              ))}


              {friendRewardsForMe.length > 0 && (
                <>
                  <span className="section-title">{selectedFriend.name}'s rewards for you</span>
                  {friendRewardsForMe.map((r) => (
                    <div key={r.id} className="reward-card">
                      {r.reached ? (
                        r.visibility === 'visible' ? (
                          <span>
                            🎁 You earned <strong>{r.reward_text}</strong> from{' '}
                            {selectedFriend.name}!
                          </span>
                        ) : (
                          <span>🎁 You earned a reward from {selectedFriend.name}!</span>
                        )
                      ) : r.visibility === 'visible' ? (
                        <span>
                          {r.days_remaining} more day
                          {r.days_remaining === 1 ? '' : 's'} to receive{' '}
                          <strong>{r.reward_text}</strong> from {selectedFriend.name}
                        </span>
                      ) : (
                        <span>
                          {r.days_remaining} more day
                          {r.days_remaining === 1 ? '' : 's'} to get a reward from{' '}
                          {selectedFriend.name}
                        </span>
                      )}
                    </div>
                  ))}
                </>
              )}

              <div className="list-delete-zone">
                {confirmRemoveFriend ? (
                  <div className="delete-confirm">
                    <p className="setup-note">
                      Remove {selectedFriend.name} as a friend?
                    </p>
                    <div className="invite-actions">
                      <button
                        className="btn-danger"
                        onClick={() =>
                          removeFriend(selectedFriend.friendshipId || selectedFriend.id)
                        }
                      >
                        Yes, remove
                      </button>
                      <button
                        className="btn-outline"
                        onClick={() => setConfirmRemoveFriend(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="list-delete-btn"
                    onClick={() => setConfirmRemoveFriend(true)}
                  >
                    Remove friend
                  </button>
                )}
              </div>
            </section>
          ) : (
            <section className="setup-section">
              {friendInvites.length > 0 && (
                <div className="friend-invites">
                  {friendInvites.map((inv) => (
                    <div key={inv.id} className="invite-card">
                      <span>Friend request pending</span>
                      <div className="invite-actions">
                        <button className="btn-primary" onClick={() => acceptFriendInvite(inv)}>
                          Accept
                        </button>
                        <button className="btn-outline" onClick={() => declineFriendInvite(inv)}>
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {friends.length === 0 ? (
                <p className="setup-note">No friends yet. Invite someone below.</p>
              ) : (
                <div className="friend-list">
                  {friends.map((f) => (
                    <button
                      key={f.id}
                      className="friend-btn"
                      onClick={() => setSelectedFriendId(f.id)}
                    >
                      <span>{f.name}</span>
                      <span className="friend-btn-streak">🔥 {f.streak}</span>
                    </button>
                  ))}
                </div>
              )}

              <form onSubmit={inviteFriend} className="invite-row">
                <input
                  type="email"
                  placeholder="Invite by email"
                  value={friendEmail}
                  onChange={(e) => setFriendEmail(e.target.value)}
                />
                <button type="submit" className="btn-outline">
                  Invite
                </button>
              </form>
              {friendNote && <p className="setup-note">{friendNote}</p>}
            </section>
          )}
        </>
      )}
    </div>
  )
}

/* ---------- Setup screen wrapper: Settings + Habits subtabs ---------- */
/* ---------- local cache so the app paints instantly on open ---------- */
const CACHE_KEY = 'tdl_cache_v1'
function loadCache(uid) {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const c = JSON.parse(raw)
    return c && c.uid === uid ? c : null
  } catch {
    return null
  }
}
function saveCache(uid, data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ uid, ...data }))
  } catch {
    /* storage full or unavailable - cache is best effort */
  }
}

/* ---------- shell ---------- */
function Shell({ session }) {
  const myId = session.user.id
  const myEmail = (session.user.email || '').toLowerCase()
  const cached = useRef(loadCache(myId)).current

  const [screen, setScreen] = useState('tdl')
  const [setupMenuOpen, setSetupMenuOpen] = useState(false)
  const setupMenuRef = useRef(null)
  const [tasks, setTasks] = useState(cached?.tasks || [])
  const [lists, setLists] = useState(cached?.lists || [])
  const [listItems, setListItems] = useState(cached?.listItems || [])
  const [rewardLines, setRewardLines] = useState(cached?.rewardLines || [])
  const [profile, setProfile] = useState(cached?.profile || null)
  const [groups, setGroups] = useState(cached?.groups || [])
  const [members, setMembers] = useState(cached?.members || [])
  const [invites, setInvites] = useState(cached?.invites || [])
  const [friends, setFriends] = useState(cached?.friends || [])
  const [friendInvites, setFriendInvites] = useState(cached?.friendInvites || [])
  const [givenRewards, setGivenRewards] = useState(cached?.givenRewards || [])
  const [incomingRewards, setIncomingRewards] = useState(cached?.incomingRewards || [])
  // only block the UI when we have nothing at all to show
  const [loading, setLoading] = useState(!cached)
  const rolledRef = useRef(false)
  const lastFetchRef = useRef(0)
  // keep session in a ref so token refreshes don't re-create refresh()
  const sessionRef = useRef(session)
  sessionRef.current = session

  // A recurring occurrence whose date has PASSED (strictly before today)
  // without being marked Done is a miss: spawn the next occurrence (habit
  // streak resets to 0) and leave the old one as a plain overdue task.
  // Occurrences due exactly today are left alone — they can still be Done today.
  const rollRecurring = useCallback(async (taskList) => {
    const t0 = today()
    const due = taskList.filter(
      (t) => t.repeat_unit && t.due_date && t.due_date < t0
    )
    if (!due.length) return false
    for (const t of due) {
      const anchor = t.repeat_anchor || Number(t.due_date.slice(8, 10))
      const next = slotOnOrAfter(t.due_date, t.repeat_interval, t.repeat_unit, anchor, t0)
      const habit = isHabit(t)
      await supabase.from('tasks').insert([
        {
          title: t.title,
          due_date: next,
          due_time: t.due_time,
          duration: t.duration,
          repeat_interval: t.repeat_interval,
          repeat_unit: t.repeat_unit,
          repeat_anchor: anchor,
          streak: habit ? 0 : null,
          reward: t.reward,
          user_id: t.user_id,
          assigned_group_id: t.assigned_group_id,
          created_by: t.created_by,
        },
      ])
      // current occurrence hands off the baton and becomes a plain task
      await supabase
        .from('tasks')
        .update({ repeat_unit: null, repeat_interval: null, streak: null })
        .eq('id', t.id)
    }
    return true
  }, [])

  const refresh = useCallback(async () => {
    lastFetchRef.current = Date.now()

    // Fire every read at once instead of waiting for them in sequence.
    const [
      profRes,
      taskRes,
      groupRes,
      memberRes,
      inviteRes,
      listRes,
      listItemRes,
      rewardRes,
      friendshipRes,
      friendInviteRes,
      givenRewardRes,
      incomingRewardRes,
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', myId).maybeSingle(),
      supabase.from('tasks').select('*'),
      supabase.from('groups').select('*'),
      supabase.from('group_members').select('*'),
      supabase.from('group_invites').select('*').eq('status', 'pending'),
      supabase.from('lists').select('*'),
      supabase.from('list_items').select('*'),
      supabase.from('reward_lines').select('*'),
      supabase.from('friendships').select('*'),
      supabase.from('friend_invites').select('*').eq('status', 'pending'),
      supabase.rpc('my_given_rewards'),
      supabase.rpc('my_incoming_rewards'),
    ])

    let prof = profRes.data
    let taskData = taskRes.data || []

    // paint what we have right away; the rest is cheap follow-up work
    setTasks(taskData)
    setLists(listRes.data || [])
    setListItems(listItemRes.data || [])
    setRewardLines(rewardRes.data || [])
    setGroups(groupRes.data || [])
    setInvites((inviteRes.data || []).filter((i) => i.invited_email === myEmail))
    setFriendInvites(
      (friendInviteRes.data || []).filter((i) => i.invited_email === myEmail)
    )
    setGivenRewards(givenRewardRes.data || [])
    setIncomingRewards(incomingRewardRes.data || [])
    if (prof) setProfile(prof)
    setLoading(false)

    // first login: create the profile row if it is missing
    if (!prof) {
      const meta = sessionRef.current.user.user_metadata || {}
      await supabase
        .from('profiles')
        .upsert({ id: myId, email: myEmail, name: meta.name || '' })
      const r = await supabase
        .from('profiles')
        .select('*')
        .eq('id', myId)
        .maybeSingle()
      prof = r.data
      setProfile(prof)
    }

    // resolve groupmate names (only if this user is actually in a group)
    const memberData = memberRes.data || []
    const memberIds = [...new Set(memberData.map((m) => m.user_id))]
    let membersWithNames = memberData
    if (memberIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id,name,email')
        .in('id', memberIds)
      const profMap = {}
      ;(profs || []).forEach((x) => (profMap[x.id] = x))
      membersWithNames = memberData.map((m) => ({
        ...m,
        name: profMap[m.user_id]?.name,
      }))
    }
    setMembers(membersWithNames)

    // resolve friend names (are_friends now permits reading their profile)
    const friendshipData = friendshipRes.data || []
    const friendPairs = friendshipData.map((f) => ({
      friendshipId: f.id,
      userId: f.user_a === myId ? f.user_b : f.user_a,
    }))
    const friendIds = friendPairs.map((f) => f.userId)
    let friendsWithNames = []
    if (friendIds.length) {
      const { data: fprofs } = await supabase
        .from('profiles')
        .select('id,name,email,clear_streak')
        .in('id', friendIds)
      const fmap = {}
      ;(fprofs || []).forEach((x) => (fmap[x.id] = x))
      friendsWithNames = friendPairs.map((f) => ({
        id: f.userId,
        friendshipId: f.friendshipId,
        name: fmap[f.userId]?.name || 'Friend',
        streak: fmap[f.userId]?.clear_streak || 0,
      }))
    }
    setFriends(friendsWithNames)

    // roll any missed recurring occurrences forward (once per app session).
    // Scoped to tasks I can actually write to - shared-in tasks from
    // someone else roll forward under their own session, not mine.
    if (!rolledRef.current) {
      rolledRef.current = true
      const myWritableTasks = taskData.filter(
        (t) => t.user_id === myId || t.assigned_group_id
      )
      const rolled = await rollRecurring(myWritableTasks)
      if (rolled) {
        const r = await supabase.from('tasks').select('*')
        taskData = r.data || []
        setTasks(taskData)
      }
    }

    // Streak-token mechanic: catch up on any fully-missed calendar days
    // since we last checked. streak_checked_through marks the last date
    // whose status (cleared or missed) has already been applied - it's
    // separate from clear_last (which only means "the day the list was
    // actually cleared") so this never re-penalizes the same gap twice.
    const t0 = today()
    const checkedThrough = prof?.streak_checked_through || prof?.clear_last || null
    const yesterday = shiftDays(t0, -1)
    if (prof && checkedThrough && checkedThrough < yesterday) {
      const missedDays = daysBetween(checkedThrough, t0) - 1
      let streak = prof.clear_streak || 0
      let tokens = prof.streak_tokens || 0
      // token_progress is untouched here on purpose - it only ever
      // advances on a cleared day, and simply pauses on a missed one
      for (let i = 0; i < missedDays; i++) {
        if (tokens > 0) {
          tokens -= 1
          streak = Math.max(streak - 1, 0)
        } else {
          streak = 0
        }
      }
      await supabase
        .from('profiles')
        .update({
          clear_streak: streak,
          streak_tokens: tokens,
          streak_checked_through: yesterday,
        })
        .eq('id', myId)
      prof = {
        ...prof,
        clear_streak: streak,
        streak_tokens: tokens,
        streak_checked_through: yesterday,
      }
      setProfile(prof)
    }

    saveCache(myId, {
      tasks: taskData,
      lists: listRes.data || [],
      listItems: listItemRes.data || [],
      rewardLines: rewardRes.data || [],
      groups: groupRes.data || [],
      members: membersWithNames,
      invites: (inviteRes.data || []).filter((i) => i.invited_email === myEmail),
      friends: friendsWithNames,
      friendInvites: (friendInviteRes.data || []).filter((i) => i.invited_email === myEmail),
      givenRewards: givenRewardRes.data || [],
      incomingRewards: incomingRewardRes.data || [],
      profile: prof,
    })
  }, [myId, myEmail, rollRecurring])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Refetch when the app comes back to the foreground, but only if the data
  // is actually stale - stops a quick minimise/reopen from reloading anything.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastFetchRef.current < 60000) return
      refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  // close the Setup dropdown when clicking anywhere outside it
  useEffect(() => {
    if (!setupMenuOpen) return
    const onClick = (e) => {
      if (setupMenuRef.current && !setupMenuRef.current.contains(e.target)) {
        setSetupMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [setupMenuOpen])

  const peopleMap = {}
  peopleMap[myId] = { id: myId, name: profile?.name || 'Me' }
  members.forEach((m) => {
    if (!peopleMap[m.user_id])
      peopleMap[m.user_id] = { id: m.user_id, name: m.name || 'Member' }
  })
  const people = Object.values(peopleMap)
  const nameFor = (id) => peopleMap[id]?.name || 'someone'

  // people who've opted, in some shared group, to let me view their tasks
  const viewableMap = {}
  members.forEach((m) => {
    if (m.share_tasks && m.user_id !== myId && !viewableMap[m.user_id]) {
      viewableMap[m.user_id] = { id: m.user_id, name: m.name || 'Member' }
    }
  })
  const viewablePeople = Object.values(viewableMap)

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand small">
          <span className="brand-mark">/</span>list
        </div>
        <nav className="screen-tabs">
          <button
            className={screen === 'tdl' ? 'active' : ''}
            onClick={() => setScreen('tdl')}
          >
            TDL
          </button>
          <button
            className={screen === 'ideas' ? 'active' : ''}
            onClick={() => setScreen('ideas')}
          >
            Lists
          </button>
          <button
            className={screen === 'social' ? 'active' : ''}
            onClick={() => setScreen('social')}
          >
            Social
          </button>
          <div className="nav-dropdown" ref={setupMenuRef}>
            <button
              className={`nav-gear-btn${screen === 'setup' || screen === 'habits' ? ' active' : ''}`}
              onClick={() => setSetupMenuOpen((o) => !o)}
              aria-label="Setup menu"
            >
              <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true">
                <line x1="4" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="9" cy="6" r="2.2" fill="currentColor" />
                <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="16" cy="12" r="2.2" fill="currentColor" />
                <line x1="4" y1="18" x2="20" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="11" cy="18" r="2.2" fill="currentColor" />
              </svg>
            </button>
            {setupMenuOpen && (
              <div className="nav-dropdown-menu">
                <button
                  onClick={() => {
                    setScreen('setup')
                    setSetupMenuOpen(false)
                  }}
                >
                  Account
                </button>
                <button
                  onClick={() => {
                    setScreen('habits')
                    setSetupMenuOpen(false)
                  }}
                >
                  Habits
                </button>
              </div>
            )}
          </div>
        </nav>
      </header>

      <main>
        {screen === 'tdl' && (
          <Tdl
            tasks={tasks}
            loading={loading}
            refresh={refresh}
            people={people}
            groups={groups}
            myId={myId}
            nameFor={nameFor}
            profile={profile}
            viewablePeople={viewablePeople}
            rewardLines={rewardLines}
            incomingRewards={incomingRewards}
          />
        )}
        {screen === 'ideas' && (
          <ListsScreen
            lists={lists}
            listItems={listItems}
            refresh={refresh}
            myId={myId}
            viewablePeople={viewablePeople}
          />
        )}
        {screen === 'social' && (
          <Social
            groups={groups}
            members={members}
            invites={invites}
            myId={myId}
            refresh={refresh}
            friends={friends}
            friendInvites={friendInvites}
            givenRewards={givenRewards}
            incomingRewards={incomingRewards}
          />
        )}
        {screen === 'setup' && (
          <Setup
            profile={profile}
            myId={myId}
            refresh={refresh}
            rewardLines={rewardLines}
            incomingRewards={incomingRewards}
            friends={friends}
            givenRewards={givenRewards}
          />
        )}
        {screen === 'habits' && (
          <Habits
            tasks={tasks}
            taskLoading={loading}
            refresh={refresh}
            myId={myId}
            nameFor={nameFor}
            people={people}
            groups={groups}
          />
        )}
      </main>
    </div>
  )
}

/* ---------- root ---------- */
export default function App() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) return null
  if (recovery) return <ResetPassword onDone={() => setRecovery(false)} />
  if (!session) return <Login />
  return <Shell session={session} />
}
