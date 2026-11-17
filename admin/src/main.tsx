import { StrictMode, useEffect, useState, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { api, setUnauthorizedHandler } from './lib/api';
import { Router, useRouter, match } from './lib/router';
import { Shell, MeCtx, type Me } from './components/Shell';
import { ToastProvider, Spinner, Empty } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import NewOrder from './pages/NewOrder';
import Products from './pages/Products';
import ProductEdit from './pages/ProductEdit';
import Categories from './pages/Categories';
import Inventory from './pages/Inventory';
import Coupons from './pages/Coupons';
import FlashSales from './pages/FlashSales';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Reviews from './pages/Reviews';
import Abandoned from './pages/Abandoned';
import Reports from './pages/Reports';
import Staff from './pages/Staff';
import Settings from './pages/Settings';
import Account from './pages/Account';

const ROUTES: [string, (p: Record<string, string>) => ReactElement, ('manager' | 'owner')?][] = [
  ['/', () => <Dashboard />],
  ['/orders', () => <Orders />],
  ['/orders/new', () => <NewOrder />],
  ['/orders/:id', (p) => <OrderDetail id={p.id} />],
  ['/abandoned', () => <Abandoned />],
  ['/products', () => <Products />],
  ['/products/new', () => <ProductEdit id={null} />, 'manager'],
  ['/products/:id', (p) => <ProductEdit id={p.id} />],
  ['/categories', () => <Categories />],
  ['/inventory', () => <Inventory />],
  ['/flash-sales', () => <FlashSales />],
  ['/coupons', () => <Coupons />],
  ['/customers', () => <Customers />],
  ['/customers/:id', (p) => <CustomerDetail id={p.id} />],
  ['/reviews', () => <Reviews />],
  ['/reports', () => <Reports />, 'manager'],
  ['/settings', () => <Settings />, 'manager'],
  ['/staff', () => <Staff />, 'owner'],
  ['/account', () => <Account />],
];

function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const { loc } = useRouter();
  const load = () => api<Me>('/auth/me').then(setMe).catch(() => setMe(null));
  useEffect(() => { setUnauthorizedHandler(() => setMe(null)); load(); }, []);
  if (me === undefined) return <Spinner />;
  if (me === null) return <Login onDone={load} />;
  const logout = async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); setMe(null); };
  let page: ReactElement = <Empty text="Page not found." />;
  for (const [pattern, render, min] of ROUTES) {
    const params = match(pattern, loc.path);
    if (!params) continue;
    const ok = !min || (min === 'manager' ? me.user.role !== 'staff' : me.user.role === 'owner');
    page = ok ? render(params) : <Empty text="You do not have access to this page." />;
    break;
  }
  return (
    <MeCtx.Provider value={me}>
      <Shell me={me} onLogout={logout}>{page}</Shell>
    </MeCtx.Provider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router><ToastProvider><App /></ToastProvider></Router>
  </StrictMode>,
);
