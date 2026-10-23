import { Link } from 'react-router-dom'
import { useSettings } from '../../context/SettingsContext'
import { useData } from '../../context/DataContext'
import ProductCard from '../../components/products/ProductCard'
import { rupiah } from '../../utils/format'

export default function Home() {
  const settings = useSettings()
  const { db } = useData()
  const products = db.list('products').filter((p) => p.active)
  const categories = db.list('categories')
  const featured = products.filter((p) => p.featured).slice(0, 8)
  const catOf = (id) => categories.find((c) => c.id === id)

  return (
    <div className="stack-lg" style={{ display: 'grid', gap: 44 }}>
      {/* Hero */}
      <section className="hero">
        <div>
          <span className="badge badge-caramel" style={{ marginBottom: 14 }}>🧁 {settings.tagline}</span>
          <h1>{settings.heroTitle}</h1>
          <p>{settings.heroSubtitle}</p>
          <div className="row mt-3">
            <Link to="/products" className="btn btn-primary btn-lg">Pesan Sekarang 🎂</Link>
            <Link to="/about" className="btn btn-outline btn-lg" style={{ borderColor: 'rgba(250,245,238,.4)', color: '#fff' }}>Tentang Kami</Link>
          </div>
          <div className="hero-emoji-row">🎂 🍫 🍪 🥐 🎁</div>
        </div>
        <div className="hero-art">🎂</div>
      </section>

      {/* Promo strip */}
      <section className="promo-strip">
        <div>
          <b>🎉 Gratis ongkir</b> untuk belanja minimal {rupiah(settings.shipping.freeMin)}
        </div>
        <div>
          <b>⏰ Pre-order</b> tersedia untuk lapis legit & hampers
        </div>
        <Link to="/products" className="btn btn-primary">Lihat Katalog</Link>
      </section>

      {/* Kategori */}
      <section>
        <div className="section-head">
          <div>
            <h2>Kategori Favorit</h2>
            <p className="text-muted" style={{ margin: 0 }}>Pilih sesuai selera manismu</p>
          </div>
        </div>
        <div className="row">
          {categories.map((c) => (
            <Link key={c.id} to={`/products?cat=${c.slug}`} className="chip chip-lg">
              <span style={{ fontSize: 20 }}>{c.emoji}</span> {c.name}
            </Link>
          ))}
        </div>
      </section>

      {/* Produk unggulan */}
      <section>
        <div className="section-head">
          <div>
            <h2>Produk Unggulan ⭐</h2>
            <p className="text-muted" style={{ margin: 0 }}>Paling dicari pelanggan Nandin Kitchen minggu ini</p>
          </div>
          <Link to="/products" className="btn btn-outline btn-sm">Lihat Semua →</Link>
        </div>
        <div className="product-grid">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} category={catOf(p.categoryId)} />
          ))}
        </div>
      </section>

      {/* Kenapa kami */}
      <section>
        <h2 style={{ textAlign: 'center' }}>Kenapa Nandin Kitchen?</h2>
        <div className="grid-3 mt-3">
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 42 }}>👩‍🍳</div>
            <h3>Dibuat Segar Harian</h3>
            <p className="text-muted">Semua kue dipanggang fresh setiap pagi dengan bahan premium pilihan.</p>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 42 }}>🛵</div>
            <h3>Ambil atau Dikirim</h3>
            <p className="text-muted">Pilih ambil di toko sesuai jadwal, atau pesan antar ke alamatmu.</p>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 42 }}>💳</div>
            <h3>Bayar Fleksibel</h3>
            <p className="text-muted">Konfirmasi via WhatsApp atau bayar online dengan Midtrans.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
