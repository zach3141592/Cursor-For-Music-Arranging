'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { preprocessImage, quickQualityCheck, type QualityReport } from '../lib/imagePreprocessing'

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
  const [imageQuality, setImageQuality] = useState<QualityReport | null>(null)
  const [processingInfo, setProcessingInfo] = useState<string[]>([])
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
      out = out.replace(/\[([^\]]+)\](\d*\/?\d*)/g, (_match, inside, dur) => {
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
    setImageQuality(null)
    setProcessingInfo([])
    showStatus('loading', 'Analyzing image quality...')

    try {
      // Convert file to data URL
      const originalDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      // Quick quality check first
      showStatus('loading', 'Checking image quality...')
      const qualityCheck = await quickQualityCheck(originalDataUrl)
      setImageQuality(qualityCheck)

      // Preprocess the image (resize, enhance contrast)
      showStatus('loading', 'Optimizing image for recognition...')
      const preprocessResult = await preprocessImage(originalDataUrl, {
        maxDimension: 2048,
        enhanceContrast: true,
        contrastFactor: 1.3
      })

      setProcessingInfo(preprocessResult.processingApplied)
      setUploadedImage(preprocessResult.processedDataUrl)

      // Extract base64 from processed data URL
      const base64 = preprocessResult.processedDataUrl.split(',')[1]
      const mimeType = preprocessResult.processedDataUrl.split(';')[0].split(':')[1]

      // Show quality warnings if any
      if (qualityCheck.warnings.length > 0) {
        console.log('Quality warnings:', qualityCheck.warnings)
      }

      // Send to API with two-pass verification
      showStatus('loading', 'AI is reading the sheet music (Pass 1 of 2)...')

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
        // Automatically render the result
        setTimeout(() => {
          renderAbc(originalScoreRef.current, data.abc)
        }, 100)

        // Build success message with details
        let successMsg = 'Sheet music converted to ABC notation!'
        if (data.fixes && data.fixes.length > 0) {
          successMsg += ` (${data.fixes.length} auto-corrections applied)`
        }
        showStatus('success', successMsg)
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
    setImageQuality(null)
    setProcessingInfo([])
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
          <div className="system-status">
            <div className="status-dot"></div>
            <span>SYSTEM READY</span>
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
        {/* Main Content Area - Split View */}
        <div className="content-area">
          {/* ABC Notation Panel */}
          <section className="notation-panel">
            <div className="panel-header">
              <h2>SOURCE_CODE // ABC</h2>
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
            </div>
            <div className="sheet-music-container">
              <div ref={originalScoreRef} className="score-render">
                {!abcInput && (
                  <div className="empty-state">
                    <p>AWAITING INPUT SEQUENCE...</p>
                  </div>
                )}
              </div>
              {simplifiedAbc && (
                <div className="simplified-section">
                  <h3>PROCESSED_OUTPUT_v1.0</h3>
                  <div ref={simplifiedScoreRef} className="score-render"></div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Left Sidebar - Settings */}
        <aside className="sidebar">
          <div className="sidebar-section">
            <h3 className="sidebar-title">DATA_INPUT //</h3>
            <button
              className="btn-upload-full"
              onClick={handleUploadClick}
              disabled={isUploading || isLoading}
            >
              <div className="upload-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <span>{isUploading ? 'ANALYZING INPUT...' : 'UPLOAD SHEET MUSIC'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,application/pdf"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            {uploadedImage && (
              <div className="sidebar-preview">
                <div className="preview-header">
                  <span>INPUT_PREVIEW</span>
                  <button className="btn-icon btn-close" onClick={clearUploadedImage} title="Clear">×</button>
                </div>
                <img src={uploadedImage} alt="Uploaded sheet music" />
                
                {(processingInfo.length > 0 || (imageQuality && imageQuality.warnings.length > 0)) && (
                  <div className="processing-terminal">
                    <div className="terminal-line">System diagnostic...</div>
                    {imageQuality?.warnings.map((warning, i) => (
                      <div key={`warn-${i}`} className="terminal-line" style={{ color: 'var(--warning)' }}>WARN: {warning}</div>
                    ))}
                    {processingInfo.map((info, i) => (
                      <div key={`proc-${i}`} className="terminal-line">EXEC: {info}</div>
                    ))}
                    <div className="terminal-line">Ready for processing.</div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-title">PROCESSING_PARAMETERS //</h3>
            <div className="settings-list">
              <label className="setting-toggle">
                <span className="toggle-label">AI_ENHANCEMENT (GPT-4)</span>
                <input
                  type="checkbox"
                  checked={settings.useAI}
                  onChange={(e) => setSettings({...settings, useAI: e.target.checked})}
                />
              </label>
              <label className="setting-toggle">
                <span className="toggle-label">REMOVE_ORNAMENTS</span>
                <input
                  type="checkbox"
                  checked={settings.removeOrnaments}
                  onChange={(e) => setSettings({...settings, removeOrnaments: e.target.checked})}
                />
              </label>
              <label className="setting-toggle">
                <span className="toggle-label">SIMPLIFY_CHORDS</span>
                <input
                  type="checkbox"
                  checked={settings.reduceChords}
                  onChange={(e) => setSettings({...settings, reduceChords: e.target.checked})}
                />
              </label>
              <label className="setting-toggle">
                <span className="toggle-label">SINGLE_VOICE_MODE</span>
                <input
                  type="checkbox"
                  checked={settings.dropSecondaryVoices}
                  onChange={(e) => setSettings({...settings, dropSecondaryVoices: e.target.checked})}
                />
              </label>
              <label className="setting-toggle">
                <span className="toggle-label">RHYTHM_QUANTIZATION</span>
                <input
                  type="checkbox"
                  checked={settings.limitRhythm}
                  onChange={(e) => setSettings({...settings, limitRhythm: e.target.checked})}
                />
              </label>
            </div>
          </div>

          <div className="sidebar-section sidebar-actions">
            <button
              className="btn-sidebar btn-render"
              onClick={handleRenderOriginal}
              disabled={isLoading || isUploading}
            >
              RENDER SOURCE
            </button>
            <button
              className="btn-sidebar btn-simplify"
              onClick={handleSimplifyAndRender}
              disabled={isLoading || isUploading}
            >
              {isLoading ? 'PROCESSING...' : 'EXECUTE SIMPLIFICATION'}
            </button>
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-title">AUDIO_OUTPUT //</h3>
            <div className="playback-controls">
              <div className="playback-row">
                <span>ORIGINAL_SOURCE</span>
                <div className="playback-buttons">
                  <button className="btn-icon" onClick={handlePlayOriginal} title="Play">▶</button>
                  <button className="btn-icon" onClick={handleStopOriginal} title="Stop">■</button>
                </div>
              </div>
              <div className="playback-row">
                <span>PROCESSED_OUTPUT</span>
                <div className="playback-buttons">
                  <button className="btn-icon" onClick={handlePlaySimplified} title="Play">▶</button>
                  <button className="btn-icon" onClick={handleStopSimplified} title="Stop">■</button>
                  <button className="btn-icon" onClick={handleDownloadSimplified} title="Download">↓</button>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}
