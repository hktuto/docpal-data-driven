#!/usr/bin/env tsx
// Debug script to test company creation step by step

import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'docpal_dev',
  user: process.env.DB_USER || 'docpal_user',
  password: process.env.DB_PASSWORD || 'docpal_password_dev_123',
});

const testCompanyCreation = async () => {
  console.log('🔍 Testing company creation step by step...');
  
  try {
    // Step 1: Test basic company insertion
    console.log('\n1. Testing basic company insertion...');
    const timestamp = Date.now();
    const companyResult = await pool.query(
      `INSERT INTO company (name, slug, description, created_by) VALUES ($1, $2, $3, $4) RETURNING *`,
      [`Debug Test Company ${timestamp}`, `debug-test-${timestamp}`, 'A debug test company', null]
    );
    
    const company = companyResult.rows[0];
    console.log('✅ Company created:', company);
    
    // Step 2: Test tenant schema creation
    console.log('\n2. Testing tenant schema creation...');
    await pool.query('SELECT create_tenant_schema($1)', [company.id]);
    console.log('✅ Tenant schema created');
    
    // Step 3: Skip company profile (now merged into global company table)
    console.log('\n3. Company profile data already in global company table ✅');
    
    // Step 4: Test user creation
    console.log('\n4. Testing user creation...');
    const userResult = await pool.query(
      `INSERT INTO "user" (email, password) VALUES ($1, $2) RETURNING *`,
      [`debug-${timestamp}@test.com`, '$2b$12$hashedpassword']
    );
    
    const user = userResult.rows[0];
    console.log('✅ User created:', user);
    
    // Step 5: Test company-user relationship
    console.log('\n5. Testing company-user relationship...');
    await pool.query(
      `INSERT INTO company_user (company_id, user_id) VALUES ($1, $2)`,
      [company.id, user.id]
    );
    console.log('✅ Company-user relationship created');
    
    // Step 6: Test user profile creation
    console.log('\n6. Testing user profile creation...');
    const schemaName = `company_${company.id.replace(/-/g, '_')}`;
    await pool.query(
      `INSERT INTO ${schemaName}.user_profile 
       (id, name, email, phone, address, city, preferences, role, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        user.id,
        'Debug User',
        `debug-${timestamp}@test.com`,
        `+123456${timestamp.toString().slice(-4)}`,
        '123 Debug St',
        'Debug City',
        {},
        'owner',
        user.id
      ]
    );
    console.log('✅ User profile created');
    
    console.log('\n🎉 All steps completed successfully!');
    
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    const cleanupSchemaName = `company_${company.id.replace(/-/g, '_')}`;
    await pool.query(`DROP SCHEMA ${cleanupSchemaName} CASCADE`);
    await pool.query('DELETE FROM company WHERE id = $1', [company.id]);
    await pool.query('DELETE FROM "user" WHERE id = $1', [user.id]);
    console.log('✅ Cleanup completed');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
};

testCompanyCreation();
