#!/usr/bin/env tsx

/**
 * Quick script to check if the test record was updated by the workflow
 */

const recordId = 'e4d1d97f-d289-4b4f-a61f-62a5a52113be';
const tableName = 'test_products';

// Get session cookies from the latest test run
const uniqueId = Date.now() - 1000; // Approximate the test run
const adminEmail = 'admin' + uniqueId + '@testevent.com';

async function checkRecordStatus() {
  try {
    // Login to get session
    const loginResponse = await fetch('http://localhost:3333/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: adminEmail,
        password: 'testpass123'
      })
    });

    if (!loginResponse.ok) {
      console.log('❌ Login failed, using latest test record ID...');
      return;
    }

    const cookies = loginResponse.headers.get('set-cookie');
    
    // Get the record
    const response = await fetch(`http://localhost:3333/api/records/${tableName}/${recordId}`, {
      headers: { 'Cookie': cookies || '' }
    });

    if (!response.ok) {
      console.log('❌ Failed to get record:', await response.text());
      return;
    }

    const record = await response.json() as any;
    console.log('📋 Record Status:');
    console.log(`   ID: ${record.id}`);
    console.log(`   Status: ${record.status}`);
    console.log(`   Auto Updated: ${record.auto_updated}`);
    console.log(`   Updated At: ${record.updated_at}`);
    
    if (record.status === 'processed' && record.auto_updated === true) {
      console.log('✅ Record was successfully updated by workflow!');
    } else {
      console.log('⚠️  Record has not been updated by workflow yet');
    }

  } catch (error) {
    console.error('❌ Error checking record:', error);
  }
}

checkRecordStatus();
