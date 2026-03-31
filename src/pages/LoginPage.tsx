import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { cloudstack } from '../api/cloudstack'
import './LoginPage.css'

// ── Cloud SVG icon ─────────────────────────────────────────
function CloudIcon() {
  return (
    <svg
      className="brand-logo-icon"
      width="44"
      height="44"
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="44" height="44" rx="10" fill="rgba(0,187,221,0.12)" />
      <path
        d="M32 20C32 20 32 11 22 11C15 11 12.5 17 12.5 17C8.5 17 5.5 19.8 5.5 24C5.5 28.2 8.5 31 12.5 31H32C35.5 31 38 28.5 38 25C38 22.2 36 20 33 19.2"
        stroke="#00BBDD"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Alert icon ─────────────────────────────────────────────
function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  )
}

// ── Login Page ─────────────────────────────────────────────
export default function LoginPage() {
  const navigate = useNavigate()

  const [username,   setUsername]   = useState('')
  const [password,   setPassword]   = useState('')
  const [domain,     setDomain]     = useState('/')
  const [showDomain, setShowDomain] = useState(false)
  const [isLoading,  setIsLoading]  = useState(false)
  const [error,      setError]      = useState('')

  const canSubmit = username.trim() && password.trim() && !isLoading

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    setIsLoading(true)
    setError('')

    try {
      const user = await cloudstack.login(username.trim(), password, domain.trim() || '/')

      // Persist session
      localStorage.setItem('opus_session', JSON.stringify(user))

      // Navigate to dashboard (future route)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Erro inesperado. Tente novamente.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-page">

      {/* ── Left: Brand Panel ─────────────────────────────── */}
      <div className="login-brand">
        <div className="brand-inner">

          <div className="brand-logo">
            <CloudIcon />
            <span className="brand-logo-text">
              OPUS<span>cloud</span>
            </span>
          </div>

          <p className="brand-tagline">
            Gerenciamento completo de<br />
            infraestrutura em nuvem
          </p>

          <div className="brand-features">
            <div className="brand-feature">
              <span className="brand-feature-dot" />
              Instâncias, volumes e snapshots
            </div>
            <div className="brand-feature">
              <span className="brand-feature-dot" />
              Redes privadas e grupos de segurança
            </div>
            <div className="brand-feature">
              <span className="brand-feature-dot" />
              Templates e ofertas configuráveis
            </div>
            <div className="brand-feature">
              <span className="brand-feature-dot" />
              Acesso via API com suporte a root
            </div>
          </div>
        </div>

        {/* Decorative rings + glow */}
        <div className="brand-ring brand-ring-1" />
        <div className="brand-ring brand-ring-2" />
        <div className="brand-ring brand-ring-3" />
        <div className="brand-ring brand-ring-4" />
        <div className="brand-glow" />
      </div>

      {/* ── Right: Form Panel ─────────────────────────────── */}
      <div className="login-form-panel">

        {/* Mobile logo (visible when brand panel is hidden) */}
        <div className="login-mobile-logo">
          <CloudIcon />
          <span className="brand-logo-text">
            OPUS<span>cloud</span>
          </span>
        </div>

        <div className="login-card">

          <div className="login-header">
            <h1>Bem-vindo de volta</h1>
            <p>Faça login na sua conta OpusCloud</p>
          </div>

          {error && (
            <div className="login-error">
              <AlertIcon />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form" noValidate>

            <div className="form-field">
              <label htmlFor="username">Usuário</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Digite seu usuário"
                autoComplete="username"
                autoFocus
                disabled={isLoading}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="password">Senha</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                autoComplete="current-password"
                disabled={isLoading}
                required
              />
            </div>

            <button
              type="button"
              className="domain-toggle-btn"
              onClick={() => setShowDomain(v => !v)}
            >
              {showDomain ? '− Ocultar domínio' : '+ Especificar domínio'}
            </button>

            {showDomain && (
              <div className="form-field">
                <label htmlFor="domain">Domínio</label>
                <input
                  id="domain"
                  type="text"
                  value={domain}
                  onChange={e => setDomain(e.target.value)}
                  placeholder="Ex: / ou /OPUSTECH"
                  autoComplete="off"
                  disabled={isLoading}
                />
              </div>
            )}

            <button
              type="submit"
              className="login-submit"
              disabled={!canSubmit}
            >
              {isLoading ? <span className="btn-spinner" /> : 'Entrar'}
            </button>

          </form>

          <p className="login-footer">
            Powered by <strong>OpusTech</strong> · CloudStack API
          </p>
        </div>
      </div>

    </div>
  )
}
