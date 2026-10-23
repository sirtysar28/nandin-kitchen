import { useMemo, useState } from 'react'
import { useData } from '../../context/DataContext'
import { useSettings } from '../../context/SettingsContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../components/common/Toast'
import { createOrder, applyOrderStock } from '../../services/db'
import { rupiah } from '../../utils/format'
import Photo from '../../components/common/Photo'
import Modal from '../../components/common/Modal'
import Receipt from '../../components/admin/Receipt'

export default function POS() {
  const { db } = useData()
  const settings = useSettings()
  const { user } = useAuth()
  const toast = useToast()

  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [cart, setCart] = useState([])
  const [discount, setDiscount] = useState(0)
  const [method, setMethod] = useState('tunai')
  const [paidInput, setPaidInput] = useState('')
  const [lastOrder, setLastOrder] = useState(null)

  const products = db.list('products').filter((p) => p.active)
  const categories = db.list('categories')

  const list = useMemo(() => {
    let l = products
    if (cat !== 'all') l = l.filter((p) => p.categoryId === cat)
    if (q.trim()) {
      const s = q.toLowerCase()
      l = l.filter((p) => p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s))
    }
    return l
  }, [q, cat, products])

  const subtotal = cart.reduce((s, it) => s + it.price * it.qty, 0)
  const afterDisc = Math.max(0, subtotal - discount)
  const tax = Math.round((afterDisc * (settings.taxPercent || 0)) / 100)
  const total = afterDisc + tax
  const paid = Number(paidInput) || 0
  const change = paid - total

  function addProduct(p) {
    if (p.stock <= 0 && !p.preorder) return toast(`${p.name} stok habis`, 'err')
    setCart((c) => {
      const i = c.findIndex((x) => x.productId === p.id && x.size === (p.sizes?.[0]?.name || ''))
      if (i > -1) {
        const next = [...c]
        next[i] = { ...next[i], qty: next[i].qty + 1 }
        return next
      }
      return [
        ...c,
        {
          productId: p.id, name: p.name, emoji: p.emoji, photo: p.photo, sku: p.sku,
          size: p.sizes?.[0]?.name || '', variant: p.variants?.[0]?.name || '',
          price: p.price + (p.sizes?.[0]?.delta || 0), cost: p.cost, qty: 1, note: '',
        },
      ]
    })
  }

  function setQty(i, qty) {
    setCart((c) => (qty <= 0 ? c.filter((_, x) => x !== i) : c.map((it, x) => (x === i ? { ...it, qty } : it))))
  }

  function complete() {
    if (cart.length === 0) return
    if (method === 'tunai' && paid < total) return toast('Uang bayar kurang dari total.', 'err')
    const order = createOrder({
      channel: 'kasir',
      customerId: user?.id || null,
      customerName: 'Pelanggan Toko',
      customerPhone: '-',
      items: cart,
      discount,
      paymentMethod: method,
      delivery: { type: 'langsung' },
    })
    db.update('orders', order.id, {
      status: 'selesai',
      payment: { method, status: 'paid', paidAt: new Date().toISOString() },
    })
    applyOrderStock(db.get('orders', order.id))
    setLastOrder(db.get('orders', order.id))
    setCart([])
    setDiscount(0)
    setPaidInput('')
    toast('Transaksi selesai ✅')
  }

  return (
    <div className="pos-grid">
      {/* Katalog produk */}
      <div>
        <div className="card row-between mb-2" style={{ padding: 14 }}>
          <input className="input" style={{ maxWidth: 320 }} placeholder="🔍 Cari nama / SKU produk…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <span className="text-muted" style={{ fontSize: 13 }}>{list.length} produk</span>
        </div>
        <div className="row mb-2">
          <button className={`chip ${cat === 'all' ? 'active' : ''}`} onClick={() => setCat('all')}>Semua</button>
          {categories.map((c) => (
            <button key={c.id} className={`chip ${cat === c.id ? 'active' : ''}`} onClick={() => setCat(c.id)}>{c.emoji} {c.name}</button>
          ))}
        </div>
        <div className="grid-3">
          {list.map((p) => (
            <button key={p.id} className="pos-item" onClick={() => addProduct(p)} disabled={p.stock <= 0 && !p.preorder}>
              <Photo item={p} size="md" />
              <span className="meta">
                <b>{p.name}</b>
                <small>{rupiah(p.price)} · stok {p.stock}</small>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Panel transaksi */}
      <div className="pos-panel card">
        <h3 style={{ margin: 0 }}>🧾 Transaksi Kasir</h3>
        <div className="stack" style={{ maxHeight: 300, overflowY: 'auto', gap: 8 }}>
          {cart.length === 0 && <p className="text-muted" style={{ textAlign: 'center', margin: '18px 0' }}>Klik produk untuk menambah…</p>}
          {cart.map((it, i) => (
            <div key={i} className="row-between" style={{ borderBottom: '1px dashed var(--cream-2)', paddingBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 13.5 }}>{it.name}</b>
                <div className="text-muted" style={{ fontSize: 12 }}>{it.size} · {rupiah(it.price)}</div>
              </div>
              <div className="qty-stepper" style={{ transform: 'scale(.85)' }}>
                <button onClick={() => setQty(i, it.qty - 1)}>−</button>
                <span>{it.qty}</span>
                <button onClick={() => setQty(i, it.qty + 1)}>+</button>
              </div>
              <b style={{ fontSize: 13.5, minWidth: 76, textAlign: 'right' }}>{rupiah(it.price * it.qty)}</b>
            </div>
          ))}
        </div>

        <div className="row" style={{ gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label className="label">Diskon (Rp)</label>
            <input className="input" type="number" min="0" value={discount || ''} onChange={(e) => setDiscount(Number(e.target.value) || 0)} placeholder="0" />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">Metode</label>
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="tunai">Tunai</option>
              <option value="transfer">Transfer</option>
              <option value="qris">QRIS</option>
            </select>
          </div>
        </div>

        {method === 'tunai' && (
          <div>
            <label className="label">Uang Diterima</label>
            <input className="input" type="number" min="0" value={paidInput} onChange={(e) => setPaidInput(e.target.value)} placeholder="0" />
            {paid > 0 && (
              <div className={`mt-1 ${change >= 0 ? 'text-muted' : 'text-err'}`} style={{ fontWeight: 700 }}>
                Kembalian: {rupiah(Math.max(0, change))}{change < 0 ? ' — uang masih kurang!' : ''}
              </div>
            )}
          </div>
        )}

        <div className="summary" style={{ borderTop: '2px dashed var(--cream-3)', paddingTop: 12 }}>
          <div className="summary-row"><span>Subtotal</span><b>{rupiah(subtotal)}</b></div>
          {discount > 0 && <div className="summary-row"><span>Diskon</span><b>-{rupiah(discount)}</b></div>}
          {tax > 0 && <div className="summary-row"><span>Pajak {settings.taxPercent}%</span><b>{rupiah(tax)}</b></div>}
          <div className="summary-row total"><span>TOTAL</span><span>{rupiah(total)}</span></div>
        </div>

        <button className="btn btn-primary btn-lg w-full" onClick={complete} disabled={cart.length === 0}>
          Bayar & Cetak Struk 🖨️
        </button>
        {cart.length > 0 && (
          <button className="btn btn-ghost w-full" onClick={() => { setCart([]); setDiscount(0) }}>Batalkan transaksi</button>
        )}
      </div>

      <Modal open={!!lastOrder} onClose={() => setLastOrder(null)} title="Struk Pembelian">
        {lastOrder && (
          <>
            <Receipt order={lastOrder} settings={settings} />
            <div className="row mt-3">
              <button className="btn btn-primary w-full" onClick={() => window.print()}>🖨️ Cetak Struk</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
