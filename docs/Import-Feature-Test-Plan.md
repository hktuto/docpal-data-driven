# Import Feature Test Plan

## Overview
This document outlines the comprehensive testing strategy for the new CSV/Excel import feature in DocPal API. The feature allows users to upload files, analyze column mappings, and import data into schemas.

## Test Environment Setup

### Prerequisites
- DocPal API server running
- Database connection established
- Authentication system working
- Test user with company access
- Sample CSV and Excel files

### Test Data
Create test files in `packages/scripts/development/test-data/`:
- `simple.csv` - Basic data with common types
- `complex.csv` - Mixed data types, special characters
- `large.csv` - 1000+ rows for performance testing
- `malformed.csv` - Invalid data for error testing
- `sample.xlsx` - Excel file with multiple sheets
- `empty.csv` - Empty file for edge case testing

## Test Cases

### 1. File Upload & Analysis (Step 1)

#### 1.1 Happy Path Tests
- [ ] **TC-001**: Upload valid CSV file
  - Upload `simple.csv` with standard columns
  - Verify 200 response with analysis results
  - Check column detection accuracy
  - Verify sample data preview

- [ ] **TC-002**: Upload valid Excel file
  - Upload `sample.xlsx`
  - Verify parsing of first sheet
  - Check column type detection
  - Verify file handling

- [ ] **TC-003**: Large file upload
  - Upload `large.csv` (1000+ rows)
  - Verify performance (should complete within 30 seconds)
  - Check memory usage
  - Verify all rows are counted

#### 1.2 File Validation Tests
- [ ] **TC-004**: Invalid file type
  - Upload `.txt` file
  - Verify 400 error with appropriate message
  - Check error handling

- [ ] **TC-005**: File too large
  - Upload file > 10MB
  - Verify 413 error
  - Check file size validation

- [ ] **TC-006**: Empty file
  - Upload `empty.csv`
  - Verify appropriate warning in response
  - Check graceful handling

- [ ] **TC-007**: Malformed CSV
  - Upload `malformed.csv`
  - Verify error handling
  - Check error messages

#### 1.3 Authentication & Authorization Tests
- [ ] **TC-008**: Unauthenticated request
  - Upload file without auth token
  - Verify 401 error

- [ ] **TC-009**: Invalid company context
  - Upload with invalid company ID
  - Verify 401 error

### 2. Column Analysis & Detection

#### 2.1 Data Type Detection Tests
- [ ] **TC-010**: Integer detection
  - CSV with integer columns
  - Verify `int` type detection
  - Check confidence score > 0.8

- [ ] **TC-011**: Decimal detection
  - CSV with decimal numbers
  - Verify `decimal` type detection
  - Check precision/scale options

- [ ] **TC-012**: Boolean detection
  - CSV with true/false, yes/no, 1/0 values
  - Verify `boolean` type detection
  - Check various boolean formats

- [ ] **TC-013**: Date detection
  - CSV with date columns
  - Verify `date` or `timestamp` detection
  - Check date format recognition

- [ ] **TC-014**: Email detection
  - CSV with email addresses
  - Verify `varchar` type with email pattern
  - Check confidence score

- [ ] **TC-015**: UUID detection
  - CSV with UUID values
  - Verify `uuid` type detection
  - Check UUID pattern matching

- [ ] **TC-016**: JSON detection
  - CSV with JSON objects
  - Verify `jsonb` type detection
  - Check JSON validation

#### 2.2 Column Name Sanitization Tests
- [ ] **TC-017**: Special characters in column names
  - CSV with spaces, special chars in headers
  - Verify sanitized column names
  - Check underscore replacement

- [ ] **TC-018**: Reserved column names
  - CSV with `id`, `created_at` in headers
  - Verify error handling
  - Check reserved name detection

- [ ] **TC-019**: Duplicate column names
  - CSV with duplicate headers
  - Verify error handling
  - Check duplicate detection

### 3. Import Confirmation (Step 2)

#### 3.1 Schema Creation Tests
- [ ] **TC-020**: Create new schema from import
  - Confirm import with new schema details
  - Verify schema creation in database
  - Check table structure matches column mappings
  - Verify data import success

- [ ] **TC-021**: Update existing schema
  - Confirm import to existing schema
  - Verify schema update (when implemented)
  - Check data import to existing table

- [ ] **TC-022**: Skip columns during import
  - Mark some columns as `skip: true`
  - Verify only selected columns are imported
  - Check table structure

#### 3.2 Data Import Tests
- [ ] **TC-023**: Data type conversion
  - Import data with various types
  - Verify correct database storage
  - Check type conversion accuracy

- [ ] **TC-024**: Null value handling
  - Import data with null/empty values
  - Verify null handling in database
  - Check nullable column behavior

- [ ] **TC-025**: Large data import
  - Import 1000+ rows
  - Verify performance and success
  - Check memory usage during import

#### 3.3 Error Handling Tests
- [ ] **TC-026**: Invalid import ID
  - Confirm import with non-existent ID
  - Verify 404 error

- [ ] **TC-027**: Expired import session
  - Wait for session to expire (24 hours)
  - Try to confirm import
  - Verify appropriate error

- [ ] **TC-028**: Database constraint violations
  - Import data that violates constraints
  - Verify error handling
  - Check rollback behavior

### 4. File Management & Cleanup

#### 4.1 Temporary File Management Tests
- [ ] **TC-029**: File storage and retrieval
  - Upload file and verify temporary storage
  - Check file path generation
  - Verify file accessibility

- [ ] **TC-030**: File cleanup after import
  - Complete import process
  - Verify temporary file deletion
  - Check cleanup logging

- [ ] **TC-031**: File cleanup on cancellation
  - Cancel import before confirmation
  - Verify file deletion
  - Check cleanup endpoint

#### 4.2 Expiration and Cleanup Tests
- [ ] **TC-032**: Automatic cleanup
  - Wait for scheduled cleanup (1 hour)
  - Verify expired files are cleaned
  - Check cleanup logging

- [ ] **TC-033**: Manual cleanup endpoint
  - Call cleanup endpoint
  - Verify expired sessions/files removed
  - Check response with counts

### 5. API Integration Tests

#### 5.1 Endpoint Integration Tests
- [ ] **TC-034**: Complete import flow
  - Upload → Analyze → Confirm → Verify
  - End-to-end test with real data
  - Check all steps work together

- [ ] **TC-035**: Multiple concurrent imports
  - Upload multiple files simultaneously
  - Verify no conflicts
  - Check resource management

- [ ] **TC-036**: Import with existing schemas
  - Import to schema with existing data
  - Verify data integrity
  - Check no data corruption

#### 5.2 Performance Tests
- [ ] **TC-037**: Response time benchmarks
  - Measure upload analysis time
  - Measure import confirmation time
  - Verify acceptable performance

- [ ] **TC-038**: Memory usage tests
  - Monitor memory during large file processing
  - Check for memory leaks
  - Verify garbage collection

### 6. Error Recovery Tests

#### 6.1 Failure Recovery Tests
- [ ] **TC-039**: Database connection failure
  - Simulate DB connection loss during import
  - Verify error handling
  - Check cleanup on failure

- [ ] **TC-040**: File system errors
  - Simulate file system issues
  - Verify graceful error handling
  - Check error messages

- [ ] **TC-041**: Partial import failure
  - Simulate partial data import failure
  - Verify rollback behavior
  - Check data consistency

## Test Execution Strategy

### Phase 1: Unit Tests
- Test individual functions in isolation
- Mock external dependencies
- Focus on logic correctness

### Phase 2: Integration Tests
- Test API endpoints with real database
- Test file parsing with actual files
- Verify end-to-end workflows

### Phase 3: Performance Tests
- Load testing with large files
- Concurrent user testing
- Memory and resource monitoring

### Phase 4: User Acceptance Tests
- Real-world scenarios
- Edge cases and error conditions
- User experience validation

## Test Data Requirements

### Sample Files Needed
```
test-data/
├── simple.csv          # Basic test data
├── complex.csv         # Mixed types, special chars
├── large.csv           # 1000+ rows
├── malformed.csv       # Invalid data
├── empty.csv           # Empty file
├── sample.xlsx         # Excel file
├── unicode.csv         # Unicode characters
├── quotes.csv          # Data with quotes
└── newlines.csv        # Data with newlines
```

### Database Test Data
- Test company with proper permissions
- Test user with appropriate roles
- Clean database state for each test

## Success Criteria

### Functional Requirements
- [ ] All file types (CSV, Excel) are supported
- [ ] Column type detection accuracy > 90%
- [ ] Data import success rate > 99%
- [ ] Error handling covers all edge cases
- [ ] File cleanup works reliably

### Performance Requirements
- [ ] File analysis completes within 30 seconds for 10MB files
- [ ] Data import completes within 60 seconds for 1000 rows
- [ ] Memory usage remains stable during processing
- [ ] No memory leaks detected

### Security Requirements
- [ ] Authentication required for all endpoints
- [ ] Company isolation maintained
- [ ] File uploads are properly validated
- [ ] Temporary files are securely handled

## Test Automation

### Automated Test Scripts
- `test-import-basic.ts` - Basic functionality tests
- `test-import-edge-cases.ts` - Edge case and error tests
- `test-import-performance.ts` - Performance benchmarks
- `test-import-integration.ts` - End-to-end integration tests

### Manual Test Scenarios
- User experience testing
- Browser compatibility (for frontend)
- Real-world data import scenarios
- Error message clarity and helpfulness

## Risk Assessment

### High Risk Areas
- Large file processing performance
- Memory usage with concurrent uploads
- Database transaction handling
- File system cleanup reliability

### Mitigation Strategies
- Implement file size limits
- Add memory monitoring
- Use database transactions
- Implement robust cleanup mechanisms

## Test Environment

### Development Environment
- Local API server
- Local PostgreSQL database
- File system access for temp files

### Staging Environment
- Production-like setup
- Real database with test data
- Performance monitoring tools

## Sign-off Criteria

The import feature is ready for production when:
- [ ] All test cases pass (100% success rate)
- [ ] Performance requirements are met
- [ ] Security requirements are satisfied
- [ ] Error handling is comprehensive
- [ ] Documentation is complete
- [ ] Code review is approved
- [ ] User acceptance testing is passed

