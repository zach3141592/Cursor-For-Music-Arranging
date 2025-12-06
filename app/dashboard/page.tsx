'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '../lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Project } from '../lib/types'
import type { User } from '@supabase/supabase-js'
import './dashboard.css'

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [showNewProject, setShowNewProject] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)
      fetchProjects()
    }
    getUser()
  }, [])

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false })

    if (!error && data) {
      setProjects(data)
    }
    setLoading(false)
  }

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProjectName.trim()) return

    setCreating(true)
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name: newProjectName.trim(),
        abc_notation: `X:1
T:${newProjectName.trim()}
M:4/4
L:1/4
K:C
|z4|z4|z4|z4|z4|z4|z4|z4|`,
        user_id: user?.id,
      })
      .select()
      .single()

    if (!error && data) {
      router.push(`/arrange?project=${data.id}`)
    }
    setCreating(false)
    setShowNewProject(false)
    setNewProjectName('')
  }

  const deleteProject = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return

    setDeletingId(id)
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (!error) {
      setProjects(projects.filter((p) => p.id !== id))
    }
    setDeletingId(null)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner" />
        <p>Loading projects...</p>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <img src="/logo.png" alt="TunesForm" className="dashboard-logo" />
          <h1>TunesForm</h1>
        </div>
        <div className="header-right">
          <span className="user-email">{user?.email}</span>
          <button onClick={handleSignOut} className="btn-signout">
            Sign Out
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <div className="projects-header">
          <h2>Your Projects</h2>
          <button
            className="btn-new-project"
            onClick={() => setShowNewProject(true)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>New Project</span>
          </button>
        </div>

        {showNewProject && (
          <div className="new-project-modal">
            <form onSubmit={createProject} className="new-project-form">
              <h3>Create New Project</h3>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Project name (e.g., My Jazz Standard)"
                autoFocus
              />
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewProject(false)
                    setNewProjectName('')
                  }}
                  className="btn-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newProjectName.trim()}
                  className="btn-create"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        )}

        {projects.length === 0 ? (
          <div className="empty-projects">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M9 19V6l12-3v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            <h3>No projects yet</h3>
            <p>Create your first project to start arranging music with AI</p>
            <button
              className="btn-create-first"
              onClick={() => setShowNewProject(true)}
            >
              Create First Project
            </button>
            <Link href="/arrange" className="try-editor-link">
              or try the editor without saving
            </Link>
          </div>
        ) : (
          <div className="projects-container">
            <div className="projects-grid">
              {projects.map((project) => (
                <div key={project.id} className="project-card">
                  <Link href={`/arrange?project=${project.id}`} className="project-link">
                    <div className="project-preview">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M9 19V6l12-3v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                      </svg>
                    </div>
                    <div className="project-info">
                      <h3>{project.name}</h3>
                      <p>Updated {formatDate(project.updated_at)}</p>
                    </div>
                  </Link>
                  <button
                    className="btn-delete"
                    onClick={(e) => {
                      e.preventDefault()
                      deleteProject(project.id)
                    }}
                    disabled={deletingId === project.id}
                    title="Delete project"
                  >
                    {deletingId === project.id ? (
                      <span className="loading-spinner-small" />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
