// Modal scan pembayaran (QRIS) — dibuka dari tombol tengah navigasi bawah mobile.
// Pelanggan wajib login. Menampilkan QRIS toko + daftar tagihan belum lunas.
// (Fitur scan kamera otomatis menyusul — sekarang konfirmasi via kasir/WA.)
import { Link } from 'react-router-dom'
import Modal from './Modal'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { useData } from '../../context/DataContext'
import { rupiah } from '../../utils/format'

export default function ScanPayModal({ open, onClose, onNeedLogin }) {
  const { user } = useAuth()
  const settings = useSettings()
  const { db } = useData()

  const unpaid = user
    ? db.list('orders').filter(
        (o) =>
          (o.customerId === user.id || (o.customerEmail && o.customerEmail.toLowerCase() === user.email?.toLowerCase())) &&
          o.payment?.status !== 'paid' &&
          o.status !== 'dibatalkan'
      )
    : []
  const total = unpaid.reduce((s, o) => s + o.total, 0)

  return (
    <Modal open={open} onClose={onClose} title="📷 Scan Pembayaran">
      {!user ? (
        <div className="stack" style={{ textAlign: 'center', alignItems: 'center' }}>
          <div style={{ fontSize: 46 }}>🔒</div>
          <p style={{ margin: 0 }}>Pembayaran scan khusus pelanggan yang sudah masuk.<br />Masuk dulu ya!</p>
          <button className="btn btn-primary" onClick={onNeedLogin}>Masuk / Daftar</button>
        </div>
      ) : (
        <div className="stack">
          {settings.qris ? (
            <div style={{ display: 'grid', placeItems: 'center' }}>
              <img
                src={settings.qris}
                alt="QRIS Nandin Kitchen"
                style={{ width: 235, maxWidth: '100%', borderRadius: 14, border: '1px solid var(--cream-2)', background: '#fff', padding: 8 }}
              />
            </div>
          ) : (
            <div className="upload-box">
              <b>QRIS belum diatur</b>
              <span className="text-muted" style={{ fontSize: 13 }}>
                Admin dapat mengunggah gambar QRIS di Dashboard → Pengaturan → Pembayaran (Midtrans).
              </span>
            </div>
          )}

          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9, fontSize: 14 }}>
            <li>Buka aplikasi e-wallet / m-Banking kesukaanmu</li>
            <li>Pilih menu <b>Scan QRIS</b>, arahkan ke kode di atas</li>
            <li>Masukkan nominal & konfirmasi pembayaran</li>
          </ol>

          {unpaid.length > 0 && (
            <div className="card" style={{ padding: 14 }}>
              <b>🧾 Tagihan belum lunas ({unpaid.length})</b>
              <div className="stack" style={{ gap: 6, marginTop: 8, fontSize: 13.5 }}>
                {unpaid.map((o) => (
                  <div key={o.id} className="row-between">
                    <span>{o.number}</span>
                    <b>{rupiah(o.total)}</b>
                  </div>
                ))}
                <div className="row-between" style={{ borderTop: '1px solid var(--cream-2)', paddingTop: 6 }}>
                  <b>Total tagihan</b>
                  <b style={{ color: 'var(--caramel-600)' }}>{rupiah(total)}</b>
                </div>
              </div>
            </div>
          )}

          <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
            💡 Scan kamera otomatis akan hadir di pembaruan berikutnya. Saat ini, tunjukkan bukti pembayaran ke kasir atau konfirmasi via WhatsApp.
          </p>
          <Link to="/my-orders" className="btn btn-outline w-full" onClick={onClose}>Lihat Pesanan Saya →</Link>
        </div>
      )}
    </Modal>
  )
}
