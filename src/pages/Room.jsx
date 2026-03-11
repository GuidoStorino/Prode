import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { auth } from '../lib/firebase'
import { signInAnon } from '../lib/firebase'
import {
  listenRoom, listenPlayers, submitVotes,
  tryReveal, setCorrectAnswers, joinRoom
} from '../lib/room'
import { useToast } from '../hooks/useToast'

// ---- Subcomponents ----

function VotingPanel({ events, onSubmit, disabled }) {
  const [votes, setVotes] = useState({})
  const allVoted = events.every(e => votes[e.id])

  const pick = (eventId, option) => {
    if (disabled) return
    setVotes(prev => ({ ...prev, [eventId]: option }))
  }

  return (
    <div>
      {events.map((ev, i) => (
        <div className="card" key={ev.id} style={{ marginBottom: 12 }}>
          <div className="flex items-center justify-between mb-8">
            <span className="event-number">#{i + 1}</span>
            {votes[ev.id] && <span className="badge badge-green">✓ Votado</span>}
          </div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 12 }}>{ev.question}</div>
          {ev.options.map(opt => (
            <button
              key={opt}
              className={`vote-option ${votes[ev.id] === opt ? 'selected' : ''}`}
              onClick={() => pick(ev.id, opt)}
              disabled={disabled}
            >
              <span className="vote-radio" />
              {opt}
            </button>
          ))}
        </div>
      ))}

      {!disabled && (
        <button
          className="btn btn-primary"
          style={{ marginTop: 8 }}
          onClick={() => onSubmit(votes)}
          disabled={!allVoted}
        >
          {allVoted ? '🗳️ Enviar votos' : `Faltan ${events.filter(e => !votes[e.id]).length} voto(s)`}
        </button>
      )}
    </div>
  )
}

function PlayersPanel({ players, currentUid, revealed }) {
  const list = Object.entries(players)
  const voted = list.filter(([, p]) => p.hasVoted).length

  return (
    <div>
      <div className="card mb-12">
        <div className="flex items-center justify-between mb-8">
          <span className="section-title" style={{ margin: 0 }}>Progreso</span>
          <span className="badge badge-yellow">{voted}/{list.length} votaron</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${list.length ? (voted / list.length) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="card">
        <div className="section-title">Jugadores</div>
        {list.length === 0 && <div className="empty-state">Nadie se unió todavía</div>}
        {list.map(([uid, player]) => (
          <div className="player-row" key={uid}>
            <span className="player-name">
              {player.name} {uid === currentUid ? <span className="text-muted">(vos)</span> : ''}
            </span>
            {player.hasVoted
              ? <span className="badge badge-green">Votó ✓</span>
              : <span className="badge badge-gray">Pendiente</span>
            }
          </div>
        ))}
      </div>
    </div>
  )
}

function RevealPanel({ onReveal }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const { showToast, ToastComponent } = useToast()

  const handleReveal = async () => {
    if (!code.trim()) return
    setLoading(true)
    try {
      await onReveal(code.trim())
    } catch (e) {
      showToast(e.message || 'Código incorrecto', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      {ToastComponent}
      <div className="card-title">🔓 Revelar votos</div>
      <p className="text-muted mb-16">
        Ingresá el código de revelación para mostrar todos los votos simultáneamente.
      </p>
      <div className="input-group">
        <label>Código de revelación</label>
        <input
          placeholder="Ingresá el código..."
          value={code}
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleReveal()}
          style={{ fontWeight: 600, letterSpacing: '0.05em' }}
        />
      </div>
      <button className="btn btn-danger" onClick={handleReveal} disabled={!code.trim() || loading}>
        {loading ? <span className="spinner" /> : '🔥 Revelar todos los votos'}
      </button>
    </div>
  )
}

function ResultsPanel({ room, players, currentUid, onSetCorrectAnswers }) {
  const { events, correctAnswers = {}, revealed } = room
  const [editingAnswers, setEditingAnswers] = useState(false)
  const [answers, setAnswers] = useState(correctAnswers)
  const playerList = Object.entries(players)

  const scores = playerList.map(([uid, p]) => {
    let pts = 0
    events.forEach(ev => {
      if (correctAnswers[ev.id] && p.votes?.[ev.id] === correctAnswers[ev.id]) pts++
    })
    return { uid, name: p.name, pts }
  }).sort((a, b) => b.pts - a.pts)

  const hasAnswers = Object.keys(correctAnswers).length > 0

  return (
    <div>
      <div className="reveal-burst">
        <div style={{ fontSize: '2.5rem' }}>🎉</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.05em', color: 'var(--accent)' }}>
          VOTOS REVELADOS
        </h2>
      </div>

      {/* Scoreboard */}
      {hasAnswers && (
        <div className="card mb-12">
          <div className="card-title">🏆 Scoreboard</div>
          {scores.map((s, i) => (
            <div className="score-row" key={s.uid}>
              <span className={`score-rank ${i === 0 ? 'top' : ''}`}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
              </span>
              <span className="score-name">
                {s.name} {s.uid === currentUid ? <span className="text-muted">(vos)</span> : ''}
              </span>
              <span>
                <span className="score-points">{s.pts}</span>
                <span className="score-pts-label">/{events.length} pts</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Set correct answers */}
      {!hasAnswers && (
        <div className="card mb-12">
          <div className="card-title">Cargar resultados reales</div>
          <p className="text-muted mb-16">
            Ingresá los resultados para calcular el puntaje. Cualquier jugador puede hacerlo.
          </p>
          {events.map(ev => (
            <div className="input-group" key={ev.id}>
              <label>{ev.question}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {ev.options.map(opt => (
                  <button
                    key={opt}
                    className={`vote-option ${answers[ev.id] === opt ? 'selected' : ''}`}
                    onClick={() => setAnswers(prev => ({ ...prev, [ev.id]: opt }))}
                    style={{ padding: '8px 14px', marginBottom: 0 }}
                  >
                    <span className="vote-radio" />
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            className="btn btn-primary mt-8"
            onClick={() => onSetCorrectAnswers(answers)}
            disabled={events.some(e => !answers[e.id])}
          >
            Guardar resultados
          </button>
        </div>
      )}

      {/* All votes per event */}
      {events.map((ev, i) => (
        <div className="result-row" key={ev.id}>
          <div className="result-event-title">
            #{i + 1} {ev.question}
            {correctAnswers[ev.id] && (
              <span className="badge badge-green" style={{ marginLeft: 8 }}>
                ✓ {correctAnswers[ev.id]}
              </span>
            )}
          </div>
          {playerList.map(([uid, p]) => {
            const vote = p.votes?.[ev.id]
            const isCorrect = correctAnswers[ev.id] && vote === correctAnswers[ev.id]
            const isWrong = correctAnswers[ev.id] && vote !== correctAnswers[ev.id]
            return (
              <div className="result-player-vote" key={uid}>
                <span className="player-name" style={{ fontSize: '0.88rem' }}>
                  {p.name} {uid === currentUid ? '(vos)' : ''}
                </span>
                <span className={isCorrect ? 'vote-correct' : isWrong ? 'vote-wrong' : ''}>
                  {isCorrect ? '✓ ' : isWrong ? '✗ ' : ''}{vote || '—'}
                </span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ---- Main Room Page ----

export default function Room() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const { showToast, ToastComponent } = useToast()

  const [room, setRoom] = useState(null)
  const [players, setPlayers] = useState({})
  const [currentUid, setCurrentUid] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('votar') // 'votar' | 'jugadores' | 'revelar'
  const [hasVoted, setHasVoted] = useState(false)

  // Auth + subscribe
  useEffect(() => {
    const init = async () => {
      let user = auth.currentUser
      if (!user) {
        const result = await signInAnon()
        user = result.user
      }
      setCurrentUid(user.uid)

      const unsubRoom = listenRoom(roomCode, (data) => {
        setRoom(data)
        setLoading(false)
      })

      const unsubPlayers = listenPlayers(roomCode, (data) => {
        setPlayers(data)
      })

      return () => { unsubRoom(); unsubPlayers() }
    }

    init().catch(e => {
      showToast('Error al conectarse a la sala', 'error')
      setLoading(false)
    })
  }, [roomCode])

  // Track own vote state
  useEffect(() => {
    if (currentUid && players[currentUid]) {
      setHasVoted(players[currentUid].hasVoted)
    }
  }, [players, currentUid])

  // Auto switch to results when revealed
  useEffect(() => {
    if (room?.revealed) setTab('resultados')
  }, [room?.revealed])

  const handleSubmitVotes = async (votes) => {
    try {
      await submitVotes(roomCode, currentUid, votes)
      setHasVoted(true)
      showToast('¡Votos enviados! 🗳️', 'success')
    } catch (e) {
      showToast('Error al enviar votos', 'error')
    }
  }

  const handleReveal = async (code) => {
    await tryReveal(roomCode, code)
    showToast('¡Votos revelados! 🎉', 'success')
  }

  const handleSetCorrectAnswers = async (answers) => {
    try {
      await setCorrectAnswers(roomCode, answers)
      showToast('Resultados guardados ✓', 'success')
    } catch (e) {
      showToast('Error al guardar resultados', 'error')
    }
  }

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode)
    showToast('Código copiado ✓', 'success')
  }

  if (loading) {
    return (
      <div className="full-spinner">
        <div className="spinner" style={{ width: 32, height: 32 }} />
        Conectando a la sala...
      </div>
    )
  }

  if (!room) {
    return (
      <div className="page text-center" style={{ justifyContent: 'center' }}>
        <p className="text-muted">Sala no encontrada</p>
        <button className="btn btn-primary mt-16" onClick={() => navigate('/')}>Volver al inicio</button>
      </div>
    )
  }

  const tabs = room.revealed
    ? ['resultados']
    : ['votar', 'jugadores', 'revelar']

  return (
    <div className="app">
      {ToastComponent}

      {/* Header */}
      <div className="header">
        <button className="btn btn-ghost btn-sm" style={{ width: 'auto' }} onClick={() => navigate('/')}>
          ← Salir
        </button>
        <button onClick={copyCode} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', letterSpacing: '0.2em', color: 'var(--accent)', lineHeight: 1 }}>
            {roomCode}
          </span>
          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Tap para copiar
          </span>
        </button>
        {room.revealed
          ? <span className="badge badge-orange">REVELADO</span>
          : <span className="badge badge-green">EN VIVO</span>
        }
      </div>

      <div className="page" style={{ paddingTop: 16 }}>

        {!room.revealed && (
          <div className="tab-bar">
            <button className={`tab ${tab === 'votar' ? 'active' : ''}`} onClick={() => setTab('votar')}>
              {hasVoted ? '✓ Votado' : 'Votar'}
            </button>
            <button className={`tab ${tab === 'jugadores' ? 'active' : ''}`} onClick={() => setTab('jugadores')}>
              Jugadores
            </button>
            <button className={`tab ${tab === 'revelar' ? 'active' : ''}`} onClick={() => setTab('revelar')}>
              Revelar
            </button>
          </div>
        )}

        {tab === 'votar' && !room.revealed && (
          hasVoted
            ? (
              <div className="card text-center">
                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔒</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', letterSpacing: '0.05em', color: 'var(--accent)', marginBottom: 8 }}>
                  TUS VOTOS ESTÁN GUARDADOS
                </div>
                <p className="text-muted">
                  Esperando que todos voten y que alguien ingrese el código de revelación.
                </p>
                <div style={{ marginTop: 16 }}>
                  <button className="btn btn-secondary" onClick={() => setTab('jugadores')}>
                    Ver jugadores →
                  </button>
                </div>
              </div>
            )
            : <VotingPanel events={room.events} onSubmit={handleSubmitVotes} disabled={false} />
        )}

        {tab === 'jugadores' && !room.revealed && (
          <PlayersPanel players={players} currentUid={currentUid} />
        )}

        {tab === 'revelar' && !room.revealed && (
          <RevealPanel onReveal={handleReveal} />
        )}

        {room.revealed && (
          <ResultsPanel
            room={room}
            players={players}
            currentUid={currentUid}
            onSetCorrectAnswers={handleSetCorrectAnswers}
          />
        )}
      </div>
    </div>
  )
}
