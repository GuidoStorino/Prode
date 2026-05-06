import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { auth, signInAnon } from '../lib/firebase'
import { listenRoom, listenPlayers, submitVotes, tryReveal, setCorrectAnswers, joinRoom, addEventToRoom, removePlayer } from '../lib/room'
import { useToast } from '../hooks/useToast'

// ── Libre voting panel ──
function VotingPanel({ events, onSubmit, disabled, savedVotes = {} }) {
  const [votes, setVotes] = useState(savedVotes)
  const displayVotes = disabled ? savedVotes : votes
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
            {displayVotes[ev.id] && <span className="badge badge-green">✓ {disabled ? 'Tu voto' : 'Votado'}</span>}
          </div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 12 }}>{ev.question}</div>
          {ev.options.map(opt => (
            <button key={opt}
              className={`vote-option ${displayVotes[ev.id] === opt ? 'selected' : ''}`}
              onClick={() => pick(ev.id, opt)} disabled={disabled}
              style={disabled ? { cursor: 'default', opacity: displayVotes[ev.id] === opt ? 1 : 0.4 } : {}}>
              <span className="vote-radio" />{opt}
            </button>
          ))}
        </div>
      ))}
      {!disabled && (
        <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => onSubmit(votes)} disabled={!allVoted}>
          {allVoted ? '🗳️ Enviar votos' : `Faltan ${events.filter(e => !votes[e.id]).length} voto(s)`}
        </button>
      )}
    </div>
  )
}

// ── Mundial voting panel ──
function MundialVotingPanel({ events, onSubmit, disabled, savedVotes = {} }) {
  const [votes, setVotes] = useState(savedVotes)
  const displayVotes = disabled ? savedVotes : votes
  const allVoted = events.every(e => votes[e.id])

  const pick = (eventId, option) => {
    if (disabled) return
    setVotes(prev => ({ ...prev, [eventId]: option }))
  }

  const formatDate = (date, time) => {
    if (!date) return ''
    try {
      const d = new Date(`${date}T${time}:00Z`)
      return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })
    } catch { return `${date} ${time}` }
  }

  return (
    <div>
      {events.map(ev => {
        const myVote = displayVotes[ev.id]
        const [home, , away] = ev.options
        return (
          <div key={ev.id} className={`fixture-vote ${myVote ? 'voted' : ''}`}>
            <div className="fixture-teams">
              <span className="fixture-team home">{home}</span>
              <span className="fixture-vs">VS</span>
              <span className="fixture-team away">{away}</span>
            </div>
            {ev.date && <div className="fixture-date">📅 {formatDate(ev.date, ev.time)} · {ev.venue?.split(',')[0]}</div>}
            <div className="fixture-options">
              {ev.options.map(opt => (
                <button key={opt}
                  className={`fixture-option ${myVote === opt ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                  onClick={() => pick(ev.id, opt)}
                  style={disabled && myVote !== opt ? { opacity: 0.35 } : {}}>
                  {opt === home ? `🏠 ${opt}` : opt === away ? `✈️ ${opt}` : `🤝 ${opt}`}
                </button>
              ))}
            </div>
          </div>
        )
      })}
      {!disabled && (
        <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => onSubmit(votes)} disabled={!allVoted}>
          {allVoted ? '🗳️ Enviar votos' : `Faltan ${events.filter(e => !votes[e.id]).length} voto(s)`}
        </button>
      )}
    </div>
  )
}

// ── Players panel with remove ──
function PlayersPanel({ players, currentUid, onRemove }) {
  const list = Object.entries(players)
  const voted = list.filter(([, p]) => p.hasVoted).length
  const [confirmRemove, setConfirmRemove] = useState(null)

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {player.hasVoted
                ? <span className="badge badge-green">Votó ✓</span>
                : <span className="badge badge-gray">Pendiente</span>}
              {confirmRemove === uid ? (
                <>
                  <button className="btn btn-danger btn-sm" style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    onClick={() => { onRemove(uid); setConfirmRemove(null) }}>Confirmar</button>
                  <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}
                    onClick={() => setConfirmRemove(null)}>✕</button>
                </>
              ) : (
                <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', color: 'var(--text-muted)' }}
                  onClick={() => setConfirmRemove(uid)} title="Eliminar jugador">🗑</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Add event panel ──
function AddEventPanel({ roomCode, showToast }) {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [optionInput, setOptionInput] = useState('')
  const [options, setOptions] = useState([])
  const [loading, setLoading] = useState(false)

  const addOption = () => {
    const opt = optionInput.trim()
    if (!opt || options.includes(opt)) return
    setOptions(prev => [...prev, opt])
    setOptionInput('')
  }

  const handleAdd = async () => {
    if (!question.trim() || options.length < 2) return
    setLoading(true)
    try {
      await addEventToRoom(roomCode, { id: Date.now().toString(), question: question.trim(), options })
      showToast('Evento agregado. Los jugadores que ya votaron deberán votar este nuevo evento.', 'success', 4000)
      setQuestion(''); setOptions([]); setOptionInput(''); setOpen(false)
    } catch (e) {
      showToast(e.message || 'Error al agregar evento', 'error')
    } finally { setLoading(false) }
  }

  if (!open) return (
    <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => setOpen(true)}>
      + Agregar evento a la sala
    </button>
  )

  return (
    <div className="card" style={{ marginTop: 16, border: '1px dashed var(--border)' }}>
      <div className="card-title" style={{ fontSize: '1rem' }}>Nuevo evento</div>
      <p className="text-muted mb-12" style={{ fontSize: '0.8rem' }}>
        Los jugadores que ya votaron deberán votar este nuevo evento. Sus votos anteriores se conservan.
      </p>
      <div className="input-group">
        <label>Pregunta</label>
        <input placeholder="Ej: ¿Quién mete el primer gol?" value={question} onChange={e => setQuestion(e.target.value)} />
      </div>
      <div className="input-group">
        <label>Opciones (mín. 2)</label>
        <div className="flex gap-8">
          <input placeholder="Opción..." value={optionInput} onChange={e => setOptionInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addOption()} style={{ flex: 1 }} />
          <button className="btn btn-secondary btn-sm" onClick={addOption} style={{ width: 'auto' }}>+ Add</button>
        </div>
      </div>
      {options.length > 0 && (
        <div className="options-list" style={{ marginBottom: 12 }}>
          {options.map(opt => (
            <span className="option-tag" key={opt}>{opt}
              <button className="option-remove" onClick={() => setOptions(p => p.filter(o => o !== opt))}>✕</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleAdd} disabled={!question.trim() || options.length < 2 || loading}>
          {loading ? <span className="spinner" /> : 'Agregar'}
        </button>
      </div>
    </div>
  )
}

// ── Reveal panel ──
function RevealPanel({ onReveal, showToast }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  const handleReveal = async () => {
    if (!code.trim()) return
    setLoading(true)
    try { await onReveal(code.trim()) }
    catch (e) { showToast(e.message || 'Código incorrecto', 'error') }
    finally { setLoading(false) }
  }

  return (
    <div className="card">
      <div className="card-title">🔓 Revelar votos</div>
      <p className="text-muted mb-16">Ingresá el código de revelación para mostrar todos los votos.</p>
      <div className="input-group">
        <label>Código de revelación</label>
        <input placeholder="Ingresá el código..." value={code} onChange={e => setCode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleReveal()} style={{ fontWeight: 600, letterSpacing: '0.05em' }} />
      </div>
      <button className="btn btn-danger" onClick={handleReveal} disabled={!code.trim() || loading}>
        {loading ? <span className="spinner" /> : '🔥 Revelar todos los votos'}
      </button>
    </div>
  )
}

// ── Results panel (libre mode) ──
function ResultsPanel({ room, players, currentUid, onSetCorrectAnswers }) {
  const { events, correctAnswers = {} } = room
  const [answers, setAnswers] = useState(correctAnswers)
  const playerList = Object.entries(players)
  const hasAnswers = Object.keys(correctAnswers).length > 0

  const scores = playerList.map(([uid, p]) => {
    let pts = 0
    events.forEach(ev => { if (correctAnswers[ev.id] && p.votes?.[ev.id] === correctAnswers[ev.id]) pts++ })
    return { uid, name: p.name, pts }
  }).sort((a, b) => b.pts - a.pts)

  return (
    <div>
      <div className="reveal-burst">
        <div style={{ fontSize: '2.5rem' }}>🎉</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.05em', color: 'var(--accent)' }}>VOTOS REVELADOS</h2>
      </div>

      {hasAnswers && (
        <div className="card mb-12">
          <div className="card-title">🏆 Scoreboard</div>
          {scores.map((s, i) => (
            <div className="score-row" key={s.uid}>
              <span className={`score-rank ${i === 0 ? 'top' : ''}`}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
              <span className="score-name">{s.name} {s.uid === currentUid && <span className="text-muted">(vos)</span>}</span>
              <span><span className="score-points">{s.pts}</span><span className="score-pts-label">/{events.length} pts</span></span>
            </div>
          ))}
        </div>
      )}

      {!hasAnswers && (
        <div className="card mb-12">
          <div className="card-title">Cargar resultados reales</div>
          <p className="text-muted mb-16">Ingresá los resultados para calcular el puntaje.</p>
          {events.map(ev => (
            <div className="input-group" key={ev.id}>
              <label>{ev.question}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {ev.options.map(opt => (
                  <button key={opt} className={`vote-option ${answers[ev.id] === opt ? 'selected' : ''}`}
                    onClick={() => setAnswers(prev => ({ ...prev, [ev.id]: opt }))}
                    style={{ padding: '8px 14px', marginBottom: 0 }}>
                    <span className="vote-radio" />{opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button className="btn btn-primary mt-8" onClick={() => onSetCorrectAnswers(answers)} disabled={events.some(e => !answers[e.id])}>
            Guardar resultados
          </button>
        </div>
      )}

      {events.map((ev, i) => (
        <div className="result-row" key={ev.id}>
          <div className="result-event-title">
            #{i + 1} {ev.question}
            {correctAnswers[ev.id] && <span className="badge badge-green" style={{ marginLeft: 8 }}>✓ {correctAnswers[ev.id]}</span>}
          </div>
          {playerList.map(([uid, p]) => {
            const vote = p.votes?.[ev.id]
            const isCorrect = correctAnswers[ev.id] && vote === correctAnswers[ev.id]
            const isWrong = correctAnswers[ev.id] && vote !== correctAnswers[ev.id]
            return (
              <div className="result-player-vote" key={uid}>
                <span className="player-name" style={{ fontSize: '0.88rem' }}>{p.name} {uid === currentUid && '(vos)'}</span>
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

// ── Mundial results panel ──
function MundialResultsPanel({ room, players, currentUid, onSetCorrectAnswers }) {
  const { events, correctAnswers = {} } = room
  const [answers, setAnswers] = useState(correctAnswers)
  const playerList = Object.entries(players)
  const hasAnswers = Object.keys(correctAnswers).length > 0

  const scores = playerList.map(([uid, p]) => {
    let pts = 0
    events.forEach(ev => { if (correctAnswers[ev.id] && p.votes?.[ev.id] === correctAnswers[ev.id]) pts++ })
    return { uid, name: p.name, pts }
  }).sort((a, b) => b.pts - a.pts)

  const formatDate = (date, time) => {
    if (!date) return ''
    try {
      const d = new Date(`${date}T${time}:00Z`)
      return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })
    } catch { return `${date} ${time}` }
  }

  return (
    <div>
      <div className="reveal-burst">
        <div style={{ fontSize: '2.5rem' }}>🏆</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '0.05em', color: 'var(--accent)' }}>RESULTADOS</h2>
      </div>

      {/* Scoreboard */}
      <div className="card mb-12">
        <div className="card-title">🏆 Scoreboard</div>
        {scores.length === 0 && <div className="empty-state">Sin jugadores</div>}
        {scores.map((s, i) => (
          <div className="score-row" key={s.uid}>
            <span className={`score-rank ${i === 0 ? 'top' : ''}`}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
            <span className="score-name">{s.name} {s.uid === currentUid && <span className="text-muted">(vos)</span>}</span>
            <span><span className="score-points">{s.pts}</span><span className="score-pts-label">/{events.length} pts</span></span>
          </div>
        ))}
      </div>

      {/* Per match results */}
      {events.map((ev, i) => {
        const [home, , away] = ev.options
        const correct = correctAnswers[ev.id]
        return (
          <div className="card mb-12" key={ev.id}>
            <div style={{ marginBottom: 8 }}>
              <div className="fixture-teams" style={{ marginBottom: 4 }}>
                <span className="fixture-team home" style={{ fontSize: '0.9rem' }}>{home}</span>
                <span className="fixture-vs">VS</span>
                <span className="fixture-team away" style={{ fontSize: '0.9rem' }}>{away}</span>
              </div>
              {ev.date && <div className="fixture-date" style={{ marginBottom: 8 }}>📅 {formatDate(ev.date, ev.time)}</div>}
              {/* Correct answer selector */}
              {!correct ? (
                <div>
                  <p className="text-muted mb-8" style={{ fontSize: '0.78rem' }}>¿Cuál fue el resultado?</p>
                  <div className="fixture-options" style={{ marginBottom: 8 }}>
                    {ev.options.map(opt => (
                      <button key={opt}
                        className={`fixture-option ${answers[ev.id] === opt ? 'selected' : ''}`}
                        onClick={() => setAnswers(prev => ({ ...prev, [ev.id]: opt }))}>
                        {opt === home ? `🏠 ${opt}` : opt === away ? `✈️ ${opt}` : `🤝 ${opt}`}
                      </button>
                    ))}
                  </div>
                  {answers[ev.id] && (
                    <button className="btn btn-primary btn-sm" style={{ width: 'auto', fontSize: '0.8rem' }}
                      onClick={() => onSetCorrectAnswers({ ...correctAnswers, [ev.id]: answers[ev.id] })}>
                      Confirmar resultado
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ marginBottom: 8 }}>
                  <span className="badge badge-green">✓ {correct === home ? `🏠 ${correct}` : correct === away ? `✈️ ${correct}` : `🤝 ${correct}`}</span>
                </div>
              )}
            </div>

            {/* Player votes */}
            {playerList.map(([uid, p]) => {
              const vote = p.votes?.[ev.id]
              const isCorrect = correct && vote === correct
              const isWrong = correct && vote !== correct
              return (
                <div className="result-player-vote" key={uid}>
                  <span style={{ fontSize: '0.85rem' }}>{p.name} {uid === currentUid && <span className="text-muted">(vos)</span>}</span>
                  <span className={isCorrect ? 'vote-correct' : isWrong ? 'vote-wrong' : ''} style={{ fontSize: '0.85rem' }}>
                    {isCorrect ? '✓ ' : isWrong ? '✗ ' : ''}{vote || '—'}
                  </span>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ── Main Room ──
export default function Room() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const { showToast, ToastComponent } = useToast()

  const [room, setRoom] = useState(null)
  const [players, setPlayers] = useState({})
  const [currentUid, setCurrentUid] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('votar')

  const hasVoted = !!(currentUid && players[currentUid]?.hasVoted)
  const isMundial = room?.mode === 'mundial'

  useEffect(() => {
    const init = async () => {
      let user = auth.currentUser
      if (!user) { const r = await signInAnon(); user = r.user }
      setCurrentUid(user.uid)
      const unsubRoom = listenRoom(roomCode, data => { setRoom(data); setLoading(false) })
      const unsubPlayers = listenPlayers(roomCode, data => setPlayers(data))
      return () => { unsubRoom(); unsubPlayers() }
    }
    init().catch(() => { showToast('Error al conectarse', 'error'); setLoading(false) })
  }, [roomCode])

  useEffect(() => { if (room?.revealed) setTab('resultados') }, [room?.revealed])

  const handleSubmitVotes = async (votes) => {
    try { await submitVotes(roomCode, currentUid, votes); showToast('¡Votos enviados! 🗳️', 'success') }
    catch { showToast('Error al enviar votos', 'error') }
  }

  const handleReveal = async (code) => {
    await tryReveal(roomCode, code)
    showToast('¡Votos revelados! 🎉', 'success')
  }

  const handleSetCorrectAnswers = async (answers) => {
    try { await setCorrectAnswers(roomCode, answers); showToast('Resultados guardados ✓', 'success') }
    catch { showToast('Error al guardar resultados', 'error') }
  }

  const handleRemovePlayer = async (uid) => {
    try { await removePlayer(roomCode, uid); showToast('Jugador eliminado', 'success') }
    catch { showToast('Error al eliminar jugador', 'error') }
  }

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode)
    showToast('Código copiado ✓', 'success')
  }

  if (loading) return (
    <div className="full-spinner">
      <div className="spinner" style={{ width: 32, height: 32 }} />
      Conectando a la sala...
    </div>
  )

  if (!room) return (
    <div className="page text-center" style={{ justifyContent: 'center' }}>
      <p className="text-muted">Sala no encontrada</p>
      <button className="btn btn-primary mt-16" onClick={() => navigate('/')}>Volver al inicio</button>
    </div>
  )

  return (
    <div className="app">
      {ToastComponent}

      <div className="header">
        <button className="btn btn-ghost btn-sm" style={{ width: 'auto' }} onClick={() => navigate('/')}>← Salir</button>
        <button onClick={copyCode} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', letterSpacing: '0.2em', color: 'var(--accent)', lineHeight: 1 }}>{roomCode}</span>
          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Tap para copiar</span>
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {room.revealed ? <span className="badge badge-orange">REVELADO</span> : <span className="badge badge-green">EN VIVO</span>}
          {isMundial && <span className="badge badge-blue">🏆 MUNDIAL</span>}
        </div>
      </div>

      <div className="page" style={{ paddingTop: 16 }}>
        {!room.revealed && (
          <div className="tab-bar">
            <button className={`tab ${tab === 'votar' ? 'active' : ''}`} onClick={() => setTab('votar')}>{hasVoted ? '✓ Votado' : 'Votar'}</button>
            <button className={`tab ${tab === 'jugadores' ? 'active' : ''}`} onClick={() => setTab('jugadores')}>Jugadores</button>
            <button className={`tab ${tab === 'revelar' ? 'active' : ''}`} onClick={() => setTab('revelar')}>Revelar</button>
          </div>
        )}

        {tab === 'votar' && !room.revealed && (
          hasVoted ? (
            <div>
              <div className="card text-center" style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '2rem', marginBottom: 6 }}>🔒</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '0.05em', color: 'var(--accent)', marginBottom: 6 }}>
                  TUS VOTOS ESTÁN GUARDADOS
                </div>
                <p className="text-muted" style={{ fontSize: '0.82rem' }}>Los demás no pueden ver tus votos hasta la revelación.</p>
              </div>
              {isMundial
                ? <MundialVotingPanel events={room.events} onSubmit={handleSubmitVotes} disabled={true} savedVotes={players[currentUid]?.votes || {}} />
                : <VotingPanel events={room.events} onSubmit={handleSubmitVotes} disabled={true} savedVotes={players[currentUid]?.votes || {}} />
              }
            </div>
          ) : (
            isMundial
              ? <MundialVotingPanel events={room.events} onSubmit={handleSubmitVotes} disabled={false} savedVotes={players[currentUid]?.votes || {}} />
              : <VotingPanel events={room.events} onSubmit={handleSubmitVotes} disabled={false} savedVotes={players[currentUid]?.votes || {}} />
          )
        )}

        {tab === 'jugadores' && !room.revealed && (
          <>
            <PlayersPanel players={players} currentUid={currentUid} onRemove={handleRemovePlayer} />
            <AddEventPanel roomCode={roomCode} showToast={showToast} />
          </>
        )}

        {tab === 'revelar' && !room.revealed && (
          <RevealPanel onReveal={handleReveal} showToast={showToast} />
        )}

        {room.revealed && (
          isMundial
            ? <MundialResultsPanel room={room} players={players} currentUid={currentUid} onSetCorrectAnswers={handleSetCorrectAnswers} />
            : <ResultsPanel room={room} players={players} currentUid={currentUid} onSetCorrectAnswers={handleSetCorrectAnswers} />
        )}
      </div>
    </div>
  )
}
