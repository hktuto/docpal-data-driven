import * as fs from 'fs';
import * as path from 'path';

/**
 * Test Data Generator
 * Creates various test files for the import feature testing
 */

const testDataDir = path.join(process.cwd(), 'temp', 'test-data');

async function ensureTestDataDir() {
  await fs.promises.mkdir(testDataDir, { recursive: true });
}

async function generateSimpleCSV() {
  const content = `name,email,age,is_active,created_date
John Doe,john@example.com,25,true,2023-01-15
Jane Smith,jane@example.com,30,false,2023-02-20
Bob Johnson,bob@example.com,35,true,2023-03-10
Alice Brown,alice@example.com,28,true,2023-04-05
Charlie Wilson,charlie@example.com,42,false,2023-05-12`;

  const filePath = path.join(testDataDir, 'simple.csv');
  await fs.promises.writeFile(filePath, content);
  console.log('✅ Generated simple.csv');
  return filePath;
}

async function generateComplexCSV() {
  const content = `"Full Name","Email Address","Age (years)","Department","Salary","Start Date","Is Manager?","Skills"
"John O'Connor","john.oconnor@company.com","25","Engineering","75000","2023-01-15","false","[""JavaScript"", ""TypeScript""]"
"Jane Smith-Jones","jane.smith@company.com","30","Marketing","65000","2023-02-20","true","[""SEO"", ""Content Marketing""]"
"Bob Johnson","bob.johnson@company.com","35","Sales","80000","2023-03-10","false","[""CRM"", ""Negotiation""]"
"Alice Brown","alice.brown@company.com","28","HR","60000","2023-04-05","true","[""Recruitment"", ""Training""]"
"Charlie Wilson","charlie.wilson@company.com","42","Finance","90000","2023-05-12","false","[""Accounting"", ""Analysis""]"`;

  const filePath = path.join(testDataDir, 'complex.csv');
  await fs.promises.writeFile(filePath, content);
  console.log('✅ Generated complex.csv');
  return filePath;
}

async function generateLargeCSV() {
  const headers = 'id,name,email,age,department,salary,start_date,is_active\n';
  const rows = Array.from({ length: 1000 }, (_, i) => {
    const id = i + 1;
    const name = `Employee ${id}`;
    const email = `employee${id}@company.com`;
    const age = 20 + (i % 40);
    const department = `Department ${(i % 10) + 1}`;
    const salary = 30000 + (i * 100);
    const startDate = `2023-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`;
    const isActive = i % 3 !== 0 ? 'true' : 'false';
    
    return `${id},"${name}","${email}",${age},"${department}",${salary},${startDate},${isActive}\n`;
  }).join('');

  const content = headers + rows;
  const filePath = path.join(testDataDir, 'large.csv');
  await fs.promises.writeFile(filePath, content);
  console.log('✅ Generated large.csv (1000 rows)');
  return filePath;
}

async function generateMalformedCSV() {
  const content = `name,email,age
John Doe,john@example.com,25
Jane Smith,jane@example.com,30,extra_column
Bob Johnson,bob@example.com
Alice Brown,alice@example.com,28,extra,more,columns
Charlie Wilson,charlie@example.com,42`;

  const filePath = path.join(testDataDir, 'malformed.csv');
  await fs.promises.writeFile(filePath, content);
  console.log('✅ Generated malformed.csv');
  return filePath;
}

async function generateEmptyCSV() {
  const filePath = path.join(testDataDir, 'empty.csv');
  await fs.promises.writeFile(filePath, '');
  console.log('✅ Generated empty.csv');
  return filePath;
}

async function generateUnicodeCSV() {
  const content = `name,email,description
"José García","jose.garcia@example.com","Desarrollador de software"
"李小明","lixiaoming@example.com","软件工程师"
"François Dubois","francois.dubois@example.com","Développeur web"
"Алексей Петров","alexey.petrov@example.com","Программист"
"محمد أحمد","mohammed.ahmed@example.com","مطور برمجيات"`;

  const filePath = path.join(testDataDir, 'unicode.csv');
  await fs.promises.writeFile(filePath, content);
  console.log('✅ Generated unicode.csv');
  return filePath;
}

async function generateQuotesCSV() {
  const content = `name,description,quote
"John ""The Boss"" Doe","He said ""Hello World""","""To be or not to be"""
"Jane ""The Expert"" Smith","She said ""I love coding""","""Code is poetry"""
"Bob ""The Builder"" Johnson","He said ""Let's build it""","""Build it and they will come"""`;

  const filePath = path.join(testDataDir, 'quotes.csv');
  await fs.promises.writeFile(filePath, content);
  console.log('✅ Generated quotes.csv');
  return filePath;
}

async function generateNewlinesCSV() {
  const content = `name,description,multiline_text
"John Doe","Software Developer","This is a multiline
text with newlines
and special characters"
"Jane Smith","Data Analyst","Another multiline
text example
with different content"
"Bob Johnson","Project Manager","Final multiline
example with
various formatting"`;

  const filePath = path.join(testDataDir, 'newlines.csv');
  await fs.promises.writeFile(filePath, content);
  console.log('✅ Generated newlines.csv');
  return filePath;
}

async function generateTypeTestCSV() {
  const content = `uuid_field,email_field,date_field,timestamp_field,number_field,decimal_field,boolean_field,json_field,text_field
550e8400-e29b-41d4-a716-446655440000,test@example.com,2023-01-15,2023-01-15 10:30:00,123,123.45,true,"{""key"": ""value""}","Short text"
550e8400-e29b-41d4-a716-446655440001,user@domain.org,2023-02-20,2023-02-20 14:45:30,456,456.78,false,"{""id"": 123, ""name"": ""test""}","This is a longer text field that should be detected as text type"
550e8400-e29b-41d4-a716-446655440002,admin@company.com,2023-03-25,2023-03-25 09:15:45,789,789.12,true,"{""array"": [1, 2, 3]}","Another text example"`;

  const filePath = path.join(testDataDir, 'type-test.csv');
  await fs.promises.writeFile(filePath, content);
  console.log('✅ Generated type-test.csv');
  return filePath;
}

async function generateAllTestData() {
  console.log('🎯 Generating test data files...\n');
  
  await ensureTestDataDir();
  
  const files = await Promise.all([
    generateSimpleCSV(),
    generateComplexCSV(),
    generateLargeCSV(),
    generateMalformedCSV(),
    generateEmptyCSV(),
    generateUnicodeCSV(),
    generateQuotesCSV(),
    generateNewlinesCSV(),
    generateTypeTestCSV()
  ]);
  
  console.log(`\n🎉 Generated ${files.length} test files in: ${testDataDir}`);
  console.log('\nFiles created:');
  files.forEach(file => {
    const filename = path.basename(file);
    console.log(`  - ${filename}`);
  });
  
  return files;
}

// Run if executed directly
if (require.main === module) {
  generateAllTestData().catch(console.error);
}

export { generateAllTestData };

