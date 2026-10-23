import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../../context/CartContext'
import Photo from '../../components/common/Photo'
import { rupiah } from '../../utils/format'

export default function Cart() {
  const cart = useCart()
  const navigate = useNavigate()

  if (cart.items.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 56 }}>
        <div style={{ fontSize: 60 }}>🛒</div>
        <h2>Keranjangmu masih kosong</h2>
        <p className="text-muted">Yuk pilih kue favoritmu dulu, ada cake, brownies, cookies, sampai hampers!</p>
        <Link to="/products" className="btn btn-primary btn-lg">Jelajahi Katalog 🍰</Link>
      </div>
    )
  }

  return (
    <div>
      <h1>Keranjang Belanja 🛒</h1>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="stack">
          {cart.items.map((it, i) => (
            <div key={i} className="card row" style={{ justifyContent: 'space-between' }}>
              <Photo item={it} size="md" />
              <div style={{ flex: 1, minWidth: 180 }}>
                <b>{it.name}</b>
                <div className="text-muted" style={{ fontSize: 13 }}>
                  {[it.size, it.variant].filter(Boolean).join(' · ') || 'Standar'} · {rupiah(it.price)}
                </div>
                {it.note && <div className="text-muted" style={{ fontSize: 12 }}>📝 {it.note}</div>}
                <button className="btn btn-ghost btn-sm mt-1" style={{ color: 'var(--err)', padding: '2px 8px' }} onClick={() => cart.remove(i)}>
                  🗑 Hapus
                </button>
              </div>
              <div className="row">
                <div className="qty-stepper">
                  <button onClick={() => cart.setQty(i, it.qty - 1)}>−</button>
                  <span>{it.qty}</span>
                  <button onClick={() => cart.setQty(i, it.qty + 1)}>+</button>
                </div>
                <b style={{ minWidth: 92, textAlign: 'right' }}>{rupiah(it.price * it.qty)}</b>
              </div>
            </div>
          ))}
        </div>

        <div className="card summary" style={{ position: 'sticky', top: 90 }}>
          <h3>Ringkasan</h3>
          <div className="summary-row"><span>Subtotal ({cart.count} item)</span><b>{rupiah(cart.subtotal)}</b></div>
          <div className="summary-row text-muted"><span>Ongkir & pajak</span><span>dihitung saat checkout</span></div>
          <div className="summary-row total"><span>Total Sementara</span><span>{rupiah(cart.subtotal)}</span></div>
          <button className="btn btn-primary btn-lg w-full" onClick={() => navigate('/checkout')}>
            Lanjut ke Checkout →
          </button>
          <Link to="/products" className="btn btn-ghost w-full">+ Tambah produk lain</Link>
        </div>
      </div>
    </div>
  )
}
