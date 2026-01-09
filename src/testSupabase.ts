import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

console.log('--- Supabase Connection Test ---');
console.log(`URL: ${supabaseUrl ? 'Found ✅' : 'Missing ❌'}`);
console.log(`Key: ${supabaseKey ? 'Found ✅' : 'Missing ❌'}`);

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('YOUR_SUPABASE_URL')) {
    console.error('❌ Please set SUPABASE_URL and SUPABASE_KEY in your .env file.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    try {
        console.log('🔄 Attempting to connect...');
        // Try to fetch a non-existent row from a likely table, or just check auth
        // A simple query is the best way to test connectivity. 
        // We'll try to list users from auth if possible (requires service role usually)
        // Or just querying a dummy table.

        const { data, error } = await supabase.from('random_table_check').select('*').limit(1);

        // If we get an error regarding the table not existing, that means we CONNECTED to Postgres!
        // If we get a network error, we didn't.

        if (error) {
            if (error.code === '42P01') { // undefined_table
                console.log('✅ Connection Successful! (Database is reachable, verified by "table not found" response)');
            } else if (error.message && error.message.includes('fetch failed')) {
                console.error('❌ Connection Failed: Network error or invalid URL.');
                console.error(error);
            } else {
                // Any other error implies we reached the server (e.g. permission denied)
                console.log('✅ Connection Successful! (Server responded with error as expected for test query)');
                console.log('   Response:', error.message);
            }
        } else {
            console.log('✅ Connection Successful! (Query executed)');
        }

    } catch (err: any) {
        console.error('❌ Unexpected Error:', err.message);
    }
}

testConnection();
