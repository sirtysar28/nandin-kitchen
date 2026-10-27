// ============================================================
// Banner slider homepage
// - Desktop (≥961px) : 2 banner tampil bersamaan
// - Mobile/tablet     : 1 banner per layar (geser/swipe)
// - Maksimal : 6 slide (kelebihan tidak ditampilkan)
// - Autoplay 5 detik + tombol panah (desktop) + titik pagination
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

export const MAX_BANNERS = 6
const AUTOPLAY_MS = 5000

export default function BannerSlider({ banners = [] }) {
  // Hanya banner aktif, maksimal 6 (urutan = urutan di dashboard admin)
  const slides = (Array.isArray(banners) ? banners : [])
    .filter((b) => b && b.active !== false)
    .slice(0, MAX_BANNERS)

  const [perView, setPerView] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 961px)').matches ? 2 : 1
  )
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchX = useRef(null)

  // Jumlah posisi halaman (desktop 6 slide → 5 posisi, mobile → 6 posisi)
  const pages = Math.max(1, slides.length - perView + 1)
  const maxIndex = Math.max(0, slides.length - perView)

  // Responsif: ikuti lebar layar (desktop ≥961px → 2 banner, mobile/tablet → 1)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 961px)')
    const apply = () => setPerView(mq.matches ? 2 : 1)
    apply()
    mq.addEventListener('change', apply)
    window.addEventListener('resize', apply)
    return () => {
      mq.removeEventListener('change', apply)
      window.removeEventListener('resize', apply)
    }
  }, [])

  // Jaga posisi tetap valid saat jumlah slide / lebar layar berubah
  useEffect(() => {
    setIndex((i) => Math.min(Math.max(0, i), maxIndex))
  }, [maxIndex])

  // Autoplay: maju 1 slide tiap 5 detik, berhenti saat disentuh/hover
  useEffect(() => {
    if (paused || pages <= 1 || slides.length === 0) return
    const t = setInterval(() => setIndex((i) => (i + 1) % pages), AUTOPLAY_MS)
    return () => clearInterval(t)
  }, [paused, pages, index, slides.length])

  if (slides.length === 0) return null

  const prev = () => setIndex((i) => (i - 1 + pages) % pages)
  const next = () => setIndex((i) => (i + 1) % pages)

  function onTouchStart(e) {
    setPaused(true)
    touchX.current = e.touches[0].clientX
  }
  function onTouchEnd(e) {
    const x0 = touchX.current
    touchX.current = null
    if (x0 == null) return
    const dx = e.changedTouches[0].clientX - x0
    if (Math.abs(dx) > 40) (dx < 0 ? next : prev)()
  }

  return (
    <section
      className="banner-slider"
      aria-roledescription="carousel"
      aria-label="Banner promo"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="banner-viewport">
        <div
          className="banner-track"
          style={{ transform: `translateX(-${index * (100 / perView)}%)` }}
        >
          {slides.map((b, i) => (
            <div
              key={b.id}
              className="banner-slide"
              style={{
                flex: `0 0 ${100 / perView}%`,
                paddingRight: perView > 1 && i < slides.length - 1 ? 10 : 0,
              }}
            >
              <div className="banner-card">
                {b.image ? (
                  <img src={b.image} alt={b.title || 'Banner'} loading="lazy" draggable={false} />
                ) : (
                  <div className="banner-art" aria-hidden="true">
                    <span>{b.emoji || '🎂'}</span>
                  </div>
                )}
                <div className="banner-copy">
                  <h3>{b.title}</h3>
                  {b.subtitle && <p>{b.subtitle}</p>}
                  {b.link && b.linkLabel && (
                    /^https?:\/\//i.test(b.link) ? (
                      <a className="btn btn-primary btn-sm" href={b.link} target="_blank" rel="noopener noreferrer">
                        {b.linkLabel}
                      </a>
                    ) : (
                      <Link className="btn btn-primary btn-sm" to={b.link}>{b.linkLabel}</Link>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {pages > 1 && (
        <>
          <button className="banner-nav prev" onClick={prev} aria-label="Banner sebelumnya">‹</button>
          <button className="banner-nav next" onClick={next} aria-label="Banner berikutnya">›</button>
          <div className="banner-dots" role="tablist" aria-label="Pilih banner">
            {Array.from({ length: pages }).map((_, p) => (
              <button
                key={p}
                role="tab"
                aria-selected={p === index}
                className={`banner-dot ${p === index ? 'active' : ''}`}
                onClick={() => setIndex(p)}
                aria-label={`Banner ${p + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
