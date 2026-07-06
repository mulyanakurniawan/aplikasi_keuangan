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
import { Profile, SppPembayaran, UserSession } from './types';
import { INITIAL_PROFILES, generateInitialPembayaran } from './data/mockData';
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

  const fetchSupabaseData = async () => {
    setIsLoading(true);
    const { data: pData } = await supabase.from('profiles').select('*');
    if (pData) {
      setProfiles(pData as Profile[]);
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (s?.user) {
          const matched = (pData as Profile[]).find(p => p.email === s.user.email);
          if (matched) {
            setSession({ user: { id: matched.id, email: matched.email, role: matched.role } });
            setCurrentPath(matched.role === 'admin' ? '/admin/dashboard' : '/siswa/dashboard');
          }
        }
      });
    }
    
    const { data: payData } = await supabase.from('spp_pembayaran').select('*');
    if (payData) setPayments(payData as SppPembayaran[]);
    setIsLoading(false);
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

    if (!emailInput) {
      setErrorMessage('Harap isi Email atau NIS Anda!');
      return;
    }

    // 1. Cek apakah ini login siswa (via NIS & Password dari tabel profiles di Supabase)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('nis', emailInput)
      .eq('role', 'siswa')
      .eq('password', passwordInput)
      .maybeSingle();

    if (profileData) {
      setSession({ user: { id: profileData.id, email: profileData.email, role: 'siswa' } });
      setCurrentPath('/siswa/dashboard');
      // Fetch all payments/profiles data for student view
      await fetchSupabaseData();
      return;
    }

    // 2. Jika tidak cocok sebagai siswa, coba sebagai Admin via Supabase Auth
    const { error } = await supabase.auth.signInWithPassword({
      email: emailInput,
      password: passwordInput,
    });

    if (error) {
      setErrorMessage('Kredensial tidak valid!');
    }
    // On success, auth state listener → fetchSupabaseData → session setup
  };

  // Preset quick login helpers for easy assessment
  const handleQuickLogin = async (email: string) => {
    setEmailInput(email);
    setPasswordInput('password123');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: 'password123',
    });

    if (error) {
      setErrorMessage(error.message);
    }
  };

  const handleLogout = async () => {
    if (session?.user?.role === 'admin') {
      await supabase.auth.signOut();
      // Auth state listener will clear session & redirect
    } else {
      // Manual logout for siswa
      setSession({ user: null });
      setCurrentPath('/login');
      setEmailInput('');
      setPasswordInput('');
    }
  };

  // Reset demo states to fresh database
  const handleResetDemoState = () => {
    if (confirm("Apakah Anda ingin mereset seluruh data kembali ke kondisi default (pabrikan)? Seluruh pembayaran tambahan yang Anda catat akan dihapus.")) {
      localStorage.removeItem('spp_profiles');
      localStorage.removeItem('spp_payments');
      localStorage.removeItem('spp_session');
      localStorage.removeItem('spp_path');
      setProfiles(INITIAL_PROFILES);
      setPayments(generateInitialPembayaran(INITIAL_PROFILES));
      setSession({ user: null });
      setCurrentPath('/login');
      setEmailInput('');
      setPasswordInput('');
    }
  };

  // Render Admin Dashboard in full screen (escaping global wrapper)
  if (currentPath === '/admin/dashboard' && session.user?.role === 'admin') {
    return (
      <AdminDashboard
        profiles={profiles}
        payments={payments}
        currentProfile={profiles.find(p => p.id === session.user?.id) || profiles[0]}
        onUpdateProfiles={setProfiles}
        onUpdatePayments={setPayments}
        onLogout={handleLogout}
        onOpenSQL={fetchSupabaseData} // Reusing onOpenSQL as a refresh trigger for simplicity
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col justify-between" id="app-container">
      
      {/* GLOBAL TOP NAVIGATION RAIL / HEADER BRANDING */}
      <nav className="bg-white border-b border-slate-200 py-3.5 px-4 sm:px-6 shadow-sm relative z-40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          
          {/* Logo & Branding */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center text-white shadow-sm">
              <GraduationCap className="w-6 h-6" id="logo-cap-svg" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-slate-900 tracking-tight text-sm sm:text-base">
                  SMA PLUS BABUSSALAM
                </span>
                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase border border-emerald-200">
                  SPP Online
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Sistem Informasi Pembayaran SPP</p>
            </div>
          </div>

          {/* Quick Info */}
          <div className="flex items-center gap-2.5 text-xs">
            <button
              onClick={handleResetDemoState}
              className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg border border-transparent hover:border-rose-100 transition duration-150 cursor-pointer"
              title="Reset Demo Data"
              id="btn-reset-demo"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* MAIN SCREEN ROUTER BODY */}
      <main className="flex-1 py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          
          {/* ------------------------------------- */}
          {/* ROUTE 1: LOGIN PORTAL */}
          {/* ------------------------------------- */}
          {currentPath === '/login' && (
            <div className="max-w-md mx-auto my-6 space-y-6" id="login-route-container">
              
              {/* Outer Login Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Visual Banner Accent */}
                <div className="bg-slate-50 border-b border-slate-200 p-8 text-center relative">
                  <div className="relative space-y-2">
                    <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-full border border-emerald-200 uppercase inline-block">
                      Portal Pembayaran SPP
                    </span>
                    <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
                      SMA PLUS BABUSSALAM
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      Silakan masuk untuk mengakses dasbor keuangan siswa atau administrasi kasir sekolah.
                    </p>
                  </div>
                </div>

                {/* Form Body */}
                <form onSubmit={handleLoginSubmit} className="p-8 space-y-5">
                  {errorMessage && (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs font-bold animate-pulse flex gap-2 items-center">
                      <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Email Input */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">Alamat Email / NIS</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input
                        type="text"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="Email (Admin) atau NIS (Siswa)"
                        className="w-full bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 rounded-lg py-2.5 pl-10 pr-4 text-xs font-medium"
                        required
                        id="login-email-field"
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-600">Kata Sandi / Password</label>
                      <span className="text-[10px] text-emerald-600 hover:underline cursor-pointer font-medium">Lupa sandi?</span>
                    </div>
                    <div className="relative">
                      <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input
                        type="password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 rounded-lg py-2.5 pl-10 pr-4 text-xs"
                        id="login-password-field"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-lg transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2"
                    id="btn-login-submit"
                  >
                    <span>Masuk ke Akun Anda</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
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
              currentProfile={profiles.find(p => p.id === session.user?.id) || profiles[1]}
              payments={payments}
              onLogout={handleLogout}
              onOpenSQL={() => {}}
            />
          )}

          {/* GUARD FALLBACK */}
          {currentPath !== '/login' && !session.user && (
            <div className="text-center p-12 bg-white rounded-2xl border border-slate-100 max-w-md mx-auto space-y-4">
              <Lock className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-800 text-lg">Akses Ditolak (Belum Login)</h3>
              <p className="text-xs text-slate-500">Sesi Anda telah kedaluwarsa atau belum terotentikasi di Supabase. Silakan masuk kembali.</p>
              <button 
                onClick={handleLogout}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-5 rounded-lg transition"
              >
                Kembali ke Halaman Login
              </button>
            </div>
          )}

        </div>
      </main>

      {/* SYSTEM FOOTER */}
      <footer className="bg-slate-900 text-slate-400 text-[11px] py-6 px-4 mt-12 border-t border-slate-800 relative z-10">
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
            <div className="flex items-center gap-1 text-emerald-400 font-bold">
              <Activity className="w-3.5 h-3.5" />
              <span>Sistem Aktif (100% Client-Side Persistent)</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
