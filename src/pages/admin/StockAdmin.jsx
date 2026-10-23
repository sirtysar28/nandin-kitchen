import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { useSettings } from '../../context/SettingsContext'
import { adjustStock } from '../../services/db'
import { useToast } from '../../components/common/Toast'
import Modal from '../../components/common/Modal'
import Photo from '../../components/common/Photo'
import { rupiah, fmtDateTime } from '../../utils/format'

export default function StockAdmin() {
  const { db } = useData()
  const settings = useSettings()
  const toast = useToast()
  const [move, setMove] = useState(null) // { product, type }
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [q, setQ] = useState('')

  const products = db.list('products').filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))
  const moves = db.list('stockMoves').slice(-14).reverse()
  const low = db.list('products').filter((p) => p.stock <= (settings.lowStockMin || 5))

  function apply() {
    if (!qty || qty <= 0) return toast('Jumlah tidak valid.', 'err')
    adjustStock(move.product.id, Number(qty), move.type, note || (move.type === 'in' ? 'Stok masuk manual' : 'Stok keluar / penyesuaian'))
    toast(`Stok ${move.product.name} ${move.type === 'in' ? 'ditambah' : 'dikurangi'} ${qty} ✅`)
    setMove(null); setQty(1); setNote('')
  }

  return (
    <div className="stack">
      {low.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--warn)' }}>
          <h3 style={{ margin: '0 0 10px' }}>⚠️ Stok Menipis (≤ {settings.lowStockMin})</h3>
          <div className="row">
            {low.map((p) => (
              <span key={p.id} className="badge badge-warn">{p.emoji} {p.name} — sisa {p.stock}</span>
            ))}
          </div>
        </div>
      )}

      <div className="card row-between" style={{ padding: 14 }}>
        <input className="input" style={{ maxWidth: 320 }} placeholder="🔍 Cari produk…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="text-muted" style={{ fontSize: 13 }}>Kartu stok tercatat otomatis dari penjualan, pembelian, dan penyesuaian manual.</span>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Produk</th><th>SKU</th><th>Harga Jual</th><th>Stok Saat Ini</th><th>Status</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td><div className="row" style={{ gap: 10 }}><Photo item={p} size="sm" /><b>{p.name}</b></div></td>
                <td className="text-muted">{p.sku}</td>
                <td>{rupiah(p.price)}</td>
                <td><b style={{ fontSize: 16 }}>{p.stock}</b></td>
                <td>
                  <span className={`badge ${p.stock <= (settings.lowStockMin || 5) ? 'badge-warn' : p.stock === 0 ? 'badge-err' : 'badge-ok'}`}>
                    {p.stock === 0 ? 'Habis' : p.stock <= (settings.lowStockMin || 5) ? 'Menipis' : 'Aman'}
                  </span>
                </td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => setMove({ product: p, type: 'in' })}>➕ Masuk</button>
                    <button className="btn btn-outline btn-sm" onClick={() => setMove({ product: p, type: 'out' })}>➖ Keluar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>🗒️ Riwayat Pergerakan Stok (14 terakhir)</h3>
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="table">
            <thead><tr><th>Waktu</th><th>Produk</th><th>Tipe</th><th>Jumlah</th><th>Keterangan</th></tr></thead>
            <tbody>
              {moves.map((m) => (
                <tr key={m.id}>
                  <td className="text-muted" style={{ fontSize: 12.5 }}>{fmtDateTime(m.createdAt)}</td>
                  <td>{m.name}</td>
                  <td>
                    <span className={`badge ${m.type === 'in' ? 'badge-ok' : m.type === 'out' ? 'badge-err' : 'badge-info'}`}>
                      {m.type === 'in' ? 'Masuk' : 'Keluar'}
                    </span>
                  </td>
                  <td><b>{m.qty}</b></td>
                  <td className="text-muted">{m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!move} onClose={() => setMove(null)} title={move ? `${move.type === 'in' ? 'Stok Masuk' : 'Stok Keluar'} — ${move.product.name}` : ''}>
        {move && (
          <div className="stack">
            <p className="text-muted" style={{ margin: 0 }}>Stok saat ini: <b>{move.product.stock}</b></p>
            <div>
              <label className="label">Jumlah</label>
              <input className="input" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label">Keterangan</label>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contoh: koreksi hasil stock opname" />
            </div>
            <button className="btn btn-primary w-full" onClick={apply}>Simpan Penyesuaian</button>
          </div>
        )}
      </Modal>
    </div>
  )
}
