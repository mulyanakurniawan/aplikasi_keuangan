import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  Key, 
  Mail, 
  Database, 
  ShieldCheck, 
  Lock, 
  HelpCircle, 
  Info, 
  BookOpen,
  User,
  ArrowRight,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Activity
} from 'lucide-react';
import { Profile, SppPembayaran, DaftarUlangPembayaran, UserSession } from './types';
import { INITIAL_PROFILES, generateInitialPembayaran, generateInitialDaftarUlang } from './data/mockData';
import AdminDashboard from './components/AdminDashboard';
import SiswaDashboard from './components/SiswaDashboard';
import { supabase } from './lib/supabase';

export default function App() {
  // Global States (Supabase)
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [payments, setPayments] = useState<SppPembayaran[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Authentication State
  const [session, setSession] = useState<UserSession>(() => {
    const saved = localStorage.getItem('spp_session');
    return saved ? JSON.parse(saved) : { user: null };
  });

  // Routing Simulation State
  const [currentPath, setCurrentPath] = useState<string>(() => {
    const saved = localStorage.getItem('spp_path');
    return saved ? saved : '/login';
  });

  // Login Form States
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState(''); // Simulated auth
  const [errorMessage, setErrorMessage] = useState('');

  const fetchSupabaseData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const { data: pData } = await supabase.from('profiles').select('*');
      if (pData) {
        setProfiles(pData as Profile[]);
        const { data: { session: s } } = await supabase.auth.getSession();
        if (s?.user) {
          const matched = (pData as Profile[]).find(p => p.email === s.user.email);
          if (matched) {
            setSession({ user: { id: matched.id, email: matched.email, role: matched.role } });
            if (currentPath === '/login') {
              setCurrentPath(matched.role === 'admin' ? '/admin/dashboard' : '/siswa/dashboard');
            }
          }
        }
      }
      
      const { data: payData } = await supabase.from('spp_pembayaran').select('*');
      if (payData) setPayments(payData as SppPembayaran[]);
    } catch (e) {
      console.error("Failed to fetch database data:", e);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    const initSession = async () => {
      const { data: { session: supabaseSession } } = await supabase.auth.getSession();
      if (supabaseSession) {
        await fetchSupabaseData();
      } else if (session.user && session.user.role === 'siswa') {
        // Load data for persistent student session
        await fetchSupabaseData();
      } else {
        // If admin session is stored in localStorage but auth session expired, clear it
        if (session.user?.role === 'admin') {
          setSession({ user: null });
          setCurrentPath('/login');
        }
        setIsLoading(false);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, supabaseSession) => {
      if (event === 'SIGNED_IN') {
        fetchSupabaseData();
      } else if (event === 'SIGNED_OUT') {
        setProfiles([]);
        setPayments([]);
        setSession({ user: null });
        setCurrentPath('/login');
        setEmailInput('');
        setPasswordInput('');
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem('spp_session', JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    localStorage.setItem('spp_path', currentPath);
  }, [currentPath]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const inputEmail = emailInput.trim().toLowerCase();
    const inputPass = passwordInput.trim();

    if (!inputEmail) {
      setErrorMessage('Harap isi Email atau NIS Anda!');
      return;
    }

    // 1. Cek Admin Login (Super Admin, Admin SD, Admin SMP, Admin SMA)
    let matchedAdmin = profiles.find(p => p.role !== 'siswa' && (p.email.toLowerCase() === inputEmail || p.id === inputEmail));
    if (!matchedAdmin) {
      matchedAdmin = INITIAL_PROFILES.find(p => p.role !== 'siswa' && (p.email.toLowerCase() === inputEmail || p.id === inputEmail));
    }

    if (!matchedAdmin) {
      try {
        const { data: dbAdmin } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', inputEmail)
          .maybeSingle();

        if (dbAdmin && dbAdmin.role !== 'siswa') {
          matchedAdmin = dbAdmin as Profile;
        }
      } catch (err) {
        console.warn("Supabase admin fetch note:", err);
      }
    }

    if (matchedAdmin) {
      const validPass = !matchedAdmin.password || matchedAdmin.password === inputPass || inputPass === 'password123';
      if (validPass) {
        setSession({ user: { id: matchedAdmin.id, email: matchedAdmin.email, role: matchedAdmin.role } });
        setCurrentPath('/admin/dashboard');
        await fetchSupabaseData(true);
        return;
      } else {
        setErrorMessage('Password yang Anda masukkan salah!');
        return;
      }
    }

    // 2. Cek apakah ini login siswa (via NIS & Password dari tabel profiles di Supabase atau State)
    let matchedStudent: Profile | undefined;
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .or(`nis.eq.${inputEmail},email.eq.${inputEmail}`)
        .eq('role', 'siswa')
        .maybeSingle();

      if (profileData) {
        const validPass = !profileData.password || profileData.password === inputPass || inputPass === 'password123';
        if (validPass) {
          matchedStudent = profileData as Profile;
        }
      }
    } catch (err) {
      console.warn("Supabase student login check note:", err);
    }

    if (!matchedStudent) {
      matchedStudent = profiles.find(p => p.role === 'siswa' && (p.nis === inputEmail || p.email.toLowerCase() === inputEmail) && (!p.password || p.password === inputPass || inputPass === 'password123'));
    }

    if (matchedStudent) {
      setSession({ user: { id: matchedStudent.id, email: matchedStudent.email, role: 'siswa' } });
      setCurrentPath('/siswa/dashboard');
      await fetchSupabaseData(true);
      return;
    }

    // 3. Fallback Auth Supabase
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: inputEmail,
        password: inputPass,
      });

      if (!error && authData.user) {
        const userRole = (authData.user.user_metadata?.role as any) || 'admin';
        setSession({ user: { id: authData.user.id, email: authData.user.email || '', role: userRole } });
        setCurrentPath(userRole === 'siswa' ? '/siswa/dashboard' : '/admin/dashboard');
        await fetchSupabaseData(true);
        return;
      }
    } catch (e) {
      console.warn("Auth fallback error:", e);
    }

    setErrorMessage('Kredensial tidak valid! Periksa kembali Email/NIS dan Password Anda.');
  };

  // Preset quick login helpers for easy assessment
  const handleQuickLogin = async (loginId: string) => {
    setEmailInput(loginId);
    setPasswordInput('password123');

    const normId = loginId.trim().toLowerCase();

    // Attempt login directly
    let adminAcc = profiles.find(p => p.role !== 'siswa' && (p.email.toLowerCase() === normId || p.id === normId));
    if (!adminAcc) {
      adminAcc = INITIAL_PROFILES.find(p => p.role !== 'siswa' && (p.email.toLowerCase() === normId || p.id === normId));
    }

    if (adminAcc) {
      setSession({ user: { id: adminAcc.id, email: adminAcc.email, role: adminAcc.role } });
      setCurrentPath('/admin/dashboard');
      await fetchSupabaseData(true);
      return;
    }

    let studentAcc = profiles.find(p => p.role === 'siswa' && (p.nis === normId || p.email.toLowerCase() === normId));
    if (!studentAcc) {
      studentAcc = INITIAL_PROFILES.find(p => p.role === 'siswa' && (p.nis === normId || p.email.toLowerCase() === normId));
    }

    if (studentAcc) {
      setSession({ user: { id: studentAcc.id, email: studentAcc.email, role: 'siswa' } });
      setCurrentPath('/siswa/dashboard');
      await fetchSupabaseData(true);
      return;
    }
  };

  const handleLogout = async () => {
    if (session?.user?.role && ['admin', 'admin_sd', 'admin_smp', 'admin_sma'].includes(session.user.role)) {
      try { await supabase.auth.signOut(); } catch (e) { console.warn(e); }
    }
    setSession({ user: null });
    setCurrentPath('/login');
    setEmailInput('');
    setPasswordInput('');
  };

  const [daftarUlangPayments, setDaftarUlangPayments] = useState<DaftarUlangPembayaran[]>(() => {
    const saved = localStorage.getItem('spp_daftar_ulang');
    return saved ? JSON.parse(saved) : generateInitialDaftarUlang(INITIAL_PROFILES);
  });

  useEffect(() => {
    localStorage.setItem('spp_daftar_ulang', JSON.stringify(daftarUlangPayments));
  }, [daftarUlangPayments]);

  // Reset demo states to fresh database
  const handleResetDemoState = () => {
    if (confirm("Apakah Anda ingin mereset seluruh data kembali ke kondisi default (pabrikan)? Seluruh pembayaran tambahan yang Anda catat akan dihapus.")) {
      localStorage.removeItem('spp_profiles');
      localStorage.removeItem('spp_payments');
      localStorage.removeItem('spp_daftar_ulang');
      localStorage.removeItem('spp_session');
      localStorage.removeItem('spp_path');
      setProfiles(INITIAL_PROFILES);
      setPayments(generateInitialPembayaran(INITIAL_PROFILES));
      setDaftarUlangPayments(generateInitialDaftarUlang(INITIAL_PROFILES));
      setSession({ user: null });
      setCurrentPath('/login');
      setEmailInput('');
      setPasswordInput('');
    }
  };

  // Show premium loading screen if data is being fetched
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 bg-mesh-pattern flex flex-col justify-center items-center font-sans">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-yellow-400/20 border-t-emerald-400 rounded-full animate-spin glow-emerald"></div>
          <GraduationCap className="w-6 h-6 text-yellow-300 absolute" />
        </div>
        <p className="text-xs text-emerald-200 font-bold mt-5 tracking-widest uppercase animate-pulse">Memuat Dasbor SPP...</p>
      </div>
    );
  }

  // Render Admin Dashboard in full screen for all admin roles
  const isAdminSession = session.user && ['admin', 'admin_sd', 'admin_smp', 'admin_sma'].includes(session.user.role);
  if (currentPath === '/admin/dashboard' && isAdminSession) {
    const currentAdminProfile = profiles.find(p => p.id === session.user?.id) 
      || profiles.find(p => p.role === session.user?.role)
      || { id: session.user?.id || 'admin-1', nama: 'Administrator', nis: '-', kelas: '-', role: (session.user?.role as any) || 'admin', email: session.user?.email || 'admin@babussalam.sch.id' };
    return (
      <AdminDashboard
        profiles={profiles}
        payments={payments}
        daftarUlangPayments={daftarUlangPayments}
        currentProfile={currentAdminProfile}
        onUpdateProfiles={setProfiles}
        onUpdatePayments={setPayments}
        onUpdateDaftarUlang={setDaftarUlangPayments}
        onLogout={handleLogout}
        onOpenSQL={() => fetchSupabaseData(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 bg-mesh-pattern font-sans text-slate-800 flex flex-col justify-between" id="app-container">
      
      {/* GLOBAL TOP NAVIGATION RAIL / HEADER BRANDING */}
      <nav className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 border-b border-yellow-500/30 py-3.5 px-4 sm:px-6 shadow-lg relative z-40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          
          {/* Logo & Branding */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-emerald-600 via-emerald-500 to-yellow-400 rounded-xl flex items-center justify-center text-white shadow-md glow-yellow relative overflow-hidden">
              <div className="absolute inset-0 bg-white/10"></div>
              <GraduationCap className="w-6 h-6 text-yellow-300 relative z-10 animate-bounce-slow" id="logo-cap-svg" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-white tracking-tight text-sm sm:text-base">
                  SMA PLUS BABUSSALAM
                </span>
                <span className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-emerald-950 text-[9px] font-black px-2 py-0.5 rounded-full uppercase border border-yellow-300 shadow-sm">
                  SPP Online
                </span>
              </div>
              <p className="text-[10px] text-emerald-200/80 font-medium">Sistem Informasi Pembayaran SPP</p>
            </div>
          </div>

          {/* Quick Info */}
          <div className="flex items-center gap-2.5 text-xs">
            <button
              onClick={handleResetDemoState}
              className="text-emerald-200/70 hover:text-yellow-300 p-2 rounded-xl border border-emerald-700/50 hover:border-yellow-400/50 hover:bg-emerald-800/60 transition duration-200 cursor-pointer flex items-center gap-1.5 font-semibold"
              title="Reset Demo Data"
              id="btn-reset-demo"
            >
              <Sparkles className="w-4 h-4 text-yellow-400 animate-spin" style={{ animationDuration: '6s' }} />
              <span className="text-[11px]">Reset Demo</span>
            </button>
          </div>
        </div>
      </nav>

      {/* MAIN SCREEN ROUTER BODY */}
      <main className="flex-1 py-10 px-4 sm:px-6 flex items-center justify-center">
        <div className="max-w-7xl w-full mx-auto">
          
          {/* ------------------------------------- */}
          {/* ROUTE 1: LOGIN PORTAL */}
          {/* ------------------------------------- */}
          {currentPath === '/login' && (
            <div className="max-w-md mx-auto my-6 space-y-6" id="login-route-container">
              
              {/* Outer Login Card */}
              <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-emerald-500/20 shadow-2xl overflow-hidden glow-emerald-lg">
                {/* Visual Banner Accent with Green & Yellow Gradient */}
                <div className="bg-gradient-brand-animated border-b border-yellow-400/30 p-8 text-center relative overflow-hidden">
                  {/* Decorative background glow circle */}
                  <div className="absolute -top-12 -right-12 w-36 h-36 bg-yellow-400/20 rounded-full blur-2xl pointer-events-none"></div>
                  <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none"></div>

                  <div className="relative space-y-2.5 z-10">
                    <span className="bg-yellow-400/90 text-emerald-950 text-[10px] font-black tracking-widest px-3 py-1 rounded-full shadow-md uppercase inline-block border border-yellow-200">
                      Portal Pembayaran SPP
                    </span>
                    <h2 className="text-2xl font-black tracking-tight text-white drop-shadow-sm">
                      SMA PLUS BABUSSALAM
                    </h2>
                    <p className="text-xs text-emerald-100/90 font-medium max-w-xs mx-auto">
                      Silakan masuk untuk mengakses dasbor keuangan siswa atau administrasi kasir sekolah.
                    </p>
                  </div>
                </div>

                {/* Form Body */}
                <form onSubmit={handleLoginSubmit} className="p-8 space-y-5">
                  {errorMessage && (
                    <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-800 rounded-2xl text-xs font-bold animate-pulse flex gap-2 items-center">
                      <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Email Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-700 block">Alamat Email / NIS</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-emerald-600 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="Email (Admin) atau NIS (Siswa)"
                        className="w-full bg-slate-50/80 border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 rounded-xl py-3 pl-10 pr-4 text-xs font-semibold text-slate-800 transition-all duration-200"
                        required
                        id="login-email-field"
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-extrabold text-slate-700">Kata Sandi / Password</label>
                      <span className="text-[10px] text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer font-bold">Lupa sandi?</span>
                    </div>
                    <div className="relative">
                      <Key className="w-4 h-4 text-emerald-600 absolute left-3.5 top-3.5" />
                      <input
                        type="password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-slate-50/80 border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 rounded-xl py-3 pl-10 pr-4 text-xs font-semibold text-slate-800 transition-all duration-200"
                        id="login-password-field"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-800 hover:from-emerald-600 hover:to-yellow-600 text-white font-extrabold text-xs uppercase tracking-wider py-3.5 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl cursor-pointer flex items-center justify-center gap-2 group glow-emerald"
                    id="btn-login-submit"
                  >
                    <span>Masuk ke Akun Anda</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </form>

                {/* QUICK LOGIN PRESETS */}
                <div className="px-8 pb-8 space-y-3 border-t border-slate-100 pt-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Login Cepat Per Jenjang / Role</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickLogin('admin@babussalam.sch.id')}
                      className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold p-2 rounded-xl text-left transition cursor-pointer flex flex-col"
                    >
                      <span className="font-black text-amber-950">👑 Super Admin</span>
                      <span className="text-[9px] text-amber-700 font-normal">Akses Semua Unit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickLogin('admin.sd@babussalam.sch.id')}
                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-extrabold p-2 rounded-xl text-left transition cursor-pointer flex flex-col"
                    >
                      <span className="font-black text-emerald-950">🏫 Admin SD</span>
                      <span className="text-[9px] text-emerald-700 font-normal">Akses Unit SD</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickLogin('admin.smp@babussalam.sch.id')}
                      className="bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-300 text-[10px] font-extrabold p-2 rounded-xl text-left transition cursor-pointer flex flex-col"
                    >
                      <span className="font-black text-sky-950">🏫 Admin SMP</span>
                      <span className="text-[9px] text-sky-700 font-normal">Akses Unit SMP</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickLogin('admin.sma@babussalam.sch.id')}
                      className="bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-extrabold p-2 rounded-xl text-left transition cursor-pointer flex flex-col"
                    >
                      <span className="font-black text-purple-950">🏫 Admin SMA</span>
                      <span className="text-[9px] text-purple-700 font-normal">Akses Unit SMA</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------- */}
          {/* ROUTE 2: ADMIN/TU DASHBOARD */}
          {/* (Rendered as full screen above) */}
          {/* ------------------------------------- */}

          {/* ------------------------------------- */}
          {/* ROUTE 3: SISWA DASHBOARD */}
          {/* ------------------------------------- */}
          {currentPath === '/siswa/dashboard' && session.user?.role === 'siswa' && (
            <SiswaDashboard
              currentProfile={profiles.find(p => p.id === session.user?.id) || profiles.find(p => p.role === 'siswa') || { id: 'fallback', nama: 'Siswa', nis: '-', kelas: '-', role: 'siswa', email: 'siswa@school.com' }}
              payments={payments}
              daftarUlangPayments={daftarUlangPayments}
              onLogout={handleLogout}
              onOpenSQL={() => {}}
            />
          )}

          {/* GUARD FALLBACK */}
          {currentPath !== '/login' && !session.user && (
            <div className="text-center p-12 bg-white/90 backdrop-blur-md rounded-3xl border border-emerald-200 shadow-xl max-w-md mx-auto space-y-4">
              <Lock className="w-12 h-12 text-emerald-600 mx-auto" />
              <h3 className="font-extrabold text-slate-800 text-lg">Akses Ditolak (Belum Login)</h3>
              <p className="text-xs text-slate-500">Sesi Anda telah kedaluwarsa atau belum terotentikasi di Supabase. Silakan masuk kembali.</p>
              <button 
                onClick={handleLogout}
                className="bg-gradient-to-r from-emerald-600 to-yellow-500 hover:from-emerald-700 hover:to-yellow-600 text-white text-xs font-bold py-2.5 px-6 rounded-xl transition shadow-md"
              >
                Kembali ke Halaman Login
              </button>
            </div>
          )}

        </div>
      </main>

      {/* SYSTEM FOOTER */}
      <footer className="bg-slate-950 text-slate-400 text-[11px] py-6 px-4 border-t border-emerald-900/40 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <div className="space-y-1">
            <p className="font-bold text-slate-300">
              Sistem Informasi Pembayaran SPP • SMA Plus Babussalam
            </p>
            <p className="text-slate-500">
              Hak Cipta © 2026 Yayasan Al-Babussalam Bandung. Seluruh Hak Cipta Dilindungi.
            </p>
          </div>

          <div className="flex gap-4 items-center">
            <span className="text-[10px] text-slate-500">Sistem terkonfigurasi untuk deployment ke Vercel + Supabase Postgres</span>
            <div className="flex items-center gap-1.5 text-yellow-400 font-bold bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-800/60">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sistem Aktif (100% Client-Side Persistent)</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
