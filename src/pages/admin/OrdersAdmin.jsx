import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { useSettings } from '../../context/SettingsContext'
import { setOrderStatus, markOrderPaid } from '../../services/db'
import { useToast } from '../../components/common/Toast'
import Modal from '../../components/common/Modal'
import Receipt from '../../components/admin/Receipt'
import { rupiah, fmtDateTime, STATUS_ORDER, STATUS_LABEL, STATUS_COLOR, PAY_LABEL, STATUS_ORDER as FLOW } from '../../utils/format'
import { buildOrderMessage, waLink, waTarget } from '../../utils/wa'

export default function OrdersAdmin() {
  const { db } = useData()
  const settings = useSettings()
  const toast = useToast()
  const [channel, setChannel] = useState('all')
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const [detail, setDetail] = useState(null)

  let orders = db.list('orders')
  if (channel !== 'all') orders = orders.filter((o) => o.channel === channel)
  if (status !== 'all') orders = orders.filter((o) => o.status === status)
  if (q.trim()) {
    const s = q.toLowerCase()
    orders = orders.filter((o) => o.number.toLowerCase().includes(s) || o.customerName.toLowerCase().includes(s) || o.customerPhone?.includes(s))
  }

  const nextStatus = (o) => {
    const i = FLOW.indexOf(o.status)
    if (i === -1 || i === FLOW.length - 1) return null
    return FLOW[i + 1]
  }

  const open = detail ? db.get('orders', detail) : null

  return (
    <div className="stack">
      <div className="card row-between" style={{ padding: 14 }}>
        <div className="row">
          <select className="input" style={{ maxWidth: 160 }} value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="all">Semua Kanal</option>
            <option value="online">🌐 Online</option>
            <option value="kasir">🏪 Kasir</option>
          </select>
          <select className="input" style={{ maxWidth: 200 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Semua Status</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input className="input" style={{ maxWidth: 240 }} placeholder="🔍 Cari no. pesanan / nama…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="text-muted" style={{ fontSize: 13 }}>{orders.length} pesanan</span>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>No. Pesanan</th><th>Pelanggan</th><th>Kanal</th><th>Item</th><th>Total</th><th>Pembayaran</th><th>Status</th><th>Waktu</th><th></th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setDetail(o.id)}>
                <td><b>{o.number}</b></td>
                <td>{o.customerName}<div className="text-muted" style={{ fontSize: 12 }}>{o.customerPhone}</div></td>
                <td><span className="badge">{o.channel === 'kasir' ? '🏪 Kasir' : '🌐 Online'}</span></td>
                <td>{o.items.reduce((s, it) => s + it.qty, 0)} item</td>
                <td><b>{rupiah(o.total)}</b></td>
                <td>
                  <span className={`badge ${o.payment.status === 'paid' ? 'badge-ok' : 'badge-warn'}`}>
                    {o.payment.status === 'paid' ? 'Lunas' : 'Belum'}
                  </span>
                </td>
                <td><span className={`badge badge-${STATUS_COLOR[o.status]}`}>{STATUS_LABEL[o.status]}</span></td>
                <td className="text-muted" style={{ fontSize: 12.5 }}>{fmtDateTime(o.createdAt)}</td>
                <td><button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); setDetail(o.id) }}>Detail</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!open} onClose={() => setDetail(null)} title={`Pesanan ${open?.number || ''}`} wide>
        {open && (
          <div className="stack">
            <div className="row-between">
              <span className={`badge badge-${STATUS_COLOR[open.status]}`}>{STATUS_LABEL[open.status]}</span>
              <span className={`badge ${open.payment.status === 'paid' ? 'badge-ok' : 'badge-warn'}`}>
                {PAY_LABEL[open.payment?.method] || open.payment?.method} · {open.payment.status === 'paid' ? 'Lunas' : 'Belum dibayar'}
              </span>
            </div>

            <div className="grid-2">
              <div>
                <h4 style={{ margin: '6px 0' }}>👤 Pelanggan</h4>
                <p style={{ margin: 0 }}>{open.customerName} — {open.customerPhone}</p>
                {open.delivery.type !== 'langsung' && (
                  <p className="text-muted" style={{ margin: '4px 0', fontSize: 13.5 }}>
                    {open.delivery.type === 'pickup'
                      ? `🏪 Ambil di toko: ${open.delivery.date} ${open.delivery.time}`
                      : `🛵 Antar: ${open.delivery.address}, ${open.delivery.city} ${open.delivery.postal || ''} — ${open.delivery.date} ${open.delivery.time}`}
                  </p>
                )}
                {open.note && <p className="text-muted" style={{ fontSize: 13.5 }}>📝 {open.note}</p>}
              </div>
              <div>
                <h4 style={{ margin: '6px 0' }}>📦 Item</h4>
                {open.items.map((it, i) => (
                  <div key={i} className="row-between" style={{ fontSize: 13.5 }}>
                    <span>{it.emoji} {it.name} {[it.size, it.variant].filter(Boolean).join(' · ')} <b>×{it.qty}</b></span>
                    <b>{rupiah(it.price * it.qty)}</b>
                  </div>
                ))}
                <div className="summary-row total"><span>Total</span><span>{rupiah(open.total)}</span></div>
              </div>
            </div>

            <div className="row" style={{ justifyContent: 'end' }}>
              {open.payment.status !== 'paid' && open.status !== 'dibatalkan' && (
                <button
                  className="btn btn-ok"
                  onClick={() => { markOrderPaid(open.id); toast('Pembayaran ditandai lunas ✅') }}
                >
                  ✅ Tandai Lunas
                </button>
              )}
              {open.payment.method === 'wa' && open.status !== 'dibatalkan' && (
                <a
                  className="btn btn-outline"
                  href={waLink(waTarget(settings), buildOrderMessage(open, settings).replace('PESANAN BARU', 'KONFIRMASI PESANAN'))}
                  target="_blank" rel="noopener noreferrer"
                >
                  💬 Konfirmasi via WA
                </a>
              )}
              {nextStatus(open) && (
                <button
                  className="btn btn-primary"
                  onClick={() => { setOrderStatus(open.id, nextStatus(open)); toast(`Status → ${STATUS_LABEL[nextStatus(open)]}`) }}
                >
                  Proses → {STATUS_LABEL[nextStatus(open)]}
                </button>
              )}
              {open.status !== 'dibatalkan' && open.status !== 'selesai' && (
                <button
                  className="btn btn-ghost" style={{ color: 'var(--err)' }}
                  onClick={() => { if (confirm('Batalkan pesanan ini?')) { setOrderStatus(open.id, 'dibatalkan'); toast('Pesanan dibatalkan') } }}
                >
                  Batalkan
                </button>
              )}
            </div>

            <Receipt order={open} settings={settings} />
            <div className="row" style={{ justifyContent: 'end' }}>
              <button className="btn btn-outline btn-sm" onClick={() => window.print()}>🖨️ Cetak Struk</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
