import { useMemo, useRef, useState } from 'react'
import { useData } from '../../context/DataContext'
import { useToast } from '../../components/common/Toast'
import { db } from '../../services/db'
import { rupiah } from '../../utils/format'
import Modal from '../../components/common/Modal'
import Photo from '../../components/common/Photo'

const EMPTY = {
  name: '', categoryId: '', sku: '', emoji: '🧁', photo: '', gallery: [], desc: '',
  cost: 0, price: 0, stock: 0, active: true, preorder: false, featured: false,
  sizes: [{ name: 'Standar', delta: 0 }], variants: [{ name: 'Original', delta: 0 }],
}

export default function ProductsAdmin() {
  const store = useData()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null) // product object | EMPTY | null
  const [catModal, setCatModal] = useState(false)
  const [newCat, setNewCat] = useState({ name: '', emoji: '🍰' })
  const fileRef = useRef()

  const products = store.db.list('products')
  const categories = store.db.list('categories')
  const catOf = (id) => categories.find((c) => c.id === id)

  const list = useMemo(() => {
    if (!q.trim()) return products
    const s = q.toLowerCase()
    return products.filter((p) => p.name.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s))
  }, [q, products])

  function save(e) {
    e.preventDefault()
    if (!editing.name.trim()) return toast('Nama produk wajib diisi.', 'err')
    if (!editing.categoryId) return toast('Pilih kategori produk.', 'err')
    if (Number(editing.price) <= 0) return toast('Harga jual harus lebih dari 0.', 'err')
    const payload = {
      ...editing,
      cost: Number(editing.cost) || 0,
      price: Number(editing.price) || 0,
      stock: Number(editing.stock) || 0,
      sizes: (editing.sizes || []).filter((s) => s.name?.trim()),
      variants: (editing.variants || []).filter((v) => v.name?.trim()),
    }
    if (editing.id) {
      store.db.update('products', editing.id, payload)
      toast('Produk diperbarui ✅')
    } else {
      store.db.insert('products', payload)
      toast('Produk ditambahkan ✅')
    }
    setEditing(null)
  }

  function remove(p) {
    if (!confirm(`Hapus produk "${p.name}"?`)) return
    store.db.remove('products', p.id)
    toast('Produk dihapus')
  }

  function uploadPhoto(file) {
    const reader = new FileReader()
    reader.onload = () => setEditing((ed) => ({ ...ed, photo: reader.result }))
    reader.readAsDataURL(file)
  }

  const setEd = (k, v) => setEditing((ed) => ({ ...ed, [k]: v }))
  const setOpt = (key, i, k, v) =>
    setEditing((ed) => ({ ...ed, [key]: ed[key].map((o, x) => (x === i ? { ...o, [k]: v } : o)) }))

  return (
    <div className="stack">
      <div className="card row-between" style={{ padding: 14 }}>
        <input className="input" style={{ maxWidth: 320 }} placeholder="🔍 Cari produk…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="row">
          <button className="btn btn-outline" onClick={() => setCatModal(true)}>🗂️ Kelola Kategori</button>
          <button className="btn btn-primary" onClick={() => setEditing({ ...EMPTY, categoryId: categories[0]?.id })}>+ Tambah Produk</button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Produk</th><th>SKU</th><th>Kategori</th><th>Modal</th><th>Harga Jual</th><th>Stok</th><th>Status</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="row" style={{ gap: 10 }}>
                    <Photo item={p} size="sm" />
                    <div>
                      <b>{p.name}</b>
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        {p.featured ? '⭐ Terlaris · ' : ''}{p.preorder ? 'Pre-Order' : 'Ready'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="text-muted">{p.sku}</td>
                <td>{catOf(p.categoryId)?.emoji} {catOf(p.categoryId)?.name}</td>
                <td>{rupiah(p.cost)}</td>
                <td><b>{rupiah(p.price)}</b></td>
                <td>
                  <span className={`badge ${p.stock <= 5 ? 'badge-warn' : 'badge-ok'}`}>{p.stock}</span>
                </td>
                <td>{p.active ? <span className="badge badge-ok">Tersedia</span> : <span className="badge badge-err">Nonaktif</span>}</td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => setEditing(structuredClone(p))}>✏️ Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--err)' }} onClick={() => remove(p)}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal produk */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Produk' : 'Tambah Produk'} wide>
        {editing && (
          <form onSubmit={save} className="stack">
            <div className="grid-2">
              <div>
                <label className="label">Nama Produk</label>
                <input className="input" value={editing.name} onChange={(e) => setEd('name', e.target.value)} required />
              </div>
              <div>
                <label className="label">SKU</label>
                <input className="input" value={editing.sku} onChange={(e) => setEd('sku', e.target.value)} placeholder="NK-XXX-001" />
              </div>
              <div>
                <label className="label">Kategori</label>
                <select className="input" value={editing.categoryId} onChange={(e) => setEd('categoryId', e.target.value)}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Emoji (jika tanpa foto)</label>
                <input className="input" value={editing.emoji} onChange={(e) => setEd('emoji', e.target.value)} placeholder="🎂" />
              </div>
              <div>
                <label className="label">Harga Modal (Rp)</label>
                <input className="input" type="number" min="0" value={editing.cost} onChange={(e) => setEd('cost', e.target.value)} />
              </div>
              <div>
                <label className="label">Harga Jual (Rp)</label>
                <input className="input" type="number" min="0" value={editing.price} onChange={(e) => setEd('price', e.target.value)} required />
              </div>
              <div>
                <label className="label">Stok</label>
                <input className="input" type="number" min="0" value={editing.stock} onChange={(e) => setEd('stock', e.target.value)} />
              </div>
              <div className="row" style={{ alignItems: 'end', gap: 16 }}>
                {[
                  ['active', 'Tersedia'], ['preorder', 'Pre-Order'], ['featured', '⭐ Terlaris'],
                ].map(([k, l]) => (
                  <label key={k} className="row" style={{ gap: 6, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!editing[k]} onChange={(e) => setEd(k, e.target.checked)} />
                    {l}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Deskripsi</label>
              <textarea className="input" value={editing.desc} onChange={(e) => setEd('desc', e.target.value)} />
            </div>

            <div>
              <label className="label">Foto Produk</label>
              <div className="upload-box">
                <Photo item={editing} size="md" />
                <div className="row" style={{ justifyContent: 'center' }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>📤 Upload Foto</button>
                  {editing.photo && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEd('photo', '')}>Hapus foto</button>}
                </div>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && uploadPhoto(e.target.files[0])} />
                <input className="input" style={{ maxWidth: 380 }} placeholder="atau tempel URL foto…" value={editing.photo?.startsWith('data:') ? '' : editing.photo || ''} onChange={(e) => setEd('photo', e.target.value)} />
              </div>
            </div>

            <div className="grid-2">
              {['sizes', 'variants'].map((key) => (
                <div key={key}>
                  <div className="row-between">
                    <label className="label">{key === 'sizes' ? 'Ukuran' : 'Varian'} (nama + tambahan harga)</label>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEd(key, [...editing[key], { name: '', delta: 0 }])}>+ Tambah</button>
                  </div>
                  <div className="stack" style={{ gap: 8 }}>
                    {editing[key].map((o, i) => (
                      <div key={i} className="row" style={{ gap: 6 }}>
                        <input className="input" placeholder="Nama" value={o.name} onChange={(e) => setOpt(key, i, 'name', e.target.value)} />
                        <input className="input" style={{ maxWidth: 110 }} type="number" placeholder="+Rp" value={o.delta} onChange={(e) => setOpt(key, i, 'delta', Number(e.target.value) || 0)} />
                        <button type="button" className="icon-btn" onClick={() => setEd(key, editing[key].filter((_, x) => x !== i))}>🗑️</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="row" style={{ justifyContent: 'end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Batal</button>
              <button className="btn btn-primary">💾 Simpan Produk</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal kategori */}
      <Modal open={catModal} onClose={() => setCatModal(false)} title="Kelola Kategori">
        <div className="stack">
          {categories.map((c) => (
            <div key={c.id} className="row-between" style={{ borderBottom: '1px solid var(--cream-2)', paddingBottom: 8 }}>
              <span><b>{c.emoji} {c.name}</b> <small className="text-muted">({products.filter((p) => p.categoryId === c.id).length} produk)</small></span>
              <button
                className="btn btn-ghost btn-sm" style={{ color: 'var(--err)' }}
                onClick={() => {
                  if (products.some((p) => p.categoryId === c.id)) return toast('Kategori masih dipakai produk.', 'err')
                  db.remove('categories', c.id)
                  toast('Kategori dihapus')
                }}
              >🗑️</button>
            </div>
          ))}
          <div className="row" style={{ gap: 8 }}>
            <input className="input" style={{ maxWidth: 70 }} value={newCat.emoji} onChange={(e) => setNewCat((c) => ({ ...c, emoji: e.target.value }))} />
            <input className="input" placeholder="Nama kategori baru" value={newCat.name} onChange={(e) => setNewCat((c) => ({ ...c, name: e.target.value }))} />
            <button
              className="btn btn-primary"
              onClick={() => {
                if (!newCat.name.trim()) return
                db.insert('categories', { name: newCat.name, emoji: newCat.emoji || '🍰', slug: newCat.name.toLowerCase().replace(/\s+/g, '-') })
                setNewCat({ name: '', emoji: '🍰' })
                toast('Kategori ditambahkan')
              }}
            >+ Tambah</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
