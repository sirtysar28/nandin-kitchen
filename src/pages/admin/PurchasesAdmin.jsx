import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { adjustStock } from '../../services/db'
import { useToast } from '../../components/common/Toast'
import Modal from '../../components/common/Modal'
import { rupiah, fmtDate, todayKey, dateKey, uid } from '../../utils/format'

export default function PurchasesAdmin() {
  const { db } = useData()
  const toast = useToast()

  const [purModal, setPurModal] = useState(false)
  const [supplier, setSupplier] = useState('')
  const [purDate, setPurDate] = useState(todayKey())
  const [purNote, setPurNote] = useState('')
  const [items, setItems] = useState([])

  const [expModal, setExpModal] = useState(false)
  const [exp, setExp] = useState({ title: '', category: 'Operasional', amount: '', date: todayKey() })

  const products = db.list('products')
  const purchases = [...db.list('purchases')].sort((a, b) => b.date.localeCompare(a.date))
  const expenses = [...db.list('expenses')].sort((a, b) => b.date.localeCompare(a.date))

  const purTotal = items.reduce((s, it) => s + it.qty * it.cost, 0)

  function addItem() {
    const p = products[0]
    setItems((l) => [...l, { productId: p.id, name: p.name, qty: 1, cost: p.cost }])
  }
  const setItem = (i, k, v) =>
    setItems((l) =>
      l.map((it, x) => {
        if (x !== i) return it
        const next = { ...it, [k]: v }
        if (k === 'productId') {
          const p = db.get('products', v)
          next.name = p.name
          next.cost = p.cost
        }
        return next
      })
    )

  function savePurchase() {
    if (!supplier.trim()) return toast('Nama supplier wajib diisi.', 'err')
    if (items.length === 0) return toast('Tambahkan minimal 1 item.', 'err')
    db.insert('purchases', { supplier, date: purDate, items, total: purTotal, note: purNote })
    items.forEach((it) => adjustStock(it.productId, Number(it.qty), 'in', `Pembelian dari ${supplier}`))
    toast('Pembelian dicatat & stok masuk ✅')
    setPurModal(false); setItems([]); setSupplier(''); setPurNote('')
  }

  function saveExpense() {
    if (!exp.title.trim() || !Number(exp.amount)) return toast('Lengkapi judul dan nominal.', 'err')
    db.insert('expenses', { ...exp, amount: Number(exp.amount) })
    toast('Pengeluaran dicatat ✅')
    setExpModal(false); setExp({ title: '', category: 'Operasional', amount: '', date: todayKey() })
  }

  return (
    <div className="stack">
      <div className="row-between">
        <div className="row">
          <button className="btn btn-primary" onClick={() => setPurModal(true)}>+ Pembelian dari Supplier</button>
          <button className="btn btn-outline" onClick={() => setExpModal(true)}>+ Catat Pengeluaran</button>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h3>🚚 Pembelian (Stok Masuk)</h3>
          <div className="stack" style={{ gap: 12 }}>
            {purchases.map((p) => (
              <div key={p.id} style={{ borderBottom: '1px solid var(--cream-2)', paddingBottom: 10 }}>
                <div className="row-between">
                  <b>{p.supplier}</b>
                  <b>{rupiah(p.total)}</b>
                </div>
                <div className="text-muted" style={{ fontSize: 13 }}>
                  {fmtDate(p.date)} · {p.items.map((it) => `${it.name} ×${it.qty}`).join(', ')}
                </div>
                {p.note && <div className="text-muted" style={{ fontSize: 12.5 }}>📝 {p.note}</div>}
              </div>
            ))}
            {purchases.length === 0 && <p className="text-muted">Belum ada pembelian.</p>}
          </div>
        </div>
        <div className="card">
          <h3>💸 Pengeluaran Lain</h3>
          <div className="stack" style={{ gap: 10 }}>
            {expenses.map((e) => (
              <div key={e.id} className="row-between" style={{ borderBottom: '1px solid var(--cream-2)', paddingBottom: 8 }}>
                <span><b>{e.title}</b><div className="text-muted" style={{ fontSize: 12.5 }}>{fmtDate(e.date)} · {e.category}</div></span>
                <b style={{ color: 'var(--err)' }}>-{rupiah(e.amount)}</b>
              </div>
            ))}
            {expenses.length === 0 && <p className="text-muted">Belum ada pengeluaran.</p>}
          </div>
        </div>
      </div>

      {/* Modal pembelian */}
      <Modal open={purModal} onClose={() => setPurModal(false)} title="Pembelian Baru dari Supplier" wide>
        <div className="stack">
          <div className="grid-2">
            <div>
              <label className="label">Supplier</label>
              <input className="input" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Nama supplier / toko bahan" />
            </div>
            <div>
              <label className="label">Tanggal</label>
              <input className="input" type="date" value={purDate} onChange={(e) => setPurDate(e.target.value)} />
            </div>
          </div>
          <div>
            <div className="row-between">
              <label className="label" style={{ margin: 0 }}>Item Bahan / Produk</label>
              <button className="btn btn-outline btn-sm" onClick={addItem}>+ Item</button>
            </div>
            <div className="stack mt-1" style={{ gap: 8 }}>
              {items.map((it, i) => (
                <div key={i} className="row" style={{ gap: 6 }}>
                  <select className="input" value={it.productId} onChange={(e) => setItem(i, 'productId', e.target.value)} style={{ flex: 2 }}>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input className="input" style={{ maxWidth: 90 }} type="number" min="1" value={it.qty} onChange={(e) => setItem(i, 'qty', Number(e.target.value) || 0)} placeholder="Qty" />
                  <input className="input" style={{ maxWidth: 130 }} type="number" min="0" value={it.cost} onChange={(e) => setItem(i, 'cost', Number(e.target.value) || 0)} placeholder="Harga beli" />
                  <span style={{ minWidth: 90, textAlign: 'right', fontWeight: 700, fontSize: 13.5 }}>{rupiah(it.qty * it.cost)}</span>
                  <button className="icon-btn" onClick={() => setItems((l) => l.filter((_, x) => x !== i))}>🗑️</button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Catatan</label>
            <input className="input" value={purNote} onChange={(e) => setPurNote(e.target.value)} />
          </div>
          <div className="summary-row total"><span>Total Pembelian</span><span>{rupiah(purTotal)}</span></div>
          <div className="row" style={{ justifyContent: 'end' }}>
            <button className="btn btn-ghost" onClick={() => setPurModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={savePurchase}>💾 Simpan & Stok Masuk</button>
          </div>
        </div>
      </Modal>

      {/* Modal pengeluaran */}
      <Modal open={expModal} onClose={() => setExpModal(false)} title="Catat Pengeluaran">
        <div className="stack">
          <div>
            <label className="label">Judul</label>
            <input className="input" value={exp.title} onChange={(e) => setExp({ ...exp, title: e.target.value })} placeholder="Contoh: gas, listrik, kemasan" />
          </div>
          <div className="grid-2">
            <div>
              <label className="label">Kategori</label>
              <select className="input" value={exp.category} onChange={(e) => setExp({ ...exp, category: e.target.value })}>
                {['Operasional', 'Bahan Baku', 'Packing', 'Gaji', 'Lain-lain'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Nominal (Rp)</label>
              <input className="input" type="number" min="0" value={exp.amount} onChange={(e) => setExp({ ...exp, amount: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Tanggal</label>
            <input className="input" type="date" value={exp.date} onChange={(e) => setExp({ ...exp, date: e.target.value })} />
          </div>
          <button className="btn btn-primary w-full" onClick={saveExpense}>Simpan Pengeluaran</button>
        </div>
      </Modal>
    </div>
  )
}
