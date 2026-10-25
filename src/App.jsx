import { useEffect } from 'react'
import Router from './app/router'
import { useToast } from './components/common/Toast'
import { isSyncBlocked } from './services/db'

export default function App() {
  const toast = useToast()

  // Peringatan sinkronisasi database: sesi admin di server ditolak/kedaluwarsa
  // → perubahan ditahan di antrean; login ulang akan mengirim semuanya.
  useEffect(() => {
    const blocked = () =>
      toast('Perubahan belum tersimpan ke server — sesi admin berakhir. Silakan keluar lalu masuk lagi.', 'err')
    const recovered = () => toast('Semua perubahan tersimpan ke database.', 'ok')
    // Login admin berhasil secara lokal, tapi sesi PHP di server gagal dibuat
    // (password berbeda di database / API bermasalah) → tulisan admin akan
    // ditolak 403. Beri tahu eksplisit supaya tidak dikira sudah tersimpan.
    const sessionFailed = () =>
      toast('Sesi admin di server gagal dibuat — perubahan TIDAK akan tersimpan ke database. Buka panel 🔗 status di dashboard admin untuk detail.', 'err')
    if (isSyncBlocked()) blocked()
    window.addEventListener('nk-sync-blocked', blocked)
    window.addEventListener('nk-sync-recovered', recovered)
    window.addEventListener('nk-session-failed', sessionFailed)
    return () => {
      window.removeEventListener('nk-sync-blocked', blocked)
      window.removeEventListener('nk-sync-recovered', recovered)
      window.removeEventListener('nk-session-failed', sessionFailed)
    }
  }, [toast])

  return <Router />
}
