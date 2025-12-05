'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { jsPDF } from 'jspdf'
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
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [imageQuality, setImageQuality] = useState<QualityReport | null>(null)
  const [processingInfo, setProcessingInfo] = useState<string[]>([])
  const [status, setStatus] = useState<{type: 'success' | 'error' | 'loading', message: string} | null>(null)

  const originalScoreRef = useRef<HTMLDivElement>(null)
  const originalSynthControlRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleDownloadAbc = () => {
    const data = abcInput
    const blob = new Blob([data], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'lead-sheet.abc'
    a.click()
    URL.revokeObjectURL(url)
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
            <button
              className="btn-upload-full"
              onClick={handleUploadClick}
              disabled={isUploading}
            >
              <div className="upload-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <span>{isUploading ? 'ANALYZING...' : 'UPLOAD SHEET MUSIC'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,application/pdf"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
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
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-section">
            {uploadedImage && (
              <div className="sidebar-preview">
                <div className="preview-header">
                  <span>PREVIEW</span>
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
                    <div className="terminal-line">Ready.</div>
                  </div>
                )}
              </div>
            )}

            <div className="sidebar-actions">
              <button
                className="btn-sidebar btn-simplify"
                onClick={handleDownloadPdf}
                disabled={isUploading}
              >
                DOWNLOAD PDF
              </button>
            </div>

            <div className="playback-controls">
              <div className="playback-row">
                <span>PLAYBACK</span>
                <div className="playback-buttons">
                  <button className="btn-icon" onClick={handlePlayOriginal} title="Play">▶</button>
                  <button className="btn-icon" onClick={handleStopOriginal} title="Stop">■</button>
                  <button className="btn-icon" onClick={handleDownloadAbc} title="Download ABC">↓</button>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}
