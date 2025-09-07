#!/usr/bin/env tsx

/**
 * Test PostgreSQL NOTIFY/LISTEN functionality
 * This script tests if PostgreSQL notifications are working correctly
 */

import { Pool } from 'pg';

const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'docpal_dev',
  user: 'docpal_user',
  password: 'docpal_password_dev_123',
};

async function testPgNotify() {
  console.log('🧪 Testing PostgreSQL NOTIFY/LISTEN functionality...\n');

  const pool = new Pool(dbConfig);
  
  try {
    // Create listener connection
    const listener = await pool.connect();
    console.log('📡 Setting up listener...');
    
    await listener.query('LISTEN workflow_events');
    console.log('✅ Listening for workflow_events notifications');
    
    // Set up notification handler
    listener.on('notification', (msg) => {
      console.log('🔔 Received notification:', {
        channel: msg.channel,
        payload: msg.payload ? JSON.parse(msg.payload) : null
      });
    });
    
    // Create sender connection
    const sender = await pool.connect();
    console.log('📤 Sending test notification...');
    
    // Send a test notification
    const testPayload = {
      event_type: 'INSERT',
      table_name: 'test_table',
      company_id: '12345678-1234-1234-1234-123456789012',
      record_id: '87654321-4321-4321-4321-210987654321',
      timestamp: new Date().toISOString()
    };
    
    await sender.query('SELECT pg_notify($1, $2)', ['workflow_events', JSON.stringify(testPayload)]);
    console.log('✅ Test notification sent');
    
    // Wait a moment for the notification to be received
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    sender.release();
    listener.release();
    
    console.log('\n🎉 PostgreSQL NOTIFY/LISTEN test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
if (require.main === module) {
  testPgNotify().catch(console.error);
}

export { testPgNotify };
