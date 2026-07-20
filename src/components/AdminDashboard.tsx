import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, TrendingUp, AlertTriangle, Percent, Plus, Edit2, Trash2, Check, X, Download, FileSpreadsheet, FileText, Search, Calendar, LogOut, Database, ArrowRight, UserPlus, RefreshCw, Clock, Printer, ChevronRight, MessageCircle, Menu, Wallet, Copy
} from 'lucide-react';
import { Profile, SppPembayaran, BULAN_LIST, BulanType, JenjangType } from '../types';
import { NOMINAL_SPP } from '../data/mockData';
import { supabase } from '../lib/supabase';
const generateUUID = () => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

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
  payments: allPayments,
  currentProfile,
  onUpdateProfiles,
  onUpdatePayments,
  onLogout,
  onOpenSQL
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'ringkasan' | 'siswa' | 'pembayaran' | 'broadcast'>('ringkasan');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Jenjang filtering based on user role or selection
  const isSuperAdmin = currentProfile.role === 'admin';
  const initialJenjang = currentProfile.role === 'admin_sd' ? 'SD' 
    : currentProfile.role === 'admin_smp' ? 'SMP' 
    : currentProfile.role === 'admin_sma' ? 'SMA' : 'Semua';

  const [activeJenjangFilter, setActiveJenjangFilter] = useState<'Semua' | 'SD' | 'SMP' | 'SMA'>(initialJenjang);

  // Filter students based on Jenjang
  const siswaProfiles = profiles.filter(p => {
    if (p.role !== 'siswa') return false;
    if (activeJenjangFilter === 'Semua') return true;
    if (p.jenjang) return p.jenjang === activeJenjangFilter;
    const k = (p.kelas || '').toUpperCase();
    if (activeJenjangFilter === 'SD') return k.startsWith('1') || k.startsWith('2') || k.startsWith('3') || k.startsWith('4') || k.startsWith('5') || k.startsWith('6') || k.includes('SD');
    if (activeJenjangFilter === 'SMP') return k.startsWith('7') || k.startsWith('8') || k.startsWith('9') || k.includes('VII') || k.includes('VIII') || k.includes('IX') || k.includes('SMP');
    if (activeJenjangFilter === 'SMA') return k.startsWith('10') || k.startsWith('11') || k.startsWith('12') || k.includes('X') || k.includes('XI') || k.includes('XII') || k.includes('SMA');
    return true;
  });

  const siswaIds = new Set(siswaProfiles.map(s => s.id));
  const payments = allPayments.filter(p => siswaIds.has(p.siswa_id));

  const unitBrandName = activeJenjangFilter === 'SD' ? 'SD PLUS BABUSSALAM'
    : activeJenjangFilter === 'SMP' ? 'SMP PLUS BABUSSALAM'
    : activeJenjangFilter === 'SMA' ? 'SMA PLUS BABUSSALAM'
    : 'YAYASAN AL-BABUSSALAM (SUPER ADMIN)';

  const unitRoleName = currentProfile.role === 'admin_sd' ? 'Admin SD'
    : currentProfile.role === 'admin_smp' ? 'Admin SMP'
    : currentProfile.role === 'admin_sma' ? 'Admin SMA'
    : 'Super Admin';

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

Mohon kerjasamanya untuk segera melakukan pelunasan ke bagian Tata Usaha Sekolah Babussalam.

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
    siswaProfiles[0]?.id || ''
  );

  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Profile | null>(null);
  const [studentForm, setStudentForm] = useState({ 
    nama: '', 
    nis: '', 
    kelas: '', 
    jenjang: (activeJenjangFilter !== 'Semua' ? activeJenjangFilter : 'SMA') as JenjangType,
    email: '', 
    password: '', 
    no_hp: '' 
  });

  // Excel Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importDefaultKelas, setImportDefaultKelas] = useState('X-A');
  const [importResults, setImportResults] = useState<{ 
    nama: string; 
    nis: string; 
    kelas?: string; 
    email?: string; 
    no_hp?: string; 
    password: string;
  }[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportUploaded, setIsImportUploaded] = useState(false);

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const triggerToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const classesList = ['Semua', ...Array.from(new Set(siswaProfiles.map(s => s.kelas))).filter(Boolean)];

  const totalUangMasuk = payments.filter(p => p.status === 'lunas').reduce((sum, p) => sum + p.nominal, 0);
  const totalTunggakan = payments.filter(p => p.status === 'belum_bayar').reduce((sum, p) => sum + p.nominal, 0);

  const paymentsInBulan = payments.filter(p => p.bulan === currentSelectedBulan);
  const paidInBulan = paymentsInBulan.filter(p => p.status === 'lunas');
  const percentagePaidThisMonth = paymentsInBulan.length > 0 ? Math.round((paidInBulan.length / paymentsInBulan.length) * 100) : 0;

  const formatRupiah = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  const handleOpenImportModal = () => {
    setImportResults(null);
    setImportDefaultKelas('X-A');
    setIsImportUploaded(false);
    setIsImporting(false);
    setIsImportModalOpen(true);
  };

  const handleDownloadTemplate = () => {
    try {
      const wsData = [
        { 
          'Nama': 'Ahmad Ridwan',
          'NIS': '24001',
          'Kelas': 'X-A',
          'Email': 'wali.ahmad@babussalam.sch.id',
          'No HP': '628123456789',
          'Password': 'rahasiaahmad'
        },
        { 
          'Nama': 'Siti Sarah',
          'NIS': '',
          'Kelas': '',
          'Email': '',
          'No HP': '',
          'Password': ''
        }
      ];
      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template Siswa');
      XLSX.writeFile(wb, 'Template_Import_Siswa.xlsx');
      triggerToast('Template Excel berhasil diunduh!');
    } catch (e) {
      console.error(e);
      triggerToast('Gagal mengunduh template!', 'error');
    }
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert worksheet to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
        
        const parsed: { 
          nama: string; 
          nis: string; 
          kelas?: string; 
          email?: string; 
          no_hp?: string; 
          password: string; 
        }[] = [];
        
        jsonData.forEach((row) => {
          let nama = '';
          const keys = Object.keys(row);
          // Look for 'Nama' or 'Name' or similar column header
          const nameKey = keys.find(k => k.toLowerCase() === 'nama' || k.toLowerCase() === 'name');
          if (nameKey) {
            nama = String(row[nameKey]).trim();
          } else if (keys.length > 0) {
            nama = String(row[keys[0]]).trim();
          }

          if (nama) {
            // Find NIS/Username
            const nisKey = keys.find(k => k.toLowerCase() === 'nis' || k.toLowerCase() === 'username' || k.toLowerCase() === 'nisn');
            let providedNis = nisKey ? String(row[nisKey]).trim() : '';

            // Clean username: all lowercase, alphanumeric only, no spaces
            let baseUsername = providedNis 
              ? providedNis.toLowerCase().replace(/[^a-z0-9]/g, '') 
              : nama.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!baseUsername) baseUsername = 'siswa';
            
            // Check duplicates in active profiles and parsed array
            let nis = baseUsername;
            let counter = 1;
            const isNisTaken = (username: string) => {
              return profiles.some(p => p.nis === username) || parsed.some(p => p.nis === username);
            };

            while (isNisTaken(nis)) {
              counter++;
              nis = `${baseUsername}${counter}`;
            }

            // Get Kelas from row
            const kelasKey = keys.find(k => k.toLowerCase() === 'kelas' || k.toLowerCase() === 'class');
            let kelas = kelasKey ? String(row[kelasKey]).trim() : '';

            // Get Email from row
            const emailKey = keys.find(k => k.toLowerCase() === 'email' || k.toLowerCase() === 'email wali');
            let email = emailKey ? String(row[emailKey]).trim() : '';

            // Get No HP from row
            const noHpKey = keys.find(k => k.toLowerCase() === 'no hp' || k.toLowerCase() === 'nohp' || k.toLowerCase() === 'phone' || k.toLowerCase() === 'whatsapp' || k.toLowerCase() === 'no_hp');
            let noHp = noHpKey ? String(row[noHpKey]).trim() : '';
            if (noHp) {
              noHp = noHp.replace(/[^0-9]/g, '');
              if (noHp.startsWith('08')) {
                noHp = '628' + noHp.slice(2);
              }
            }

            // Get Password from row, generate if empty
            const passwordKey = keys.find(k => k.toLowerCase() === 'password' || k.toLowerCase() === 'pass' || k.toLowerCase() === 'sandi');
            let password = passwordKey ? String(row[passwordKey]).trim() : '';
            if (!password) {
              const randNum = Math.floor(1000 + Math.random() * 9000);
              password = `Babus${randNum}`;
            }

            parsed.push({ 
              nama, 
              nis, 
              kelas: kelas || undefined,
              email: email || undefined,
              no_hp: noHp || undefined,
              password 
            });
          }
        });

        if (parsed.length === 0) {
          triggerToast('Tidak ada data siswa yang valid ditemukan di file Excel!', 'error');
        } else {
          setImportResults(parsed);
          triggerToast(`Berhasil membaca ${parsed.length} siswa dari Excel!`);
        }
      } catch (err) {
        console.error(err);
        triggerToast('Gagal memproses file Excel!', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const insertProfilesWithFallback = async (profilesList: any[]) => {
    let payloads = profilesList.map(p => ({ ...p }));
    let { error } = await supabase.from('profiles').insert(payloads);

    if (error && error.message?.includes('no_hp')) {
      payloads = payloads.map(p => { const copy = { ...p }; delete copy.no_hp; return copy; });
      const res = await supabase.from('profiles').insert(payloads);
      error = res.error;
    }

    if (error && error.message?.includes('password')) {
      payloads = payloads.map(p => { const copy = { ...p }; delete copy.password; return copy; });
      const res = await supabase.from('profiles').insert(payloads);
      error = res.error;
    }

    return error;
  };

  const updateProfileWithFallback = async (id: string, updates: any) => {
    let payload = { ...updates };
    let { error } = await supabase.from('profiles').update(payload).eq('id', id);

    if (error && error.message?.includes('no_hp')) {
      delete payload.no_hp;
      const res = await supabase.from('profiles').update(payload).eq('id', id);
      error = res.error;
    }

    if (error && error.message?.includes('password')) {
      delete payload.password;
      const res = await supabase.from('profiles').update(payload).eq('id', id);
      error = res.error;
    }

    return error;
  };

  const handleUploadImportedStudents = async () => {
    if (!importResults || importResults.length === 0) return;
    setIsImporting(true);
    
    try {
      const newProfiles: Profile[] = [];
      const newPayments: any[] = [];
      
      importResults.forEach((student) => {
        const studentId = generateUUID();
        
        newProfiles.push({
          id: studentId,
          nama: student.nama,
          nis: student.nis,
          kelas: student.kelas || importDefaultKelas,
          role: 'siswa',
          email: student.email || `${student.nis}@babussalam.sch.id`,
          password: student.password,
          no_hp: student.no_hp || null
        });
        
        // Generate SPP payments for the year
        BULAN_LIST.forEach((bulan) => {
          newPayments.push({
            id: generateUUID(),
            siswa_id: studentId,
            tahun_ajaran: '2025/2026',
            bulan: bulan,
            nominal: NOMINAL_SPP,
            tanggal_bayar: null,
            status: 'belum_bayar',
            invoice_no: null,
            dicatat_oleh: null
          });
        });
      });

      // Update state locally first
      onUpdateProfiles([...profiles, ...newProfiles]);
      onUpdatePayments([...payments, ...newPayments]);
      
      // Upload profiles to Supabase with schema fallback
      const pError = await insertProfilesWithFallback(newProfiles);
      if (!pError) {
        await supabase.from('spp_pembayaran').insert(newPayments);
      }
      
      onOpenSQL(); // refresh lists
      triggerToast(`Berhasil menyimpan ${importResults.length} siswa baru!`);
      setIsImportUploaded(true);
      setIsImportModalOpen(false);
      setImportResults(null);
    } catch (err: any) {
      console.error(err);
      triggerToast(`Gagal mengunggah data: ${err.message || 'Error'}`, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportCredentials = () => {
    if (!importResults) return;
    try {
      const wsData = importResults.map((s, idx) => ({
        'No': idx + 1,
        'Nama': s.nama,
        'Username / NIS': s.nis,
        'Password': s.password,
        'Kelas': s.kelas || importDefaultKelas,
        'Email Wali': s.email || `${s.nis}@babussalam.sch.id`,
        'No HP': s.no_hp || '-'
      }));
      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Kredensial Siswa');
      XLSX.writeFile(wb, `Kredensial_Siswa_Baru.xlsx`);
      triggerToast('Daftar kredensial berhasil diunduh!');
    } catch (e) {
      console.error(e);
      triggerToast('Gagal mengekspor kredensial!', 'error');
    }
  };

  const handleOpenAddModal = () => {
    setEditingStudent(null);
    setStudentForm({ nama: '', nis: '', kelas: '', email: '', password: '', no_hp: '' });
    setIsStudentModalOpen(true);
  };

  const handleOpenEditModal = (siswa: Profile) => {
    setEditingStudent(siswa);
    setStudentForm({ 
      nama: siswa.nama, 
      nis: siswa.nis, 
      kelas: siswa.kelas, 
      email: siswa.email,
      password: siswa.password || `Siswa${siswa.nis}`,
      no_hp: siswa.no_hp || ''
    });
    setIsStudentModalOpen(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.nama.trim()) {
      triggerToast('Harap isi Nama Lengkap siswa!', 'error');
      return;
    }

    if (editingStudent) {
      const finalKelas = studentForm.kelas.trim() || 'X-A';
      const finalEmail = studentForm.email.trim() || (editingStudent.email || `${editingStudent.nis || 'siswa'}@babussalam.sch.id`);
      const finalPassword = studentForm.password.trim() || (editingStudent.password || `Siswa${editingStudent.nis || ''}`);

      const updatedObj: Profile = {
        ...editingStudent,
        nama: studentForm.nama,
        nis: studentForm.nis || editingStudent.nis,
        kelas: finalKelas,
        email: finalEmail,
        password: finalPassword,
        no_hp: studentForm.no_hp || null
      };

      onUpdateProfiles(profiles.map(p => p.id === editingStudent.id ? updatedObj : p));

      const error = await updateProfileWithFallback(editingStudent.id, {
        nama: studentForm.nama,
        nis: studentForm.nis || editingStudent.nis,
        kelas: finalKelas,
        email: finalEmail,
        password: finalPassword,
        no_hp: studentForm.no_hp || null
      });
      if (error) { 
        console.error('Update profile error:', error);
      }
      onOpenSQL();
      triggerToast('Data siswa berhasil diperbarui!');
      setIsStudentModalOpen(false);
      setStudentForm({ nama: '', nis: '', kelas: '', email: '', password: '', no_hp: '' });
    } else {
      let finalNis = studentForm.nis.trim();
      if (!finalNis) {
        let baseUsername = studentForm.nama.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!baseUsername) baseUsername = 'siswa';
        
        let counter = 1;
        finalNis = baseUsername;
        const isNisTaken = (username: string) => {
          return profiles.some(p => p.nis === username);
        };
        while (isNisTaken(finalNis)) {
          counter++;
          finalNis = `${baseUsername}${counter}`;
        }
      } else {
        const isNisExists = profiles.some(p => p.nis === finalNis);
        if (isNisExists) {
          triggerToast(`NIS ${finalNis} sudah digunakan siswa lain!`, 'error');
          return;
        }
      }
      
      const finalKelas = studentForm.kelas || 'X-A';
      const finalEmail = studentForm.email.trim() || `${finalNis}@babussalam.sch.id`;
      const finalPassword = studentForm.password.trim() || `Siswa${finalNis}`;
      
      const newSiswaId = generateUUID();
      
      const newProfile: Profile = { 
        id: newSiswaId, 
        role: 'siswa', 
        nama: studentForm.nama,
        nis: finalNis,
        kelas: finalKelas,
        email: finalEmail,
        password: finalPassword,
        no_hp: studentForm.no_hp || null
      };
      const newSppRecords: SppPembayaran[] = BULAN_LIST.map((bulan) => ({
        id: generateUUID(),
        siswa_id: newSiswaId,
        tahun_ajaran: '2025/2026',
        bulan: bulan,
        nominal: NOMINAL_SPP,
        tanggal_bayar: null,
        status: 'belum_bayar',
        invoice_no: null,
        dicatat_oleh: null
      }));

      // Update state locally immediately
      onUpdateProfiles([...profiles, newProfile]);
      onUpdatePayments([...payments, ...newSppRecords]);
      
      // Async insert to Supabase
      const pError = await insertProfilesWithFallback([newProfile]);
      if (!pError) {
        await supabase.from('spp_pembayaran').insert(newSppRecords);
      } else {
        console.error('Supabase profile insert info:', pError);
      }

      onOpenSQL(); // refresh data
      setSelectedSiswaId(newSiswaId);
      setIsStudentModalOpen(false);
      setStudentForm({ nama: '', nis: '', kelas: '', email: '', password: '', no_hp: '' });
      triggerToast(`Akun "${newProfile.nama}" berhasil dibuat! (NIS: ${finalNis} | Pass: ${finalPassword})`);
    }
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
      <div className="md:hidden absolute w-full bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 text-white p-4 flex justify-between items-center shadow-lg border-b border-yellow-500/30 z-30">
        <div className="flex items-center gap-2.5 font-black text-sm">
          <div className="p-1.5 bg-gradient-to-tr from-emerald-600 to-yellow-400 rounded-lg text-emerald-950 shadow-sm">
            <Wallet className="w-4 h-4" />
          </div>
          <span className="tracking-tight">Panel Bendahara</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-emerald-800/80 hover:bg-emerald-700 rounded-xl border border-emerald-600/50">
          <Menu className="w-5 h-5 text-yellow-300" />
        </button>
      </div>

      {/* SIDEBAR NAVIGATION */}
      <motion.div 
        initial={false}
        animate={{ x: isMobileMenuOpen ? 0 : (window.innerWidth < 768 ? -300 : 0) }}
        className={`fixed md:relative w-72 bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950 border-r border-yellow-500/20 flex-shrink-0 h-full z-40 transition-transform duration-300 md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col shadow-2xl`}
      >
        {/* Sidebar Header / Logo */}
        <div className="p-6 h-20 flex justify-between items-center border-b border-yellow-500/20 mt-14 md:mt-0 bg-emerald-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-emerald-600 via-emerald-500 to-yellow-400 rounded-xl flex items-center justify-center shadow-md glow-yellow animate-bounce-slow">
              <Wallet className="w-5 h-5 text-emerald-950" />
            </div>
            <div>
              <span className="font-black text-white text-sm tracking-tight block">SMA BABUSSALAM</span>
              <span className="text-[9px] font-black text-yellow-400 uppercase tracking-widest bg-yellow-400/10 px-1.5 py-0.5 rounded border border-yellow-400/20">Admin SPP</span>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-emerald-200 hover:text-white p-1.5 bg-emerald-800/60 rounded-xl border border-emerald-600/40">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto py-6 space-y-2 px-3">
          <p className="px-4 text-[10px] font-black text-yellow-400/90 uppercase tracking-widest mb-3">Menu Utama</p>

          <button 
            onClick={() => {setActiveTab('ringkasan'); setIsMobileMenuOpen(false);}} 
            className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm rounded-2xl transition-all duration-200 cursor-pointer font-bold ${
              activeTab === 'ringkasan' 
                ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-emerald-950 shadow-lg glow-yellow scale-[1.02]' 
                : 'text-emerald-100 hover:bg-emerald-800/50 hover:text-yellow-300 font-semibold'
            }`}
          >
            <TrendingUp className={`w-5 h-5 ${activeTab === 'ringkasan' ? 'text-emerald-950' : 'text-yellow-400'}`} /> 
            Ringkasan &amp; Laporan
          </button>

          <button 
            onClick={() => {setActiveTab('siswa'); setIsMobileMenuOpen(false);}} 
            className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm rounded-2xl transition-all duration-200 cursor-pointer font-bold ${
              activeTab === 'siswa' 
                ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-emerald-950 shadow-lg glow-yellow scale-[1.02]' 
                : 'text-emerald-100 hover:bg-emerald-800/50 hover:text-yellow-300 font-semibold'
            }`}
          >
            <Users className={`w-5 h-5 ${activeTab === 'siswa' ? 'text-emerald-950' : 'text-yellow-400'}`} /> 
            Manajemen Siswa
          </button>

          <button 
            onClick={() => {setActiveTab('pembayaran'); setIsMobileMenuOpen(false);}} 
            className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm rounded-2xl transition-all duration-200 cursor-pointer font-bold ${
              activeTab === 'pembayaran' 
                ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-emerald-950 shadow-lg glow-yellow scale-[1.02]' 
                : 'text-emerald-100 hover:bg-emerald-800/50 hover:text-yellow-300 font-semibold'
            }`}
          >
            <Wallet className={`w-5 h-5 ${activeTab === 'pembayaran' ? 'text-emerald-950' : 'text-yellow-400'}`} /> 
            Entri SPP Siswa
          </button>

          <button 
            onClick={() => {setActiveTab('broadcast'); setIsMobileMenuOpen(false);}} 
            className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm rounded-2xl transition-all duration-200 cursor-pointer font-bold ${
              activeTab === 'broadcast' 
                ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-emerald-950 shadow-lg glow-yellow scale-[1.02]' 
                : 'text-emerald-100 hover:bg-emerald-800/50 hover:text-yellow-300 font-semibold'
            }`}
          >
            <MessageCircle className={`w-5 h-5 ${activeTab === 'broadcast' ? 'text-emerald-950' : 'text-yellow-400'}`} /> 
            Broadcast Tagihan
          </button>
        </div>
        
        {/* Sidebar Footer (Profile & Actions) */}
        <div className="p-4 border-t border-yellow-500/20 bg-emerald-950/80">
          <div className="flex items-center justify-between gap-2 p-2.5 bg-gradient-to-r from-emerald-900 to-emerald-950 border border-emerald-700/50 rounded-2xl shadow-md">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-yellow-400 to-yellow-300 text-emerald-950 font-black flex items-center justify-center text-xs shrink-0 shadow-md">
                {currentProfile.nama.slice(0,2).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <span className="text-xs font-extrabold text-white block truncate">{currentProfile.nama}</span>
                <span className="text-[9px] text-emerald-200/80 block truncate font-mono">{currentProfile.email}</span>
              </div>
            </div>
            <button 
              onClick={onLogout} 
              className="p-2 text-rose-300 hover:text-white hover:bg-rose-600/90 rounded-xl transition cursor-pointer shrink-0 border border-rose-500/30"
              title="Keluar dari sistem"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 pt-20 md:pt-6 bg-slate-50 bg-mesh-pattern relative flex flex-col">
        
        {/* TOAST NOTIFICATION */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div 
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`fixed bottom-5 right-5 z-50 p-4 rounded-2xl border shadow-2xl flex items-center gap-3 ${toastMessage.type === 'success' ? 'bg-gradient-to-r from-emerald-900 to-emerald-800 border-yellow-400/40 text-white glow-emerald' : 'bg-gradient-to-r from-rose-900 to-rose-800 border-rose-500/40 text-white'}`}
            >
              {toastMessage.type === 'success' ? <div className="p-1.5 bg-yellow-400 text-emerald-950 rounded-full font-black"><Check className="w-4 h-4" /></div> : <div className="p-1.5 bg-rose-500 text-white rounded-full"><X className="w-4 h-4" /></div>}
              <span className="text-xs font-extrabold">{toastMessage.text}</span>
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
            className="w-full max-w-6xl mx-auto space-y-5 flex-1 flex flex-col"
          >
            {activeTab === 'ringkasan' && (
              <div className="space-y-5">
                {/* UNIT / JENJANG SELECTOR BAR */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-emerald-100 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Unit Sekolah:</span>
                    <span className="text-xs font-extrabold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200/80 shadow-xs">{unitBrandName}</span>
                  </div>

                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl w-full sm:w-auto overflow-x-auto">
                    {isSuperAdmin ? (
                      (['Semua', 'SD', 'SMP', 'SMA'] as const).map(j => (
                        <button
                          key={j}
                          type="button"
                          onClick={() => {
                            setActiveJenjangFilter(j);
                            setFilterKelas('Semua');
                            setBroadcastKelas('Semua');
                          }}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap ${
                            activeJenjangFilter === j
                              ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-md'
                              : 'text-slate-600 hover:text-emerald-700 hover:bg-slate-200'
                          }`}
                        >
                          {j === 'Semua' ? '🏛️ Semua Unit' : j === 'SD' ? '🏫 SD' : j === 'SMP' ? '🏫 SMP' : '🏫 SMA'}
                        </button>
                      ))
                    ) : (
                      <span className="px-3.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-100 rounded-xl">
                        Akses Terkunci: {unitRoleName} ({activeJenjangFilter})
                      </span>
                    )}
                  </div>
                </div>

                {/* Header Actions untuk Tab Ringkasan */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 p-6 rounded-3xl border border-yellow-500/30 shadow-xl relative overflow-hidden shrink-0">
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-400/10 rounded-full blur-2xl pointer-events-none"></div>
                  <div className="relative z-10 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-yellow-400 text-emerald-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Dashboard Keuangan ({activeJenjangFilter})</span>
                    </div>
                    <h2 className="font-black text-white text-lg tracking-tight">Ringkasan &amp; Laporan Keuangan</h2>
                    <p className="text-xs text-emerald-200/80 font-medium">Pantau arus kas masuk dan tingkat kepatuhan pembayaran SPP siswa {activeJenjangFilter !== 'Semua' ? `unit ${activeJenjangFilter}` : 'seluruh unit'}.</p>
                  </div>
                  <button onClick={handleExportExcel} className="mt-3 sm:mt-0 flex items-center gap-2 bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-emerald-950 px-5 py-3 rounded-2xl text-xs font-black transition-all shadow-md hover:shadow-xl cursor-pointer glow-yellow relative z-10">
                    <FileSpreadsheet className="w-4 h-4" />
                    Unduh Laporan Excel
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 shrink-0">
                  {/* Stat Card 1: Kas Masuk */}
                  <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 border border-yellow-400/30 p-6 rounded-3xl shadow-xl glow-emerald relative overflow-hidden group hover:scale-[1.01] transition-transform">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Wallet className="w-20 h-20 text-yellow-300" />
                    </div>
                    <span className="text-[10px] text-yellow-400 font-black tracking-widest uppercase bg-yellow-400/10 px-2.5 py-1 rounded-full border border-yellow-400/20">Kas Masuk SPP</span>
                    <div className="mt-4 space-y-1">
                      <h2 className="text-2xl font-black text-white">{formatRupiah(totalUangMasuk)}</h2>
                      <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-bold">
                        <Check className="w-3.5 h-3.5 text-yellow-400" />
                        <span>Status Lunas</span>
                      </div>
                    </div>
                  </div>

                  {/* Stat Card 2: Outstanding */}
                  <div className="bg-gradient-to-br from-slate-900 via-amber-950/70 to-slate-900 border border-amber-500/40 p-6 rounded-3xl shadow-xl relative overflow-hidden group hover:scale-[1.01] transition-transform">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <AlertTriangle className="w-20 h-20 text-amber-400" />
                    </div>
                    <span className="text-[10px] text-amber-400 font-black tracking-widest uppercase bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">Outstanding Tunggakan</span>
                    <div className="mt-4 space-y-1">
                      <h2 className="text-2xl font-black text-amber-200">{formatRupiah(totalTunggakan)}</h2>
                      <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Belum Terbayar</span>
                      </div>
                    </div>
                  </div>

                  {/* Stat Card 3: Kepatuhan */}
                  <div className="bg-gradient-to-br from-emerald-950 via-emerald-900 to-yellow-950/50 border border-yellow-400/40 p-6 rounded-3xl shadow-xl glow-yellow flex flex-col justify-between relative overflow-hidden group hover:scale-[1.01] transition-transform">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-yellow-400 font-black tracking-widest uppercase">Kepatuhan SPP</span>
                          <select
                            value={currentSelectedBulan}
                            onChange={(e) => setCurrentSelectedBulan(e.target.value as BulanType)}
                            className="bg-emerald-950 border border-yellow-400/40 text-[10px] font-black text-yellow-300 px-2 py-0.5 rounded-lg cursor-pointer focus:outline-none"
                          >
                            {BULAN_LIST.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </div>
                        <h2 className="text-2xl font-black text-white mt-3">{percentagePaidThisMonth}%</h2>
                      </div>
                      <div className="w-12 h-12 rounded-full border-4 border-yellow-400 border-t-emerald-400 flex items-center justify-center bg-emerald-950 shadow-inner">
                        <span className="text-[11px] font-black text-yellow-300">{percentagePaidThisMonth}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl border border-emerald-500/20 shadow-xl space-y-6">
                  <div className="flex justify-between items-center pb-3 border-b border-emerald-100">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm">Rasio Pelunasan SPP 12 Bulan</h3>
                      <p className="text-[10px] text-slate-500">Persentase pelunasan siswa di setiap bulan tahun ajaran.</p>
                    </div>
                  </div>
                  <div className="relative pt-4 h-44 flex items-end justify-between gap-2 border-b border-emerald-100">
                    {BULAN_LIST.map((bulanName) => {
                      const totalInMonth = payments.filter(p => p.bulan === bulanName).length;
                      const paidInMonth = payments.filter(p => p.bulan === bulanName && p.status === 'lunas').length;
                      const pct = totalInMonth > 0 ? (paidInMonth / totalInMonth) * 100 : 0;
                      return (
                        <div key={bulanName} className="flex-1 flex flex-col items-center group relative z-10">
                          <div className="w-full bg-slate-100/80 rounded-t-xl h-32 flex items-end overflow-hidden border border-emerald-100">
                            <motion.div 
                              initial={{ height: 0 }}
                              animate={{ height: `${pct}%` }}
                              transition={{ duration: 0.5 }}
                              className="w-full bg-gradient-to-t from-emerald-700 via-emerald-500 to-yellow-400 group-hover:from-emerald-600 group-hover:to-yellow-300 rounded-t-xl shadow-md"
                            />
                          </div>
                          <span className="text-[10px] font-extrabold text-slate-600 mt-2 truncate w-full text-center">{bulanName.slice(0, 3)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'siswa' && (
              <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-emerald-500/20 shadow-xl overflow-hidden">
                <div className="p-6 pb-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-slate-850 text-sm">Daftar Induk Siswa</h3>
                    <p className="text-[11px] text-slate-500 mt-1">Klik nama siswa untuk melihat rincian pembayaran SPP mereka langsung.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleOpenImportModal} className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs px-4 py-2 rounded-lg cursor-pointer transition shadow-sm">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600 animate-pulse" /> Import Excel
                    </button>
                    <button onClick={handleOpenAddModal} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2 rounded-lg cursor-pointer">
                      <UserPlus className="w-4 h-4" /> Tambah Siswa
                    </button>
                  </div>
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
                            const formattedPhone = siswa.no_hp ? siswa.no_hp.replace(/[^0-9]/g, '') : '';
                            const waUrl = formattedPhone 
                              ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`
                              : `https://wa.me/?text=${encodeURIComponent(text)}`;
                            window.open(waUrl, '_blank');
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
                                    NIS: {siswa.nis} • Kelas: {siswa.kelas} {siswa.no_hp && `• WA: +${siswa.no_hp}`}
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
                  <label className="text-xs font-bold text-slate-600">NIS (Opsional)</label>
                  <input 
                    type="text" 
                    value={studentForm.nis} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setStudentForm(prev => ({
                        ...prev,
                        nis: val,
                        password: !editingStudent && (prev.password === '' || prev.password === `Siswa${prev.nis}`) ? `Siswa${val}` : prev.password
                      }));
                    }} 
                    disabled={!!editingStudent} 
                    className="w-full border rounded-lg py-2 px-3 text-xs disabled:bg-slate-100" 
                    placeholder="Auto-generate jika dikosongkan"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">Jenjang *</label>
                    <select 
                      value={studentForm.jenjang} 
                      onChange={(e) => setStudentForm({ ...studentForm, jenjang: e.target.value as JenjangType, kelas: '' })} 
                      disabled={!isSuperAdmin && activeJenjangFilter !== 'Semua'}
                      className="w-full border rounded-lg py-2 px-3 text-xs font-bold bg-slate-50"
                    >
                      <option value="SD">SD Babussalam</option>
                      <option value="SMP">SMP Babussalam</option>
                      <option value="SMA">SMA Babussalam</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">Kelas (Opsional)</label>
                    <select value={studentForm.kelas} onChange={(e) => setStudentForm({ ...studentForm, kelas: e.target.value })} className="w-full border rounded-lg py-2 px-3 text-xs font-medium">
                      <option value="">Auto {studentForm.jenjang === 'SD' ? '1-A' : studentForm.jenjang === 'SMP' ? 'VII-A' : 'X-A'}</option>
                      {studentForm.jenjang === 'SD' && (
                        <>
                          <option value="1-A">1-A</option>
                          <option value="1-B">1-B</option>
                          <option value="2-A">2-A</option>
                          <option value="3-A">3-A</option>
                          <option value="4-B">4-B</option>
                          <option value="5-A">5-A</option>
                          <option value="6-A">6-A</option>
                        </>
                      )}
                      {studentForm.jenjang === 'SMP' && (
                        <>
                          <option value="VII-A">VII-A</option>
                          <option value="VII-B">VII-B</option>
                          <option value="VIII-A">VIII-A</option>
                          <option value="VIII-B">VIII-B</option>
                          <option value="IX-A">IX-A</option>
                          <option value="IX-B">IX-B</option>
                        </>
                      )}
                      {studentForm.jenjang === 'SMA' && (
                        <>
                          <option value="X-A">X-A</option>
                          <option value="X-B">X-B</option>
                          <option value="XI-IPA">XI-IPA</option>
                          <option value="XI-IPS">XI-IPS</option>
                          <option value="XII-IPA">XII-IPA</option>
                          <option value="XII-IPS">XII-IPS</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Email Wali Murid (Opsional)</label>
                  <input type="email" value={studentForm.email} onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })} placeholder="nama@domain.com" className="w-full border rounded-lg py-2 px-3 text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">No. HP / WhatsApp Wali Murid (Mulai dengan 62 - Opsional)</label>
                  <input type="text" value={studentForm.no_hp} onChange={(e) => setStudentForm({ ...studentForm, no_hp: e.target.value })} placeholder="Contoh: 628123456789" className="w-full border rounded-lg py-2 px-3 text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Password Akun Siswa (Opsional)</label>
                  <input 
                    type="text" 
                    value={studentForm.password} 
                    onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })} 
                    className="w-full border rounded-lg py-2 px-3 text-xs" 
                    placeholder="Sandi login murid (default: Siswa[NIS])" 
                  />
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

      {/* EXCEL IMPORT MODAL */}
      <AnimatePresence>
        {isImportModalOpen && (
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
              className="bg-white rounded-xl max-w-2xl w-full overflow-hidden shadow-xl"
            >
              <div className="bg-slate-50 border-b border-slate-200 text-slate-900 p-4 flex justify-between items-center">
                <h3 className="font-bold text-sm">Import Siswa dari Excel</h3>
                <button onClick={() => setIsImportModalOpen(false)} className="text-slate-500 hover:bg-slate-200 p-1 rounded transition cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                
                {/* Steps and Template info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                    <h4 className="font-bold text-xs text-slate-700">Langkah 1: Unduh & Isi Template</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Unduh template Excel resmi kami. Cukup isi kolom <strong>Nama</strong> dengan daftar nama siswa baru Anda.
                    </p>
                    <button 
                      type="button" 
                      onClick={handleDownloadTemplate} 
                      className="flex items-center gap-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-lg cursor-pointer transition shadow-sm font-semibold animate-pulse"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" /> Unduh Template Excel
                    </button>
                  </div>
                  
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                    <h4 className="font-bold text-xs text-slate-700">Langkah 2: Pilih Kelas & Unggah</h4>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-600 block">Kelas Tujuan Siswa:</label>
                      <select 
                        value={importDefaultKelas} 
                        onChange={(e) => setImportDefaultKelas(e.target.value)} 
                        className="w-full border bg-white rounded-lg py-1.5 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        disabled={isImportUploaded || isImporting}
                      >
                        <option value="X-A">X-A</option>
                        <option value="X-B">X-B</option>
                        <option value="XI-A">XI-A</option>
                        <option value="XI-B">XI-B</option>
                        <option value="XII-A">XII-A</option>
                        <option value="XII-C">XII-C</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Upload Action */}
                {!isImportUploaded && (
                  <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center py-6 text-center space-y-3 bg-slate-50/30">
                    <FileSpreadsheet className="w-10 h-10 text-slate-400" />
                    <div>
                      <p className="text-xs font-bold text-slate-700">Pilih File Excel Hasil Pengisian</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Mendukung format file .xlsx, .xls</p>
                    </div>
                    <label className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition shadow-sm">
                      Pilih File
                      <input 
                        type="file" 
                        accept=".xlsx, .xls" 
                        onChange={handleExcelImport} 
                        className="hidden" 
                        disabled={isImporting}
                      />
                    </label>
                  </div>
                )}

                {/* Preview Parsed Results */}
                {importResults && importResults.length > 0 && (
                  <div className="space-y-2 border-t pt-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-xs text-slate-700">
                        {isImportUploaded ? 'Siswa Berhasil Ditambahkan' : 'Preview Data Siswa yang Terdeteksi'} ({importResults.length} Siswa)
                      </h4>
                      
                      {isImportUploaded && (
                        <button 
                          onClick={handleExportCredentials}
                          className="flex items-center gap-1.5 bg-yellow-450 hover:bg-yellow-500 text-emerald-950 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition shadow"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-800" /> Unduh Kredensial (Excel)
                        </button>
                      )}
                    </div>
                    
                    <div className="border border-slate-205 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold sticky top-0">
                          <tr>
                            <th className="p-2.5">No</th>
                            <th className="p-2.5">Nama Lengkap</th>
                            <th className="p-2.5">Username / NIS</th>
                            <th className="p-2.5">Password</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {importResults.map((student, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="p-2.5 font-bold text-slate-400">{idx + 1}</td>
                              <td className="p-2.5 font-bold text-slate-800">{student.nama}</td>
                              <td className="p-2.5 font-mono text-emerald-700 bg-emerald-50/30 font-semibold">{student.nis}</td>
                              <td className="p-2.5 font-mono text-slate-600">{student.password}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {isImportUploaded && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-bold">
                        Akun siswa di atas berhasil dibuat dengan status View-Only. Harap unduh daftar kredensial Excel di atas untuk membagikan username & password kepada siswa yang bersangkutan.
                      </div>
                    )}
                  </div>
                )}

              </div>
              <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsImportModalOpen(false)} 
                  className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs px-4 py-2 rounded-lg font-bold cursor-pointer transition"
                >
                  {isImportUploaded ? 'Selesai & Tutup' : 'Batal'}
                </button>
                
                {!isImportUploaded && importResults && importResults.length > 0 && (
                  <button 
                    type="button" 
                    onClick={handleUploadImportedStudents} 
                    disabled={isImporting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2 rounded-lg font-bold cursor-pointer transition shadow disabled:bg-slate-350 flex items-center gap-1.5"
                  >
                    {isImporting ? 'Menyimpan...' : 'Simpan Ke Database'}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
