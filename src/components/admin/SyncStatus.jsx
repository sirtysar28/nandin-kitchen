import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import { getSyncInfo, retrySync, testConnection } from '../../services/db'

// Pill status koneksi database di topbar admin + panel diagnostik.
// Tujuannya supaya masalah sinkronisasi KELIHATAN langsung penyebabnya:
// API tidak ditemukan, config.php belum diisi, sesi habis, atau antrean nyangkut.
export default function SyncStatus() {
  const [info, setInfo] = useState(getSyncInfo)
  const [open, setOpen] = useState(false)
  const [test, setTest] = useState(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    const refresh = () => setInfo(getSyncInfo())
    window.addEventListener('nk-sync-state', refresh)
    const t = setInterval(refresh, 3000) // panjang antrean berubah tanpa event
    return () => {
      window.removeEventListener('nk-sync-state', refresh)
      clearInterval(t)
    }
  }, [])

  let pill = '🟢 Database'
  let cls = 'sync-pill ok'
  if (info.mode === 'local') {
    pill = '💾 Mode Lokal'
    cls = 'sync-pill warn'
  } else if (info.blocked) {
    pill = '🔴 Sesi Habis'
    cls = 'sync-pill bad'
  } else if (info.state === 'offline') {
    pill = '🔴 DB Terputus'
    cls = 'sync-pill bad'
  } else if (info.queue > 0) {
    pill = `🟡 ${info.queue} Menunggu`
    cls = 'sync-pill warn'
  } else if (info.state === 'connecting') {
    pill = '⏳ Menyambung…'
    cls = 'sync-pill warn'
  }

  async function runTest() {
    setTesting(true)
    setTest(null)
    retrySync()
    setTest(await testConnection())
    setTesting(false)
  }

  const stateLabel = {
    local: 'Mode lokal (localStorage saja — build tanpa VITE_API_URL)',
    connecting: 'Menyambung ke server…',
    online: 'Tersambung ke database',
    offline: 'TERPUTUS dari server',
  }

  return (
    <>
      <button className={cls} onClick={() => setOpen(true)} title="Status sinkronisasi database — klik untuk detail">
        {pill}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="🔗 Status Sinkronisasi Database"
        footer={
          <>
            <button className="btn btn-ghost" onClick={runTest} disabled={testing}>
              {testing ? 'Menguji…' : '🧪 Tes Ulang Koneksi'}
            </button>
            <button className="btn btn-primary" onClick={() => setOpen(false)}>Tutup</button>
          </>
        }
      >
        <div className="stack">
          <div>
            <b>Status:</b>{' '}
            <span style={{ color: info.state === 'online' ? 'var(--ok, green)' : info.state === 'offline' ? 'var(--err, red)' : 'inherit' }}>
              {stateLabel[info.state] || info.state}
            </span>
          </div>
          <div style={{ wordBreak: 'break-all' }}><b>URL API:</b> {info.apiUrl}</div>
          <div><b>Perubahan menunggu dikirim:</b> {info.queue}</div>
          <div><b>Sesi admin server:</b> {info.blocked ? '⛔ Ditolak (403) — keluar lalu masuk lagi' : '✅ OK'}</div>
          <div><b>Pemeriksaan terakhir:</b> {info.checkedAt ? new Date(info.checkedAt).toLocaleTimeString('id-ID') : '-'}</div>
          {info.message && (
            <div className="alert alert-err" style={{ margin: 0 }}>
              <b>Pesan server:</b> {info.message}
            </div>
          )}
          {info.mode === 'local' && (
            <div className="alert alert-warn" style={{ margin: 0 }}>
              Aplikasi berjalan tanpa server. Semua perubahan hanya tersimpan di browser ini.
              Pastikan file <code>.env</code> berisi <code>VITE_API_URL=/api</code> lalu jalankan <code>npm run build</code> dan upload ulang folder <code>dist</code>.
            </div>
          )}
          {test && (
            <div>
              <b>Hasil tes mentah:</b>
              <pre style={{ background: 'rgba(0,0,0,.06)', padding: 10, borderRadius: 8, fontSize: 12, overflow: 'auto', maxHeight: 220 }}>
{JSON.stringify(test, null, 2)}
              </pre>
            </div>
          )}
          <div className="text-muted" style={{ fontSize: 12.5 }}>
            Catatan: perubahan dari dashboard selalu masuk antrean dan dikirim otomatis begitu server kembali tersambung.
            Jika status “Sesi Habis”, keluar → masuk lagi agar sesi PHP dibuat ulang, seluruh antrean terkirim sendiri.
          </div>
        </div>
      </Modal>
    </>
  )
}
