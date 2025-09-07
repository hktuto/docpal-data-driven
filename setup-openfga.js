#!/usr/bin/env node

/**
 * OpenFGA Setup Script
 * 
 * This script initializes OpenFGA with the DocPal authorization model.
 * Run this after resetting the database to restore OpenFGA configuration.
 */

const { OpenFgaClient } = require('@openfga/sdk');
const { config } = require('dotenv');
const fs = require('fs');
const path = require('path');
const AUTHORIZATION_MODEL = require('./authorization-model.json');

// Load environment variables
config({ path: '../.env' });
config({ path: '../packages/api/.env' });

const OPENFGA_API_URL = process.env.OPENFGA_API_URL || 'http://localhost:8080';
const STORE_NAME = 'docpal-store';

/**
 * Update environment file with OpenFGA configuration
 */
function updateEnvFile(filePath, storeId, modelId) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  ${filePath} not found, skipping...`);
      return false;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;

    // Update OPENFGA_STORE_ID
    if (content.includes('OPENFGA_STORE_ID=')) {
      content = content.replace(/OPENFGA_STORE_ID=.*/g, `OPENFGA_STORE_ID=${storeId}`);
      updated = true;
    } else if (content.includes('OPENFGA_API_URL=')) {
      // Add STORE_ID after API_URL if it doesn't exist
      content = content.replace(
        /OPENFGA_API_URL=.*/g, 
        `OPENFGA_API_URL=${OPENFGA_API_URL}\nOPENFGA_STORE_ID=${storeId}`
      );
      updated = true;
    }

    // Update OPENFGA_MODEL_ID
    if (content.includes('OPENFGA_MODEL_ID=')) {
      content = content.replace(/OPENFGA_MODEL_ID=.*/g, `OPENFGA_MODEL_ID=${modelId}`);
      updated = true;
    } else if (content.includes('OPENFGA_STORE_ID=')) {
      // Add MODEL_ID after STORE_ID if it doesn't exist
      content = content.replace(
        /OPENFGA_STORE_ID=.*/g, 
        `OPENFGA_STORE_ID=${storeId}\nOPENFGA_MODEL_ID=${modelId}`
      );
      updated = true;
    }

    if (updated) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Updated ${filePath}`);
      return true;
    } else {
      console.log(`⚠️  No OpenFGA configuration found in ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Failed to update ${filePath}:`, error.message);
    return false;
  }
}



/**
 * Ensure OpenFGA database migration is complete
 */
async function ensureOpenFGAMigration() {
  const { spawn } = require('child_process');
  
    // Get database connection details
  // For Docker migration, we need to use the container hostname 'postgres' instead of 'localhost'
  // We can't rely on DATABASE_URL because it might use 'localhost' which doesn't work in Docker
  const DB_HOST = 'postgres'; // Always use Docker container hostname for migration
  const DB_PORT = process.env.DB_PORT || '5432';
  const DB_NAME = process.env.DB_NAME || 'docpal_dev';
  const DB_USER = process.env.DB_USER || 'docpal_user';
  const DB_PASSWORD = process.env.DB_PASSWORD || 'docpal_password_dev_123';
  
  const datastoreUri = `postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=disable`;
   
   console.log('🔄 Running OpenFGA database migration...');
   console.log(`📊 Database URI: postgres://${DB_USER}:***@${DB_HOST}:${DB_PORT}/${DB_NAME}`);
  
  return new Promise((resolve, reject) => {
    // Try to find the docker network
    const findNetwork = spawn('docker', ['network', 'ls', '--format', '{{.Name}}']);
    let networkOutput = '';
    
    findNetwork.stdout.on('data', (data) => {
      networkOutput += data.toString();
    });
    
    findNetwork.on('close', (code) => {
      const networks = networkOutput.split('\n').filter(n => n.trim());
      let docpalNetwork = networks.find(network => network.includes('docpal-network'));
      
      if (!docpalNetwork) {
        // Try alternative network names
        docpalNetwork = networks.find(network => 
          network.includes('docpal') || 
          network.includes('default') ||
          network.includes('_default')
        );
      }
      
      if (!docpalNetwork) {
        console.log('⚠️  No suitable Docker network found, trying migration without network...');
        console.log('💡 Available networks:', networks.join(', '));
        runMigration(null);
        return;
      }
      
      console.log(`📊 Using network: ${docpalNetwork}`);
      runMigration(docpalNetwork.trim());
    });
    
    function runMigration(networkName) {
      const dockerArgs = [
        'run', '--rm'
      ];
      
      if (networkName) {
        dockerArgs.push('--network', networkName);
      }
      
      dockerArgs.push(
        '-e', 'OPENFGA_DATASTORE_ENGINE=postgres',
        '-e', `OPENFGA_DATASTORE_URI=${datastoreUri}`,
        // Override any environment variables that might interfere
        '-e', `DB_HOST=${DB_HOST}`,
        '-e', `DB_PORT=${DB_PORT}`,
        '-e', `DB_USER=${DB_USER}`,
        '-e', `DB_PASSWORD=${DB_PASSWORD}`,
        '-e', `DB_NAME=${DB_NAME}`,
        'openfga/openfga:latest',
        'migrate'
      );
      
      console.log(`🔧 Running: docker ${dockerArgs.join(' ')}`);
      const migration = spawn('docker', dockerArgs);
      
      migration.stdout.on('data', (data) => {
        console.log(`   ${data.toString().trim()}`);
      });
      
      migration.stderr.on('data', (data) => {
        console.log(`   ${data.toString().trim()}`);
      });
      
      migration.on('close', (code) => {
        if (code === 0) {
          console.log('✅ OpenFGA database migration completed');
          console.log('🔄 Restarting OpenFGA container to pick up schema changes...');
          
          // Restart OpenFGA container to ensure it picks up the new schema
          const restart = spawn('docker-compose', ['restart', 'openfga']);
          
          restart.on('close', (restartCode) => {
            if (restartCode === 0) {
              console.log('✅ OpenFGA container restarted');
              // Wait for container to be fully ready
              setTimeout(() => resolve(), 10000);
            } else {
              console.log('⚠️  OpenFGA restart failed, but continuing...');
              setTimeout(() => resolve(), 5000);
            }
          });
          
          restart.on('error', () => {
            console.log('⚠️  OpenFGA restart failed, but continuing...');
            setTimeout(() => resolve(), 5000);
          });
        } else {
          console.log('⚠️  OpenFGA migration returned non-zero exit code, but continuing...');
          console.log('💡 OpenFGA may create tables automatically on first API call');
          // Still resolve - OpenFGA might work without explicit migration
          setTimeout(() => resolve(), 2000);
        }
      });
      
      migration.on('error', (error) => {
        console.log('⚠️  OpenFGA migration failed, but continuing...');
        console.log('💡 Error:', error.message);
        // Still resolve - OpenFGA might work without explicit migration
        setTimeout(() => resolve(), 2000);
      });
    }
  });
}

async function setupOpenFGA() {
  console.log('🔒 Setting up OpenFGA...');
  console.log(`📍 API URL: ${OPENFGA_API_URL}`);

  try {
    // First, ensure OpenFGA database migration is complete
    console.log('🗄️ Ensuring OpenFGA database migration...');
    await ensureOpenFGAMigration();

    // Initialize client
    const client = new OpenFgaClient({
      apiUrl: OPENFGA_API_URL,
    });

    // Test connection with retry
    console.log('🔍 Testing OpenFGA connection...');
    let retries = 10; // Increased retries after migration
    let connected = false;
    
    while (retries > 0 && !connected) {
      try {
        await client.listStores();
        connected = true;
        console.log('✅ OpenFGA connection successful');
      } catch (error) {
        retries--;
        if (retries > 0) {
          console.log(`⏳ OpenFGA not ready, retrying... (${10 - retries}/10)`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          console.error('❌ OpenFGA connection failed after 10 attempts');
          console.error('💡 Error details:', error.message);
          throw error;
        }
      }
    }

    // Check for existing store
    console.log('🔍 Looking for existing DocPal store...');
    const storesResponse = await client.listStores();
    let storeId = null;

    const existingStore = storesResponse.stores?.find(
      store => store.name === STORE_NAME
    );

    if (existingStore?.id) {
      console.log(`✅ Found existing store: ${existingStore.id}`);
      storeId = existingStore.id;
    } else {
      // Create new store
      console.log('🏗️  Creating new DocPal store...');
      const createStoreResponse = await client.createStore({
        name: STORE_NAME,
      });

      if (!createStoreResponse.id) {
        throw new Error('Failed to create OpenFGA store');
      }

      storeId = createStoreResponse.id;
      console.log(`✅ Created new store: ${storeId}`);
    }

    // Update client with store ID
    const storeClient = new OpenFgaClient({
      apiUrl: OPENFGA_API_URL,
      storeId: storeId,
    });

    // Write authorization model
    console.log('📝 Writing authorization model...');
    const modelResponse = await storeClient.writeAuthorizationModel(AUTHORIZATION_MODEL);
    
    if (!modelResponse.authorization_model_id) {
      throw new Error('Failed to write authorization model');
    }

    console.log(`✅ Authorization model written: ${modelResponse.authorization_model_id}`);

    // Update environment files
    console.log('📝 Updating environment files...');
    
    const rootDir = path.resolve(__dirname, '..');
    
    // Create .env files from examples if they don't exist
    const envExampleFiles = [
      { example: path.join(rootDir, 'env.example'), env: path.join(rootDir, '.env') },
      { example: path.join(rootDir, 'packages', 'api', 'env.example'), env: path.join(rootDir, 'packages', 'api', '.env') }
    ];
    
    for (const { example, env } of envExampleFiles) {
      if (fs.existsSync(example) && !fs.existsSync(env)) {
        try {
          fs.copyFileSync(example, env);
          console.log(`📄 Created ${env} from ${path.basename(example)}`);
        } catch (error) {
          console.log(`⚠️  Could not create ${env}: ${error.message}`);
        }
      }
    }
    
    const envFiles = [
      path.join(rootDir, '.env'),
      path.join(rootDir, 'env.example'),
      path.join(rootDir, 'packages', 'api', '.env'),
      path.join(rootDir, 'packages', 'api', 'env.example')
    ];

    let updatedFiles = 0;
    for (const envFile of envFiles) {
      if (updateEnvFile(envFile, storeId, modelResponse.authorization_model_id)) {
        updatedFiles++;
      }
    }

    console.log('');
    console.log('🎉 OpenFGA setup completed successfully!');
    console.log('');
    console.log('📄 Configuration:');
    console.log(`OPENFGA_API_URL=${OPENFGA_API_URL}`);
    console.log(`OPENFGA_STORE_ID=${storeId}`);
    console.log(`OPENFGA_MODEL_ID=${modelResponse.authorization_model_id}`);
    console.log('');
    console.log(`✅ Updated ${updatedFiles} environment file(s) automatically`);

    return {
      storeId,
      modelId: modelResponse.authorization_model_id
    };

  } catch (error) {
    console.error('❌ OpenFGA setup failed:', error);
    throw error;
  }
}

// Run setup if called directly
if (require.main === module) {
  setupOpenFGA()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { setupOpenFGA, AUTHORIZATION_MODEL };
