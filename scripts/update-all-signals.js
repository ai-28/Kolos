#!/usr/bin/env node

/**
 * Script to trigger signal updates for all clients via the cron API endpoint
 * 
 * This script can be run:
 * 1. Locally: node scripts/update-all-signals.js
 * 2. Via external cron service (cron-job.org, EasyCron, etc.)
 * 3. Via GitHub Actions (scheduled workflow)
 * 
 * Required Environment Variables:
 * - KOLOS_API_URL: Your Next.js app URL (e.g., https://your-app.vercel.app)
 * - CRON_SECRET: The secret key for authenticating cron jobs
 * 
 * Optional:
 * - PROFILE_IDS: Comma-separated list of profile IDs to update (if not set, updates all)
 * - SKIP_PROFILE_IDS: Comma-separated list of profile IDs to skip
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Configuration
const API_URL = process.env.KOLOS_API_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET;
const PROFILE_IDS = process.env.PROFILE_IDS && process.env.PROFILE_IDS.trim()
    ? process.env.PROFILE_IDS.split(',').map(id => id.trim()).filter(id => id.length > 0)
    : null;
const SKIP_PROFILE_IDS = process.env.SKIP_PROFILE_IDS && process.env.SKIP_PROFILE_IDS.trim()
    ? process.env.SKIP_PROFILE_IDS.split(',').map(id => id.trim()).filter(id => id.length > 0)
    : [];

// Validate configuration
if (!CRON_SECRET) {
    console.error('❌ Error: CRON_SECRET environment variable is required');
    console.error('   Set it with: export CRON_SECRET=your_secret_key');
    console.error('   Or add it to GitHub Secrets: Settings → Secrets and variables → Actions');
    process.exit(1);
}

if (!API_URL || API_URL === 'http://localhost:3000') {
    console.error('❌ Error: KOLOS_API_URL environment variable is required');
    console.error('   Set it with: export KOLOS_API_URL=https://your-app.vercel.app');
    console.error('   Or add it to GitHub Secrets: Settings → Secrets and variables → Actions');
    process.exit(1);
}

console.log('🚀 Starting signal update for all clients...');
console.log(`📡 API URL: ${API_URL}`);
console.log(`📅 Time: ${new Date().toISOString()}`);
console.log(`🔑 CRON_SECRET: ${CRON_SECRET ? '***' + CRON_SECRET.substring(CRON_SECRET.length - 4) : 'NOT SET'}`);
if (PROFILE_IDS && PROFILE_IDS.length > 0) {
    console.log(`👥 Target Profile IDs: ${PROFILE_IDS.join(', ')}`);
} else {
    console.log(`👥 Target Profile IDs: ALL (no filter)`);
}
if (SKIP_PROFILE_IDS.length > 0) {
    console.log(`⏭️  Skip Profile IDs: ${SKIP_PROFILE_IDS.join(', ')}`);
} else {
    console.log(`⏭️  Skip Profile IDs: NONE`);
}

// Prepare request body
const requestBody = {};
if (PROFILE_IDS) {
    requestBody.profile_ids = PROFILE_IDS;
}
if (SKIP_PROFILE_IDS.length > 0) {
    requestBody.skip_profile_ids = SKIP_PROFILE_IDS;
}

const bodyData = JSON.stringify(requestBody);

// Parse URL
const endpoint = new URL('/api/signals/update-all', API_URL);
const isHttps = endpoint.protocol === 'https:';
const httpModule = isHttps ? https : http;

// Prepare request options
const options = {
    hostname: endpoint.hostname,
    port: endpoint.port || (isHttps ? 443 : 80),
    path: endpoint.pathname,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyData),
        'Authorization': `Bearer ${CRON_SECRET}`
    },
    timeout: 600000, // 10 minute timeout (signal generation can take time)
};

// Make the request
const startTime = Date.now();
const req = httpModule.request(options, (res) => {
    let responseData = '';

    res.on('data', (chunk) => {
        responseData += chunk;
    });

    res.on('end', () => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n⏱️  Request completed in ${duration} seconds`);
        console.log(`📊 Status Code: ${res.statusCode}`);

        try {
            const result = JSON.parse(responseData);

            if (res.statusCode === 200 || res.statusCode === 201) {
                console.log('\n✅ SUCCESS! Signal update completed');
                console.log(`\n📈 Results:`);
                console.log(`   Total Profiles: ${result.profiles_total || 0}`);
                console.log(`   ✅ Succeeded: ${result.profiles_succeeded || 0}`);
                console.log(`   ❌ Failed: ${result.profiles_failed || 0}`);
                console.log(`   ⏱️  Duration: ${result.duration_seconds?.toFixed(2) || 0}s`);

                if (result.errors && result.errors.length > 0) {
                    console.log(`\n⚠️  Errors encountered:`);
                    result.errors.forEach(err => {
                        console.log(`   - ${err.name || err.profile_id}: ${err.error}`);
                    });
                }

                if (result.profile_results && result.profile_results.length > 0) {
                    console.log(`\n📋 Profile Results:`);
                    result.profile_results.forEach(pr => {
                        const status = pr.status === 'success' ? '✅' : '❌';
                        const signalsInfo = pr.signals_generated !== undefined ? ` (${pr.signals_generated} signals)` : '';
                        const errorInfo = pr.error ? ` - ${pr.error}` : '';
                        console.log(`   ${status} ${pr.name} (${pr.profile_id})${signalsInfo}${errorInfo}`);
                    });
                }

                process.exit(0);
            } else {
                console.error(`\n❌ ERROR: Request failed with status ${res.statusCode}`);
                console.error('Response:', JSON.stringify(result, null, 2));

                // Provide helpful error messages
                if (res.statusCode === 401) {
                    console.error('\n💡 Authentication failed. Check:');
                    console.error('   1. CRON_SECRET in GitHub Secrets matches CRON_SECRET in your deployment platform');
                    console.error('   2. Authorization header format is correct (Bearer token)');
                } else if (res.statusCode === 404) {
                    console.error('\n💡 API endpoint not found. Check:');
                    console.error(`   1. KOLOS_API_URL is correct: ${API_URL}`);
                    console.error('   2. The /api/signals/update-all route exists in your Next.js app');
                } else if (res.statusCode === 500) {
                    console.error('\n💡 Server error. Check:');
                    console.error('   1. Your deployment platform logs (Vercel/Railway/etc.)');
                    console.error('   2. All environment variables are set in your deployment platform');
                    console.error('   3. GOOGLE_SHEET_ID, OPENAI_API_KEY, GOOGLE_CREDENTIALS are configured');
                }

                process.exit(1);
            }
        } catch (parseError) {
            console.error('\n❌ ERROR: Failed to parse response');
            console.error('Parse error:', parseError.message);
            console.error('Raw response (first 1000 chars):', responseData.substring(0, 1000));
            console.error('Response length:', responseData.length);
            process.exit(1);
        }
    });
});

req.on('error', (error) => {
    console.error('\n❌ ERROR: Request failed');
    console.error('Error details:', error.message);
    console.error('Error code:', error.code);
    console.error('Error stack:', error.stack);
    if (error.code === 'ECONNREFUSED') {
        console.error('\n💡 Tip: Make sure your server is running and the KOLOS_API_URL is correct');
        console.error(`   Current API URL: ${API_URL}`);
    } else if (error.code === 'ENOTFOUND') {
        console.error('\n💡 Tip: The hostname in KOLOS_API_URL could not be resolved');
        console.error(`   Current API URL: ${API_URL}`);
    } else if (error.code === 'ETIMEDOUT') {
        console.error('\n💡 Tip: Connection timed out. Check if your API is accessible');
        console.error(`   Current API URL: ${API_URL}`);
    }
    process.exit(1);
});

req.on('timeout', () => {
    console.error('\n❌ ERROR: Request timed out');
    console.error('The signal update is taking longer than expected (>10 minutes)');
    req.destroy();
    process.exit(1);
});

// Send the request
req.write(bodyData);
req.end();

