import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInAnon, auth } from '../lib/firebase'
import { joinRoom } from '../lib/room'
import { useToast } from '../hooks/useToast'

export default function Home() {
  const navigate = useNavigate()
  const { showToast, ToastComponent } = useToast()

  const [tab, setTab] = useState('join') // 'join' | 'create'
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  const handleJoin = async () => {
    if (!name.trim()) return showToast('Ingresá tu nombre', 'error')
    if (code.trim().length < 4) return showToast('Ingresá el código de sala', 'error')

    setLoading(true)
    try {
      const { user } = await signInAnon()
      await joinRoom(code.trim().toUpperCase(), user.uid, name.trim())
      localStorage.setItem('prode_name', name.trim())
      navigate(`/room/${code.trim().toUpperCase()}`)
    } catch (e) {
      showToast(e.message || 'Error al unirse', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleGoCreate = async () => {
    if (!name.trim()) return showToast('Ingresá tu nombre', 'error')
    localStorage.setItem('prode_name', name.trim())
    navigate('/create', { state: { name: name.trim() } })
  }

  return (
    <div className="app">
      {ToastComponent}

      <div className="page" style={{ justifyContent: 'center' }}>
        <div className="hero">
          <div className="logo" style={{ fontSize: '1rem', marginBottom: 16 }}>
            PRO<span>DE</span>
          </div>
          <h1 className="hero-title">
            <span className="accent">VOTA</span><br />
            <span className="accent2">EN</span> SECRETO
          </h1>
          <div className="stripe-accent"></div>
          <p className="hero-sub" style={{ marginTop: 16 }}>
            Creá o unite a una partida con tus amigos
          </p>
        </div>

        <div className="card" style={{ maxWidth: 400 }}>
          <div className="tab-bar">
            <button className={`tab ${tab === 'join' ? 'active' : ''}`} onClick={() => setTab('join')}>
              Unirse
            </button>
            <button className={`tab ${tab === 'create' ? 'active' : ''}`} onClick={() => setTab('create')}>
              Crear sala
            </button>
          </div>

          <div className="input-group">
            <label>Tu nombre</label>
            <input
              placeholder="¿Cómo te llamás?"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (tab === 'join' ? handleJoin() : handleGoCreate())}
              maxLength={20}
            />
          </div>

          {tab === 'join' && (
            <div className="input-group">
              <label>Código de sala</label>
              <input
                className="input-code"
                placeholder="ABCD"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase().slice(0, 4))}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                maxLength={4}
              />
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            {tab === 'join' ? (
              <button className="btn btn-primary" onClick={handleJoin} disabled={loading}>
                {loading ? <span className="spinner" /> : '→ Entrar a la sala'}
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleGoCreate} disabled={loading}>
                {loading ? <span className="spinner" /> : '→ Configurar partida'}
              </button>
            )}
          </div>
        </div>

        <p className="text-muted text-center mt-16" style={{ fontSize: '0.78rem' }}>
          Los votos son secretos hasta que se ingrese el código de revelación 🔒
        </p>
      </div>
    </div>
  )
}
