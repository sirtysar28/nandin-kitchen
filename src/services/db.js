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
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
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
  if (!SERVER || !serverOk || suppressCheck(op)) return
  queue.push(op)
  saveQueue()
  flushQueue()
}

function suppressCheck(op) {
  if (!compositeGuard) return false
  return op.col === 'orders' || op.col === 'products' || op.col === 'stockMoves'
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
    const json = await res.json().catch(() => ({ ok: false }))
    return { ...json, ok: res.ok && json.ok !== false, status: res.status }
  } catch {
    return { ok: false, status: 0 }
  }
}

async function apiGet(action) {
  try {
    const res = await fetch(`${API_URL}?action=${action}`, { credentials: 'same-origin' })
    if (!res.ok) return null
    return await res.json()
  } catch {
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
  if (!SERVER || !serverOk || syncing || !queue.length) return
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
    if (document.hidden || queue.length || syncing) return
    const v = await apiGet('version')
    if (!v || !v.ok || v.n === 0) return
    if (v.version === lastVersion) return
    const boot = await apiGet('bootstrap')
    if (boot && boot.ok && !boot.empty) hydrate(boot)
  }
  pollTimer = setInterval(tick, POLL_MS)
  document.addEventListener('visibilitychange', tick)
}

// Dipanggil sekali sebelum aplikasi dirender (lihat main.jsx).
// Tidak pernah gagal: bila server tidak terjangkau, aplikasi tetap
// berjalan dengan data lokal dan antrian tersimpan untuk dikirim nanti.
export async function initDB() {
  read()
  if (!SERVER) return
  loadQueue()
  let boot = await withTimeout(apiGet('bootstrap'), BOOT_TIMEOUT)
  if (!boot || !boot.ok) { serverOk = false; return }
  serverOk = true
  if (boot.empty) {
    // Database masih kosong → migrasi otomatis: kirim data lokal (termasuk
    // data yang sudah pernah diinput di browser ini) ke server.
    const payload = importPayload(read())
    const r = await withTimeout(apiPost('import', payload), BOOT_TIMEOUT)
    if (!r.ok) { serverOk = false; return }
    boot = await withTimeout(apiGet('bootstrap'), BOOT_TIMEOUT)
    if (boot && boot.ok) hydrate(boot)
  } else {
    if (queue.length) {
      // Ada tulisan tertunda dari sesi offline sebelumnya — kirim dulu
      // supaya tidak tertimpa data server, lalu ambil kondisi terbaru.
      await flushQueue()
      if (queue.length) return // masih gagal kirim — tetap pakai data lokal
      const b2 = await apiGet('bootstrap')
      if (b2 && b2.ok) hydrate(b2)
    } else {
      hydrate(boot)
    }
  }
  flushQueue()
  reserveSeq()
  startPolling()
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

// ---------- Notifikasi email (SMTP) ----------
// Pada mode lokal, email dicatat ke log outbox. Saat server aktif, log tetap
// tersimpan di database sehingga bisa dipantau dari perangkat mana pun.
export function queueEmail(to, subject, body) {
  const s = db.settings()
  if (!s.smtp?.enabled || !to) return null
  return db.insert('emails', {
    to, subject, body,
    from: `${s.smtp.fromName} <${s.smtp.fromEmail}>`,
    status: 'terkirim (simulasi)',
  })
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

  // Notifikasi email: pesanan baru diterima
  const st = c.settings
  if (st.smtp?.enabled && st.smtp.notify?.newOrder) {
    queueEmail(
      payload.customerEmail || st.email,
      `Pesanan ${order.number} telah diterima 🧁`,
      `Halo ${order.customerName}, pesanan ${order.number} senilai Rp${order.total.toLocaleString('id-ID')} sudah kami terima dan sedang menunggu pemrosesan.`
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
  // Notifikasi email: pembayaran terverifikasi
  const s = db.settings()
  if (s.smtp?.enabled && s.smtp.notify?.payment) {
    queueEmail(
      o.customerEmail || s.email,
      `Pembayaran ${o.number} terverifikasi ✅`,
      `Pembayaran pesanan ${o.number} telah kami terima. Pesanan sedang diproses.`
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
  // Notifikasi email: pesanan selesai
  if (status === 'selesai') {
    const s = db.settings()
    if (s.smtp?.enabled && s.smtp.notify?.status) {
      queueEmail(
        o.customerEmail || s.email,
        `Pesanan ${o.number} selesai 🎉`,
        `Terima kasih! Pesanan ${o.number} telah selesai. Kami menunggu pesanan berikutnya.`
      )
    }
  }
}

// ---------- Sesi admin di server ----------
// Login/logout tetap divalidasi lokal (data users tersinkron dari server),
// lalu sesi PHP dibuat di server agar penulisan data admin diizinkan.
export { API_URL }

export async function serverLogin(email, password) {
  if (!SERVER) return
  try {
    const r = await apiPost('login', { email, password })
    if (r.ok) {
      syncBlocked = false
      flushQueue() // antrean yang sempat tertahan ikut terkirim sekarang
    }
  } catch { /* abaikan */ }
}

export function serverLogout() {
  if (!SERVER) return
  apiPost('logout', {}).catch(() => {})
}
