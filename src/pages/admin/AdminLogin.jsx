import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { useToast } from '../../components/common/Toast'
import Captcha from '../../components/common/Captcha'
import PasswordInput from '../../components/common/PasswordInput'
import { genCaptcha } from '../../utils/format'

// Halaman login khusus admin & kasir (captcha 5 digit + intip kata sandi)
export default function AdminLogin() {
  const { login, user, isAdmin, logout } = useAuth()
  const settings = useSettings()
  const toast = useToast()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [captcha, setCaptcha] = useState(genCaptcha())
  const [captchaInput, setCaptchaInput] = useState('')
  const [error, setError] = useState('')

  // Sudah login sebagai admin? langsung masuk
  if (isAdmin) {
    navigate('/admin', { replace: true })
  }

  function submit(e) {
    e.preventDefault()
    setError('')
    if (captchaInput.trim().toUpperCase() !== captcha) {
      setError('Kode captcha tidak cocok.')
      setCaptcha(genCaptcha())
      setCaptchaInput('')
      return
    }
    const res = login(email, password)
    if (!res.ok) {
      setError(res.error)
      setCaptcha(genCaptcha())
      setCaptchaInput('')
      return
    }
    if (res.user.role !== 'admin' && res.user.role !== 'kasir') {
      logout()
      setError('Akun ini bukan akun admin/kasir. Gunakan halaman login pelanggan di website.')
      return
    }
    toast(`Selamat datang, ${res.user.name}!`)
    navigate('/admin', { replace: true })
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img src={settings.logo || '/logo-nandin.png'} alt={settings.storeName} />
          <div>
            <h2 style={{ margin: 0 }}>{settings.storeName}</h2>
            <span className="text-muted">Panel Admin & Kasir</span>
          </div>
        </div>

        {error && <div className="alert alert-err mb-2">{error}</div>}

        <form onSubmit={submit} className="stack">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@nandin.id" required autoComplete="username" />
          </div>
          <div>
            <label className="label">Kata Sandi</label>
            <PasswordInput value={password} onChange={setPassword} />
          </div>
          <div>
            <label className="label">Kode Captcha <span className="text-muted">(5 karakter)</span></label>
            <div className="captcha-row">
              <Captcha code={captcha} onRefresh={() => { setCaptcha(genCaptcha()); setCaptchaInput('') }} />
              <input
                className="input captcha-input"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value.toUpperCase())}
                maxLength={5}
                placeholder="Ketik kode"
                required
              />
            </div>
          </div>
          <button className="btn btn-primary w-full btn-lg">Masuk Dashboard</button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <Link to="/lupa-sandi" className="text-muted" style={{ fontSize: 13.5, display: 'block', marginBottom: 6 }}>🔑 Lupa kata sandi?</Link>
          <Link to="/" className="text-muted" style={{ fontSize: 13.5 }}>← Kembali ke website toko</Link>
        </div>
      </div>
    </div>
  )
}
