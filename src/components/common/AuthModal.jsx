import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from './Toast'
import Captcha from './Captcha'
import PasswordInput from './PasswordInput'
import { genCaptcha } from '../../utils/format'
import Modal from './Modal'

// Modal Masuk / Daftar — dibuka dari tombol Login di sisi kanan navbar
export default function AuthModal({ open, onClose }) {
  const { login, register } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [tab, setTab] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' })
  const [captcha, setCaptcha] = useState(genCaptcha())
  const [captchaInput, setCaptchaInput] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))
  const reset = () => {
    setError('')
    setCaptchaInput('')
    setCaptcha(genCaptcha())
  }

  function switchTab(t) {
    setTab(t)
    reset()
  }

  function checkCaptcha() {
    if (captchaInput.trim().toUpperCase() !== captcha) {
      setError('Kode captcha tidak cocok. Silakan coba lagi.')
      setCaptcha(genCaptcha())
      setCaptchaInput('')
      return false
    }
    return true
  }

  function handleLogin(e) {
    e.preventDefault()
    setError('')
    if (!checkCaptcha()) return
    setBusy(true)
    const res = login(form.email, form.password)
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      setCaptcha(genCaptcha())
      setCaptchaInput('')
      return
    }
    toast(`Selamat datang, ${res.user.name}!`)
    onClose()
    if (res.user.role === 'admin' || res.user.role === 'kasir') navigate('/admin')
  }

  function handleRegister(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) return setError('Lengkapi nama, email, dan nomor HP.')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) return setError('Format email tidak valid.')
    if (form.password.length < 6) return setError('Kata sandi minimal 6 karakter.')
    if (form.password !== form.confirm) return setError('Konfirmasi kata sandi tidak sama.')
    if (!checkCaptcha()) return
    setBusy(true)
    const res = register(form)
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      setCaptcha(genCaptcha())
      setCaptchaInput('')
      return
    }
    toast('Pendaftaran berhasil! Selamat berbelanja 🧁')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={tab === 'login' ? 'Masuk Akun' : 'Daftar Akun Baru'}>
      <div className="tabs mb-4">
        <button className={`tab ${tab === 'login' ? 'active' : ''}`} onClick={() => switchTab('login')}>Masuk</button>
        <button className={`tab ${tab === 'register' ? 'active' : ''}`} onClick={() => switchTab('register')}>Daftar</button>
      </div>

      {error && <div className="alert alert-err mb-3">{error}</div>}

      <form onSubmit={tab === 'login' ? handleLogin : handleRegister} className="stack">
        {tab === 'register' && (
          <>
            <div>
              <label className="label">Nama Lengkap</label>
              <input className="input" value={form.name} onChange={(e) => set('name')(e.target.value)} placeholder="Nama kamu" required />
            </div>
            <div>
              <label className="label">Nomor HP / WhatsApp</label>
              <input className="input" value={form.phone} onChange={(e) => set('phone')(e.target.value)} placeholder="08xxxxxxxxxx" required />
            </div>
          </>
        )}
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email} onChange={(e) => set('email')(e.target.value)} placeholder="email@contoh.com" required autoComplete="email" />
        </div>
        <div>
          <label className="label">Kata Sandi</label>
          <PasswordInput value={form.password} onChange={set('password')} />
        </div>
        {tab === 'register' && (
          <div>
            <label className="label">Ulangi Kata Sandi</label>
            <PasswordInput value={form.confirm} onChange={set('confirm')} placeholder="Ulangi kata sandi" autoComplete="new-password" />
          </div>
        )}
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
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? 'Memproses…' : tab === 'login' ? 'Masuk' : 'Daftar & Belanja'}
        </button>
      </form>

      {tab === 'login' && (
        <div className="demo-cred">
          <b>Akun demo:</b> admin@nandin.id / admin123 (Admin) · kasir@nandin.id / kasir123 (Kasir)
        </div>
      )}
      <p className="text-muted mt-3" style={{ fontSize: 13 }}>
        {tab === 'login'
          ? 'Belum punya akun? Daftar untuk belanja online dan melacak pesananmu.'
          : 'Dengan mendaftar, kamu bisa checkout cepat dan memantau status pesanan.'}
      </p>
    </Modal>
  )
}
