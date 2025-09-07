// Simple authentication test script

import { initializeDatabase } from '../../api/src/database/utils/database';
import { initializeValkey } from '../../api/src/utils/valkey';
import { 
  createUser, 
  authenticateUser, 
  findUserByEmail 
} from '../../api/src/services/auth/auth_service';

const testAuth = async () => {
  console.log('🧪 Testing DocPal Authentication System...\n');
  
  try {
    // Initialize services
    console.log('🔗 Initializing services...');
    
    initializeDatabase({
      host: 'localhost',
      port: 5432,
      database: 'docpal_dev',
      user: 'docpal_user',
      password: 'docpal_password_dev_123',
    });
    
    initializeValkey({
      host: 'localhost',
      port: 6379,
      password: 'valkey_password_dev_123',
    });
    
    console.log('✅ Services initialized\n');
    
    // Test user creation
    console.log('👤 Testing user creation...');
    const testEmail = `test-${Date.now()}@docpal.com`;
    const testPassword = 'testpassword123';
    
    try {
      const newUser = await createUser({
        email: testEmail,
        password: testPassword,
      });
      
      console.log('✅ User created:', {
        id: newUser.id,
        email: newUser.email,
      });
    } catch (error: any) {
      console.log('❌ User creation failed:', error.message);
      return;
    }
    
    // Test user authentication
    console.log('\n🔐 Testing user authentication...');
    
    try {
      const authenticatedUser = await authenticateUser({
        email: testEmail,
        password: testPassword,
      });
      
      if (authenticatedUser) {
        console.log('✅ Authentication successful:', {
          id: authenticatedUser.id,
          email: authenticatedUser.email,
        });
      } else {
        console.log('❌ Authentication failed: Invalid credentials');
        return;
      }
    } catch (error: any) {
      console.log('❌ Authentication error:', error.message);
      return;
    }
    
    // Test wrong password
    console.log('\n🚫 Testing wrong password...');
    
    try {
      const failedAuth = await authenticateUser({
        email: testEmail,
        password: 'wrongpassword',
      });
      
      if (failedAuth) {
        console.log('❌ Security issue: Wrong password accepted!');
      } else {
        console.log('✅ Wrong password correctly rejected');
      }
    } catch (error: any) {
      console.log('❌ Authentication test error:', error.message);
    }
    
    // Test finding user by email
    console.log('\n🔍 Testing find user by email...');
    
    try {
      const foundUser = await findUserByEmail(testEmail);
      
      if (foundUser) {
        console.log('✅ User found by email:', {
          id: foundUser.id,
          email: foundUser.email,
        });
      } else {
        console.log('❌ User not found by email');
      }
    } catch (error: any) {
      console.log('❌ Find user error:', error.message);
    }
    
    console.log('\n🎉 Authentication system test completed!');
    
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
  }
  
  process.exit(0);
};

testAuth().catch(console.error);
