import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSettings } from '../../context/SettingsContext'
import { useToast } from '../../components/common/Toast'
import { requestPasswordReset } from '../../services/db'

// Form minta tautan pemulihan kata sandi (dikirim ke email).
export default function ForgotPassword() {
  const settings = useSettings()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return toast('Masukkan email yang valid.', 'err')
    setBusy(true)
    const r = await requestPasswordReset(email.trim())
    setBusy(false)
    if (!r.ok) return toast(`Gagal: ${r.error || 'coba lagi nanti'}`, 'err')
    setSent(true)
  }

  return (
    <div className="card" style={{ maxWidth: 460, margin: '40px auto', textAlign: 'center' }}>
      <img src={settings.logo || '/logo-nandin.png'} alt="" style={{ height: 62, marginBottom: 8 }} />
      <h2>Lupa Kata Sandi? 🔑</h2>
      <p className="text-muted" style={{ fontSize: 14 }}>
        {sent
          ? 'Jika email tersebut terdaftar, tautan pemulihan sudah dikirim. Cek inbox (dan folder spam) — tautan berlaku 1 jam.'
          : 'Masukkan email akunmu. Kami akan mengirim tautan untuk mengatur ulang kata sandi.'}
      </p>

      {sent ? (
        <div className="stack" style={{ alignItems: 'center' }}>
          <span style={{ fontSize: 44 }}>📨</span>
          <Link to="/" className="btn btn-primary">Kembali ke Beranda</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="stack">
          <input
            className="input"
            type="email"
            required
            placeholder="email@contoh.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? 'Mengirim…' : '✉️ Kirim Tautan Pemulihan'}
          </button>
          <Link to="/" className="text-muted" style={{ fontSize: 13.5 }}>← Kembali</Link>
        </form>
      )}
    </div>
  )
}
