// Menampilkan foto produk; jika kosong pakai emoji di atas gradasi tema
export default function Photo({ item, size = 'md', className = '' }) {
  const cls = `photo photo-${size} ${className}`
  if (item?.photo) return <img className={cls} src={item.photo} alt={item.name} loading="lazy" />
  return (
    <div className={`${cls} photo-ph`}>
      <span>{item?.emoji || '🧁'}</span>
    </div>
  )
}
