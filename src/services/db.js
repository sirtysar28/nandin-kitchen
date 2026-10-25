// ============================================================
// Lapisan data Nandin Kitchen
// - Tanpa VITE_API_URL  : mock penuh di localStorage (dev/offline)
// - Dengan VITE_API_URL : server MySQL (PHP API) jadi sumber
//   kebenaran; UI tetap membaca dari cache memori agar instan.
//   Setiap penulisan masuk antrean dan dikirim ke server secara
//   berurutan (dengan retry saat koneksi putus), lalu perubahan
//   dari perangkat lain ditarik lewat polling berkala.
// ============================================================
import { seed, SMTP_DEFAULT } from './seed'
import { uid } from '../utils/format'

const KEY = 'nandin_db_v1'
const QUEUE_KEY = 'nandin_sync_queue_v1'
// URL API dihitung dari LOKASI BUNDLE INI (bukan dari root domain), sehingga
// otomatis mengikuti di mana web dipasang: subdomain
// (https://nandin-kitchen.ciptakaryadigital.id/) maupun subfolder
// (https://ciptakaryadigital.id/nandin-kitchen.ciptakaryadigital.id/).
// Bundle ada di <root>/assets/index-*.js → API = <root>/api
const API_URL = (() => {
  const raw = (import.meta.env.VITE_API_URL || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  try {
    const root = new URL('../', import.meta.url)
    let p = new URL(raw.replace(/^\/+/, '').replace(/\/+$/, ''), root).pathname
    // PENTING: wajib diakhiri "/" (mis. "/api/"). Tanpa itu server
    // me-redirect /api → /api/ (301) dan POST otomatis berubah GET
    // + body dibuang → semua penulisan data diam-diam gagal.
    if (!p.endsWith('.php')) p += '/'
    return p
  } catch {
    return raw
  }
})()
const SERVER = !!API_URL
const POLL_MS = 15000
const BOOT_TIMEOUT = 8000

const listeners = new Set()
let cache = null
let version = 0
let queue = []
let syncing = false
let serverOk = false
let lastVersion = null
let reservedSeq = null // nomor pesanan yang sudah direservasi dari server (atomik)
let pollTimer = null
// Saat aksi komposit (order-paid/order-status) berjalan, perubahan pada
// koleksi orders/products/stockMoves cukup dieksekusi server secara atomik —
// pengiriman per-operasi dilewati supaya tidak dobel/tidak sah.
let compositeGuard = false
// Sesi admin di server ditolak (403) — biasanya karena session PHP kedaluwarsa.
// Operasi TETAP ditahan di antrean (tidak dibuang) dan dikirim ulang setelah
// admin login ulang; UI diberi tahu lewat event 'nk-sync-blocked'.
let syncBlocked = false

// ---------- Status koneksi & diagnostik ----------
// Dipakai panel status di dashboard admin supaya jelas DI MANA masalahnya:
// API tidak ditemukan / config.php belum diisi / database salah / sesi habis.
let connInfo = { state: SERVER ? 'connecting' : 'local', message: '', httpStatus: 0, checkedAt: null }

function setConn(state, message = '', httpStatus = 0) {
  connInfo = { state, message, httpStatus, checkedAt: new Date().toISOString() }
  try { window.dispatchEvent(new CustomEvent('nk-sync-state', { detail: getSyncInfo() })) } catch { /* abaikan */ }
}

export function getSyncInfo() {
  let abs = ''
  try { abs = API_URL ? new URL(API_URL, window.location.href).href : '' } catch { abs = API_URL }
  return {
    mode: SERVER ? 'server' : 'local',
    apiUrl: abs || '(mode lokal — build tanpa VITE_API_URL)',
    state: connInfo.state,
    message: connInfo.message,
    httpStatus: connInfo.httpStatus,
    queue: queue.length,
    blocked: syncBlocked,
    checkedAt: connInfo.checkedAt,
  }
}

// ---------- Cache & notifikasi UI ----------

function read() {
  if (cache) return cache
  try {
    cache = JSON.parse(localStorage.getItem(KEY))
  } catch {
    cache = null
  }
  if (!cache || !cache.products) {
    cache = seed()
    persistLocal()
    return cache
  }
  // Migrasi ringan untuk data lama (mis. penambahan pengaturan SMTP & log email)
  let migrated = false
  if (!cache.settings.smtp) { cache.settings.smtp = SMTP_DEFAULT; migrated = true }
  if (!cache.emails) { cache.emails = []; migrated = true }
  if (migrated) persistLocal()
  return cache
}

function persistLocal() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)) } catch { /* kuota penuh — abaikan */ }
}

function commit() {
  version++
  persistLocal()
  listeners.forEach((fn) => fn())
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const getVersion = () => version

// ---------- Sinkronisasi ke server (PHP + MySQL) ----------

function saveQueue() {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)) } catch { /* abaikan */ }
}

function loadQueue() {
  try { queue = JSON.parse(localStorage.getItem(QUEUE_KEY)) || [] } catch { queue = [] }
}

function enqueue(op) {
  // SELALU masukkan antrean selama mode server aktif — walau server
  // belum terhubung saat itu. Jika op dibuang di sini, edit admin akan
  // tersimpan hanya di localStorage browser itu dan tidak pernah sampai
  // ke database (data antar-browser jadi berbeda).
  if (!SERVER || suppressCheck(op)) return
  queue.push(op)
  saveQueue()
  flushQueue()
}

function suppressCheck(op) {
  if (!compositeGuard) return false
  return op.col === 'orders' || op.col === 'products' || op.col === 'stockMoves'
}

// Beri pesan error yang bisa dibaca manusia saat API gagal dijawab
async function noteApiError(res, html = false) {
  const status = res ? res.status : 0
  let msg = ''
  if (!res) {
    msg = 'Server tidak terjangkau — cek koneksi internet, atau folder "/api" belum terupload ke hosting.'
  } else if (html) {
    msg = `API di "${API_URL}" menjawab halaman web, bukan JSON. Kemungkinan: folder api belum terupload, PHP tidak aktif, atau URL API salah (mis. website dipasang di subfolder).`
  } else {
    try {
      const j = await res.json()
      msg = (j && (j.message || j.error)) || `Server menjawab HTTP ${status}`
    } catch {
      msg = `Server menjawab HTTP ${status}`
    }
  }
  setConn('offline', msg, status)
}

async function apiPost(action, payload = {}) {
  const qs = new URLSearchParams({ action })
  if (payload.col) qs.set('col', payload.col)
  if (payload.id != null) qs.set('id', payload.id)
  try {
    const res = await fetch(`${API_URL}?${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    })
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('json')) {
      await noteApiError(res, true)
      return { ok: false, status: res.status }
    }
    const json = await res.json().catch(() => ({ ok: false }))
    const ok = res.ok && json.ok !== false
    if (!ok && (res.status === 0 || res.status >= 500)) {
      setConn('offline', (json && json.message) || `Server error HTTP ${res.status}`, res.status)
    }
    return { ...json, ok, status: res.status }
  } catch {
    noteApiError(null)
    return { ok: false, status: 0 }
  }
}

async function apiGet(action) {
  try {
    const res = await fetch(`${API_URL}?action=${action}`, { credentials: 'same-origin' })
    if (!res.ok) { await noteApiError(res); return null }
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('json')) { await noteApiError(res, true); return null }
    return await res.json()
  } catch {
    noteApiError(null)
    return null
  }
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((r) => setTimeout(() => r(null), ms))])
}

// Kirim antrean secara berurutan; gagal jaringan → tahan & ulangi, ditolak
// permanen (400/404) → buang agar tidak menyumbat. Ditolak karena sesi
// (403) → TETAP ditahan & ingatkan admin untuk login ulang — setelah login
// ulang seluruh antrean otomatis dikirim.
function notifyBlocked() {
  try { window.dispatchEvent(new CustomEvent('nk-sync-blocked')) } catch { /* abaikan */ }
}

function notifyRecovered() {
  try { window.dispatchEvent(new CustomEvent('nk-sync-recovered')) } catch { /* abaikan */ }
}

export const isSyncBlocked = () => syncBlocked

async function flushQueue() {
  if (!SERVER || syncing || !queue.length) return
  // Server belum terhubung (mis. bootstrap gagal saat load) → coba
  // hubungkan dulu; antrean tetap tersimpan dan dikirim begitu nyambung.
  if (!serverOk) { connect(); return }
  syncing = true
  try {
    while (queue.length) {
      const op = queue[0]
      const action = op.t === 'settings' ? 'settings'
        : op.t === 'reset' ? 'reset'
        : op.t === 'delete' ? 'delete'
        : op.t === 'import' ? 'import'
        : op.t === 'order-paid' ? 'order-paid'
        : op.t === 'order-status' ? 'order-status'
        : 'upsert'
      const r = await apiPost(action, op)
      if (!r.ok) {
        if (r.status === 400 || r.status === 404) {
          queue.shift(); saveQueue(); continue
        }
        if (r.status === 403) {
          if (!syncBlocked) { syncBlocked = true; notifyBlocked() }
          break // tahan semua operasi — kirim ulang setelah login ulang
        }
        break // gangguan jaringan/server — ulangi nanti
      }
      queue.shift(); saveQueue()
      if (syncBlocked) { syncBlocked = false; notifyRecovered() }
    }
  } finally {
    syncing = false
  }
  if (queue.length) setTimeout(flushQueue, syncBlocked ? 60000 : 8000)
  else if (serverOk && !syncBlocked) setConn('online', '')
}

// Ganti cache dengan data terbaru dari server
function hydrate(boot) {
  const fresh = seed()
  Object.keys(fresh).forEach((k) => {
    if (Array.isArray(fresh[k])) fresh[k] = (boot.data && boot.data[k]) || []
  })
  fresh.settings = boot.settings || fresh.settings
  fresh.seq = read().seq || { order: 200 }
  fresh.orders.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  cache = fresh
  lastVersion = boot.version ?? null
  commit()
}

async function reserveSeq() {
  if (!SERVER || !serverOk) return
  const r = await apiPost('seq', {})
  if (r.ok && Number.isFinite(r.next)) reservedSeq = Number(r.next)
}

function startPolling() {
  if (pollTimer || !SERVER) return
  const tick = async () => {
    if (!serverOk) { connect(); return } // pulihkan koneksi yang hilang saat load
    if (document.hidden || queue.length || syncing) return
    const v = await apiGet('version')
    if (!v || !v.ok || v.n === 0) return
    if (v.version === lastVersion) return
    const boot = await apiGet('bootstrap')
    if (boot && boot.ok && !boot.empty) hydrate(boot)
  }
  pollTimer = setInterval(tick, POLL_MS)
  document.addEventListener('visibilitychange', tick)
  // Koneksi internet kembali aktif → coba sambung ulang & kirim antrean
  window.addEventListener('online', () => { if (serverOk) flushQueue(); else connect() })
}

// ---------- Koneksi / penyembuhan diri ke server ----------
// connect() bisa dipanggil berkali-kali: jika server sudah terhubung ia
// langsung selesai; jika tidak, ia mencoba bootstrap ulang. Semua kegagalan
// dijadwalkan dicoba lagi (scheduleReconnect) sehingga aplikasi tidak pernah
// "terjebak" mode lokal permanen hanya karena server sempat tak terjangkau
// saat halaman dimuat.
let connecting = false
let reconnectTimer = null

function scheduleReconnect() {
  if (!SERVER || serverOk || reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect()
  }, 10000)
}

async function connect() {
  if (!SERVER || serverOk || connecting) return serverOk
  connecting = true
  try {
    let boot = await withTimeout(apiGet('bootstrap'), BOOT_TIMEOUT)
    if (!boot || !boot.ok) return false
    serverOk = true
    if (boot.empty) {
      // Database masih kosong → migrasi otomatis: kirim data lokal (termasuk
      // data yang sudah pernah diinput di browser ini) ke server.
      const payload = importPayload(read())
      const r = await withTimeout(apiPost('import', payload), BOOT_TIMEOUT)
      if (!r.ok) { serverOk = false; return false }
      boot = await withTimeout(apiGet('bootstrap'), BOOT_TIMEOUT)
      if (boot && boot.ok) hydrate(boot)
    } else if (queue.length) {
      // Ada tulisan tertunda dari sesi offline sebelumnya — kirim dulu
      // supaya tidak tertimpa data server, lalu ambil kondisi terbaru.
      await flushQueue()
      if (!queue.length) {
        const b2 = await apiGet('bootstrap')
        if (b2 && b2.ok) hydrate(b2)
      }
      // Masih ada antrean gagal kirim → data lokal dipertahankan;
      // flushQueue sendiri menjadwalkan percobaan ulang.
    } else {
      hydrate(boot)
    }
    flushQueue()
    reserveSeq()
    startPolling()
    setConn('online', '')
    return true
  } finally {
    connecting = false
    if (!serverOk) scheduleReconnect()
  }
}

// Dipanggil sekali sebelum aplikasi dirender (lihat main.jsx).
// Tidak pernah gagal: bila server tidak terjangkau, aplikasi tetap
// berjalan dengan data lokal, antrean tersimpan, dan koneksi dicoba
// ulang otomatis di latar belakang sampai berhasil.
export async function initDB() {
  read()
  if (!SERVER) return
  setConn('connecting', '')
  loadQueue()
  await connect()
}

// Dipakai panel diagnostik admin: paksa coba sambung ulang + kirim antrean.
export function retrySync() {
  if (!SERVER) return
  if (!serverOk) { connect(); return }
  flushQueue()
}

// Dipakai panel diagnostik admin: panggil API mentah dan lihat jawabannya.
export async function testConnection() {
  const out = {}
  try { out.apiUrl = new URL(API_URL, window.location.href).href } catch { out.apiUrl = API_URL }
  try {
    const res = await fetch(`${API_URL}?action=version`, { credentials: 'same-origin' })
    out.httpStatus = res.status
    out.contentType = res.headers.get('content-type') || '(kosong)'
    const text = await res.text()
    out.body = text.slice(0, 400)
    try { out.json = JSON.parse(text) } catch { out.json = null }
  } catch (e) {
    out.error = String(e)
  }
  return out
}

function importPayload(c) {
  let maxSeq = c.seq?.order || 200
  c.orders.forEach((o) => {
    const n = parseInt(String(o.number || '').split('-').pop(), 10)
    if (Number.isFinite(n) && n > maxSeq) maxSeq = n
  })
  return { data: c, settings: c.settings, seqOrder: maxSeq + 1 }
}

// ---------- API basis data (dipakai komponen UI — tetap sinkron) ----------

export const db = {
  list(col) {
    return read()[col] ?? []
  },
  get(col, id) {
    return read()[col].find((x) => x.id === id)
  },
  insert(col, obj) {
    const c = read()
    const item = { id: uid(), createdAt: new Date().toISOString(), ...obj }
    if (col === 'orders') c[col].unshift(item)
    else c[col].push(item)
    commit()
    enqueue({ t: 'upsert', col, id: item.id, data: stripId(item) })
    return item
  },
  update(col, id, patch) {
    const c = read()
    const i = c[col].findIndex((x) => x.id === id)
    if (i === -1) return null
    c[col][i] = { ...c[col][i], ...patch }
    commit()
    enqueue({ t: 'upsert', col, id, data: stripId(c[col][i]) })
    return c[col][i]
  },
  remove(col, id) {
    const c = read()
    c[col] = c[col].filter((x) => x.id !== id)
    commit()
    enqueue({ t: 'delete', col, id })
  },
  settings() {
    return read().settings
  },
  setSettings(patch) {
    const c = read()
    c.settings = { ...c.settings, ...patch }
    commit()
    enqueue({ t: 'settings', data: c.settings })
    return c.settings
  },
  reset(creds) {
    queue = []
    saveQueue()
    cache = seed()
    commit()
    enqueue({ t: 'reset', creds })
  },
}

function stripId(obj) {
  const { id: _id, ...rest } = obj
  return rest
}

// ---------- Operasi domain (menggantikan endpoint backend) ----------

export function adjustStock(productId, qty, type, note = '', ref = '') {
  const p = db.get('products', productId)
  if (!p) return
  const delta = type === 'in' ? qty : -qty
  db.update('products', productId, { stock: Math.max(0, (p.stock || 0) + delta) })
  db.insert('stockMoves', { productId, name: p.name, type, qty, note, ref })
}

export function applyOrderStock(order) {
  if (order.stockApplied) return
  order.items.forEach((it) => adjustStock(it.productId, it.qty, 'out', `Penjualan ${order.number}`, order.id))
  db.update('orders', order.id, { stockApplied: true })
}

export function revertOrderStock(order) {
  if (!order.stockApplied) return
  order.items.forEach((it) => adjustStock(it.productId, it.qty, 'in', `Pembatalan ${order.number}`, order.id))
  db.update('orders', order.id, { stockApplied: false })
}

// ---------- Notifikasi email (HTML + logo, dikirim server via SMTP) ----------
// Body email berformat HTML dengan logo Nandin Kitchen. Pengiriman asli
// dilakukan PHP API (?action=email) memakai konfigurasi SMTP dari database —
// kredensial SMTP tidak pernah diekspos ke browser. Riwayat pengiriman
// (berhasil/gagal) tetap tercatat & tersinkron antar perangkat.

function emailLogo() {
  const s = db.settings()
  const origin = typeof location !== 'undefined' ? location.origin : ''
  const logo = s.logo || '/logo-nandin.png'
  // Mayoritas email client memblokir gambar data-URI → pakai URL absolut
  if (logo.startsWith('data:')) return `${origin}/logo-nandin.png`
  return logo.startsWith('http') ? logo : origin + logo
}

export function emailTemplate({ title, bodyHtml, footnote }) {
  const s = db.settings()
  const logo = emailLogo()
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f7f1e8;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f1e8;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 18px rgba(60,36,20,.12);">
  <tr><td align="center" style="background:#3B2A1E;padding:22px;">
    <img src="${logo}" alt="${s.storeName}" style="height:52px;border-radius:10px;display:block;" />
  </td></tr>
  <tr><td style="padding:28px 30px 8px;">
    <h1 style="margin:0 0 14px;font-size:21px;color:#3B2A1E;">${title}</h1>
    <div style="font-size:14.5px;line-height:1.7;color:#5b4636;">${bodyHtml}</div>
  </td></tr>
  <tr><td style="padding:18px 30px 28px;">
    ${footnote ? `<p style="margin:0 0 10px;font-size:12.5px;color:#9b7e63;">${footnote}</p>` : ''}
    <p style="margin:0;font-size:12.5px;color:#9b7e63;">
      ${s.storeName} · ${s.address || ''}<br/>${s.openHours || ''}${s.waNumber || s.phone ? ' · WA ' + (s.waNumber || s.phone) : ''}
    </p>
  </td></tr>
  <tr><td align="center" style="background:#FBF5EE;padding:12px;font-size:11.5px;color:#b39b84;">
    Email otomatis dari ${s.storeName} — mohon jangan dibalas.
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

function orderItemsTable(order) {
  const rows = (order.items || [])
    .map(
      (it) => `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0e4d4;">${it.emoji || ''} ${it.name}</td>
      <td align="center" style="padding:8px 0;border-bottom:1px solid #f0e4d4;">${it.qty}×</td>
      <td align="right" style="padding:8px 0;border-bottom:1px solid #f0e4d4;">Rp${(it.price * it.qty).toLocaleString('id-ID')}</td>
    </tr>`
    )
    .join('')
  return `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#5b4636;margin:12px 0;">
    ${rows}
    <tr><td colspan="2" style="padding:10px 0;"><b>Total</b></td><td align="right" style="padding:10px 0;"><b style="color:#c07b2e;font-size:16px;">Rp${(order.total || 0).toLocaleString('id-ID')}</b></td></tr>
  </table>`
}

export async function sendEmail(to, subject, html) {
  const s = db.settings()
  if (!s.smtp?.enabled || !to) return { ok: false, error: 'SMTP nonaktif atau penerima kosong' }
  const from = `${s.smtp.fromName || s.storeName} <${s.smtp.fromEmail || s.smtp.username}>`
  if (SERVER) {
    const r = await apiPost('email', { to, subject, html })
    db.insert('emails', {
      to, subject, from,
      status: r.ok ? 'terkirim' : `gagal (${r.error || 'HTTP ' + r.status})`,
    })
    return { ok: r.ok, error: r.error }
  }
  db.insert('emails', { to, subject, from, status: 'tercatat (mode lokal)' })
  return { ok: true }
}

export function notifyRegistration(customer) {
  const s = db.settings()
  if (!s.smtp?.enabled) return
  sendEmail(
    customer.email,
    `Selamat datang di ${s.storeName} 🧁`,
    emailTemplate({
      title: `Hai ${customer.name}, akunmu sudah jadi!`,
      bodyHtml: `Terima kasih sudah mendaftar di <b>${s.storeName}</b>.<br/>Sekarang kamu bisa belanja kue favoritmu, checkout cepat, dan melacak status pesanan langsung dari akunmu.<br/><br/>Selamat berbelanja! 🍮`,
    })
  )
  // Beri tahu pemilik toko ada pelanggan baru
  if (s.email)
    sendEmail(
      s.email,
      `Pelanggan baru mendaftar: ${customer.name}`,
      emailTemplate({
        title: 'Pelanggan baru mendaftar 🎉',
        bodyHtml: `<b>${customer.name}</b> (${customer.email}${customer.phone ? ' · ' + customer.phone : ''}) baru saja membuat akun pelanggan.`,
      })
    )
}

export function computeTotals({ items, discount = 0, taxPercent = 0, shippingFee = 0 }) {
  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0)
  const afterDisc = Math.max(0, subtotal - discount)
  const tax = Math.round((afterDisc * taxPercent) / 100)
  return { subtotal, discount, taxPercent, tax, shippingFee, total: afterDisc + tax + shippingFee }
}

export function createOrder(payload) {
  const s = db.settings()
  const number = orderNumberLike()
  const order = {
    id: uid(),
    number,
    channel: payload.channel || 'online',
    customerId: payload.customerId || null,
    customerName: payload.customerName,
    customerPhone: payload.customerPhone,
    customerEmail: payload.customerEmail || '',
    items: payload.items,
    ...computeTotals({
      items: payload.items,
      discount: payload.discount || 0,
      taxPercent: s.taxPercent || 0,
      shippingFee: payload.shippingFee || 0,
    }),
    delivery: payload.delivery,
    payment: { method: payload.paymentMethod, status: 'unpaid', paidAt: null },
    status: 'menunggu',
    note: payload.note || '',
    stockApplied: false,
    createdAt: new Date().toISOString(),
  }
  const c = read()
  c.orders.unshift(order)
  commit()
  enqueue({ t: 'upsert', col: 'orders', id: order.id, data: stripId(order) })

  // Notifikasi email (HTML berlogo): pesanan baru → pelanggan + pemilik toko
  const st = c.settings
  if (st.smtp?.enabled && st.smtp.notify?.newOrder) {
    sendEmail(
      payload.customerEmail || st.email,
      `Pesanan ${order.number} telah diterima 🧁`,
      emailTemplate({
        title: 'Pesanan diterima — terima kasih! 🧁',
        bodyHtml: `Halo <b>${order.customerName}</b>, pesanan <b>${order.number}</b> sudah kami terima dan sedang menunggu pemrosesan.${orderItemsTable(order)}Kami akan mengabari lagi saat pembayaran terverifikasi dan pesanan mulai diproses.`,
      })
    )
    if (st.email)
      sendEmail(
        st.email,
        `Pesanan baru ${order.number} masuk 🛒`,
        emailTemplate({
          title: `Pesanan baru ${order.number} 🛒`,
          bodyHtml: `Pelanggan <b>${order.customerName}</b> (${order.customerPhone || '-'}) membuat pesanan senilai <b>Rp${order.total.toLocaleString('id-ID')}</b>.${orderItemsTable(order)}`,
        })
      )
  }
  return order
}

function orderNumberLike() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  let n
  if (SERVER && serverOk && reservedSeq != null) {
    // Nomor direservasi atomik dari server → dijamin unik antar perangkat
    n = reservedSeq
    reservedSeq = null
    reserveSeq()
  } else {
    const c = read()
    c.seq.order = (c.seq.order || 100) + 1
    n = c.seq.order
  }
  return `NK-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${n % 1000}`
}

export function markOrderPaid(orderId, method) {
  const o = db.get('orders', orderId)
  if (!o || o.payment.status === 'paid') return o
  compositeGuard = true
  try {
    const paidAt = new Date().toISOString()
    db.update('orders', orderId, {
      payment: { method: method || o.payment.method, status: 'paid', paidAt },
      // Pembayaran terverifikasi → pesanan otomatis masuk antrean proses
      status: o.status === 'menunggu' ? 'diproses' : o.status,
    })
    applyOrderStock(db.get('orders', orderId))
  } finally {
    compositeGuard = false
  }
  // Server mengeksekusi atomik: lunas + potong stok + kartu stok
  enqueue({ t: 'order-paid', id: orderId, method: method || o.payment.method })
  // Notifikasi email (HTML berlogo): pembayaran terverifikasi
  const s = db.settings()
  if (s.smtp?.enabled && s.smtp.notify?.payment) {
    sendEmail(
      o.customerEmail || s.email,
      `Pembayaran ${o.number} terverifikasi ✅`,
      emailTemplate({
        title: 'Pembayaran diterima ✅',
        bodyHtml: `Halo <b>${o.customerName}</b>, pembayaran pesanan <b>${o.number}</b> telah kami terima.${orderItemsTable(o)}Pesananmu sedang diproses dan akan segera siap. Mohon ditunggu ya! 🍳`,
      })
    )
  }
  return db.get('orders', orderId)
}

export function setOrderStatus(orderId, status) {
  const o = db.get('orders', orderId)
  if (!o) return
  compositeGuard = true
  try {
    if (status === 'dibatalkan') {
      revertOrderStock(o)
      db.update('orders', orderId, { status: 'dibatalkan' })
    } else {
      // Saat mulai diproses, stok dikunci/dipotong
      if (status === 'diproses') applyOrderStock(o)
      db.update('orders', orderId, { status })
    }
  } finally {
    compositeGuard = false
  }
  enqueue({ t: 'order-status', id: orderId, status })
  // Notifikasi email (HTML berlogo): pesanan selesai
  if (status === 'selesai') {
    const s = db.settings()
    if (s.smtp?.enabled && s.smtp.notify?.status) {
      sendEmail(
        o.customerEmail || s.email,
        `Pesanan ${o.number} selesai 🎉`,
        emailTemplate({
          title: 'Pesanan selesai — terima kasih! 🎉',
          bodyHtml: `Halo <b>${o.customerName}</b>, pesanan <b>${o.number}</b> telah selesai.${orderItemsTable(o)}Terima kasih sudah memesan di <b>${s.storeName}</b>. Kami menantikan pesanan berikutnya! 🧡`,
        })
      )
    }
  }
}

// ---------- Midtrans ----------
export async function testMidtrans() {
  if (!SERVER) return { ok: false, error: 'Mode lokal — butuh server.' }
  return apiPost('midtrans-test', {})
}

export async function getSnapToken(orderId) {
  return apiPost('snap-token', { orderId })
}

export async function verifyMidtransPayment(orderId) {
  return apiPost('midtrans-verify', { orderId })
}

// ---------- Pemulihan kata sandi ----------
export async function requestPasswordReset(email) {
  if (!SERVER) return { ok: false, error: 'Fitur ini butuh koneksi server.' }
  return apiPost('forgot-password', { email })
}

export async function resetPassword(token, password) {
  if (!SERVER) return { ok: false, error: 'Fitur ini butuh koneksi server.' }
  return apiPost('reset-password', { token, password })
}

// ---------- Sesi admin di server ----------
// Login/logout tetap divalidasi lokal (data users tersinkron dari server),
// lalu sesi PHP dibuat di server agar penulisan data admin diizinkan.
export { API_URL }

export async function serverLogin(email, password) {
  if (!SERVER) return { ok: true, local: true }
  try {
    const r = await apiPost('login', { email, password })
    if (r.ok) {
      syncBlocked = false
      flushQueue() // antrean yang sempat tertahan ikut terkirim sekarang
    } else {
      // Sesi server gagal dibuat → penulisan admin akan ditolak (403).
      // Beri tahu UI supaya admin tahu harus memeriksa diagnostik/login ulang.
      try { window.dispatchEvent(new CustomEvent('nk-session-failed', { detail: { status: r.status } })) } catch { /* abaikan */ }
    }
    return r
  } catch {
    return { ok: false, status: 0 }
  }
}

export function serverLogout() {
  if (!SERVER) return
  apiPost('logout', {}).catch(() => {})
}
