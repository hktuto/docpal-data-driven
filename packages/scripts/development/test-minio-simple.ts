// Simple MinIO test to debug connection issues

import * as Minio from 'minio';

const testMinIOSimple = async (): Promise<void> => {
  console.log('🔍 Testing MinIO with simple client...');
  
  try {
    const client = new Minio.Client({
      endPoint: 'localhost',
      port: 9000,
      useSSL: false,
      accessKey: 'minioadmin',
      secretKey: 'minioadmin123',
    });
    
    console.log('✅ MinIO client created');
    
    const buckets = await client.listBuckets();
    console.log(`✅ Found ${buckets.length} buckets:`, buckets.map(b => b.name));
    
    // Test creating a bucket
    const testBucketName = 'test-bucket';
    const bucketExists = await client.bucketExists(testBucketName);
    
    if (!bucketExists) {
      console.log('🏗️  Creating test bucket...');
      await client.makeBucket(testBucketName, 'us-east-1');
      console.log('✅ Test bucket created');
    } else {
      console.log('✅ Test bucket already exists');
    }
    
    console.log('🎉 MinIO test completed successfully!');
    
  } catch (error) {
    console.error('❌ MinIO test failed:', error);
  }
};

testMinIOSimple().catch(console.error);
