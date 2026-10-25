// Navigasi bawah khusus mobile (5 ikon) — tombol tengah = scan pembayaran.
// Scan hanya untuk pelanggan yang sudah login (lihat ScanPayModal).
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'

export default function BottomNav({ onOpenAuth, onOpenScan }) {
  const { user } = useAuth()
  const cart = useCart()
  const navigate = useNavigate()

  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => `bottom-item ${isActive ? 'active' : ''}`}>
        <span className="bi-ico">🏠</span>Beranda
      </NavLink>
      <NavLink to="/products" className={({ isActive }) => `bottom-item ${isActive ? 'active' : ''}`}>
        <span className="bi-ico">🧁</span>Katalog
      </NavLink>
      <button className="bottom-item" onClick={onOpenScan} aria-label="Scan pembayaran">
        <span className="bottom-scan">📷</span>Bayar
      </button>
      <NavLink to="/cart" className={({ isActive }) => `bottom-item ${isActive ? 'active' : ''}`}>
        <span className="bi-ico" style={{ position: 'relative' }}>
          🛒
          {cart.count > 0 && (
            <span className="cart-badge" style={{ top: -7, right: -13 }}>{cart.count}</span>
          )}
        </span>
        Keranjang
      </NavLink>
      <button className="bottom-item" onClick={() => (user ? navigate('/my-orders') : onOpenAuth())}>
        <span className="bi-ico">👤</span>{user ? 'Pesanan' : 'Akun'}
      </button>
    </nav>
  )
}
