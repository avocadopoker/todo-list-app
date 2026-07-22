import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

/* ---------- date + helpers ---------- */
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
function prettyDate(dateStr) {
  const t0 = today()
  if (dateStr === t0) return 'Today'
  if (dateStr === shiftDays(t0, 1)) return 'Tomorrow'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
function dailySeed() {
  const s = today()
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

const PRIORITIES = [
  { value: 3, label: 'High' },
  { value: 2, label: 'Medium' },
  { value: 1, label: 'Low' },
]
const priorityLabel = (v) =>
  (PRIORITIES.find((p) => p.value === v) || PRIORITIES[1]).label

const VIEWS = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'next7', label: 'Next 7d' },
  { key: 'next30', label: 'Next 30d' },
]

function filterForView(tasks, view) {
  const t0 = today()
  // Today now includes anything due today OR earlier (overdue carries over)
  if (view === 'today') return tasks.filter((x) => x.due_date && x.due_date <= t0)
  if (view === 'tomorrow')
    return tasks.filter((x) => x.due_date === shiftDays(t0, 1))
  if (view === 'next7') {
    const end = shiftDays(t0, 6)
    return tasks.filter((x) => x.due_date && x.due_date >= t0 && x.due_date <= end)
  }
  if (view === 'next30') {
    const end = shiftDays(t0, 29)
    return tasks.filter((x) => x.due_date && x.due_date >= t0 && x.due_date <= end)
  }
  return []
}
function sortTasks(list) {
  return [...list].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
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
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={6}
            />
          </label>
          {msg && <p className="auth-msg">{msg}</p>}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? '...' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <button
          className="auth-switch"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setMsg('')
          }}
        >
          {mode === 'login' ? 'No account? Create one' : 'Have an account? Log in'}
        </button>
      </div>
    </div>
  )
}

/* ---------- task row ---------- */
function TaskRow({ task, selected, onSelect, onAdvance, timeless, fromName }) {
  const pClass =
    task.priority === 3 ? 'p-high' : task.priority === 1 ? 'p-low' : 'p-med'
  const overdue = task.due_date && task.due_date < today()
  return (
    <li className={`task ${pClass} ${selected ? 'is-selected' : ''}`}>
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
          <span className="prio-tag">{priorityLabel(task.priority)}</span>
          {task.due_date && <span className="dot">·</span>}
          {task.due_date && (
            <span className={overdue ? 'overdue' : ''}>
              {overdue ? 'Overdue · ' : ''}
              {prettyDate(task.due_date)}
            </span>
          )}
          {timeless && <span className="timeless-tag">timeless pick</span>}
          {fromName && <span className="from-tag">from {fromName}</span>}
          {task.recurring_interval_days && <span className="dot">·</span>}
          {task.recurring_interval_days && (
            <span className="repeat-tag">every {task.recurring_interval_days}d</span>
          )}
        </span>
      </div>
      {task.recurring_interval_days && (
        <button
          className="advance"
          title="Done - schedule next"
          onClick={() => onAdvance(task)}
        >
          ↻
        </button>
      )}
    </li>
  )
}

/* ---------- add task ---------- */
function AddTask({ onDone, onCancel, people, myId }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [priority, setPriority] = useState(2)
  const [recurring, setRecurring] = useState(false)
  const [interval, setIntervalDays] = useState(7)
  const [assignee, setAssignee] = useState(myId)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const showAssign = people && people.length > 1

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
        priority,
        recurring_interval_days: recurring ? Number(interval) : null,
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
          <span className="field-label">Priority</span>
          <div className="prio-picker">
            {PRIORITIES.map((p) => (
              <button
                type="button"
                key={p.value}
                className={priority === p.value ? 'active' : ''}
                onClick={() => setPriority(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

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
            <div className="interval-row">
              Repeat every
              <input
                type="number"
                min="1"
                value={interval}
                onChange={(e) => setIntervalDays(e.target.value)}
              />
              days
            </div>
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

/* ---------- TDL screen ---------- */
function Tdl({ tasks, loading, refresh, people, myId, nameFor }) {
  const [view, setView] = useState('today')
  const [selected, setSelected] = useState(new Set())
  const [adding, setAdding] = useState(false)

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function advance(task) {
    const next = shiftDays(task.due_date || today(), task.recurring_interval_days)
    await supabase.from('tasks').update({ due_date: next }).eq('id', task.id)
    refresh()
  }

  async function deleteSelected() {
    await supabase.from('tasks').delete().in('id', [...selected])
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

  return (
    <div className="tdl">
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
      ) : (
        <ul className="task-list">
          {visible.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              selected={selected.has(t.id)}
              onSelect={toggleSelect}
              onAdvance={advance}
              timeless={timelessPick && t.id === timelessPick.id && !t.due_date}
              fromName={
                t.created_by && t.created_by !== myId ? nameFor(t.created_by) : null
              }
            />
          ))}
        </ul>
      )}

      <button className="fab" onClick={() => setAdding(true)} aria-label="Add task">
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

/* ---------- setup screen ---------- */
function Setup({ profile, groups, members, invites, myId, refresh }) {
  const [nameInput, setNameInput] = useState(profile?.name || '')
  const [savingName, setSavingName] = useState(false)
  const [newGroup, setNewGroup] = useState('')
  const [inviteEmail, setInviteEmail] = useState({})
  const [note, setNote] = useState('')

  async function saveName() {
    setSavingName(true)
    await supabase.from('profiles').update({ name: nameInput.trim() }).eq('id', myId)
    setSavingName(false)
    refresh()
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
    </div>
  )
}

/* ---------- shell ---------- */
function Shell({ session }) {
  const [screen, setScreen] = useState('tdl')
  const [tasks, setTasks] = useState([])
  const [profile, setProfile] = useState(null)
  const [groups, setGroups] = useState([])
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)

  const myId = session.user.id
  const myEmail = (session.user.email || '').toLowerCase()

  const refresh = useCallback(async () => {
    setLoading(true)

    // ensure a profile row exists
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

    const { data: taskData } = await supabase.from('tasks').select('*')
    setTasks(taskData || [])

    const { data: groupData } = await supabase.from('groups').select('*')
    setGroups(groupData || [])

    const { data: memberData } = await supabase.from('group_members').select('*')
    const memberIds = [...new Set((memberData || []).map((m) => m.user_id))]
    let profMap = {}
    if (memberIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id,name,email')
        .in('id', memberIds)
      ;(profs || []).forEach((p) => (profMap[p.id] = p))
    }
    const membersWithNames = (memberData || []).map((m) => ({
      ...m,
      name: profMap[m.user_id]?.name,
    }))
    setMembers(membersWithNames)

    const { data: inviteData } = await supabase
      .from('group_invites')
      .select('*')
      .eq('status', 'pending')
    setInvites((inviteData || []).filter((i) => i.invited_email === myEmail))

    setLoading(false)
  }, [myId, myEmail, session])

  useEffect(() => {
    refresh()
  }, [refresh])

  // people for "Task for": me + unique groupmates
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
            className={screen === 'setup' ? 'active' : ''}
            onClick={() => setScreen('setup')}
          >
            Setup
          </button>
        </nav>
      </header>

      <main>
        {screen === 'tdl' ? (
          <Tdl
            tasks={tasks}
            loading={loading}
            refresh={refresh}
            people={people}
            myId={myId}
            nameFor={nameFor}
          />
        ) : (
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) return null
  if (!session) return <Login />
  return <Shell session={session} />
}
