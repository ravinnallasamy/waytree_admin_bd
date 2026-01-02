const BASE_URL = 'http://localhost:5000/api';

async function test() {
    try {
        console.log('--- Testing Legacy Login ---');
        const loginRes = await fetch(`${BASE_URL}/auth/legacy/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'superadmin@example.com',
                password: 'Password@123'
            })
        });

        const loginData = await loginRes.json();
        if (!loginRes.ok) throw new Error(`Login failed: ${loginData.message}`);

        const token = loginData.token;
        console.log('✅ Login successful');
        console.log('Token:', token);

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        const testEndpoint = async (name, endpoint) => {
            console.log(`\n--- Testing ${name} (${endpoint}) ---`);
            const res = await fetch(`${BASE_URL}${endpoint}`, { headers });
            const data = await res.json();
            if (!res.ok) {
                console.error(`❌ ${name} failed:`, data.message || res.statusText);
            } else {
                console.log(`✅ ${name} successful.`);
                if (Array.isArray(data)) {
                    console.log(`   Count: ${data.length}`);
                    if (data.length > 0) console.log('   Sample:', JSON.stringify(data[0]).substring(0, 100) + '...');
                } else if (typeof data === 'object' && data !== null) {
                    const keys = Object.keys(data);
                    console.log(`   Keys: ${keys.join(', ')}`);
                    // Check common paginated keys
                    if (data.events && Array.isArray(data.events)) console.log(`   Events Count: ${data.events.length}`);
                    if (data.users && Array.isArray(data.users)) console.log(`   Users Count: ${data.users.length}`);
                    if (data.codes && Array.isArray(data.codes)) console.log(`   Codes Count: ${data.codes.length}`);
                    if (data.connections && Array.isArray(data.connections)) console.log(`   Connections Count: ${data.connections.length}`);
                } else {
                    console.log(`   Response: ${data}`);
                }
            }
        };

        await testEndpoint('GET /events', '/events');
        await testEndpoint('GET /users', '/users/all');
        await testEndpoint('GET /network-codes', '/network-codes/all');
        await testEndpoint('GET /admin-users', '/admin-users');
        await testEndpoint('GET /event-connections/events', '/event-connections/events');

    } catch (error) {
        console.error('❌ Test execution error:', error.message);
    }
}

test();
