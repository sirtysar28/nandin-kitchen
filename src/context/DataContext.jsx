import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'
import { db, subscribe, getVersion } from '../services/db'

const Ctx = createContext(null)

export function DataProvider({ children }) {
  useSyncExternalStore(subscribe, getVersion, getVersion)
  const value = useMemo(() => ({ db }), [])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useData = () => useContext(Ctx)
