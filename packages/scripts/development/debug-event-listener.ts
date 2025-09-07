#!/usr/bin/env tsx

/**
 * Debug the event listener directly
 * This script tests the event listener functionality in isolation
 */

import { Pool } from 'pg';

const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'docpal_dev',
  user: 'docpal_user',
  password: 'docpal_password_dev_123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

async function debugEventListener() {
  console.log('🔍 Debugging Event Listener Functionality...\n');

  const pool = new Pool(dbConfig);
  let eventListener: any = null;
  let sender: any = null;

  try {
    // Create listener connection (same as API server)
    console.log('📡 Creating event listener connection...');
    eventListener = await pool.connect();
    
    // Listen for workflow_events notifications
    await eventListener.query('LISTEN workflow_events');
    console.log('✅ Listening for workflow_events notifications');
    
    let notificationReceived = false;
    
    // Set up notification handler
    eventListener.on('notification', (msg: any) => {
      console.log('🔔 Received notification:', {
        channel: msg.channel,
        payload: msg.payload ? JSON.parse(msg.payload) : null
      });
      notificationReceived = true;
    });

    eventListener.on('error', (error: any) => {
      console.error('❌ Event listener error:', error);
    });

    // Create sender connection
    console.log('📤 Creating sender connection...');
    sender = await pool.connect();
    
    // Send test notification
    console.log('📤 Sending test notification...');
    const testPayload = {
      event_type: 'INSERT',
      table_name: 'test_table',
      company_id: '12345678-1234-1234-1234-123456789012',
      record_id: '87654321-4321-4321-4321-210987654321',
      schema_events: {
        triggers: [
          {
            workflow_slug: 'test-workflow',
            event: 'insert'
          }
        ]
      },
      timestamp: new Date().toISOString()
    };
    
    await sender.query('SELECT pg_notify($1, $2)', ['workflow_events', JSON.stringify(testPayload)]);
    console.log('✅ Test notification sent');
    
    // Wait for notification
    console.log('⏳ Waiting 3 seconds for notification...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    if (notificationReceived) {
      console.log('✅ Event listener is working correctly!');
    } else {
      console.log('❌ Event listener did not receive notification');
      
      // Check if we're connected to the right database
      const dbResult = await eventListener.query('SELECT current_database(), current_user, inet_server_addr(), inet_server_port()');
      console.log('📊 Connection info:', dbResult.rows[0]);
      
      // Check if LISTEN is active
      const listenResult = await eventListener.query(`
        SELECT * FROM pg_listening_channels() WHERE channel = 'workflow_events'
      `);
      console.log('📊 Active listeners:', listenResult.rows);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    if (sender) sender.release();
    if (eventListener) eventListener.release();
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugEventListener().catch(console.error);
}

export { debugEventListener };
