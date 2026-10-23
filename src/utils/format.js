// Utilitas format & helper umum

export const rupiah = (n) =>
  'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID')

export const angka = (n) => (Number(n) || 0).toLocaleString('id-ID')

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

const pad = (n, l = 2) => String(n).padStart(l, '0')

export const dateKey = (iso) => new Date(iso).toISOString().slice(0, 10)

export const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const orderNumber = () => {
  const d = new Date()
  const rand = Math.floor(100 + Math.random() * 900)
  return `NK-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${rand}`
}

export const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

export const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export const daysAgoISO = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(10 + (n % 8), 15, 0, 0)
  return d.toISOString()
}

export const inRange = (iso, start, end) => {
  const k = dateKey(iso)
  return (!start || k >= start) && (!end || k <= end)
}

export function downloadCSV(filename, rows) {
  if (!rows.length) return
  const heads = Object.keys(rows[0])
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [
    heads.join(','),
    ...rows.map((r) => heads.map((h) => esc(r[h])).join(',')),
  ].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export const genCaptcha = (len = 5) => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export const STATUS_ORDER = ['menunggu', 'diproses', 'siap', 'dikirim', 'selesai']
export const STATUS_LABEL = {
  menunggu: 'Menunggu Konfirmasi',
  diproses: 'Diproses',
  siap: 'Siap Diambil',
  dikirim: 'Sedang Dikirim',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
}
export const STATUS_COLOR = {
  menunggu: 'warn',
  diproses: 'info',
  siap: 'ok',
  dikirim: 'info',
  selesai: 'ok2',
  dibatalkan: 'err',
}
export const PAY_LABEL = {
  wa: 'WhatsApp (konfirmasi admin)',
  midtrans: 'Midtrans (online)',
  tunai: 'Tunai',
  transfer: 'Transfer',
  qris: 'QRIS',
}
