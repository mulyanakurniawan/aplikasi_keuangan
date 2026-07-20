import { Profile, SppPembayaran, BULAN_LIST } from '../types';

export const INITIAL_PROFILES: Profile[] = [
  {
    id: 'admin-1',
    nama: 'Super Admin Yayasan',
    nis: '-',
    kelas: '-',
    role: 'admin',
    email: 'admin@babussalam.sch.id',
    no_hp: '-'
  },
  {
    id: 'admin-sd-1',
    nama: 'Admin SD Babussalam',
    nis: '-',
    kelas: '-',
    role: 'admin_sd',
    jenjang: 'SD',
    email: 'admin.sd@babussalam.sch.id',
    no_hp: '628120000001'
  },
  {
    id: 'admin-smp-1',
    nama: 'Admin SMP Babussalam',
    nis: '-',
    kelas: '-',
    role: 'admin_smp',
    jenjang: 'SMP',
    email: 'admin.smp@babussalam.sch.id',
    no_hp: '628120000002'
  },
  {
    id: 'admin-sma-1',
    nama: 'Admin SMA Babussalam',
    nis: '-',
    kelas: '-',
    role: 'admin_sma',
    jenjang: 'SMA',
    email: 'admin.sma@babussalam.sch.id',
    no_hp: '628120000003'
  },
  // Sample SD Students
  {
    id: 'siswa-sd-1',
    nama: 'Bagus Prakoso',
    nis: '1001',
    kelas: '1-A',
    role: 'siswa',
    jenjang: 'SD',
    email: '1001@babussalam.sch.id',
    password: 'password123',
    no_hp: '628131111001'
  },
  {
    id: 'siswa-sd-2',
    nama: 'Aisyah Putri',
    nis: '1002',
    kelas: '4-B',
    role: 'siswa',
    jenjang: 'SD',
    email: '1002@babussalam.sch.id',
    password: 'password123',
    no_hp: '628131111002'
  },
  // Sample SMP Students
  {
    id: 'siswa-smp-1',
    nama: 'Dimas Kurniawan',
    nis: '2001',
    kelas: 'VII-A',
    role: 'siswa',
    jenjang: 'SMP',
    email: '2001@babussalam.sch.id',
    password: 'password123',
    no_hp: '628132222001'
  },
  {
    id: 'siswa-smp-2',
    nama: 'Nabila Zahra',
    nis: '2002',
    kelas: 'IX-B',
    role: 'siswa',
    jenjang: 'SMP',
    email: '2002@babussalam.sch.id',
    password: 'password123',
    no_hp: '628132222002'
  },
  // Sample SMA Students
  {
    id: 'siswa-sma-1',
    nama: 'Ahmad Fauzi',
    nis: '24001',
    kelas: 'X-A',
    role: 'siswa',
    jenjang: 'SMA',
    email: '24001@babussalam.sch.id',
    password: 'password123',
    no_hp: '628133333001'
  },
  {
    id: 'siswa-sma-2',
    nama: 'Siti Maryam',
    nis: '24002',
    kelas: 'XI-IPA',
    role: 'siswa',
    jenjang: 'SMA',
    email: '24002@babussalam.sch.id',
    password: 'password123',
    no_hp: '628133333002'
  }
];

export const NOMINAL_SPP = 350000; // Rp 350.000 per bulan

// Generate SPP payments for the 2025/2026 Academic Year
export function generateInitialPembayaran(profiles: Profile[]): SppPembayaran[] {
  const pembayaran: SppPembayaran[] = [];
  const siswaProfiles = profiles.filter(p => p.role === 'siswa');

  const paymentLimits: { [siswaId: string]: number } = {
    'siswa-sd-1': 6,
    'siswa-sd-2': 4,
    'siswa-smp-1': 5,
    'siswa-smp-2': 10,
    'siswa-sma-1': 5,
    'siswa-sma-2': 6
  };

  siswaProfiles.forEach(siswa => {
    const limit = paymentLimits[siswa.id] || 3;
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
