// Ikon lonceng notifikasi di header — HANYA tampil setelah login.
// Notifikasi diturunkan dari pesanan user: pesanan diterima, pembayaran
// terverifikasi, dan perubahan status pesanan terakhir.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { fmtDateTime, STATUS_LABEL } from '../../utils/format'

const STATUS_EMOJI = {
  menunggu: '⏳',
  diproses: '👩‍🍳',
  siap: '🧁',
  dikirim: '🛵',
  selesai: '🎉',
  dibatalkan: '❌',
}

export default function NotificationBell() {
  const { user } = useAuth()
  const { db } = useData()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [seenAt, setSeenAt] = useState(null)
  const wrapRef = useRef(null)

  const seenKey = `nandin_notif_seen_${user?.id}`

  useEffect(() => {
    if (user?.id) setSeenAt(localStorage.getItem(seenKey) || null)
  }, [seenKey, user?.id])

  // Tutup dropdown saat tap di luar
  useEffect(() => {
    if (!open) return
    const h = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', h)
    return () => document.removeEventListener('pointerdown', h)
  }, [open])

  if (!user) return null

  const orders = db
    .list('orders')
    .filter((o) => o.customerId === user.id || o.customerEmail === user.email)

  const notifs = []
  orders.forEach((o) => {
    notifs.push({ t: o.createdAt, emoji: '🧁', text: `Pesanan ${o.number} diterima — mohon tunggu konfirmasi` })
    if (o.payment?.status === 'paid') {
      notifs.push({
        t: o.payment.paidAt || o.createdAt,
        emoji: '✅',
        text: `Pembayaran pesanan ${o.number} terverifikasi`,
      })
    }
    if (o.status && o.status !== 'menunggu') {
      notifs.push({
        t: o.createdAt,
        emoji: STATUS_EMOJI[o.status] || '📦',
        text: `Pesanan ${o.number}: ${STATUS_LABEL[o.status] || o.status}`,
      })
    }
  })
  notifs.sort((a, b) => new Date(b.t) - new Date(a.t))
  const latest = notifs.slice(0, 10)
  const unread = seenAt
    ? latest.filter((n) => n.t && new Date(n.t) > new Date(seenAt)).length
    : latest.length

  function toggle() {
    setOpen((v) => {
      if (!v) {
        const now = new Date().toISOString()
        localStorage.setItem(seenKey, now)
        setSeenAt(now)
      }
      return !v
    })
  }

  function openNotif() {
    setOpen(false)
    navigate('/my-orders')
  }

  return (
    <div className="user-menu-wrap notif-wrap" ref={wrapRef}>
      <button className="icon-btn" onClick={toggle} aria-label="Notifikasi" aria-expanded={open}>
        🔔
        {unread > 0 && <span className="cart-badge notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="dropdown notif-dropdown">
          <div className="dropdown-head">
            <b>Notifikasi 🔔</b>
            <small className="text-muted">{latest.length ? `${latest.length} notifikasi terbaru` : 'Belum ada notifikasi'}</small>
          </div>
          {latest.length === 0 ? (
            <div className="notif-empty">
              <div style={{ fontSize: 30 }}>🔕</div>
              <p className="text-muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
                Belum ada notifikasi. Pesanan pertamamu akan muncul di sini.
              </p>
            </div>
          ) : (
            <div className="notif-list">
              {latest.map((n, i) => (
                <button key={i} className="notif-item" onClick={openNotif}>
                  <span className="notif-emoji">{n.emoji}</span>
                  <span>
                    <span className="notif-text">{n.text}</span>
                    <span className="notif-time">{n.t ? fmtDateTime(n.t) : ''}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
