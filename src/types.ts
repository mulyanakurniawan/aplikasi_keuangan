export type UserRole = 'admin' | 'siswa';

export interface Profile {
  id: string; // auth.uid()
  nama: string;
  nis: string;
  kelas: string;
  role: UserRole;
  email: string;
}

export interface SppPembayaran {
  id: string;
  siswa_id: string; // references profiles(id)
  tahun_ajaran: string; // e.g. "2025/2026"
  bulan: string; // "Juli" | "Agustus" | ... | "Juni"
  nominal: number;
  tanggal_bayar: string | null;
  status: 'lunas' | 'belum_bayar';
  invoice_no: string | null;
  dicatat_oleh: string | null; // admin_id
}

export interface UserSession {
  user: {
    id: string;
    email: string;
    role: UserRole;
  } | null;
}

export const BULAN_LIST = [
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni'
] as const;

export type BulanType = typeof BULAN_LIST[number];
