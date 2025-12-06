'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { jsPDF } from 'jspdf'
import { preprocessImage } from '../lib/imagePreprocessing'
import ScoreEditor, { SelectedTool } from '../components/ScoreEditor'
import { createClient } from '../lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Project } from '../lib/types'

declare global {
  interface Window {
    ABCJS: any
  }
}

const defaultABC = `X: 1
T: YOUR LEAD SHEET
M: 4/4
L: 1/4
K: C
z4 | z4 | z4 | z4 | z4 | z4 | z4 | z4 |]
`

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export default function Home() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project')
  const supabase = createClient()

  const [user, setUser] = useState<User | null>(null)
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')

  const [abcInput, setAbcInput] = useState(defaultABC)
  const [isUploading, setIsUploading] = useState(false)
  const [status, setStatus] = useState<{type: 'success' | 'error' | 'loading', message: string} | null>(null)

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)

  // Score editor state
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [selectedTool, setSelectedTool] = useState<SelectedTool>({
    type: 'note',
    value: 'C',
    duration: '2' // quarter note
  })
  const [selectedElement, setSelectedElement] = useState<{ startChar: number; endChar: number; text?: string } | null>(null)
  const selectedElementRef = useRef<SVGElement | null>(null)

  const originalScoreRef = useRef<HTMLDivElement>(null)
  const originalSynthControlRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const [abcjsLoaded, setAbcjsLoaded] = useState(false)

  // Load user and project data
  useEffect(() => {
    const loadUserAndProject = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (projectId && user) {
        const { data: project } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single()

        if (project) {
          setCurrentProject(project)
          setAbcInput(project.abc_notation)
        }
      }
    }
    loadUserAndProject()
  }, [projectId])

  // Track unsaved changes
  useEffect(() => {
    if (currentProject && abcInput !== currentProject.abc_notation) {
      setHasUnsavedChanges(true)
    } else {
      setHasUnsavedChanges(false)
    }
  }, [abcInput, currentProject])

  // Save project function
  const saveProject = async () => {
    if (!user || !currentProject) return

    setIsSaving(true)
    const { error } = await supabase
      .from('projects')
      .update({ abc_notation: abcInput })
      .eq('id', currentProject.id)

    if (!error) {
      setCurrentProject({ ...currentProject, abc_notation: abcInput })
      setHasUnsavedChanges(false)
      showStatus('success', 'Project saved!')
    } else {
      showStatus('error', 'Failed to save project')
    }
    setIsSaving(false)
  }

  // Save as new project
  const saveAsNewProject = async (name: string) => {
    if (!user || !name.trim()) return

    setIsSaving(true)
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name: name.trim(),
        abc_notation: abcInput,
        user_id: user.id,
      })
      .select()
      .single()

    if (!error && data) {
      setCurrentProject(data)
      setHasUnsavedChanges(false)
      setShowSaveModal(false)
      setNewProjectName('')
      showStatus('success', 'Project created!')
      // Update URL to include project ID
      window.history.replaceState({}, '', `/arrange?project=${data.id}`)
    } else {
      showStatus('error', 'Failed to create project')
    }
    setIsSaving(false)
  }

  useEffect(() => {
    // Load abcjs from CDN
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/abcjs@6.4.4/dist/abcjs-basic-min.js'
    script.onload = () => {
      console.log('abcjs loaded')
      setAbcjsLoaded(true)
    }
    document.head.appendChild(script)

    return () => {
      document.head.removeChild(script)
    }
  }, [])

  const showStatus = (type: 'success' | 'error' | 'loading', message: string) => {
    setStatus({ type, message })
    setTimeout(() => setStatus(null), 5000)
  }

  // Helper to extract duration from ABC note
  const extractDuration = (noteStr: string): string => {
    // Match note pattern: optional accidental, note letter, optional octave markers, optional duration
    const match = noteStr.match(/^[_^=]*[A-Ga-gz][,']*(\d*\/?\d*)/)
    if (match && match[1]) {
      return match[1] // Return the duration part (e.g., "2", "4", "/2", "3/2")
    }
    return '2' // Default to quarter note duration
  }

  // Handle click on score element
  const handleScoreClick = useCallback((abcElem: any, _tuneNumber: number, _classes: string, _analysis: any, _drag: any, _mouseEvent: MouseEvent) => {
    if (!isEditorOpen) return // Only handle clicks when editor is open

    if (!abcElem) return

    const startChar = abcElem.startChar
    const endChar = abcElem.endChar

    if (startChar === undefined || endChar === undefined) return

    // In select mode, just select the element
    if (selectedTool.type === 'select') {
      setSelectedElement({ startChar, endChar })
      return
    }

    // Clear selection when editing
    setSelectedElement(null)

    setAbcInput(prevAbc => {
      const before = prevAbc.substring(0, startChar)
      const selected = prevAbc.substring(startChar, endChar)
      const after = prevAbc.substring(endChar)

      if (selectedTool.type === 'delete') {
        // Check if it's a note (not a rest, bar line, or other element)
        const isNote = /^[_^=]*[A-Ga-g]/.test(selected)
        const isRest = /^z/.test(selected)

        if (isNote) {
          // Replace note with rest of same duration
          const duration = extractDuration(selected)
          return before + 'z' + duration + after
        } else if (isRest) {
          // For rests, just remove them (or keep as is)
          return before + after
        } else {
          // For other elements (dynamics, chord symbols, etc.), just remove
          return before + after
        }
      }

      if (selectedTool.type === 'note' || selectedTool.type === 'rest') {
        // Build the new note/rest
        let newElement = ''
        if (selectedTool.type === 'rest') {
          newElement = selectedTool.value // Rest value already includes duration (e.g., 'z2', 'z4')
        } else {
          newElement = selectedTool.value + selectedTool.duration
        }
        // Replace the clicked element with the new one
        return before + newElement + after
      }

      if (selectedTool.type === 'accidental') {
        // Add accidental to existing note
        const noteMatch = selected.match(/^([_^=]*)([A-Ga-g])(.*)$/)
        if (noteMatch) {
          const newNote = selectedTool.value + noteMatch[2] + noteMatch[3]
          return before + newNote + after
        }
        return prevAbc
      }

      if (selectedTool.type === 'chord') {
        // Add chord symbol before the note
        const chordSymbol = `"${selectedTool.value}"`
        return before + chordSymbol + selected + after
      }

      if (selectedTool.type === 'dynamic') {
        // Add dynamic before the note
        return before + selectedTool.value + selected + after
      }

      if (selectedTool.type === 'articulation') {
        // Add articulation to the note
        return before + selectedTool.value + selected + after
      }

      return prevAbc
    })
  }, [isEditorOpen, selectedTool])

  const renderAbc = useCallback((targetEl: HTMLElement | null, abcText: string, withClickListener: boolean = false) => {
    if (!targetEl || !window.ABCJS) return null

    try {
      targetEl.innerHTML = ''
      const options: any = {
        responsive: 'resize',
        add_classes: true,
        clickListener: withClickListener && isEditorOpen ? handleScoreClick : undefined
      }

      const visualObj = window.ABCJS.renderAbc(targetEl, abcText, options)

      // Add click handlers for all SVG elements (dynamics, chords, etc.)
      if (withClickListener && isEditorOpen && visualObj && visualObj[0]) {
        const svgEl = targetEl.querySelector('svg')
        if (svgEl) {
          svgEl.style.cursor = 'crosshair'

          svgEl.addEventListener('click', (e) => {
            const target = e.target as SVGElement

            // Check if clicked on a text element (dynamics, chord symbols, etc.)
            let textEl: SVGElement | null = null
            if (target.tagName === 'text') {
              textEl = target
            } else if (target.closest('text')) {
              textEl = target.closest('text') as SVGElement
            } else if (target.tagName === 'tspan' && target.parentElement) {
              textEl = target.parentElement as unknown as SVGElement
            }

            if (textEl && selectedTool.type === 'select') {
              // Clear previous selection
              if (selectedElementRef.current) {
                selectedElementRef.current.classList.remove('selected-note')
              }
              // Highlight the clicked element directly
              textEl.classList.add('selected-note')
              selectedElementRef.current = textEl

              // Get the text content for searching in ABC
              const textContent = textEl.textContent || ''

              // Store the text for search-based deletion
              if (textContent) {
                setSelectedElement({ startChar: -1, endChar: -1, text: textContent })
              }
              return
            }

            // Handle delete mode for text elements
            if (textEl && selectedTool.type === 'delete') {
              const textContent = textEl.textContent || ''
              if (textContent) {
                // Delete the dynamic/chord from ABC
                setAbcInput(prevAbc => {
                  const text = textContent.trim()
                  const patterns = [`!${text}!`, `"${text}"`]
                  for (const p of patterns) {
                    const idx = prevAbc.indexOf(p)
                    if (idx !== -1) {
                      return prevAbc.substring(0, idx) + prevAbc.substring(idx + p.length)
                    }
                  }
                  return prevAbc
                })
              }
              return
            }
          })
        }
      }

      // Highlight selected element using ABCJS's selection API
      if (selectedElement && visualObj && visualObj[0]) {
        try {
          // Use ABCJS's built-in selection highlighting
          const tune = visualObj[0]
          if (tune.engraver && tune.engraver.staffgroups) {
            tune.engraver.staffgroups.forEach((staffgroup: any) => {
              if (staffgroup.voices) {
                staffgroup.voices.forEach((voice: any) => {
                  voice.forEach((elem: any) => {
                    if (elem.abcelem &&
                        elem.abcelem.startChar === selectedElement.startChar &&
                        elem.abcelem.endChar === selectedElement.endChar) {
                      // Add highlight class to all SVG elements of this note
                      if (elem.children) {
                        elem.children.forEach((child: any) => {
                          if (child.graphelem) {
                            child.graphelem.setAttribute('class',
                              (child.graphelem.getAttribute('class') || '') + ' selected-note')
                          }
                        })
                      }
                    }
                  })
                })
              }
            })
          }
        } catch (e) {
          console.log('Selection highlight error:', e)
        }
      }

      return visualObj
    } catch (e) {
      console.error(e)
      showStatus('error', 'Render error: ' + (e as Error).message)
      return null
    }
  }, [handleScoreClick, isEditorOpen, selectedElement, selectedTool])

  // Auto-render when ABC input changes or selection changes
  useEffect(() => {
    if (abcjsLoaded && abcInput.trim()) {
      renderAbc(originalScoreRef.current, abcInput, true)
    }
  }, [abcInput, abcjsLoaded, isEditorOpen, renderAbc, selectedElement])

  // Keyboard shortcut for delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEditorOpen || !selectedElement) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()

        setAbcInput(prevAbc => {
          // If we have exact character positions
          if (selectedElement.startChar >= 0 && selectedElement.endChar >= 0) {
            const before = prevAbc.substring(0, selectedElement.startChar)
            const selected = prevAbc.substring(selectedElement.startChar, selectedElement.endChar)
            const after = prevAbc.substring(selectedElement.endChar)

            // Check if it's a note - replace with rest
            const isNote = /^[_^=]*[A-Ga-g]/.test(selected)
            if (isNote) {
              const duration = extractDuration(selected)
              return before + 'z' + duration + after
            }
            // Otherwise just delete
            return before + after
          }

          // If we only have text content (for dynamics/decorations), search and delete
          if (selectedElement.text) {
            const text = selectedElement.text.trim()

            // Try multiple patterns for dynamics and chord symbols
            const patterns = [
              new RegExp(`!${text}!`, 'i'),              // Dynamic: !pp!, !mf!
              new RegExp(`"[^"]*${text}[^"]*"`, 'i'),    // Chord with text: "Cmaj7"
              new RegExp(`!${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}!`, 'i'), // Escaped
            ]

            for (const pattern of patterns) {
              const match = prevAbc.match(pattern)
              if (match && match.index !== undefined) {
                return prevAbc.substring(0, match.index) + prevAbc.substring(match.index + match[0].length)
              }
            }

            // Also try direct string search as fallback
            const directPatterns = [`!${text}!`, `"${text}"`]
            for (const p of directPatterns) {
              const idx = prevAbc.indexOf(p)
              if (idx !== -1) {
                return prevAbc.substring(0, idx) + prevAbc.substring(idx + p.length)
              }
            }
          }

          return prevAbc
        })

        setSelectedElement(null)
        if (selectedElementRef.current) {
          selectedElementRef.current.classList.remove('selected-note')
          selectedElementRef.current = null
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditorOpen, selectedElement])

  const playScore = async (target: HTMLElement | null, abcText: string, setControl: (control: any) => void) => {
    if (!target || !window.ABCJS) return
    
    try {
      if (!window.ABCJS.synth) {
        showStatus('error', 'abcjs synth not available in this build.')
        return
      }
      
      const visualObjs = window.ABCJS.renderAbc(target, abcText, { responsive: 'resize' })
      const synthControl = new window.ABCJS.synth.SynthController()
      
      // Create hidden audio element if it doesn't exist
      let audioEl = document.getElementById('hidden-audio') as HTMLDivElement
      if (!audioEl) {
        audioEl = document.createElement('div')
        audioEl.id = 'hidden-audio'
        audioEl.style.display = 'none'
        document.body.appendChild(audioEl)
      }
      
      synthControl.load('#hidden-audio', null, { displayPlay: true })
      const synth = new window.ABCJS.synth.CreateSynth()
      
      await synth.init({ visualObj: visualObjs[0] })
      await synth.prime()
      
      synthControl.setTune(visualObjs[0], false, { chordMute: false }).then(() => {
        synthControl.play()
      })
      
      setControl(synthControl)
    } catch (e) {
      console.error(e)
      showStatus('error', 'Playback error: ' + (e as Error).message)
    }
  }

  const handlePlayOriginal = () => {
    playScore(originalScoreRef.current, abcInput, (control) => {
      originalSynthControlRef.current = control
    })
  }

  const handleStopOriginal = () => {
    if (originalSynthControlRef.current) {
      originalSynthControlRef.current.stop()
    }
  }

  const handleDownloadPdf = () => {
    if (!originalScoreRef.current) return
    const svg = originalScoreRef.current.querySelector('svg')
    if (!svg) {
      showStatus('error', 'No score rendered to download')
      return
    }

    showStatus('loading', 'Generating PDF...')

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = document.createElement('img')

    img.onload = () => {
      // High quality scale factor (300 DPI equivalent)
      const scale = 4
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      ctx!.fillStyle = 'white'
      ctx!.fillRect(0, 0, canvas.width, canvas.height)
      ctx!.drawImage(img, 0, 0, canvas.width, canvas.height)

      const imgData = canvas.toDataURL('image/png', 1.0)

      // Create PDF - letter size (8.5 x 11 inches)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: 'letter'
      })

      const pageWidth = 8.5
      const pageHeight = 11
      const margin = 0.5
      const maxWidth = pageWidth - (margin * 2)
      const maxHeight = pageHeight - (margin * 2)

      // Calculate aspect ratio and fit to page
      const imgAspect = canvas.width / canvas.height
      let finalWidth = maxWidth
      let finalHeight = finalWidth / imgAspect

      // If too tall, scale by height instead
      if (finalHeight > maxHeight) {
        finalHeight = maxHeight
        finalWidth = finalHeight * imgAspect
      }

      // Position at top of page, centered horizontally
      const x = (pageWidth - finalWidth) / 2
      const y = margin

      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight)
      pdf.save('lead-sheet.pdf')

      showStatus('success', 'PDF downloaded!')
    }

    img.src = 'data:image/svg+xml,' + encodeURIComponent(svgData)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      showStatus('error', 'Please upload an image (PNG, JPG, WEBP) or PDF file')
      return
    }

    setIsUploading(true)
    showStatus('loading', 'Processing image...')

    try {
      // Convert file to data URL
      const originalDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      // Preprocess the image (resize, enhance contrast)
      showStatus('loading', 'Optimizing image for recognition...')
      const preprocessResult = await preprocessImage(originalDataUrl, {
        maxDimension: 2048,
        enhanceContrast: true,
        contrastFactor: 1.3
      })

      // Extract base64 from processed data URL
      const base64 = preprocessResult.processedDataUrl.split(',')[1]
      const mimeType = preprocessResult.processedDataUrl.split(';')[0].split(':')[1]

      // Send to API
      showStatus('loading', 'AI is reading the sheet music...')

      const response = await fetch('/api/read-music', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64,
          mimeType: mimeType
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.abc) {
        setAbcInput(data.abc)
        showStatus('success', 'Sheet music converted to ABC notation!')
      } else {
        throw new Error('No ABC notation returned')
      }
    } catch (error) {
      console.error('Upload error:', error)
      showStatus('error', 'Failed to read sheet music. Please try a clearer image.')
    } finally {
      setIsUploading(false)
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || isChatLoading) return

    const userMessage = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsChatLoading(true)

    try {
      const response = await fetch('/api/chat-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          currentAbc: abcInput,
          history: chatMessages
        })
      })

      if (!response.ok) throw new Error('Failed to get response')

      const data = await response.json()

      setChatMessages(prev => [...prev, { role: 'assistant', content: data.message }])

      if (data.abc) {
        setAbcInput(data.abc)
      }
    } catch (error) {
      console.error('Chat error:', error)
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }])
    } finally {
      setIsChatLoading(false)
    }
  }

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatMessages])

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <Link href={user ? '/dashboard' : '/'}>
            <Image
              src="/logo.png"
              alt="TuneForm AI Logo"
              width={32}
              height={32}
              className="dashboard-logo"
              priority
            />
          </Link>
          <h1>{currentProject ? currentProject.name : 'TunesForm AI'}</h1>
          {hasUnsavedChanges && <span className="unsaved-indicator">*</span>}
        </div>
        <div className="header-right">
          {user ? (
            <>
              {currentProject ? (
                <button
                  className="btn-save"
                  onClick={saveProject}
                  disabled={isSaving || !hasUnsavedChanges}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              ) : (
                <button
                  className="btn-save"
                  onClick={() => setShowSaveModal(true)}
                >
                  Save as Project
                </button>
              )}
              <Link href="/dashboard" className="btn-dashboard">
                Dashboard
              </Link>
            </>
          ) : (
            <Link href="/login" className="btn-login">
              Sign In
            </Link>
          )}
          <div className="system-status">
            <div className="status-dot"></div>
            <span>SYSTEMS OPERATIONAL</span>
          </div>
        </div>
      </header>

      {showSaveModal && (
        <div className="save-modal-overlay">
          <div className="save-modal">
            <h3>Save as New Project</h3>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project name"
              autoFocus
            />
            <div className="save-modal-actions">
              <button onClick={() => setShowSaveModal(false)} className="btn-cancel">
                Cancel
              </button>
              <button
                onClick={() => saveAsNewProject(newProjectName)}
                disabled={isSaving || !newProjectName.trim()}
                className="btn-create"
              >
                {isSaving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {status && (
        <div className={`dashboard-status ${status.type}`}>
          {status.type === 'loading' && <span className="animate-spin mr-2">⟳</span>}
          {status.message}
        </div>
      )}

      <main className="dashboard-main">
        {/* Three Column Layout */}
        <div className="three-column">
          {/* ABC Notation Panel */}
          <section className="notation-panel">
            <div className="panel-header">
              <h2>SOURCE_CODE // <a href="https://docs.abcjs.net/overview/abc-notation.html" target="_blank" rel="noopener noreferrer">ABCJS</a></h2>
              <button
                className="btn-header-upload"
                onClick={handleUploadClick}
                disabled={isUploading}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <span>{isUploading ? 'ANALYZING...' : 'UPLOAD'}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,application/pdf"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </div>
            <textarea
              id="abc-input"
              className="abc-editor"
              spellCheck={false}
              value={abcInput}
              onChange={(e) => setAbcInput(e.target.value)}
              placeholder="X:1&#10;T:Title&#10;M:4/4&#10;L:1/8&#10;K:C&#10;CDEF GABc |"
            />
          </section>

          {/* Rendered Sheet Music Panel */}
          <section className="sheet-music-panel">
            <div className="panel-header">
              <h2>VISUAL_RENDER // SCORE</h2>
              <div className="header-controls">
                <button
                  className="btn-edit"
                  onClick={() => setIsEditorOpen(true)}
                  title="Edit Score"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  <span>EDIT</span>
                </button>
                <div className="playback-buttons">
                  <button className="btn-icon" onClick={handlePlayOriginal} title="Play">▶</button>
                  <button className="btn-icon" onClick={handleStopOriginal} title="Stop">■</button>
                </div>
                <button
                  className="btn-header-upload"
                  onClick={handleDownloadPdf}
                  disabled={isUploading}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  <span>PDF</span>
                </button>
              </div>
            </div>
            <div className="sheet-music-container">
              <div ref={originalScoreRef} className={`score-render ${isEditorOpen ? (selectedTool.type === 'select' ? 'selecting' : 'editing') : ''}`}>
                {!abcInput && (
                  <div className="empty-state">
                    <p>AWAITING INPUT SEQUENCE...</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* AI Chat Panel */}
          <section className="chat-panel">
          <div className="panel-header">
            <h2>AI_COMPOSER // CHAT</h2>
          </div>
          <div className="chat-container" ref={chatContainerRef}>
            {chatMessages.length === 0 ? (
              <div className="chat-empty">
                <p>Describe the music you want to create...</p>
                <div className="chat-suggestions">
                  <button onClick={() => setChatInput('Create a 12-bar blues in C major')}>
                    12-bar blues in C
                  </button>
                  <button onClick={() => setChatInput('Write a simple waltz in G major, 16 bars')}>
                    Simple waltz in G
                  </button>
                  <button onClick={() => setChatInput('Create a jazz lead sheet with ii-V-I progression')}>
                    Jazz ii-V-I progression
                  </button>
                </div>
              </div>
            ) : (
              chatMessages.map((msg, i) => (
                <div key={i} className={`chat-message ${msg.role}`}>
                  <div className="chat-message-label">
                    {msg.role === 'user' ? 'YOU' : 'TUNESFORM AI'}
                  </div>
                  <div className="chat-message-content">{msg.content}</div>
                </div>
              ))
            )}
            {isChatLoading && (
              <div className="chat-message assistant">
                <div className="chat-message-label">TUNESFORM AI</div>
                <div className="chat-message-content chat-loading">
                  <span className="loading-dot">.</span>
                  <span className="loading-dot">.</span>
                  <span className="loading-dot">.</span>
                </div>
              </div>
            )}
          </div>
          <form className="chat-input-form" onSubmit={handleChatSubmit}>
            <textarea
              className="chat-input"
              placeholder="Describe what you want to create..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleChatSubmit(e)
                }
              }}
              disabled={isChatLoading}
              rows={1}
            />
            <button
              type="submit"
              className="chat-submit"
              disabled={isChatLoading || !chatInput.trim()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </form>
        </section>
        </div>
      </main>

      <ScoreEditor
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false)
          setSelectedElement(null)
        }}
        selectedTool={selectedTool}
        onToolChange={(tool) => {
          setSelectedTool(tool)
          // Clear selection when switching away from select mode
          if (tool.type !== 'select') {
            setSelectedElement(null)
          }
        }}
      />
    </div>
  )
}
