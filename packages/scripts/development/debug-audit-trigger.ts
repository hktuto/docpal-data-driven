#!/usr/bin/env tsx

/**
 * Debug audit trigger functionality
 * This script checks if audit triggers are properly attached to custom tables
 */

import { Pool } from 'pg';

const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'docpal_dev',
  user: 'docpal_user',
  password: 'docpal_password_dev_123',
};

async function debugAuditTrigger() {
  console.log('🔍 Debugging audit trigger functionality...\n');

  const pool = new Pool(dbConfig);
  
  try {
    // Get all company schemas
    const schemasResult = await pool.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'company_%'
      ORDER BY schema_name
    `);
    
    console.log(`Found ${schemasResult.rows.length} company schemas:`);
    
    for (const schema of schemasResult.rows) {
      const schemaName = schema.schema_name;
      console.log(`\n📋 Checking schema: ${schemaName}`);
      
      // Check tables in this schema
      const tablesResult = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = $1 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `, [schemaName]);
      
      console.log(`   Tables: ${tablesResult.rows.map(r => r.table_name).join(', ')}`);
      
      // Check triggers for each table
      for (const table of tablesResult.rows) {
        const tableName = table.table_name;
        
        const triggersResult = await pool.query(`
          SELECT trigger_name, event_manipulation, action_timing
          FROM information_schema.triggers 
          WHERE trigger_schema = $1 
          AND event_object_table = $2
          ORDER BY trigger_name
        `, [schemaName, tableName]);
        
        if (triggersResult.rows.length > 0) {
          console.log(`   📌 ${tableName} triggers:`, triggersResult.rows.map(r => 
            `${r.trigger_name} (${r.action_timing} ${r.event_manipulation})`
          ).join(', '));
        } else {
          console.log(`   ⚠️  ${tableName} has NO triggers`);
        }
      }
      
      // Check custom_data_model entries
      const modelsResult = await pool.query(`
        SELECT slug, events 
        FROM ${schemaName}.custom_data_model 
        ORDER BY slug
      `);
      
      if (modelsResult.rows.length > 0) {
        console.log(`   📊 Custom data models:`);
        for (const model of modelsResult.rows) {
          const hasEvents = model.events && Object.keys(model.events).length > 0;
          console.log(`     - ${model.slug}: ${hasEvents ? 'HAS events' : 'no events'}`);
          if (hasEvents) {
            console.log(`       Events: ${JSON.stringify(model.events)}`);
          }
        }
      } else {
        console.log(`   📊 No custom data models found`);
      }
    }
    
    console.log('\n🎉 Audit trigger debug completed!');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugAuditTrigger().catch(console.error);
}

export { debugAuditTrigger };
