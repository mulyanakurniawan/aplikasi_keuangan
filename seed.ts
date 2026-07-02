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
  // Since we have ON DELETE CASCADE on payments, deleting profiles will delete payments too
  const { error: delError } = await supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (delError) {
    console.error('Error clearing data:', delError);
    return;
  }

  console.log('Inserting profiles...');
  const profilesToInsert = INITIAL_PROFILES.map(p => {
    const uuid = crypto.randomUUID();
    idMap.set(p.id, uuid);
    return {
      id: uuid,
      nama: p.nama,
      nis: p.nis,
      kelas: p.kelas,
      role: p.role,
      email: p.email
    };
  });

  const { error: pError } = await supabase.from('profiles').insert(profilesToInsert);
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

  const { error: pmError } = await supabase.from('spp_pembayaran').insert(paymentsToInsert);
  if (pmError) {
    console.error('Error inserting payments:', pmError);
    return;
  }
  
  console.log('Payments inserted successfully.');
  console.log('Seeding completed!');
}

seed();
