import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { SettingsProvider } from './context/SettingsContext.jsx'
import { DataProvider } from './context/DataContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { CartProvider } from './context/CartContext.jsx'
import { ToastProvider } from './components/common/Toast.jsx'
import { initDB } from './services/db'
import './index.css'

// Muat web font secara non-blocking agar aplikasi tetap tampil instan
// walau font eksternal lambat/diblokir jaringan (fallback: font sistem)
(function loadFonts() {
  const l = document.createElement('link')
  l.rel = 'stylesheet'
  l.href =
    'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800&display=swap'
  document.head.appendChild(l)
})()

// Registrasi service worker PWA (hanya build produksi)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

// Siapkan lapisan data (sinkronisasi database saat mode server aktif) sebelum
// aplikasi dirender. initDB tidak pernah gagal: bila server tak terjangkau,
// aplikasi tetap terbuka dengan data lokal.
initDB().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <SettingsProvider>
          <DataProvider>
            <AuthProvider>
              <CartProvider>
                <ToastProvider>
                  <App />
                </ToastProvider>
              </CartProvider>
            </AuthProvider>
          </DataProvider>
        </SettingsProvider>
      </BrowserRouter>
    </React.StrictMode>
  )
})
