import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#')).map(l => {
    const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
  })
);

console.log('URL:', env.VITE_SUPABASE_URL);
console.log('publishable key prefix:', env.VITE_SUPABASE_PUBLISHABLE_KEY?.slice(0, 20));

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'tharunnnanju@gmail.com',
  password: 'SakthiHR@2026!',
});
if (error) console.log('SIGN-IN ERROR:', error.status, error.message);
else console.log('SIGN-IN OK. user:', data.user?.email, 'session?', !!data.session);
