import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useData } from '../../context/DataContext'
import { useSettings } from '../../context/SettingsContext'
import ProductCard from '../../components/products/ProductCard'
import BannerSlider from '../../components/common/BannerSlider'

export default function Products() {
  const { db } = useData()
  const settings = useSettings()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const cat = params.get('cat') || 'all'
  const [sort, setSort] = useState('baru')

  const categories = db.list('categories')
  const catOf = (id) => categories.find((c) => c.id === id)

  const products = useMemo(() => {
    let list = db.list('products').filter((p) => p.active)
    if (cat !== 'all') list = list.filter((p) => catOf(p.categoryId)?.slug === cat)
    if (q.trim()) {
      const s = q.toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(s) || p.desc.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s))
    }
    if (sort === 'murah') list = [...list].sort((a, b) => a.price - b.price)
    if (sort === 'mahal') list = [...list].sort((a, b) => b.price - a.price)
    if (sort === 'nama') list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    return list
  }, [cat, q, sort, db.list('products').length])

  return (
    <div>
      <div className="section-head">
        <div>
          <h1>Katalog Kue 🧁</h1>
          <p className="text-muted" style={{ margin: 0 }}>{products.length} produk tersedia</p>
        </div>
      </div>

      {/* Promosi — banner slider (sama seperti di Beranda) */}
      <div className="mb-3">
        <BannerSlider banners={settings.banners} />
      </div>

      <div className="card mb-3 row-between">
        <input
          className="input"
          style={{ maxWidth: 340 }}
          placeholder="🔍 Cari kue… (nama / SKU)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input" style={{ maxWidth: 190 }} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="baru">Terbaru</option>
          <option value="murah">Harga Termurah</option>
          <option value="mahal">Harga Tertinggi</option>
          <option value="nama">Nama A-Z</option>
        </select>
      </div>

      <div className="row mb-3">
        <button className={`chip chip-lg ${cat === 'all' ? 'active' : ''}`} onClick={() => setParams({})}>Semua</button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={`chip chip-lg ${cat === c.slug ? 'active' : ''}`}
            onClick={() => setParams(c.slug === cat ? {} : { cat: c.slug })}
          >
            {c.emoji} {c.name}
          </button>
        ))}
      </div>

      {products.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 46 }}>🔍</div>
          <h3>Produk tidak ditemukan</h3>
          <p className="text-muted">Coba kata kunci lain atau ganti filter kategori.</p>
        </div>
      ) : (
        <div className="product-grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} category={catOf(p.categoryId)} />
          ))}
        </div>
      )}
    </div>
  )
}
