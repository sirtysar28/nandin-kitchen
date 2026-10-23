import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../../context/DataContext'
import { useSettings } from '../../context/SettingsContext'
import BarChart from '../../components/common/Chart'
import { rupiah, todayKey, dateKey, fmtDateTime, STATUS_LABEL, STATUS_COLOR } from '../../utils/format'

const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

export default function Dashboard() {
  const { db } = useData()
  const settings = useSettings()
  const orders = db.list('orders')
  const products = db.list('products')

  const data = useMemo(() => {
    const today = todayKey()
    const valid = orders.filter((o) => o.status !== 'dibatalkan')
    const todayOrders = valid.filter((o) => dateKey(o.createdAt) === today)
    const omzetToday = todayOrders.reduce((s, o) => s + o.total, 0)
    const pending = orders.filter((o) => o.status === 'menunggu')
    const unpaid = orders.filter((o) => o.payment.status !== 'paid' && o.status !== 'dibatalkan')

    // Grafik 7 hari
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = dateKey(d.toISOString())
      const omzet = valid.filter((o) => dateKey(o.createdAt) === key).reduce((s, o) => s + o.total, 0)
      days.push({ label: HARI[d.getDay()], value: omzet })
    }

    // Produk terlaris (30 hari terakhir)
    const sold = {}
    valid.forEach((o) =>
      o.items.forEach((it) => {
        sold[it.productId] = sold[it.productId] || { name: it.name, emoji: it.emoji, qty: 0, omzet: 0 }
        sold[it.productId].qty += it.qty
        sold[it.productId].omzet += it.price * it.qty
      })
    )
    const top = Object.values(sold).sort((a, b) => b.qty - a.qty).slice(0, 5)
    const lowStock = products.filter((p) => p.stock <= (settings.lowStockMin || 5))

    return { omzetToday, todayOrders, pending, unpaid, days, top, lowStock, recent: orders.slice(0, 6) }
  }, [orders.length, products.map((p) => p.stock).join()])

  return (
    <div className="stack">
      <div className="stat-grid">
        <div className="card stat">
          <div className="stat-ico ico-caramel">💰</div>
          <div><b>{rupiah(data.omzetToday)}</b><span>Omzet hari ini</span></div>
        </div>
        <div className="card stat">
          <div className="stat-ico ico-info">🧾</div>
          <div><b>{data.todayOrders.length}</b><span>Transaksi hari ini</span></div>
        </div>
        <Link to="/admin/orders" className="card stat" style={{ color: 'inherit' }}>
          <div className="stat-ico ico-warn">🔔</div>
          <div><b>{data.pending.length}</b><span>Pesanan menunggu konfirmasi</span></div>
        </Link>
        <div className="card stat">
          <div className="stat-ico ico-ok">📦</div>
          <div><b>{data.unpaid.length}</b><span>Tagihan belum lunas</span></div>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="row-between mb-2">
            <h3 style={{ margin: 0 }}>📈 Penjualan 7 Hari Terakhir</h3>
          </div>
          <BarChart data={data.days} />
        </div>
        <div className="card">
          <h3>⭐ Produk Terlaris</h3>
          <div className="stack" style={{ gap: 10 }}>
            {data.top.map((t, i) => (
              <div key={i} className="row-between" style={{ padding: '6px 0', borderBottom: i < data.top.length - 1 ? '1px solid var(--cream-2)' : 0 }}>
                <span>{t.emoji} {t.name}</span>
                <b>{t.qty} pcs · {rupiah(t.omzet)}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      {data.lowStock.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--warn)' }}>
          <h3>⚠️ Notifikasi Stok Menipis</h3>
          <div className="row">
            {data.lowStock.map((p) => (
              <span key={p.id} className="badge badge-warn">{p.emoji} {p.name} — sisa {p.stock}</span>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="row-between mb-2">
          <h3 style={{ margin: 0 }}>🕒 Pesanan Terbaru</h3>
          <Link to="/admin/orders" className="btn btn-outline btn-sm">Lihat semua →</Link>
        </div>
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="table">
            <thead>
              <tr><th>No. Pesanan</th><th>Pelanggan</th><th>Kanal</th><th>Total</th><th>Status</th><th>Waktu</th></tr>
            </thead>
            <tbody>
              {data.recent.map((o) => (
                <tr key={o.id}>
                  <td><b>{o.number}</b></td>
                  <td>{o.customerName}</td>
                  <td><span className="badge">{o.channel === 'kasir' ? '🏪 Kasir' : '🌐 Online'}</span></td>
                  <td><b>{rupiah(o.total)}</b></td>
                  <td><span className={`badge badge-${STATUS_COLOR[o.status]}`}>{STATUS_LABEL[o.status]}</span></td>
                  <td className="text-muted">{fmtDateTime(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
