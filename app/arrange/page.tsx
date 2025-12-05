'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

declare global {
  interface Window {
    ABCJS: any
  }
}

const defaultABC = `X:1
T:Simple Waltz
+C:Traditional
M:3/4
L:1/8
Q:1/4=120
K:G
V:1
"RH" [G B d] d c | B2 A2 G2 | {a}g2 (3gag f2 | e2 d2 B2 |
V:2
"LH" G,2 G,2 G,2 | D,2 D,2 D,2 | C,2 C,2 C,2 | G,,2 G,,2 G,,2 |
`

export default function Home() {
  const [abcInput, setAbcInput] = useState(defaultABC)
  const [simplifiedAbc, setSimplifiedAbc] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [status, setStatus] = useState<{type: 'success' | 'error' | 'loading', message: string} | null>(null)
  const [settings, setSettings] = useState({
    removeOrnaments: true,
    reduceChords: true,
    dropSecondaryVoices: true,
    limitRhythm: true,
    simplifyTies: false,
    useAI: true
  })

  const originalScoreRef = useRef<HTMLDivElement>(null)
  const simplifiedScoreRef = useRef<HTMLDivElement>(null)
  const originalSynthControlRef = useRef<any>(null)
  const simplifiedSynthControlRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Load abcjs from CDN
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/abcjs@6.4.4/dist/abcjs-basic-min.js'
    script.onload = () => {
      console.log('abcjs loaded')
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

  const simplifyWithAI = async (abcText: string) => {
    try {
      const response = await fetch('/api/simplify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          abc: abcText,
          settings: settings
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data.simplifiedAbc
    } catch (error) {
      console.error('AI simplification error:', error)
      throw error
    }
  }

  const simplifyAbc = (abc: string, options: typeof settings) => {
    let out = abc
    
    if (options.removeOrnaments) {
      // Remove grace note blocks {..}
      out = out.replace(/\{[^}]*\}/g, '')
      // Remove simple trill/roll annotations
      out = out.replace(/~|trill/g, '')
    }
    
    if (options.reduceChords) {
      // For chords like [CEG]n? -> keep first note only
      out = out.replace(/\[([^\]]+)\](\d*\/?\d*)/g, (m, inside, dur) => {
        const first = inside.trim().split(/\s+/)[0] || ''
        return first + (dur || '')
      })
    }
    
    if (options.dropSecondaryVoices) {
      // Keep only first V: header and its content
      const lines = out.split(/\r?\n/)
      let keptVoice = null
      const result = []
      for (const line of lines) {
        if (/^V:\s*/i.test(line)) {
          const id = line.replace(/^V:\s*/i, '').trim()
          if (keptVoice === null) {
            keptVoice = id
            result.push(line)
          }
          continue
        }
        if (keptVoice === null) {
          result.push(line) // headers before V:
        } else {
          if (!/^V:\s*/i.test(line)) result.push(line)
        }
      }
      out = result.join('\n')
    }
    
    if (options.limitRhythm) {
      // Map 1/16 and faster up to 1/8
      out = out.replace(/([_^=]?[A-Ga-g][,']*)(\d*\/?\d*)/g, (m, pitch, dur) => {
        if (!dur) return m
        const parts = dur.split('/')
        if (parts.length === 1) return m
        const denom = Number(parts[1] || '1')
        if (!Number.isFinite(denom) || denom === 0) return m
        if (denom >= 16) {
          return pitch + '/8'
        }
        return m
      })
    }
    
    if (options.simplifyTies) {
      out = out.replace(/\(|\)/g, '')
      out = out.replace(/-\s*/g, '')
    }
    
    // Normalize whitespace
    out = out
      .split(/\r?\n/)
      .map(l => l.replace(/\s+$/g, ''))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
    
    return out
  }

  const handleRenderOriginal = () => {
    if (!abcInput.trim()) {
      setAbcInput(defaultABC)
    }
    renderAbc(originalScoreRef.current, abcInput)
  }

  const handleSimplifyAndRender = async () => {
    if (!abcInput.trim()) {
      setAbcInput(defaultABC)
    }
    
    setIsLoading(true)
    showStatus('loading', 'Simplifying music...')
    
    try {
      let simplified: string
      
      if (settings.useAI) {
        simplified = await simplifyWithAI(abcInput)
      } else {
        simplified = simplifyAbc(abcInput, settings)
      }
      
      setSimplifiedAbc(simplified)
      renderAbc(simplifiedScoreRef.current, simplified)
      showStatus('success', 'Music simplified successfully!')
    } catch (error) {
      console.error('Simplification error:', error)
      showStatus('error', 'Failed to simplify music. Please try again.')
    } finally {
      setIsLoading(false)
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

  const handlePlaySimplified = () => {
    const text = simplifiedAbc || abcInput
    playScore(simplifiedScoreRef.current, text, (control) => {
      simplifiedSynthControlRef.current = control
    })
  }

  const handleStopSimplified = () => {
    if (simplifiedSynthControlRef.current) {
      simplifiedSynthControlRef.current.stop()
    }
  }

  const handleDownloadSimplified = () => {
    const data = simplifiedAbc || abcInput
    const blob = new Blob([data], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'simplified.abc'
    a.click()
    URL.revokeObjectURL(url)
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
    showStatus('loading', 'Reading sheet music from image...')

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          // Remove the data URL prefix to get just the base64 data
          const base64Data = result.split(',')[1]
          resolve(base64Data)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      // Store the image for preview
      setUploadedImage(`data:${file.type};base64,${base64}`)

      // Send to API
      const response = await fetch('/api/read-music', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64,
          mimeType: file.type
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.abc) {
        setAbcInput(data.abc)
        // Automatically render the result
        setTimeout(() => {
          renderAbc(originalScoreRef.current, data.abc)
        }, 100)
        showStatus('success', 'Sheet music read successfully! ABC notation generated.')
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

  const clearUploadedImage = () => {
    setUploadedImage(null)
  }

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
          <a href="https://www.abcjs.net/" target="_blank" rel="noreferrer noopener">abcjs</a>
          <span>•</span>
          <a href="https://www.zacharyyu.com/" target="_blank" rel="noreferrer noopener">Zachary Yu</a>
        </div>
      </header>

      {status && (
        <div className={`dashboard-status ${status.type}`}>
          {status.message}
        </div>
      )}

      <main className="dashboard-main">
        <section className="dashboard-input">
          <div className="input-header">
            <h2>Input</h2>
            <p className="input-subtitle">Upload sheet music or paste ABC notation</p>
          </div>

          <div className="input-actions-bar">
            <button
              className="btn-action btn-upload"
              onClick={handleUploadClick}
              disabled={isUploading || isLoading}
            >
              <span className="btn-icon-left">+</span>
              {isUploading ? 'Reading...' : 'Upload'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,application/pdf"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <button
              className="btn-action"
              onClick={handleRenderOriginal}
              disabled={isLoading || isUploading}
            >
              Render
            </button>
            <button
              className="btn-action btn-primary"
              onClick={handleSimplifyAndRender}
              disabled={isLoading || isUploading}
            >
              {isLoading ? 'Processing...' : 'Simplify'}
            </button>
          </div>

          {uploadedImage && (
            <div className="uploaded-image-preview">
              <div className="preview-header">
                <span>Uploaded Sheet Music</span>
                <button className="btn-icon btn-close" onClick={clearUploadedImage} title="Clear">×</button>
              </div>
              <img src={uploadedImage} alt="Uploaded sheet music" />
            </div>
          )}

          <textarea
            id="abc-input"
            spellCheck={false}
            value={abcInput}
            onChange={(e) => setAbcInput(e.target.value)}
            placeholder="X:1&#10;T:Title&#10;M:4/4&#10;K:C&#10;..."
          />

          <div className="settings-panel">
            <div className="settings-title">Simplification Options</div>
            <div className="settings-grid-modern">
              <label className="setting-item">
                <input
                  type="checkbox"
                  checked={settings.useAI}
                  onChange={(e) => setSettings({...settings, useAI: e.target.checked})}
                />
                <div className="setting-content">
                  <span className="setting-label">Use AI</span>
                  <span className="setting-desc">GPT-4 powered</span>
                </div>
              </label>
              <label className="setting-item">
                <input
                  type="checkbox"
                  checked={settings.removeOrnaments}
                  onChange={(e) => setSettings({...settings, removeOrnaments: e.target.checked})}
                />
                <div className="setting-content">
                  <span className="setting-label">No Ornaments</span>
                  <span className="setting-desc">Remove trills</span>
                </div>
              </label>
              <label className="setting-item">
                <input
                  type="checkbox"
                  checked={settings.reduceChords}
                  onChange={(e) => setSettings({...settings, reduceChords: e.target.checked})}
                />
                <div className="setting-content">
                  <span className="setting-label">Simple Chords</span>
                  <span className="setting-desc">Reduce notes</span>
                </div>
              </label>
              <label className="setting-item">
                <input
                  type="checkbox"
                  checked={settings.dropSecondaryVoices}
                  onChange={(e) => setSettings({...settings, dropSecondaryVoices: e.target.checked})}
                />
                <div className="setting-content">
                  <span className="setting-label">Single Voice</span>
                  <span className="setting-desc">Melody only</span>
                </div>
              </label>
              <label className="setting-item">
                <input
                  type="checkbox"
                  checked={settings.limitRhythm}
                  onChange={(e) => setSettings({...settings, limitRhythm: e.target.checked})}
                />
                <div className="setting-content">
                  <span className="setting-label">Simple Rhythm</span>
                  <span className="setting-desc">Slower notes</span>
                </div>
              </label>
            </div>
          </div>
        </section>

        <section className="dashboard-score">
          <div className="section-header">
            <h2>Original</h2>
            <div className="score-actions">
              <button className="btn-icon" onClick={handlePlayOriginal} title="Play">▶</button>
              <button className="btn-icon" onClick={handleStopOriginal} title="Stop">■</button>
            </div>
          </div>
          <div ref={originalScoreRef} className="score-container">
            {!abcInput && !uploadedImage && (
              <div className="empty-state">
                <p>Enter ABC notation or upload sheet music to see the score here</p>
              </div>
            )}
          </div>
        </section>

        <section className="dashboard-score">
          <div className="section-header">
            <h2>Simplified</h2>
            <div className="score-actions">
              <button className="btn-icon" onClick={handlePlaySimplified} title="Play">▶</button>
              <button className="btn-icon" onClick={handleStopSimplified} title="Stop">■</button>
              <button className="btn-icon" onClick={handleDownloadSimplified} title="Download">↓</button>
            </div>
          </div>
          <div ref={simplifiedScoreRef} className="score-container">
            {!simplifiedAbc && (
              <div className="empty-state">
                <p>Click "Simplify" to generate an easier version</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
