-- Hapus tabel lama jika ada (HATI-HATI JIKA SUDAH ADA DATA PENTING)
DROP TABLE IF EXISTS public.spp_pembayaran CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;

-- Buat tipe
CREATE TYPE user_role AS ENUM ('admin', 'siswa');
CREATE TYPE payment_status AS ENUM ('lunas', 'belum_bayar');

-- Buat tabel profiles
CREATE TABLE public.profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nama TEXT NOT NULL,
  nis TEXT,
  kelas TEXT,
  role user_role NOT NULL DEFAULT 'siswa',
  email TEXT NOT NULL,
  password TEXT -- Kolom baru untuk sistem login hibrida siswa
);

-- Buat tabel spp_pembayaran
CREATE TABLE public.spp_pembayaran (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  siswa_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  tahun_ajaran TEXT NOT NULL,
  bulan TEXT NOT NULL,
  nominal NUMERIC NOT NULL,
  tanggal_bayar DATE,
  status payment_status NOT NULL DEFAULT 'belum_bayar',
  invoice_no TEXT,
  dicatat_oleh UUID REFERENCES public.profiles(id)
);

-- Atur akses publik (Untuk testing / tahap pengembangan)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spp_pembayaran ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for public on profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for public on payments" ON public.spp_pembayaran FOR ALL USING (true) WITH CHECK (true);