import { Profile, SppPembayaran, BULAN_LIST } from '../types';

export const INITIAL_PROFILES: Profile[] = [
  {
    id: 'admin-1',
    nama: 'Hj. Syarifah Aminah, S.E.',
    nis: '-',
    kelas: '-',
    role: 'admin',
    email: 'admin@babussalam.sch.id'
  },
  {
    id: 'admin-dummy',
    nama: 'Admin Dummy',
    nis: '-',
    kelas: '-',
    role: 'admin',
    email: 'admin@dummy.com'
  },
  {
    id: 'siswa-1',
    nama: 'Ahmad Fauzi Al-Anshari',
    nis: '24001',
    kelas: 'X-A',
    role: 'siswa',
    email: 'ahmad.fauzi@babussalam.sch.id'
  },
  {
    id: 'siswa-2',
    nama: 'Siti Maryam Az-Zahra',
    nis: '24002',
    kelas: 'X-A',
    role: 'siswa',
    email: 'siti.maryam@babussalam.sch.id'
  },
  {
    id: 'siswa-3',
    nama: 'Muhammad Rizqi Pratama',
    nis: '23015',
    kelas: 'XI-B',
    role: 'siswa',
    email: 'rizqi.pratama@babussalam.sch.id'
  },
  {
    id: 'siswa-4',
    nama: 'Lailatul Qodriah',
    nis: '22009',
    kelas: 'XII-C',
    role: 'siswa',
    email: 'lailatul.q@babussalam.sch.id'
  },
  {
    id: 'siswa-5',
    nama: 'Yusuf Nur Rahman',
    nis: '22045',
    kelas: 'XII-C',
    role: 'siswa',
    email: 'yusuf.nur@babussalam.sch.id'
  }
];

export const NOMINAL_SPP = 350000; // Rp 350.000 per bulan

// Generate SPP payments for the 2025/2026 Academic Year
export function generateInitialPembayaran(profiles: Profile[]): SppPembayaran[] {
  const pembayaran: SppPembayaran[] = [];
  const siswaProfiles = profiles.filter(p => p.role === 'siswa');

  // Let's seed different histories for students
  // Ahmad Fauzi (siswa-1) has paid July - November
  // Siti Maryam (siswa-2) has paid July - December
  // Muhammad Rizqi (siswa-3) has paid July - September
  // Lailatul Qodriah (siswa-4) has paid July - May (highly paid)
  // Yusuf Nur Rahman (siswa-5) has paid July - October
  
  const paymentLimits: { [siswaId: string]: number } = {
    'siswa-1': 5, // paid 5 months (Jul, Aug, Sep, Oct, Nov)
    'siswa-2': 6, // paid 6 months (Jul, Aug, Sep, Oct, Nov, Dec)
    'siswa-3': 3, // paid 3 months (Jul, Aug, Sep)
    'siswa-4': 11, // paid 11 months (Jul to May)
    'siswa-5': 4  // paid 4 months (Jul to Oct)
  };

  siswaProfiles.forEach(siswa => {
    const limit = paymentLimits[siswa.id] || 0;
    BULAN_LIST.forEach((bulan, index) => {
      const isLunas = index < limit;
      pembayaran.push({
        id: `pay-${siswa.id}-${index}`,
        siswa_id: siswa.id,
        tahun_ajaran: '2025/2026',
        bulan: bulan,
        nominal: NOMINAL_SPP,
        tanggal_bayar: isLunas ? `2025-${String(7 + index > 12 ? index - 5 : index + 7).padStart(2, '0')}-10` : null,
        status: isLunas ? 'lunas' : 'belum_bayar',
        invoice_no: isLunas ? `INV/SPP/2526/${siswa.nis}/${index + 1}` : null,
        dicatat_oleh: isLunas ? 'admin-1' : null
      });
    });
  });

  return pembayaran;
}
