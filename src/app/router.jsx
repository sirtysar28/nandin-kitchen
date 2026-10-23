import { Routes, Route } from 'react-router-dom'
import StoreLayout from '../layouts/StoreLayout'
import AdminLayout from '../layouts/AdminLayout'

import Home from '../pages/store/Home'
import Products from '../pages/store/Products'
import ProductDetail from '../pages/store/ProductDetail'
import Cart from '../pages/store/Cart'
import Checkout from '../pages/store/Checkout'
import MyOrders from '../pages/store/MyOrders'
import About from '../pages/store/About'

import AdminLogin from '../pages/admin/AdminLogin'
import Dashboard from '../pages/admin/Dashboard'
import POS from '../pages/admin/POS'
import ProductsAdmin from '../pages/admin/ProductsAdmin'
import OrdersAdmin from '../pages/admin/OrdersAdmin'
import StockAdmin from '../pages/admin/StockAdmin'
import PurchasesAdmin from '../pages/admin/PurchasesAdmin'
import ReportsAdmin from '../pages/admin/ReportsAdmin'
import SettingsAdmin from '../pages/admin/SettingsAdmin'

export default function Router() {
  return (
    <Routes>
      {/* Website pelanggan */}
      <Route element={<StoreLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/my-orders" element={<MyOrders />} />
        <Route path="/about" element={<About />} />
      </Route>

      {/* Dashboard admin */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="pos" element={<POS />} />
        <Route path="products" element={<ProductsAdmin />} />
        <Route path="orders" element={<OrdersAdmin />} />
        <Route path="stock" element={<StockAdmin />} />
        <Route path="purchases" element={<PurchasesAdmin />} />
        <Route path="reports" element={<ReportsAdmin />} />
        <Route path="settings" element={<SettingsAdmin />} />
      </Route>
    </Routes>
  )
}
