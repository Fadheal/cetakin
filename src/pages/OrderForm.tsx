import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Printer, 
  FileUp, 
  Settings2, 
  ClipboardCheck, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  AlertCircle,
  Clock,
  ChevronRight,
  ChevronLeft,
  FileText
} from 'lucide-react';
import { PersonalInfo, FileInfo, PrintSettings } from '../types';
import { cn } from '../lib/utils';

type Step = 'personal' | 'files' | 'settings' | 'review' | 'confirmation';

export default function OrderForm() {
  const [currentStep, setCurrentStep] = useState<Step>('personal');
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    name: '',
    phone: '',
    address: '',
    deliveryTime: 'Istirahat 1',
  });
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [settings, setSettings] = useState<PrintSettings>({
    mode: 'quick',
    color: 'bw',
    sidedness: 'single',
    copies: 1,
    quality: 'standard',
    paperType: 'normal',
    paperWeight: '70gsm',
    cutting: 'none',
    layout: '1-up',
    binding: 'none',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [submissionId] = useState(() => crypto.randomUUID());

  const steps: { key: Step; label: string; icon: any }[] = [
    { key: 'personal', label: 'Informasi', icon: Printer },
    { key: 'files', label: 'Upload', icon: FileUp },
    { key: 'settings', label: 'Konfigurasi Printer', icon: Settings2 },
    { key: 'review', label: 'Tinjauan', icon: ClipboardCheck },
    { key: 'confirmation', label: 'Selesai', icon: CheckCircle2 },
  ];

  const submitOrder = async () => {
    if (isSubmitting) return;
    
    console.log(`Submitting order with ID: ${submissionId}`);
    setIsSubmitting(true);
    setOrderId(null);
    
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personalInfo, settings, files, submissionId }),
      });
      
      let data;
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Invalid server response: ${text.substring(0, 100)}`);
      }

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to submit order');
      }
      
      console.log('Order submitted successfully:', data.id);
      setOrderId(data.id);
      setCurrentStep('confirmation');
    } catch (error: any) {
      console.error('Submission error:', error);
      alert(`Submission Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <nav className="h-20 bg-white flex items-center justify-between px-12 shrink-0 sticky top-0 z-10 shadow-sm border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1d4ed8] rounded-xl flex items-center justify-center text-white shadow-sm">
            <Printer size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Cetak<span className="text-[#1d4ed8]">In</span>
          </h1>
        </div>
        <div className="flex items-center space-x-8 text-sm font-medium text-slate-800">
          <a href="https://wa.link/i1skuk" className="hover:text-brand-blue transition-colors">Help</a>
          <a href="https://wa.link/i1skuk" className="hover:text-brand-blue transition-colors">Contact</a>
        </div>
      </nav>

      <main className="flex-1 flex flex-col p-8 max-w-4xl mx-auto w-full">
        <div className="flex-1">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col space-y-6"
          >
            {currentStep !== 'confirmation' && (
              <div className="flex justify-around items-center bg-white py-8 px-4 rounded-2xl border border-slate-100 shadow-sm mb-8">
                {steps.slice(0, 4).map((step, idx) => {
                  const isActive = currentStep === step.key;
                  const isPast = steps.findIndex(s => s.key === currentStep) > idx;

                  return (
                    <div key={step.key} className="flex items-center space-x-4">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all",
                        isActive ? "bg-[#1d4ed8] text-white" : "bg-slate-100 text-slate-400"
                      )}>
                        {idx + 1}
                      </div>
                      <span className={cn(
                        "font-medium text-sm transition-colors",
                        isActive ? "text-slate-900" : "text-slate-300"
                      )}>{step.label}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {currentStep === 'personal' && (
                    <PersonalInfoStep 
                      data={personalInfo} 
                      onChange={setPersonalInfo} 
                      onNext={() => setCurrentStep('files')} 
                    />
                  )}
                  {currentStep === 'files' && (
                    <FilesStep 
                      files={files} 
                      onFilesChange={setFiles} 
                      onNext={() => setCurrentStep('settings')} 
                      onBack={() => setCurrentStep('personal')} 
                    />
                  )}
                  {currentStep === 'settings' && (
                    <SettingsStep 
                      settings={settings} 
                      onSettingsChange={setSettings} 
                      onNext={() => setCurrentStep('review')} 
                      onBack={() => setCurrentStep('files')} 
                    />
                  )}
                  {currentStep === 'review' && (
                    <ReviewStep 
                      personalInfo={personalInfo} 
                      files={files} 
                      settings={settings} 
                      onBack={() => setCurrentStep('settings')} 
                      onSubmit={submitOrder}
                      isSubmitting={isSubmitting}
                    />
                  )}
                  {currentStep === 'confirmation' && (
                    <ConfirmationStep orderId={orderId} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="p-8 text-center text-slate-400 text-xs border-t border-slate-100">
        &copy; 2024 CetakIn. Solusi Print Cepat Antar Sampai Kelas.
      </footer>
    </div>
  );
}

// --- Step Components ---

function PersonalInfoStep({ data, onChange, onNext }: { data: PersonalInfo, onChange: (d: PersonalInfo) => void, onNext: () => void }) {
  const isValid = data.name && data.phone && data.address && data.deliveryTime;
  
  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-4">Data Diri</h2>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">Nama Lengkap</label>
          <input 
            type="text" 
            placeholder="Contoh: Ahmad Fadheeil"
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all text-sm"
            value={data.name}
            onChange={e => onChange({ ...data, name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">Nomor Telepon</label>
          <input 
            type="tel" 
            placeholder="081234567890"
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all text-sm"
            value={data.phone}
            onChange={e => onChange({ ...data, phone: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">Alamat Kelas</label>
          <input 
            type="text" 
            placeholder="Kelas H-102"
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all text-sm"
            value={data.address}
            onChange={e => onChange({ ...data, address: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">Waktu Pengantaran</label>
          <select 
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all text-sm appearance-none"
            value={data.deliveryTime}
            onChange={e => onChange({ ...data, deliveryTime: e.target.value })}
          >
            <option value="Istirahat 1">Istirahat 1</option>
            <option value="Istirahat 2">Istirahat 2</option>
          </select>
        </div>
      </div>
 
      <div className="pt-6 border-t border-slate-100 flex justify-end">
        <button
          onClick={onNext}
          disabled={!isValid}
          className="bg-brand-blue text-white px-8 py-3 rounded-xl font-bold transition-all hover:bg-opacity-90 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-md shadow-brand-blue/20 inline-flex items-center gap-2"
        >
          Lanjutkan <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

function FilesStep({ files, onFilesChange, onNext, onBack }: { files: FileInfo[], onFilesChange: (f: FileInfo[]) => void, onNext: () => void, onBack: () => void }) {
  const [isUploading, setIsUploading] = useState(false);
  
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    
    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < selectedFiles.length; i++) {
      formData.append('files', selectedFiles[i]);
    }
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        onFilesChange([...files, ...data.files]);
      } else {
        alert(data.error || 'Upload failed');
      }
    } catch (error) {
      alert('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = (filename: string) => {
    onFilesChange(files.filter(f => f.filename !== filename));
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-4">File Dokumen</h2>
        
        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center space-y-4 hover:border-brand-blue transition-colors relative group">
          <input 
            type="file" 
            multiple 
            onChange={handleUpload}
            className="absolute inset-0 opacity-0 cursor-pointer"
            disabled={isUploading}
          />
          <div className="w-16 h-16 bg-brand-blue/10 text-brand-blue rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
            <Plus size={32} />
          </div>
          <div>
            <p className="font-bold text-slate-700">Pilih atau Seret File</p>
            <p className="text-sm text-slate-400">PDF, DOCX, JPG, PNG (Max 20MB)</p>
          </div>
          {isUploading && (
            <div className="absolute inset-0 bg-white/80 rounded-2xl flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
              <span className="font-bold text-brand-blue">Mengunggah...</span>
            </div>
          )}
        </div>

        {files.length > 0 && (
          <div className="space-y-3 pt-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">File Terpilih ({files.length})</h3>
            <div className="space-y-2">
              {files.map((file) => (
                <div key={file.filename} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-brand-blue shadow-sm">
                      <FileText size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 line-clamp-1">{file.originalName}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB • {file.pages} Halaman</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeFile(file.filename)}
                    className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="pt-6 border-t border-slate-100 flex justify-between">
        <button
          onClick={onBack}
          className="text-slate-600 px-6 py-3 rounded-xl font-bold transition-all hover:bg-slate-100 inline-flex items-center gap-2"
        >
          <ChevronLeft size={18} /> Kembali
        </button>
        <button
          onClick={onNext}
          disabled={files.length === 0}
          className="bg-brand-blue text-white px-8 py-3 rounded-xl font-bold transition-all hover:bg-opacity-90 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-md shadow-brand-blue/20 inline-flex items-center gap-2"
        >
          Lanjutkan <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

function SettingsStep({ settings, onSettingsChange, onNext, onBack }: { settings: PrintSettings, onSettingsChange: (s: PrintSettings) => void, onNext: () => void, onBack: () => void }) {
  const isAdvanced = settings.mode === 'advanced';

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
          <h2 className="text-xl font-bold text-slate-900">Opsi Pencetakan</h2>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {['quick', 'advanced'].map(m => (
              <button
                key={m}
                onClick={() => onSettingsChange({ ...settings, mode: m as any })}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all capitalize",
                  settings.mode === m ? "bg-white text-brand-blue shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {m === 'quick' ? 'Cepat' : 'Kompleks'}
              </button>
            ))}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-brand-blue uppercase tracking-widest">Utama</h3>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Warna</label>
              <div className="grid grid-cols-2 gap-2">
                {['bw', 'color'].map(c => (
                  <button
                    key={c}
                    onClick={() => onSettingsChange({ ...settings, color: c as any })}
                    className={cn(
                      "py-3 rounded-xl text-sm font-bold border transition-all",
                      settings.color === c ? "bg-brand-blue text-white border-brand-blue" : "bg-white text-slate-600 border-slate-200"
                    )}
                  >
                    {c === 'bw' ? 'Hitam Putih' : 'Warna'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Sisi</label>
              <div className="grid grid-cols-2 gap-2">
                {['single', 'double'].map(s => (
                  <button
                    key={s}
                    onClick={() => onSettingsChange({ ...settings, sidedness: s as any })}
                    className={cn(
                      "py-3 rounded-xl text-sm font-bold border transition-all",
                      settings.sidedness === s ? "bg-brand-blue text-white border-brand-blue" : "bg-white text-slate-600 border-slate-200"
                    )}
                  >
                    {s === 'single' ? 'Satu Sisi' : 'Bolak Balik'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Jumlah Salinan</label>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => onSettingsChange({ ...settings, copies: Math.max(1, settings.copies - 1) })}
                  className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center font-bold text-xl hover:bg-slate-50"
                  type="button"
                >-</button>
                <span className="font-bold text-lg w-8 text-center">{settings.copies}</span>
                <button 
                  onClick={() => onSettingsChange({ ...settings, copies: settings.copies + 1 })}
                  className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center font-bold text-xl hover:bg-slate-50"
                  type="button"
                >+</button>
              </div>
            </div>

            {isAdvanced && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4 pt-4 border-t border-slate-50"
              >
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">Ketebalan Kertas</label>
                  <select 
                    className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-blue/20 text-sm font-bold text-slate-700 appearance-none"
                    value={settings.paperWeight || '70gsm'}
                    onChange={e => onSettingsChange({ ...settings, paperWeight: e.target.value })}
                  >
                    <option value="70gsm">70 GSM (Standar)</option>
                    <option value="80gsm">80 GSM (Sedikit Tebal)</option>
                    <option value="100gsm">100 GSM (Tebal/Premium)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">Tata Letak (Layout)</label>
                  <select 
                    className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-blue/20 text-sm font-bold text-slate-700 appearance-none"
                    value={settings.layout || '1-up'}
                    onChange={e => onSettingsChange({ ...settings, layout: e.target.value })}
                  >
                    <option value="1-up">1 Halaman per Lembar</option>
                    <option value="2-up">2 Halaman per Lembar (Slide)</option>
                    <option value="4-up">4 Halaman per Lembar</option>
                  </select>
                </div>
              </motion.div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-brand-blue uppercase tracking-widest">Tambahan</h3>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Finishing (Jilid)</label>
              <select 
                className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-blue/20 text-sm font-bold text-slate-700 appearance-none"
                value={settings.binding}
                onChange={e => onSettingsChange({ ...settings, binding: e.target.value as any })}
              >
                <option value="none">Tanpa Jilid</option>
                <option value="staple">Staples Saja</option>
                <option value="ring">Spiral (Ring)</option>
                <option value="softbound">Lakban</option>
              </select>
            </div>

            {isAdvanced && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">Potongan (Cutting)</label>
                  <select 
                    className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-blue/20 text-sm font-bold text-slate-700 appearance-none"
                    value={settings.cutting || 'none'}
                    onChange={e => onSettingsChange({ ...settings, cutting: e.target.value })}
                  >
                    <option value="none">Tanpa Potong</option>
                    <option value="half">Potong Setengah (A5)</option>
                    <option value="full">Potong Sesuai Ukuran</option>
                  </select>
                </div>
              </motion.div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Catatan Khusus</label>
              <textarea 
                placeholder="Contoh: Print halaman 1-10 saja, tolong jilid rapi..."
                className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-blue/20 text-sm h-24"
                value={settings.notes}
                onChange={e => onSettingsChange({ ...settings, notes: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 flex justify-between">
        <button
          onClick={onBack}
          className="text-slate-600 px-6 py-3 rounded-xl font-bold transition-all hover:bg-slate-100 inline-flex items-center gap-2"
        >
          <ChevronLeft size={18} /> Kembali
        </button>
        <button
          onClick={onNext}
          className="bg-brand-blue text-white px-8 py-3 rounded-xl font-bold transition-all hover:bg-opacity-90 shadow-md shadow-brand-blue/20 inline-flex items-center gap-2"
        >
          Tinjau Pesanan <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

function ReviewStep({ personalInfo, files, settings, onBack, onSubmit, isSubmitting }: { personalInfo: PersonalInfo, files: FileInfo[], settings: PrintSettings, onBack: () => void, onSubmit: () => void, isSubmitting: boolean }) {
  const totalPages = files.reduce((acc, curr) => acc + (curr.pages * settings.copies), 0);
  // Simple pricing: 500 per page for BW, 1000 for color
  const pricePerPage = settings.color === 'bw' ? 500 : 1000;
  const estimatedTotal = totalPages * pricePerPage;

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-8">
        <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-4">Tinjauan Akhir</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-6 text-sm">
            <div className="space-y-2">
              <h3 className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Pemesan & Lokasi</h3>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-800">{personalInfo.name}</p>
                <p className="text-slate-500 mt-1">{personalInfo.address}</p>
                <p className="text-slate-500">{personalInfo.phone}</p>
                <p className="text-brand-blue font-bold mt-2 text-xs flex items-center gap-1.5">
                  <Clock size={12} /> Antar di {personalInfo.deliveryTime}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Spesifikasi Print</h3>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Mode</span>
                  <span className="font-bold text-slate-800 uppercase text-[10px] bg-slate-100 px-2 py-0.5 rounded">{settings.mode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Warna</span>
                  <span className="font-bold text-slate-800">{settings.color === 'bw' ? 'Hitam Putih' : 'Berwarna'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Sisi</span>
                  <span className="font-bold text-slate-800">{settings.sidedness === 'single' ? 'Satu Sisi' : 'Bolak Balik'}</span>
                </div>
                {settings.mode === 'advanced' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Kertas</span>
                      <span className="font-bold text-slate-800">{settings.paperWeight}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Layout</span>
                      <span className="font-bold text-slate-800">{settings.layout}</span>
                    </div>
                    {settings.cutting !== 'none' && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Potongan</span>
                        <span className="font-bold text-slate-800">{settings.cutting}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Binding</span>
                  <span className="font-bold text-slate-800">{settings.binding === 'none' ? 'Tanpa Jilid' : settings.binding}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Estimasi Biaya</h3>
              <div className="bg-brand-blue/5 p-6 rounded-2xl border border-brand-blue/10 space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Total Halaman (x{settings.copies})</span>
                    <span>{totalPages} Hal</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Harga per Hal</span>
                    <span>Rp {pricePerPage}</span>
                  </div>
                </div>
                <div className="border-t border-brand-blue/20 pt-4 flex justify-between items-end">
                  <span className="text-sm font-bold text-slate-600">Total Bayar</span>
                  <span className="text-2xl font-bold text-brand-blue">Rp {estimatedTotal.toLocaleString('id-ID')}</span>
                </div>
                <p className="text-[10px] text-slate-400 italic font-medium leading-relaxed">
                  * Harga ini adalah estimasi awal. Pembayaran bisa dilakukan secara COD saat dokumen diantar ke kelas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-100 flex justify-between">
        <button
          onClick={onBack}
          className="text-slate-600 px-6 py-3 rounded-xl font-bold transition-all hover:bg-slate-100 inline-flex items-center gap-2"
        >
          <ChevronLeft size={18} /> Kembali
        </button>
        <button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="bg-brand-blue text-white px-10 py-4 rounded-2xl font-black text-lg transition-all hover:scale-105 active:scale-95 shadow-xl shadow-brand-blue/30 inline-flex items-center gap-3"
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Sedang Terkirim...
            </>
          ) : (
            <>Pesan Sekarang <CheckCircle2 size={24} /></>
          )}
        </button>
      </div>
    </div>
  );
}

function ConfirmationStep({ orderId }: { orderId: string | null }) {
  return (
    <div className="py-12 flex flex-col items-center justify-center text-center space-y-8 min-h-[500px]">
      <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center animate-bounce shadow-lg shadow-green-100">
        <CheckCircle2 size={48} />
      </div>
      <div className="space-y-3">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Pesanan Berhasil!</h2>
        <p className="text-slate-500 max-w-sm mx-auto font-medium">
          Terima kasih! Pesanan kamu sedang diproses. Mohon siapkan uang pas saat kurir kami mengantar dokumen ke kelasmu.
        </p>
      </div>
      {orderId && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 font-mono text-sm text-slate-400 select-all cursor-pointer hover:border-brand-blue transition-colors">
          ID: {orderId}
        </div>
      )}
      <div className="pt-8 flex flex-col sm:flex-row gap-4">
        <button 
          onClick={() => window.location.reload()}
          className="bg-brand-blue text-white px-8 py-3 rounded-xl font-bold transition-all hover:bg-opacity-90 shadow-md shadow-brand-blue/20"
        >
          Buat Pesanan Baru
        </button>
        {orderId && (
          <Link 
            to={`/order-status/${orderId}`}
            className="text-slate-600 px-8 py-3 rounded-xl font-bold transition-all hover:bg-slate-100 border border-slate-200 flex items-center justify-center"
          >
            Cek Status Pesanan
          </Link>
        )}
      </div>
    </div>
  );
}
