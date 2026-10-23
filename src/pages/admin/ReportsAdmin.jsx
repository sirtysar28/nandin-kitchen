import { useMemo, useState } from 'react'
import { useData } from '../../context/DataContext'
import BarChart from '../../components/common/Chart'
import { rupiah, dateKey, todayKey, downloadCSV, PAY_LABEL, STATUS_LABEL } from '../../utils/format'

const PRESETS = { hari: 'Hari Ini', minggu: '7 Hari', bulan: '30 Hari' }

function rangeOf(preset, start, end) {
  if (preset === 'custom') return { start, end }
  const now = todayKey()
  const d = new Date()
  if (preset === 'hari') return { start: now, end: now }
  if (preset === 'minggu') { d.setDate(d.getDate() - 6); return { start: dateKey(d.toISOString()), end: now } }
  d.setDate(d.getDate() - 29)
  return { start: dateKey(d.toISOString()), end: now }
}

export default function ReportsAdmin() {
  const { db } = useData()
  const [preset, setPreset] = useState('minggu')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const { start, end } = rangeOf(preset, customStart, customEnd)
  const orders = db.list('orders')
  const purchases = db.list('purchases')
  const expenses = db.list('expenses')

  const rep = useMemo(() => {
    const inR = (dateStr) => dateStr >= start && dateStr <= end
    const valid = orders.filter((o) => o.status !== 'dibatalkan' && inR(dateKey(o.createdAt)))
    const omzet = valid.reduce((s, o) => s + o.total, 0)
    const diskon = valid.reduce((s, o) => s + (o.discount || 0), 0)
    const hpp = valid.reduce((s, o) => s + o.items.reduce((x, it) => x + (it.cost || 0) * it.qty, 0), 0)
    const labaKotor = omzet - hpp
    const byMethod = {}
    valid.forEach((o) => { byMethod[o.payment.method] = (byMethod[o.payment.method] || 0) + o.total })

    const sold = {}
    valid.forEach((o) =>
      o.items.forEach((it) => {
        sold[it.productId] = sold[it.productId] || { name: it.name, emoji: it.emoji, qty: 0, omzet: 0 }
        sold[it.productId].qty += it.qty
        sold[it.productId].omzet += it.price * it.qty
      })
    )
    const top = Object.values(sold).sort((a, b) => b.qty - a.qty)

    const beli = purchases.filter((p) => inR(p.date)).reduce((s, p) => s + p.total, 0)
    const biaya = expenses.filter((e) => inR(e.date)).reduce((s, e) => s + e.amount, 0)

    // grafik harian dalam rentang (maks 30 titik)
    const grafik = []
    const days = Math.min(30, Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000) + 1))
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end)
      d.setDate(d.getDate() - i)
      const key = dateKey(d.toISOString())
      grafik.push({
        label: d.getDate() + '/' + (d.getMonth() + 1),
        value: valid.filter((o) => dateKey(o.createdAt) === key).reduce((s, o) => s + o.total, 0),
      })
    }

    return { valid, omzet, diskon, hpp, labaKotor, byMethod, top, beli, biaya, labaBersih: labaKotor - biaya, grafik }
  }, [orders.length, purchases.length, expenses.length, start, end])

  function exportCSV() {
    downloadCSV(
      `laporan-nandin-${start}_sd_${end}.csv`,
      rep.valid.map((o) => ({
        'No Pesanan': o.number,
        Tanggal: dateKey(o.createdAt),
        Kanal: o.channel,
        Pelanggan: o.customerName,
        Item: o.items.map((i) => `${i.name} x${i.qty}`).join('; '),
        Subtotal: o.subtotal,
        Diskon: o.discount,
        Pajak: o.tax,
        Ongkir: o.shippingFee,
        Total: o.total,
        Metode: o.payment.method,
        Status: STATUS_LABEL[o.status],
      }))
    )
  }

  return (
    <div className="stack">
      <div className="card row-between" style={{ padding: 14 }}>
        <div className="row">
          {Object.entries(PRESETS).map(([k, v]) => (
            <button key={k} className={`chip ${preset === k ? 'active' : ''}`} onClick={() => setPreset(k)}>{v}</button>
          ))}
          <button className={`chip ${preset === 'custom' ? 'active' : ''}`} onClick={() => setPreset('custom')}>Kustom</button>
          {preset === 'custom' && (
            <>
              <input className="input" style={{ maxWidth: 150 }} type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              <input className="input" style={{ maxWidth: 150 }} type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </>
          )}
        </div>
        <button className="btn btn-outline" onClick={exportCSV}>⬇️ Ekspor CSV</button>
      </div>

      <p className="text-muted" style={{ margin: 0, fontSize: 13.5 }}>
        Periode: <b>{start || '…'}</b> s.d. <b>{end || '…'}</b> · {rep.valid.length} transaksi valid (pesanan dibatalkan tidak dihitung)
      </p>

      <div className="stat-grid">
        <div className="card stat"><div className="stat-ico ico-caramel">💰</div><div><b>{rupiah(rep.omzet)}</b><span>Omzet penjualan</span></div></div>
        <div className="card stat"><div className="stat-ico ico-info">🧾</div><div><b>{rep.valid.length}</b><span>Jumlah transaksi</span></div></div>
        <div className="card stat"><div className="stat-ico ico-warn">🏷️</div><div><b>{rupiah(rep.diskon)}</b><span>Total diskon</span></div></div>
        <div className="card stat"><div className="stat-ico ico-ok">📈</div><div><b>{rupiah(rep.labaKotor)}</b><span>Estimasi laba kotor (omzet − HPP)</span></div></div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h3>📊 Grafik Omzet Harian</h3>
          <BarChart data={rep.grafik} />
        </div>
        <div className="stack">
          <div className="card">
            <h3>💳 Metode Pembayaran</h3>
            {Object.entries(rep.byMethod).map(([m, v]) => (
              <div key={m} className="row-between" style={{ padding: '5px 0', fontSize: 14 }}>
                <span>{PAY_LABEL[m] || m}</span><b>{rupiah(v)}</b>
              </div>
            ))}
          </div>
          <div className="card">
            <h3>💸 Pembelian & Pengeluaran</h3>
            <div className="row-between" style={{ fontSize: 14 }}><span>Pembelian bahan/supplier</span><b>{rupiah(rep.beli)}</b></div>
            <div className="row-between" style={{ fontSize: 14 }}><span>Pengeluaran operasional</span><b>{rupiah(rep.biaya)}</b></div>
            <div className="summary-row total"><span>Estimasi laba bersih*</span><span style={{ color: rep.labaBersih >= 0 ? 'var(--ok)' : 'var(--err)' }}>{rupiah(rep.labaBersih)}</span></div>
            <p className="text-muted" style={{ fontSize: 12, margin: '4px 0 0' }}>*Laba kotor − pengeluaran operasional (belum termasuk pembelian stok & pajak).</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>⭐ Produk Terlaris</h3>
        <div className="table-wrap" style={{ border: 0 }}>
          <table className="table">
            <thead><tr><th>#</th><th>Produk</th><th>Terjual</th><th>Omzet</th></tr></thead>
            <tbody>
              {rep.top.map((t, i) => (
                <tr key={i}><td>{i + 1}</td><td>{t.emoji} {t.name}</td><td><b>{t.qty} pcs</b></td><td>{rupiah(t.omzet)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
