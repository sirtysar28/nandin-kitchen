import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { setOrderStatus } from '../../services/db'
import { useToast } from '../../components/common/Toast'
import { rupiah, fmtDateTime, STATUS_ORDER, STATUS_LABEL, STATUS_COLOR, PAY_LABEL } from '../../utils/format'
import { waLink, waTarget } from '../../utils/wa'
import { useSettings } from '../../context/SettingsContext'

export default function MyOrders() {
  const { user } = useAuth()
  const settings = useSettings()
  const { db } = useData()
  const toast = useToast()

  if (!user) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 48 }}>
        <h2>Masuk dulu ya 🔐</h2>
        <p className="text-muted">Login untuk melihat riwayat dan status pesananmu.</p>
        <Link to="/" className="btn btn-primary">Kembali ke Beranda</Link>
      </div>
    )
  }

  const orders = db.list('orders').filter((o) => o.customerId === user.id || o.customerEmail === user.email)

  if (orders.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 48 }}>
        <div style={{ fontSize: 56 }}>📦</div>
        <h2>Belum ada pesanan</h2>
        <p className="text-muted">Pesanan pertamamu menunggu. Yuk pilih kue favorit!</p>
        <Link to="/products" className="btn btn-primary">Mulai Belanja 🍰</Link>
      </div>
    )
  }

  const cancel = (o) => {
    setOrderStatus(o.id, 'dibatalkan')
    toast(`Pesanan ${o.number} dibatalkan`)
  }

  return (
    <div>
      <h1>Pesanan Saya 📦</h1>
      <div className="stack">
        {orders.map((o) => {
          const cancelled = o.status === 'dibatalkan'
          const stepIdx = STATUS_ORDER.indexOf(o.status)
          return (
            <div key={o.id} className="card">
              <div className="row-between mb-1">
                <div>
                  <b>{o.number}</b>
                  <div className="text-muted" style={{ fontSize: 13 }}>{fmtDateTime(o.createdAt)} · {o.channel === 'kasir' ? 'Pembelian di toko' : 'Online'}</div>
                </div>
                <span className={`badge badge-${STATUS_COLOR[o.status]}`}>{STATUS_LABEL[o.status]}</span>
              </div>

              {!cancelled && o.channel === 'online' && (
                <div className="timeline">
                  {STATUS_ORDER.map((s, i) => (
                    <div key={s} className={`tl-step ${i <= stepIdx ? 'done' : ''}`}>
                      <div className="dot">{i < stepIdx ? '✓' : i === stepIdx ? '●' : ''}</div>
                      {STATUS_LABEL[s]}
                    </div>
                  ))}
                </div>
              )}

              <div className="stack" style={{ gap: 6, fontSize: 14 }}>
                {o.items.map((it, i) => (
                  <div key={i} className="row-between">
                    <span>{it.emoji} {it.name} {[it.size, it.variant].filter(Boolean).join(' · ')} <b>×{it.qty}</b></span>
                    <b>{rupiah(it.price * it.qty)}</b>
                  </div>
                ))}
              </div>
              <div className="row-between mt-2" style={{ borderTop: '1px dashed var(--cream-3)', paddingTop: 10 }}>
                <div>
                  <div className="text-muted" style={{ fontSize: 12.5 }}>
                    {PAY_LABEL[o.payment.method] || o.payment.method} ·{' '}
                    <b style={{ color: o.payment.status === 'paid' ? 'var(--ok)' : 'var(--warn)' }}>
                      {o.payment.status === 'paid' ? 'Lunas' : 'Belum dibayar'}
                    </b>
                    {o.delivery.type !== 'langsung' && (
                      <> · {o.delivery.type === 'pickup' ? `Ambil ${o.delivery.date} ${o.delivery.time}` : `Antar ${o.delivery.date}`}</>
                    )}
                  </div>
                </div>
                <div className="row">
                  <b style={{ fontSize: 17 }}>{rupiah(o.total)}</b>
                  {o.status === 'menunggu' && (
                    <>
                      <a className="btn btn-outline btn-sm" href={waLink(waTarget(settings), `Halo, saya ingin konfirmasi pesanan ${o.number}`)} target="_blank" rel="noopener noreferrer">💬 Tanya Admin</a>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--err)' }} onClick={() => cancel(o)}>Batalkan</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
