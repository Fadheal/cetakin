import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import OrderForm from './pages/OrderForm';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import OrderStatus from './pages/OrderStatus';
import { useSession } from './lib/auth-client';

function App() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-[#1d4ed8] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OrderForm />} />
        <Route path="/order-status/:id" element={<OrderStatus />} />
        <Route path="/admin" element={session ? <AdminDashboard /> : <Navigate to="/admin/login" />} />
        <Route path="/admin/login" element={!session ? <AdminLogin /> : <Navigate to="/admin" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
