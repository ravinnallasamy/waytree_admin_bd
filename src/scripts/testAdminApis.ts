
import { randomUUID } from 'crypto';

const BASE_URL = 'https://waytree-admin-backend.onrender.com/api';

const TEST_ADMIN_EMAIL = `test_admin_${randomUUID().substring(0, 8)}@example.com`;
const TEST_ADMIN_PASSWORD = 'password123';

let authToken = '';
let testUserId = '';
let testNetworkCodeId = '';
let testEventId = '';

const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
};

const log = (msg: string, color: keyof typeof colors = 'reset') => {
    console.log(`${colors[color]}${msg}${colors.reset}`);
};

const section = (title: string) => {
    console.log('\n' + '='.repeat(50));
    console.log(` ${title}`);
    console.log('='.repeat(50));
};

async function request(endpoint: string, method: string = 'GET', body?: any) {
    const headers: any = {}; // Don't set Content-Type for FormData, browser/node sets boundary

    if (!(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    try {
        const res = await fetch(`${BASE_URL}${endpoint}`, {
            method,
            headers,
            body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
        });

        const contentType = res.headers.get('content-type');
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await res.json();
        } else {
            data = await res.text();
        }

        return {
            status: res.status,
            ok: res.ok,
            data
        };
    } catch (error: any) {
        console.error(`Request Failed: ${method} ${endpoint}`, error.message);
        return { status: 500, ok: false, data: error.message };
    }
}

async function runTests() {
    log(`🚀 Starting Admin API Tests against: ${BASE_URL}`, 'cyan');

    // 1. Authentication
    section('1. Authentication Tests');

    // Register
    log(`Creating Test Admin: ${TEST_ADMIN_EMAIL}`, 'yellow');
    const registerRes = await request('/auth/legacy/register', 'POST', {
        email: TEST_ADMIN_EMAIL,
        password: TEST_ADMIN_PASSWORD,
        role: 'superadmin'
    });

    if (registerRes.ok) {
        log(`✅ Admin Registered`, 'green');
    } else {
        log(`⚠️ Registration failed or user exists: ${JSON.stringify(registerRes.data)}`, 'yellow');
    }

    // Login
    log(`Logging in...`, 'yellow');
    const loginRes = await request('/auth/legacy/login', 'POST', {
        email: TEST_ADMIN_EMAIL,
        password: TEST_ADMIN_PASSWORD
    });

    if (loginRes.ok) {
        authToken = loginRes.data.token;
        log(`✅ Login Successful. Token acquired.`, 'green');
    } else {
        log(`❌ Login Failed: ${JSON.stringify(loginRes.data)}`, 'red');
        process.exit(1);
    }

    // 2. User Management
    section('2. User Management Tests');

    // List All Users
    log(`Fetching all users...`, 'yellow');
    const usersRes = await request('/users/all?limit=5');
    if (usersRes.ok) {
        log(`✅ Fetched ${usersRes.data.users?.length} users.`, 'green');
        if (usersRes.data.users?.length > 0) {
            testUserId = usersRes.data.users[0]._id;
            log(`👉 Selected Test User ID: ${testUserId}`, 'cyan');
        }
    } else {
        log(`❌ Fetch Users Failed: ${JSON.stringify(usersRes.data)}`, 'red');
    }

    if (testUserId) {
        // Test GET User Details
        log(`Fetching details for user ${testUserId}...`, 'yellow');
        const userDetailRes = await request(`/users/${testUserId}`);
        if (userDetailRes.ok) log(`✅ Got User Details`, 'green');
        else log(`❌ Get User Details Failed`, 'red');

        // Test UPDATE User
        log(`Attempting to UPDATE user ${testUserId}...`, 'yellow');
        const updatePayload = {
            company: `Test Corp ${Date.now()}`,
            role: 'founder',
            primaryGoal: 'hiring'
        };
        const updateRes = await request(`/users/${testUserId}`, 'PUT', updatePayload);

        if (updateRes.ok) {
            log(`✅ User Update Successful!`, 'green');
            log(`   New Company: ${updateRes.data.company}`);
        } else {
            log(`❌ User Update Failed (Status: ${updateRes.status})`, 'red');
            console.log('Error Data:', JSON.stringify(updateRes.data, null, 2));
        }

        // Test Toggle Block
        log(`Toggle Block status...`, 'yellow');
        const blockRes = await request(`/users/${testUserId}/toggle-block`, 'PUT');
        if (blockRes.ok) log(`✅ User Block Toggle: ${blockRes.data.message}`, 'green');
        else log(`❌ Block Toggle Failed`, 'red');
    }

    // 3. Network Management
    section('3. Network Management Tests');

    // Create Network
    log(`Creating new Network Code...`, 'yellow');
    const netRes = await request('/network/create', 'POST', {
        name: 'Test Network ' + Date.now().toString().slice(-4),
        code: 'TEST' + Date.now().toString().slice(-4),
        type: 'Generic'
    });

    if (netRes.ok) {
        testNetworkCodeId = netRes.data._id;
        log(`✅ Network Created: ${netRes.data.code}`, 'green');
    } else {
        log(`❌ Create Network Failed: ${JSON.stringify(netRes.data)}`, 'red');
    }

    // List Networks
    const listNetRes = await request('/network/all');
    if (listNetRes.ok) log(`✅ Listed Networks: ${listNetRes.data.length} found`, 'green');

    // 4. Event Management Tests
    section('4. Event Management Tests');

    // Create Event
    log(`Creating new Event (Multipart)...`, 'yellow');
    const formData = new FormData();
    formData.append('title', "Test Event " + Date.now());
    formData.append('description', "This is an automated test event.");
    formData.append('date', new Date().toISOString());
    formData.append('location', "Virtual");
    formData.append('category', "Tech");
    formData.append('isVirtual', "true");
    formData.append('organizer', "Admin Tester");
    // No explicit file appended, Multer should handle empty 'images'

    const createEventRes = await request('/events/create', 'POST', formData);

    if (createEventRes.ok) {
        testEventId = createEventRes.data._id;
        log(`✅ Event Created: ${createEventRes.data.title} (ID: ${testEventId})`, 'green');
    } else {
        log(`❌ Create Event Failed: ${JSON.stringify(createEventRes.data)}`, 'red');
    }

    // List Events (Verified)
    log(`Listing verified events...`, 'yellow');
    const verifiedEventsRes = await request('/events/verified');
    if (verifiedEventsRes.ok) {
        log(`✅ Verified Events: ${verifiedEventsRes.data.length} found`, 'green');
    } else {
        log(`❌ List Verified Events Failed`, 'red');
    }

    // List Events (Pending)
    log(`Listing pending events...`, 'yellow');
    const pendingEventsRes = await request('/events/pending');
    if (pendingEventsRes.ok) {
        log(`✅ Pending Events: ${pendingEventsRes.data.length} found`, 'green');
    } else {
        log(`❌ List Pending Events Failed`, 'red');
    }

    if (testEventId) {
        // Get Event Details
        log(`Getting details for event ${testEventId}...`, 'yellow');
        const eventDetailRes = await request(`/events/${testEventId}`);
        if (eventDetailRes.ok) log(`✅ Got Event Details`, 'green');
        else log(`❌ Get Event Details Failed`, 'red');

        // Approve Event
        log(`Approving event...`, 'yellow');
        const approveRes = await request(`/events/approve/${testEventId}`, 'PUT');
        if (approveRes.ok) log(`✅ Event Approved`, 'green');
        else log(`⚠️ Approve failed (maybe already approved): ${approveRes.status}`, 'yellow');

        // Delete Event
        log(`Deleting event...`, 'yellow');
        const deleteEventRes = await request(`/events/${testEventId}`, 'DELETE');
        if (deleteEventRes.ok) log(`✅ Event Deleted`, 'green');
        else log(`❌ Delete Event Failed`, 'red');
    }

    log(`\n🎉 Test Run Completed.`, 'cyan');
}

runTests().catch(err => console.error(err));
