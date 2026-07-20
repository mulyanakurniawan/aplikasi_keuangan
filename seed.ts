import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { INITIAL_PROFILES, generateInitialPembayaran } from './src/data/mockData';

// Since this is a script, we need to load .env manually
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key not found in .env');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// We need to map old string IDs to valid UUIDs
const idMap = new Map<string, string>();

async function seed() {
  console.log('Clearing existing data...');
  
  // First delete all payments explicitly to prevent foreign key violation on dicatat_oleh
  const { error: delPayError } = await supabase.from('spp_pembayaran').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delPayError) {
    console.error('Error clearing payments:', delPayError);
    return;
  }

  // Then delete profiles
  const { error: delError } = await supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (delError) {
    console.error('Error clearing profiles:', delError);
    return;
  }

  console.log('Inserting profiles...');
  const profilesToInsert = INITIAL_PROFILES.map(p => {
    let uuid = crypto.randomUUID();
    if (p.email === 'admin@babussalam.sch.id') {
      uuid = '7c7c1bdd-6ba2-4aab-8ad4-6dc4b3a24927';
    } else if (p.email === 'admin.sd@babussalam.sch.id') {
      uuid = '11111111-0000-4000-a000-000000000001';
    } else if (p.email === 'admin.smp@babussalam.sch.id') {
      uuid = '22222222-0000-4000-a000-000000000002';
    } else if (p.email === 'admin.sma@babussalam.sch.id') {
      uuid = '33333333-0000-4000-a000-000000000003';
    }
    idMap.set(p.id, uuid);

    // Map role to valid Postgres enum ('admin' | 'siswa')
    const dbRole = p.role.startsWith('admin') ? 'admin' : 'siswa';

    return {
      id: uuid,
      nama: p.nama,
      nis: p.nis,
      kelas: p.kelas,
      role: dbRole,
      email: p.email,
      password: p.role === 'siswa' ? 'password123' : null,
      no_hp: p.no_hp || null
    };
  });

  let { error: pError } = await supabase.from('profiles').insert(profilesToInsert);
  if (pError && pError.message?.includes('no_hp')) {
    const withoutNoHp = profilesToInsert.map(p => { const copy = { ...p }; delete (copy as any).no_hp; return copy; });
    const res = await supabase.from('profiles').insert(withoutNoHp);
    pError = res.error;
  }
  if (pError && pError.message?.includes('password')) {
    const withoutPass = profilesToInsert.map(p => { const copy = { ...p }; delete (copy as any).password; return copy; });
    const res = await supabase.from('profiles').insert(withoutPass);
    pError = res.error;
  }
  if (pError) {
    console.error('Error inserting profiles:', pError);
    return;
  }
  console.log('Profiles inserted successfully.');

  console.log('Generating and inserting payments...');
  const initialPayments = generateInitialPembayaran(INITIAL_PROFILES);
  
  const paymentsToInsert = initialPayments.map(p => {
    return {
      siswa_id: idMap.get(p.siswa_id),
      tahun_ajaran: p.tahun_ajaran,
      bulan: p.bulan,
      nominal: p.nominal,
      tanggal_bayar: p.tanggal_bayar,
      status: p.status,
      invoice_no: p.invoice_no,
      dicatat_oleh: p.dicatat_oleh ? idMap.get(p.dicatat_oleh) : null
    };
  });

  if (paymentsToInsert.length > 0) {
    const { error: pmError } = await supabase.from('spp_pembayaran').insert(paymentsToInsert);
    if (pmError) {
      console.error('Error inserting payments:', pmError);
      return;
    }
    console.log('Payments inserted successfully.');
  } else {
    console.log('No payments to insert (empty student database state).');
  }
  console.log('Seeding completed!');
}

seed();
