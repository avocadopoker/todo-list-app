import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

function App() {
  const [tasks, setTasks] = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTasks()
  }, [])

  async function fetchTasks() {
    setLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) console.error(error)
    else setTasks(data)
    setLoading(false)
  }

  async function addTask(e) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    const { data, error } = await supabase
      .from('tasks')
      .insert([{ title }])
      .select()
    if (error) console.error(error)
    else setTasks([...tasks, ...data])
    setNewTitle('')
  }

  async function toggleTask(task) {
    const { error } = await supabase
      .from('tasks')
      .update({ is_complete: !task.is_complete })
      .eq('id', task.id)
    if (error) console.error(error)
    else
      setTasks(
        tasks.map((t) =>
          t.id === task.id ? { ...t, is_complete: !t.is_complete } : t
        )
      )
  }

  async function deleteTask(id) {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) console.error(error)
    else setTasks(tasks.filter((t) => t.id !== id))
  }

  const remaining = tasks.filter((t) => !t.is_complete).length

  return (
    <div className="page">
      <div className="sheet">
        <header className="sheet-header">
          <h1>Today's List</h1>
          <span className="count">{remaining} open</span>
        </header>

        <form className="add-row" onSubmit={addTask}>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a task..."
          />
          <button type="submit">Add</button>
        </form>

        {loading ? (
          <p className="empty">Loading...</p>
        ) : tasks.length === 0 ? (
          <p className="empty">Nothing on the list yet.</p>
        ) : (
          <ul className="task-list">
            {tasks.map((task) => (
              <li
                key={task.id}
                className={task.is_complete ? 'done' : ''}
              >
                <label>
                  <input
                    type="checkbox"
                    checked={task.is_complete}
                    onChange={() => toggleTask(task)}
                  />
                  <span className="check-mark" />
                  <span className="title">{task.title}</span>
                </label>
                <button
                  className="remove"
                  onClick={() => deleteTask(task.id)}
                  aria-label="Delete task"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default App
