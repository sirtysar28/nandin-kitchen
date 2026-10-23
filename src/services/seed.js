// Data awal (seed) untuk mock database — dipakai saat pertama kali aplikasi dibuka
import { orderNumber, daysAgoISO, dateKey } from '../utils/format'

const categories = [
  { id: 'cat-cake', name: 'Cake', slug: 'cake', emoji: '🎂', desc: 'Birthday cake, lapis legit, hampers kekinian' },
  { id: 'cat-brownies', name: 'Brownies', slug: 'brownies', emoji: '🍫', desc: 'Brownies lumer, panggang, dan premium' },
  { id: 'cat-cookies', name: 'Cookies', slug: 'cookies', emoji: '🍪', desc: 'Cookies renyah dan chewy' },
  { id: 'cat-pastry', name: 'Pastry', slug: 'pastry', emoji: '🥐', desc: 'Croissant, puff, dan pastry harian' },
  { id: 'cat-hampers', name: 'Hampers', slug: 'hampers', emoji: '🎁', desc: 'Parsel & hampers spesial' },
]

const products = [
  {
    id: 'p1', name: 'Nandin Signature Cake', categoryId: 'cat-cake', sku: 'NK-CAK-001',
    emoji: '🎂', photo: '', gallery: [],
    desc: 'Birthday cake andalan Nandin Kitchen: sponge cake lembut, cream cheese frosting, dan topping buah segar pilihan. Cocok untuk momen spesial keluarga.',
    cost: 120000, price: 215000, stock: 12, active: true, preorder: false, featured: true,
    sizes: [
      { name: 'Diameter 16 cm', delta: 0 },
      { name: 'Diameter 20 cm', delta: 60000 },
      { name: 'Diameter 24 cm', delta: 120000 },
    ],
    variants: [
      { name: 'Cokelat', delta: 0 },
      { name: 'Red Velvet', delta: 10000 },
      { name: 'Matcha', delta: 15000 },
    ],
  },
  {
    id: 'p2', name: 'Lapis Legit Premium', categoryId: 'cat-cake', sku: 'NK-CAK-002',
    emoji: '🍰', photo: '', gallery: [],
    desc: 'Lapis legit 18 lapis dipanggang satu per satu, tekstur padat dan wangi butter asli. Favorit hari raya.',
    cost: 150000, price: 285000, stock: 8, active: true, preorder: true, featured: true,
    sizes: [
      { name: 'Lojang 20x20', delta: 0 },
      { name: 'Lojang 25x25', delta: 90000 },
    ],
    variants: [{ name: 'Original', delta: 0 }, { name: 'Pandan', delta: 0 }, { name: 'Keju', delta: 20000 }],
  },
  {
    id: 'p3', name: 'Brownies Lumer Kacang', categoryId: 'cat-brownies', sku: 'NK-BRW-001',
    emoji: '🍫', photo: '', gallery: [],
    desc: 'Brownies kukus dengan lelehan dark chocolate dan taburan kacang mede. Disajikan hangat makin lumer.',
    cost: 38000, price: 75000, stock: 25, active: true, preorder: false, featured: true,
    sizes: [{ name: 'Kotak Small', delta: 0 }, { name: 'Kotak Large', delta: 35000 }],
    variants: [{ name: 'Original', delta: 0 }, { name: 'Extra Topping', delta: 10000 }],
  },
  {
    id: 'p4', name: 'Brownies Panggang Walnut', categoryId: 'cat-brownies', sku: 'NK-BRW-002',
    emoji: '🥮', photo: '', gallery: [],
    desc: 'Brownies panggang fudgy dengan walnut asli di setiap suapan, tepat kelezatannya.',
    cost: 45000, price: 89000, stock: 18, active: true, preorder: false, featured: false,
    sizes: [{ name: 'Kotak Small', delta: 0 }, { name: 'Kotak Large', delta: 40000 }],
    variants: [{ name: 'Original', delta: 0 }],
  },
  {
    id: 'p5', name: 'Red Velvet Cookies', categoryId: 'cat-cookies', sku: 'NK-COK-001',
    emoji: '🍪', photo: '', gallery: [],
    desc: 'Cookies red velvet lembut dengan white chocolate chips, bikin nagih satu tidak cukup.',
    cost: 22000, price: 48000, stock: 40, active: true, preorder: false, featured: true,
    sizes: [{ name: 'Isi 6', delta: 0 }, { name: 'Isi 12', delta: 42000 }],
    variants: [{ name: 'Original', delta: 0 }],
  },
  {
    id: 'p6', name: 'Choco Chip Mede', categoryId: 'cat-cookies', sku: 'NK-COK-002',
    emoji: '🥠', photo: '', gallery: [],
    desc: 'Klasik abadi: cookies buttery dengan chocolate chip dan kacang mede sangrai.',
    cost: 20000, price: 45000, stock: 35, active: true, preorder: false, featured: false,
    sizes: [{ name: 'Isi 6', delta: 0 }, { name: 'Isi 12', delta: 40000 }],
    variants: [{ name: 'Original', delta: 0 }, { name: 'Less Sugar', delta: 0 }],
  },
  {
    id: 'p7', name: 'Butter Croissant', categoryId: 'cat-pastry', sku: 'NK-PST-001',
    emoji: '🥐', photo: '', gallery: [],
    desc: 'Croissant 27 lapis dengan butter premium, renyah di luar lembut di dalam. Dipanggang setiap pagi.',
    cost: 14000, price: 28000, stock: 30, active: true, preorder: false, featured: true,
    sizes: [{ name: 'Regular', delta: 0 }, { name: 'Jumbo', delta: 12000 }],
    variants: [{ name: 'Original', delta: 0 }, { name: 'Almond Cream', delta: 8000 }],
  },
  {
    id: 'p8', name: 'Puff Pastry Ayam', categoryId: 'cat-pastry', sku: 'NK-PST-002',
    emoji: '🥟', photo: '', gallery: [],
    desc: 'Puff pastry renyah berisi ayam creamy wortel jagung, camilan sore paling pas.',
    cost: 12000, price: 25000, stock: 22, active: true, preorder: false, featured: false,
    sizes: [{ name: 'Isi 4', delta: 0 }, { name: 'Isi 8', delta: 22000 }],
    variants: [{ name: 'Original', delta: 0 }, { name: 'Pedas', delta: 0 }],
  },
  {
    id: 'p9', name: 'Hampers Lebaran Ceria', categoryId: 'cat-hampers', sku: 'NK-HMP-001',
    emoji: '🎁', photo: '', gallery: [],
    desc: 'Hampers berisi lapis legit mini, brownies, cookies, dan kartu ucapan. Tersedia kemasan eksklusif.',
    cost: 130000, price: 249000, stock: 10, active: true, preorder: true, featured: true,
    sizes: [{ name: 'Standar', delta: 0 }, { name: 'Luxury', delta: 120000 }],
    variants: [{ name: 'Kemasan Merah', delta: 0 }, { name: 'Kemasan Emas', delta: 15000 }],
  },
  {
    id: 'p10', name: 'Hampers Ulang Tahun', categoryId: 'cat-hampers', sku: 'NK-HMP-002',
    emoji: '🎈', photo: '', gallery: [],
    desc: 'Paket spesial ulang tahun: slice cake, brownies, cookies, lilin, dan balon dekorasi.',
    cost: 90000, price: 175000, stock: 15, active: true, preorder: false, featured: false,
    sizes: [{ name: 'Paket A', delta: 0 }, { name: 'Paket B', delta: 60000 }],
    variants: [{ name: 'Original', delta: 0 }],
  },
  {
    id: 'p11', name: 'Cheese Cake Blueberry', categoryId: 'cat-cake', sku: 'NK-CAK-003',
    emoji: '🧀', photo: '', gallery: [],
    desc: 'Baked cheese cake creamy dengan saus blueberry asli, dingin dan segar.',
    cost: 95000, price: 175000, stock: 9, active: true, preorder: false, featured: false,
    sizes: [{ name: 'Diameter 16 cm', delta: 0 }, { name: 'Diameter 20 cm', delta: 70000 }],
    variants: [{ name: 'Blueberry', delta: 0 }, { name: 'Strawberry', delta: 5000 }],
  },
  {
    id: 'p12', name: 'Slice Cake Assorted', categoryId: 'cat-cake', sku: 'NK-CAK-004',
    emoji: '🧁', photo: '', gallery: [],
    desc: 'Kotak isi 10 slice cake anean rasa: choco, cheese, taro, dan tiramisu.',
    cost: 60000, price: 125000, stock: 5, active: true, preorder: false, featured: true,
    sizes: [{ name: 'Isi 10', delta: 0 }, { name: 'Isi 20', delta: 110000 }],
    variants: [{ name: 'Assorted', delta: 0 }],
  },
]

const users = [
  { id: 'u-admin', name: 'Admin Nandin', email: 'admin@nandin.id', phone: '0812-0000-0001', password: 'admin123', role: 'admin', createdAt: daysAgoISO(30) },
  { id: 'u-kasir', name: 'Kasir Nandin', email: 'kasir@nandin.id', phone: '0812-0000-0002', password: 'kasir123', role: 'kasir', createdAt: daysAgoISO(30) },
]

const customers = [
  { id: 'c1', name: 'Rina Melati', email: 'rina@example.com', phone: '0812-3456-7890', createdAt: daysAgoISO(20) },
  { id: 'c2', name: 'Budi Santoso', email: 'budi@example.com', phone: '0813-2222-3333', createdAt: daysAgoISO(15) },
]

const settings = {
  storeName: 'Nandin Kitchen',
  tagline: 'Toko Kue Premium',
  heroTitle: 'Kue Segar & Manis, Dibuat dengan Cinta',
  heroSubtitle: 'Cake, brownies, cookies, pastry, dan hampers untuk setiap momen spesialmu. Pesan hari ini, siap diambil atau dikirim.',
  address: 'Jl. Contoh Raya No. 88, Jakarta Selatan',
  phone: '0812-0000-0001',
  email: 'hello@nandinkitchen.id',
  about:
    'Nandin Kitchen adalah toko kue rumahan yang tumbuh menjadi favorit keluarga. Setiap kue dibuat segar setiap hari dengan bahan premium dan takaran resep turun-temurun.',
  openHours: 'Setiap hari, 08.00 – 20.00 WIB',
  logo: '/logo-nandin.png',
  favicon: '/favicon.png',
  waNumber: '6281200000001',
  midtrans: { enabled: true, merchantId: 'G000123456', clientKey: 'SB-Mid-client-DEMO', serverKey: 'SB-Mid-server-DEMO', env: 'sandbox' },
  smtp: {
    enabled: false,
    host: 'smtp.gmail.com',
    port: 587,
    encryption: 'tls',
    username: '',
    password: '',
    fromName: 'Nandin Kitchen',
    fromEmail: 'hello@nandinkitchen.id',
    notify: { newOrder: true, payment: true, status: true },
  },
  shipping: { fee: 15000, freeMin: 300000 },
  taxPercent: 0,
  lowStockMin: 5,
}

// Riwayat pesanan contoh (7 hari terakhir) agar dashboard & laporan langsung hidup
function seedOrders() {
  const methods = ['midtrans', 'tunai', 'transfer', 'qris']
  const names = [
    ['Rina Melati', '0812-3456-7890', 'c1'],
    ['Budi Santoso', '0813-2222-3333', 'c2'],
    ['Dewi Lestari', '0814-1111-2222', null],
    ['Andi Pratama', '0815-9999-8888', null],
    ['Sari Wulandari', '0816-7777-6666', null],
  ]
  const statuses = ['selesai', 'selesai', 'selesai', 'dikirim', 'diproses', 'siap', 'selesai']
  const orders = []
  let seq = 100
  for (let d = 7; d >= 0; d--) {
    const count = 1 + ((d * 7) % 3)
    for (let k = 0; k < count; k++) {
      const [customerName, customerPhone, customerId] = names[(d + k) % names.length]
      const isKasir = k % 3 === 2
      const nItems = 1 + ((d + k) % 3)
      const items = []
      for (let i = 0; i < nItems; i++) {
        const p = products[(d * 3 + k * 2 + i) % products.length]
        const qty = 1 + ((i + k) % 2)
        const size = p.sizes[0]
        items.push({
          productId: p.id, name: p.name, emoji: p.emoji, sku: p.sku,
          size: size?.name || '', variant: '', qty, price: p.price + (size?.delta || 0), cost: p.cost, note: '',
        })
      }
      const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0)
      const deliveryType = isKasir ? null : k % 2 === 0 ? 'delivery' : 'pickup'
      const shippingFee = deliveryType === 'delivery' ? 15000 : 0
      const method = isKasir ? methods[(d + k) % methods.length] : k % 2 === 0 ? 'midtrans' : 'wa'
      const paid = d > 0 || method !== 'wa'
      const createdAt = daysAgoISO(d)
      seq++
      orders.push({
        id: 'so-' + seq,
        number: 'NK-' + dateKey(createdAt).replace(/-/g, '') + '-' + (seq % 1000),
        channel: isKasir ? 'kasir' : 'online',
        customerId, customerName, customerPhone,
        items, subtotal, discount: 0, taxPercent: 0, tax: 0, shippingFee,
        total: subtotal + shippingFee,
        delivery: isKasir
          ? { type: 'langsung' }
          : deliveryType === 'delivery'
          ? { type: 'delivery', address: 'Jl. Mawar No. ' + (seq % 50), city: 'Jakarta Selatan', postal: '12' + (seq % 900 + 100), date: dateKey(createdAt), time: '15:00' }
          : { type: 'pickup', date: dateKey(createdAt), time: '11:00' },
        payment: { method, status: paid ? 'paid' : 'unpaid', paidAt: paid ? createdAt : null },
        status: d === 0 && !isKasir ? (k % 2 === 0 ? 'menunggu' : 'diproses') : statuses[(d + k) % statuses.length],
        note: '', stockApplied: true,
        createdAt,
      })
    }
  }
  return orders
}

const purchases = [
  {
    id: 'pu1', supplier: 'Toko Bahan Kue Maju', date: dateKey(daysAgoISO(6)),
    items: [
      { productId: 'p1', name: 'Nandin Signature Cake', qty: 10, cost: 120000 },
      { productId: 'p5', name: 'Red Velvet Cookies', qty: 20, cost: 22000 },
    ],
    total: 10 * 120000 + 20 * 22000, note: 'Restock mingguan', createdAt: daysAgoISO(6),
  },
  {
    id: 'pu2', supplier: 'Supplier Butter Nusantara', date: dateKey(daysAgoISO(3)),
    items: [{ productId: 'p7', name: 'Butter Croissant', qty: 30, cost: 14000 }],
    total: 30 * 14000, note: '', createdAt: daysAgoISO(3),
  },
]

const expenses = [
  { id: 'ex1', title: 'Gas & listrik toko', category: 'Operasional', amount: 350000, date: dateKey(daysAgoISO(5)), createdAt: daysAgoISO(5) },
  { id: 'ex2', title: 'Kemasan & dus kue', category: 'Packing', amount: 275000, date: dateKey(daysAgoISO(2)), createdAt: daysAgoISO(2) },
]

const stockMoves = [
  { id: 'sm1', productId: 'p1', name: 'Nandin Signature Cake', type: 'in', qty: 10, note: 'Pembelian Toko Bahan Kue Maju', ref: 'pu1', createdAt: daysAgoISO(6) },
  { id: 'sm2', productId: 'p5', name: 'Red Velvet Cookies', type: 'in', qty: 20, note: 'Pembelian Toko Bahan Kue Maju', ref: 'pu1', createdAt: daysAgoISO(6) },
  { id: 'sm3', productId: 'p7', name: 'Butter Croissant', type: 'in', qty: 30, note: 'Pembelian Supplier Butter Nusantara', ref: 'pu2', createdAt: daysAgoISO(3) },
]

export function seed() {
  return {
    categories,
    products,
    users,
    customers,
    orders: seedOrders(),
    purchases,
    expenses,
    stockMoves,
    emails: [],
    settings,
    seq: { order: 200 },
  }
}

// Default konfigurasi SMTP (dipakai juga untuk migrasi data lama)
export const SMTP_DEFAULT = settings.smtp
