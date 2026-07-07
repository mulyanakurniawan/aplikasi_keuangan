import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, TrendingUp, AlertTriangle, Percent, Plus, Edit2, Trash2, Check, X, Download, FileSpreadsheet, FileText, Search, Calendar, LogOut, Database, ArrowRight, UserPlus, RefreshCw, Clock, Printer, ChevronRight, MessageCircle, Menu, Wallet, Copy
} from 'lucide-react';
import { Profile, SppPembayaran, BULAN_LIST, BulanType } from '../types';
import { NOMINAL_SPP } from '../data/mockData';
import { supabase } from '../lib/supabase';

interface AdminDashboardProps {
  profiles: Profile[];
  payments: SppPembayaran[];
  currentProfile: Profile;
  onUpdateProfiles: (updated: Profile[]) => void;
  onUpdatePayments: (updated: SppPembayaran[]) => void;
  onLogout: () => void;
  onOpenSQL: () => void;
}

export default function AdminDashboard({
  profiles,
  payments,
  currentProfile,
  onUpdateProfiles,
  onUpdatePayments,
  onLogout,
  onOpenSQL
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'ringkasan' | 'siswa' | 'pembayaran' | 'broadcast'>('ringkasan');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKelas, setFilterKelas] = useState('Semua');
  const [currentSelectedBulan, setCurrentSelectedBulan] = useState<BulanType>('Juni');

  // Broadcast States
  const [broadcastSearch, setBroadcastSearch] = useState('');
  const [broadcastKelas, setBroadcastKelas] = useState('Semua');
  const [broadcastTemplate, setBroadcastTemplate] = useState(
    `Assalamu'alaikum Wr. Wb.

Yth. Bapak/Ibu Wali Murid dari ananda *{nama_siswa}* (Kelas {kelas}).

Bersama pesan ini kami menginformasikan bahwa ananda tercatat memiliki tunggakan SPP sebanyak *{jumlah_bulan} bulan*. Total tagihan: *{total_tagihan}*.

Mohon kerjasamanya untuk segera melakukan pelunasan ke bagian Tata Usaha SMA Plus Babussalam.

Atas perhatiannya kami ucapkan terima kasih.
Wassalamu'alaikum Wr. Wb.`
  );
  const [selectedSiswaPreviewId, setSelectedSiswaPreviewId] = useState<string>('');
  const [contactedSiswaIds, setContactedSiswaIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('spp_broadcast_contacted');
    return saved ? JSON.parse(saved) : [];
  });

  const toggleContacted = (siswaId: string) => {
    const updated = contactedSiswaIds.includes(siswaId)
      ? contactedSiswaIds.filter(id => id !== siswaId)
      : [...contactedSiswaIds, siswaId];
    setContactedSiswaIds(updated);
    localStorage.setItem('spp_broadcast_contacted', JSON.stringify(updated));
  };

  const [selectedSiswaId, setSelectedSiswaId] = useState<string>(
    profiles.filter(p => p.role === 'siswa')[0]?.id || ''
  );

  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Profile | null>(null);
  const [studentForm, setStudentForm] = useState({ nama: '', nis: '', kelas: '', email: '' });

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const triggerToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const siswaProfiles = profiles.filter(p => p.role === 'siswa');
  const classesList = ['Semua', ...Array.from(new Set(siswaProfiles.map(s => s.kelas))).filter(Boolean)];

  const totalUangMasuk = payments.filter(p => p.status === 'lunas').reduce((sum, p) => sum + p.nominal, 0);
  const totalTunggakan = payments.filter(p => p.status === 'belum_bayar').reduce((sum, p) => sum + p.nominal, 0);

  const paymentsInBulan = payments.filter(p => p.bulan === currentSelectedBulan);
  const paidInBulan = paymentsInBulan.filter(p => p.status === 'lunas');
  const percentagePaidThisMonth = paymentsInBulan.length > 0 ? Math.round((paidInBulan.length / paymentsInBulan.length) * 100) : 0;

  const formatRupiah = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  const handleOpenAddModal = () => {
    setEditingStudent(null);
    setStudentForm({ nama: '', nis: '', kelas: '', email: '' });
    setIsStudentModalOpen(true);
  };

  const handleOpenEditModal = (siswa: Profile) => {
    setEditingStudent(siswa);
    setStudentForm({ nama: siswa.nama, nis: siswa.nis, kelas: siswa.kelas, email: siswa.email });
    setIsStudentModalOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.nama || !studentForm.nis || !studentForm.kelas || !studentForm.email) {
      triggerToast('Harap isi semua kolom wajib!', 'error');
      return;
    }

    if (editingStudent) {
      const { error } = await supabase.from('profiles').update(studentForm).eq('id', editingStudent.id);
      if (error) { triggerToast('Gagal memperbarui!', 'error'); return; }
      onOpenSQL();
      triggerToast('Data siswa berhasil diperbarui!');
    } else {
      const isNisExists = profiles.some(p => p.nis === studentForm.nis);
      if (isNisExists) {
        triggerToast(`NIS ${studentForm.nis} sudah digunakan siswa lain!`, 'error');
        return;
      }
      
      const newSiswaId = crypto.randomUUID();
      const generatedPassword = `Siswa${studentForm.nis}`; // Generate password from NIS
      
      const newProfile = { id: newSiswaId, role: 'siswa', password: generatedPassword, ...studentForm };
      const newSppRecords = BULAN_LIST.map((bulan) => ({
        siswa_id: newSiswaId, tahun_ajaran: '2025/2026',
        bulan: bulan, nominal: NOMINAL_SPP, status: 'belum_bayar'
      }));
      
      const { error: pError } = await supabase.from('profiles').insert([newProfile]);
      if (pError) { triggerToast('Gagal menambah siswa ke profiles', 'error'); return; }
      
      const { error: sError } = await supabase.from('spp_pembayaran').insert(newSppRecords);
      if (sError) { triggerToast('Gagal membuat tagihan SPP', 'error'); return; }

      onOpenSQL(); // refresh data
      setSelectedSiswaId(newSiswaId);
      triggerToast('Siswa baru berhasil ditambahkan!');
      
      // Tampilkan kredensial kepada Admin
      alert(`AKUN SISWA BERHASIL DIBUAT!\n\nNIS/Username: ${studentForm.nis}\nPassword: ${generatedPassword}\n\nCatatan: Akun ini bersifat "View-Only" (hanya dapat melihat data SPP & cetak kuitansi secara mandiri).\n\nHarap simpan atau berikan informasi ini kepada siswa yang bersangkutan.`);
    }
    setIsStudentModalOpen(false);
  };

  const handleDeleteStudent = async (siswaId: string, nama: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus siswa "${nama}"?`)) {
      const { error } = await supabase.from('profiles').delete().eq('id', siswaId);
      if (error) { triggerToast('Gagal menghapus siswa!', 'error'); return; }
      
      onOpenSQL();
      if (selectedSiswaId === siswaId) setSelectedSiswaId(profiles.filter(p => p.role === 'siswa' && p.id !== siswaId)[0]?.id || '');
      triggerToast(`Siswa "${nama}" berhasil dihapus.`);
    }
  };

  const handleToggleSppStatus = async (pembayaranId: string) => {
    const p = payments.find(p => p.id === pembayaranId);
    if (!p) return;

    if (p.status === 'belum_bayar') {
      const studentProfile = profiles.find(pr => pr.id === p.siswa_id);
      const monthIndex = BULAN_LIST.indexOf(p.bulan as BulanType) + 1;
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      
      const updates = { 
        status: 'lunas', 
        tanggal_bayar: new Date().toISOString().split('T')[0], 
        invoice_no: `INV/SPP/2526/${studentProfile?.nis || 'X'}/${monthIndex}${randomSuffix}`, 
        dicatat_oleh: currentProfile.id 
      };
      const { error } = await supabase.from('spp_pembayaran').update(updates).eq('id', pembayaranId);
      if (error) triggerToast('Gagal update status!', 'error');
      else { onOpenSQL(); triggerToast('Status pembayaran SPP berhasil disinkronkan!'); }
    } else {
      const updates = { status: 'belum_bayar', tanggal_bayar: null, invoice_no: null, dicatat_oleh: null };
      const { error } = await supabase.from('spp_pembayaran').update(updates).eq('id', pembayaranId);
      if (error) triggerToast('Gagal update status!', 'error');
      else { onOpenSQL(); triggerToast('Status pembayaran SPP berhasil disinkronkan!'); }
    }
  };

  const handlePrintReceipt = (record: SppPembayaran) => {
    const student = profiles.find(p => p.id === record.siswa_id);
    if (!student || !record.tanggal_bayar || !record.invoice_no) return;
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(5, 122, 85);
      doc.text("KUITANSI PEMBAYARAN SPP", 105, 20, { align: "center" });
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text("SMA PLUS BABUSSALAM", 105, 26, { align: "center" });
      doc.setDrawColor(16, 185, 129);
      doc.setLineWidth(0.5);
      doc.line(20, 32, 190, 32);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`No. Invoice : ${record.invoice_no}`, 20, 45);
      doc.text(`Tanggal     : ${new Date(record.tanggal_bayar).toLocaleDateString('id-ID')}`, 130, 45);
      doc.text(`Telah terima dari  : ${student.nama} (NIS: ${student.nis})`, 20, 55);
      doc.text(`Kelas              : ${student.kelas}`, 20, 62);
      doc.text(`Untuk Pembayaran   : SPP Bulan ${record.bulan} Tahun Ajaran ${record.tahun_ajaran}`, 20, 69);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(`Sebesar            : ${formatRupiah(record.nominal)}`, 20, 80);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Penerima,", 150, 100);
      doc.text("Bendahara / TU", 150, 120);
      doc.save(`Kuitansi_SPP_${student.nis}_${record.bulan}.pdf`);
      triggerToast('Kuitansi berhasil dicetak!');
    } catch (e) {
      console.error(e);
      triggerToast('Gagal mencetak kuitansi', 'error');
    }
  };

  const getStudentsInArrears = () => {
    return siswaProfiles.map(siswa => {
      const studentPays = payments.filter(p => p.siswa_id === siswa.id);
      const arrears = studentPays.filter(p => p.status === 'belum_bayar');
      return { siswa, arrears };
    }).filter(item => item.arrears.length > 0);
  };

  const generateBroadcastText = (siswa: Profile, arrearsCount: number) => {
    return broadcastTemplate
      .replace(/{nama_siswa}/g, siswa.nama)
      .replace(/{kelas}/g, siswa.kelas)
      .replace(/{jumlah_bulan}/g, String(arrearsCount))
      .replace(/{total_tagihan}/g, formatRupiah(arrearsCount * NOMINAL_SPP));
  };

  const handleExportExcel = () => {
    try {
      const summaryData = [
        { 'Kategori Keuangan': 'SISTEM INFORMASI SPP - SMA PLUS BABUSSALAM', Nilai: '' },
        { 'Kategori Keuangan': 'Total Pendapatan SPP Masuk (Lunas)', Nilai: totalUangMasuk },
        { 'Kategori Keuangan': 'Total Tunggakan SPP Siswa (Outstanding)', Nilai: totalTunggakan },
        { 'Kategori Keuangan': `Tingkat Kepatuhan Bulan ${currentSelectedBulan}`, Nilai: `${percentagePaidThisMonth}%` },
        { 'Kategori Keuangan': 'Jumlah Terdaftar (Siswa)', Nilai: siswaProfiles.length },
        { 'Kategori Keuangan': 'Tanggal Unduh Laporan', Nilai: new Date().toLocaleString('id-ID') }
      ];
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);

      const studentsSheetData = siswaProfiles.map(siswa => {
        const studentPays = payments.filter(p => p.siswa_id === siswa.id);
        const lunasBulan = studentPays.filter(p => p.status === 'lunas').length;
        const sisaArrears = studentPays.filter(p => p.status === 'belum_bayar').length;
        return {
          'NIS': siswa.nis,
          'Nama Siswa': siswa.nama,
          'Kelas': siswa.kelas,
          'Total Terbayar': lunasBulan * NOMINAL_SPP,
          'Total Tunggakan': sisaArrears * NOMINAL_SPP
        };
      });
      const wsStudents = XLSX.utils.json_to_sheet(studentsSheetData);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');
      XLSX.utils.book_append_sheet(wb, wsStudents, 'Daftar Siswa');
      XLSX.writeFile(wb, `Laporan_SPP_${Date.now()}.xlsx`);
      triggerToast('Laporan Excel berhasil diunduh!');
    } catch (error) {
      console.error(error);
      triggerToast('Gagal memproses ekspor Excel', 'error');
    }
  };

  const filteredStudents = siswaProfiles.filter(siswa => {
    const matchesSearch = siswa.nama.toLowerCase().includes(searchQuery.toLowerCase()) || siswa.nis.includes(searchQuery);
    const matchesKelas = filterKelas === 'Semua' || siswa.kelas === filterKelas;
    return matchesSearch && matchesKelas;
  });

  const selectedStudentProfile = profiles.find(p => p.id === selectedSiswaId);
  const selectedStudentPayments = payments.filter(p => p.siswa_id === selectedSiswaId);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-800">
      
      {/* MOBILE HEADER */}
      <div className="md:hidden absolute w-full bg-emerald-700 text-white p-4 flex justify-between items-center shadow-md z-30">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Wallet className="w-5 h-5" />
          <span>Panel Bendahara</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-1.5 bg-emerald-800 rounded-md">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* SIDEBAR NAVIGATION */}
      <motion.div 
        initial={false}
        animate={{ x: isMobileMenuOpen ? 0 : (window.innerWidth < 768 ? -300 : 0) }}
        className={`fixed md:relative w-72 bg-white border-r border-slate-200 flex-shrink-0 h-full z-40 transition-transform duration-300 md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)]`}
      >
        {/* Sidebar Header / Logo */}
        <div className="p-6 h-20 flex justify-between items-center border-b border-slate-100 mt-14 md:mt-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-black text-slate-900 text-sm tracking-tight block">SMA BABUSSALAM</span>
              <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Admin SPP</span>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-slate-600 p-1 bg-slate-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto py-6 space-y-1.5 px-3">
          <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Menu Utama</p>

          <button 
            onClick={() => {setActiveTab('ringkasan'); setIsMobileMenuOpen(false);}} 
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm rounded-xl transition-all duration-200 cursor-pointer ${
              activeTab === 'ringkasan' 
                ? 'bg-emerald-50 text-emerald-700 font-bold shadow-sm ring-1 ring-emerald-100' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium'
            }`}
          >
            <TrendingUp className={`w-5 h-5 ${activeTab === 'ringkasan' ? 'text-emerald-600' : 'text-slate-400'}`} /> 
            Ringkasan &amp; Laporan
          </button>

          <button 
            onClick={() => {setActiveTab('siswa'); setIsMobileMenuOpen(false);}} 
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm rounded-xl transition-all duration-200 cursor-pointer ${
              activeTab === 'siswa' 
                ? 'bg-emerald-50 text-emerald-700 font-bold shadow-sm ring-1 ring-emerald-100' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium'
            }`}
          >
            <Users className={`w-5 h-5 ${activeTab === 'siswa' ? 'text-emerald-600' : 'text-slate-400'}`} /> 
            Manajemen Siswa
          </button>

          <button 
            onClick={() => {setActiveTab('pembayaran'); setIsMobileMenuOpen(false);}} 
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm rounded-xl transition-all duration-200 cursor-pointer ${
              activeTab === 'pembayaran' 
                ? 'bg-emerald-50 text-emerald-700 font-bold shadow-sm ring-1 ring-emerald-100' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium'
            }`}
          >
            <Wallet className={`w-5 h-5 ${activeTab === 'pembayaran' ? 'text-emerald-600' : 'text-slate-400'}`} /> 
            Entri SPP Siswa
          </button>

          <button 
            onClick={() => {setActiveTab('broadcast'); setIsMobileMenuOpen(false);}} 
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm rounded-xl transition-all duration-200 cursor-pointer ${
              activeTab === 'broadcast' 
                ? 'bg-emerald-50 text-emerald-700 font-bold shadow-sm ring-1 ring-emerald-100' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium'
            }`}
          >
            <MessageCircle className={`w-5 h-5 ${activeTab === 'broadcast' ? 'text-emerald-600' : 'text-slate-400'}`} /> 
            Broadcast Tagihan
          </button>
        </div>
        
        {/* Sidebar Footer (Profile & Actions) */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between gap-2 p-2 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs shrink-0">
                {currentProfile.nama.slice(0,2).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <span className="text-xs font-bold text-slate-800 block truncate">{currentProfile.nama}</span>
                <span className="text-[9px] text-slate-500 block truncate">{currentProfile.email}</span>
              </div>
            </div>
            <button 
              onClick={onLogout} 
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer shrink-0"
              title="Keluar dari sistem"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 pt-20 md:pt-6 bg-slate-50 relative flex flex-col">
        
        {/* TOAST NOTIFICATION */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div 
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`fixed bottom-5 right-5 z-50 p-4 rounded-xl border shadow-xl flex items-center gap-2.5 ${toastMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}
            >
              {toastMessage.type === 'success' ? <div className="p-1 bg-emerald-500 text-white rounded-full"><Check className="w-4 h-4" /></div> : <div className="p-1 bg-rose-500 text-white rounded-full"><X className="w-4 h-4" /></div>}
              <span className="text-xs font-bold">{toastMessage.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-6xl mx-auto space-y-4 flex-1 flex flex-col"
          >
            {activeTab === 'ringkasan' && (
              <div className="space-y-4">
                {/* Header Actions untuk Tab Ringkasan */}
                <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm shrink-0">
                  <div>
                    <h2 className="font-bold text-slate-800 text-sm">Ringkasan &amp; Laporan Keuangan</h2>
                    <p className="text-[10px] text-slate-500">Pantau arus kas dan kepatuhan pembayaran SPP siswa.</p>
                  </div>
                  <button onClick={handleExportExcel} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer">
                    <FileSpreadsheet className="w-4 h-4" />
                    Unduh Laporan Excel
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
                  <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:shadow-md transition">
                    <span className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">Kas Masuk SPP</span>
                    <div className="mt-2 flex items-baseline gap-2">
                      <h2 className="text-2xl font-bold text-slate-900">{formatRupiah(totalUangMasuk)}</h2>
                      <span className="text-xs text-emerald-600 font-medium">Lunas</span>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:shadow-md transition">
                    <span className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">Outstanding Tunggakan</span>
                    <div className="mt-2 flex items-baseline gap-2">
                      <h2 className="text-2xl font-bold text-slate-900">{formatRupiah(totalTunggakan)}</h2>
                      <span className="text-xs text-rose-500 font-medium">Tunggakan</span>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col justify-between hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">Kepatuhan SPP</span>
                          <select
                            value={currentSelectedBulan}
                            onChange={(e) => setCurrentSelectedBulan(e.target.value as BulanType)}
                            className="bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-700 px-1.5 py-0.5 rounded cursor-pointer focus:outline-none"
                          >
                            {BULAN_LIST.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mt-1">{percentagePaidThisMonth}%</h2>
                      </div>
                      <div className="w-10 h-10 rounded-full border-4 border-emerald-500 border-t-transparent flex items-center justify-center">
                        <span className="text-[10px] font-bold text-slate-850">{percentagePaidThisMonth}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                    <div>
                      <h3 className="font-bold text-slate-850 text-sm">Rasio Pelunasan SPP 12 Bulan</h3>
                    </div>
                  </div>
                  <div className="relative pt-4 h-40 flex items-end justify-between gap-2 border-b border-slate-200">
                    {BULAN_LIST.map((bulanName) => {
                      const totalInMonth = payments.filter(p => p.bulan === bulanName).length;
                      const paidInMonth = payments.filter(p => p.bulan === bulanName && p.status === 'lunas').length;
                      const pct = totalInMonth > 0 ? (paidInMonth / totalInMonth) * 100 : 0;
                      return (
                        <div key={bulanName} className="flex-1 flex flex-col items-center group relative z-10">
                          <div className="w-full bg-slate-100 rounded-t-md h-28 flex items-end overflow-hidden">
                            <motion.div 
                              initial={{ height: 0 }}
                              animate={{ height: `${pct}%` }}
                              transition={{ duration: 0.5 }}
                              className="w-full bg-emerald-500 group-hover:bg-emerald-600 rounded-t-md"
                            />
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 mt-2 truncate w-full text-center">{bulanName.slice(0, 3)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'siswa' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 pb-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-slate-850 text-sm">Daftar Induk Siswa</h3>
                    <p className="text-[11px] text-slate-500 mt-1">Klik nama siswa untuk melihat rincian pembayaran SPP mereka langsung.</p>
                  </div>
                  <button onClick={handleOpenAddModal} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2 rounded-lg cursor-pointer">
                    <UserPlus className="w-4 h-4" /> Tambah Siswa
                  </button>
                </div>
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row gap-4">
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari Siswa..." className="flex-1 bg-white border border-slate-200 rounded-lg py-2 px-4 text-xs" />
                  <select value={filterKelas} onChange={(e) => setFilterKelas(e.target.value)} className="bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs w-full sm:w-48">
                    {classesList.map(kelas => <option key={kelas} value={kelas}>Kelas: {kelas}</option>)}
                  </select>
                </div>
                <div className="overflow-x-auto max-h-[calc(100vh-220px)] overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                      <tr className="text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        <th className="py-3 px-4">Siswa</th>
                        <th className="py-3 px-4">NIS &amp; Kelas</th>
                        <th className="py-3 px-4">Status Bayar</th>
                        <th className="py-3 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredStudents.map((siswa) => {
                        const sPays = payments.filter(p => p.siswa_id === siswa.id);
                        const lunasCount = sPays.filter(p => p.status === 'lunas').length;
                        return (
                          <motion.tr layout key={siswa.id} className="hover:bg-slate-50/50 transition">
                            <td 
                              className="py-3 px-4 cursor-pointer hover:text-emerald-700"
                              onClick={() => {
                                setSelectedSiswaId(siswa.id);
                                setActiveTab('pembayaran');
                              }}
                            >
                              <span className="font-bold text-slate-800 block text-xs underline decoration-emerald-200 underline-offset-4">{siswa.nama}</span>
                            </td>
                            <td className="py-3 px-4 text-xs">
                              {siswa.nis} - <span className="font-bold">{siswa.kelas}</span>
                            </td>
                            <td className="py-3 px-4 text-xs">
                              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{lunasCount}/12 Lunas</span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex justify-center gap-2">
                                <button onClick={() => handleOpenEditModal(siswa)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => handleDeleteStudent(siswa.id, siswa.nama)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'pembayaran' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm flex flex-col max-h-[calc(100vh-90px)]">
                  <h3 className="font-bold text-sm border-b pb-3 shrink-0">Daftar Siswa</h3>
                  <div className="space-y-2 flex-1 overflow-y-auto pr-2">
                    {siswaProfiles.map(s => (
                      <button key={s.id} onClick={() => setSelectedSiswaId(s.id)} className={`w-full text-left p-3 rounded-lg border transition ${s.id === selectedSiswaId ? 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-400' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                        <span className="font-bold text-xs block">{s.nama}</span>
                        <span className="text-[10px] text-slate-500">{s.kelas} | {s.nis}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col max-h-[calc(100vh-90px)]">
                  <h3 className="font-bold text-sm border-b pb-3 mb-4 flex justify-between items-center shrink-0">
                    <span>Matriks Pembayaran: <span className="text-emerald-700 underline">{selectedStudentProfile?.nama}</span></span>
                    <span className="bg-slate-100 text-[10px] px-2 py-1 rounded">Kelas {selectedStudentProfile?.kelas}</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 overflow-y-auto pr-2">
                    <AnimatePresence>
                      {selectedStudentPayments.map((record) => {
                        const isLunas = record.status === 'lunas';
                        return (
                          <motion.div layout initial={{opacity: 0}} animate={{opacity: 1}} key={record.id} className={`p-4 rounded-lg border flex flex-col justify-between transition ${isLunas ? 'bg-emerald-50/30 border-emerald-300' : 'bg-white border-slate-200 hover:shadow-md'}`}>
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-sm block">{record.bulan}</span>
                              <button onClick={() => handleToggleSppStatus(record.id)} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-bold cursor-pointer transition ${isLunas ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border'}`}>
                                {isLunas ? <><Check className="w-3 h-3" /> Lunas</> : 'Setor'}
                              </button>
                            </div>
                            {isLunas && (
                              <div className="mt-3 pt-3 border-t border-emerald-100 flex justify-between items-center text-[10px]">
                                <span className="text-slate-500 font-mono">{record.invoice_no}</span>
                                <button onClick={() => handlePrintReceipt(record)} className="text-emerald-700 flex items-center gap-1 hover:underline font-semibold cursor-pointer">
                                  <Printer className="w-3 h-3" /> Cetak Kuitansi
                                </button>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'broadcast' && (
              <div className="space-y-4 flex-1 flex flex-col min-h-0 lg:h-[calc(100vh-140px)]">
                {/* Header Stats Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
                  <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl p-3.5 text-white shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-white/80 text-[10px] font-semibold uppercase tracking-wider block">Siswa Menunggak</span>
                      <h4 className="text-lg font-bold mt-0.5">{getStudentsInArrears().length} Orang</h4>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-white/20 shrink-0" />
                  </div>
                  
                  <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-3.5 text-white shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-white/80 text-[10px] font-semibold uppercase tracking-wider block">Total Outstanding</span>
                      <h4 className="text-lg font-bold mt-0.5">{formatRupiah(getStudentsInArrears().reduce((sum, item) => sum + (item.arrears.length * NOMINAL_SPP), 0))}</h4>
                    </div>
                    <Wallet className="w-8 h-8 text-white/20 shrink-0" />
                  </div>

                  <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-3.5 text-white shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-white/80 text-[10px] font-semibold uppercase tracking-wider block">Sudah Dihubungi</span>
                      <h4 className="text-lg font-bold mt-0.5">{getStudentsInArrears().filter(item => contactedSiswaIds.includes(item.siswa.id)).length} / {getStudentsInArrears().length}</h4>
                    </div>
                    <Check className="w-8 h-8 text-white/20 shrink-0" />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch flex-1 min-h-0">
                  
                  {/* LEFT PANEL: TEMPLATE CUSTOMIZER */}
                  <div className="lg:col-span-4 h-full min-h-0">
                    {/* Template Customizer Card */}
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col h-full min-h-0">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">Template Pesan WhatsApp</h4>
                        <p className="text-[10px] text-slate-500">Kustomisasi isi pesan untuk wali murid.</p>
                      </div>
                      
                      <div className="mt-2.5 flex-1 min-h-0 flex flex-col">
                        <textarea
                          value={broadcastTemplate}
                          onChange={(e) => setBroadcastTemplate(e.target.value)}
                          placeholder="Tulis template pesan..."
                          className="w-full flex-1 min-h-0 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-sans leading-relaxed resize-none"
                        />
                      </div>

                      {/* Variables Tags list */}
                      <div className="mt-2.5 space-y-1.5 shrink-0">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Klik untuk menyisipkan variabel:</span>
                        <div className="flex flex-wrap gap-1">
                          {[
                            { tag: '{nama_siswa}', label: 'Nama Siswa' },
                            { tag: '{kelas}', label: 'Kelas' },
                            { tag: '{jumlah_bulan}', label: 'Jumlah Bulan' },
                            { tag: '{total_tagihan}', label: 'Total Tagihan' }
                          ].map(v => (
                            <button
                              key={v.tag}
                              type="button"
                              onClick={() => {
                                setBroadcastTemplate(prev => prev + v.tag);
                              }}
                              className="text-[9px] bg-slate-100 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 text-slate-700 hover:text-emerald-700 font-semibold py-0.5 px-1.5 rounded transition cursor-pointer"
                            >
                              {v.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT PANEL: STUDENT ARREARS LIST */}
                  <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full min-h-0">
                    {/* Panel Header & Filter bar */}
                    <div className="p-4 border-b border-slate-100 space-y-2.5 bg-slate-50/50 shrink-0">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-slate-800">Daftar Tunggakan Siswa</h4>
                          <p className="text-[10px] text-slate-500">Pilih baris untuk melihat pratinjau atau kirim tagihan.</p>
                        </div>
                        
                        {/* Summary of listed */}
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold self-start sm:self-auto">
                          {(() => {
                            const studentsInArrears = getStudentsInArrears();
                            const filtered = studentsInArrears.filter(({ siswa }) => {
                              const matchesSearch = siswa.nama.toLowerCase().includes(broadcastSearch.toLowerCase()) || 
                                                    siswa.nis.includes(broadcastSearch);
                              const matchesKelas = broadcastKelas === 'Semua' || siswa.kelas === broadcastKelas;
                              return matchesSearch && matchesKelas;
                            });
                            return filtered.length;
                          })()} Terfilter
                        </span>
                      </div>

                      {/* Filters */}
                      <div className="flex flex-col sm:flex-row gap-2">
                        {/* Search Input */}
                        <div className="relative flex-1">
                          <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2" />
                          <input
                            type="text"
                            value={broadcastSearch}
                            onChange={(e) => setBroadcastSearch(e.target.value)}
                            placeholder="Cari siswa atau NIS..."
                            className="w-full bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 rounded-lg py-1.5 pl-8 pr-3 text-[10px] font-medium"
                          />
                        </div>

                        {/* Class Dropdown */}
                        <select
                          value={broadcastKelas}
                          onChange={(e) => setBroadcastKelas(e.target.value)}
                          className="bg-white border border-slate-200 rounded-lg py-1.5 px-2 text-[10px] font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                        >
                          {classesList.map(kelas => (
                            <option key={kelas} value={kelas}>{kelas === 'Semua' ? 'Semua Kelas' : `Kelas ${kelas}`}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Table / List Container */}
                    <div className="divide-y divide-slate-100 flex-1 min-h-0 overflow-y-auto scrollbar-thin">
                      {(() => {
                        const studentsInArrears = getStudentsInArrears();
                        const filtered = studentsInArrears.filter(({ siswa }) => {
                          const matchesSearch = siswa.nama.toLowerCase().includes(broadcastSearch.toLowerCase()) || 
                                                siswa.nis.includes(broadcastSearch);
                          const matchesKelas = broadcastKelas === 'Semua' || siswa.kelas === broadcastKelas;
                          return matchesSearch && matchesKelas;
                        });

                        return filtered.map(({ siswa, arrears }) => {
                          const isSelected = selectedSiswaPreviewId === siswa.id || (!selectedSiswaPreviewId && studentsInArrears[0]?.siswa.id === siswa.id);
                          const isContacted = contactedSiswaIds.includes(siswa.id);
                          const text = generateBroadcastText(siswa, arrears.length);
                          
                          const handleCopy = (e: React.MouseEvent) => {
                            e.stopPropagation(); // Prevent select row
                            navigator.clipboard.writeText(text);
                            triggerToast(`Teks tagihan ${siswa.nama} berhasil disalin!`);
                          };

                          const handleWA = (e: React.MouseEvent) => {
                            e.stopPropagation(); // Prevent select row
                            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                            // Mark as contacted automatically when sending via WA
                            if (!isContacted) {
                              toggleContacted(siswa.id);
                            }
                          };

                          const handleToggleContactedClick = (e: React.MouseEvent) => {
                            e.stopPropagation(); // Prevent select row
                            toggleContacted(siswa.id);
                          };

                          return (
                            <div
                              key={siswa.id}
                              onClick={() => setSelectedSiswaPreviewId(siswa.id)}
                              className={`p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition cursor-pointer hover:bg-slate-50/80 ${isSelected ? 'bg-emerald-50/40 border-l-4 border-emerald-600 pl-2.5' : ''}`}
                            >
                              <div className="flex items-center gap-3">
                                {/* Checkbox for contacted */}
                                <button
                                  type="button"
                                  onClick={handleToggleContactedClick}
                                  className={`w-4 h-4 rounded border flex items-center justify-center transition shrink-0 cursor-pointer ${isContacted ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 hover:border-emerald-500 bg-white'}`}
                                >
                                  {isContacted && <Check className="w-3 h-3" />}
                                </button>

                                <div>
                                  <h5 className="font-bold text-[11px] text-slate-800 flex items-center gap-1.5">
                                    {siswa.nama}
                                    {isContacted && (
                                      <span className="bg-emerald-100 text-emerald-800 text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-emerald-200 leading-none">
                                        Sudah Hubungi
                                      </span>
                                    )}
                                  </h5>
                                  <p className="text-[9px] text-slate-400 font-medium mt-0.5">
                                    NIS: {siswa.nis} • Kelas: {siswa.kelas}
                                  </p>
                                </div>
                              </div>

                              <div className="flex sm:flex-col items-end gap-2 sm:gap-1 shrink-0 w-full sm:w-auto justify-between sm:justify-start">
                                <div className="text-right">
                                  <span className="bg-rose-50 text-rose-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-rose-100 block sm:inline-block">
                                    {arrears.length} Bulan
                                  </span>
                                  <span className="text-[11px] font-extrabold text-slate-900 block mt-0.5">
                                    {formatRupiah(arrears.length * NOMINAL_SPP)}
                                  </span>
                                </div>

                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={handleCopy}
                                    className="p-1 text-slate-400 hover:text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded transition cursor-pointer"
                                    title="Salin Teks Pesan"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleWA}
                                    className="flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] rounded transition shadow-sm cursor-pointer"
                                  >
                                    <MessageCircle className="w-3 h-3" />
                                    <span>Kirim</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}

                      {(() => {
                        const studentsInArrears = getStudentsInArrears();
                        const filtered = studentsInArrears.filter(({ siswa }) => {
                          const matchesSearch = siswa.nama.toLowerCase().includes(broadcastSearch.toLowerCase()) || 
                                                siswa.nis.includes(broadcastSearch);
                          const matchesKelas = broadcastKelas === 'Semua' || siswa.kelas === broadcastKelas;
                          return matchesSearch && matchesKelas;
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="p-12 text-center text-slate-500 text-[10px]">
                              {studentsInArrears.length === 0 
                                ? "Alhamdulillah, tidak ada siswa yang memiliki tunggakan saat ini!" 
                                : "Tidak ada siswa yang cocok dengan kriteria pencarian."}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                  
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* STUDENT MODAL */}
      <AnimatePresence>
        {isStudentModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-xl max-w-md w-full overflow-hidden shadow-xl"
            >
              <div className="bg-slate-50 border-b border-slate-200 text-slate-900 p-4 flex justify-between items-center">
                <h3 className="font-bold text-sm">{editingStudent ? 'Edit Siswa' : 'Siswa Baru'}</h3>
                <button onClick={() => setIsStudentModalOpen(false)} className="text-slate-500 hover:bg-slate-200 p-1 rounded transition cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={handleSaveStudent} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Nama Lengkap *</label>
                  <input type="text" value={studentForm.nama} onChange={(e) => setStudentForm({ ...studentForm, nama: e.target.value })} className="w-full border rounded-lg py-2 px-3 text-xs" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">NIS *</label>
                  <input type="text" value={studentForm.nis} onChange={(e) => setStudentForm({ ...studentForm, nis: e.target.value })} disabled={!!editingStudent} className="w-full border rounded-lg py-2 px-3 text-xs disabled:bg-slate-100" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Kelas *</label>
                  <select value={studentForm.kelas} onChange={(e) => setStudentForm({ ...studentForm, kelas: e.target.value })} className="w-full border rounded-lg py-2 px-3 text-xs" required>
                    <option value="">Pilih</option>
                    <option value="X-A">X-A</option>
                    <option value="X-B">X-B</option>
                    <option value="XI-A">XI-A</option>
                    <option value="XI-B">XI-B</option>
                    <option value="XII-A">XII-A</option>
                    <option value="XII-C">XII-C</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Email Wali Murid *</label>
                  <input type="email" value={studentForm.email} onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })} className="w-full border rounded-lg py-2 px-3 text-xs" required />
                </div>
                <div className="pt-4 flex justify-end gap-2 border-t mt-4">
                  <p className="text-[10px] text-slate-500 italic flex-1 self-center">
                    * Akun siswa bersifat View-Only (hanya membaca data).
                  </p>
                  <button type="button" onClick={() => setIsStudentModalOpen(false)} className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition">Batal</button>
                  <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition shadow">Simpan</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
