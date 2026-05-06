import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { signInAnon } from '../lib/firebase'
import { createRoom, joinRoom } from '../lib/room'
import { useToast } from '../hooks/useToast'
import { WC2026_FIXTURES, STAGE_LABELS, getFixturesByStage } from '../data/wc2026'

// ── Libre mode: free-form event builder ──
function EventBuilder({ events, setEvents }) {
  const [question, setQuestion] = useState('')
  const [optionInput, setOptionInput] = useState('')
  const [currentOptions, setCurrentOptions] = useState([])

  const addOption = () => {
    const opt = optionInput.trim()
    if (!opt || currentOptions.includes(opt)) return
    setCurrentOptions(prev => [...prev, opt])
    setOptionInput('')
  }

  const addEvent = () => {
    if (!question.trim() || currentOptions.length < 2) return
    setEvents(prev => [...prev, { id: Date.now().toString(), question: question.trim(), options: currentOptions }])
    setQuestion('')
    setCurrentOptions([])
    setOptionInput('')
  }

  return (
    <div>
      {events.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {events.map((ev, i) => (
            <div className="event-item" key={ev.id}>
              <div className="event-header">
                <span className="event-number">#{i + 1}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setEvents(p => p.filter(e => e.id !== ev.id))}>✕</button>
              </div>
              <div style={{ fontWeight: 500, fontSize: '0.9rem', marginBottom: 6 }}>{ev.question}</div>
              <div className="options-list">{ev.options.map(opt => <span className="option-tag" key={opt}>{opt}</span>)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ background: 'var(--surface2)', border: '1px dashed var(--border)' }}>
        <div className="card-title" style={{ fontSize: '1rem' }}>+ Nuevo evento</div>
        <div className="input-group">
          <label>Pregunta</label>
          <input placeholder="Ej: ¿Quién gana el partido?" value={question} onChange={e => setQuestion(e.target.value)} />
        </div>
        <div className="input-group">
          <label>Opciones (mín. 2)</label>
          <div className="flex gap-8">
            <input placeholder="Ej: Argentina" value={optionInput} onChange={e => setOptionInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addOption()} style={{ flex: 1 }} />
            <button className="btn btn-secondary btn-sm" onClick={addOption} style={{ width: 'auto', flexShrink: 0 }}>+ Add</button>
          </div>
        </div>
        {currentOptions.length > 0 && (
          <div className="options-list" style={{ marginBottom: 12 }}>
            {currentOptions.map(opt => (
              <span className="option-tag" key={opt}>
                {opt}
                <button className="option-remove" onClick={() => setCurrentOptions(p => p.filter(o => o !== opt))}>✕</button>
              </span>
            ))}
          </div>
        )}
        <button className="btn btn-primary" onClick={addEvent} disabled={!question.trim() || currentOptions.length < 2}>
          Agregar evento
        </button>
      </div>
    </div>
  )
}

// ── Mundial mode: fixture picker ──
function FixturePicker({ selectedIds, setSelectedIds }) {
  const [activeStage, setActiveStage] = useState('A')
  const byStage = getFixturesByStage()
  const stages = Object.keys(byStage)

  const toggle = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const formatDate = (date, time) => {
    const d = new Date(`${date}T${time}:00Z`)
    return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })
  }

  return (
    <div>
      <p className="text-muted mb-12">Seleccioná los partidos que quieras incluir en el prode.</p>

      <div className="stage-filter">
        {stages.map(s => (
          <button key={s} className={`stage-chip ${activeStage === s ? 'active' : ''}`} onClick={() => setActiveStage(s)}>
            {STAGE_LABELS[s] || s}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="text-muted">{selectedIds.length} partido{selectedIds.length !== 1 ? 's' : ''} seleccionado{selectedIds.length !== 1 ? 's' : ''}</span>
        <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(byStage[activeStage]?.map(f => f.id) || [])}>
          Todos del grupo
        </button>
      </div>

      {(byStage[activeStage] || []).map(fixture => (
        <div key={fixture.id} className={`match-card ${selectedIds.includes(fixture.id) ? 'selected' : ''}`} onClick={() => toggle(fixture.id)}>
          <div className="match-teams">{fixture.home} vs {fixture.away}</div>
          <div className="match-meta">
            <span>📅 {formatDate(fixture.date, fixture.time)}</span>
            <span>🏟️ {fixture.venue.split(',')[0]}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main CreateRoom ──
export default function CreateRoom() {
  const navigate = useNavigate()
  const location = useLocation()
  const playerName = location.state?.name || localStorage.getItem('prode_name') || 'Jugador'
  const { showToast, ToastComponent } = useToast()

  const [mode, setMode] = useState(null) // null | 'libre' | 'mundial'
  const [step, setStep] = useState(0)
  const [events, setEvents] = useState([])
  const [selectedFixtureIds, setSelectedFixtureIds] = useState([])
  const [revealCode, setRevealCode] = useState('')
  const [confirmCode, setConfirmCode] = useState('')
  const [loading, setLoading] = useState(false)

  const buildMundialEvents = () => {
    return selectedFixtureIds.map(id => {
      const f = WC2026_FIXTURES.find(x => x.id === id)
      if (!f) return null
      return {
        id: f.id,
        question: `${f.home} vs ${f.away}`,
        options: [f.home, 'Empate', f.away],
        fixtureId: f.id,
        date: f.date,
        time: f.time,
        venue: f.venue,
        group: f.group,
      }
    }).filter(Boolean)
  }

  const handleNext = () => {
    if (mode === 'libre' && events.length === 0) return showToast('Agregá al menos 1 evento', 'error')
    if (mode === 'mundial' && selectedFixtureIds.length === 0) return showToast('Seleccioná al menos 1 partido', 'error')
    setStep(1)
  }

  const handleCreate = async () => {
    if (!revealCode.trim()) return showToast('Definí el código de revelación', 'error')
    if (revealCode.trim() !== confirmCode.trim()) return showToast('Los códigos no coinciden', 'error')

    setLoading(true)
    try {
      const { user } = await signInAnon()
      const finalEvents = mode === 'mundial' ? buildMundialEvents() : events
      const roomCode = await createRoom(finalEvents, revealCode.trim(), mode)
      await joinRoom(roomCode, user.uid, playerName)
      navigate(`/room/${roomCode}`)
    } catch (e) {
      showToast(e.message || 'Error al crear la sala', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      {ToastComponent}
      <div className="header">
        <button className="btn btn-ghost btn-sm" style={{ width: 'auto' }} onClick={() => { if (step === 1) setStep(0); else if (mode) setMode(null); else navigate('/') }}>
          ← Volver
        </button>
        <span className="logo" style={{ fontSize: '1.3rem' }}>PRO<span>DE</span></span>
      </div>

      <div className="page">
        <div style={{ width: '100%', marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.04em', marginBottom: 4 }}>
            CREAR SALA
          </h2>
          {mode && (
            <>
              <div className="steps">
                <div className={`step ${step === 0 ? 'active' : 'done'}`}></div>
                <div className={`step ${step === 1 ? 'active' : ''}`}></div>
              </div>
              <p className="text-muted">
                {step === 0
                  ? mode === 'mundial' ? 'Paso 1: Elegí los partidos' : 'Paso 1: Configurá los eventos'
                  : 'Paso 2: Definí el código de revelación'}
              </p>
            </>
          )}
        </div>

        {/* Step 0: Mode selector */}
        {!mode && (
          <>
            <p className="text-muted mb-16" style={{ width: '100%' }}>¿Qué tipo de sala querés crear?</p>
            <div className="mode-selector" style={{ width: '100%' }}>
              <div className="mode-card" onClick={() => setMode('mundial')}>
                <div className="mode-icon">🏆</div>
                <div className="mode-title">MUNDIAL 2026</div>
                <div className="mode-desc">Elegí partidos del fixture oficial. Opciones: local / empate / visitante.</div>
              </div>
              <div className="mode-card" onClick={() => setMode('libre')}>
                <div className="mode-icon">✏️</div>
                <div className="mode-title">LIBRE</div>
                <div className="mode-desc">Creá tus propias preguntas y opciones para cualquier evento.</div>
              </div>
            </div>
          </>
        )}

        {/* Step 0: Events/Fixtures */}
        {mode && step === 0 && (
          <>
            {mode === 'mundial'
              ? <FixturePicker selectedIds={selectedFixtureIds} setSelectedIds={setSelectedFixtureIds} />
              : <EventBuilder events={events} setEvents={setEvents} />
            }
            <div style={{ marginTop: 20, width: '100%' }}>
              <button className="btn btn-primary" onClick={handleNext}>Siguiente →</button>
            </div>
          </>
        )}

        {/* Step 1: Reveal code */}
        {mode && step === 1 && (
          <div className="card">
            <div className="card-title">Código de revelación</div>
            <p className="text-muted mb-16">
              Compartí este código con el grupo cuando quieran revelar los votos. Cualquier jugador puede ingresarlo.
            </p>
            <div className="input-group">
              <label>Código secreto</label>
              <input placeholder="Ej: ARGENTINA2026" value={revealCode} onChange={e => setRevealCode(e.target.value)} style={{ fontWeight: 600, letterSpacing: '0.05em' }} />
            </div>
            <div className="input-group">
              <label>Confirmá el código</label>
              <input placeholder="Repetí el código" value={confirmCode} onChange={e => setConfirmCode(e.target.value)} style={{ fontWeight: 600, letterSpacing: '0.05em' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={() => setStep(0)}>← Atrás</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
                {loading ? <span className="spinner" /> : '🚀 Crear sala'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
