import { createClient } from '@supabase/supabase-js';

const url = 'https://mixoxpgvvtxwzxlmuler.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1peG94cGd2dnR4d3p4bG11bGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5Njc0MTYsImV4cCI6MjA5ODU0MzQxNn0.92bDzkgeZ90UdNvdgSOrto8LyamsNG5oLL8khH3pX_4';

const supabase = createClient(url, key);

async function test() {
  console.log('Testing profiles...');
  const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
  console.log('Profiles:', profiles, 'Error:', pError);

  console.log('Testing spp_pembayaran...');
  const { data: payments, error: pmError } = await supabase.from('spp_pembayaran').select('*');
  console.log('Payments:', payments, 'Error:', pmError);
}

test();
