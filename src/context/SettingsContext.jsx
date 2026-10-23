import { createContext, useContext, useEffect, useSyncExternalStore } from 'react'
import { db, subscribe, getVersion } from '../services/db'

const Ctx = createContext(null)

export function SettingsProvider({ children }) {
  useSyncExternalStore(subscribe, getVersion, getVersion)
  const settings = db.settings()

  // Terapkan favicon & judul dinamis (bisa di-custom dari Pengaturan > Branding)
  useEffect(() => {
    const icon = settings.favicon || '/favicon.png'
    let link = document.querySelector("link[rel='icon']")
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = icon
    const apple = document.querySelector("link[rel='apple-touch-icon']")
    if (apple) apple.href = icon
    document.title = `${settings.storeName} — ${settings.tagline || 'Toko Kue'}`
  }, [settings.favicon, settings.storeName, settings.tagline])

  return <Ctx.Provider value={settings}>{children}</Ctx.Provider>
}

export const useSettings = () => useContext(Ctx)
