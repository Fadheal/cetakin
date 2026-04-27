import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Printer, 
  Package, 
  Truck, 
  CheckCircle, 
  Search, 
  LogOut, 
  Clock, 
  Phone, 
  MapPin, 
  FileText,
  ExternalLink,
  ChevronRight,
  MoreVertical,
  Trash2,
  Filter,
  RefreshCw
} from 'lucide-react';
import { signOut, useSession, updatePassword } from '../lib/auth-client';
import { cn } from '../lib/utils';

interface OrderDetail {
  id: string;
  name: string;
  phone: string;
  address: string;
  deliveryTime: string;
  status: 'pending' | 'printing' | 'delivered';
  createdAt: string;
  settings: {
    mode: string;
    color: string;
    sidedness: string;
    copies: number;
    quality?: string;
    paperType?: string;
    paperWeight?: string;
    cutting?: string;
    layout?: string;
    orientation?: 'portrait' | 'landscape';
    binding?: string;
    notes?: string;
  };
  files: {
    id: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    pages: number;
  }[];
}

export default function AdminDashboard() {
  const { data: session } = useSession();
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'printing' | 'delivered'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);

  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (session?.user?.shouldChangePassword) {
      setShowPasswordModal(true);
    }
  }, [session]);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    
    if (newPassword.length < 6) {
      setPasswordError('Password minimal 6 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Password tidak cocok');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await updatePassword(newPassword);
      if (res.ok) {
        setShowPasswordModal(false);
        alert('Password berhasil diperbarui. Silakan gunakan password baru untuk login berikutnya.');
      } else {
        const data = await res.json();
        setPasswordError(data.error || 'Gagal memperbarui password');
      }
    } catch (err) {
      setPasswordError('Terjadi kesalahan jaringan');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const fetchOrders = async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    try {
      const response = await fetch('/api/admin/orders');
      const data = await response.json();
      if (response.ok) {
        setOrders(data);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchOrders(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        setOrders(orders.map(o => o.id === id ? { ...o, status: newStatus as any } : o));
        if (selectedOrder?.id === id) {
          setSelectedOrder({ ...selectedOrder, status: newStatus as any });
        }
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const deleteOrder = async (id: string) => {
    if (!confirm('Yakin ingin menghapus pesanan ini?')) return;
    try {
      const response = await fetch(`/api/admin/orders/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setOrders(orders.filter(o => o.id !== id));
        if (selectedOrder?.id === id) setSelectedOrder(null);
      }
    } catch (err) {
      console.error('Failed to delete order:', err);
    }
  };

  const handlePrint = (fileUrl: string, order: OrderDetail) => {
    const proxyUrl = `/api/admin/files/proxy?url=${encodeURIComponent(fileUrl)}`;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('Pop-up terblokir! Silakan izinkan pop-up untuk mencetak.');

    const settings = order.settings;
    const isPDF = fileUrl.toLowerCase().includes('.pdf');
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl);

    // CSS for print settings
    const printStyles = `
      @page {
        size: ${settings.orientation || 'portrait'};
        margin: 0;
      }
      body {
        margin: 0;
        padding: 0;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        ${settings.color === 'bw' ? 'filter: grayscale(100%);' : ''}
      }
      img, embed, iframe {
        max-width: 100%;
        height: auto;
      }
      @media print {
        .no-print { display: none; }
      }
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>CetakIn - ${order.name}</title>
          <style>${printStyles}</style>
        </head>
        <body>
          ${isPDF 
            ? `<iframe id="print-frame" src="${proxyUrl}" style="width:100%;height:100vh;border:none;"></iframe>` 
            : `<img src="${proxyUrl}" onload="window.print();" />`
          }
          <script>
            if (${isPDF}) {
              const frame = document.getElementById('print-frame');
              frame.onload = () => {
                setTimeout(() => {
                  try {
                    frame.contentWindow.print();
                  } catch (e) {
                    window.print();
                  }
                }, 1000);
              };
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const calculatePrice = (order: OrderDetail) => {
    const totalPagesOfOneSet = order.files.reduce((acc, f) => acc + f.pages, 0);
    const copies = order.settings?.copies || 1;
    const totalPages = totalPagesOfOneSet * copies;
    
    // Sheets calculation
    const sheetsOfOneSet = order.settings?.sidedness === 'double' ? Math.ceil(totalPagesOfOneSet / 2) : totalPagesOfOneSet;
    const totalSheets = sheetsOfOneSet * copies;

    // 1. Color cost: per page
    const pagePrice = order.settings?.color === 'bw' ? 500 : 1000;
    const pageCost = totalPages * pagePrice;
    
    // 2. Paper weight and sidedness cost: per sheet
    const sidednessAddition = order.settings?.sidedness === 'double' ? 500 : 0;
    const paperAddition = (order.settings?.paperWeight === '80gsm' || order.settings?.paperWeight === '100gsm') ? 500 : 0;
    const sheetAddition = sidednessAddition + paperAddition;
    const sheetCost = totalSheets * sheetAddition;

    // 3. Finishing cost: per order
    let finishingCost = 0;
    if (order.settings?.binding === 'ring') finishingCost = 5000;
    else if (order.settings?.binding === 'softbound') finishingCost = 1000;
    
    return pageCost + sheetCost + finishingCost;
  };

  const filteredOrders = orders.filter(o => {
    const matchesFilter = filter === 'all' || o.status === filter;
    const matchesSearch = o.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          o.address.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    printing: orders.filter(o => o.status === 'printing').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="p-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#1d4ed8] rounded-xl flex items-center justify-center text-white shadow-lg">
              <Printer size={24} />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Cetak<span className="text-[#1d4ed8]">In</span>
            </h1>
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400 mt-4 ml-1">Admin Panel</p>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <button 
            onClick={() => setFilter('all')}
            className={cn(
              "w-full flex items-center justify-between p-4 rounded-xl transition-all font-bold text-sm",
              filter === 'all' ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <div className="flex items-center gap-3">
              <Package size={18} /> Antrean Pesanan
            </div>
            {stats.total > 0 && <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs">{stats.total}</span>}
          </button>
          
          <div className="pt-4 px-2">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Filter Status</h3>
            <div className="space-y-1">
              {[
                { key: 'pending', label: 'Pending', icon: Clock, color: 'text-amber-500' },
                { key: 'printing', label: 'Printing', icon: RefreshCw, color: 'text-blue-500' },
                { key: 'delivered', label: 'Delivered', icon: CheckCircle, color: 'text-green-500' },
              ].map((s) => (
                <button 
                  key={s.key}
                  onClick={() => setFilter(s.key as any)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-xl transition-all font-semibold text-sm",
                    filter === s.key ? "bg-slate-50 text-slate-900 shadow-sm" : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <s.icon size={16} className={s.color} /> {s.label}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </nav>

        <div className="p-6 border-t border-slate-100">
          <button 
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 p-3 text-red-500 font-bold text-sm hover:bg-red-50 rounded-xl transition-all"
          >
            <LogOut size={18} /> Keluar
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-8 overflow-y-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {filter === 'all' ? 'Semua Pesanan' : `Pesanan ${filter.charAt(0).toUpperCase() + filter.slice(1)}`}
            </h2>
            <p className="text-slate-500 font-medium mt-1">Dashboard pengelolaan percetakan sekolah</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Cari nama atau kelas..."
                className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#1d4ed8]/20 focus:border-[#1d4ed8] transition-all font-medium text-sm w-64 shadow-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={fetchOrders}
              className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
            >
              <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          {[
            { label: 'Total', value: stats.total, icon: Package, color: 'bg-white text-slate-600' },
            { label: 'Pending', value: stats.pending, icon: Clock, color: 'bg-amber-50 text-amber-600 border border-amber-100' },
            { label: 'Printing', value: stats.printing, icon: Printer, color: 'bg-blue-50 text-blue-600 border border-blue-100' },
            { label: 'Done', value: stats.delivered, icon: CheckCircle, color: 'bg-green-50 text-green-600 border border-green-100' },
          ].map((stat, i) => (
            <div key={i} className={cn("p-6 rounded-3xl flex items-center justify-between shadow-sm shadow-slate-200", stat.color)}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">{stat.label}</p>
                <p className="text-3xl font-black">{stat.value}</p>
              </div>
              <div className="p-3 bg-white/50 rounded-2xl">
                <stat.icon size={24} />
              </div>
            </div>
          ))}
        </div>

        {/* Orders Table/List */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pemesan</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Waktu Antar</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Halaman</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Bayar</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading && filteredOrders.length === 0 ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-6 py-8"><div className="h-12 bg-slate-100 animate-pulse rounded-xl"></div></td>
                    </tr>
                  ))
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <div className="max-w-xs mx-auto space-y-2">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
                          <Package size={24} />
                        </div>
                        <p className="font-bold text-slate-400">Tidak ada pesanan ditemukan</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr 
                      key={order.id} 
                      className={cn(
                        "group hover:bg-slate-50 transition-colors cursor-pointer",
                        selectedOrder?.id === order.id ? "bg-[#1d4ed8]/5" : ""
                      )}
                      onClick={() => setSelectedOrder(order)}
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-sm",
                            order.status === 'pending' ? 'bg-amber-500' : order.status === 'printing' ? 'bg-blue-500' : 'bg-green-500'
                          )}>
                            {order.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 capitalize">{order.name}</p>
                            <p className="text-xs text-slate-400 flex items-center gap-1 font-medium">
                              <MapPin size={10} /> {order.address}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-[11px] font-bold text-slate-600">
                          <Clock size={12} /> {order.deliveryTime}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-sm font-bold text-slate-700">
                          {order.files.reduce((acc, curr) => acc + curr.pages, 0) * (order.settings?.copies || 1)} Hal
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {order.files.length} File • x{order.settings?.copies || 1} Salinan
                        </p>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-sm font-bold text-[#1d4ed8]">
                          Rp {calculatePrice(order).toLocaleString('id-ID')}
                        </p>
                      </td>
                      <td className="px-6 py-5">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider",
                          order.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          order.status === 'printing' ? 'bg-blue-100 text-blue-700' :
                          'bg-green-100 text-green-700'
                        )}>
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            order.status === 'pending' ? 'bg-amber-500' :
                            order.status === 'printing' ? 'bg-blue-500' :
                            'bg-green-500'
                          )}></span>
                          {order.status}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => { e.stopPropagation(); deleteOrder(order.id); }}
                            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                            <ChevronRight size={18} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Detail Sliding Panel */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-[500px] bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200"
          >
            <div className="p-8 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-10">
              <div className="flex-1">
                <p className="text-[10px] font-black text-[#1d4ed8] uppercase tracking-widest mb-1">Total: Rp {calculatePrice(selectedOrder).toLocaleString('id-ID')}</p>
                <h3 className="text-xl font-black text-slate-900 line-clamp-1">{selectedOrder.name}</h3>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-all"
              >
                <MoreVertical size={20} className="rotate-90" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-10">
              {/* Profile Card */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Phone size={10} /> WhatsApp</p>
                    <a href={`https://wa.me/${selectedOrder.phone.replace(/[^0-9]/g, '')}`} target="_blank" className="text-sm font-bold text-slate-800 hover:text-[#1d4ed8] transition-colors">{selectedOrder.phone}</a>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 justify-end"><Clock size={10} /> Waktu Antar</p>
                    <p className="text-sm font-bold text-slate-800">{selectedOrder.deliveryTime}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><MapPin size={10} /> Lokasi Antar</p>
                  <p className="text-sm font-bold text-slate-800">{selectedOrder.address}</p>
                </div>
              </div>

              {/* Status Stepper */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Update Progres</h4>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'pending', label: 'Antrean', icon: Clock, color: 'hover:bg-amber-50 hover:text-amber-600 transition-all border border-amber-100' },
                    { key: 'printing', label: 'Proses', icon: Printer, color: 'hover:bg-blue-50 hover:text-blue-600 transition-all border border-blue-100' },
                    { key: 'delivered', label: 'Selesai', icon: CheckCircle, color: 'hover:bg-green-50 hover:text-green-600 transition-all border border-green-100' },
                  ].map((s) => (
                    <button
                      key={s.key}
                      onClick={() => updateStatus(selectedOrder.id, s.key)}
                      className={cn(
                        "flex flex-col items-center gap-2 py-4 rounded-2xl font-bold text-xs border transition-all",
                        selectedOrder.status === s.key 
                          ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200" 
                          : "bg-white text-slate-500 border-slate-100 hover:scale-105"
                      )}
                    >
                      <s.icon size={18} />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Settings Table */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Konfigurasi Print</h4>
                  <div className="px-2 py-0.5 bg-[#1d4ed8]/10 text-[#1d4ed8] text-[9px] font-black uppercase rounded">
                    {selectedOrder.settings?.mode || 'Manual'} Mode
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Warna', value: selectedOrder.settings?.color === 'bw' ? 'Hitam Putih' : 'Berwarna' },
                    { label: 'Sisi', value: selectedOrder.settings?.sidedness === 'single' ? 'Satu Sisi' : 'Bolak Balik' },
                    { label: 'Salinan', value: `${selectedOrder.settings?.copies || 1} Rangkap` },
                    { label: 'Kertas', value: selectedOrder.settings?.paperType || 'Standard' },
                    { label: 'Gramatur', value: selectedOrder.settings?.paperWeight || '70gsm' },
                    { label: 'Layout', value: selectedOrder.settings?.layout || '1-up' },
                    { label: 'Orientasi', value: selectedOrder.settings?.orientation || 'portrait' },
                    { label: 'Potongan', value: selectedOrder.settings?.cutting === 'none' ? 'Tidak Ada' : selectedOrder.settings?.cutting },
                    { label: 'Jilid', value: selectedOrder.settings?.binding === 'none' ? 'Tidak Ada' : selectedOrder.settings?.binding },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-xs text-slate-400 font-medium">{item.label}</span>
                      <span className="text-sm font-bold text-slate-700 capitalize">{item.value as string}</span>
                    </div>
                  ))}
                </div>
                {selectedOrder.settings?.notes && (
                  <div className="mt-4 p-4 bg-orange-50 rounded-2xl border border-orange-100">
                    <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Filter size={10} /> Catatan Khusus</p>
                    <p className="text-sm font-bold text-orange-900 italic">"{selectedOrder.settings.notes}"</p>
                  </div>
                )}
              </div>

              {/* Files List with Quick Print */}
              <div className="space-y-4 pb-12">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Berkas Dokumen ({selectedOrder.files.length})</h4>
                <div className="space-y-3">
                  {selectedOrder.files.map((file) => (
                    <div key={file.id} className="flex flex-col gap-3 p-5 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-[#1d4ed8]/10 text-[#1d4ed8] rounded-2xl flex items-center justify-center">
                            <FileText size={24} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 line-clamp-1">{file.originalName}</p>
                            <p className="text-[11px] text-slate-400 font-medium">{(file.size / 1024 / 1024).toFixed(2)} MB • {file.pages} Halaman</p>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <a 
                          href={`/api/admin/files/proxy?url=${encodeURIComponent(file.filename)}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm transition-all hover:bg-slate-200"
                        >
                          <ExternalLink size={16} /> Open File
                        </a>
                        <button 
                          onClick={() => handlePrint(file.filename, selectedOrder)}
                          className="flex items-center justify-center gap-2 py-3 bg-[#1d4ed8] text-white rounded-xl font-bold text-sm shadow-lg shadow-[#1d4ed8]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                          <Printer size={16} /> Print ({file.pages * (selectedOrder.settings?.copies || 1)} hal)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay */}
      {selectedOrder && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-40 transition-opacity"
          onClick={() => setSelectedOrder(null)}
        />
      )}
      {/* Password Change Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6"
            >
              <div className="space-y-2 text-center">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <RefreshCw size={32} />
                </div>
                <h3 className="text-2xl font-black text-slate-900">Ganti Password</h3>
                <p className="text-slate-500 font-medium text-sm">
                  Anda masih menggunakan password bawaan. Demi keamanan, silakan ganti password Anda terlebih dahulu.
                </p>
              </div>

              <form onSubmit={handlePasswordUpdate} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Password Baru</label>
                  <input 
                    type="password"
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-bold"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Konfirmasi Password</label>
                  <input 
                    type="password"
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-bold"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                </div>

                {passwordError && (
                  <p className="text-xs font-bold text-red-500 bg-red-50 p-3 rounded-lg flex items-center gap-2">
                    {passwordError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdatingPassword ? 'Memperbarui...' : 'Simpan Password Baru'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
