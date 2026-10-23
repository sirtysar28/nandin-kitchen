import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const Ctx = createContext(null)
const KEY = 'nandin_cart_v1'

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || []
    } catch {
      return []
    }
  })

  // Keranjang tersimpan di perangkat (mendukung PWA / kembali lagi)
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items))
  }, [items])

  const value = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0)
    return {
      items,
      subtotal,
      count: items.reduce((s, it) => s + it.qty, 0),
      add(item) {
        // item: { productId, name, emoji, photo, price, cost, size, variant, qty, note, stock }
        setItems((prev) => {
          const key = (i) => i.productId + '|' + (i.size || '') + '|' + (i.variant || '')
          const idx = prev.findIndex((i) => key(i) === key(item))
          if (idx > -1) {
            const next = [...prev]
            const merged = { ...next[idx], qty: next[idx].qty + item.qty }
            if (item.note) merged.note = item.note
            next[idx] = merged
            return next
          }
          return [...prev, item]
        })
      },
      setQty(idx, qty) {
        setItems((prev) =>
          prev
            .map((it, i) => (i === idx ? { ...it, qty: Math.max(1, qty) } : it))
            .filter((it) => it.qty > 0)
        )
      },
      remove(idx) {
        setItems((prev) => prev.filter((_, i) => i !== idx))
      },
      clear() {
        setItems([])
      },
    }
  }, [items])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useCart = () => useContext(Ctx)
