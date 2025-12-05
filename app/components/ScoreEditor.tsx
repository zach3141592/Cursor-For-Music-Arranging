'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface ScoreEditorProps {
  isOpen: boolean
  onClose: () => void
  abcNotation: string
  onSave: (newAbc: string) => void
}

interface Position {
  x: number
  y: number
}

export default function ScoreEditor({ isOpen, onClose, abcNotation, onSave }: ScoreEditorProps) {
  const [editedAbc, setEditedAbc] = useState(abcNotation)
  const [position, setPosition] = useState<Position>({ x: 100, y: 100 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 })
  const [activeTab, setActiveTab] = useState<'notes' | 'dynamics' | 'articulation' | 'text'>('notes')

  const popupRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  // Update local state when prop changes
  useEffect(() => {
    setEditedAbc(abcNotation)
  }, [abcNotation])

  // Render preview when editedAbc changes
  useEffect(() => {
    if (isOpen && previewRef.current && (window as any).ABCJS) {
      try {
        previewRef.current.innerHTML = ''
        ;(window as any).ABCJS.renderAbc(previewRef.current, editedAbc, {
          responsive: 'resize',
          staffwidth: 400
        })
      } catch (e) {
        console.error('Preview render error:', e)
      }
    }
  }, [editedAbc, isOpen])

  // Center popup on open
  useEffect(() => {
    if (isOpen) {
      const centerX = (window.innerWidth - 600) / 2
      const centerY = (window.innerHeight - 500) / 2
      setPosition({ x: Math.max(50, centerX), y: Math.max(50, centerY) })
    }
  }, [isOpen])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.editor-header')) {
      setIsDragging(true)
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      })
    }
  }, [position])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset])

  const insertAtCursor = (text: string) => {
    const textarea = document.getElementById('score-editor-textarea') as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newText = editedAbc.substring(0, start) + text + editedAbc.substring(end)
    setEditedAbc(newText)

    // Restore cursor position after state update
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + text.length, start + text.length)
    }, 0)
  }

  const handleSave = () => {
    onSave(editedAbc)
    onClose()
  }

  if (!isOpen) return null

  const noteButtons = [
    { label: 'C', value: 'C' },
    { label: 'D', value: 'D' },
    { label: 'E', value: 'E' },
    { label: 'F', value: 'F' },
    { label: 'G', value: 'G' },
    { label: 'A', value: 'A' },
    { label: 'B', value: 'B' },
    { label: 'c', value: 'c' },
    { label: 'd', value: 'd' },
    { label: 'e', value: 'e' },
    { label: 'f', value: 'f' },
    { label: 'g', value: 'g' },
    { label: 'a', value: 'a' },
    { label: 'b', value: 'b' },
  ]

  const durationButtons = [
    { label: '16th', value: '/2' },
    { label: '8th', value: '' },
    { label: 'Qtr', value: '2' },
    { label: 'Half', value: '4' },
    { label: 'Whole', value: '8' },
  ]

  const accidentalButtons = [
    { label: '#', value: '^' },
    { label: 'b', value: '_' },
    { label: 'Natural', value: '=' },
  ]

  const restButtons = [
    { label: '16th Rest', value: 'z/2' },
    { label: '8th Rest', value: 'z' },
    { label: 'Qtr Rest', value: 'z2' },
    { label: 'Half Rest', value: 'z4' },
    { label: 'Whole Rest', value: 'z8' },
  ]

  const dynamicButtons = [
    { label: 'pp', value: '!pp!' },
    { label: 'p', value: '!p!' },
    { label: 'mp', value: '!mp!' },
    { label: 'mf', value: '!mf!' },
    { label: 'f', value: '!f!' },
    { label: 'ff', value: '!ff!' },
    { label: 'cresc', value: '!crescendo(!' },
    { label: 'decresc', value: '!diminuendo(!' },
  ]

  const articulationButtons = [
    { label: 'Staccato', value: '.' },
    { label: 'Accent', value: '!accent!' },
    { label: 'Tenuto', value: '!tenuto!' },
    { label: 'Fermata', value: '!fermata!' },
    { label: 'Trill', value: '!trill!' },
    { label: 'Turn', value: '!turn!' },
    { label: 'Mordent', value: '!mordent!' },
    { label: 'Slide', value: '!slide!' },
  ]

  const structureButtons = [
    { label: 'Bar', value: '|' },
    { label: 'Double Bar', value: '||' },
    { label: 'Repeat Start', value: '|:' },
    { label: 'Repeat End', value: ':|' },
    { label: 'End Bar', value: '|]' },
    { label: 'Tie', value: '-' },
    { label: 'Slur Start', value: '(' },
    { label: 'Slur End', value: ')' },
  ]

  const chordButtons = [
    { label: 'Cmaj7', value: '"Cmaj7"' },
    { label: 'Dm7', value: '"Dm7"' },
    { label: 'G7', value: '"G7"' },
    { label: 'Am7', value: '"Am7"' },
    { label: 'Em7', value: '"Em7"' },
    { label: 'Fmaj7', value: '"Fmaj7"' },
    { label: 'Bm7b5', value: '"Bm7b5"' },
  ]

  return (
    <div className="score-editor-overlay">
      <div
        ref={popupRef}
        className="score-editor-popup"
        style={{
          left: position.x,
          top: position.y,
          cursor: isDragging ? 'grabbing' : 'default'
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="editor-header">
          <div className="editor-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v18"/>
              <path d="M8 21h8"/>
              <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"/>
            </svg>
            <span>SCORE EDITOR</span>
          </div>
          <button className="editor-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="editor-toolbar">
          <div className="toolbar-tabs">
            <button
              className={`toolbar-tab ${activeTab === 'notes' ? 'active' : ''}`}
              onClick={() => setActiveTab('notes')}
            >
              Notes
            </button>
            <button
              className={`toolbar-tab ${activeTab === 'dynamics' ? 'active' : ''}`}
              onClick={() => setActiveTab('dynamics')}
            >
              Dynamics
            </button>
            <button
              className={`toolbar-tab ${activeTab === 'articulation' ? 'active' : ''}`}
              onClick={() => setActiveTab('articulation')}
            >
              Articulation
            </button>
            <button
              className={`toolbar-tab ${activeTab === 'text' ? 'active' : ''}`}
              onClick={() => setActiveTab('text')}
            >
              Chords
            </button>
          </div>
        </div>

        <div className="editor-palette">
          {activeTab === 'notes' && (
            <>
              <div className="palette-section">
                <div className="palette-label">Notes (Uppercase=Low, Lowercase=High)</div>
                <div className="palette-buttons">
                  {noteButtons.map((btn) => (
                    <button
                      key={btn.label}
                      className="palette-btn note-btn"
                      onClick={() => insertAtCursor(btn.value)}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="palette-section">
                <div className="palette-label">Duration</div>
                <div className="palette-buttons">
                  {durationButtons.map((btn) => (
                    <button
                      key={btn.label}
                      className="palette-btn"
                      onClick={() => insertAtCursor(btn.value)}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="palette-section">
                <div className="palette-label">Accidentals</div>
                <div className="palette-buttons">
                  {accidentalButtons.map((btn) => (
                    <button
                      key={btn.label}
                      className="palette-btn"
                      onClick={() => insertAtCursor(btn.value)}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="palette-section">
                <div className="palette-label">Rests</div>
                <div className="palette-buttons">
                  {restButtons.map((btn) => (
                    <button
                      key={btn.label}
                      className="palette-btn"
                      onClick={() => insertAtCursor(btn.value)}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="palette-section">
                <div className="palette-label">Structure</div>
                <div className="palette-buttons">
                  {structureButtons.map((btn) => (
                    <button
                      key={btn.label}
                      className="palette-btn"
                      onClick={() => insertAtCursor(btn.value)}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'dynamics' && (
            <div className="palette-section">
              <div className="palette-label">Dynamics</div>
              <div className="palette-buttons">
                {dynamicButtons.map((btn) => (
                  <button
                    key={btn.label}
                    className="palette-btn"
                    onClick={() => insertAtCursor(btn.value)}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'articulation' && (
            <div className="palette-section">
              <div className="palette-label">Articulations & Ornaments</div>
              <div className="palette-buttons">
                {articulationButtons.map((btn) => (
                  <button
                    key={btn.label}
                    className="palette-btn"
                    onClick={() => insertAtCursor(btn.value)}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'text' && (
            <div className="palette-section">
              <div className="palette-label">Common Jazz Chords</div>
              <div className="palette-buttons">
                {chordButtons.map((btn) => (
                  <button
                    key={btn.label}
                    className="palette-btn"
                    onClick={() => insertAtCursor(btn.value)}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="editor-content">
          <div className="editor-preview-section">
            <div className="preview-label">PREVIEW</div>
            <div ref={previewRef} className="editor-preview"></div>
          </div>
          <div className="editor-text-section">
            <div className="text-label">ABC NOTATION</div>
            <textarea
              id="score-editor-textarea"
              className="editor-textarea"
              value={editedAbc}
              onChange={(e) => setEditedAbc(e.target.value)}
              spellCheck={false}
            />
          </div>
        </div>

        <div className="editor-footer">
          <button className="editor-btn cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="editor-btn save" onClick={handleSave}>
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  )
}
