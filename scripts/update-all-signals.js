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
const PROFILE_IDS = process.env.PROFILE_IDS ? process.env.PROFILE_IDS.split(',').map(id => id.trim()) : null;
const SKIP_PROFILE_IDS = process.env.SKIP_PROFILE_IDS ? process.env.SKIP_PROFILE_IDS.split(',').map(id => id.trim()) : [];

// Validate configuration
if (!CRON_SECRET) {
    console.error('❌ Error: CRON_SECRET environment variable is required');
    console.error('   Set it with: export CRON_SECRET=your_secret_key');
    process.exit(1);
}

console.log('🚀 Starting signal update for all clients...');
console.log(`📡 API URL: ${API_URL}`);
console.log(`📅 Time: ${new Date().toISOString()}`);
if (PROFILE_IDS) {
    console.log(`👥 Target Profile IDs: ${PROFILE_IDS.join(', ')}`);
}
if (SKIP_PROFILE_IDS.length > 0) {
    console.log(`⏭️  Skip Profile IDs: ${SKIP_PROFILE_IDS.join(', ')}`);
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
                process.exit(1);
            }
        } catch (parseError) {
            console.error('\n❌ ERROR: Failed to parse response');
            console.error('Raw response:', responseData);
            process.exit(1);
        }
    });
});

req.on('error', (error) => {
    console.error('\n❌ ERROR: Request failed');
    console.error('Error details:', error.message);
    if (error.code === 'ECONNREFUSED') {
        console.error('\n💡 Tip: Make sure your server is running and the KOLOS_API_URL is correct');
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

