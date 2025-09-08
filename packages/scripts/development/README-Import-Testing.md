# Import Feature Testing

This directory contains comprehensive testing tools for the DocPal import feature.

## Quick Start

### Run All Tests
```bash
cd packages/scripts
npm run test:import
```

### Run Individual Test Components
```bash
# Generate test data files
npm run test:import-data

# Run basic functionality tests
npm run test:import-basic
```

## Test Files

### Core Test Files
- `run-import-tests.ts` - Main test runner that orchestrates all tests
- `test-import-basic.ts` - Basic functionality tests (parsing, type detection, etc.)
- `generate-test-data.ts` - Creates various test CSV files

### Test Data Files
Generated in `temp/test-data/`:
- `simple.csv` - Basic test data with common types
- `complex.csv` - Mixed data types, special characters, quotes
- `large.csv` - 1000 rows for performance testing
- `malformed.csv` - Invalid data for error testing
- `empty.csv` - Empty file for edge cases
- `unicode.csv` - Unicode characters and international names
- `quotes.csv` - Data with quotes and special characters
- `newlines.csv` - Multiline text data
- `type-test.csv` - Comprehensive type detection testing

## Test Categories

### 1. Basic Functionality Tests
- CSV parsing accuracy
- Column type detection
- Data validation
- Error handling

### 2. Edge Case Tests
- Empty files
- Malformed data
- Special characters
- Unicode support
- Large files

### 3. Type Detection Tests
- Integer detection
- Decimal detection
- Boolean detection
- Date/timestamp detection
- Email detection
- UUID detection
- JSON detection

### 4. Performance Tests
- Large file processing
- Memory usage
- Response times

## Test Results

Tests provide detailed output including:
- ✅ Pass/Fail status for each test
- ⏱️ Execution time for each test
- 📊 Summary statistics
- ❌ Detailed error messages for failures

## Manual Testing

After running automated tests, you can manually test:

1. **API Endpoints**:
   - `POST /api/schemas/import/analyze` - Upload and analyze files
   - `GET /api/schemas/import/:importId` - Get analysis results
   - `POST /api/schemas/import/confirm` - Confirm and import data

2. **File Types**:
   - CSV files with various encodings
   - Excel files (.xlsx)
   - Large files (>1MB)
   - Files with special characters

3. **Error Scenarios**:
   - Invalid file types
   - Files too large
   - Malformed data
   - Network interruptions

## Integration Testing

For full integration testing:

1. Start the API server
2. Use the generated test files
3. Test the complete flow:
   - Upload → Analyze → Confirm → Verify

## Performance Benchmarks

Expected performance targets:
- File analysis: < 30 seconds for 10MB files
- Data import: < 60 seconds for 1000 rows
- Memory usage: Stable during processing
- No memory leaks detected

## Troubleshooting

### Common Issues
- **File parsing errors**: Check file encoding and format
- **Type detection failures**: Verify data patterns match expected formats
- **Performance issues**: Monitor memory usage and file sizes
- **Database errors**: Ensure proper schema and permissions

### Debug Mode
Set environment variable for detailed logging:
```bash
DEBUG=import:* npm run test:import
```

## Contributing

When adding new tests:
1. Follow the existing test structure
2. Add appropriate test data files
3. Update this README
4. Ensure tests are deterministic and isolated
5. Add performance benchmarks for new features

