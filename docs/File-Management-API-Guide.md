# File Management API Guide

## Overview

DocPal's file management system provides a simple, integrated approach to handling file uploads, downloads, and deletions. Files are stored in MinIO object storage with company-specific buckets, while file paths and metadata are stored directly in dynamic table columns.

## Key Features

- **Simple Integration**: Files integrate directly with dynamic tables - no separate file metadata tables
- **Company Isolation**: Each company has its own MinIO bucket for security
- **Dynamic Schema Support**: Works with any user-defined table and column structure
- **Metadata Storage**: File metadata stored in JSONB columns within the same table
- **Soft Delete**: Files are marked as deleted and references are cleared from tables
- **Streaming Downloads**: Efficient file streaming with proper HTTP headers

## API Endpoints

### 1. Upload File

**Endpoint**: `POST /api/files/upload`

**Description**: Uploads a file to MinIO and updates a dynamic table record with the file path and metadata.

**Content-Type**: `multipart/form-data`

**Form Fields**:
- `file` (file, required): The binary file to upload
- `table` (string, required): The table name to update
- `column` (string, required): The column name to store the file path
- `row` (string, required): The row ID to update
- `metadataField` (string, optional): Column name to store file metadata as JSONB
- `additionalData` (JSON string, optional): Additional data to update in the same record

**Response** (201 Created):
```json
{
  "filePath": "1757128677604-test-file.txt",
  "metadata": {
    "filename": "test-file.txt",
    "mimetype": "text/plain",
    "size": 91,
    "uploadedAt": "2025-01-06T03:17:57.607Z",
    "filePath": "1757128677604-test-file.txt"
  },
  "message": "File uploaded successfully"
}
```

**Example Usage**:
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('table', 'documents');
formData.append('column', 'document_file');
formData.append('row', 'record-uuid-here');
formData.append('metadataField', 'file_metadata');
formData.append('additionalData', JSON.stringify({
  title: 'Updated Document Title'
}));

const response = await fetch('/api/files/upload', {
  method: 'POST',
  body: formData,
  credentials: 'include'
});
```

### 2. Download File

**Endpoint**: `GET /api/files/:fileId`

**Description**: Streams a file from MinIO for download or display.

**Parameters**:
- `fileId` (string): The file path in MinIO (returned from upload)

**Response**: File stream with appropriate headers
- `Content-Type`: File's MIME type
- `Content-Length`: File size in bytes
- `Content-Disposition`: Attachment with filename
- `Last-Modified`: File modification date

**Example Usage**:
```javascript
// Direct download link
const downloadUrl = `/api/files/${encodeURIComponent(filePath)}`;

// Or fetch for processing
const response = await fetch(downloadUrl, {
  credentials: 'include'
});
const blob = await response.blob();
```

### 3. Delete File

**Endpoint**: `POST /api/files/:fileId/delete`

**Description**: Performs a soft delete by clearing file references from the table and marking the file as deleted.

**Parameters**:
- `fileId` (string): The file path in MinIO

**Request Body**:
```json
{
  "table": "documents",
  "column": "document_file",
  "row": "record-uuid-here",
  "metadataField": "file_metadata"
}
```

**Response** (200 OK):
```json
{
  "message": "File deleted successfully"
}
```

**Example Usage**:
```javascript
const response = await fetch(`/api/files/${encodeURIComponent(filePath)}/delete`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    table: 'documents',
    column: 'document_file',
    row: recordId,
    metadataField: 'file_metadata'
  }),
  credentials: 'include'
});
```

### 4. Find File References (Helper)

**Endpoint**: `GET /api/files/:fileId/references`

**Description**: Finds all table references to a specific file (useful for cleanup operations).

**Parameters**:
- `fileId` (string): The file path in MinIO

**Response** (200 OK):
```json
{
  "references": [
    {
      "table": "documents",
      "column": "document_file",
      "row": "record-uuid-here"
    }
  ]
}
```

## Database Integration

### File Path Storage

File paths are stored directly in table columns as text/varchar fields:

```sql
-- Example table structure
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  document_file TEXT,           -- Stores MinIO file path
  file_metadata JSONB,          -- Stores file metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Metadata Structure

File metadata is stored as JSONB with the following structure:

```json
{
  "filename": "original-filename.pdf",
  "mimetype": "application/pdf",
  "size": 1024576,
  "uploadedAt": "2025-01-06T03:17:57.607Z",
  "filePath": "1757128677604-original-filename.pdf"
}
```

## MinIO Storage Structure

### Bucket Naming

- Company buckets: `company-{companyId}`
- Each company has its own isolated bucket

### File Naming

- Files are prefixed with timestamp: `{timestamp}-{original-filename}`
- Example: `1757128677604-document.pdf`

### File Metadata Tags

MinIO objects include metadata tags:
- `file-id`: Unique file identifier
- `uploaded-by`: User ID who uploaded the file
- `table`: Table name where file is referenced
- `row`: Row ID where file is referenced
- `column`: Column name where file path is stored

## Error Handling

### Common Error Responses

**400 Bad Request**:
```json
{
  "error": "No file provided"
}
```

**401 Unauthorized**:
```json
{
  "error": "Authentication required"
}
```

**403 Forbidden**:
```json
{
  "error": "Access denied"
}
```

**404 Not Found**:
```json
{
  "error": "File not found or could not be deleted"
}
```

**500 Internal Server Error**:
```json
{
  "error": "Failed to upload file"
}
```

## Security Considerations

### Authentication

- All endpoints require valid session authentication
- Users can only access files within their company's bucket

### Authorization

- File access is controlled by table-level permissions
- No separate file permission system - uses existing dynamic table permissions

### File Validation

- File size limits enforced by Fastify multipart plugin
- MIME type validation based on file content
- Filename sanitization to prevent path traversal

## Implementation Details

### Service Architecture

The file management system follows functional programming principles:

```typescript
// Core service functions
export const uploadFileToTable = async (
  companyId: string,
  userId: string,
  uploadData: FileUploadData
): Promise<{ filePath: string; metadata: FileMetadata }>;

export const getFileByPath = async (
  companyId: string,
  filePath: string
): Promise<{ stream: NodeJS.ReadableStream; metadata: any } | null>;

export const deleteFileFromTable = async (
  companyId: string,
  userId: string,
  filePath: string,
  table?: string,
  column?: string,
  row?: string,
  metadataField?: string
): Promise<boolean>;
```

### Database Operations

- Uses `queryInTenantSchema` for all database operations
- Supports transactions for atomic updates
- Dynamic SQL generation for flexible table updates

### MinIO Integration

- Automatic bucket creation and management
- Proper error handling for storage operations
- Metadata preservation for file tracking

## Usage Examples

### Complete File Upload Flow

```javascript
// 1. Upload file
const formData = new FormData();
formData.append('file', selectedFile);
formData.append('table', 'documents');
formData.append('column', 'attachment');
formData.append('row', documentId);
formData.append('metadataField', 'attachment_metadata');

const uploadResponse = await fetch('/api/files/upload', {
  method: 'POST',
  body: formData,
  credentials: 'include'
});

const { filePath, metadata } = await uploadResponse.json();

// 2. Display download link
const downloadLink = `/api/files/${encodeURIComponent(filePath)}`;

// 3. Delete file when needed
await fetch(`/api/files/${encodeURIComponent(filePath)}/delete`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    table: 'documents',
    column: 'attachment',
    row: documentId,
    metadataField: 'attachment_metadata'
  }),
  credentials: 'include'
});
```

### Multiple File Handling

```javascript
// Upload multiple files to the same record
const files = Array.from(fileInput.files);
const uploadPromises = files.map(async (file, index) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('table', 'documents');
  formData.append('column', `attachment_${index + 1}`);
  formData.append('row', documentId);
  formData.append('metadataField', `attachment_${index + 1}_metadata`);
  
  return fetch('/api/files/upload', {
    method: 'POST',
    body: formData,
    credentials: 'include'
  });
});

const results = await Promise.all(uploadPromises);
```

## Testing

The file management system includes comprehensive tests covering:

- File upload with various file types and sizes
- File download and streaming
- File deletion and table cleanup
- Error handling and edge cases
- Authentication and authorization

Test script location: `packages/scripts/development/test-file-api.ts`

## Future Enhancements

Potential improvements for future versions:

1. **File Versioning**: Track file versions and history
2. **Bulk Operations**: Upload/delete multiple files in one request
3. **File Compression**: Automatic compression for certain file types
4. **CDN Integration**: Content delivery network for faster file access
5. **File Scanning**: Virus and malware scanning integration
6. **Advanced Metadata**: Extended metadata extraction (EXIF, document properties)
7. **File Thumbnails**: Automatic thumbnail generation for images and documents
