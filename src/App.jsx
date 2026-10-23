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
    if (isSyncBlocked()) blocked()
    window.addEventListener('nk-sync-blocked', blocked)
    window.addEventListener('nk-sync-recovered', recovered)
    return () => {
      window.removeEventListener('nk-sync-blocked', blocked)
      window.removeEventListener('nk-sync-recovered', recovered)
    }
  }, [toast])

  return <Router />
}
