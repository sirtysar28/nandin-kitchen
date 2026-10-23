// Pembuat pesan WhatsApp Click-to-Chat

// Nomor WA bawaan dari data awal (seed) — dipakai untuk mendeteksi nomor
// yang belum pernah diubah admin. Jika mengubah default di seed.js,
// sesuaikan juga nilai ini.
const WA_DEFAULT = '6281200000001'

// Normalkan nomor apa pun (0812…, +62…, 62…) menjadi format wa.me (62xxx)
export const toWaDigits = (num) => {
  let d = String(num || '').replace(/\D/g, '')
  if (d.startsWith('0')) d = '62' + d.slice(1)
  return d
}

// SATU sumber nomor WhatsApp untuk seluruh aplikasi (ikon floating, halaman
// Tentang, Checkout, Pesanan Saya, konfirmasi admin).
// Prioritas: waNumber yang sudah diubah → phone yang sudah diubah → sisanya.
// Dengan begitu admin cukup mengubah salah satu nomor (Kontak atau WhatsApp)
// dan SEMUA tombol WA ikut berubah.
export const waTarget = (settings = {}) => {
  const wa = toWaDigits(settings.waNumber)
  const phone = toWaDigits(settings.phone)
  if (wa && wa !== WA_DEFAULT) return wa
  if (phone && phone !== WA_DEFAULT) return phone
  return wa || phone
}

export function buildOrderMessage(order, settings) {
  const L = []
  L.push(`*PESANAN BARU — ${settings.storeName || 'Nandin Kitchen'}*`)
  L.push(`No. Pesanan: *${order.number}*`)
  L.push('')
  L.push('*Rincian Pesanan:*')
  order.items.forEach((it, i) => {
    const varian = [it.size, it.variant].filter(Boolean).join(' · ')
    L.push(
      `${i + 1}. ${it.name}${varian ? ` (${varian})` : ''} x${it.qty} — Rp${(
        it.price * it.qty
      ).toLocaleString('id-ID')}`
    )
    if (it.note) L.push(`   Catatan: ${it.note}`)
  })
  L.push('')
  if (order.discount > 0) L.push(`Diskon: -Rp${order.discount.toLocaleString('id-ID')}`)
  if (order.tax > 0) L.push(`Pajak (${order.taxPercent}%): Rp${order.tax.toLocaleString('id-ID')}`)
  if (order.shippingFee > 0) L.push(`Ongkir: Rp${order.shippingFee.toLocaleString('id-ID')}`)
  L.push(`*TOTAL: Rp${order.total.toLocaleString('id-ID')}*`)
  L.push(`Metode: ${order.payment.method === 'wa' ? 'Konfirmasi via WhatsApp' : 'Midtrans (online)'}`)
  L.push('')
  L.push('*Data Pemesan:*')
  L.push(`Nama: ${order.customerName}`)
  L.push(`Telp: ${order.customerPhone}`)
  if (order.delivery.type === 'pickup') {
    L.push(`Pengambilan: ${order.delivery.date}${order.delivery.time ? ' pukul ' + order.delivery.time : ''}`)
  } else {
    L.push(`Pengiriman: ${order.delivery.date}${order.delivery.time ? ' pukul ' + order.delivery.time : ''}`)
    L.push(`Alamat: ${order.delivery.address}, ${order.delivery.city} ${order.delivery.postal || ''}`)
  }
  if (order.note) L.push(`Catatan: ${order.note}`)
  L.push('')
  L.push('Mohon konfirmasi pesanan saya. Terima kasih 🙏')
  return L.join('\n')
}

export const waLink = (number, text) =>
  `https://wa.me/${toWaDigits(number)}?text=${encodeURIComponent(text)}`
