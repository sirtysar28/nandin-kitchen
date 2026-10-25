import { useMemo, useState } from 'react'
import { useData } from '../../context/DataContext'
import { useToast } from '../../components/common/Toast'
import Modal from '../../components/common/Modal'
import { rupiah, fmtDateTime } from '../../utils/format'

// Manajemen pelanggan: daftar, cari, tambah, edit, hapus + ringkasan belanja.
export default function CustomersAdmin() {
  const store = useData()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '' })

  const customers = store.db.list('customers')
  const orders = store.db.list('orders')

  const rows = useMemo(() => {
    const list = customers.map((c) => {
      const mine = orders.filter(
        (o) =>
          o.customerId === c.userId ||
          (c.email && String(o.customerEmail || '').toLowerCase() === c.email.toLowerCase())
      )
      const valid = mine.filter((o) => o.status !== 'dibatalkan')
      return {
        ...c,
        count: valid.length,
        spent: valid.reduce((s, o) => s + o.total, 0),
        last: mine[0]?.createdAt || '',
      }
    })
    return list.sort((a, b) => String(b.last).localeCompare(String(a.last)))
  }, [customers, orders])

  const filtered = rows.filter((c) =>
    [c.name, c.email, c.phone].join(' ').toLowerCase().includes(q.trim().toLowerCase())
  )
  const now = new Date()
  const newThisMonth = rows.filter((c) => {
    if (!c.createdAt) return false
    const d = new Date(c.createdAt)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length
  const active = rows.filter((c) => c.count > 0).length

  function openAdd() {
    setEditing(null)
    setForm({ name: '', email: '', phone: '' })
    setModal(true)
  }
  function openEdit(c) {
    setEditing(c)
    setForm({ name: c.name || '', email: c.email || '', phone: c.phone || '' })
    setModal(true)
  }
  function save() {
    if (!form.name.trim() || !form.email.trim()) return toast('Nama dan email wajib diisi.', 'err')
    const email = form.email.trim().toLowerCase()
    if (customers.some((c) => c.id !== editing?.id && String(c.email).toLowerCase() === email))
      return toast('Email sudah terdaftar.', 'err')
    if (editing) store.db.update('customers', editing.id, { ...form, email })
    else store.db.insert('customers', { ...form, email })
    toast(editing ? 'Pelanggan diperbarui ✅' : 'Pelanggan ditambahkan ✅')
    setModal(false)
  }
  function remove(c) {
    if (!confirm(`Hapus pelanggan "${c.name}"? (Akun login & riwayat pesanan tetap tersimpan)`)) return
    store.db.remove('customers', c.id)
    toast('Pelanggan dihapus')
  }

  return (
    <div className="stack">
      <div className="stat-grid">
        <div className="card stat">
          <div className="stat-ico ico-caramel">👥</div>
          <div><b>{rows.length}</b><span>Total pelanggan</span></div>
        </div>
        <div className="card stat">
          <div className="stat-ico ico-ok">🛍️</div>
          <div><b>{active}</b><span>Pernah berbelanja</span></div>
        </div>
        <div className="card stat">
          <div className="stat-ico ico-info">🆕</div>
          <div><b>{newThisMonth}</b><span>Baru bulan ini</span></div>
        </div>
      </div>

      <div className="card">
        <div className="row-between mb-2" style={{ flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0 }}>👥 Data Pelanggan</h3>
          <div className="row" style={{ gap: 8 }}>
            <input
              className="input"
              style={{ maxWidth: 260 }}
              placeholder="Cari nama / email / HP…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="btn btn-primary" onClick={openAdd}>＋ Tambah</button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-muted" style={{ textAlign: 'center', padding: 24 }}>
            Belum ada pelanggan{q ? ' yang cocok dengan pencarian' : ''}.
          </p>
        ) : (
          <div className="table-wrap" style={{ border: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Nama</th><th>Kontak</th><th>Pesanan</th><th>Total Belanja</th>
                  <th>Terakhir Order</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td><b>{c.name}</b>{c.createdAt && <div className="text-muted" style={{ fontSize: 11.5 }}>daftar {fmtDateTime(c.createdAt)}</div>}</td>
                    <td>{c.email}<div className="text-muted" style={{ fontSize: 12 }}>{c.phone || '-'}</div></td>
                    <td>{c.count > 0 ? <span className="badge badge-ok">{c.count}×</span> : <span className="text-muted">belum</span>}</td>
                    <td><b>{c.spent > 0 ? rupiah(c.spent) : '-'}</b></td>
                    <td className="text-muted" style={{ fontSize: 12.5 }}>{c.last ? fmtDateTime(c.last) : '-'}</td>
                    <td>
                      <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>✏️</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--err)' }} onClick={() => remove(c)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? '✏️ Edit Pelanggan' : '＋ Tambah Pelanggan'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModal(false)}>Batal</button>
            <button className="btn btn-primary" onClick={save}>Simpan</button>
          </>
        }
      >
        <div className="stack">
          <div>
            <label className="label">Nama</label>
            <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nama pelanggan" />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@contoh.com" />
          </div>
          <div>
            <label className="label">No. HP</label>
            <input className="input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="08xx…" />
          </div>
        </div>
      </Modal>
    </div>
  )
}
