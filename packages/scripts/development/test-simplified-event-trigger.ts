#!/usr/bin/env tsx

/**
 * Test simplified event trigger
 * This script tests if the API server receives notifications from the simplified audit trigger
 */

const uniqueId = Date.now();
const adminEmail = 'admin' + uniqueId + '@testevent.com';
let cookies: string | null = '';

async function testSimplifiedEventTrigger() {
  console.log('🧪 Testing Simplified Event Trigger...\n');

  try {
    // Step 1: Create company and user
    console.log('📋 Step 1: Create Company and Admin User');
    await createCompanyAndUser();
    console.log('✅ Company and user created\n');

    // Step 2: Create custom table
    console.log('📋 Step 2: Create Custom Table');
    await createCustomTable();
    console.log('✅ Custom table created\n');

    // Step 3: Insert a record (should trigger notification)
    console.log('📋 Step 3: Insert Record (Should Trigger Notification)');
    const recordId = await insertRecord();
    console.log(`✅ Record inserted with ID: ${recordId}\n`);

    // Step 4: Wait and check API server logs
    console.log('⏳ Waiting 3 seconds for event processing...');
    console.log('👀 Check the API server console for:');
    console.log('   🔔 "Received workflow event" message');
    console.log('   🧪 "TEST MODE: Event listener is working!" message');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('🎉 Simplified Event Trigger Test COMPLETED!');
    console.log('📝 If you see the test mode messages in the API server logs, the event listener is working!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

async function createCompanyAndUser() {
  const response = await fetch('http://localhost:3333/api/companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Simple Company' + uniqueId,
      slug: 'test-simple-company' + uniqueId,
      description: 'Test company for simplified event triggering',
      admin: {
        email: adminEmail,
        password: 'testpass123',
        profile: {
          name: 'Test Admin',
          email: adminEmail,
          phone: '+1234567890'
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to create company: ${await response.text()}`);
  }

  cookies = response.headers.get('set-cookie');
  if (!cookies) {
    throw new Error('No session cookie received');
  }
  console.log('   Company and admin user created successfully');
}

async function createCustomTable() {
  const response = await fetch('http://localhost:3333/api/schemas', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': cookies || ''
    },
    body: JSON.stringify({
      slug: 'simple_test_table',
      label: 'Simple Test Table',
      description: 'Simple table for event trigger testing',
      is_system: false,
      is_relation: false,
      columns: [
        {
          name: 'name',
          data_type: 'varchar',
          data_type_options: { length: 255 },
          nullable: false,
          default: null,
          view_type: 'text',
          view_editor: 'input'
        },
        {
          name: 'value',
          data_type: 'int',
          nullable: true,
          default: null,
          view_type: 'number',
          view_editor: 'input'
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to create table: ${await response.text()}`);
  }

  console.log('   Custom table created successfully');
}

async function insertRecord() {
  const recordData = {
    name: 'Test Record',
    value: 42
  };

  const response = await fetch('http://localhost:3333/api/records/simple_test_table', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': cookies || ''
    },
    body: JSON.stringify(recordData)
  });

  if (!response.ok) {
    throw new Error(`Failed to insert record: ${await response.text()}`);
  }

  const result = await response.json() as any;
  console.log(`   Record inserted with ID: ${result.id}`);
  return result.id;
}

// Run the test
if (require.main === module) {
  testSimplifiedEventTrigger().then(() => {
    process.exit(0);
  }).catch(console.error);
}

export { testSimplifiedEventTrigger };
