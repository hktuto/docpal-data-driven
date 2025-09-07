// OpenFGA setup script for DocPal

import { OpenFgaApi, Configuration, WriteAuthorizationModelRequest } from '@openfga/sdk';
import { spawn } from 'child_process';

// OpenFGA Authorization Model for DocPal
const AUTHORIZATION_MODEL: WriteAuthorizationModelRequest = {
  schema_version: '1.1',
  type_definitions: [
    {
      type: 'company',
      relations: {
        member: { this: {} },
        admin: { this: {} },
      },
      metadata: {
        relations: {
          member: { directly_related_user_types: [{ type: 'user' }] },
          admin: { directly_related_user_types: [{ type: 'user' }] },
        },
      },
    },
    {
      type: 'user',
    },
    {
      type: 'role',
      relations: {
        assignee: { this: {} },
      },
      metadata: {
        relations: {
          assignee: { directly_related_user_types: [{ type: 'user' }] },
        },
      },
    },
    {
      type: 'group',
      relations: {
        member: { this: {} },
      },
      metadata: {
        relations: {
          member: { directly_related_user_types: [{ type: 'user' }] },
        },
      },
    },
    {
      type: 'custom_data_model',
      relations: {
        owner: { this: {} },
        viewer: {
          union: {
            child: [
              { this: {} },
              { computedUserset: { relation: 'owner' } },
            ],
          },
        },
        editor: {
          union: {
            child: [
              { this: {} },
              { computedUserset: { relation: 'owner' } },
            ],
          },
        },
        creator: {
          union: {
            child: [
              { this: {} },
              { computedUserset: { relation: 'owner' } },
            ],
          },
        },
        admin: {
          union: {
            child: [
              { this: {} },
              { computedUserset: { relation: 'owner' } },
            ],
          },
        },
      },
      metadata: {
        relations: {
          owner: { directly_related_user_types: [{ type: 'user' }] },
          viewer: {
            directly_related_user_types: [
              { type: 'user' },
              { type: 'role', relation: 'assignee' },
              { type: 'group', relation: 'member' },
            ],
          },
          editor: {
            directly_related_user_types: [
              { type: 'user' },
              { type: 'role', relation: 'assignee' },
              { type: 'group', relation: 'member' },
            ],
          },
          creator: {
            directly_related_user_types: [
              { type: 'user' },
              { type: 'role', relation: 'assignee' },
              { type: 'group', relation: 'member' },
            ],
          },
          admin: {
            directly_related_user_types: [
              { type: 'user' },
              { type: 'role', relation: 'assignee' },
              { type: 'group', relation: 'member' },
            ],
          },
        },
      },
    },
  ],
};

/**
 * Run OpenFGA database migration
 */
const runOpenFGAMigration = async (): Promise<void> => {
  console.log('🔄 Running OpenFGA database migration...');
  
  const DB_HOST = 'postgres'; // Docker container hostname
  const DB_PORT = process.env.DB_PORT || '5432';
  const DB_NAME = process.env.DB_NAME || 'docpal_dev';
  const DB_USER = process.env.DB_USER || 'docpal_user';
  const DB_PASSWORD = process.env.DB_PASSWORD || 'docpal_password_dev_123';
  
  const datastoreUri = `postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=disable`;
  
  console.log(`📊 Database URI: postgres://${DB_USER}:***@${DB_HOST}:${DB_PORT}/${DB_NAME}`);
  
  return new Promise((resolve) => {
    // Find Docker network
    const findNetwork = spawn('docker', ['network', 'ls', '--format', '{{.Name}}']);
    let networkOutput = '';
    
    findNetwork.stdout.on('data', (data) => {
      networkOutput += data.toString();
    });
    
    findNetwork.on('close', () => {
      const networks = networkOutput.split('\n').filter(n => n.trim());
      let docpalNetwork = networks.find(network => 
        network.includes('docpal-network') || 
        network.includes('docpal') || 
        network.includes('_default')
      );
      
      if (!docpalNetwork) {
        console.log('⚠️  No suitable Docker network found, trying migration without network...');
        runMigration(null);
        return;
      }
      
      console.log(`📊 Using network: ${docpalNetwork}`);
      runMigration(docpalNetwork.trim());
    });
    
    function runMigration(networkName: string | null) {
      const dockerArgs = ['run', '--rm'];
      
      if (networkName) {
        dockerArgs.push('--network', networkName);
      }
      
      dockerArgs.push(
        '-e', 'OPENFGA_DATASTORE_ENGINE=postgres',
        '-e', `OPENFGA_DATASTORE_URI=${datastoreUri}`,
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
          console.log('🔄 Restarting OpenFGA container...');
          
          const restart = spawn('docker-compose', ['restart', 'openfga']);
          restart.on('close', () => {
            console.log('✅ OpenFGA container restarted');
            setTimeout(() => resolve(), 10000); // Wait for restart
          });
        } else {
          console.log('⚠️  Migration returned non-zero exit code, but continuing...');
          setTimeout(() => resolve(), 2000);
        }
      });
      
      migration.on('error', () => {
        console.log('⚠️  Migration failed, but continuing...');
        setTimeout(() => resolve(), 2000);
      });
    }
  });
};

/**
 * Setup OpenFGA with authorization model
 */
export const setupOpenFGA = async (): Promise<{ storeId: string; modelId: string }> => {
  console.log('🔒 Setting up OpenFGA...');
  
  const OPENFGA_API_URL = process.env.OPENFGA_API_URL || 'http://localhost:8080';
  const STORE_NAME = 'docpal-store';
  
  console.log(`📍 API URL: ${OPENFGA_API_URL}`);
  
  try {
    // Run database migration first
    await runOpenFGAMigration();
    
    // Initialize client
    const client = new OpenFgaApi(new Configuration({
      apiUrl: OPENFGA_API_URL,
    }));
    
    // Test connection with retry
    console.log('🔍 Testing OpenFGA connection...');
    let retries = 10;
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
          throw new Error(`OpenFGA connection failed after 10 attempts: ${error}`);
        }
      }
    }
    
    // Check for existing store
    console.log('🔍 Looking for existing DocPal store...');
    const storesResponse = await client.listStores();
    let storeId: string;
    
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
    
    // Client doesn't need storeId in configuration for SDK 0.9+
    const storeClient = new OpenFgaApi(new Configuration({
      apiUrl: OPENFGA_API_URL,
    }));
    
    // Write authorization model
    console.log('📝 Writing authorization model...');
    const modelResponse = await storeClient.writeAuthorizationModel(storeId, AUTHORIZATION_MODEL);
    
    if (!modelResponse.authorization_model_id) {
      throw new Error('Failed to write authorization model');
    }
    
    console.log(`✅ Authorization model written: ${modelResponse.authorization_model_id}`);
    
    console.log('');
    console.log('🎉 OpenFGA setup completed successfully!');
    console.log('');
    console.log('📄 Configuration:');
    console.log(`OPENFGA_API_URL=${OPENFGA_API_URL}`);
    console.log(`OPENFGA_STORE_ID=${storeId}`);
    console.log(`OPENFGA_MODEL_ID=${modelResponse.authorization_model_id}`);
    
    return {
      storeId,
      modelId: modelResponse.authorization_model_id
    };
    
  } catch (error) {
    console.error('❌ OpenFGA setup failed:', error);
    throw error;
  }
};

/**
 * Test OpenFGA with basic operations
 */
export const testOpenFGA = async (storeId: string, modelId: string): Promise<void> => {
  console.log('🧪 Testing OpenFGA operations...');
  
  const OPENFGA_API_URL = process.env.OPENFGA_API_URL || 'http://localhost:8080';
  
  const client = new OpenFgaApi(new Configuration({
    apiUrl: OPENFGA_API_URL,
  }));
  
  try {
    // Test writing a relationship
    console.log('📝 Testing write relationship...');
    await client.write(storeId, {
      writes: {
        tuple_keys: [{
          user: 'user:test-user',
          relation: 'admin',
          object: 'company:test-company',
        }],
      },
    });
    console.log('✅ Write relationship successful');
    
    // Test checking permission
    console.log('🔍 Testing check permission...');
    const checkResponse = await client.check(storeId, {
      tuple_key: {
        user: 'user:test-user',
        relation: 'admin',
        object: 'company:test-company',
      },
    });
    console.log(`✅ Check permission result: ${checkResponse.allowed}`);
    
    // Clean up test data
    console.log('🧹 Cleaning up test data...');
    await client.write(storeId, {
      deletes: {
        tuple_keys: [{
          user: 'user:test-user',
          relation: 'admin',
          object: 'company:test-company',
        }],
      },
    });
    console.log('✅ Cleanup successful');
    
    console.log('🎉 OpenFGA test completed successfully!');
    
  } catch (error) {
    console.error('❌ OpenFGA test failed:', error);
    throw error;
  }
};

// Main execution
const main = async (): Promise<void> => {
  try {
    const { storeId, modelId } = await setupOpenFGA();
    await testOpenFGA(storeId, modelId);
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
