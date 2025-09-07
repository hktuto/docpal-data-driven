# Batch Import Feature

A comprehensive batch import system that allows users to upload CSV or XLSX files and map columns to table fields with intelligent auto-detection.

## ✅ **Complete Implementation**

### **🎯 Features Implemented**

1. **📁 File Upload Support**
   - Drag & drop interface
   - CSV and XLSX file support
   - File size validation (10MB limit)
   - File type validation

2. **🧠 Intelligent Column Mapping**
   - Auto-detection based on column name similarity
   - Manual mapping interface
   - Real-time preview of sample data
   - Column type indicators

3. **⚙️ Import Configuration**
   - Insert vs Upsert modes
   - Error handling options (skip errors or fail)
   - Configurable batch size (10-1000 records)

4. **📊 Progress Tracking**
   - Real-time import progress
   - Success/error statistics
   - Detailed error reporting with row numbers

5. **🔐 Permission Integration**
   - Requires `can_manage` permission to access
   - Backend permission validation (`can_create`)
   - Secure file processing

## **🏗️ Architecture**

### **Frontend Components**

#### **BatchImportDialog.vue**
```vue
<BatchImportDialog 
  :table-name="tableName"
  :columns="columns"
  @imported="handleDataImported"
  @cancelled="handleCancelled"
/>
```

**Features:**
- **3-Step Wizard**: File Upload → Column Mapping → Import Options
- **File Parsing**: Client-side parsing with `xlsx` and `papaparse`
- **Auto-mapping**: Intelligent column name matching
- **Progress UI**: Real-time feedback with progress bars
- **Error Handling**: Comprehensive error display

#### **Table Integration**
```vue
<!-- Added to table toolbar -->
<el-button 
  v-if="canManage" 
  type="success" 
  @click="handleBatchImport"
  :icon="Upload"
>
  Batch Import
</el-button>
```

### **Backend API**

#### **Endpoint**: `POST /companies/data/records/:tableName/import`

**Request Format:**
```typescript
// Multipart form data
{
  file: File,                    // CSV or XLSX file
  mappings: string,              // JSON string of column mappings
  options: string                // JSON string of import options
}
```

**Response Format:**
```typescript
{
  data: {
    imported: number,            // Successfully imported records
    errors: number,              // Records with errors
    errorDetails: Array<{        // Detailed error information
      row: number,
      error: string
    }>
  },
  meta: {
    timestamp: string,
    message: string
  }
}
```

## **🔄 User Flow**

### **Step 1: File Upload**
1. User clicks "Batch Import" button
2. Dialog opens with drag & drop area
3. User selects/drops CSV or XLSX file
4. File is parsed and validated
5. Preview shows first 5 rows with column detection

### **Step 2: Column Mapping**
1. System auto-maps columns based on name similarity
2. User reviews and adjusts mappings
3. Dropdown shows available table columns with types
4. Sample data preview for each import column
5. Mapping summary shows progress

### **Step 3: Import Options**
1. Choose import mode (Insert/Upsert)
2. Configure error handling (Skip errors/Fail on error)
3. Set batch size (10-1000 records)
4. Review final summary
5. Start import process

### **Step 4: Import Execution**
1. File and mappings sent to backend
2. Real-time progress updates
3. Success/error statistics displayed
4. Table automatically refreshes with new data

## **🔧 Technical Details**

### **File Processing**

#### **Frontend Parsing**
```typescript
// Excel files
const workbook = XLSX.read(data, { type: 'array' });
const worksheet = workbook.Sheets[sheetName];
const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

// CSV files
Papa.parse(file, {
  header: true,
  skipEmptyLines: true,
  complete: (results) => { /* process */ }
});
```

#### **Backend Processing**
```typescript
// Parse uploaded file
const parsedData = await this.parseUploadedFile(fileData);

// Validate mappings against table schema
const validMappings = this.validateMappings(mappings, tableMetadata);

// Process in configurable batches
for (let i = 0; i < parsedData.length; i += batchSize) {
  const batch = parsedData.slice(i, i + batchSize);
  await this.processBatch(batch, validMappings, options);
}
```

### **Auto-Mapping Algorithm**

```typescript
const autoMapColumns = () => {
  parseResults.value.columns.forEach(importCol => {
    // 1. Exact match (case-insensitive)
    let tableCol = availableTableColumns.value.find(col => 
      col.column_name.toLowerCase() === importCol.toLowerCase() ||
      col.display_name?.toLowerCase() === importCol.toLowerCase()
    );
    
    // 2. Partial match (contains)
    if (!tableCol) {
      tableCol = availableTableColumns.value.find(col => 
        col.column_name.toLowerCase().includes(importCol.toLowerCase()) ||
        importCol.toLowerCase().includes(col.column_name.toLowerCase())
      );
    }
    
    if (tableCol) {
      mappings[importCol] = tableCol.column_name;
    }
  });
};
```

### **Permission System**

#### **Frontend Permission Check**
```typescript
const canManage = computed(() => {
  return props.permission?.permissionMap?.can_manage;
});
```

#### **Backend Permission Validation**
```typescript
const hasPermission = await checkPermission({
  userId,
  relation: 'can_create',
  objectType: tableName,
  objectId: '*'
});
```

## **📊 Data Validation**

### **File Validation**
- **File Types**: `.csv`, `.xlsx`, `.xls`
- **File Size**: Maximum 10MB
- **Content**: Non-empty files with valid structure

### **Column Validation**
- **Mapping**: Only valid table columns accepted
- **Data Types**: Basic type coercion applied
- **Required Fields**: System columns auto-populated

### **Import Validation**
- **Batch Processing**: Configurable batch sizes (10-1000)
- **Error Handling**: Skip errors or fail-fast options
- **Transaction Safety**: Each batch processed atomically

## **🎨 UI/UX Features**

### **Visual Design**
- **Step-by-step wizard** with clear progress indication
- **Drag & drop interface** with visual feedback
- **Real-time preview** of data and mappings
- **Progress bars** with status indicators
- **Error highlighting** with detailed messages

### **Responsive Design**
- **Mobile-friendly** column mapping (stacked layout)
- **Flexible grid** layouts for different screen sizes
- **Touch-friendly** drag & drop areas

### **Accessibility**
- **Keyboard navigation** support
- **Screen reader** compatible
- **High contrast** mode support
- **Focus indicators** for all interactive elements

## **🚀 Performance Optimizations**

### **Frontend**
- **Lazy loading** of large files
- **Virtual scrolling** for large datasets
- **Debounced** auto-mapping calculations
- **Memory efficient** file processing

### **Backend**
- **Streaming** file processing
- **Batch processing** to prevent memory issues
- **Connection pooling** for database operations
- **Error recovery** mechanisms

## **🔒 Security Features**

### **File Security**
- **MIME type validation**
- **File size limits**
- **Content scanning** for malicious patterns
- **Temporary file cleanup**

### **Data Security**
- **Permission-based access** control
- **SQL injection prevention**
- **Input sanitization**
- **Audit logging** of import operations

## **📈 Usage Examples**

### **Basic Usage**
```vue
<template>
  <TableManager table-name="users" />
</template>
```

### **Programmatic Access**
```typescript
// Open import dialog programmatically
const batchImportRef = ref();
batchImportRef.value?.open();

// Handle import completion
const handleDataImported = (count: number) => {
  console.log(`${count} records imported`);
  // Refresh table or show notification
};
```

### **Custom Configuration**
```typescript
// Custom import options
const importOptions = {
  mode: 'upsert',
  skipErrors: true,
  batchSize: 500
};
```

## **🔮 Future Enhancements**

### **Planned Features**
- [ ] **Template Downloads**: Pre-configured CSV templates
- [ ] **Data Validation Rules**: Custom validation per column
- [ ] **Import Scheduling**: Automated recurring imports
- [ ] **Import History**: Track and replay previous imports
- [ ] **Advanced Mapping**: Formula-based column transformations
- [ ] **Real-time Collaboration**: Multiple users importing simultaneously

### **Advanced Options**
- [ ] **Duplicate Detection**: Smart duplicate handling
- [ ] **Data Transformation**: Built-in data cleaning functions
- [ ] **Import Rollback**: Undo import operations
- [ ] **Performance Analytics**: Import speed optimization
- [ ] **Integration APIs**: Connect with external data sources

## **🎯 Benefits**

### **For Users**
- **Time Saving**: Bulk data entry in seconds
- **Error Reduction**: Automated validation and mapping
- **Flexibility**: Support for common file formats
- **Transparency**: Clear progress and error reporting

### **For Developers**
- **Reusable Component**: Works with any dynamic table
- **Extensible Architecture**: Easy to add new features
- **Type Safety**: Full TypeScript support
- **Performance**: Optimized for large datasets

### **For Organizations**
- **Data Migration**: Easy migration from other systems
- **Productivity**: Faster data entry workflows
- **Accuracy**: Reduced manual data entry errors
- **Compliance**: Audit trail of all import operations

This batch import feature provides a complete, production-ready solution for bulk data import with an excellent user experience and robust backend processing! 🎉

