import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useIsPresent } from 'framer-motion'
import { supabase } from './supabaseClient'
import squirrelHighFiveImg from './assets/squirrel-highfive.png'
import firetailLogoImg from './assets/firetail-logo.png'
import navTodayIconImg from './assets/nav-today-icon.png'
import navListsIconImg from './assets/nav-lists-icon.png'
import navSocialIconImg from './assets/nav-social-icon.png'
import navSettingsIconImg from './assets/nav-settings-icon.png'
import checkboxAcornImg from './assets/checkbox-acorn.png'
import flamethrowerSquirrelImg from './assets/flamethrower-squirrel.png'
import burnButtonSquirrelImg from './assets/burn-button-squirrel.png'
import burnButtonPressedImg from './assets/burn-button-pressed.png'
import flame01Img from './assets/flames/flame-01.png'
import flame02Img from './assets/flames/flame-02.png'
import flame03Img from './assets/flames/flame-03.png'
import flame04Img from './assets/flames/flame-04.png'
import flame05Img from './assets/flames/flame-05.png'
import flame06Img from './assets/flames/flame-06.png'
import flame07Img from './assets/flames/flame-07.png'
import flame08Img from './assets/flames/flame-08.png'
import flame09Img from './assets/flames/flame-09.png'
import flame10Img from './assets/flames/flame-10.png'
import flame11Img from './assets/flames/flame-11.png'
import flame12Img from './assets/flames/flame-12.png'
import flame13Img from './assets/flames/flame-13.png'
import flame14Img from './assets/flames/flame-14.png'
import flame15Img from './assets/flames/flame-15.png'
import flame16Img from './assets/flames/flame-16.png'
import flame17Img from './assets/flames/flame-17.png'
import flame18Img from './assets/flames/flame-18.png'
import flame19Img from './assets/flames/flame-19.png'
import flame20Img from './assets/flames/flame-20.png'
import './App.css'

/* ---------- brand: flame-tail squirrel mark (uploaded artwork) ---------- */
function FiretailMark({ className = '', flipped = false }) {
  return (
    <img
      src={firetailLogoImg}
      alt=""
      aria-hidden="true"
      className={`ft-mark${flipped ? ' ft-mark-flipped' : ''} ${className}`}
    />
  )
}

function BrandLockup({ small = false, showSub = false, header = false }) {
  const cls = [
    'brand',
    'brand-lockup',
    small ? 'small' : '',
    header ? 'header-order' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const wordmark = (
    <span className="brand-words">
      <span className="brand-title">
        <span className="brand-fire">Fire</span>Tail
      </span>
      {showSub && <span className="brand-sub">Habits</span>}
    </span>
  )

  return (
    <div className={cls}>
      {header ? (
        <>
          {wordmark}
          <FiretailMark flipped />
        </>
      ) : (
        <>
          <FiretailMark />
          {wordmark}
        </>
      )}
    </div>
  )
}

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
// "2026-08-20" -> "Aug 20, 2026"
function formatDateLabel(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
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
        <BrandLockup showSub />
        <p className="auth-tag">Keep the streak alive.</p>

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
        <BrandLockup showSub />
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
// hand-scattered layout for the row-burn flame cluster - deliberately
// irregular (not evenly spaced) so it reads as a wild burst rather than a
// tidy row of identical flames. The image for each slot cycles through the
// full FLAME_IMGS set (20 distinct hand-picked shapes) by index.
const FLAME_IMGS = [
  flame01Img, flame02Img, flame03Img, flame04Img, flame05Img,
  flame06Img, flame07Img, flame08Img, flame09Img, flame10Img,
  flame11Img, flame12Img, flame13Img, flame14Img, flame15Img,
  flame16Img, flame17Img, flame18Img, flame19Img, flame20Img,
]
const FLAME_TONGUES = [
  { left: 43.1, top: 13.4, width: 26, rot: 20.0, delay: 0.16 },
  { left: 56.9, top: 49.1, width: 14, rot: 17.0, delay: 0.1 },
  { left: 6.6, top: 42.3, width: 18, rot: -20.1, delay: 0.11 },
  { left: 57.7, top: 43.0, width: 22, rot: 26.0, delay: 0.13 },
  { left: 60.6, bottom: 26.9, width: 19, rot: 1.6, delay: 0.01 },
  { left: 58.2, bottom: 11.8, width: 17, rot: -2.0, delay: 0.09 },
  { left: 62.3, top: 27.0, width: 24, rot: -27.7, delay: 0.02 },
  { left: 98.8, top: 25.9, width: 21, rot: 19.1, delay: 0.14 },
  { left: 49.3, top: -6.6, width: 10, rot: -24.1, delay: 0.15 },
  { left: 26.7, bottom: -1.0, width: 12, rot: 25.7, delay: 0.17 },
  { left: 91.6, top: 9.0, width: 10, rot: -1.7, delay: 0.2 },
  { left: 54.8, bottom: 3.1, width: 16, rot: 15.6, delay: 0.05 },
  { left: -1.5, bottom: 19.7, width: 22, rot: 14.5, delay: 0.02 },
  { left: -1.9, top: 23.1, width: 24, rot: 16.6, delay: 0.04 },
  { left: 48.9, top: -6.2, width: 15, rot: 15.1, delay: 0.08 },
  { left: 39.9, top: 28.1, width: 16, rot: -28.0, delay: 0.17 },
  { left: 87.3, top: 42.6, width: 16, rot: -17.5, delay: 0.2 },
  { left: 7.2, top: 29.1, width: 14, rot: -16.1, delay: 0.05 },
  { left: 27.2, top: 25.4, width: 12, rot: -23.8, delay: 0.04 },
  { left: 58.3, top: 35.8, width: 20, rot: 6.8, delay: 0.03 },
  { left: 55.6, top: 33.4, width: 19, rot: -6.4, delay: 0.13 },
  { left: 80.4, top: 55.4, width: 16, rot: 12.6, delay: 0.03 },
  { left: 17.1, top: -9.6, width: 22, rot: 21.4, delay: 0.12 },
  { left: 8.1, top: 31.8, width: 26, rot: 25.9, delay: 0.05 },
  { left: 39.9, bottom: 29.0, width: 21, rot: 5.4, delay: 0.06 },
  { left: 96.7, top: 41.4, width: 14, rot: -15.2, delay: 0.11 },
  { left: 25.6, bottom: 1.3, width: 21, rot: 23.2, delay: 0.15 },
  { left: 42.5, top: 39.6, width: 10, rot: -25.4, delay: 0.06 },
  { left: 10.4, top: 20.8, width: 20, rot: -20.2, delay: 0.09 },
  { left: 67.5, bottom: 9.9, width: 28, rot: 25.0, delay: 0.12 },
  { left: 33.5, top: 18.2, width: 18, rot: 25.9, delay: 0.0 },
  { left: 3.9, bottom: 9.0, width: 18, rot: -10.1, delay: 0.2 },
  { left: 34.5, top: 20.6, width: 10, rot: 22.4, delay: 0.15 },
  { left: 95.3, bottom: 26.6, width: 20, rot: -8.3, delay: 0.14 },
  { left: 39.5, bottom: 16.2, width: 17, rot: -26.3, delay: 0.1 },
  { left: 36.0, bottom: 16.9, width: 28, rot: -27.3, delay: 0.01 },
  { left: 98.3, top: 44.8, width: 21, rot: -4.7, delay: 0.07 },
  { left: 43.7, top: 16.3, width: 24, rot: 18.9, delay: 0.02 },
  { left: 58.3, bottom: 10.9, width: 24, rot: -26.8, delay: 0.19 },
  { left: 59.7, top: 3.1, width: 21, rot: -0.8, delay: 0.18 },
  { left: 66.2, top: 21.0, width: 16, rot: 1.0, delay: 0.15 },
  { left: 42.1, top: -2.1, width: 21, rot: -14.5, delay: 0.08 },
  { left: 41.0, bottom: 6.1, width: 17, rot: 14.3, delay: 0.04 },
  { left: 56.5, top: 29.9, width: 20, rot: -16.2, delay: 0.03 },
  { left: 83.6, bottom: -5.3, width: 15, rot: -24.4, delay: 0.2 },
  { left: 45.1, top: 37.4, width: 21, rot: -16.0, delay: 0.08 },
  { left: 65.6, top: 4.0, width: 15, rot: 19.0, delay: 0.2 },
  { left: 81.5, top: 27.1, width: 18, rot: 20.9, delay: 0.01 },
  { left: 33.1, bottom: 7.0, width: 13, rot: 16.3, delay: 0.0 },
  { left: 16.4, bottom: 23.5, width: 17, rot: 18.5, delay: 0.05 },
  { left: 97.4, top: 42.5, width: 12, rot: -3.0, delay: 0.13 },
  { left: 34.6, top: 0.8, width: 12, rot: 10.3, delay: 0.04 },
  { left: 69.9, bottom: -0.5, width: 17, rot: -1.6, delay: 0.14 },
  { left: 76.4, top: 57.9, width: 26, rot: 11.0, delay: 0.1 },
  { left: 13.2, bottom: 7.2, width: 19, rot: 16.3, delay: 0.18 },
  { left: 88.1, top: 53.2, width: 22, rot: -20.7, delay: 0.09 },
  { left: -2.3, top: 11.2, width: 26, rot: 3.9, delay: 0.18 },
  { left: 63.4, top: 54.7, width: 16, rot: -22.5, delay: 0.17 },
  { left: 9.6, top: 14.8, width: 16, rot: 22.4, delay: 0.2 },
  { left: 77.7, bottom: 4.6, width: 20, rot: -13.3, delay: 0.14 },
  { left: 5.4, top: 12.4, width: 24, rot: -8.8, delay: 0.08 },
  { left: -0.1, bottom: -2.7, width: 17, rot: 20.6, delay: 0.09 },
  { left: 31.2, top: 53.7, width: 17, rot: 23.3, delay: 0.09 },
  { left: 49.9, top: 16.9, width: 13, rot: 10.6, delay: 0.19 },
  { left: 67.3, top: 29.6, width: 17, rot: -15.6, delay: 0.11 },
  { left: 54.3, top: 26.0, width: 14, rot: 1.3, delay: 0.17 },
  { left: 65.5, top: 30.5, width: 19, rot: 20.7, delay: 0.12 },
  { left: 95.8, top: 14.8, width: 26, rot: -12.7, delay: 0.1 },
  { left: 48.3, bottom: 11.7, width: 28, rot: -6.9, delay: 0.11 },
  { left: 37.9, bottom: 19.0, width: 17, rot: 27.4, delay: 0.02 },
]

function TaskRow({ task, selected, onSelect, timeless, fromName, groupName, onEdit, readOnly, puffExit = true }) {
  const overdue = task.due_date && task.due_date < today()
  const overdueDays = overdue ? daysBetween(task.due_date, today()) : 0
  const isPresent = useIsPresent()
  const exiting = !isPresent
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={
        puffExit
          ? { opacity: 0, scale: 0.97, transition: { duration: 2.5, ease: 'easeIn' } }
          : { opacity: 0, transition: { duration: 0.15 } }
      }
      className={`task ${selected ? 'is-selected' : ''}`}
      data-task-id={task.id}
    >
      {exiting && puffExit && (
        <span className="puff-overlay" aria-hidden="true">
          <span className="puff-wash" />
          {FLAME_TONGUES.map((f, i) => (
            <img
              key={`tongue-${i}`}
              src={FLAME_IMGS[i % FLAME_IMGS.length]}
              alt=""
              className="puff-tongue-full"
              style={{
                '--i': i,
                '--rot': `${f.rot}deg`,
                left: `${f.left}%`,
                ...(f.top !== undefined ? { top: `${f.top}%` } : { bottom: `${f.bottom}%` }),
                width: `${f.width}px`,
                animationDelay: `${f.delay}s`,
              }}
            />
          ))}
          <span className="puff-flash" />
          {Array.from({ length: 7 }).map((_, i) => (
            <span
              key={`smoke-${i}`}
              className="puff-smoke-wisp"
              style={{ '--i': i, left: `${6 + i * 13}%` }}
            />
          ))}
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={`ember-${i}`}
              className="puff-row-ember"
              style={{ '--i': i, left: `${4 + i * 10}%` }}
            />
          ))}
        </span>
      )}
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
        {!!selected && (
          <img
            src={checkboxAcornImg}
            alt=""
            className="task-check-acorn"
            aria-hidden="true"
          />
        )}
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
    </motion.li>
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
    const due = date
    const useTime = time
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
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          autoFocus
          required
          aria-label="Task"
        />

        <div className="pseudo-field-wrap">
          <input
            type="date"
            className="pseudo-field-input"
            value={date}
            onChange={(e) => changeDate(e.target.value)}
            onClick={(e) => e.currentTarget.showPicker?.()}
            required
            aria-label="Date"
          />
          <span className={date ? 'pseudo-field-display has-value' : 'pseudo-field-display'}>
            {date ? formatDateLabel(date) : 'Date'}
          </span>
        </div>

        <div className="pseudo-field-wrap">
          <input
            type="time"
            className="pseudo-field-input"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            onClick={(e) => e.currentTarget.showPicker?.()}
            aria-label="Time of Day"
          />
          <span className={time ? 'pseudo-field-display has-value' : 'pseudo-field-display'}>
            {time ? formatTime(time + ':00') : 'Time of Day'}
          </span>
        </div>

        {time && (
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
          <img className="streak-squirrels" src={squirrelHighFiveImg} alt="" />
          <div className="streak-num-wrap">
            <div className="num-fire" aria-hidden="true">
              {Array.from({ length: 7 }).map((_, i) => (
                <span key={i} className="num-fire-tongue" style={{ '--i': i }} />
              ))}
              <span className="num-fire-core" />
            </div>
            <div className="streak-num">{n}</div>
            <div className="num-embers" aria-hidden="true">
              {Array.from({ length: 8 }).map((_, i) => (
                <span key={i} style={{ '--i': i }} />
              ))}
            </div>
          </div>
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
    const due = date
    const useTime = time
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
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          autoFocus
          required
          aria-label="Task"
        />

        <div className="pseudo-field-wrap">
          <input
            type="date"
            className="pseudo-field-input"
            value={date}
            onChange={(e) => changeDate(e.target.value)}
            onClick={(e) => e.currentTarget.showPicker?.()}
            required
            aria-label="Date"
          />
          <span className={date ? 'pseudo-field-display has-value' : 'pseudo-field-display'}>
            {date ? formatDateLabel(date) : 'Date'}
          </span>
        </div>

        <div className="pseudo-field-wrap">
          <input
            type="time"
            className="pseudo-field-input"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            onClick={(e) => e.currentTarget.showPicker?.()}
            aria-label="Time of Day"
          />
          <span className={time ? 'pseudo-field-display has-value' : 'pseudo-field-display'}>
            {time ? formatTime(time + ':00') : 'Time of Day'}
          </span>
        </div>

        {time && (
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
  const [lastClearWasCelebration, setLastClearWasCelebration] = useState(false)
  const [showFlamethrower, setShowFlamethrower] = useState(false)
  const [flamethrowerPos, setFlamethrowerPos] = useState(null)
  const [burnJustPressed, setBurnJustPressed] = useState(false)
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
    const willCelebrate =
      requiredToday.length > 0 && remaining === 0 && profile && profile.clear_last !== t0

    // If this clear isn't emptying the whole day, the rows play their "puff"
    // exit animation (handled by AnimatePresence/TaskRow). If it IS emptying
    // the day, skip the flourish entirely and go straight to celebration -
    // no competing effects. AnimatePresence keeps each row mounted just long
    // enough to finish its exit transition before it's actually removed.
    setLastClearWasCelebration(willCelebrate)
    if (!willCelebrate && chosen.length > 0) {
      const rowEl = document.querySelector(`[data-task-id="${chosen[0].id}"]`)
      if (rowEl) {
        const rect = rowEl.getBoundingClientRect()
        setFlamethrowerPos({ top: rect.top + rect.height / 2, right: rect.right })
      } else {
        setFlamethrowerPos(null)
      }
      setShowFlamethrower(true)
      setBurnJustPressed(true)
      setTimeout(() => setShowFlamethrower(false), 2500)
      setTimeout(() => setBurnJustPressed(false), 4500)
    }

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
    if (willCelebrate) {
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
      puffExit={!lastClearWasCelebration}
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
              <ul className="task-list">
                <AnimatePresence initial={false}>{g.tasks.map(renderRow)}</AnimatePresence>
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="task-list">
          <AnimatePresence initial={false}>{visible.map(renderRow)}</AnimatePresence>
        </ul>
      )}

      {!readOnly && (
        <button className="fab" onClick={() => setAdding(true)} aria-label="Add task">
          +
        </button>
      )}

      {!readOnly && (selected.size > 0 || burnJustPressed) && (
        <div className="burn-btn-wrap">
          <button className="burn-btn" onClick={doneSelected} aria-label="Burn these tasks">
            <img
              src={burnJustPressed ? burnButtonPressedImg : burnButtonSquirrelImg}
              alt=""
              className={burnJustPressed ? 'burn-btn-img burn-btn-img-pressed' : 'burn-btn-img'}
            />
          </button>
        </div>
      )}

      <AnimatePresence>
        {showFlamethrower && (
          <motion.img
            src={flamethrowerSquirrelImg}
            alt=""
            aria-hidden="true"
            className="flamethrower-overlay"
            style={
              flamethrowerPos
                ? {
                    top: flamethrowerPos.top,
                    left: flamethrowerPos.right - 150 - 10,
                  }
                : undefined
            }
            initial={{ opacity: 0, x: 20, y: '-50%', scale: 0.85, scaleX: -1 }}
            animate={{ opacity: 1, x: 0, y: '-50%', scale: 1, scaleX: -1 }}
            exit={{ opacity: 0, x: 10, y: '-50%', scale: 0.9, scaleX: -1, transition: { duration: 0.3 } }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

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
            <li key={item.id} className="task">
              <span className="spine" aria-hidden="true" />
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
/* ---------- habit builder presets ---------- */
const BUILDER_CATEGORIES = [
  {
    id: 'cleaning',
    label: 'Cleaning',
    items: [
      { title: 'Make the bed', interval: 1, unit: 'day' },
      { title: 'Wash the dishes', interval: 1, unit: 'day' },
      { title: 'Wipe kitchen counters', interval: 1, unit: 'day' },
      { title: 'Take out the trash', interval: 3, unit: 'day' },
      { title: 'Tidy up the living room', interval: 1, unit: 'day' },
      { title: 'Vacuum the floors', interval: 1, unit: 'week' },
      { title: 'Change bed sheets', interval: 1, unit: 'week' },
      { title: 'Clean the bathroom', interval: 1, unit: 'week' },
      { title: 'Do the laundry', interval: 1, unit: 'week' },
      { title: 'Wash towels', interval: 1, unit: 'week' },
      { title: 'Mop the floors', interval: 2, unit: 'week' },
      { title: 'Clean out the fridge', interval: 2, unit: 'week' },
      { title: 'Dust surfaces and shelves', interval: 2, unit: 'week' },
      { title: 'Clean mirrors and windows', interval: 1, unit: 'month' },
      { title: 'Descale the kettle / coffee machine', interval: 1, unit: 'month' },
      { title: 'Declutter one drawer or shelf', interval: 1, unit: 'month' },
      { title: 'Wash pillows and duvet', interval: 3, unit: 'month' },
      { title: 'Clean the oven', interval: 3, unit: 'month' },
      { title: 'Flip / rotate the mattress', interval: 3, unit: 'month' },
      { title: 'Deep clean the shower head', interval: 3, unit: 'month' },
    ],
  },
  {
    id: 'home',
    label: 'Home maintenance',
    items: [
      { title: 'Test smoke and CO detectors', interval: 1, unit: 'month' },
      { title: 'Check under sinks for leaks', interval: 1, unit: 'month' },
      { title: 'Clean the dryer lint trap and vent', interval: 1, unit: 'month' },
      { title: 'Replace HVAC / furnace filter', interval: 3, unit: 'month' },
      { title: 'Run the garbage disposal cleaner', interval: 1, unit: 'month' },
      { title: 'Test GFCI outlets', interval: 3, unit: 'month' },
      { title: 'Clean refrigerator coils', interval: 6, unit: 'month' },
      { title: 'Lubricate garage door and hinges', interval: 6, unit: 'month' },
      { title: 'Check fire extinguisher pressure', interval: 6, unit: 'month' },
      { title: 'Clean the gutters', interval: 6, unit: 'month' },
      { title: 'Flush the water heater', interval: 12, unit: 'month' },
      { title: 'Replace smoke detector batteries', interval: 12, unit: 'month' },
      { title: 'Reseal bathroom and kitchen caulk', interval: 12, unit: 'month' },
      { title: 'Inspect the roof and exterior', interval: 12, unit: 'month' },
      { title: 'Service the HVAC / boiler', interval: 12, unit: 'month' },
      { title: 'Pest control inspection', interval: 12, unit: 'month' },
      { title: 'Chimney sweep and inspection', interval: 12, unit: 'month' },
      { title: 'Check attic / basement for damp', interval: 6, unit: 'month' },
      { title: 'Locate and test the water shutoff valve', interval: 12, unit: 'month' },
      { title: 'Touch up paint and fill wall dings', interval: 12, unit: 'month' },
    ],
  },
  {
    id: 'car',
    label: 'Car & vehicle',
    items: [
      { title: 'Check tire pressure', interval: 1, unit: 'month' },
      { title: 'Top up washer fluid', interval: 1, unit: 'month' },
      { title: 'Check oil and coolant levels', interval: 1, unit: 'month' },
      { title: 'Check all lights and indicators', interval: 1, unit: 'month' },
      { title: 'Wash the car', interval: 1, unit: 'month' },
      { title: 'Vacuum and tidy the interior', interval: 1, unit: 'month' },
      { title: 'Check tire tread depth', interval: 3, unit: 'month' },
      { title: 'Oil change', interval: 6, unit: 'month' },
      { title: 'Rotate the tires', interval: 6, unit: 'month' },
      { title: 'Check the spare tire and jack', interval: 6, unit: 'month' },
      { title: 'Test the battery', interval: 6, unit: 'month' },
      { title: 'Replace wiper blades', interval: 12, unit: 'month' },
      { title: 'Replace cabin air filter', interval: 12, unit: 'month' },
      { title: 'Brake inspection', interval: 12, unit: 'month' },
      { title: 'Full service / annual maintenance', interval: 12, unit: 'month' },
      { title: 'Renew vehicle registration', interval: 12, unit: 'month' },
      { title: 'Renew / review car insurance', interval: 12, unit: 'month' },
      { title: 'Safety or emissions inspection', interval: 12, unit: 'month' },
      { title: 'Check the emergency kit in the trunk', interval: 6, unit: 'month' },
      { title: 'Wax / polish the paintwork', interval: 6, unit: 'month' },
    ],
  },
  {
    id: 'finances',
    label: 'Finances',
    items: [
      { title: 'Review bank account activity', interval: 1, unit: 'week' },
      { title: 'Check credit card statement', interval: 1, unit: 'month' },
      { title: 'Update the budget', interval: 1, unit: 'month' },
      { title: 'Review recurring subscriptions', interval: 1, unit: 'month' },
      { title: 'Move money into savings', interval: 1, unit: 'month' },
      { title: 'Pay bills', interval: 1, unit: 'month' },
      { title: 'Update net worth tracker', interval: 1, unit: 'month' },
      { title: 'Review investment accounts', interval: 3, unit: 'month' },
      { title: 'Check credit report', interval: 4, unit: 'month' },
      { title: 'Pay quarterly estimated taxes', interval: 3, unit: 'month' },
      { title: 'Review and negotiate bills', interval: 6, unit: 'month' },
      { title: 'Rebalance the portfolio', interval: 12, unit: 'month' },
      { title: 'Review insurance policies and coverage', interval: 12, unit: 'month' },
      { title: 'Review retirement contributions', interval: 12, unit: 'month' },
      { title: 'File taxes', interval: 12, unit: 'month' },
      { title: 'Check credit card annual fees and perks', interval: 12, unit: 'month' },
      { title: 'Set financial goals for the year', interval: 12, unit: 'month' },
      { title: 'Check for unclaimed money / old accounts', interval: 12, unit: 'month' },
    ],
  },
  {
    id: 'pets',
    label: 'Pet care',
    items: [
      { title: 'Fresh water and food bowls washed', interval: 1, unit: 'day' },
      { title: 'Walk the dog', interval: 1, unit: 'day' },
      { title: 'Scoop the litter box', interval: 1, unit: 'day' },
      { title: 'Brush teeth', interval: 3, unit: 'day' },
      { title: 'Brush the coat', interval: 1, unit: 'week' },
      { title: 'Full litter change', interval: 1, unit: 'week' },
      { title: 'Clean the cage / tank / hutch', interval: 1, unit: 'week' },
      { title: 'Wash the pet bed and blankets', interval: 2, unit: 'week' },
      { title: 'Clean ears', interval: 2, unit: 'week' },
      { title: 'Flea and tick treatment', interval: 1, unit: 'month' },
      { title: 'Heartworm preventative', interval: 1, unit: 'month' },
      { title: 'Trim nails', interval: 1, unit: 'month' },
      { title: 'Reorder food and supplies', interval: 1, unit: 'month' },
      { title: 'Weigh the pet', interval: 1, unit: 'month' },
      { title: 'Grooming appointment', interval: 2, unit: 'month' },
      { title: 'Deworming treatment', interval: 3, unit: 'month' },
      { title: 'Check ID tag and microchip details', interval: 6, unit: 'month' },
      { title: 'Annual vet checkup', interval: 12, unit: 'month' },
      { title: 'Vaccinations due', interval: 12, unit: 'month' },
      { title: 'Renew pet insurance', interval: 12, unit: 'month' },
    ],
  },
  {
    id: 'plants',
    label: 'Plants & garden',
    items: [
      { title: 'Water the indoor plants', interval: 4, unit: 'day' },
      { title: 'Water the garden', interval: 2, unit: 'day' },
      { title: 'Check plants for pests', interval: 2, unit: 'week' },
      { title: 'Deadhead and prune', interval: 2, unit: 'week' },
      { title: 'Mow the lawn', interval: 1, unit: 'week' },
      { title: 'Weed the beds', interval: 1, unit: 'week' },
      { title: 'Turn the compost', interval: 1, unit: 'week' },
      { title: 'Harvest herbs and vegetables', interval: 1, unit: 'week' },
      { title: 'Rotate plants toward the light', interval: 2, unit: 'week' },
      { title: 'Fertilize indoor plants', interval: 1, unit: 'month' },
      { title: 'Dust and wipe plant leaves', interval: 1, unit: 'month' },
      { title: 'Check the irrigation system', interval: 1, unit: 'month' },
      { title: 'Trim hedges and shrubs', interval: 2, unit: 'month' },
      { title: 'Fertilize the lawn', interval: 3, unit: 'month' },
      { title: 'Repot anything root-bound', interval: 6, unit: 'month' },
      { title: 'Refresh the mulch', interval: 6, unit: 'month' },
      { title: 'Plant seasonal flowers', interval: 6, unit: 'month' },
      { title: 'Clean and sharpen garden tools', interval: 6, unit: 'month' },
      { title: 'Prep the garden for the season', interval: 6, unit: 'month' },
    ],
  },
  {
    id: 'admin',
    label: 'Admin & documents',
    items: [
      { title: 'Scan and file receipts', interval: 1, unit: 'month' },
      { title: 'Back up computer files', interval: 1, unit: 'month' },
      { title: 'Back up phone photos', interval: 1, unit: 'month' },
      { title: 'Organize the desktop and downloads folder', interval: 1, unit: 'month' },
      { title: 'Clear out the email inbox', interval: 1, unit: 'month' },
      { title: 'Shred old documents', interval: 3, unit: 'month' },
      { title: 'Update important passwords', interval: 6, unit: 'month' },
      { title: 'Check passport expiry date', interval: 6, unit: 'month' },
      { title: 'Check ID and card expiry dates', interval: 6, unit: 'month' },
      { title: 'Review warranties and receipts for big purchases', interval: 6, unit: 'month' },
      { title: 'Check driver licence renewal date', interval: 12, unit: 'month' },
      { title: 'Review memberships and renewals', interval: 12, unit: 'month' },
      { title: 'Update emergency contacts', interval: 12, unit: 'month' },
      { title: 'Review will and beneficiaries', interval: 12, unit: 'month' },
      { title: 'Photograph valuables for insurance', interval: 12, unit: 'month' },
      { title: 'Update address on key accounts', interval: 12, unit: 'month' },
      { title: 'Check important documents are stored safely', interval: 12, unit: 'month' },
    ],
  },
  {
    id: 'health',
    label: 'Health checkups',
    items: [
      { title: 'Refill prescriptions', interval: 1, unit: 'month' },
      { title: 'Check the first aid kit and expiry dates', interval: 6, unit: 'month' },
      { title: 'Replace toothbrush / brush head', interval: 3, unit: 'month' },
      { title: 'Dentist checkup and cleaning', interval: 6, unit: 'month' },
      { title: 'Eye exam', interval: 12, unit: 'month' },
      { title: 'Annual physical', interval: 12, unit: 'month' },
      { title: 'Routine blood work', interval: 12, unit: 'month' },
      { title: 'Skin check', interval: 12, unit: 'month' },
      { title: 'Hearing test', interval: 24, unit: 'month' },
      { title: 'Flu shot', interval: 12, unit: 'month' },
      { title: 'Check vaccinations are up to date', interval: 12, unit: 'month' },
      { title: 'Book any age-recommended screenings', interval: 12, unit: 'month' },
      { title: 'Review medications with the doctor', interval: 12, unit: 'month' },
      { title: 'Replace contact lenses / update glasses', interval: 12, unit: 'month' },
      { title: 'Renew health insurance / review the plan', interval: 12, unit: 'month' },
    ],
  },
  {
    id: 'fitness',
    label: 'Fitness',
    items: [
      { title: 'Go for a walk', interval: 1, unit: 'day' },
      { title: 'Stretch', interval: 1, unit: 'day' },
      { title: 'Strength workout', interval: 2, unit: 'day' },
      { title: 'Cardio session', interval: 2, unit: 'day' },
      { title: 'Core workout', interval: 3, unit: 'day' },
      { title: 'Foam roll / mobility work', interval: 2, unit: 'day' },
      { title: 'Take a proper rest day', interval: 1, unit: 'week' },
      { title: 'Yoga session', interval: 1, unit: 'week' },
      { title: 'Play a sport', interval: 1, unit: 'week' },
      { title: 'Get outside for a longer session', interval: 1, unit: 'week' },
      { title: 'Plan next week of training', interval: 1, unit: 'week' },
      { title: 'Log this week of workouts', interval: 1, unit: 'week' },
      { title: 'Check in on training progress', interval: 1, unit: 'month' },
      { title: 'Try a new activity or class', interval: 1, unit: 'month' },
      { title: 'Replace worn-out running shoes', interval: 6, unit: 'month' },
    ],
  },
  {
    id: 'kitchen',
    label: 'Kitchen & food',
    items: [
      { title: 'Pack lunch for tomorrow', interval: 1, unit: 'day' },
      { title: 'Plan meals for the week', interval: 1, unit: 'week' },
      { title: 'Grocery shopping', interval: 1, unit: 'week' },
      { title: 'Batch cook / meal prep', interval: 1, unit: 'week' },
      { title: 'Use up the leftovers', interval: 1, unit: 'week' },
      { title: 'Restock kitchen staples', interval: 2, unit: 'week' },
      { title: 'Try a new recipe', interval: 2, unit: 'week' },
      { title: 'Check pantry expiry dates', interval: 1, unit: 'month' },
      { title: 'Take stock of the freezer', interval: 1, unit: 'month' },
      { title: 'Reorder coffee / tea', interval: 1, unit: 'month' },
      { title: 'Replace the water filter', interval: 2, unit: 'month' },
      { title: 'Sharpen the kitchen knives', interval: 3, unit: 'month' },
      { title: 'Sort and restock the spice rack', interval: 6, unit: 'month' },
      { title: 'Donate unused pantry items', interval: 6, unit: 'month' },
      { title: 'Review the food budget', interval: 1, unit: 'month' },
    ],
  },
  {
    id: 'relationships',
    label: 'Relationships',
    items: [
      { title: 'Quality time with the kids', interval: 1, unit: 'day' },
      { title: 'Tell someone you appreciate them', interval: 1, unit: 'day' },
      { title: 'Call parents', interval: 1, unit: 'week' },
      { title: 'Message or call a friend', interval: 1, unit: 'week' },
      { title: 'Date night', interval: 1, unit: 'week' },
      { title: 'Family dinner together', interval: 1, unit: 'week' },
      { title: 'Phone-free evening together', interval: 1, unit: 'week' },
      { title: 'Check in on someone having a hard time', interval: 2, unit: 'week' },
      { title: 'Plan something with friends', interval: 1, unit: 'month' },
      { title: 'Reconnect with someone out of touch', interval: 1, unit: 'month' },
      { title: 'Write to a long-distance friend', interval: 1, unit: 'month' },
      { title: 'Send a thank-you note', interval: 1, unit: 'month' },
      { title: 'Visit family', interval: 3, unit: 'month' },
      { title: 'Plan a trip together', interval: 6, unit: 'month' },
      { title: 'Host friends for dinner', interval: 2, unit: 'month' },
    ],
  },
  {
    id: 'learning',
    label: 'Learning',
    items: [
      { title: 'Read for 30 minutes', interval: 1, unit: 'day' },
      { title: 'Practice a language', interval: 1, unit: 'day' },
      { title: 'Flashcard review', interval: 1, unit: 'day' },
      { title: 'Work through a course lesson', interval: 2, unit: 'day' },
      { title: 'Practice an instrument or skill', interval: 2, unit: 'day' },
      { title: 'Listen to a podcast or audiobook', interval: 2, unit: 'day' },
      { title: 'Review this week of notes', interval: 1, unit: 'week' },
      { title: 'Watch a lecture or documentary', interval: 1, unit: 'week' },
      { title: 'Read industry news', interval: 1, unit: 'week' },
      { title: 'Write up what I learned this week', interval: 1, unit: 'week' },
      { title: 'Finish a book', interval: 1, unit: 'month' },
      { title: 'Teach someone something I know', interval: 1, unit: 'month' },
      { title: 'Set learning goals', interval: 1, unit: 'month' },
      { title: 'Pick the next thing to learn', interval: 3, unit: 'month' },
    ],
  },
  {
    id: 'mind',
    label: 'Mind',
    items: [
      { title: 'Meditate', interval: 1, unit: 'day' },
      { title: 'Journal', interval: 1, unit: 'day' },
      { title: "Write down three things I'm grateful for", interval: 1, unit: 'day' },
      { title: 'Breathing exercise', interval: 1, unit: 'day' },
      { title: 'Set intentions for the day', interval: 1, unit: 'day' },
      { title: 'Spend time outdoors', interval: 1, unit: 'day' },
      { title: 'Phone-free first hour of the morning', interval: 1, unit: 'day' },
      { title: 'Screen-free wind-down before bed', interval: 1, unit: 'day' },
      { title: 'Keep a consistent bedtime', interval: 1, unit: 'day' },
      { title: 'Brain dump everything on my mind', interval: 1, unit: 'week' },
      { title: 'Weekly reflection', interval: 1, unit: 'week' },
      { title: 'Take a full day off from work', interval: 1, unit: 'week' },
      { title: 'Limit news and doomscrolling', interval: 1, unit: 'day' },
      { title: 'Celebrate a win, however small', interval: 1, unit: 'week' },
      { title: 'Review goals and priorities', interval: 1, unit: 'month' },
      { title: 'Digital detox day', interval: 1, unit: 'month' },
    ],
  },
  {
    id: 'occasions',
    label: 'Birthdays & occasions',
    items: [
      { title: 'Check whose birthday is coming up', interval: 1, unit: 'week' },
      { title: 'Send birthday messages', interval: 1, unit: 'week' },
      { title: 'Buy a gift for an upcoming birthday', interval: 1, unit: 'month' },
      { title: 'Update the birthday list', interval: 6, unit: 'month' },
      { title: 'Keep spare cards and wrapping in stock', interval: 3, unit: 'month' },
      { title: 'Wedding anniversary', interval: 12, unit: 'month' },
      { title: 'Plan a gift for the anniversary', interval: 12, unit: 'month' },
      { title: "Mother's Day", interval: 12, unit: 'month' },
      { title: "Father's Day", interval: 12, unit: 'month' },
      { title: "Valentine's Day", interval: 12, unit: 'month' },
      { title: 'Start holiday gift shopping', interval: 12, unit: 'month' },
      { title: 'Send holiday cards', interval: 12, unit: 'month' },
      { title: 'Plan my own birthday', interval: 12, unit: 'month' },
      { title: 'Book a table for an upcoming occasion', interval: 3, unit: 'month' },
    ],
  },
]

function HabitBuilder({ myId, onDone }) {
  const [categoryId, setCategoryId] = useState('')
  const [picked, setPicked] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const category = BUILDER_CATEGORIES.find((c) => c.id === categoryId)

  function toggleItem(title, item) {
    setPicked((prev) => {
      const next = { ...prev }
      if (next[title]) delete next[title]
      else next[title] = { interval: item.interval, unit: item.unit }
      return next
    })
  }

  function setField(title, field, value) {
    setPicked((prev) => ({ ...prev, [title]: { ...prev[title], [field]: value } }))
  }

  function changeCategory(id) {
    setCategoryId(id)
    setPicked({})
    setErr('')
  }

  const pickedCount = Object.keys(picked).length

  async function addSelected() {
    if (pickedCount === 0) return
    setBusy(true)
    setErr('')
    const due = today()
    const rows = Object.entries(picked).map(([title, cfg]) => ({
      title,
      due_date: due,
      due_time: null,
      duration: null,
      repeat_interval: Math.max(1, Number(cfg.interval) || 1),
      repeat_unit: cfg.unit,
      repeat_anchor: Number(due.slice(8, 10)),
      reward: null,
      user_id: myId,
      assigned_group_id: null,
    }))
    const { error } = await supabase.from('tasks').insert(rows)
    setBusy(false)
    if (error) setErr(error.message)
    else onDone()
  }

  return (
    <div className="builder">
      <p className="builder-intro">
        Pick a category, tick the habits you want, and set how often you want to do each one.
      </p>

      <label className="builder-select-label">
        Category
        <select value={categoryId} onChange={(e) => changeCategory(e.target.value)}>
          <option value="">Choose a category...</option>
          {BUILDER_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      {category && (
        <ul className="builder-list">
          {category.items.map((item) => {
            const cfg = picked[item.title]
            const on = !!cfg
            return (
              <li key={item.title} className={on ? 'builder-item on' : 'builder-item'}>
                <label className="builder-check">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleItem(item.title, item)}
                  />
                  <span>{item.title}</span>
                </label>
                {on && (
                  <div className="builder-freq">
                    <span>every</span>
                    <input
                      type="number"
                      min="1"
                      value={cfg.interval}
                      onChange={(e) => setField(item.title, 'interval', e.target.value)}
                    />
                    <select
                      value={cfg.unit}
                      onChange={(e) => setField(item.title, 'unit', e.target.value)}
                    >
                      <option value="day">day(s)</option>
                      <option value="week">week(s)</option>
                      <option value="month">month(s)</option>
                    </select>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {err && <p className="err">{err}</p>}

      {pickedCount > 0 && (
        <div className="builder-bar">
          <span>{pickedCount} selected</span>
          <button onClick={addSelected} disabled={busy}>
            {busy ? 'Adding...' : `Add to my habits`}
          </button>
        </div>
      )}
    </div>
  )
}

function Habits({ tasks, taskLoading, refresh, myId, nameFor, people, groups }) {
  const [selected, setSelected] = useState(new Set())
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const [tab, setTab] = useState('mine')

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
      <div className="view-switch" style={{ marginBottom: '18px' }}>
        <button className={tab === 'mine' ? 'active' : ''} onClick={() => setTab('mine')}>
          My habits
        </button>
        <button className={tab === 'builder' ? 'active' : ''} onClick={() => setTab('builder')}>
          Habit builder
        </button>
      </div>

      {tab === 'builder' ? (
        <HabitBuilder
          myId={myId}
          onDone={() => {
            setTab('mine')
            refresh()
          }}
        />
      ) : (
        <>
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
        </>
      )}
    </div>
  )
}

/* ---------- Goal Tracker: goals with sub-steps and a progress bar ---------- */
function GoalTrackerScreen({ goals, goalSteps, refresh, myId }) {
  const [openGoalId, setOpenGoalId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [busy, setBusy] = useState(false)

  const mine = goals
    .filter((g) => g.user_id === myId)
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))

  const stepsFor = (goalId) =>
    goalSteps
      .filter((s) => s.goal_id === goalId)
      .sort((a, b) => {
        if ((a.position || 0) !== (b.position || 0)) return (a.position || 0) - (b.position || 0)
        return (a.created_at || '').localeCompare(b.created_at || '')
      })

  async function addGoal(e) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    setBusy(true)
    await supabase.from('goals').insert([
      { title: t, target_date: targetDate || null, user_id: myId },
    ])
    setTitle('')
    setTargetDate('')
    setBusy(false)
    setAdding(false)
    refresh()
  }

  const openGoal = mine.find((g) => g.id === openGoalId)
  if (openGoal) {
    return (
      <GoalDetail
        goal={openGoal}
        steps={stepsFor(openGoal.id)}
        refresh={refresh}
        onBack={() => setOpenGoalId(null)}
        onDeleted={() => setOpenGoalId(null)}
      />
    )
  }

  return (
    <div className="tdl">
      {mine.length === 0 ? (
        <p className="empty">No goals yet. Add one with the + button.</p>
      ) : (
        <ul className="task-list goal-list">
          {mine.map((g) => {
            const steps = stepsFor(g.id)
            const done = steps.filter((s) => s.is_complete).length
            const pct = steps.length ? Math.round((done / steps.length) * 100) : 0
            const currentStep = steps.find((s) => !s.is_complete)
            const currentStepLabel = currentStep
              ? currentStep.title
              : steps.length
              ? 'All steps done! 🎉'
              : 'No steps yet'
            return (
              <li
                key={g.id}
                className="task goal-card"
                onClick={() => setOpenGoalId(g.id)}
              >
                <div className="task-body">
                  <div className="goal-title-row">
                    <span className="task-title">{g.title}</span>
                    {g.target_date && (
                      <>
                        <span className="goal-sep">|</span>
                        <span className="goal-target-inline">Target: {g.target_date}</span>
                      </>
                    )}
                  </div>
                  <div className="goal-progress-row">
                    <div className="goal-progress-track">
                      <div
                        className="goal-progress-fill"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="goal-progress-label">
                      {steps.length ? `${done}/${steps.length}` : 'No steps yet'}
                    </span>
                  </div>
                  <span className="goal-current-step">{currentStepLabel}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {adding ? (
        <form onSubmit={addGoal} className="add-item-row goal-add-form">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Goal title..."
            autoFocus
          />
          <label className="goal-date-label">
            Target date (optional)
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={busy}>
            Add goal
          </button>
          <button type="button" className="ghost" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <button className="fab" onClick={() => setAdding(true)} aria-label="Add goal">
          +
        </button>
      )}
    </div>
  )
}

function GoalDetail({ goal, steps, refresh, onBack, onDeleted }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const done = steps.filter((s) => s.is_complete).length
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0

  async function addStep(e) {
    e.preventDefault()
    const title = text.trim()
    if (!title) return
    setBusy(true)
    const nextPos = steps.length ? (steps[steps.length - 1].position || 0) + 1 : 1
    await supabase
      .from('goal_steps')
      .insert([{ goal_id: goal.id, title, position: nextPos }])
    setText('')
    setBusy(false)
    refresh()
  }

  async function toggleStep(step) {
    await supabase
      .from('goal_steps')
      .update({ is_complete: !step.is_complete })
      .eq('id', step.id)
    refresh()
  }

  async function removeStep(id) {
    await supabase.from('goal_steps').delete().eq('id', id)
    refresh()
  }

  async function moveStep(step, direction) {
    const idx = steps.findIndex((s) => s.id === step.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= steps.length) return
    const other = steps[swapIdx]
    await Promise.all([
      supabase.from('goal_steps').update({ position: other.position || 0 }).eq('id', step.id),
      supabase.from('goal_steps').update({ position: step.position || 0 }).eq('id', other.id),
    ])
    refresh()
  }

  function startEdit(step) {
    setEditingId(step.id)
    setEditText(step.title)
  }

  async function saveEdit() {
    const title = editText.trim()
    const id = editingId
    setEditingId(null)
    if (!title || !id) return
    await supabase.from('goal_steps').update({ title }).eq('id', id)
    refresh()
  }

  async function deleteThisGoal() {
    await supabase.from('goals').delete().eq('id', goal.id)
    refresh()
    onDeleted()
  }

  return (
    <div className="ideas">
      <div className="add-head">
        <button className="ghost" onClick={onBack}>
          ← Back
        </button>
        <h2>{goal.title}</h2>
      </div>

      <div className="goal-detail-progress">
        <div className="goal-progress-track">
          <div className="goal-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="goal-progress-label">
          {steps.length ? `${done}/${steps.length} steps done` : 'No steps yet'}
        </span>
      </div>
      {goal.target_date && (
        <p className="goal-target-date goal-target-date-detail">Target: {goal.target_date}</p>
      )}

      {steps.length === 0 ? (
        <p className="empty">Break this goal into steps with the + button.</p>
      ) : (
        <ul className="task-list">
          {steps.map((step, i) => (
            <li key={step.id} className={`task ${step.is_complete ? 'idea-done' : ''}`}>
              <span className="spine" aria-hidden="true" />
              <label className="task-check">
                <input
                  type="checkbox"
                  checked={step.is_complete}
                  onChange={() => toggleStep(step)}
                  aria-label={`Mark ${step.title} done`}
                />
                <span className="box" />
              </label>
              <div className="task-body">
                {editingId === step.id ? (
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
                    onClick={() => startEdit(step)}
                  >
                    {step.title}
                  </span>
                )}
              </div>
              <div className="item-actions">
                <div className="item-reorder">
                  <button
                    className="item-move"
                    onClick={() => moveStep(step, 'up')}
                    disabled={i === 0}
                    aria-label={`Move ${step.title} up`}
                  >
                    ▲
                  </button>
                  <button
                    className="item-move"
                    onClick={() => moveStep(step, 'down')}
                    disabled={i === steps.length - 1}
                    aria-label={`Move ${step.title} down`}
                  >
                    ▼
                  </button>
                </div>
                <button
                  className="list-remove"
                  onClick={() => removeStep(step.id)}
                  aria-label={`Delete ${step.title}`}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addStep} className="add-item-row goal-step-form">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a step..."
        />
        <button type="submit" className="btn-primary" disabled={busy || !text.trim()}>
          Add
        </button>
      </form>

      <div className="list-delete-zone">
        {confirmDelete ? (
          <div className="delete-confirm">
            <p className="setup-note">
              Delete "{goal.title}" and all its steps? This can't be undone.
            </p>
            <div className="invite-actions">
              <button className="btn-danger" onClick={deleteThisGoal}>
                Yes, delete this goal
              </button>
              <button className="btn-outline" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button className="list-delete-btn" onClick={() => setConfirmDelete(true)}>
            Delete this goal
          </button>
        )}
      </div>
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
  const [goals, setGoals] = useState(cached?.goals || [])
  const [goalSteps, setGoalSteps] = useState(cached?.goalSteps || [])
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
      goalRes,
      goalStepRes,
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
      supabase.from('goals').select('*'),
      supabase.from('goal_steps').select('*'),
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
    setGoals(goalRes.data || [])
    setGoalSteps(goalStepRes.data || [])
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
      goals: goalRes.data || [],
      goalSteps: goalStepRes.data || [],
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
        <BrandLockup small header />
        <nav className="screen-tabs">
          <button
            className={screen === 'tdl' ? 'active nav-icon-btn' : 'nav-icon-btn'}
            onClick={() => setScreen('tdl')}
            aria-label="Today"
          >
            <img src={navTodayIconImg} alt="" className="nav-icon-img" />
          </button>
          <button
            className={screen === 'ideas' ? 'active nav-icon-btn' : 'nav-icon-btn'}
            onClick={() => setScreen('ideas')}
            aria-label="Lists"
          >
            <img src={navListsIconImg} alt="" className="nav-icon-img" />
          </button>
          <button
            className={screen === 'social' ? 'active nav-icon-btn' : 'nav-icon-btn'}
            onClick={() => setScreen('social')}
            aria-label="Social"
          >
            <img src={navSocialIconImg} alt="" className="nav-icon-img" />
          </button>
          <div className="nav-dropdown" ref={setupMenuRef}>
            <button
              className={`nav-gear-btn nav-icon-btn${screen === 'setup' || screen === 'habits' || screen === 'goals' ? ' active' : ''}`}
              onClick={() => setSetupMenuOpen((o) => !o)}
              aria-label="Setup menu"
            >
              <img src={navSettingsIconImg} alt="" className="nav-icon-img" />
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
                <button
                  onClick={() => {
                    setScreen('goals')
                    setSetupMenuOpen(false)
                  }}
                >
                  Goal Tracker
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
        {screen === 'goals' && (
          <GoalTrackerScreen
            goals={goals}
            goalSteps={goalSteps}
            refresh={refresh}
            myId={myId}
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
