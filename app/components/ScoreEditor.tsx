'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

export interface SelectedTool {
  type: 'note' | 'rest' | 'accidental' | 'dynamic' | 'articulation' | 'chord' | 'delete' | 'select'
  value: string
  duration: string
}

interface ScoreEditorProps {
  isOpen: boolean
  onClose: () => void
  selectedTool: SelectedTool
  onToolChange: (tool: SelectedTool) => void
}

interface Position {
  x: number
  y: number
}

export default function ScoreEditor({ isOpen, onClose, selectedTool, onToolChange }: ScoreEditorProps) {
  const [position, setPosition] = useState<Position>({ x: 100, y: 100 })
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 400, height: 500 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 })
  const [activeTab, setActiveTab] = useState<'notes' | 'dynamics' | 'articulation' | 'chords'>('notes')

  const popupRef = useRef<HTMLDivElement>(null)

  // Center popup on open
  useEffect(() => {
    if (isOpen) {
      const centerX = (window.innerWidth - 500) / 2
      setPosition({ x: Math.max(50, centerX), y: 80 })
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
      if (isResizing) {
        const newWidth = Math.max(320, e.clientX - position.x)
        const newHeight = Math.max(300, e.clientY - position.y)
        setSize({ width: newWidth, height: newHeight })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(false)
    }

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isResizing, dragOffset, position.x, position.y])

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
  }, [])

  const selectNote = (note: string) => {
    onToolChange({ ...selectedTool, type: 'note', value: note })
  }

  const selectDuration = (duration: string) => {
    onToolChange({ ...selectedTool, duration })
  }

  const selectRest = (restValue: string) => {
    onToolChange({ ...selectedTool, type: 'rest', value: restValue })
  }

  const selectAccidental = (acc: string) => {
    onToolChange({ ...selectedTool, type: 'accidental', value: acc })
  }

  const selectDynamic = (dyn: string) => {
    onToolChange({ type: 'dynamic', value: dyn, duration: selectedTool.duration })
  }

  const selectArticulation = (art: string) => {
    onToolChange({ type: 'articulation', value: art, duration: selectedTool.duration })
  }

  const selectChord = (chord: string) => {
    onToolChange({ type: 'chord', value: chord, duration: selectedTool.duration })
  }

  const selectDelete = () => {
    onToolChange({ type: 'delete', value: '', duration: '' })
  }

  const selectPointer = () => {
    onToolChange({ type: 'select', value: '', duration: '' })
  }

  if (!isOpen) return null

  const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
  const notesHigh = ['c', 'd', 'e', 'f', 'g', 'a', 'b']

  // SVG icons for note durations
  const NoteIcons = {
    whole: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <ellipse cx="12" cy="12" rx="6" ry="4" fill="none" stroke="currentColor" strokeWidth="2"/>
      </svg>
    ),
    half: (
      <svg width="20" height="24" viewBox="0 0 20 28" fill="currentColor">
        <ellipse cx="7" cy="22" rx="5" ry="3.5" fill="none" stroke="currentColor" strokeWidth="2" transform="rotate(-20 7 22)"/>
        <line x1="12" y1="20" x2="12" y2="2" stroke="currentColor" strokeWidth="2"/>
      </svg>
    ),
    quarter: (
      <svg width="20" height="24" viewBox="0 0 20 28" fill="currentColor">
        <ellipse cx="7" cy="22" rx="5" ry="3.5" fill="currentColor" transform="rotate(-20 7 22)"/>
        <line x1="12" y1="20" x2="12" y2="2" stroke="currentColor" strokeWidth="2"/>
      </svg>
    ),
    eighth: (
      <svg width="20" height="24" viewBox="0 0 20 28" fill="currentColor">
        <ellipse cx="7" cy="22" rx="5" ry="3.5" fill="currentColor" transform="rotate(-20 7 22)"/>
        <line x1="12" y1="20" x2="12" y2="2" stroke="currentColor" strokeWidth="2"/>
        <path d="M12 2 Q18 6 14 12" fill="none" stroke="currentColor" strokeWidth="2"/>
      </svg>
    ),
    sixteenth: (
      <svg width="20" height="24" viewBox="0 0 20 28" fill="currentColor">
        <ellipse cx="7" cy="22" rx="5" ry="3.5" fill="currentColor" transform="rotate(-20 7 22)"/>
        <line x1="12" y1="20" x2="12" y2="2" stroke="currentColor" strokeWidth="2"/>
        <path d="M12 2 Q18 5 14 10" fill="none" stroke="currentColor" strokeWidth="2"/>
        <path d="M12 6 Q18 9 14 14" fill="none" stroke="currentColor" strokeWidth="2"/>
      </svg>
    ),
  }

  const durations = [
    { icon: NoteIcons.whole, value: '8', title: 'Whole Note' },
    { icon: NoteIcons.half, value: '4', title: 'Half Note' },
    { icon: NoteIcons.quarter, value: '2', title: 'Quarter Note' },
    { icon: NoteIcons.eighth, value: '', title: '8th Note' },
    { icon: NoteIcons.sixteenth, value: '/2', title: '16th Note' },
  ]

  // SVG icons for rests
  const RestIcons = {
    whole: (
      <svg width="24" height="20" viewBox="0 0 24 20" fill="currentColor">
        <rect x="4" y="6" width="16" height="4" fill="currentColor"/>
      </svg>
    ),
    half: (
      <svg width="24" height="20" viewBox="0 0 24 20" fill="currentColor">
        <rect x="4" y="10" width="16" height="4" fill="currentColor"/>
      </svg>
    ),
    quarter: (
      <svg width="20" height="28" viewBox="0 0 20 28" fill="currentColor">
        <path d="M12 2 L8 8 L12 10 L8 16 L10 18 Q6 22 8 26 Q12 24 10 20 L14 14 L10 12 L14 6 Z" fill="currentColor"/>
      </svg>
    ),
    eighth: (
      <svg width="20" height="28" viewBox="0 0 20 28" fill="currentColor">
        <path d="M14 4 Q8 8 10 12 L8 12 Q6 16 10 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="12" cy="6" r="2.5" fill="currentColor"/>
      </svg>
    ),
    sixteenth: (
      <svg width="20" height="28" viewBox="0 0 20 28" fill="currentColor">
        <path d="M14 2 Q8 6 10 10 L8 10 Q6 14 10 16 L8 16 Q6 20 10 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="12" cy="4" r="2" fill="currentColor"/>
        <circle cx="12" cy="12" r="2" fill="currentColor"/>
      </svg>
    ),
  }

  const rests = [
    { icon: RestIcons.whole, value: 'z8', title: 'Whole Rest' },
    { icon: RestIcons.half, value: 'z4', title: 'Half Rest' },
    { icon: RestIcons.quarter, value: 'z2', title: 'Quarter Rest' },
    { icon: RestIcons.eighth, value: 'z', title: '8th Rest' },
    { icon: RestIcons.sixteenth, value: 'z/2', title: '16th Rest' },
  ]

  const accidentals = [
    { label: '♯', value: '^', title: 'Sharp' },
    { label: '♭', value: '_', title: 'Flat' },
    { label: '♮', value: '=', title: 'Natural' },
  ]

  const dynamics = [
    { label: 'pp', value: '!pp!' },
    { label: 'p', value: '!p!' },
    { label: 'mp', value: '!mp!' },
    { label: 'mf', value: '!mf!' },
    { label: 'f', value: '!f!' },
    { label: 'ff', value: '!ff!' },
  ]

  const articulations = [
    { label: '.', value: '.', title: 'Staccato' },
    { label: '>', value: '!accent!', title: 'Accent' },
    { label: '−', value: '!tenuto!', title: 'Tenuto' },
    { label: '𝄐', value: '!fermata!', title: 'Fermata' },
    { label: 'tr', value: '!trill!', title: 'Trill' },
  ]

  const chords = [
    'Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7b5',
    'C7', 'Cm7', 'Cdim7', 'Caug'
  ]

  return (
    <div className="score-editor-overlay">
      <div
        ref={popupRef}
        className="score-editor-popup score-editor-compact"
        style={{
          left: position.x,
          top: position.y,
          width: size.width,
          height: size.height,
          cursor: isDragging ? 'grabbing' : 'default'
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="editor-header">
          <div className="editor-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
            <span>NOTE PALETTE</span>
          </div>
          <div className="editor-mode-indicator">
            {selectedTool.type === 'select' && 'SELECT MODE'}
            {selectedTool.type === 'delete' && 'DELETE MODE'}
            {selectedTool.type === 'note' && `NOTE: ${selectedTool.value.toUpperCase()}`}
            {selectedTool.type === 'rest' && 'REST'}
            {selectedTool.type === 'chord' && `CHORD: ${selectedTool.value}`}
            {selectedTool.type === 'dynamic' && `DYNAMIC: ${selectedTool.value.replace(/!/g, '')}`}
            {selectedTool.type === 'articulation' && 'ARTICULATION'}
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
              className={`toolbar-tab ${activeTab === 'chords' ? 'active' : ''}`}
              onClick={() => setActiveTab('chords')}
            >
              Chords
            </button>
          </div>
        </div>

        <div className="editor-palette">
          {activeTab === 'notes' && (
            <>
              {/* Tool buttons */}
              <div className="palette-section">
                <div className="palette-label">Tools</div>
                <div className="palette-buttons">
                  <button
                    className={`palette-btn tool-btn ${selectedTool.type === 'select' ? 'selected' : ''}`}
                    onClick={selectPointer}
                    title="Select"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
                    </svg>
                  </button>
                  <button
                    className={`palette-btn tool-btn ${selectedTool.type === 'delete' ? 'selected' : ''}`}
                    onClick={selectDelete}
                    title="Delete"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Duration */}
              <div className="palette-section">
                <div className="palette-label">Duration</div>
                <div className="palette-buttons">
                  {durations.map((d) => (
                    <button
                      key={d.value}
                      className={`palette-btn duration-btn ${selectedTool.duration === d.value ? 'selected' : ''}`}
                      onClick={() => selectDuration(d.value)}
                      title={d.title}
                    >
                      {d.icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Accidentals */}
              <div className="palette-section">
                <div className="palette-label">Accidentals</div>
                <div className="palette-buttons">
                  {accidentals.map((a) => (
                    <button
                      key={a.value}
                      className={`palette-btn ${selectedTool.type === 'accidental' && selectedTool.value === a.value ? 'selected' : ''}`}
                      onClick={() => selectAccidental(a.value)}
                      title={a.title}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes - Low Octave */}
              <div className="palette-section">
                <div className="palette-label">Low Octave</div>
                <div className="palette-buttons">
                  {notes.map((note) => (
                    <button
                      key={note}
                      className={`palette-btn note-btn ${selectedTool.type === 'note' && selectedTool.value === note ? 'selected' : ''}`}
                      onClick={() => selectNote(note)}
                    >
                      {note}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes - High Octave */}
              <div className="palette-section">
                <div className="palette-label">High Octave</div>
                <div className="palette-buttons">
                  {notesHigh.map((note) => (
                    <button
                      key={note}
                      className={`palette-btn note-btn ${selectedTool.type === 'note' && selectedTool.value === note ? 'selected' : ''}`}
                      onClick={() => selectNote(note)}
                    >
                      {note}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rests */}
              <div className="palette-section">
                <div className="palette-label">Rests</div>
                <div className="palette-buttons">
                  {rests.map((r) => (
                    <button
                      key={r.value}
                      className={`palette-btn duration-btn ${selectedTool.type === 'rest' && selectedTool.value === r.value ? 'selected' : ''}`}
                      onClick={() => selectRest(r.value)}
                      title={r.title}
                    >
                      {r.icon}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'dynamics' && (
            <div className="palette-section">
              <div className="palette-label">Dynamics (click on score to add)</div>
              <div className="palette-buttons">
                {dynamics.map((d) => (
                  <button
                    key={d.value}
                    className={`palette-btn ${selectedTool.type === 'dynamic' && selectedTool.value === d.value ? 'selected' : ''}`}
                    onClick={() => selectDynamic(d.value)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'articulation' && (
            <div className="palette-section">
              <div className="palette-label">Articulations (click on score to add)</div>
              <div className="palette-buttons">
                {articulations.map((a) => (
                  <button
                    key={a.value}
                    className={`palette-btn ${selectedTool.type === 'articulation' && selectedTool.value === a.value ? 'selected' : ''}`}
                    onClick={() => selectArticulation(a.value)}
                    title={a.title}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'chords' && (
            <div className="palette-section">
              <div className="palette-label">Jazz Chords (click on score to add)</div>
              <div className="palette-buttons chords-grid">
                {chords.map((chord) => (
                  <button
                    key={chord}
                    className={`palette-btn ${selectedTool.type === 'chord' && selectedTool.value === chord ? 'selected' : ''}`}
                    onClick={() => selectChord(chord)}
                  >
                    {chord}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="editor-footer-hint">
          Click on the score to place notes
        </div>

        {/* Resize handle */}
        <div
          className="resize-handle"
          onMouseDown={handleResizeStart}
        />
      </div>
    </div>
  )
}
