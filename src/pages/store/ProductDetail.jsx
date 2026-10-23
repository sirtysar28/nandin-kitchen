import { useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useData } from '../../context/DataContext'
import { useCart } from '../../context/CartContext'
import { useToast } from '../../components/common/Toast'
import Photo from '../../components/common/Photo'
import ProductCard from '../../components/products/ProductCard'
import { rupiah, fmtDate } from '../../utils/format'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { db } = useData()
  const cart = useCart()
  const toast = useToast()

  const product = db.get('products', id)
  const categories = db.list('categories')

  const [sizeIdx, setSizeIdx] = useState(0)
  const [variantIdx, setVariantIdx] = useState(0)
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')

  const related = useMemo(
    () => (product ? db.list('products').filter((p) => p.categoryId === product.categoryId && p.id !== product.id && p.active).slice(0, 4) : []),
    [product?.id]
  )

  if (!product) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 48 }}>
        <h2>Produk tidak ditemukan 😢</h2>
        <Link to="/products" className="btn btn-primary">← Kembali ke Katalog</Link>
      </div>
    )
  }

  const category = categories.find((c) => c.id === product.categoryId)
  const size = product.sizes?.[sizeIdx] || { name: '', delta: 0 }
  const variant = product.variants?.[variantIdx] || { name: '', delta: 0 }
  const unitPrice = product.price + (size.delta || 0) + (variant.delta || 0)
  const soldOut = product.stock <= 0 && !product.preorder

  function addToCart(goCart = false) {
    if (soldOut) return
    cart.add({
      productId: product.id, name: product.name, emoji: product.emoji, photo: product.photo,
      price: unitPrice, cost: product.cost, size: size.name, variant: variant.name,
      qty, note, stock: product.stock,
    })
    toast(`${product.name} masuk keranjang 🛒`)
    if (goCart) navigate('/cart')
  }

  return (
    <div>
      <nav className="text-muted mb-2" style={{ fontSize: 13.5 }}>
        <Link to="/">Beranda</Link> › <Link to="/products">Katalog</Link> › <Link to={`/products?cat=${category?.slug}`}>{category?.name}</Link> › <b>{product.name}</b>
      </nav>

      <div className="detail-grid">
        <div>
          <Photo item={product} size="xl" className="photo-xl" />
          {product.gallery?.length > 0 && (
            <div className="row mt-2">
              {product.gallery.map((g, i) => <img key={i} src={g} className="photo photo-md" alt="" />)}
            </div>
          )}
        </div>

        <div>
          <span className="badge badge-caramel mb-1">{category?.emoji} {category?.name}</span>
          <h1 style={{ fontSize: 30 }}>{product.name}</h1>
          <p className="text-muted">{product.desc}</p>

          <div className="row mb-2">
            <span className={`badge ${product.stock > 5 ? 'badge-ok' : product.stock > 0 ? 'badge-warn' : 'badge-err'}`}>
              {product.stock > 0 ? `Stok tersisa ${product.stock}` : product.preorder ? 'Pre-Order (H+2)' : 'Stok habis'}
            </span>
            {product.preorder && <span className="badge badge-info">📦 Pre-Order</span>}
            <span className="badge">SKU: {product.sku}</span>
          </div>

          {product.sizes?.length > 1 && (
            <div className="mb-2">
              <label className="label">Pilih Ukuran</label>
              <div className="opt-group">
                {product.sizes.map((s, i) => (
                  <button key={i} type="button" className={`opt ${i === sizeIdx ? 'active' : ''}`} onClick={() => setSizeIdx(i)}>
                    {s.name}{s.delta ? ` (+${rupiah(s.delta)})` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {product.variants?.length > 1 && (
            <div className="mb-2">
              <label className="label">Pilih Varian</label>
              <div className="opt-group">
                {product.variants.map((v, i) => (
                  <button key={i} type="button" className={`opt ${i === variantIdx ? 'active' : ''}`} onClick={() => setVariantIdx(i)}>
                    {v.name}{v.delta ? ` (+${rupiah(v.delta)})` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-2">
            <label className="label">Jumlah</label>
            <div className="row">
              <div className="qty-stepper">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                <span>{qty}</span>
                <button type="button" onClick={() => setQty((q) => q + 1)}>+</button>
              </div>
              <b style={{ fontSize: 20 }}>{rupiah(unitPrice * qty)}</b>
            </div>
          </div>

          <div className="mb-3">
            <label className="label">Catatan Pesanan <span className="text-muted">(opsional)</span></label>
            <textarea className="input" placeholder="Contoh: tulis selamat ulang tahun, kurangi gula, dsb." value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <div className="row">
            <button className="btn btn-primary btn-lg" disabled={soldOut} onClick={() => addToCart(false)}>
              + Keranjang
            </button>
            <button className="btn btn-outline btn-lg" disabled={soldOut} onClick={() => addToCart(true)}>
              Beli Sekarang
            </button>
          </div>
          <p className="text-muted mt-2" style={{ fontSize: 13 }}>
            🕒 {fmtDate(new Date())} — pesanan diproses setelah konfirmasi admin. Pertanyaan? Hubungi kami via WhatsApp.
          </p>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-4">
          <h2>Produk Serupa</h2>
          <div className="product-grid">
            {related.map((p) => <ProductCard key={p.id} product={p} category={categories.find((c) => c.id === p.categoryId)} />)}
          </div>
        </section>
      )}
    </div>
  )
}
