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

  return (
    <>
      <header className="app-header">
        <Image 
          src="/logo.png" 
          alt="TuneForm AI Logo" 
          width={48} 
          height={48}
          className="logo-3d-image-small"
          priority
        />
        <div>
          <h1>TuneForm AI</h1>
          <p>Simplify piano sheet music with AI</p>
        </div>
      </header>

      <main className="container">
        {status && (
          <div className={`status ${status.type}`}>
            {status.message}
          </div>
        )}

        <section className="panel">
          <h2>Input</h2>
          <div className="input-row">
            <label htmlFor="pdf-input" className="label">Upload PDF</label>
            <div className="file-upload-wrapper">
              <input 
                type="file" 
                id="pdf-input" 
                accept="application/pdf" 
              />
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  const fileInput = document.getElementById('pdf-input') as HTMLInputElement
                  if (!fileInput?.files || fileInput.files.length === 0) {
                    showStatus('error', 'Please select a PDF file first')
                    return
                  }
                  showStatus('loading', 'PDF processing not yet implemented. Please paste ABC notation below.')
                }}
              >
                Process PDF
              </button>
            </div>
            <small className="help">Note: PDF-to-ABC conversion requires OMR software. For now, paste ABC notation below.</small>
          </div>
          <div className="input-col">
            <label htmlFor="abc-input" className="label">ABC Notation</label>
            <textarea 
              id="abc-input" 
              rows={10} 
              spellCheck={false}
              value={abcInput}
              onChange={(e) => setAbcInput(e.target.value)}
              placeholder="Paste your ABC notation here..."
            />
            <div className="row gap">
              <button 
                className="btn btn-secondary" 
                onClick={handleRenderOriginal}
                disabled={isLoading}
              >
                Render Original
              </button>
              <button 
                className="btn" 
                onClick={handleSimplifyAndRender}
                disabled={isLoading}
              >
                {isLoading ? 'Simplifying...' : 'Simplify'}
              </button>
            </div>
          </div>
        </section>

        <section className="panel">
          <h2>Settings</h2>
          <div className="settings-grid">
            <label className="switch">
              <input 
                type="checkbox" 
                checked={settings.useAI}
                onChange={(e) => setSettings({...settings, useAI: e.target.checked})}
              />
              <span>Use AI simplification</span>
            </label>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={settings.removeOrnaments}
                onChange={(e) => setSettings({...settings, removeOrnaments: e.target.checked})}
              />
              <span>Remove ornaments</span>
            </label>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={settings.reduceChords}
                onChange={(e) => setSettings({...settings, reduceChords: e.target.checked})}
              />
              <span>Simplify chords</span>
            </label>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={settings.dropSecondaryVoices}
                onChange={(e) => setSettings({...settings, dropSecondaryVoices: e.target.checked})}
              />
              <span>Single voice only</span>
            </label>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={settings.limitRhythm}
                onChange={(e) => setSettings({...settings, limitRhythm: e.target.checked})}
              />
              <span>Simplify rhythms</span>
            </label>
          </div>
        </section>

        <section className="panel">
          <h2>Output</h2>
          <div className="columns">
            <div className="col">
              <h3>Original</h3>
              <div ref={originalScoreRef} id="original-score"></div>
              <div className="row gap">
                <button className="btn btn-secondary" onClick={handlePlayOriginal}>Play</button>
                <button className="btn btn-secondary" onClick={handleStopOriginal}>Stop</button>
              </div>
            </div>
            <div className="col">
              <h3>Simplified</h3>
              <div ref={simplifiedScoreRef} id="simplified-score"></div>
              <div className="row gap">
                <button className="btn btn-secondary" onClick={handlePlaySimplified}>Play</button>
                <button className="btn btn-secondary" onClick={handleStopSimplified}>Stop</button>
              </div>
            </div>
          </div>

          <div className="export-row">
            <button className="btn btn-secondary" onClick={handleDownloadSimplified}>Download ABC</button>
          </div>
        </section>
      </main>

      <footer className="app-footer">
        Powered by <a href="https://www.abcjs.net/" target="_blank" rel="noreferrer noopener">abcjs</a>. Built by <a href="https://www.linkedin.com/in/zacharyyu/" target="_blank" rel="noreferrer noopener">Zachary Yu</a>
      </footer>
    </>
  )
}
