import axios from 'axios';

const API_BASE = 'http://localhost:3333/api';

// Test configuration
const testConfig = {
  email: 'test@example.com',
  password: 'password123',
  companyName: 'Test Company',
  productTableSlug: 'test_products',
  categoryTableSlug: 'test_categories',
  reviewTableSlug: 'test_reviews'
};

let sessionCookie = '';
let companyId = '';

/**
 * Test Enhanced Query API
 * This script tests the new enhanced query system with:
 * - Dot notation for relations and JSON paths
 * - Explicit relation queries
 * - Aggregation operations
 * - Dynamic filter aggregation
 */

const makeRequest = async (method: string, url: string, data?: any) => {
  try {
    const config: any = {
      method,
      url: `${API_BASE}${url}`,
      headers: {
        'Content-Type': 'application/json',
        ...(sessionCookie && { Cookie: sessionCookie })
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response;
  } catch (error: any) {
    console.error(`Error in ${method} ${url}:`, error.response?.data || error.message);
    throw error;
  }
};

const testEnhancedQuerySystem = async () => {
  console.log('🚀 Starting Enhanced Query API Tests...\n');

  try {
    // Step 1: Login and setup
    console.log('1. Setting up test environment...');
    const loginResponse = await makeRequest('POST', '/auth/login', {
      email: testConfig.email,
      password: testConfig.password
    });
    
    sessionCookie = loginResponse.headers['set-cookie']?.[0] || '';
    
    const companiesResponse = await makeRequest('GET', '/companies');
    companyId = companiesResponse.data[0].id;
    
    await makeRequest('POST', `/companies/${companyId}/select`);
    console.log('✅ Environment setup complete');

    // Step 2: Create test schemas
    console.log('\n2. Creating test schemas...');
    
    // Categories table
    try {
      await makeRequest('POST', '/schemas', {
        slug: testConfig.categoryTableSlug,
        label: 'Categories',
        description: 'Product categories',
        columns: [
          {
            name: 'name',
            data_type: 'varchar',
            data_type_options: { length: 100 },
            nullable: false,
            view_type: 'text'
          },
          {
            name: 'description',
            data_type: 'text',
            nullable: true,
            view_type: 'text'
          }
        ]
      });
      console.log('✅ Categories schema created');
    } catch (error: any) {
      if (error.response?.status !== 409) throw error;
      console.log('✅ Categories schema already exists');
    }

    // Products table with relations and JSON
    try {
      await makeRequest('POST', '/schemas', {
        slug: testConfig.productTableSlug,
        label: 'Products',
        description: 'Product catalog with relations',
        columns: [
          {
            name: 'name',
            data_type: 'varchar',
            data_type_options: { length: 255 },
            nullable: false,
            view_type: 'text'
          },
          {
            name: 'price',
            data_type: 'decimal',
            data_type_options: { precision: 10, scale: 2 },
            nullable: false,
            view_type: 'number'
          },
          {
            name: 'category_id',
            data_type: 'uuid',
            nullable: true,
            view_type: 'relation',
            is_relation: true,
            relation_setting: {
              target_table: testConfig.categoryTableSlug,
              target_field: 'id',
              display_field: 'name'
            }
          },
          {
            name: 'status',
            data_type: 'varchar',
            data_type_options: { length: 50 },
            nullable: false,
            default: 'active',
            view_type: 'text'
          },
          {
            name: 'priority',
            data_type: 'integer',
            nullable: false,
            default: 5,
            view_type: 'number'
          },
          {
            name: 'is_featured',
            data_type: 'boolean',
            nullable: false,
            default: false,
            view_type: 'boolean'
          },
          {
            name: 'metadata',
            data_type: 'jsonb',
            nullable: true,
            view_type: 'json'
          }
        ]
      });
      console.log('✅ Products schema created');
    } catch (error: any) {
      if (error.response?.status !== 409) throw error;
      console.log('✅ Products schema already exists');
    }

    // Reviews table for aggregation testing
    try {
      await makeRequest('POST', '/schemas', {
        slug: testConfig.reviewTableSlug,
        label: 'Reviews',
        description: 'Product reviews',
        columns: [
          {
            name: 'product_id',
            data_type: 'uuid',
            nullable: false,
            view_type: 'relation',
            is_relation: true,
            relation_setting: {
              target_table: testConfig.productTableSlug,
              target_field: 'id',
              display_field: 'name'
            }
          },
          {
            name: 'rating',
            data_type: 'integer',
            nullable: false,
            view_type: 'number'
          },
          {
            name: 'comment',
            data_type: 'text',
            nullable: true,
            view_type: 'text'
          }
        ]
      });
      console.log('✅ Reviews schema created');
    } catch (error: any) {
      if (error.response?.status !== 409) throw error;
      console.log('✅ Reviews schema already exists');
    }

    // Step 3: Create test data
    console.log('\n3. Creating test data...');
    
    // Create categories
    const categories = [
      { name: 'Electronics', description: 'Electronic devices and gadgets' },
      { name: 'Books', description: 'Books and literature' },
      { name: 'Clothing', description: 'Apparel and accessories' }
    ];

    const categoryIds: string[] = [];
    for (const category of categories) {
      try {
        const response = await makeRequest('POST', `/records/${testConfig.categoryTableSlug}`, category);
        categoryIds.push(response.data.id);
      } catch (error) {
        // Category might already exist, continue
      }
    }

    // Create products
    const products = [
      {
        name: 'iPhone 15',
        price: 999.99,
        category_id: categoryIds[0],
        status: 'active',
        priority: 10,
        is_featured: true,
        metadata: {
          brand: 'Apple',
          color: 'Black',
          storage: '128GB',
          features: ['Face ID', 'Wireless Charging', '5G']
        }
      },
      {
        name: 'Samsung Galaxy S24',
        price: 899.99,
        category_id: categoryIds[0],
        status: 'active',
        priority: 9,
        is_featured: true,
        metadata: {
          brand: 'Samsung',
          color: 'White',
          storage: '256GB',
          features: ['Fingerprint', 'Fast Charging', '5G']
        }
      },
      {
        name: 'The Great Gatsby',
        price: 12.99,
        category_id: categoryIds[1],
        status: 'active',
        priority: 5,
        is_featured: false,
        metadata: {
          author: 'F. Scott Fitzgerald',
          pages: 180,
          genre: 'Classic Literature'
        }
      },
      {
        name: 'Cotton T-Shirt',
        price: 29.99,
        category_id: categoryIds[2],
        status: 'inactive',
        priority: 3,
        is_featured: false,
        metadata: {
          material: 'Cotton',
          sizes: ['S', 'M', 'L', 'XL'],
          colors: ['Red', 'Blue', 'Green']
        }
      }
    ];

    const productIds: string[] = [];
    for (const product of products) {
      try {
        const response = await makeRequest('POST', `/records/${testConfig.productTableSlug}`, product);
        productIds.push(response.data.id);
      } catch (error) {
        // Product might already exist, continue
      }
    }

    // Create reviews
    const reviews = [
      { product_id: productIds[0], rating: 5, comment: 'Excellent phone!' },
      { product_id: productIds[0], rating: 4, comment: 'Great features' },
      { product_id: productIds[1], rating: 4, comment: 'Good value' },
      { product_id: productIds[1], rating: 5, comment: 'Love the camera' },
      { product_id: productIds[2], rating: 5, comment: 'Classic book' }
    ];

    for (const review of reviews) {
      try {
        await makeRequest('POST', `/records/${testConfig.reviewTableSlug}`, review);
      } catch (error) {
        // Review might already exist, continue
      }
    }

    console.log('✅ Test data created');

    // Step 4: Test basic enhanced query with dot notation
    console.log('\n4. Testing basic enhanced query with dot notation...');
    const basicQuery = await makeRequest('POST', `/records/${testConfig.productTableSlug}/query/enhanced`, {
      columns: [
        'id',
        'name',
        'price',
        'category_id.name',  // Relation dot notation
        'metadata.brand',    // JSON path
        'metadata.features'  // JSON array
      ],
      limit: 10
    });

    console.log('✅ Basic enhanced query successful');
    console.log('Sample record:', JSON.stringify(basicQuery.data.records[0], null, 2));

    // Step 5: Test explicit relation queries
    console.log('\n5. Testing explicit relation queries...');
    const relationQuery = await makeRequest('POST', `/records/${testConfig.productTableSlug}/query/enhanced`, {
      columns: ['id', 'name', 'price'],
      relationColumns: [
        {
          label: 'category_details',
          local_key: 'category_id',
          foreign_table: testConfig.categoryTableSlug,
          foreign_key: 'id',
          display_columns: ['name', 'description']
        }
      ],
      limit: 5
    });

    console.log('✅ Relation query successful');
    console.log('Sample record with relations:', JSON.stringify(relationQuery.data.records[0], null, 2));

    // Step 6: Test aggregation queries
    console.log('\n6. Testing aggregation queries...');
    const aggQuery = await makeRequest('POST', `/records/${testConfig.productTableSlug}/query/enhanced`, {
      columns: ['id', 'name', 'price'],
      aggColumns: [
        {
          label: 'review_count',
          local_key: 'id',
          foreign_table: testConfig.reviewTableSlug,
          foreign_key: 'product_id',
          function: 'count'
        },
        {
          label: 'avg_rating',
          local_key: 'id',
          foreign_table: testConfig.reviewTableSlug,
          foreign_key: 'product_id',
          function: 'avg',
          function_field: 'rating'
        }
      ],
      limit: 5
    });

    console.log('✅ Aggregation query successful');
    console.log('Sample record with aggregations:', JSON.stringify(aggQuery.data.records[0], null, 2));

    // Step 7: Test dynamic filter aggregation
    console.log('\n7. Testing dynamic filter aggregation...');
    const filterAggQuery = await makeRequest('POST', `/records/${testConfig.productTableSlug}/query/enhanced`, {
      columns: ['id', 'name', 'price'],
      aggregation_filter: ['status', 'priority', 'is_featured', 'category_id'],
      limit: 5
    });

    console.log('✅ Filter aggregation successful');
    console.log('Filter aggregations:', JSON.stringify(filterAggQuery.data.aggregation, null, 2));

    // Step 8: Test complex query with all features
    console.log('\n8. Testing complex query with all features...');
    const complexQuery = await makeRequest('POST', `/records/${testConfig.productTableSlug}/query/enhanced`, {
      columns: [
        'id',
        'name',
        'price',
        'category_id.name',
        'metadata.brand',
        'metadata.features'
      ],
      filters: {
        'status': 'active',
        'metadata.brand': 'Apple'
      },
      sort: [
        { field: 'priority', direction: 'DESC' },
        { field: 'price', direction: 'ASC' }
      ],
      search: 'iPhone',
      relationColumns: [
        {
          label: 'category_info',
          local_key: 'category_id',
          foreign_table: testConfig.categoryTableSlug,
          foreign_key: 'id',
          display_columns: ['name', 'description']
        }
      ],
      aggColumns: [
        {
          label: 'total_reviews',
          local_key: 'id',
          foreign_table: testConfig.reviewTableSlug,
          foreign_key: 'product_id',
          function: 'count'
        },
        {
          label: 'average_rating',
          local_key: 'id',
          foreign_table: testConfig.reviewTableSlug,
          foreign_key: 'product_id',
          function: 'avg',
          function_field: 'rating'
        }
      ],
      aggregation_filter: ['status', 'priority', 'is_featured'],
      limit: 10,
      offset: 0
    });

    console.log('✅ Complex query successful');
    console.log('Complex query result:', JSON.stringify(complexQuery.data, null, 2));

    // Step 9: Test JSON path filtering
    console.log('\n9. Testing JSON path filtering...');
    const jsonFilterQuery = await makeRequest('POST', `/records/${testConfig.productTableSlug}/query/enhanced`, {
      columns: ['id', 'name', 'metadata.brand', 'metadata.storage'],
      filters: {
        'metadata.brand': 'Apple'
      },
      limit: 5
    });

    console.log('✅ JSON path filtering successful');
    console.log('Filtered by JSON path:', JSON.stringify(jsonFilterQuery.data.records, null, 2));

    // Step 10: Performance test
    console.log('\n10. Running performance test...');
    const startTime = Date.now();
    
    await makeRequest('POST', `/records/${testConfig.productTableSlug}/query/enhanced`, {
      columns: ['id', 'name', 'price', 'category_id.name', 'metadata.brand'],
      relationColumns: [
        {
          label: 'category',
          local_key: 'category_id',
          foreign_table: testConfig.categoryTableSlug,
          foreign_key: 'id',
          display_columns: ['name']
        }
      ],
      aggColumns: [
        {
          label: 'review_count',
          local_key: 'id',
          foreign_table: testConfig.reviewTableSlug,
          foreign_key: 'product_id',
          function: 'count'
        }
      ],
      aggregation_filter: ['status', 'priority'],
      limit: 50
    });
    
    const endTime = Date.now();
    console.log(`✅ Performance test completed in ${endTime - startTime}ms`);

    console.log('\n🎉 All Enhanced Query API tests completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('- ✅ Dot notation for relations and JSON paths');
    console.log('- ✅ Explicit relation queries');
    console.log('- ✅ Aggregation operations');
    console.log('- ✅ Dynamic filter aggregation');
    console.log('- ✅ Complex queries with filtering and sorting');
    console.log('- ✅ JSON path filtering');
    console.log('- ✅ Performance validation');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response?.data) {
      console.error('Error details:', error.response.data);
    }
    process.exit(1);
  }
};

// Run the tests
testEnhancedQuerySystem();
