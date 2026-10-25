import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { waLink, waTarget } from '../utils/wa'
import AuthModal from '../components/common/AuthModal'
import BottomNav from '../components/common/BottomNav'
import ScanPayModal from '../components/common/ScanPayModal'

export default function StoreLayout() {
  const settings = useSettings()
  const { user, isAdmin, logout } = useAuth()
  const cart = useCart()
  const [authOpen, setAuthOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  const [installEvt, setInstallEvt] = useState(null)
  const loc = useLocation()

  useEffect(() => {
    const h = (e) => {
      e.preventDefault()
      setInstallEvt(e)
    }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
    setUserMenu(false)
  }, [loc.pathname])

  const links = [
    { to: '/', label: 'Beranda' },
    { to: '/products', label: 'Katalog' },
    { to: '/about', label: 'Tentang Kami' },
  ]
  if (user) links.splice(2, 0, { to: '/my-orders', label: 'Pesanan Saya' })

  return (
    <div className="store-shell">
      <header className="navbar">
        <div className="container nav-inner">
          <button className="icon-btn nav-burger" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">☰</button>
          <Link to="/" className="brand">
            <img src={settings.logo || '/logo-nandin.png'} alt={settings.storeName} className="brand-logo" />
            <span className="brand-name">{settings.storeName}</span>
          </Link>

          <nav className={`nav-links ${menuOpen ? 'open' : ''}`}>
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                {l.label}
              </NavLink>
            ))}
          </nav>

          {/* Sisi kanan: keranjang + login/akun */}
          <div className="nav-right">
            <Link to="/cart" className="icon-btn cart-btn" aria-label="Keranjang">
              🛒
              {cart.count > 0 && <span className="cart-badge">{cart.count}</span>}
            </Link>
            {installEvt && (
              <button
                className="btn btn-ghost btn-sm hide-sm"
                onClick={async () => {
                  installEvt.prompt()
                  setInstallEvt(null)
                }}
              >
                📲 Install
              </button>
            )}
            {!user ? (
              <button className="btn btn-primary btn-sm" onClick={() => setAuthOpen(true)}>
                Masuk / Daftar
              </button>
            ) : (
              <div className="user-menu-wrap">
                <button className="user-chip" onClick={() => setUserMenu((v) => !v)}>
                  <span className="avatar">{user.name?.[0]?.toUpperCase()}</span>
                  <span className="hide-sm">{user.name.split(' ')[0]}</span>
                  <span className="caret">▾</span>
                </button>
                {userMenu && (
                  <div className="dropdown">
                    <div className="dropdown-head">
                      <b>{user.name}</b>
                      <small className="text-muted">{user.email}</small>
                    </div>
                    {user.role === 'customer' && (
                      <Link to="/my-orders" className="dropdown-item">📦 Pesanan Saya</Link>
                    )}
                    {isAdmin && (
                      <Link to="/admin" className="dropdown-item">📊 Dashboard Admin</Link>
                    )}
                    <button
                      className="dropdown-item"
                      onClick={() => {
                        logout()
                        location.href = '/'
                      }}
                    >
                      🚪 Keluar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container main">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="container footer-grid">
          <div>
            <div className="brand" style={{ padding: 0 }}>
              <img src={settings.logo || '/logo-nandin.png'} alt="" className="brand-logo" />
              <span className="brand-name">{settings.storeName}</span>
            </div>
            <p className="text-muted mt-2">{settings.tagline}. {settings.about?.slice(0, 110)}…</p>
          </div>
          <div>
            <h4>Menu</h4>
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="footer-link">{l.label}</Link>
            ))}
          </div>
          <div>
            <h4>Kontak</h4>
            <p className="footer-link">📍 {settings.address}</p>
            <p className="footer-link">📞 {settings.phone}</p>
            <p className="footer-link">✉️ {settings.email}</p>
            <p className="footer-link">🕒 {settings.openHours}</p>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="container footer-bottom-inner">
            <span>© {new Date().getFullYear()} <b>{settings.storeName}</b> — All rights reserved.</span>
            <span>
              Developed by{' '}
              <a href="https://ciptakaryadigital.id" target="_blank" rel="noopener noreferrer" className="dev-link">
                <b>Cipta Karya Digital Indonesia</b>
              </a>
            </span>
          </div>
        </div>
      </footer>

      <a
        className="wa-float"
        href={waLink(waTarget(settings), 'Halo Nandin Kitchen, saya ingin bertanya tentang produk kue 🍰')}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat WhatsApp"
      >
        💬
      </a>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      {/* Navigasi bawah 5 ikon (khusus mobile) — tombol tengah: scan pembayaran */}
      <BottomNav
        onOpenAuth={() => setAuthOpen(true)}
        onOpenScan={() => setScanOpen(true)}
      />
      <ScanPayModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onNeedLogin={() => {
          setScanOpen(false)
          setAuthOpen(true)
        }}
      />
    </div>
  )
}
