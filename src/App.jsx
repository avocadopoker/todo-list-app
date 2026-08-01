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

const VIEWS = [
  { key: 'today', label: 'Today' },
  { key: 'next7', label: '7 Days' },
  { key: 'next30', label: '30 Days' },
  { key: 'all', label: 'All' },
]

function filterForView(tasks, view) {
  const t0 = today()
  if (view === 'today') return tasks.filter((x) => x.due_date && x.due_date <= t0)
  if (view === 'next7') {
    const end = shiftDays(t0, 6)
    return tasks.filter((x) => x.due_date && x.due_date >= t0 && x.due_date <= end)
  }
  if (view === 'next30') {
    const end = shiftDays(t0, 29)
    return tasks.filter((x) => x.due_date && x.due_date >= t0 && x.due_date <= end)
  }
  if (view === 'all') return tasks.filter((x) => x.due_date)
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
function sortTasks(list) {
  return [...list].sort((a, b) => {
    if ((a.due_date || '') !== (b.due_date || ''))
      return (a.due_date || '').localeCompare(b.due_date || '')
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
function TaskRow({ task, selected, onSelect, timeless, fromName }) {
  const overdue = task.due_date && task.due_date < today()
  const overdueDays = overdue ? daysBetween(task.due_date, today()) : 0
  return (
    <li className={`task ${selected ? 'is-selected' : ''}`}>
      <span className="spine" aria-hidden="true" />
      <label className="task-check">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect(task.id)}
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
          {timeless && <span className="timeless-tag">timeless pick</span>}
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
    </li>
  )
}

/* ---------- add task ---------- */
function AddTask({ onDone, onCancel, people, myId }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [recurring, setRecurring] = useState(false)
  const [repeatInterval, setRepeatInterval] = useState(1)
  const [repeatUnit, setRepeatUnit] = useState('week')
  const [assignee, setAssignee] = useState(myId)
  const [reward, setReward] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const showAssign = people && people.length > 1
  const assigningToOther = assignee !== myId

  async function save(e) {
    e.preventDefault()
    const name = title.trim()
    if (!name) return
    setBusy(true)
    setErr('')
    const due = recurring ? date || today() : date || null
    const { error } = await supabase.from('tasks').insert([
      {
        title: name,
        due_date: due,
        repeat_interval: recurring ? Math.max(1, Number(repeatInterval) || 1) : null,
        repeat_unit: recurring ? repeatUnit : null,
        repeat_anchor: recurring && due ? Number(due.slice(8, 10)) : null,
        reward: assigningToOther && reward.trim() ? reward.trim() : null,
        user_id: assignee,
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
        <h2>New task</h2>
      </div>

      <form onSubmit={save} className="add-form">
        <label>
          Name
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            autoFocus
            required
          />
        </label>

        {showAssign && (
          <label>
            Task for
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === myId ? `${p.name || 'Me'} (me)` : p.name}
                </option>
              ))}
            </select>
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

        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <span className="hint">
            Leave empty for a timeless task - no deadline, surfaced over time.
          </span>
        </label>

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
function StreakBurst({ n, onEnd }) {
  useEffect(() => {
    const t = setTimeout(onEnd, 2600)
    return () => clearTimeout(t)
  }, [onEnd])
  return (
    <div className="streak-overlay" onClick={onEnd}>
      <div className="streak-pop">
        <div className="burst" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} style={{ '--i': i }} />
          ))}
        </div>
        <div className="streak-num">🔥 {n}</div>
        <div className="streak-caption">day streak!</div>
      </div>
    </div>
  )
}

/* ---------- TDL screen ---------- */
function Tdl({ tasks, loading, refresh, people, myId, nameFor, profile }) {
  const [view, setView] = useState('today')
  const [selected, setSelected] = useState(new Set())
  const [adding, setAdding] = useState(false)
  const [burst, setBurst] = useState(null)

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
    const chosen = tasks.filter((t) => selected.has(t.id))

    // required Today items (dated <= today) that are NOT being cleared now
    const requiredToday = tasks.filter((t) => t.due_date && t.due_date <= t0)
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
            repeat_interval: t.repeat_interval,
            repeat_unit: t.repeat_unit,
            repeat_anchor: anchor,
            streak: nextStreak,
            reward: t.reward,
            user_id: t.user_id,
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
        await supabase
          .from('profiles')
          .update({ clear_streak: newStreak, clear_last: t0 })
          .eq('id', myId)
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
        myId={myId}
        onCancel={() => setAdding(false)}
        onDone={() => {
          setAdding(false)
          refresh()
        }}
      />
    )

  let visible = sortTasks(filterForView(tasks, view))

  let timelessPick = null
  if (view === 'today') {
    const timeless = tasks.filter((t) => !t.due_date)
    if (timeless.length) {
      timelessPick = timeless[dailySeed() % timeless.length]
      if (!visible.some((v) => v.id === timelessPick.id))
        visible = [timelessPick, ...visible]
    }
  }

  const grouped = view === 'next7' || view === 'next30'
  const groups = grouped
    ? groupByDay(visible, view === 'next7' ? weekdayLabel : fullDayLabel)
    : null

  const renderRow = (t) => (
    <TaskRow
      key={t.id}
      task={t}
      selected={selected.has(t.id)}
      onSelect={toggleSelect}
      timeless={timelessPick && t.id === timelessPick.id && !t.due_date}
      fromName={t.created_by && t.created_by !== myId ? nameFor(t.created_by) : null}
    />
  )

  return (
    <div className="tdl">
      {view === 'today' && profile && profile.clear_streak > 0 && (
        <div className="day-streak">🔥 {profile.clear_streak} day streak</div>
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

      {loading ? (
        <p className="empty">Loading...</p>
      ) : visible.length === 0 ? (
        <p className="empty">Nothing here. Add something with the + button.</p>
      ) : grouped ? (
        <div className="day-groups">
          {groups.map((g) => (
            <div key={g.date} className="day-group">
              <div className="day-sep">{g.label}</div>
              <ul className="task-list">{g.tasks.map(renderRow)}</ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="task-list">{visible.map(renderRow)}</ul>
      )}

      <button className="fab" onClick={() => setAdding(true)} aria-label="Add task">
        +
      </button>

      {selected.size > 0 && (
        <div className="delete-bar done-bar">
          <span>{selected.size} selected</span>
          <button onClick={doneSelected}>{selected.size} Done</button>
        </div>
      )}

      {burst !== null && <StreakBurst n={burst} onEnd={() => setBurst(null)} />}
    </div>
  )
}

/* ---------- ideas screen ---------- */
function Ideas({ ideas, loading, refresh, groups, myId, nameFor }) {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [target, setTarget] = useState('me')
  const [selected, setSelected] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function save(e) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setBusy(true)
    setErr('')
    const { error } = await supabase.from('ideas').insert([
      {
        title: body,
        group_id: target === 'me' ? null : target,
        user_id: myId,
      },
    ])
    setBusy(false)
    if (error) setErr(error.message)
    else {
      setText('')
      setTarget('me')
      setAdding(false)
      refresh()
    }
  }

  async function deleteSelected() {
    await supabase.from('ideas').delete().in('id', [...selected])
    setSelected(new Set())
    refresh()
  }

  if (adding)
    return (
      <div className="add-screen">
        <div className="add-head">
          <button className="ghost" onClick={() => setAdding(false)}>
            ← Back
          </button>
          <h2>New idea</h2>
        </div>
        <form onSubmit={save} className="add-form">
          <label>
            Idea
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Something you don't want to forget"
              autoFocus
              required
            />
          </label>

          {groups.length > 0 && (
            <label>
              Idea for
              <select value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="me">Just me</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} (shared)
                  </option>
                ))}
              </select>
              <span className="hint">
                Group ideas are visible to everyone in that group.
              </span>
            </label>
          )}

          {err && <p className="auth-msg">{err}</p>}

          <div className="add-actions">
            <button type="button" className="ghost" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Saving...' : 'Add idea'}
            </button>
          </div>
        </form>
      </div>
    )

  const groupName = (gid) => (groups.find((g) => g.id === gid) || {}).name

  return (
    <div className="ideas">
      {loading ? (
        <p className="empty">Loading...</p>
      ) : ideas.length === 0 ? (
        <p className="empty">No ideas yet. Add one with the + button.</p>
      ) : (
        <ul className="task-list">
          {ideas.map((i) => (
            <li
              key={i.id}
              className={`task idea ${selected.has(i.id) ? 'is-selected' : ''}`}
            >
              <span className="spine" aria-hidden="true" />
              <label className="task-check">
                <input
                  type="checkbox"
                  checked={selected.has(i.id)}
                  onChange={() => toggleSelect(i.id)}
                  aria-label={`Select ${i.title}`}
                />
                <span className="box" />
              </label>
              <div className="task-body">
                <span className="task-title">{i.title}</span>
                <span className="task-meta">
                  {i.group_id && (
                    <span className="group-tag">{groupName(i.group_id)}</span>
                  )}
                  {i.user_id !== myId && (
                    <span className="from-tag">from {nameFor(i.user_id)}</span>
                  )}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button className="fab" onClick={() => setAdding(true)} aria-label="Add idea">
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

/* ---------- recurring screen ---------- */
function Recurring({ tasks, loading, refresh, myId, nameFor }) {
  const [selected, setSelected] = useState(new Set())

  const recurring = tasks
    .filter((t) => t.repeat_unit)
    .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))

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

  return (
    <div className="tdl">
      <p className="section-title" style={{ marginBottom: '16px' }}>
        All recurring tasks
      </p>
      {loading ? (
        <p className="empty">Loading...</p>
      ) : recurring.length === 0 ? (
        <p className="empty">No recurring tasks yet.</p>
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
            />
          ))}
        </ul>
      )}

      {selected.size > 0 && (
        <div className="delete-bar">
          <span>{selected.size} selected</span>
          <button onClick={deleteSelected}>Delete selected</button>
        </div>
      )}
    </div>
  )
}

/* ---------- setup screen ---------- */
function Setup({ profile, groups, members, invites, myId, refresh }) {
  const [nameInput, setNameInput] = useState(profile?.name || '')
  const [savingName, setSavingName] = useState(false)
  const [newGroup, setNewGroup] = useState('')
  const [inviteEmail, setInviteEmail] = useState({})
  const [note, setNote] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteErr, setDeleteErr] = useState('')

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
    await supabase.auth.signOut()
  }

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

  return (
    <div className="setup">
      <h2>Setup</h2>

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
        <span className="section-title">Groups</span>
        {groups.length === 0 && (
          <p className="setup-note">No groups yet. Create one below.</p>
        )}
        {groups.map((g) => {
          const owner = g.owner_id === myId
          return (
            <div key={g.id} className="group-card">
              <div className="group-head">
                <strong>{g.name}</strong>
                {owner && <span className="owner-tag">owner</span>}
              </div>
              <div className="member-chips">
                {membersOf(g.id).map((m) => (
                  <span key={m.user_id} className="chip">
                    {m.user_id === myId ? 'You' : m.name || m.user_id.slice(0, 6)}
                  </span>
                ))}
              </div>
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

      <button className="btn-outline signout" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>

      <section className="setup-section danger">
        <span className="section-title">Account</span>
        {!confirmDelete ? (
          <button className="btn-danger" onClick={() => setConfirmDelete(true)}>
            Delete account
          </button>
        ) : (
          <div className="delete-confirm">
            <p className="setup-note">
              This permanently deletes your account and all your tasks, ideas, and
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
    </div>
  )
}

/* ---------- shell ---------- */
function Shell({ session }) {
  const [screen, setScreen] = useState('tdl')
  const [tasks, setTasks] = useState([])
  const [ideas, setIdeas] = useState([])
  const [profile, setProfile] = useState(null)
  const [groups, setGroups] = useState([])
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const rolledRef = useRef(false)

  const myId = session.user.id
  const myEmail = (session.user.email || '').toLowerCase()

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
          repeat_interval: t.repeat_interval,
          repeat_unit: t.repeat_unit,
          repeat_anchor: anchor,
          streak: habit ? 0 : null,
          reward: t.reward,
          user_id: t.user_id,
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
    setLoading(true)

    let { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', myId)
      .maybeSingle()
    if (!prof) {
      const meta = session.user.user_metadata || {}
      await supabase
        .from('profiles')
        .upsert({ id: myId, email: myEmail, name: meta.name || '' })
      const r = await supabase.from('profiles').select('*').eq('id', myId).maybeSingle()
      prof = r.data
    }
    setProfile(prof)

    let { data: taskData } = await supabase.from('tasks').select('*')
    taskData = taskData || []

    if (!rolledRef.current) {
      rolledRef.current = true
      const rolled = await rollRecurring(taskData)
      if (rolled) {
        const r = await supabase.from('tasks').select('*')
        taskData = r.data || []
      }
    }
    setTasks(taskData)

    // daily "clear the list" streak resets if a prior day was left uncleared —
    // detected by any overdue (past-due) real task still sitting on the list
    const t0 = today()
    const hasOverdue = taskData.some((t) => t.due_date && t.due_date < t0)
    if (prof && hasOverdue && prof.clear_streak > 0 && prof.clear_last !== t0) {
      await supabase
        .from('profiles')
        .update({ clear_streak: 0 })
        .eq('id', myId)
      prof = { ...prof, clear_streak: 0 }
      setProfile(prof)
    }

    const { data: ideaData } = await supabase.from('ideas').select('*')
    setIdeas(ideaData || [])

    const { data: groupData } = await supabase.from('groups').select('*')
    setGroups(groupData || [])

    const { data: memberData } = await supabase.from('group_members').select('*')
    const memberIds = [...new Set((memberData || []).map((m) => m.user_id))]
    const profMap = {}
    if (memberIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id,name,email')
        .in('id', memberIds)
      ;(profs || []).forEach((p) => (profMap[p.id] = p))
    }
    setMembers(
      (memberData || []).map((m) => ({ ...m, name: profMap[m.user_id]?.name }))
    )

    const { data: inviteData } = await supabase
      .from('group_invites')
      .select('*')
      .eq('status', 'pending')
    setInvites((inviteData || []).filter((i) => i.invited_email === myEmail))

    setLoading(false)
  }, [myId, myEmail, session, rollRecurring])

  useEffect(() => {
    refresh()
  }, [refresh])

  const peopleMap = {}
  peopleMap[myId] = { id: myId, name: profile?.name || 'Me' }
  members.forEach((m) => {
    if (!peopleMap[m.user_id])
      peopleMap[m.user_id] = { id: m.user_id, name: m.name || 'Member' }
  })
  const people = Object.values(peopleMap)
  const nameFor = (id) => peopleMap[id]?.name || 'someone'

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
            className={screen === 'recurring' ? 'active' : ''}
            onClick={() => setScreen('recurring')}
          >
            Recurring
          </button>
          <button
            className={screen === 'ideas' ? 'active' : ''}
            onClick={() => setScreen('ideas')}
          >
            Ideas
          </button>
          <button
            className={screen === 'setup' ? 'active' : ''}
            onClick={() => setScreen('setup')}
          >
            Setup
          </button>
        </nav>
      </header>

      <main>
        {screen === 'tdl' && (
          <Tdl
            tasks={tasks}
            loading={loading}
            refresh={refresh}
            people={people}
            myId={myId}
            nameFor={nameFor}
            profile={profile}
          />
        )}
        {screen === 'recurring' && (
          <Recurring
            tasks={tasks}
            loading={loading}
            refresh={refresh}
            myId={myId}
            nameFor={nameFor}
          />
        )}
        {screen === 'ideas' && (
          <Ideas
            ideas={ideas}
            loading={loading}
            refresh={refresh}
            groups={groups}
            myId={myId}
            nameFor={nameFor}
          />
        )}
        {screen === 'setup' && (
          <Setup
            profile={profile}
            groups={groups}
            members={members}
            invites={invites}
            myId={myId}
            refresh={refresh}
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
