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
import { Profile, SppPembayaran, BULAN_LIST } from '../types';
import { NOMINAL_SPP } from '../data/mockData';

interface SiswaDashboardProps {
  currentProfile: Profile;
  payments: SppPembayaran[];
  onLogout: () => void;
  onOpenSQL: () => void;
}

export default function SiswaDashboard({ currentProfile, payments, onLogout, onOpenSQL }: SiswaDashboardProps) {
  const [selectedYear, setSelectedYear] = useState('2025/2026');
  const [currentSystemMonth, setCurrentSystemMonth] = useState('Juni'); // Defaulting to June for academic demo

  // Get current student's payments
  const studentPayments = payments.filter(
    p => p.siswa_id === currentProfile.id && p.tahun_ajaran === selectedYear
  );

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
    doc.text("KWITANSI BUKTI PEMBAYARAN SPP", doc.internal.pageSize.width / 2, 44, { align: "center" });

    // Invoice Meta Information
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(`No. Invoice : ${pembayaran.invoice_no || 'INV/SPP/TEMP/' + currentProfile.nis}`, 12, 53);
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
    doc.text("Uraian SPP Bulanan", 14, 101.5);
    doc.text("Status", doc.internal.pageSize.width / 2 + 10, 101.5, { align: "center" });
    doc.text("Nominal (Rp)", doc.internal.pageSize.width - 14, 101.5, { align: "right" });

    // Table Content
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.rect(10, 104, doc.internal.pageSize.width - 20, 14);
    doc.text(`Sumbangan Pembinaan Pendidikan (SPP)`, 14, 110);
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
      <div className="bg-white rounded-xl p-6 text-slate-800 border border-slate-200 shadow-sm relative overflow-hidden">
        
        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <span className="bg-emerald-50 text-emerald-800 text-[10px] px-2.5 py-1 rounded-full font-bold border border-emerald-250 tracking-wider uppercase inline-block">
              PORTAL KEUANGAN SISWA
            </span>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
              Selamat Datang di Portal Keuangan Siswa
            </h1>
            <p className="text-slate-500 font-medium text-xs">
              SMA Plus Babussalam — Layanan Pembayaran Transparan &amp; Mandiri
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleDownloadStatement}
              className="bg-emerald-600 hover:bg-emerald-700 text-white border border-transparent text-xs px-4 py-2 rounded-lg font-medium transition duration-200 flex items-center gap-2 cursor-pointer shadow-sm"
              id="btn-siswa-download-statement"
            >
              <FileText className="w-4 h-4 text-yellow-350" />
              <span>Unduh Rincian Tagihan (PDF)</span>
            </button>
            <button
              onClick={onOpenSQL}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs px-4 py-2 rounded-lg font-medium transition duration-200 flex items-center gap-2 cursor-pointer shadow-xs"
              title="Lihat Skema database Supabase"
              id="btn-siswa-view-sql"
            >
              <Shield className="w-4 h-4 text-slate-500" />
              <span>Skema Supabase SQL</span>
            </button>
            <button
              onClick={onLogout}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 text-xs px-4 py-2 rounded-lg font-medium transition duration-200 flex items-center gap-2 cursor-pointer"
              id="btn-siswa-logout"
            >
              <LogOut className="w-4 h-4 text-rose-500" />
              <span>Keluar</span>
            </button>
          </div>
        </div>

        {/* Short Profile Bar */}
        <div className="mt-6 pt-5 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-slate-50 border border-slate-200 rounded">
              <User className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <div className="text-slate-400">Nama Lengkap Siswa</div>
              <div className="font-bold text-slate-800 text-sm">{currentProfile.nama}</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-slate-50 border border-slate-200 rounded">
              <Calendar className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <div className="text-slate-400">Nomor Induk Siswa (NIS)</div>
              <div className="font-bold text-slate-800 text-sm">{currentProfile.nis}</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-slate-50 border border-slate-200 rounded">
              <BookOpen className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <div className="text-slate-400">Kelas Aktif</div>
              <div className="font-bold text-slate-800 text-sm">Kelas {currentProfile.kelas}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Kelunasan Progress Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3">
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block animate-pulse" />
            <h3 className="font-bold text-slate-800 text-sm">Kemajuan Kelunasan SPP Tahunan ({selectedYear})</h3>
          </div>
          <span className="font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded-full">
            {lunasCount} / 12 Bulan Lunas ({Math.round((lunasCount / 12) * 100)}%)
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3.5 relative overflow-hidden border border-slate-200/50 shadow-inner">
          <div 
            className="bg-gradient-to-r from-emerald-600 to-yellow-400 h-full rounded-full transition-all duration-1000 shadow-sm"
            style={{ width: `${(lunasCount / 12) * 100}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-400 font-medium">
          * Bar indikator di atas menunjukkan kemajuan pembayaran SPP bulanan siswa untuk tahun ajaran aktif. Total SPP terbayar: <strong className="text-slate-700">{formatRupiah(totalPaidNominal)}</strong>.
        </p>
      </div>

      {/* Main Grid: Status Card (Large Left) and Details Summary (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Status Card SPP Bulan Berjalan */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6 flex flex-col justify-between" id="status-card-spp">
          <div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-850 text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Status SPP Bulan Berjalan
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Bulan Berjalan:</span>
                <select
                  value={currentSystemMonth}
                  onChange={(e) => setCurrentSystemMonth(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 px-2.5 py-1 rounded-lg focus:outline-none cursor-pointer"
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
                <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-5 flex items-start gap-4 transition duration-300">
                  <div className="p-3 bg-emerald-600 text-white rounded-full">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md inline-block tracking-wider uppercase">
                      LUNAS TERBAYAR
                    </span>
                    <h4 className="text-base font-bold text-emerald-950">
                      SPP Bulan {currentSystemMonth} Sudah Lunas
                    </h4>
                    <p className="text-xs text-emerald-700 leading-relaxed max-w-xl">
                      Alhamdulillah, pembayaran untuk bulan {currentSystemMonth} telah terverifikasi dengan nomor kwitansi 
                      <code className="mx-1 px-1 py-0.5 bg-emerald-100 rounded text-emerald-800 font-semibold">{currentMonthPayment?.invoice_no}</code>. 
                      Anda dapat mengunduh bukti kwitansi sah di tabel riwayat di bawah.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50/50 border border-amber-250 rounded-xl p-5 flex items-start gap-4 transition duration-300">
                  <div className="p-3 bg-amber-500 text-white rounded-full animate-pulse">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <span className="bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md inline-block tracking-wider uppercase">
                      BELUM BAYAR
                    </span>
                    <h4 className="text-base font-bold text-amber-950">
                      SPP Bulan {currentSystemMonth} Menunggu Pembayaran
                    </h4>
                    <p className="text-xs text-amber-800 leading-relaxed max-w-xl">
                      Sumbangan SPP sebesar {formatRupiah(NOMINAL_SPP)} untuk bulan {currentSystemMonth} belum lunas tercatat. Silakan lakukan pembayaran ke Bendahara Sekolah di Kantor Tata Usaha SMA Plus Babussalam.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs text-slate-600">
            <div className="flex gap-2 items-center">
              <QrCode className="w-5 h-5 text-slate-500" />
              <div>
                <span className="font-bold text-slate-700 block">Metode Pembayaran</span>
                <span>Tunai via Kasir Sekolah / Transfer Bank Syariah Mandiri (BSI)</span>
              </div>
            </div>
            {isCurrentMonthLunas && currentMonthPayment && (
              <button
                onClick={() => handlePrintReceipt(currentMonthPayment)}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3.5 py-2 rounded-lg transition duration-200 cursor-pointer shadow-sm w-full sm:w-auto justify-center"
                id="btn-print-current-receipt"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Kwitansi {currentSystemMonth}</span>
              </button>
            )}
          </div>
        </div>

        {/* Summary Mini Box */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4" id="siswa-spp-summary-card">
          <h3 className="font-bold text-slate-850 text-sm pb-3 border-b border-slate-200 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            Ringkasan Keuangan
          </h3>
          
          <div className="space-y-4.5 pt-2">
            <div>
              <div className="text-xs text-slate-500">Tahun Ajaran Berjalan</div>
              <div className="text-base font-bold text-slate-800">{selectedYear}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-emerald-50/40 border border-emerald-200 rounded-lg">
                <span className="text-[10px] text-slate-500 block">Lunas (Bulan)</span>
                <span className="text-xl font-bold text-emerald-700">{lunasCount} / 12</span>
              </div>
              <div className="p-3 bg-amber-50/40 border border-amber-200 rounded-lg">
                <span className="text-[10px] text-slate-500 block">Tunggakan (Bulan)</span>
                <span className="text-xl font-bold text-amber-700">{belumBayarCount}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 block">Total SPP Terbayar</span>
                <span className="text-lg font-bold text-emerald-600">{formatRupiah(totalPaidNominal)}</span>
              </div>
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                <span>Rasio Kepatuhan SPP</span>
                <span>{Math.round((lunasCount / 12) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div 
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${(lunasCount / 12) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* History Table - Matriks 12 Bulan (Juli - Juni) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" id="siswa-spp-matrix-table">
        <div className="p-6 pb-4 border-b border-slate-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h3 className="font-bold text-slate-850 text-sm">
              Riwayat Pembayaran &amp; Matriks SPP 12 Bulan
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Daftar rinci status setoran SPP siswa per bulan dari bulan Juli s/d Juni untuk tahun ajaran aktif.
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Filter Tahun Ajaran:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-white border border-slate-200 text-xs text-slate-700 px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold cursor-pointer"
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
              <tr className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200 sticky top-0">
                <th className="py-4 px-6">Bulan</th>
                <th className="py-4 px-6">Tahun Ajaran</th>
                <th className="py-4 px-6">Nominal SPP</th>
                <th className="py-4 px-6 text-center">Status</th>
                <th className="py-4 px-6">Tanggal Pembayaran</th>
                <th className="py-4 px-6">No. Bukti / Invoice</th>
                <th className="py-4 px-6 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150/60 text-slate-700 text-sm">
              {BULAN_LIST.map((bulanName) => {
                const record = studentPayments.find(p => p.bulan === bulanName);
                const isLunas = record?.status === 'lunas';
                
                return (
                  <tr key={bulanName} className="hover:bg-slate-50/50 transition">
                    <td className="py-4 px-6 font-semibold text-slate-800">{bulanName}</td>
                    <td className="py-4 px-6 text-slate-500">{selectedYear}</td>
                    <td className="py-4 px-6 text-slate-600 font-medium">{formatRupiah(NOMINAL_SPP)}</td>
                    <td className="py-4 px-6 text-center">
                      {isLunas ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          Lunas
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          Belum Bayar
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-slate-500">
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
                        <span className="font-mono text-xs text-slate-600 font-semibold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
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
                          className="inline-flex items-center gap-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 transition cursor-pointer"
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
 
          {/* Mobile Grid Layout (Super User-Friendly Card List) */}
          <div className="md:hidden p-4 space-y-4">
            {BULAN_LIST.map((bulanName) => {
              const record = studentPayments.find(p => p.bulan === bulanName);
              const isLunas = record?.status === 'lunas';
 
              return (
                <div 
                  key={bulanName}
                  className={`p-4 rounded-lg border ${
                    isLunas ? 'bg-emerald-50/10 border-emerald-200' : 'bg-slate-50/30 border-slate-200'
                  } space-y-3 shadow-xs`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800 text-base">{bulanName}</span>
                    <div>
                      {isLunas ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          LUNAS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-250">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          BELUM BAYAR
                        </span>
                      )}
                    </div>
                  </div>
 
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                    <div>
                      <span className="text-slate-450 block text-[10px] uppercase font-semibold">Nominal Tagihan</span>
                      <span className="font-bold text-slate-700">{formatRupiah(NOMINAL_SPP)}</span>
                    </div>
                    <div>
                      <span className="text-slate-450 block text-[10px] uppercase font-semibold">Tahun Ajaran</span>
                      <span className="font-semibold text-slate-600">{selectedYear}</span>
                    </div>
                  </div>
 
                  {isLunas && record && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-semibold">Tgl Bayar</span>
                          <span className="font-medium text-slate-600">
                            {record.tanggal_bayar ? new Date(record.tanggal_bayar).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}) : '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase font-semibold">No. Invoice</span>
                          <span className="font-mono text-[10px] text-slate-700 font-bold bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
                            {record.invoice_no}
                          </span>
                        </div>
                      </div>
 
                      <button
                        onClick={() => handlePrintReceipt(record)}
                        className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-3 rounded-lg text-xs w-full transition duration-150 cursor-pointer shadow-sm"
                        id={`btn-mobile-print-${bulanName}`}
                      >
                        <Printer className="w-4 h-4" />
                        <span>Cetak Bukti Kwitansi (PDF)</span>
                      </button>
                    </div>
                  )}
 
                  {!isLunas && (
                    <div className="bg-amber-500/10 border border-amber-400/20 rounded-lg p-2 flex items-center gap-1.5 text-[11px] text-amber-800">
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
