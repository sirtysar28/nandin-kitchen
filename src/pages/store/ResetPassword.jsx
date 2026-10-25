import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useSettings } from '../../context/SettingsContext'
import { useToast } from '../../components/common/Toast'
import PasswordInput from '../../components/common/PasswordInput'
import { resetPassword } from '../../services/db'

// Halaman tujuan tautan email reset: atur kata sandi baru (token sekali pakai).
export default function ResetPassword() {
  const settings = useSettings()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const email = params.get('email') || ''

  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (pass.length < 6) return toast('Kata sandi minimal 6 karakter.', 'err')
    if (pass !== pass2) return toast('Konfirmasi kata sandi tidak sama.', 'err')
    setBusy(true)
    const r = await resetPassword(token, pass)
    setBusy(false)
    if (!r.ok) return toast(`Gagal: ${r.error || 'tautan mungkin sudah dipakai/kedaluwarsa'}`, 'err')
    toast('Kata sandi berhasil diubah! Silakan masuk dengan kata sandi baru. ✅', 'ok')
    navigate('/')
  }

  if (!token) {
    return (
      <div className="card" style={{ maxWidth: 460, margin: '40px auto', textAlign: 'center' }}>
        <span style={{ fontSize: 48 }}>⚠️</span>
        <h2>Tautan Tidak Valid</h2>
        <p className="text-muted">Tautan pemulihan tidak lengkap. Minta tautan baru di halaman lupa kata sandi.</p>
        <Link to="/lupa-sandi" className="btn btn-primary">Minta Tautan Baru</Link>
      </div>
    )
  }

  return (
    <div className="card" style={{ maxWidth: 460, margin: '40px auto', textAlign: 'center' }}>
      <img src={settings.logo || '/logo-nandin.png'} alt="" style={{ height: 62, marginBottom: 8 }} />
      <h2>Atur Kata Sandi Baru 🔒</h2>
      <p className="text-muted" style={{ fontSize: 14 }}>untuk akun <b>{email}</b></p>
      <form onSubmit={submit} className="stack" style={{ textAlign: 'left' }}>
        <div>
          <label className="label">Kata Sandi Baru</label>
          <PasswordInput value={pass} onChange={setPass} autoComplete="new-password" />
        </div>
        <div>
          <label className="label">Ulangi Kata Sandi</label>
          <PasswordInput value={pass2} onChange={setPass2} autoComplete="new-password" />
        </div>
        <button className="btn btn-primary btn-lg" disabled={busy}>
          {busy ? 'Menyimpan…' : '💾 Simpan Kata Sandi Baru'}
        </button>
      </form>
    </div>
  )
}
