import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { 
  User, 
  Calendar, 
  FileText, 
  Printer, 
  CheckCircle, 
  AlertCircle, 
  LogOut, 
  Shield, 
  BookOpen, 
  DollarSign,
  QrCode,
  Info
} from 'lucide-react';
import autoTable from 'jspdf-autotable';
import { Profile, SppPembayaran, DaftarUlangPembayaran, BULAN_LIST } from '../types';
import { NOMINAL_SPP, NOMINAL_DAFTAR_ULANG } from '../data/mockData';

interface SiswaDashboardProps {
  currentProfile: Profile;
  payments: SppPembayaran[];
  daftarUlangPayments: DaftarUlangPembayaran[];
  onLogout: () => void;
  onOpenSQL: () => void;
}

export default function SiswaDashboard({ currentProfile, payments, daftarUlangPayments, onLogout, onOpenSQL }: SiswaDashboardProps) {
  const [selectedYear, setSelectedYear] = useState('2025/2026');
  const [currentSystemMonth, setCurrentSystemMonth] = useState('Juni'); // Defaulting to June for academic demo

  // Get current student's payments
  const studentPayments = payments.filter(
    p => p.siswa_id === currentProfile.id && p.tahun_ajaran === selectedYear
  );

  const myDaftarUlang = (daftarUlangPayments || []).find(d => d.siswa_id === currentProfile.id && d.tahun_ajaran === selectedYear) || {
    id: 'du-temp',
    siswa_id: currentProfile.id,
    tahun_ajaran: selectedYear,
    nominal: NOMINAL_DAFTAR_ULANG,
    terbayar: 0,
    tanggal_bayar: null,
    status: 'belum_bayar' as const,
    keterangan: 'Paket Seragam, Buku Modul, & Kegiatan Tahunan',
    invoice_no: `INV/DU/2526/${currentProfile.nis}`,
    dicatat_oleh: null
  };

  const handlePrintDaftarUlangReceipt = () => {
    try {
      const doc = new jsPDF();
      doc.setFillColor(0, 168, 89);
      doc.rect(0, 0, 210, 32, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 230, 0);
      doc.setFontSize(16);
      doc.text('YAYASAN AL-BABUSSALAM', 14, 15);
      
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text('KUITANSI RESMI BUKTI PEMBAYARAN DAFTAR ULANG TAHUNAN', 14, 23);

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`No. Invoice: ${myDaftarUlang.invoice_no || 'INV/DU/2526/' + currentProfile.nis}`, 14, 42);
      doc.setFont('helvetica', 'normal');
      doc.text(`Tanggal: ${myDaftarUlang.tanggal_bayar || new Date().toLocaleDateString('id-ID')}`, 140, 42);

      autoTable(doc, {
        startY: 48,
        head: [['IDENTITAS SISWA', 'RINCIAN AKADEMIK']],
        body: [
          [`Nama Siswa : ${currentProfile.nama}`, `Unit Sekolah : ${currentProfile.jenjang || 'Sekolah Babussalam'}`],
          [`NIS        : ${currentProfile.nis}`, `Kelas        : ${currentProfile.kelas}`],
          [`Email Wali : ${currentProfile.email}`, `Tahun Ajaran : ${myDaftarUlang.tahun_ajaran}`]
        ],
        theme: 'striped',
        headStyles: { fillColor: [0, 168, 89], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9 }
      });

      const sisa = Math.max(0, myDaftarUlang.nominal - myDaftarUlang.terbayar);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 8,
        head: [['KOMPONEN DAFTAR ULANG', 'BIAYA TAHUNAN', 'TERBAYAR', 'STATUS']],
        body: [
          [
            myDaftarUlang.keterangan || 'Paket Seragam, Buku Modul, & Kegiatan Tahunan',
            formatRupiah(myDaftarUlang.nominal),
            formatRupiah(myDaftarUlang.terbayar),
            myDaftarUlang.status.toUpperCase()
          ],
          [
            'SISA TUNGGAKAN BIAYA DAFTAR ULANG',
            '-',
            formatRupiah(sisa),
            sisa === 0 ? 'LUNAS' : 'BELUM LUNAS'
          ]
        ],
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 230, 0], fontStyle: 'bold' },
        styles: { fontSize: 9 }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 20;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Bagian Keuangan Sekolah,', 135, finalY);
      doc.text('( Yayasan Al-Babussalam )', 135, finalY + 25);

      doc.save(`Kuitansi_Daftar_Ulang_${currentProfile.nis}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Gagal mencetak kuitansi PDF');
    }
  };

  // Get current month's status
  const currentMonthPayment = studentPayments.find(p => p.bulan === currentSystemMonth);
  const isCurrentMonthLunas = currentMonthPayment?.status === 'lunas';

  // Calculate stats for current student
  const lunasCount = studentPayments.filter(p => p.status === 'lunas').length;
  const belumBayarCount = studentPayments.filter(p => p.status === 'belum_bayar').length;
  const totalPaidNominal = studentPayments
    .filter(p => p.status === 'lunas')
    .reduce((sum, p) => sum + p.nominal, 0);

  // Format currency
  const formatRupiah = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  // Generate Receipt PDF
  const handlePrintReceipt = (pembayaran: SppPembayaran) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a5' // A5 is perfect for receipt/invoice voucher
    });

    // Draw elegant border
    doc.setDrawColor(5, 150, 105); // emerald-600
    doc.setLineWidth(1.2);
    doc.rect(4, 4, doc.internal.pageSize.width - 8, doc.internal.pageSize.height - 8);

    // Header Background Accent
    doc.setFillColor(240, 253, 250); // emerald-50
    doc.rect(4.6, 4.6, doc.internal.pageSize.width - 9.2, 30, 'F');

    // School Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(4, 120, 87); // emerald-700
    doc.text("YAYASAN AL-BABUSSALAM BANDUNG", doc.internal.pageSize.width / 2, 12, { align: "center" });
    doc.setFontSize(14);
    doc.text("SMA PLUS BABUSSALAM", doc.internal.pageSize.width / 2, 19, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text("Kawasan Pendidikan Babussalam No. 45, Ciburial, Bandung Barat", doc.internal.pageSize.width / 2, 24, { align: "center" });
    doc.text("Telp: (022) 2501234 | Email: keuangan@babussalam.sch.id | Terakreditasi A", doc.internal.pageSize.width / 2, 28, { align: "center" });

    // Divider Line
    doc.setDrawColor(16, 185, 129); // emerald-500
    doc.setLineWidth(0.8);
    doc.line(10, 34.6, doc.internal.pageSize.width - 10, 34.6);

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text("KWITANSI BUKTI PEMBAYARAN BIAYA PENDIDIKAN", doc.internal.pageSize.width / 2, 44, { align: "center" });

    // Invoice Meta Information
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(`No. Invoice : ${pembayaran.invoice_no || 'INV/BP/TEMP/' + currentProfile.nis}`, 12, 53);
    doc.text(`Tanggal     : ${pembayaran.tanggal_bayar ? new Date(pembayaran.tanggal_bayar).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : '-'}`, 12, 58);
    doc.text(`Tahun Ajaran: ${pembayaran.tahun_ajaran}`, 12, 63);

    // Student Information Table/Box
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.rect(10, 68, doc.internal.pageSize.width - 20, 23, "FD");

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("IDENTITAS WAJIB BAYAR (SISWA):", 13, 73);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(`Nama Siswa   : ${currentProfile.nama}`, 13, 79);
    doc.text(`NIS / Kelas  : ${currentProfile.nis} / ${currentProfile.kelas}`, 13, 84);

    // Table Header
    doc.setFillColor(16, 185, 129); // emerald-500
    doc.rect(10, 97, doc.internal.pageSize.width - 20, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("Uraian Pembayaran Bulanan", 14, 101.5);
    doc.text("Status", doc.internal.pageSize.width / 2 + 10, 101.5, { align: "center" });
    doc.text("Nominal (Rp)", doc.internal.pageSize.width - 14, 101.5, { align: "right" });

    // Table Content
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.rect(10, 104, doc.internal.pageSize.width - 20, 14);
    doc.text(`Biaya Pendidikan Bulanan`, 14, 110);
    doc.setFont("helvetica", "oblique");
    doc.text(`Bulan ${pembayaran.bulan} (${pembayaran.tahun_ajaran})`, 14, 114);
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(4, 120, 87);
    doc.text("LUNAS", doc.internal.pageSize.width / 2 + 10, 112, { align: "center" });
    
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.text("350.000", doc.internal.pageSize.width - 14, 112, { align: "right" });

    // Total Row
    doc.setFillColor(240, 253, 250);
    doc.rect(10, 118, doc.internal.pageSize.width - 20, 8, "FD");
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL TERBAYAR", 14, 123);
    doc.text("Rp 350.000", doc.internal.pageSize.width - 14, 123, { align: "right" });

    // Spell-out text (Terbilang)
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Terbilang: Tiga Ratus Lima Puluh Ribu Rupiah", 11, 131);

    // Signatures / Footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text("Ciburial, Bandung Barat", doc.internal.pageSize.width - 60, 141);
    doc.text("Kasir / Bendahara TU,", doc.internal.pageSize.width - 57, 145);

    // Emerald Watermark stamp
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.5);
    doc.setFillColor(240, 253, 250);
    doc.rect(doc.internal.pageSize.width - 60, 148, 32, 11, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(4, 120, 87);
    doc.text("SMA PLUS BABUSSALAM", doc.internal.pageSize.width - 44, 152, { align: "center" });
    doc.text("★ LUNAS VERIFIED ★", doc.internal.pageSize.width - 44, 156, { align: "center" });

    // Officer Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text("Hj. Syarifah Aminah, S.E.", doc.internal.pageSize.width - 59, 164);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("NIP. 19781204 200501 2 001", doc.internal.pageSize.width - 59, 167.5);

    // QR Code visual mockup
    doc.setDrawColor(203, 213, 225);
    doc.rect(13, 140, 20, 20);
    // Draw simple pattern in QR box to look like a barcode/QR
    doc.setFillColor(15, 23, 42);
    doc.rect(14, 141, 4, 4, 'F');
    doc.rect(27, 141, 4, 4, 'F');
    doc.rect(14, 154, 4, 4, 'F');
    doc.rect(19, 146, 3, 3, 'F');
    doc.rect(24, 150, 4, 4, 'F');
    doc.rect(21, 155, 3, 2, 'F');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text("Scan QR Validasi", 13, 164);

    // Disclaimer
    doc.setFontSize(6.2);
    doc.setTextColor(148, 163, 184);
    doc.text("Tanda terima ini merupakan bukti sah pembayaran SPP SMA Plus Babussalam.", 10, 178);
    doc.text("Diunduh secara elektronik dan terverifikasi secara instan dengan database keuangan sekolah.", 10, 181);

    // Save
    doc.save(`Kwitansi_SPP_${currentProfile.nis}_Bulan_${pembayaran.bulan}.pdf`);
  };

  const handleDownloadStatement = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Draw border
      doc.setDrawColor(0, 168, 89); // logo-green
      doc.setLineWidth(1.2);
      doc.rect(5, 5, doc.internal.pageSize.width - 10, doc.internal.pageSize.height - 10);

      // Kop Surat Sekolah
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(0, 140, 74); // emerald-700
      doc.text("YAYASAN AL-BABUSSALAM BANDUNG", doc.internal.pageSize.width / 2, 16, { align: "center" });
      doc.setFontSize(14);
      doc.setTextColor(0, 168, 89); // logo-green
      doc.text("SMA PLUS BABUSSALAM", doc.internal.pageSize.width / 2, 23, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text("Kawasan Pendidikan Babussalam No. 45, Ciburial, Bandung Barat", doc.internal.pageSize.width / 2, 28, { align: "center" });
      doc.text("Telp: (022) 2501234 | Email: keuangan@babussalam.sch.id | Terakreditasi A", doc.internal.pageSize.width / 2, 32, { align: "center" });

      // Divider Line
      doc.setDrawColor(255, 230, 0); // logo-yellow
      doc.setLineWidth(0.8);
      doc.line(10, 37, doc.internal.pageSize.width - 10, 37);

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text("SURAT KETERANGAN RINCIAN TAGIHAN SPP", doc.internal.pageSize.width / 2, 48, { align: "center" });

      // Student Meta
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Nama Siswa   : ${currentProfile.nama}`, 15, 58);
      doc.text(`NIS / Kelas  : ${currentProfile.nis} / ${currentProfile.kelas}`, 15, 63);
      doc.text(`Tahun Ajaran : ${selectedYear}`, 15, 68);
      doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 15, 73);

      // Draw Table Header
      let startY = 82;
      doc.setFillColor(0, 168, 89); // logo-green
      doc.rect(15, startY, doc.internal.pageSize.width - 30, 8, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("No", 18, startY + 5.5);
      doc.text("Bulan SPP", 30, startY + 5.5);
      doc.text("Nominal", 75, startY + 5.5);
      doc.text("Status Pembayaran", 115, startY + 5.5);
      doc.text("No. Invoice", 155, startY + 5.5);

      // Draw Rows
      let rowY = startY + 8;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);

      const monthsList = BULAN_LIST;
      monthsList.forEach((bulan, idx) => {
        const p = studentPayments.find(pay => pay.bulan === bulan);
        const statusText = p?.status === 'lunas' ? 'LUNAS' : 'BELUM BAYAR';
        const invoiceText = p?.invoice_no || '-';
        const nominalText = formatRupiah(p?.nominal || 350000);
        
        // Alternate shading
        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252); // slate-50
          doc.rect(15, rowY, doc.internal.pageSize.width - 30, 7.5, "F");
        }
        
        // Draw bottom line for each row
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setLineWidth(0.2);
        doc.line(15, rowY + 7.5, doc.internal.pageSize.width - 15, rowY + 7.5);

        // Print Text
        doc.setFont("helvetica", "normal");
        doc.text(String(idx + 1), 18, rowY + 5);
        doc.text(bulan, 30, rowY + 5);
        doc.text(nominalText, 75, rowY + 5);
        
        if (statusText === 'LUNAS') {
          doc.setFont("helvetica", "bold");
          doc.setTextColor(5, 122, 85); // green text
        } else {
          doc.setFont("helvetica", "bold");
          doc.setTextColor(220, 38, 38); // red text
        }
        doc.text(statusText, 115, rowY + 5);
        
        doc.setFont("helvetica", "normal");
        doc.setTextColor(15, 23, 42);
        doc.text(invoiceText, 155, rowY + 5);
        
        rowY += 7.5;
      });

      // Total Unpaid Summary Box
      rowY += 6;
      const unpaidCount = studentPayments.filter(p => p.status === 'belum_bayar').length;
      const totalUnpaidNominal = studentPayments.filter(p => p.status === 'belum_bayar').reduce((sum, p) => sum + p.nominal, 0);

      doc.setFillColor(254, 242, 242); // red-50
      doc.setDrawColor(254, 202, 202); // red-200
      doc.setLineWidth(0.3);
      doc.rect(15, rowY, doc.internal.pageSize.width - 30, 16, "FD");

      doc.setFont("helvetica", "bold");
      doc.setTextColor(153, 27, 27); // red-800
      doc.text(`RINGKASAN TUNGGAKAN SPP:`, 19, rowY + 6);
      doc.setFont("helvetica", "normal");
      doc.text(`Total Bulan Belum Terbayar: ${unpaidCount} Bulan  •  Total Tagihan Tunggakan: ${formatRupiah(totalUnpaidNominal)}`, 19, rowY + 11);

      // Sign-off
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text("Penting: Keterangan tagihan ini diunduh secara online oleh siswa/orang tua.", 15, rowY + 28);
      doc.text("Diterbitkan secara elektronik oleh SMA Plus Babussalam Bandung.", 15, rowY + 32);

      doc.save(`Rincian_Tagihan_SPP_${currentProfile.nis}.pdf`);
      alert('Rincian tagihan PDF berhasil dicetak!');
    } catch (e) {
      console.error(e);
      alert('Gagal mencetak rincian tagihan!');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="siswa-dashboard-root">
      {/* Top Welcome / Header section */}
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 border border-yellow-500/30 shadow-xl relative overflow-hidden">
        {/* Background ambient glow circles */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-yellow-400/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-emerald-400/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-yellow-400 text-emerald-950 text-[10px] px-3 py-1 rounded-full font-black tracking-widest uppercase border border-yellow-200 shadow-sm inline-block">
                PORTAL KEUANGAN SISWA
              </span>
            </div>
            <h1 className="text-xl md:text-3xl font-black tracking-tight text-white drop-shadow-sm">
              Selamat Datang di Portal Keuangan Siswa
            </h1>
            <p className="text-emerald-200/90 font-medium text-xs">
              SMA Plus Babussalam — Layanan Pembayaran Transparan &amp; Mandiri
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={handleDownloadStatement}
              className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-emerald-950 border border-yellow-300 text-xs px-4 py-2.5 rounded-xl font-black transition-all duration-200 flex items-center gap-2 cursor-pointer shadow-md glow-yellow"
              id="btn-siswa-download-statement"
            >
              <FileText className="w-4 h-4 text-emerald-950" />
              <span>Unduh Rincian Tagihan (PDF)</span>
            </button>
            <button
              onClick={onOpenSQL}
              className="bg-emerald-900/60 hover:bg-emerald-800 text-emerald-100 border border-emerald-700/50 text-xs px-4 py-2.5 rounded-xl font-bold transition duration-200 flex items-center gap-2 cursor-pointer"
              title="Lihat Skema database Supabase"
              id="btn-siswa-view-sql"
            >
              <Shield className="w-4 h-4 text-yellow-400" />
              <span>Skema SQL</span>
            </button>
            <button
              onClick={onLogout}
              className="bg-rose-500/20 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 text-xs px-4 py-2.5 rounded-xl font-bold transition duration-200 flex items-center gap-2 cursor-pointer"
              id="btn-siswa-logout"
            >
              <LogOut className="w-4 h-4 text-rose-300" />
              <span>Keluar</span>
            </button>
          </div>
        </div>

        {/* Short Profile Bar */}
        <div className="mt-8 pt-6 border-t border-yellow-500/20 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs relative z-10">
          <div className="flex items-center gap-3 p-3 bg-emerald-900/40 border border-emerald-700/40 rounded-2xl">
            <div className="p-2 bg-gradient-to-tr from-yellow-400 to-yellow-300 rounded-xl text-emerald-950 shadow-sm">
              <User className="w-4 h-4" />
            </div>
            <div>
              <div className="text-emerald-200/70 text-[10px] uppercase font-bold">Nama Lengkap Siswa</div>
              <div className="font-extrabold text-white text-sm">{currentProfile.nama}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-emerald-900/40 border border-emerald-700/40 rounded-2xl">
            <div className="p-2 bg-gradient-to-tr from-yellow-400 to-yellow-300 rounded-xl text-emerald-950 shadow-sm">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="text-emerald-200/70 text-[10px] uppercase font-bold">Nomor Induk Siswa (NIS)</div>
              <div className="font-extrabold text-white text-sm font-mono">{currentProfile.nis}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-emerald-900/40 border border-emerald-700/40 rounded-2xl">
            <div className="p-2 bg-gradient-to-tr from-yellow-400 to-yellow-300 rounded-xl text-emerald-950 shadow-sm">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="text-emerald-200/70 text-[10px] uppercase font-bold">Kelas Aktif</div>
              <div className="font-extrabold text-white text-sm">Kelas {currentProfile.kelas}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Kelunasan Progress Bar */}
      <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-emerald-500/20 shadow-xl p-6 space-y-3">
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block animate-pulse glow-yellow" />
            <h3 className="font-black text-slate-900 text-sm">Kemajuan Kelunasan Pembayaran Bulanan ({selectedYear})</h3>
          </div>
          <span className="font-black text-emerald-950 bg-gradient-to-r from-yellow-400 to-yellow-500 border border-yellow-300 px-3 py-1 rounded-full shadow-sm">
            {lunasCount} / 12 Bulan Lunas ({Math.round((lunasCount / 12) * 100)}%)
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-4 relative overflow-hidden border border-emerald-100 shadow-inner">
          <div 
            className="bg-gradient-to-r from-emerald-700 via-emerald-500 to-yellow-400 h-full rounded-full transition-all duration-1000 shadow-md"
            style={{ width: `${(lunasCount / 12) * 100}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-500 font-medium">
          * Bar indikator di atas menunjukkan kemajuan pembayaran bulanan siswa untuk tahun ajaran aktif. Total terbayar: <strong className="text-emerald-700 font-bold">{formatRupiah(totalPaidNominal)}</strong>.
        </p>
      </div>

      {/* DAFTAR ULANG TAHUNAN CARD */}
      <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-emerald-500/20 shadow-xl p-6 space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-emerald-100">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl font-bold">
              <Shield className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Status Biaya Daftar Ulang Tahunan ({selectedYear})</h3>
              <p className="text-[10px] text-slate-500">Paket Seragam, Buku Modul Pembelajaran, &amp; Kegiatan Tahunan</p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
            myDaftarUlang.status === 'lunas' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
            myDaftarUlang.status === 'cicilan' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
            'bg-rose-100 text-rose-800 border border-rose-300'
          }`}>
            {myDaftarUlang.status.replace('_', ' ')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Nominal Biaya</span>
            <span className="text-base font-black text-slate-800">{formatRupiah(myDaftarUlang.nominal)}</span>
          </div>

          <div className="p-4 bg-emerald-50/60 border border-emerald-200/70 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-emerald-700 uppercase block">Jumlah Terbayar</span>
            <span className="text-base font-black text-emerald-800">{formatRupiah(myDaftarUlang.terbayar)}</span>
          </div>

          <div className="p-4 bg-amber-50/60 border border-amber-200/70 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold text-amber-700 uppercase block">Sisa Tagihan</span>
            <span className="text-base font-black text-amber-800">{formatRupiah(Math.max(0, myDaftarUlang.nominal - myDaftarUlang.terbayar))}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
          <p className="text-[10px] text-slate-500">
            * Keterangan: {myDaftarUlang.keterangan || 'Paket Seragam, Buku Modul, & Kegiatan Tahunan'}
          </p>

          <button
            onClick={handlePrintDaftarUlangReceipt}
            className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-xs px-4 py-2 rounded-xl font-extrabold transition shadow-md cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak Kuitansi Daftar Ulang
          </button>
        </div>
      </div>

      {/* Main Grid: Status Card (Large Left) and Details Summary (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Status Card SPP Bulan Berjalan */}
        <div className="lg:col-span-2 bg-white/90 backdrop-blur-md rounded-3xl border border-emerald-500/20 shadow-xl p-6 space-y-6 flex flex-col justify-between" id="status-card-spp">
          <div>
            <div className="flex justify-between items-center pb-3 border-b border-emerald-100">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                Status Pembayaran Bulan Berjalan
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-semibold">Bulan Berjalan:</span>
                <select
                  value={currentSystemMonth}
                  onChange={(e) => setCurrentSystemMonth(e.target.value)}
                  className="bg-slate-50 border border-emerald-200 text-xs font-bold text-slate-800 px-3 py-1.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  id="select-siswa-running-month"
                >
                  {BULAN_LIST.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Glowing Status Alert Indicator */}
            <div className="mt-5">
              {isCurrentMonthLunas ? (
                <div className="bg-gradient-to-r from-emerald-900 to-emerald-800 border border-yellow-400/40 rounded-2xl p-5 flex items-start gap-4 shadow-lg glow-emerald text-white">
                  <div className="p-3 bg-yellow-400 text-emerald-950 rounded-2xl shadow-sm shrink-0">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1.5">
                    <span className="bg-yellow-400 text-emerald-950 text-[10px] font-black px-2.5 py-0.5 rounded-full inline-block tracking-widest uppercase border border-yellow-200">
                      LUNAS TERBAYAR
                    </span>
                    <h4 className="text-lg font-black text-white">
                      Pembayaran Bulan {currentSystemMonth} Sudah Lunas
                    </h4>
                    <p className="text-xs text-emerald-100/90 leading-relaxed max-w-xl">
                      Alhamdulillah, pembayaran untuk bulan {currentSystemMonth} telah terverifikasi dengan nomor kwitansi 
                      <code className="mx-1 px-2 py-0.5 bg-emerald-950 rounded-md text-yellow-300 font-mono font-bold border border-yellow-400/30">{currentMonthPayment?.invoice_no}</code>. 
                      Anda dapat mengunduh bukti kwitansi sah di tabel riwayat di bawah.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border border-amber-500/40 rounded-2xl p-5 flex items-start gap-4 shadow-lg text-white">
                  <div className="p-3 bg-amber-500 text-white rounded-2xl shrink-0 animate-pulse">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1.5">
                    <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full inline-block tracking-widest uppercase">
                      BELUM BAYAR
                    </span>
                    <h4 className="text-lg font-black text-amber-200">
                      Pembayaran Bulan {currentSystemMonth} Menunggu Setoran
                    </h4>
                    <p className="text-xs text-amber-100/90 leading-relaxed max-w-xl">
                      Biaya pendidikan sebesar <strong className="text-yellow-400">{formatRupiah(NOMINAL_SPP)}</strong> untuk bulan {currentSystemMonth} belum lunas tercatat. Silakan lakukan pembayaran ke Bendahara Sekolah di Kantor Tata Usaha Babussalam.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-50 border border-emerald-100 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs text-slate-600">
            <div className="flex gap-3 items-center">
              <div className="p-2 bg-emerald-100 rounded-xl text-emerald-700">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-slate-800">QRIS &amp; Transfer Bank Babussalam</div>
                <div className="text-[10px] text-slate-500">Bank Muamalat: 123-456-7890 (Yayasan Babussalam)</div>
              </div>
            </div>
            {isCurrentMonthLunas && currentMonthPayment && (
              <button
                onClick={() => handlePrintReceipt(currentMonthPayment)}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-600 hover:to-yellow-500 text-white font-extrabold px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer shadow-md hover:shadow-lg w-full sm:w-auto justify-center glow-emerald"
                id="btn-print-current-receipt"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Kwitansi {currentSystemMonth}</span>
              </button>
            )}
          </div>
        </div>

        {/* Summary Mini Box */}
        <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-emerald-500/20 shadow-xl p-6 space-y-4" id="siswa-spp-summary-card">
          <h3 className="font-extrabold text-slate-900 text-sm pb-3 border-b border-emerald-100 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            Ringkasan Keuangan
          </h3>
          
          <div className="space-y-4 pt-1">
            <div>
              <div className="text-xs text-slate-500 font-medium">Tahun Ajaran Berjalan</div>
              <div className="text-lg font-black text-slate-900">{selectedYear}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <span className="text-[10px] text-emerald-800 font-extrabold block uppercase">Lunas (Bulan)</span>
                <span className="text-2xl font-black text-emerald-700">{lunasCount} / 12</span>
              </div>
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
                <span className="text-[10px] text-amber-800 font-extrabold block uppercase">Tunggakan (Bulan)</span>
                <span className="text-2xl font-black text-amber-700">{belumBayarCount}</span>
              </div>
            </div>

            <div className="p-4 bg-gradient-to-r from-emerald-950 to-emerald-900 text-white border border-yellow-400/30 rounded-2xl flex items-center justify-between shadow-md glow-emerald">
              <div>
                <span className="text-[10px] text-yellow-400 font-black uppercase block">Total Terbayar</span>
                <span className="text-lg font-black text-white">{formatRupiah(totalPaidNominal)}</span>
              </div>
              <div className="p-2.5 bg-yellow-400 text-emerald-950 rounded-xl font-black shadow-sm">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-slate-600 font-bold">
                <span>Rasio Kepatuhan Pembayaran</span>
                <span className="text-emerald-700">{Math.round((lunasCount / 12) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 border border-emerald-100 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-emerald-600 to-yellow-400 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${(lunasCount / 12) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* History Table - Matriks 12 Bulan (Juli - Juni) */}
      <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-emerald-500/20 shadow-xl overflow-hidden" id="siswa-spp-matrix-table">
        <div className="p-6 pb-4 border-b border-emerald-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm">
              Riwayat Pembayaran &amp; Matriks 12 Bulan
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Daftar rinci status setoran siswa per bulan dari bulan Juli s/d Juni untuk tahun ajaran aktif.
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 font-bold">Filter Tahun Ajaran:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-slate-50 border border-emerald-200 text-xs text-slate-800 px-3 py-1.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold cursor-pointer"
              id="select-siswa-tahun-ajaran"
            >
              <option value="2025/2026">2025/2026</option>
              <option value="2024/2025">2024/2025</option>
            </select>
          </div>
        </div>

        {/* Matrix View optimized for both Desktop and Mobile */}
        <div className="overflow-x-auto">
          
          {/* Desktop Table */}
          <table className="w-full text-left border-collapse hidden md:table">
            <thead>
              <tr className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 text-yellow-300 font-black text-[10px] uppercase tracking-wider sticky top-0">
                <th className="py-4 px-6">Bulan</th>
                <th className="py-4 px-6">Tahun Ajaran</th>
                <th className="py-4 px-6">Nominal Biaya</th>
                <th className="py-4 px-6 text-center">Status</th>
                <th className="py-4 px-6">Tanggal Pembayaran</th>
                <th className="py-4 px-6">No. Bukti / Invoice</th>
                <th className="py-4 px-6 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-100/60 text-slate-700 text-sm">
              {BULAN_LIST.map((bulanName) => {
                const record = studentPayments.find(p => p.bulan === bulanName);
                const isLunas = record?.status === 'lunas';
                
                return (
                  <tr key={bulanName} className="hover:bg-emerald-50/40 transition-colors">
                    <td className="py-4 px-6 font-extrabold text-slate-900">{bulanName}</td>
                    <td className="py-4 px-6 text-slate-500 font-medium">{selectedYear}</td>
                    <td className="py-4 px-6 text-slate-700 font-bold">{formatRupiah(NOMINAL_SPP)}</td>
                    <td className="py-4 px-6 text-center">
                      {isLunas ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 text-[10px] font-black px-3 py-1 rounded-full border border-emerald-300">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          Lunas
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 text-[10px] font-black px-3 py-1 rounded-full border border-amber-300">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          Belum Bayar
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-slate-600 font-medium">
                      {isLunas && record.tanggal_bayar ? (
                        new Date(record.tanggal_bayar).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })
                      ) : (
                        <span className="text-slate-400 font-light">—</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      {isLunas && record.invoice_no ? (
                        <span className="font-mono text-xs text-slate-800 font-bold bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 shadow-xs">
                          {record.invoice_no}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-light">—</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {isLunas && record ? (
                        <button
                          onClick={() => handlePrintReceipt(record)}
                          className="inline-flex items-center gap-1.5 bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-600 hover:to-yellow-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl border border-emerald-600 transition cursor-pointer shadow-sm glow-emerald"
                          id={`btn-print-receipt-${bulanName}`}
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Kwitansi PDF</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Belum ada dokumen</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
 
          {/* Mobile Grid Layout */}
          <div className="md:hidden p-4 space-y-4">
            {BULAN_LIST.map((bulanName) => {
              const record = studentPayments.find(p => p.bulan === bulanName);
              const isLunas = record?.status === 'lunas';
 
              return (
                <div 
                  key={bulanName}
                  className={`p-4 rounded-2xl border ${
                    isLunas ? 'bg-gradient-to-br from-emerald-50 to-white border-emerald-300' : 'bg-gradient-to-br from-amber-50/50 to-white border-slate-200'
                  } space-y-3 shadow-sm`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-black text-slate-900 text-base">{bulanName}</span>
                    <div>
                      {isLunas ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-300">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          LUNAS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-300">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          BELUM BAYAR
                        </span>
                      )}
                    </div>
                  </div>
 
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Nominal Tagihan</span>
                      <span className="font-extrabold text-slate-900">{formatRupiah(NOMINAL_SPP)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Tahun Ajaran</span>
                      <span className="font-semibold text-slate-700">{selectedYear}</span>
                    </div>
                  </div>
 
                  {isLunas && record && (
                    <div className="space-y-2.5 pt-2 border-t border-slate-100">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">Tgl Bayar</span>
                          <span className="font-medium text-slate-700">
                            {record.tanggal_bayar ? new Date(record.tanggal_bayar).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">No. Invoice</span>
                          <span className="font-mono text-[10px] text-slate-800 font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {record.invoice_no}
                          </span>
                        </div>
                      </div>
 
                      <button
                        onClick={() => handlePrintReceipt(record)}
                        className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-600 hover:to-yellow-500 text-white font-bold py-2.5 px-3 rounded-xl text-xs w-full transition duration-150 cursor-pointer shadow-md glow-emerald"
                        id={`btn-mobile-print-${bulanName}`}
                      >
                        <Printer className="w-4 h-4" />
                        <span>Cetak Bukti Kwitansi (PDF)</span>
                      </button>
                    </div>
                  )}
 
                  {!isLunas && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center gap-2 text-[11px] text-amber-900 font-medium">
                      <Info className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>Segera lakukan pembayaran ke loket TU Bendahara Sekolah.</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
