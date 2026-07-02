import React, { useState } from 'react';
import { Database, Copy, Check, Info, ShieldAlert } from 'lucide-react';

export default function SupabaseSQLDialog() {
  const [copied, setCopied] = useState(false);

  const sqlCode = `-- ==========================================
-- SKEMA TABEL SPP - SMA PLUS BABUSSALAM
-- ==========================================

-- 1. Membuat Type untuk Role User
CREATE TYPE user_role AS ENUM ('admin', 'siswa');

-- 2. Membuat Tabel Profiles (Data Akun & Siswa)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nama VARCHAR(255) NOT NULL,
  nis VARCHAR(50) DEFAULT '-',
  kelas VARCHAR(50) DEFAULT '-',
  role user_role NOT NULL DEFAULT 'siswa',
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Membuat Tabel Pembayaran SPP (12 Bulan Ajaran)
CREATE TABLE public.spp_pembayaran (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  siswa_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  tahun_ajaran VARCHAR(20) NOT NULL, -- Contoh: "2025/2026"
  bulan VARCHAR(20) NOT NULL,        -- Contoh: "Juli", "Agustus"
  nominal NUMERIC(12,2) NOT NULL DEFAULT 350000.00,
  tanggal_bayar TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) CHECK (status IN ('lunas', 'belum_bayar')) DEFAULT 'belum_bayar' NOT NULL,
  invoice_no VARCHAR(100),
  dicatat_oleh UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  -- Satu siswa hanya punya 1 record per bulan pada tahun ajaran tertentu
  CONSTRAINT unique_siswa_bulan_tahun UNIQUE(siswa_id, tahun_ajaran, bulan)
);

-- ==========================================
-- KEBIJAKAN ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Aktifkan RLS untuk kedua tabel
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spp_pembayaran ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------
-- KEBIJAKAN UNTUK TABEL: PROFILES
-- ------------------------------------------

-- Admin memiliki akses penuh ke seluruh profiles
CREATE POLICY "Admin has full access on profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE public.profiles.id = auth.uid() AND public.profiles.role = 'admin'
  )
);

-- Siswa hanya boleh membaca profile-nya sendiri
CREATE POLICY "Siswa can select own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- ------------------------------------------
-- KEBIJAKAN UNTUK TABEL: SPP_PEMBAYARAN
-- ------------------------------------------

-- Admin memiliki akses penuh ke seluruh spp_pembayaran
CREATE POLICY "Admin has full access on spp_pembayaran"
ON public.spp_pembayaran
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE public.profiles.id = auth.uid() AND public.profiles.role = 'admin'
  )
);

-- Siswa HANYA boleh membaca data pembayarannya sendiri
CREATE POLICY "Siswa can only select own spp_pembayaran"
ON public.spp_pembayaran
FOR SELECT
TO authenticated
USING (auth.uid() = siswa_id);

-- ==========================================
-- TRIGGER OTOMATIS: BUAT PROFILE SAAT SIGN UP
-- ==========================================
-- Fungsi ini akan dijalankan otomatis saat user baru mendaftar di Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nama, email, role, nis, kelas)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nama', 'Siswa Baru'),
    new.email,
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'siswa'::user_role),
    COALESCE(new.raw_user_meta_data->>'nis', '-'),
    COALESCE(new.raw_user_meta_data->>'kelas', '-')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="supabase-sql-setup" className="bg-slate-950 text-white rounded-xl border border-emerald-800 shadow-2xl p-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-4 border-b border-emerald-900">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-900/50 text-emerald-400 rounded-lg border border-emerald-700/50">
            <Database className="w-6 h-6" id="db-icon-svg" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-emerald-100 flex items-center gap-2">
              Skema Database &amp; RLS Supabase
            </h3>
            <p className="text-xs text-slate-400">
              Gunakan skrip SQL DDL &amp; Row Level Security ini di SQL Editor Supabase Anda.
            </p>
          </div>
        </div>
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-4 py-2 rounded-lg font-medium transition duration-200 shadow-lg shadow-emerald-900/30 w-full sm:w-auto justify-center cursor-pointer"
          id="btn-copy-sql"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              <span>Tersalin!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Salin SQL DDL</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="p-3 bg-emerald-950/30 border border-emerald-900/40 rounded-lg flex gap-2 items-start">
          <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-emerald-300">Row Level Security (RLS)</h4>
            <p className="text-[11px] text-slate-300 mt-0.5">Siswa HANYA memiliki akses <code>SELECT</code> untuk data miliknya sendiri. Akses ubah dilarang.</p>
          </div>
        </div>

        <div className="p-3 bg-emerald-950/30 border border-emerald-900/40 rounded-lg flex gap-2 items-start">
          <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-emerald-300">Otomatisasi Profil</h4>
            <p className="text-[11px] text-slate-300 mt-0.5">Disertakan trigger PostgreSQL otomatis untuk membuat profil siswa baru ketika signup berhasil.</p>
          </div>
        </div>

        <div className="p-3 bg-emerald-950/30 border border-emerald-900/40 rounded-lg flex gap-2 items-start">
          <Database className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-emerald-300">Integritas Relasional</h4>
            <p className="text-[11px] text-slate-300 mt-0.5">Satu baris data per kombinasi unik siswa, tahun ajaran, dan nama bulan berjalan.</p>
          </div>
        </div>
      </div>

      <div className="relative">
        <pre className="text-xs font-mono bg-slate-900/90 p-4 rounded-lg overflow-x-auto text-slate-300 border border-slate-800 h-64 max-h-64 scrollbar-thin scrollbar-thumb-emerald-900 scrollbar-track-slate-950">
          <code>{sqlCode}</code>
        </pre>
        <div className="absolute bottom-2 right-2 bg-slate-950/80 px-2 py-1 rounded text-[10px] text-slate-500 border border-slate-800">
          PL/pgSQL &amp; PostgreSQL DDL
        </div>
      </div>
    </div>
  );
}
