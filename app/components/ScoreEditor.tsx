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
  const [position, setPosition] = useState<Position>({ x: 100, y: 50 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 })
  const [activeTab, setActiveTab] = useState<'notes' | 'dynamics' | 'articulation' | 'chords'>('notes')

  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setPosition({ x: 100, y: 50 })
    }
  }, [isOpen])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.palette-header')) {
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

  const NoteIcons = {
    whole: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><ellipse cx="12" cy="12" rx="6" ry="4" fill="none" stroke="currentColor" strokeWidth="2"/></svg>,
    half: <svg width="20" height="24" viewBox="0 0 20 28" fill="currentColor"><ellipse cx="7" cy="22" rx="5" ry="3.5" fill="none" stroke="currentColor" strokeWidth="2" transform="rotate(-20 7 22)"/><line x1="12" y1="20" x2="12" y2="2" stroke="currentColor" strokeWidth="2"/></svg>,
    quarter: <svg width="20" height="24" viewBox="0 0 20 28" fill="currentColor"><ellipse cx="7" cy="22" rx="5" ry="3.5" fill="currentColor" transform="rotate(-20 7 22)"/><line x1="12" y1="20" x2="12" y2="2" stroke="currentColor" strokeWidth="2"/></svg>,
    eighth: <svg width="20" height="24" viewBox="0 0 20 28" fill="currentColor"><ellipse cx="7" cy="22" rx="5" ry="3.5" fill="currentColor" transform="rotate(-20 7 22)"/><line x1="12" y1="20" x2="12" y2="2" stroke="currentColor" strokeWidth="2"/><path d="M12 2 Q18 6 14 12" fill="none" stroke="currentColor" strokeWidth="2"/></svg>,
    sixteenth: <svg width="20" height="24" viewBox="0 0 20 28" fill="currentColor"><ellipse cx="7" cy="22" rx="5" ry="3.5" fill="currentColor" transform="rotate(-20 7 22)"/><line x1="12" y1="20" x2="12" y2="2" stroke="currentColor" strokeWidth="2"/><path d="M12 2 Q18 5 14 10" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M12 6 Q18 9 14 14" fill="none" stroke="currentColor" strokeWidth="2"/></svg>,
  }

  const RestIcons = {
    whole: <svg width="24" height="20" viewBox="0 0 24 20" fill="currentColor"><rect x="4" y="6" width="16" height="4" fill="currentColor"/></svg>,
    half: <svg width="24" height="20" viewBox="0 0 24 20" fill="currentColor"><rect x="4" y="10" width="16" height="4" fill="currentColor"/></svg>,
    quarter: <svg width="20" height="28" viewBox="0 0 20 28" fill="currentColor"><path d="M12 2 L8 8 L12 10 L8 16 L10 18 Q6 22 8 26 Q12 24 10 20 L14 14 L10 12 L14 6 Z" fill="currentColor"/></svg>,
    eighth: <svg width="20" height="28" viewBox="0 0 20 28" fill="currentColor"><path d="M14 4 Q8 8 10 12 L8 12 Q6 16 10 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><circle cx="12" cy="6" r="2.5" fill="currentColor"/></svg>,
    sixteenth: <svg width="20" height="28" viewBox="0 0 20 28" fill="currentColor"><path d="M14 2 Q8 6 10 10 L8 10 Q6 14 10 16 L8 16 Q6 20 10 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="4" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>,
  }

  const durations = [
    { icon: NoteIcons.whole, value: '8', title: 'Whole Note' },
    { icon: NoteIcons.half, value: '4', title: 'Half Note' },
    { icon: NoteIcons.quarter, value: '2', title: 'Quarter Note' },
    { icon: NoteIcons.eighth, value: '', title: '8th Note' },
    { icon: NoteIcons.sixteenth, value: '/2', title: '16th Note' },
  ]

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

  const chords = ['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7b5', 'C7', 'Cm7', 'Cdim7', 'Caug']

  return (
    <div className="palette-overlay">
      <div
        ref={popupRef}
        className="palette"
        style={{ left: position.x, top: position.y }}
        onMouseDown={handleMouseDown}
      >
        <div className="palette-header">
          <span className="palette-title">Note Input</span>
          <span className="palette-status">
            {selectedTool.type === 'select' && 'Select'}
            {selectedTool.type === 'delete' && 'Delete'}
            {selectedTool.type === 'note' && selectedTool.value.toUpperCase()}
            {selectedTool.type === 'rest' && 'Rest'}
            {selectedTool.type === 'chord' && selectedTool.value}
            {selectedTool.type === 'dynamic' && selectedTool.value.replace(/!/g, '')}
            {selectedTool.type === 'articulation' && 'Art.'}
          </span>
          <button className="palette-close" onClick={onClose}>×</button>
        </div>

        <div className="palette-tabs">
          {(['notes', 'dynamics', 'articulation', 'chords'] as const).map(tab => (
            <button
              key={tab}
              className={`palette-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="palette-content">
          {activeTab === 'notes' && (
            <>
              <div className="palette-section">
                <div className="palette-section-title">Tools</div>
                <div className="palette-row">
                  <button className={`palette-btn ${selectedTool.type === 'select' ? 'active' : ''}`} onClick={selectPointer} title="Select">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>
                  </button>
                  <button className={`palette-btn ${selectedTool.type === 'delete' ? 'active' : ''}`} onClick={selectDelete} title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>

              <div className="palette-section">
                <div className="palette-section-title">Duration</div>
                <div className="palette-row">
                  {durations.map((d) => (
                    <button key={d.value} className={`palette-btn ${selectedTool.duration === d.value ? 'active' : ''}`} onClick={() => selectDuration(d.value)} title={d.title}>
                      {d.icon}
                    </button>
                  ))}
                </div>
              </div>

              <div className="palette-section">
                <div className="palette-section-title">Accidentals</div>
                <div className="palette-row">
                  {accidentals.map((a) => (
                    <button key={a.value} className={`palette-btn ${selectedTool.type === 'accidental' && selectedTool.value === a.value ? 'active' : ''}`} onClick={() => selectAccidental(a.value)} title={a.title}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="palette-section">
                <div className="palette-section-title">Low Octave</div>
                <div className="palette-row">
                  {notes.map((note) => (
                    <button key={note} className={`palette-btn ${selectedTool.type === 'note' && selectedTool.value === note ? 'active' : ''}`} onClick={() => selectNote(note)}>
                      {note}
                    </button>
                  ))}
                </div>
              </div>

              <div className="palette-section">
                <div className="palette-section-title">High Octave</div>
                <div className="palette-row">
                  {notesHigh.map((note) => (
                    <button key={note} className={`palette-btn ${selectedTool.type === 'note' && selectedTool.value === note ? 'active' : ''}`} onClick={() => selectNote(note)}>
                      {note}
                    </button>
                  ))}
                </div>
              </div>

              <div className="palette-section">
                <div className="palette-section-title">Rests</div>
                <div className="palette-row">
                  {rests.map((r) => (
                    <button key={r.value} className={`palette-btn ${selectedTool.type === 'rest' && selectedTool.value === r.value ? 'active' : ''}`} onClick={() => selectRest(r.value)} title={r.title}>
                      {r.icon}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'dynamics' && (
            <div className="palette-section">
              <div className="palette-section-title">Dynamics</div>
              <div className="palette-row">
                {dynamics.map((d) => (
                  <button key={d.value} className={`palette-btn ${selectedTool.type === 'dynamic' && selectedTool.value === d.value ? 'active' : ''}`} onClick={() => selectDynamic(d.value)}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'articulation' && (
            <div className="palette-section">
              <div className="palette-section-title">Articulations</div>
              <div className="palette-row">
                {articulations.map((a) => (
                  <button key={a.value} className={`palette-btn ${selectedTool.type === 'articulation' && selectedTool.value === a.value ? 'active' : ''}`} onClick={() => selectArticulation(a.value)} title={a.title}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'chords' && (
            <div className="palette-section">
              <div className="palette-section-title">Jazz Chords</div>
              <div className="palette-row wrap">
                {chords.map((chord) => (
                  <button key={chord} className={`palette-btn ${selectedTool.type === 'chord' && selectedTool.value === chord ? 'active' : ''}`} onClick={() => selectChord(chord)}>
                    {chord}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
