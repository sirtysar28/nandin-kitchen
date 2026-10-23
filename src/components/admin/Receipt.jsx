import { rupiah, fmtDateTime } from '../../utils/format'

// Struk kasir 58mm — dicetak via window.print()
export default function Receipt({ order, settings }) {
  const items = order.items || []
  const cashier = order.createdAt ? new Date(order.createdAt) : new Date()
  return (
    <div className="receipt print-area">
      <div className="rc-center rc-bold">{settings.storeName}</div>
      <div className="rc-center">{settings.address}</div>
      <div className="rc-center">Telp: {settings.phone}</div>
      <hr />
      <div className="rc-row"><span>No</span><span>{order.number}</span></div>
      <div className="rc-row"><span>Tanggal</span><span>{fmtDateTime(order.createdAt)}</span></div>
      <div className="rc-row"><span>Kasir</span><span>Kasir Nandin</span></div>
      <hr />
      {items.map((it, i) => (
        <div key={i} style={{ marginBottom: 4 }}>
          <div>{it.name}</div>
          <div className="rc-row">
            <span>{it.qty} x {rupiah(it.price)}</span>
            <span>{rupiah(it.qty * it.price)}</span>
          </div>
        </div>
      ))}
      <hr />
      <div className="rc-row"><span>Subtotal</span><span>{rupiah(order.subtotal)}</span></div>
      {order.discount > 0 && <div className="rc-row"><span>Diskon</span><span>-{rupiah(order.discount)}</span></div>}
      {order.tax > 0 && <div className="rc-row"><span>Pajak {order.taxPercent}%</span><span>{rupiah(order.tax)}</span></div>}
      {order.shippingFee > 0 && <div className="rc-row"><span>Ongkir</span><span>{rupiah(order.shippingFee)}</span></div>}
      <div className="rc-row rc-bold"><span>TOTAL</span><span>{rupiah(order.total)}</span></div>
      <div className="rc-row"><span>Bayar ({order.payment?.method})</span><span>Lunas</span></div>
      <hr />
      <div className="rc-center">Terima kasih sudah berbelanja 🧡</div>
      <div className="rc-center">{settings.storeName} — {settings.tagline}</div>
      <div className="rc-center">Developed by Cipta Karya Digital Indonesia</div>
    </div>
  )
}
