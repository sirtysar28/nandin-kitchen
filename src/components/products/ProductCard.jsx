import { Link, useNavigate } from 'react-router-dom'
import { rupiah } from '../../utils/format'
import Photo from '../common/Photo'
import { useCart } from '../../context/CartContext'
import { useToast } from '../common/Toast'

export default function ProductCard({ product, category }) {
  const cart = useCart()
  const toast = useToast()
  const navigate = useNavigate()
  const soldOut = product.stock <= 0 && !product.preorder
  const simple = !(product.sizes?.length > 1 || product.variants?.length > 1)

  function add() {
    if (soldOut) return
    if (!simple) return navigate(`/products/${product.id}`)
    cart.add({
      productId: product.id, name: product.name, emoji: product.emoji, photo: product.photo,
      price: product.price, cost: product.cost, size: product.sizes?.[0]?.name || '',
      variant: product.variants?.[0]?.name || '', qty: 1, note: '', stock: product.stock,
    })
    toast(`${product.name} masuk keranjang 🛒`)
  }

  return (
    <div className={`card product-card ${soldOut ? 'is-out' : ''}`}>
      <Link to={`/products/${product.id}`} className="product-media">
        <Photo item={product} size="lg" />
        {product.featured && <span className="badge badge-caramel">⭐ Terlaris</span>}
        {product.preorder && <span className="badge badge-info" style={{ top: 40 }}>Pre-Order</span>}
        {soldOut && <span className="soldout">Stok Habis</span>}
      </Link>
      <div className="product-body">
        <span className="product-cat">{category?.emoji} {category?.name}</span>
        <Link to={`/products/${product.id}`} className="product-name">{product.name}</Link>
        <p className="product-desc">{product.desc}</p>
        <div className="product-foot">
          <div>
            <div className="price">{rupiah(product.price)}</div>
            <small className={`stock-info ${product.stock <= 5 ? 'text-err' : 'text-muted'}`}>
              {product.stock > 0 ? `Stok ${product.stock}` : product.preorder ? 'Bisa pre-order' : 'Habis'}
            </small>
          </div>
          <button className="btn btn-primary btn-sm" onClick={add} disabled={soldOut}>
            {simple ? '+ Keranjang' : 'Pilih'}
          </button>
        </div>
      </div>
    </div>
  )
}
