import { createContext, useContext, useMemo, useState } from 'react'
import { db, serverLogin, serverLogout } from '../services/db'

const Ctx = createContext(null)
const KEY = 'nandin_auth_v1'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY))
    } catch {
      return null
    }
  })

  const value = useMemo(
    () => ({
      user,
      isAdmin: user && (user.role === 'admin' || user.role === 'kasir'),
      login(email, password) {
        const found = db
          .list('users')
          .find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase() && u.password === password)
        if (!found) return { ok: false, error: 'Email atau kata sandi salah.' }
        const { password: _p, ...safe } = found
        localStorage.setItem(KEY, JSON.stringify(safe))
        setUser(safe)
        // Buat sesi admin di server agar penulisan data diizinkan PHP API
        if (safe.role === 'admin' || safe.role === 'kasir') serverLogin(email, password)
        return { ok: true, user: safe }
      },
      register({ name, email, phone, password }) {
        const emailClean = String(email).trim().toLowerCase()
        if (db.list('users').some((u) => u.email.toLowerCase() === emailClean))
          return { ok: false, error: 'Email sudah terdaftar, silakan masuk.' }
        const created = db.insert('users', { name, email: emailClean, phone, password, role: 'customer' })
        db.insert('customers', { name, email: emailClean, phone, userId: created.id })
        const { password: _p, ...safe } = created
        localStorage.setItem(KEY, JSON.stringify(safe))
        setUser(safe)
        return { ok: true, user: safe }
      },
      logout() {
        serverLogout()
        localStorage.removeItem(KEY)
        setUser(null)
      },
    }),
    [user]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
