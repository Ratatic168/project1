import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Products from './pages/Products';
import Customers from './pages/Customers';
import Warehouse2D from './pages/Warehouse2D';
import Warehouse3D from './pages/Warehouse3D';
import Journal from './pages/Journal';

const NAV = [
  { to: '/', label: 'Дашборд', end: true },
  { to: '/orders', label: 'Заказы' },
  { to: '/products', label: 'Товары' },
  { to: '/customers', label: 'Клиенты' },
  { to: '/warehouse/2d', label: 'Склад 2D' },
  { to: '/warehouse/3d', label: 'Склад 3D' },
  { to: '/journal', label: 'Журнал' },
];

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">ПВЗ <span>Склад</span></div>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/products" element={<Products />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/warehouse/2d" element={<Warehouse2D />} />
          <Route path="/warehouse/3d" element={<Warehouse3D />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
