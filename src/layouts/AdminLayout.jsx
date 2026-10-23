import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'

const MENU = [
  { to: '/admin', label: 'Dashboard', icon: '📊', end: true },
  { to: '/admin/pos', label: 'POS Kasir', icon: '🧾' },
  { to: '/admin/products', label: 'Produk & Kategori', icon: '🍰' },
  { to: '/admin/orders', label: 'Transaksi & Pesanan', icon: '📦' },
  { to: '/admin/stock', label: 'Stok', icon: '🏷️' },
  { to: '/admin/purchases', label: 'Pembelian & Biaya', icon: '🚚' },
  { to: '/admin/reports', label: 'Laporan', icon: '📈' },
  { to: '/admin/settings', label: 'Pengaturan', icon: '⚙️' },
]

export default function AdminLayout() {
  const settings = useSettings()
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const loc = useLocation()
  const [sidebar, setSidebar] = useState(false)

  useEffect(() => setSidebar(false), [loc.pathname])

  if (!isAdmin) {
    return <NavigateHelper to="/admin/login" />
  }

  const current = MENU.find((m) => (m.end ? loc.pathname === m.to : loc.pathname.startsWith(m.to)))

  return (
    <div className="admin-shell">
      <aside className={`sidebar ${sidebar ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <img src={settings.logo || '/logo-nandin.png'} alt="" />
          <div>
            <b>{settings.storeName}</b>
            <small>Panel Admin</small>
          </div>
        </div>
        <nav className="sidebar-nav">
          {MENU.map((m) => (
            <NavLink key={m.to} to={m.to} end={m.end} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <span className="sidebar-icon">{m.icon}</span> {m.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <Link to="/" className="sidebar-link" target="_blank">🌐 Lihat Toko</Link>
          <button className="sidebar-link" onClick={() => { logout(); navigate('/admin/login') }}>🚪 Keluar</button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <button className="icon-btn" onClick={() => setSidebar((v) => !v)} aria-label="Menu">☰</button>
          <h2>{current?.icon} {current?.label || 'Admin'}</h2>
          <div className="admin-user">
            <span className="avatar">{user?.name?.[0]?.toUpperCase()}</span>
            <span className="hide-sm">{user?.name}</span>
            <span className="badge badge-caramel">{user?.role}</span>
          </div>
        </header>
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
      {sidebar && <div className="backdrop" onClick={() => setSidebar(false)} />}
    </div>
  )
}

function NavigateHelper({ to }) {
  const navigate = useNavigate()
  useEffect(() => {
    navigate(to, { replace: true })
  }, [to])
  return null
}
