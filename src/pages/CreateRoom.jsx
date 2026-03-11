import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { signInAnon } from '../lib/firebase'
import { createRoom, joinRoom } from '../lib/room'
import { useToast } from '../hooks/useToast'

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

  const removeOption = (opt) => setCurrentOptions(prev => prev.filter(o => o !== opt))

  const addEvent = () => {
    if (!question.trim()) return
    if (currentOptions.length < 2) return
    setEvents(prev => [...prev, { id: Date.now().toString(), question: question.trim(), options: currentOptions }])
    setQuestion('')
    setCurrentOptions([])
    setOptionInput('')
  }

  const removeEvent = (id) => setEvents(prev => prev.filter(e => e.id !== id))

  return (
    <div>
      {events.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {events.map((ev, i) => (
            <div className="event-item" key={ev.id}>
              <div className="event-header">
                <span className="event-number">#{i + 1}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => removeEvent(ev.id)}>✕</button>
              </div>
              <div style={{ fontWeight: 500, fontSize: '0.9rem', marginBottom: 6 }}>{ev.question}</div>
              <div className="options-list">
                {ev.options.map(opt => (
                  <span className="option-tag" key={opt}>{opt}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ background: 'var(--surface2)', border: '1px dashed var(--border)' }}>
        <div className="card-title" style={{ fontSize: '1rem' }}>+ Nuevo evento</div>

        <div className="input-group">
          <label>Pregunta</label>
          <input
            placeholder="Ej: ¿Quién gana el partido?"
            value={question}
            onChange={e => setQuestion(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label>Opciones (mín. 2)</label>
          <div className="flex gap-8">
            <input
              placeholder="Ej: Argentina"
              value={optionInput}
              onChange={e => setOptionInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addOption()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-secondary btn-sm" onClick={addOption} style={{ width: 'auto', flexShrink: 0 }}>
              + Add
            </button>
          </div>
        </div>

        {currentOptions.length > 0 && (
          <div className="options-list" style={{ marginBottom: 12 }}>
            {currentOptions.map(opt => (
              <span className="option-tag" key={opt}>
                {opt}
                <button className="option-remove" onClick={() => removeOption(opt)}>✕</button>
              </span>
            ))}
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={addEvent}
          disabled={!question.trim() || currentOptions.length < 2}
        >
          Agregar evento
        </button>
      </div>
    </div>
  )
}

export default function CreateRoom() {
  const navigate = useNavigate()
  const location = useLocation()
  const playerName = location.state?.name || localStorage.getItem('prode_name') || 'Admin'

  const { showToast, ToastComponent } = useToast()

  const [step, setStep] = useState(0) // 0 = events, 1 = reveal code
  const [events, setEvents] = useState([])
  const [revealCode, setRevealCode] = useState('')
  const [confirmCode, setConfirmCode] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (events.length === 0) return showToast('Agregá al menos 1 evento', 'error')
    if (!revealCode.trim()) return showToast('Definí el código de revelación', 'error')
    if (revealCode.trim() !== confirmCode.trim()) return showToast('Los códigos no coinciden', 'error')

    setLoading(true)
    try {
      const { user } = await signInAnon()
      const roomCode = await createRoom(events, revealCode.trim())
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
        <button className="btn btn-ghost btn-sm" style={{ width: 'auto' }} onClick={() => navigate('/')}>
          ← Volver
        </button>
        <span className="logo" style={{ fontSize: '1.3rem' }}>PRO<span>DE</span></span>
      </div>

      <div className="page">
        <div style={{ width: '100%', marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.04em', marginBottom: 4 }}>
            CREAR SALA
          </h2>
          <div className="steps">
            <div className={`step ${step === 0 ? 'active' : 'done'}`}></div>
            <div className={`step ${step === 1 ? 'active' : step > 1 ? 'done' : ''}`}></div>
          </div>
          <p className="text-muted">
            {step === 0 ? 'Paso 1: Configurá los eventos' : 'Paso 2: Definí el código de revelación'}
          </p>
        </div>

        {step === 0 && (
          <>
            <EventBuilder events={events} setEvents={setEvents} />
            <div style={{ marginTop: 20, width: '100%' }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (events.length === 0) return showToast('Agregá al menos 1 evento', 'error')
                  setStep(1)
                }}
              >
                Siguiente →
              </button>
            </div>
          </>
        )}

        {step === 1 && (
          <div className="card">
            <div className="card-title">Código de revelación</div>
            <p className="text-muted mb-16">
              Este código se lo compartís al grupo cuando quieran revelar los votos. Cualquier jugador puede ingresarlo.
            </p>

            <div className="input-group">
              <label>Código secreto</label>
              <input
                placeholder="Ej: RIVER2024"
                value={revealCode}
                onChange={e => setRevealCode(e.target.value)}
                style={{ fontWeight: 600, letterSpacing: '0.05em' }}
              />
            </div>

            <div className="input-group">
              <label>Confirmá el código</label>
              <input
                placeholder="Repetí el código"
                value={confirmCode}
                onChange={e => setConfirmCode(e.target.value)}
                style={{ fontWeight: 600, letterSpacing: '0.05em' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={() => setStep(0)}>
                ← Atrás
              </button>
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
