import { useSettings } from '../../context/SettingsContext'
import { waLink, waTarget } from '../../utils/wa'

export default function About() {
  const s = useSettings()
  return (
    <div>
      <h1>Tentang Kami 🧁</h1>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div style={{ fontSize: 56, textAlign: 'center' }}>👩‍🍳</div>
          <h2 style={{ textAlign: 'center' }}>{s.storeName}</h2>
          <p>{s.about}</p>
          <p className="text-muted">
            Setiap produk kami dibuat setelah pesanan masuk atau dipanggang segar pada pagi hari, sehingga
            kualitas dan kesegaran selalu terjaga. Kami melayani pesanan untuk ulang tahun, hampers lebaran,
            souvenir pernikahan, hingga kebutuhan katering kue.
          </p>
        </div>
        <div className="stack">
          <div className="card">
            <h3>📍 Lokasi & Kontak</h3>
            <p style={{ margin: '4px 0' }}>🏪 {s.address}</p>
            <p style={{ margin: '4px 0' }}>📞 {s.phone}</p>
            <p style={{ margin: '4px 0' }}>✉️ {s.email}</p>
            <p style={{ margin: '4px 0' }}>🕒 {s.openHours}</p>
            <a className="btn btn-primary mt-2" href={waLink(waTarget(s), 'Halo Nandin Kitchen!')} target="_blank" rel="noopener noreferrer">
              💬 Chat WhatsApp Kami
            </a>
          </div>
          <div className="card">
            <h3>💳 Cara Pesan</h3>
            <ol style={{ paddingLeft: 20, margin: 0 }}>
              <li>Pilih kue favoritmu di katalog</li>
              <li>Tentukan ukuran, varian, dan jadwal</li>
              <li>Checkout via WhatsApp atau Midtrans</li>
              <li>Pesanan diproses & dilacak di menu Pesanan Saya</li>
              <li>Ambil di toko atau tunggu kurir datang 🛵</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
