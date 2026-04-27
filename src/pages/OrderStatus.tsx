import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Printer, 
  Clock, 
  CheckCircle2, 
  MapPin, 
  ChevronLeft,
  FileText,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';

interface OrderStatusData {
  id: string;
  name: string;
  address: string;
  status: 'pending' | 'printing' | 'delivered';
  createdAt: string;
  deliveryTime: string;
}

export default function OrderStatus() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    if (!id) return;
    try {
      const response = await fetch(`/api/orders/${id}`);
      if (!response.ok) {
        throw new Error('Pesanan tidak ditemukan');
      }
      const data = await response.json();
      setOrder(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Auto refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8 font-sans">
        <div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8 font-sans">
        <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-xl max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900">Wah, Gawat!</h2>
            <p className="text-slate-500 font-medium">{error || 'Pesanan tidak ditemukan'}</p>
          </div>
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 bg-brand-blue text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-brand-blue/20 hover:scale-105 transition-all"
          >
            <ChevronLeft size={20} /> Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  const steps = [
    { key: 'pending', label: 'Menunggu Antrean', icon: Clock, desc: 'Pesananmu sudah masuk dan menunggu giliran cetak.' },
    { key: 'printing', label: 'Sedang Dicetak', icon: Printer, desc: 'Dokumenmu sedang dalam proses pencetakan oleh admin.' },
    { key: 'delivered', label: 'Selesai / Terkirim', icon: CheckCircle2, desc: 'Dokumen sudah selesai dan akan segera diantar ke kelasmu.' },
  ];

  const currentIdx = steps.findIndex(s => s.key === order.status);

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-500 font-bold hover:text-brand-blue transition-colors">
            <ChevronLeft size={20} /> Beranda
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-blue rounded-lg flex items-center justify-center text-white">
              <Printer size={18} />
            </div>
            <h1 className="text-xl font-black text-slate-900">Cetak<span className="text-brand-blue">In</span></h1>
          </div>
        </header>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden"
        >
          <div className="p-8 border-b border-slate-100 bg-brand-blue/5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <p className="text-[10px] font-black text-brand-blue uppercase tracking-widest mb-1">Status Pesanan</p>
                <h2 className="text-2xl font-black text-slate-900">{order.name}</h2>
              </div>
              <div className="px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm font-mono text-xs text-slate-400">
                ID: {order.id.split('-')[0].toUpperCase()}...
              </div>
            </div>
          </div>

          <div className="p-8 space-y-12">
            {/* Delivery Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <MapPin size={12} /> Lokasi Antar
                </p>
                <p className="font-bold text-slate-800">{order.address}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Clock size={12} /> Estimasi Tiba
                </p>
                <p className="font-bold text-slate-800">{order.deliveryTime}</p>
              </div>
            </div>

            {/* Stepper */}
            <div className="space-y-8">
              {steps.map((step, idx) => {
                const isCompleted = idx < currentIdx;
                const isCurrent = idx === currentIdx;
                const isFuture = idx > currentIdx;

                return (
                  <div key={step.key} className="relative flex gap-6 group">
                    {idx !== steps.length - 1 && (
                      <div className={cn(
                        "absolute left-[19px] top-10 w-0.5 h-12 transition-colors",
                        isCompleted ? "bg-brand-blue" : "bg-slate-100"
                      )}></div>
                    )}
                    
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 transition-all",
                      isCompleted ? "bg-brand-blue text-white" : 
                      isCurrent ? "bg-brand-blue text-white ring-4 ring-brand-blue/10 scale-110" : 
                      "bg-slate-100 text-slate-300"
                    )}>
                      {isCompleted ? <CheckCircle2 size={24} /> : <step.icon size={20} />}
                    </div>

                    <div className="space-y-1 pb-8">
                      <h3 className={cn(
                        "font-black text-sm",
                        isFuture ? "text-slate-300" : "text-slate-900"
                      )}>{step.label}</h3>
                      <p className={cn(
                        "text-xs font-medium leading-relaxed",
                        isFuture ? "text-slate-200" : "text-slate-500"
                      )}>{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Butuh Bantuan?</p>
              <p className="text-xs font-bold text-slate-600">Hubungi Admin via WhatsApp jika ada kendala.</p>
            </div>
            <button className="bg-green-500 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-green-600 transition-all shadow-lg shadow-green-500/20 text-sm" onclick={() => window.open('https://wa.link/i1skuk', '_blank')}>
              Chat Admin
            </button>
          </div>
        </motion.div>

        <p className="text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest">
          CetakIn &copy; 2024 • Solusi Print Praktis Ke Kelas
        </p>
      </div>
    </div>
  );
}
