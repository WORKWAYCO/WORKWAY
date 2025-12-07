#!/usr/bin/env npx tsx
/**
 * Sikka ONE API Connection Test
 *
 * Tests the complete Sikka authentication flow:
 * 1. Get authorized practices with App-Id/App-Key
 * 2. Exchange office_id + secret_key for request_key
 * 3. Use request_key for data access
 *
 * Usage:
 *   npx tsx scripts/test-sikka-connection.ts
 */

// Sikka application credentials from portal
const SIKKA_APP_ID = '9f028d086ba822a25ff38467bf80a0cc';
const SIKKA_APP_KEY = 'ccdf6f53453469d1c37196fcaa5ad0ec';

const BASE_URL = 'https://api.sikkasoft.com/v4';

interface Practice {
	office_id: string;
	secret_key: string;
	practice_name?: string;
	pms_type?: string;
	data_insert_date?: string;
	[key: string]: unknown;
}

interface RequestKeyResponse {
	request_key: string;
	expires_in: string;
	status: string;
	scope?: string;
	issued_to?: string;
}

async function getAuthorizedPractices(): Promise<{ success: boolean; practices?: Practice[]; error?: string }> {
	console.log('Step 1: Getting authorized practices...');
	console.log(`  Using App-Id: ${SIKKA_APP_ID.substring(0, 8)}...`);
	console.log(`  Using App-Key: ${SIKKA_APP_KEY.substring(0, 8)}...`);

	try {
		const response = await fetch(`${BASE_URL}/authorized_practices`, {
			method: 'GET',
			headers: {
				'App-Id': SIKKA_APP_ID,
				'App-Key': SIKKA_APP_KEY,
				'Content-Type': 'application/json',
				'Accept': 'application/json',
			},
		});

		const body = await response.text();

		if (!response.ok) {
			return { success: false, error: `HTTP ${response.status}: ${body.substring(0, 200)}` };
		}

		const data = JSON.parse(body);
		const practices = data.items || data.data || [];

		return { success: true, practices };
	} catch (error) {
		return { success: false, error: String(error) };
	}
}

async function getRequestKey(practice: Practice): Promise<{ success: boolean; requestKey?: string; data?: RequestKeyResponse; error?: string }> {
	console.log(`\nStep 2: Getting request_key for ${practice.practice_name || practice.office_id}...`);

	try {
		const response = await fetch(`${BASE_URL}/request_key`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
			},
			body: JSON.stringify({
				grant_type: 'request_key',
				office_id: practice.office_id,
				secret_key: practice.secret_key,
				app_id: SIKKA_APP_ID,
				app_key: SIKKA_APP_KEY,
			}),
		});

		const body = await response.text();

		if (!response.ok) {
			return { success: false, error: `HTTP ${response.status}: ${body.substring(0, 200)}` };
		}

		const data: RequestKeyResponse = JSON.parse(body);
		return { success: true, requestKey: data.request_key, data };
	} catch (error) {
		return { success: false, error: String(error) };
	}
}

async function testDataAccess(requestKey: string, practiceId: string): Promise<void> {
	console.log('\nStep 3: Testing data access with request_key...');

	const endpoints = [
		{ path: '/patients', params: `?limit=3` },
		{ path: '/appointments', params: `?limit=3` },
		{ path: '/providers', params: '' },
	];

	for (const endpoint of endpoints) {
		const url = `${BASE_URL}${endpoint.path}${endpoint.params}`;
		console.log(`\n  Testing ${endpoint.path}...`);

		try {
			const response = await fetch(url, {
				method: 'GET',
				headers: {
					'request-key': requestKey,
					'Content-Type': 'application/json',
					'Accept': 'application/json',
				},
			});

			const body = await response.text();

			if (response.ok) {
				const data = JSON.parse(body);
				const items = data.items || data.data || [];
				const total = data.total_count || items.length;
				console.log(`    SUCCESS: ${total} records found`);

				// Show sample field names
				if (items.length > 0) {
					const fields = Object.keys(items[0]).slice(0, 8).join(', ');
					console.log(`    Fields: ${fields}...`);
				}
			} else {
				console.log(`    FAILED (${response.status}): ${body.substring(0, 100)}`);
			}
		} catch (error) {
			console.log(`    ERROR: ${error}`);
		}

		// Rate limit protection
		await new Promise(r => setTimeout(r, 1000));
	}
}

async function main() {
	console.log('='.repeat(70));
	console.log('SIKKA API CONNECTION TEST');
	console.log('='.repeat(70));
	console.log();

	// Step 1: Get authorized practices
	const practicesResult = await getAuthorizedPractices();

	if (!practicesResult.success) {
		console.log(`\nFAILED: ${practicesResult.error}`);
		console.log('\nTroubleshooting:');
		console.log('1. Verify App-Id and App-Key in Sikka portal');
		console.log('2. Check if application status is "Verified"');
		console.log('3. Ensure you have connected practices (Customer Count > 0)');
		return;
	}

	const practices = practicesResult.practices!;
	console.log(`\nSUCCESS! Found ${practices.length} authorized practice(s):`);
	console.log('-'.repeat(50));

	practices.forEach((p, i) => {
		console.log(`\n[${i + 1}] ${p.practice_name || 'Unknown Practice'}`);
		console.log(`    Office ID: ${p.office_id}`);
		console.log(`    Secret Key: ${p.secret_key?.substring(0, 8)}...`);
		console.log(`    PMS Type: ${p.pms_type || 'N/A'}`);
		if (p.data_insert_date) {
			console.log(`    Last Sync: ${p.data_insert_date}`);
		}
	});

	if (practices.length === 0) {
		console.log('\nNo practices found. You need connected practices to access data.');
		console.log('In Sikka portal, practices must authorize your application.');
		return;
	}

	// Step 2: Get request_key for first practice
	const firstPractice = practices[0];
	const requestKeyResult = await getRequestKey(firstPractice);

	if (!requestKeyResult.success) {
		console.log(`\nFAILED to get request_key: ${requestKeyResult.error}`);
		return;
	}

	console.log('\nSUCCESS! Got request_key:');
	console.log(`  Request Key: ${requestKeyResult.requestKey?.substring(0, 16)}...`);
	console.log(`  Expires In: ${requestKeyResult.data?.expires_in}`);
	console.log(`  Status: ${requestKeyResult.data?.status}`);
	console.log(`  Scope: ${requestKeyResult.data?.scope || 'all'}`);

	// Step 3: Test data access
	await testDataAccess(requestKeyResult.requestKey!, firstPractice.office_id);

	console.log('\n' + '='.repeat(70));
	console.log('CONNECTION TEST COMPLETE');
	console.log('='.repeat(70));
	console.log('\nThe Sikka integration is working. Request keys expire after ~24 hours.');
	console.log('Your integration should cache and refresh request_keys as needed.');
}

main().catch(console.error);
