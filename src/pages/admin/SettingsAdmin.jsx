import { useRef, useState } from 'react'
import { useData } from '../../context/DataContext'
import { useSettings } from '../../context/SettingsContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/common/Toast'
import PasswordInput from '../../components/common/PasswordInput'
import { db } from '../../services/db'
import { fmtDateTime } from '../../utils/format'
import { waLink, waTarget } from '../../utils/wa'
import Modal from '../../components/common/Modal'

const TABS = [
  ['profil', '🏪 Profil Toko'],
  ['branding', '🎨 Logo & Favicon'],
  ['whatsapp', '💬 WhatsApp'],
  ['midtrans', '💳 Midtrans'],
  ['smtp', '📧 SMTP (Email)'],
  ['shipping', '🚚 Pengiriman & Pajak'],
  ['akun', '👤 Akun & Akses'],
]

const SMTP_PRESETS = [
  { name: 'Gmail', host: 'smtp.gmail.com', port: 587, encryption: 'tls' },
  { name: 'Google Workspace', host: 'smtp.gmail.com', port: 465, encryption: 'ssl' },
  { name: 'Zoho', host: 'smtp.zoho.com', port: 587, encryption: 'tls' },
  { name: 'Yahoo', host: 'smtp.mail.yahoo.com', port: 465, encryption: 'ssl' },
  { name: 'cPanel/Bisnis', host: 'mail.domainanda.id', port: 465, encryption: 'ssl' },
]

export default function SettingsAdmin() {
  const store = useData()
  const settings = useSettings()
  const { user } = useAuth()
  const toast = useToast()

  const [tab, setTab] = useState('profil')
  const [form, setForm] = useState(() => ({ ...store.db.settings() }))
  const logoRef = useRef()
  const faviconRef = useRef()

  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const setDeep = (k, kk, v) => setForm((f) => ({ ...f, [k]: { ...f[k], [kk]: v } }))

  function readFile(file, cb) {
    const r = new FileReader()
    r.onload = () => cb(r.result)
    r.readAsDataURL(file)
  }

  function save() {
    store.db.setSettings(form)
    toast('Pengaturan disimpan ✅')
  }

  // Akun
  const [accModal, setAccModal] = useState(false)
  const [acc, setAcc] = useState({ name: '', email: '', password: '', role: 'kasir' })
  const staff = store.db.list('users').filter((u) => u.role !== 'customer')

  // SMTP: kirim email tes (simulasi mode mock)
  const [testTo, setTestTo] = useState('')
  const [testing, setTesting] = useState(false)
  const outbox = [...store.db.list('emails')].reverse().slice(0, 6)

  function applyPreset(p) {
    setForm((f) => ({ ...f, smtp: { ...f.smtp, host: p.host, port: p.port, encryption: p.encryption } }))
    toast(`Preset ${p.name} diterapkan`)
  }

  function sendTestEmail() {
    const s = form.smtp
    if (!s.host?.trim()) return toast('SMTP host masih kosong.', 'err')
    if (!s.port || Number(s.port) <= 0) return toast('Port SMTP tidak valid.', 'err')
    if (!s.fromEmail?.trim()) return toast('Email pengirim masih kosong.', 'err')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(testTo)) return toast('Masukkan alamat email tujuan yang valid.', 'err')
    setTesting(true)
    // Simulasi kirim — pada backend Laravel: endpoint /api/settings/smtp/test → Mail::raw()
    setTimeout(() => {
      setTesting(false)
      db.insert('emails', {
        to: testTo,
        subject: `Tes SMTP ${s.fromName || 'Nandin Kitchen'} ✉️`,
        body: `Ini email percobaan dari ${form.storeName}. Jika Anda menerima email ini, konfigurasi SMTP sudah benar.`,
        from: `${s.fromName} <${s.fromEmail}>`,
        status: 'terkirim (simulasi)',
      })
      toast(`Email tes berhasil dikirim ke ${testTo} ✉️`)
    }, 1300)
  }

  function addAccount() {
    if (!acc.name.trim() || !acc.email.trim() || acc.password.length < 6) return toast('Lengkapi data (password min 6 karakter).', 'err')
    if (store.db.list('users').some((u) => u.email.toLowerCase() === acc.email.toLowerCase())) return toast('Email sudah dipakai.', 'err')
    store.db.insert('users', acc)
    toast(`Akun ${acc.role} ditambahkan ✅`)
    setAccModal(false)
    setAcc({ name: '', email: '', password: '', role: 'kasir' })
  }

  return (
    <div className="stack">
      <div className="settings-tabs">
        {TABS.map(([k, l]) => (
          <button key={k} className={`chip ${tab === k ? 'active' : ''}`} onClick={() => { setTab(k); setForm({ ...store.db.settings() }) }}>{l}</button>
        ))}
      </div>

      <div className="card">
        {tab === 'profil' && (
          <>
            <h3>🏪 Profil Toko</h3>
            <div className="grid-2">
              <div><label className="label">Nama Toko</label><input className="input" value={form.storeName} onChange={(e) => setF('storeName', e.target.value)} /></div>
              <div><label className="label">Tagline</label><input className="input" value={form.tagline} onChange={(e) => setF('tagline', e.target.value)} /></div>
              <div><label className="label">Judul Hero</label><input className="input" value={form.heroTitle} onChange={(e) => setF('heroTitle', e.target.value)} /></div>
              <div><label className="label">Telepon</label><input className="input" value={form.phone} onChange={(e) => setF('phone', e.target.value)} /></div>
              <div><label className="label">Email</label><input className="input" value={form.email} onChange={(e) => setF('email', e.target.value)} /></div>
              <div><label className="label">Jam Buka</label><input className="input" value={form.openHours} onChange={(e) => setF('openHours', e.target.value)} /></div>
              <div style={{ gridColumn: '1/-1' }}><label className="label">Sub Judul Hero</label><textarea className="input" value={form.heroSubtitle} onChange={(e) => setF('heroSubtitle', e.target.value)} /></div>
              <div style={{ gridColumn: '1/-1' }}><label className="label">Alamat</label><input className="input" value={form.address} onChange={(e) => setF('address', e.target.value)} /></div>
              <div style={{ gridColumn: '1/-1' }}><label className="label">Tentang Kami</label><textarea className="input" value={form.about} onChange={(e) => setF('about', e.target.value)} /></div>
            </div>
          </>
        )}

        {tab === 'branding' && (
          <>
            <h3>🎨 Logo & Favicon (Custom)</h3>
            <p className="text-muted">Unggah logo/favicon sendiri atau pakai default Nandin Kitchen. Perubahan langsung diterapkan di seluruh aplikasi setelah disimpan.</p>
            <div className="grid-2">
              <div className="upload-box">
                <b>Logo Toko</b>
                <img src={form.logo || '/logo-nandin.png'} alt="Logo" />
                <div className="row" style={{ justifyContent: 'center' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => logoRef.current?.click()}>📤 Upload Logo</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setF('logo', '/logo-nandin.png')}>↩ Default</button>
                </div>
                <input ref={logoRef} hidden type="file" accept="image/*" onChange={(e) => e.target.files[0] && readFile(e.target.files[0], (d) => setF('logo', d))} />
                <input className="input" style={{ maxWidth: 340 }} placeholder="atau URL logo…" value={form.logo?.startsWith('data:') ? '(file terunggah)' : form.logo} onChange={(e) => setF('logo', e.target.value)} />
              </div>
              <div className="upload-box">
                <b>Favicon</b>
                <img src={form.favicon || '/favicon.png'} alt="Favicon" style={{ height: 64, width: 64, objectFit: 'contain' }} />
                <div className="row" style={{ justifyContent: 'center' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => faviconRef.current?.click()}>📤 Upload Favicon</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setF('favicon', '/favicon.png')}>↩ Default</button>
                </div>
                <input ref={faviconRef} hidden type="file" accept="image/*" onChange={(e) => e.target.files[0] && readFile(e.target.files[0], (d) => setF('favicon', d))} />
                <input className="input" style={{ maxWidth: 340 }} placeholder="atau URL favicon…" value={form.favicon?.startsWith('data:') ? '(file terunggah)' : form.favicon} onChange={(e) => setF('favicon', e.target.value)} />
              </div>
            </div>
          </>
        )}

        {tab === 'whatsapp' && (
          <>
            <h3>💬 WhatsApp Admin</h3>
            <p className="text-muted">Nomor ini dipakai oleh <b>tombol WhatsApp mengambang</b>, halaman Tentang, Checkout, dan tombol “Tanya Admin” (format 62xxx).</p>
            <div className="grid-2">
              <div><label className="label">Nomor WhatsApp Admin</label><input className="input" value={form.waNumber} onChange={(e) => setF('waNumber', e.target.value)} placeholder="6281234567890" /></div>
            </div>
            <div className="alert alert-ok mt-2">
              ✅ Nomor <b>aktif saat ini: +{waTarget(form) || '(belum ada)'}</b>
              <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                Jika kolom di atas masih nomor bawaan, otomatis memakai nomor telepon dari tab <b>Kontak &amp; Toko</b> yang sudah kamu ubah. Ubah salah satu saja — semua tombol WhatsApp langsung mengikuti.
              </div>
              <div className="mt-2">
                <a className="btn btn-outline btn-sm" href={waLink(waTarget(form), 'Tes chat dari panel pengaturan ✅')} target="_blank" rel="noopener noreferrer">📲 Tes Chat ke Nomor Ini</a>
              </div>
            </div>
          </>
        )}

        {tab === 'midtrans' && (
          <>
            <h3>💳 Midtrans (Payment Gateway)</h3>
            <div className="grid-2">
              <label className="row" style={{ gap: 8, fontWeight: 700, fontSize: 14 }}>
                <input type="checkbox" checked={!!form.midtrans.enabled} onChange={(e) => setDeep('midtrans', 'enabled', e.target.checked)} />
                Aktifkan pembayaran Midtrans
              </label>
              <div>
                <label className="label">Environment</label>
                <select className="input" value={form.midtrans.env} onChange={(e) => setDeep('midtrans', 'env', e.target.value)}>
                  <option value="sandbox">Sandbox (uji)</option>
                  <option value="production">Production</option>
                </select>
              </div>
              <div><label className="label">Merchant ID</label><input className="input" value={form.midtrans.merchantId} onChange={(e) => setDeep('midtrans', 'merchantId', e.target.value)} /></div>
              <div><label className="label">Client Key</label><input className="input" value={form.midtrans.clientKey} onChange={(e) => setDeep('midtrans', 'clientKey', e.target.value)} /></div>
              <div><label className="label">Server Key</label><PasswordInput value={form.midtrans.serverKey || ''} onChange={(v) => setDeep('midtrans', 'serverKey', v)} placeholder="Server key (rahasia)" autoComplete="off" /></div>
            </div>
            <div className="alert alert-warn mt-2">
              Catatan: pada aplikasi produksi, pembayaran harus dikonfirmasi backend melalui webhook Midtrans — bukan hanya halaman sukses di browser.
            </div>
          </>
        )}

        {tab === 'smtp' && (
          <>
            <h3>📧 SMTP — Email Keluar & Notifikasi</h3>
            <div className="grid-2">
              <label className="row" style={{ gap: 8, fontWeight: 700, fontSize: 14, gridColumn: '1/-1' }}>
                <input type="checkbox" checked={!!form.smtp.enabled} onChange={(e) => setDeep('smtp', 'enabled', e.target.checked)} />
                Aktifkan SMTP & notifikasi email otomatis
              </label>
              <div>
                <label className="label">SMTP Host</label>
                <input className="input" value={form.smtp.host} onChange={(e) => setDeep('smtp', 'host', e.target.value)} placeholder="smtp.gmail.com" />
              </div>
              <div className="grid-2" style={{ gap: 8 }}>
                <div><label className="label">Port</label><input className="input" type="number" value={form.smtp.port} onChange={(e) => setDeep('smtp', 'port', Number(e.target.value) || 0)} /></div>
                <div>
                  <label className="label">Enkripsi</label>
                  <select className="input" value={form.smtp.encryption} onChange={(e) => setDeep('smtp', 'encryption', e.target.value)}>
                    <option value="tls">TLS</option>
                    <option value="ssl">SSL</option>
                    <option value="none">Tanpa Enkripsi</option>
                  </select>
                </div>
              </div>
              <div><label className="label">Username / Email SMTP</label><input className="input" value={form.smtp.username} onChange={(e) => setDeep('smtp', 'username', e.target.value)} placeholder="email@domainanda.id" autoComplete="off" /></div>
              <div>
                <label className="label">Kata Sandi SMTP / App Password</label>
                <PasswordInput value={form.smtp.password || ''} onChange={(v) => setDeep('smtp', 'password', v)} placeholder="••••••••" autoComplete="new-password" />
              </div>
              <div><label className="label">Nama Pengirim</label><input className="input" value={form.smtp.fromName} onChange={(e) => setDeep('smtp', 'fromName', e.target.value)} placeholder="Nandin Kitchen" /></div>
              <div><label className="label">Email Pengirim</label><input className="input" type="email" value={form.smtp.fromEmail} onChange={(e) => setDeep('smtp', 'fromEmail', e.target.value)} placeholder="no-reply@nandinkitchen.id" /></div>
            </div>

            <div className="mt-2">
              <label className="label">Preset Penyedia Email</label>
              <div className="row">
                {SMTP_PRESETS.map((p) => (
                  <button key={p.name} type="button" className="chip" onClick={() => applyPreset(p)}>{p.name}</button>
                ))}
              </div>
            </div>

            <div className="mt-2">
              <label className="label">Notifikasi Email Otomatis</label>
              <div className="stack" style={{ gap: 6 }}>
                {[
                  ['newOrder', '📨 Pesanan baru diterima (untuk pelanggan & admin)'],
                  ['payment', '💰 Pembayaran terverifikasi (Midtrans / dikonfirmasi admin)'],
                  ['status', '🎉 Pesanan selesai / siap diambil'],
                ].map(([k, l]) => (
                  <label key={k} className="row" style={{ gap: 8, fontSize: 13.5, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={!!form.smtp.notify?.[k]}
                      onChange={(e) => setDeep('smtp', 'notify', { ...form.smtp.notify, [k]: e.target.checked })}
                    />
                    {l}
                  </label>
                ))}
              </div>
            </div>

            <div className="card mt-3" style={{ background: 'var(--cream)' }}>
              <label className="label">Kirim Email Tes</label>
              <div className="row">
                <input className="input" style={{ maxWidth: 300 }} value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="emailtujuan@contoh.com" />
                <button className="btn btn-primary" onClick={sendTestEmail} disabled={testing}>
                  {testing ? 'Mengirim…' : '✉️ Kirim Email Tes'}
                </button>
              </div>
              <div className="alert alert-info mt-2" style={{ marginBottom: 0 }}>
                Mode demo: email dicatat ke outbox simulasi. Pada backend Laravel, kirim via <code>Mail::send()</code> dengan konfigurasi SMTP ini (host/port/enkripsi/username/password) — jangan pernah mengekspos sandi SMTP ke browser klien.
              </div>
            </div>

            {outbox.length > 0 && (
              <div className="mt-3">
                <h4>📬 Outbox Terakhir (Simulasi)</h4>
                <div className="stack" style={{ gap: 8 }}>
                  {outbox.map((m) => (
                    <div key={m.id} className="row-between" style={{ borderBottom: '1px solid var(--cream-2)', paddingBottom: 6, fontSize: 13.5 }}>
                      <span>
                        <b>{m.subject}</b>
                        <div className="text-muted" style={{ fontSize: 12 }}>ke {m.to} · dari {m.from}</div>
                      </span>
                      <span className="text-muted" style={{ fontSize: 12 }}>{fmtDateTime(m.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'shipping' && (
          <>
            <h3>🚚 Pengiriman & Pajak</h3>
            <div className="grid-2">
              <div><label className="label">Ongkir Standar (Rp)</label><input className="input" type="number" min="0" value={form.shipping.fee} onChange={(e) => setDeep('shipping', 'fee', Number(e.target.value) || 0)} /></div>
              <div><label className="label">Gratis Ongkir Mulai (Rp)</label><input className="input" type="number" min="0" value={form.shipping.freeMin} onChange={(e) => setDeep('shipping', 'freeMin', Number(e.target.value) || 0)} /></div>
              <div><label className="label">Pajak (%)</label><input className="input" type="number" min="0" max="20" value={form.taxPercent} onChange={(e) => setF('taxPercent', Number(e.target.value) || 0)} /></div>
              <div><label className="label">Batas Notifikasi Stok Menipis</label><input className="input" type="number" min="1" value={form.lowStockMin} onChange={(e) => setF('lowStockMin', Number(e.target.value) || 5)} /></div>
            </div>
          </>
        )}

        {tab === 'akun' && (
          <>
            <div className="row-between">
              <h3 style={{ margin: 0 }}>👤 Akun Admin, Kasir & Akses</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setAccModal(true)}>+ Tambah Akun</button>
            </div>
            <div className="table-wrap mt-2" style={{ border: 0 }}>
              <table className="table">
                <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Aksi</th></tr></thead>
                <tbody>
                  {staff.map((u) => (
                    <tr key={u.id}>
                      <td><b>{u.name}</b></td>
                      <td className="text-muted">{u.email}</td>
                      <td><span className="badge badge-caramel">{u.role}</span></td>
                      <td>
                        {u.id !== user?.id ? (
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--err)' }} onClick={() => { if (confirm(`Hapus akun ${u.name}?`)) { db.remove('users', u.id); toast('Akun dihapus') } }}>🗑️</button>
                        ) : <span className="text-muted" style={{ fontSize: 12 }}>akun Anda</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="alert alert-err mt-3">
              <b>Zona Berbahaya:</b> reset seluruh data demo (produk, pesanan, laporan) ke kondisi awal.
              <button className="btn btn-danger btn-sm" style={{ marginLeft: 10 }} onClick={() => {
                if (!confirm('Reset SEMUA data aplikasi ke kondisi awal?')) return
                const pw = prompt('Konfirmasi kata sandi admin untuk reset:')
                if (pw == null) return
                db.reset({ email: user?.email, password: pw })
                toast('Data direset ke kondisi awal')
                location.reload()
              }}>
                🔄 Reset Data Demo
              </button>
            </div>
          </>
        )}

        {tab !== 'akun' && (
          <div className="row mt-3" style={{ justifyContent: 'end' }}>
            <button className="btn btn-primary" onClick={save}>💾 Simpan Pengaturan</button>
          </div>
        )}
      </div>

      <Modal open={accModal} onClose={() => setAccModal(false)} title="Tambah Akun Admin/Kasir">
        <div className="stack">
          <div><label className="label">Nama</label><input className="input" value={acc.name} onChange={(e) => setAcc({ ...acc, name: e.target.value })} /></div>
          <div><label className="label">Email</label><input className="input" type="email" value={acc.email} onChange={(e) => setAcc({ ...acc, email: e.target.value })} /></div>
          <div className="grid-2">
            <div><label className="label">Kata Sandi</label><input className="input" type="text" value={acc.password} onChange={(e) => setAcc({ ...acc, password: e.target.value })} /></div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={acc.role} onChange={(e) => setAcc({ ...acc, role: e.target.value })}>
                <option value="kasir">Kasir</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary w-full" onClick={addAccount}>Tambah Akun</button>
        </div>
      </Modal>
    </div>
  )
}
