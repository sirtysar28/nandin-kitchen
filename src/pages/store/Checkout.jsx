import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../../context/CartContext'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { useData } from '../../context/DataContext'
import { useToast } from '../../components/common/Toast'
import { createOrder, markOrderPaid } from '../../services/db'
import { buildOrderMessage, waLink, waTarget } from '../../utils/wa'
import { rupiah, todayKey } from '../../utils/format'
import Modal from '../../components/common/Modal'
import Photo from '../../components/common/Photo'

export default function Checkout() {
  const cart = useCart()
  const { user } = useAuth()
  const settings = useSettings()
  const { db } = useData()
  const toast = useToast()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: user?.name || '', phone: user?.phone || '',
    deliveryType: 'pickup', date: todayKey(), time: '15:00',
    address: user ? '' : '', city: '', postal: '', note: '', payment: 'wa',
  })
  const [midtransOrder, setMidtransOrder] = useState(null)
  const [paying, setPaying] = useState(false)

  if (cart.items.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 48 }}>
        <h2>Tidak ada yang bisa di-checkout</h2>
        <Link to="/products" className="btn btn-primary">Pilih produk dulu 🍰</Link>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 48, maxWidth: 520, margin: '30px auto' }}>
        <div style={{ fontSize: 56 }}>🔐</div>
        <h2>Masuk untuk melanjutkan</h2>
        <p className="text-muted">Daftar/masuk dulu agar pesananmu tercatat dan bisa dilacak statusnya.</p>
        <Link to="/cart" className="btn btn-outline">← Kembali</Link>
      </div>
    )
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const isDelivery = form.deliveryType === 'delivery'
  const freeShip = cart.subtotal >= (settings.shipping.freeMin || Infinity)
  const shippingFee = isDelivery ? (freeShip ? 0 : Number(settings.shipping.fee) || 0) : 0
  const tax = Math.round((cart.subtotal * (settings.taxPercent || 0)) / 100)
  const total = cart.subtotal + shippingFee + tax

  function validate() {
    if (!form.name.trim() || !form.phone.trim()) return 'Nama dan nomor HP wajib diisi.'
    if (isDelivery && (!form.address.trim() || !form.city.trim())) return 'Alamat dan kota pengiriman wajib diisi.'
    if (!form.date) return 'Tanggal wajib diisi.'
    return null
  }

  function placeOrder() {
    const err = validate()
    if (err) return toast(err, 'err')

    const order = createOrder({
      channel: 'online',
      customerId: user.id,
      customerName: form.name,
      customerPhone: form.phone,
      customerEmail: user.email,
      items: cart.items,
      shippingFee,
      delivery: {
        type: form.deliveryType,
        address: isDelivery ? form.address : '',
        city: isDelivery ? form.city : '',
        postal: isDelivery ? form.postal : '',
        date: form.date,
        time: form.time,
      },
      paymentMethod: form.payment,
      note: form.note,
    })

    if (form.payment === 'wa') {
      // Opsi A: rangkuman pesanan dikirim ke admin via WhatsApp
      const fresh = db.get('orders', order.id)
      window.open(waLink(waTarget(settings), buildOrderMessage(fresh, settings)), '_blank')
      toast('Pesanan dibuat! Konfirmasi via WhatsApp dibuka 📲')
      cart.clear()
      navigate('/my-orders')
    } else {
      // Opsi B: Midtrans Snap (simulasi — produksi memakai token Snap + webhook backend)
      if (!settings.midtrans?.enabled) {
        toast('Pembayaran Midtrans sedang nonaktif. Hubungi admin.', 'err')
        return
      }
      setMidtransOrder(order.id)
    }
  }

  function simulatePay() {
    setPaying(true)
    setTimeout(() => {
      markOrderPaid(midtransOrder, 'midtrans')
      setPaying(false)
      setMidtransOrder(null)
      cart.clear()
      toast('Pembayaran berhasil! Pesananmu sedang diproses ✅')
      navigate('/my-orders')
    }, 1400)
  }

  return (
    <div>
      <h1>Checkout 🧾</h1>
      <div className="grid-2" style={{ alignItems: 'start', gridTemplateColumns: '1.4fr 1fr' }}>
        <div className="stack">
          <div className="card">
            <h3>📋 Data Pemesan</h3>
            <div className="grid-2">
              <div>
                <label className="label">Nama Lengkap</label>
                <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Nama pemesan" />
              </div>
              <div>
                <label className="label">Nomor HP / WhatsApp</label>
                <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="08xxxxxxxxxx" />
              </div>
            </div>
          </div>

          <div className="card">
            <h3>🚚 Metode Pengambilan</h3>
            <div className="opt-group mb-2">
              <button type="button" className={`opt ${!isDelivery ? 'active' : ''}`} onClick={() => set('deliveryType', 'pickup')}>🏪 Ambil di Toko</button>
              <button type="button" className={`opt ${isDelivery ? 'active' : ''}`} onClick={() => set('deliveryType', 'delivery')}>🛵 Di Antar (Kurir)</button>
            </div>
            {isDelivery ? (
              <div className="grid-2">
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="label">Alamat Lengkap</label>
                  <textarea className="input" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Jalan, nomor rumah, patokan…" />
                </div>
                <div>
                  <label className="label">Kota / Kecamatan</label>
                  <input className="input" value={form.city} onChange={(e) => set('city', e.target.value)} />
                </div>
                <div>
                  <label className="label">Kode Pos</label>
                  <input className="input" value={form.postal} onChange={(e) => set('postal', e.target.value)} />
                </div>
              </div>
            ) : (
              <p className="text-muted" style={{ margin: 0 }}>📍 {settings.address} — {settings.openHours}</p>
            )}
            <div className="grid-2 mt-2">
              <div>
                <label className="label">{isDelivery ? 'Tanggal Pengiriman' : 'Tanggal Pengambilan'}</label>
                <input className="input" type="date" min={todayKey()} value={form.date} onChange={(e) => set('date', e.target.value)} />
              </div>
              <div>
                <label className="label">Jam</label>
                <input className="input" type="time" value={form.time} onChange={(e) => set('time', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card">
            <h3>💳 Metode Pembayaran</h3>
            <div className="stack">
              <button type="button" className={`pos-item ${form.payment === 'wa' ? 'active' : ''}`} style={form.payment === 'wa' ? { borderColor: 'var(--caramel)', background: 'var(--caramel-100)' } : {}} onClick={() => set('payment', 'wa')}>
                <span style={{ fontSize: 26 }}>💬</span>
                <span className="meta"><b>WhatsApp</b><small>Pesanan dirangkum & dikirim ke admin untuk konfirmasi pembayaran</small></span>
              </button>
              <button type="button" className="pos-item" style={form.payment === 'midtrans' ? { borderColor: 'var(--caramel)', background: 'var(--caramel-100)' } : {}} onClick={() => set('payment', 'midtrans')} disabled={!settings.midtrans?.enabled}>
                <span style={{ fontSize: 26 }}>💳</span>
                <span className="meta"><b>Midtrans {settings.midtrans?.env === 'sandbox' ? '(Sandbox)' : ''}</b><small>Bayar online: VA bank, QRIS, e-wallet, kartu kredit</small></span>
              </button>
            </div>
            <div className="mt-2">
              <label className="label">Catatan untuk toko (opsional)</label>
              <textarea className="input" value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="Contoh: request tulisan di cake, tingkat kemanisan, dsb." />
            </div>
          </div>
        </div>

        <div className="card summary" style={{ position: 'sticky', top: 90 }}>
          <h3>Rincian Pesanan</h3>
          <div className="stack" style={{ gap: 10, maxHeight: 260, overflowY: 'auto' }}>
            {cart.items.map((it, i) => (
              <div key={i} className="row" style={{ gap: 10 }}>
                <Photo item={it} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 13.5, display: 'block' }}>{it.name}</b>
                  <small className="text-muted">{[it.size, it.variant].filter(Boolean).join(' · ')} × {it.qty}</small>
                </div>
                <b style={{ fontSize: 13.5 }}>{rupiah(it.price * it.qty)}</b>
              </div>
            ))}
          </div>
          <div className="summary-row mt-2"><span>Subtotal</span><b>{rupiah(cart.subtotal)}</b></div>
          <div className="summary-row"><span>Ongkir {freeShip && isDelivery && '(Gratis 🎉)'}</span><b>{rupiah(shippingFee)}</b></div>
          {tax > 0 && <div className="summary-row"><span>Pajak {settings.taxPercent}%</span><b>{rupiah(tax)}</b></div>}
          <div className="summary-row total"><span>Total Bayar</span><span>{rupiah(total)}</span></div>
          <button className="btn btn-primary btn-lg w-full" onClick={placeOrder}>
            {form.payment === 'wa' ? 'Pesan via WhatsApp 📲' : 'Bayar dengan Midtrans 💳'}
          </button>
          <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
            Dengan melanjutkan, kamu menyetujui kebijakan pemesanan Nandin Kitchen. Pesanan pre-order minimal H-2.
          </p>
        </div>
      </div>

      {/* Simulasi Midtrans Snap */}
      <Modal open={!!midtransOrder} onClose={() => setMidtransOrder(null)} title="Midtrans Snap — Pilih Metode Pembayaran">
        <div className="alert alert-info mb-3">
          Mode sandbox: integrasi nyata memakai token Snap dari backend & konfirmasi via webhook.
        </div>
        <div className="stack">
          {['QRIS — GoPay/OVO/Dana', 'Virtual Account BCA', 'Virtual Account Mandiri', 'Kartu Kredit/Debit'].map((m) => (
            <div key={m} className="pos-item"><span className="meta"><b>{m}</b></span></div>
          ))}
        </div>
        <button className="btn btn-primary w-full mt-3" onClick={simulatePay} disabled={paying}>
          {paying ? 'Memproses pembayaran…' : `Bayar ${rupiah(total)}`}
        </button>
      </Modal>
    </div>
  )
}
