'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { jsPDF } from 'jspdf'
import { preprocessImage } from '../lib/imagePreprocessing'

declare global {
  interface Window {
    ABCJS: any
  }
}

const defaultABC = `X: 1
T: YOUR LEAD SHEET
`

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export default function Home() {
  const [abcInput, setAbcInput] = useState(defaultABC)
  const [isUploading, setIsUploading] = useState(false)
  const [status, setStatus] = useState<{type: 'success' | 'error' | 'loading', message: string} | null>(null)

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)

  const originalScoreRef = useRef<HTMLDivElement>(null)
  const originalSynthControlRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const [abcjsLoaded, setAbcjsLoaded] = useState(false)

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

  // Auto-render when ABC input changes
  useEffect(() => {
    if (abcjsLoaded && abcInput.trim()) {
      renderAbc(originalScoreRef.current, abcInput)
    }
  }, [abcInput, abcjsLoaded])

  const showStatus = (type: 'success' | 'error' | 'loading', message: string) => {
    setStatus({ type, message })
    setTimeout(() => setStatus(null), 5000)
  }

  const renderAbc = (targetEl: HTMLElement | null, abcText: string) => {
    if (!targetEl || !window.ABCJS) return null
    
    try {
      targetEl.innerHTML = ''
      return window.ABCJS.renderAbc(targetEl, abcText, { responsive: 'resize' })
    } catch (e) {
      console.error(e)
      showStatus('error', 'Render error: ' + (e as Error).message)
      return null
    }
  }

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
          <Image
            src="/logo.png"
            alt="TuneForm AI Logo"
            width={32}
            height={32}
            className="dashboard-logo"
            priority
          />
          <h1>TunesForm AI</h1>
        </div>
        <div className="header-right">
          <div className="system-status">
            <div className="status-dot"></div>
            <span>SYSTEMS OPERATIONAL</span>
          </div>
        </div>
      </header>

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
              <h2>SOURCE_CODE // ABCJS</h2>
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
              <div ref={originalScoreRef} className="score-render">
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
    </div>
  )
}
