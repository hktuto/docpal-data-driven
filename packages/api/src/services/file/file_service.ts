// Simple file service for DocPal API
// Stores files in MinIO and updates dynamic table columns directly

import { randomUUID } from 'crypto';
import { queryInTenantSchema, withTenantTransaction } from '../../database/utils/database';
import {
  uploadFile as minioUploadFile,
  getFile as minioGetFile,
  deleteFile as minioDeleteFile,
  getFileMetadata as minioGetFileMetadata
} from '../../utils/minio';

// File upload interface
export interface FileUploadData {
  file: Buffer;
  filename: string;
  mimetype: string;
  table: string;
  column: string;
  row: string;
  metadataField?: string;
  additionalData?: Record<string, any>;
}

// Column parsing interface for nested JSONB support
interface ParsedColumn {
  column: string;
  isJsonbNested: boolean;
  jsonbPath?: string[];
}

// File metadata interface
export interface FileMetadata {
  filename: string;
  mimetype: string;
  size: number;
  uploadedAt: string;
  filePath: string;
}

/**
 * Parse column field to detect nested JSONB fields with dot notation
 */
const parseColumnField = (columnField: string): ParsedColumn => {
  if (columnField.includes('.')) {
    const parts = columnField.split('.');
    return {
      column: parts[0],
      isJsonbNested: true,
      jsonbPath: parts.slice(1)
    };
  }
  
  return {
    column: columnField,
    isJsonbNested: false
  };
};

/**
 * Upload file and update dynamic table
 */
export const uploadFileToTable = async (
  companyId: string,
  userId: string,
  uploadData: FileUploadData
): Promise<{ filePath: string; metadata: FileMetadata }> => {
  const fileId = randomUUID();
  return await withTenantTransaction(companyId, async (client) => {
    // Upload to MinIO
    const filePath = await minioUploadFile(
      companyId,
      uploadData.filename,
      uploadData.file,
      uploadData.mimetype,
      {
        'file-id': fileId,
        'uploaded-by': userId,
        'table': uploadData.table,
        'row': uploadData.row,
        'column': uploadData.column
      }
    );
    
    // Create metadata
    const metadata: FileMetadata = {
      filename: uploadData.filename,
      mimetype: uploadData.mimetype,
      size: uploadData.file.length,
      uploadedAt: new Date().toISOString(),
      filePath: filePath
    };
    
    // Parse the column field for nested JSONB support
    const parsedColumn = parseColumnField(uploadData.column);
    
    // Build update query dynamically
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;
    
    // Handle main column (file path)
    if (parsedColumn.isJsonbNested) {
      // Handle nested JSONB field using jsonb_set
      const jsonbPath = `{${parsedColumn.jsonbPath!.join(',')}}`;
      updateFields.push(`${parsedColumn.column} = jsonb_set(COALESCE(${parsedColumn.column}, '{}'), '${jsonbPath}', $${paramIndex}::jsonb)`);
      updateValues.push(JSON.stringify(filePath));
    } else {
      // Handle regular column (existing logic)
      updateFields.push(`${parsedColumn.column} = $${paramIndex}`);
      updateValues.push(filePath);
    }
    paramIndex++;
    
    // Add metadata field if specified
    if (uploadData.metadataField) {
      const parsedMetadataField = parseColumnField(uploadData.metadataField);
      
      if (parsedMetadataField.isJsonbNested) {
        const jsonbPath = `{${parsedMetadataField.jsonbPath!.join(',')}}`;
        updateFields.push(`${parsedMetadataField.column} = jsonb_set(COALESCE(${parsedMetadataField.column}, '{}'), '${jsonbPath}', $${paramIndex}::jsonb)`);
        updateValues.push(JSON.stringify(metadata));
      } else {
        updateFields.push(`${parsedMetadataField.column} = $${paramIndex}`);
        updateValues.push(JSON.stringify(metadata));
      }
      paramIndex++;
    }
    
    // Add additional data fields (enhanced for JSONB support)
    if (uploadData.additionalData && typeof uploadData.additionalData === 'object' && !Array.isArray(uploadData.additionalData)) {
      for (const [key, value] of Object.entries(uploadData.additionalData)) {
        // Skip numeric keys and ensure key is a valid column name
        if (!isNaN(Number(key))) {
          continue;
        }
        
        const parsedKey = parseColumnField(key);
        
        if (parsedKey.isJsonbNested) {
          const jsonbPath = `{${parsedKey.jsonbPath!.join(',')}}`;
          updateFields.push(`${parsedKey.column} = jsonb_set(COALESCE(${parsedKey.column}, '{}'), '${jsonbPath}', $${paramIndex}::jsonb)`);
          updateValues.push(JSON.stringify(value));
        } else {
          updateFields.push(`${parsedKey.column} = $${paramIndex}`);
          updateValues.push(value);
        }
        paramIndex++;
      }
    }
    
    // Add updated_at timestamp
    updateFields.push(`updated_at = NOW()`);
    // Update the dynamic table
    const updateQuery = `
      UPDATE ${uploadData.table} 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id
    `;
    updateValues.push(uploadData.row);
    
    try {
      const result = await client.query(updateQuery, updateValues);
      if (result.rows.length === 0) {
        throw new Error(`Row not found in table ${uploadData.table}`);
      }
    } catch (error) {
      throw error;
    }

    return { filePath, metadata };
  });
};

/**
 * Get file stream by file path
 */
export const getFileByPath = async (
  companyId: string,
  filePath: string
): Promise<{ stream: NodeJS.ReadableStream; metadata: any } | null> => {
  try {
    // Get file stream from MinIO
    const stream = await minioGetFile(companyId, filePath);
    
    // Get file metadata from MinIO
    const minioMetadata = await minioGetFileMetadata(companyId, filePath);
    
    return {
      stream,
      metadata: {
        size: minioMetadata.size,
        contentType: minioMetadata.metaData['content-type'] || 'application/octet-stream',
        filename: minioMetadata.metaData['filename'] || 'download',
        lastModified: minioMetadata.lastModified
      }
    };
  } catch (error) {
    console.error('Error getting file:', error);
    return null;
  }
};

/**
 * Delete file and update table column
 */
export const deleteFileFromTable = async (
  companyId: string,
  userId: string,
  filePath: string,
  table?: string,
  column?: string,
  row?: string,
  metadataField?: string
): Promise<boolean> => {
  try {
    // Mark file as deleted in MinIO (soft delete by adding metadata)
    // Note: We're not actually deleting from MinIO for now, just marking
    
    // If table info provided, clear the table columns
    if (table && column && row) {
      const parsedColumn = parseColumnField(column);
      
      let updateFields: string[];
      let updateValues: any[] = [row];
      
      if (parsedColumn.isJsonbNested) {
        // Use jsonb_set to set nested field to null
        const jsonbPath = `{${parsedColumn.jsonbPath!.join(',')}}`;
        updateFields = [`${parsedColumn.column} = jsonb_set(COALESCE(${parsedColumn.column}, '{}'), '${jsonbPath}', 'null'::jsonb)`];
      } else {
        // Regular column update
        updateFields = [`${parsedColumn.column} = NULL`];
      }

      // Clear metadata field if specified
      if (metadataField) {
        const parsedMetadataField = parseColumnField(metadataField);
        
        if (parsedMetadataField.isJsonbNested) {
          const jsonbPath = `{${parsedMetadataField.jsonbPath!.join(',')}}`;
          updateFields.push(`${parsedMetadataField.column} = jsonb_set(COALESCE(${parsedMetadataField.column}, '{}'), '${jsonbPath}', 'null'::jsonb)`);
        } else {
          updateFields.push(`${parsedMetadataField.column} = NULL`);
        }
      }

      // Update the dynamic table using queryInTenantSchema
      const updateQuery = `
        UPDATE ${table} 
        SET ${updateFields.join(', ')}
        WHERE id = $1
        RETURNING id
      `;

      const result = await queryInTenantSchema(companyId, updateQuery, updateValues);
      
      if (result.rows.length === 0) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

/**
 * Find file location in dynamic tables (helper function)
 * This can be used to find where a file is referenced before deletion
 */
export const findFileReferences = async (
  companyId: string,
  filePath: string
): Promise<Array<{ table: string; column: string; row: string }>> => {
  // Get all custom tables
  const tablesResult = await queryInTenantSchema(
    companyId,
    'SELECT slug FROM custom_data_model WHERE is_system = FALSE',
    []
  );

  const references: Array<{ table: string; column: string; row: string }> = [];

  // Search each table for the file path
  for (const tableRow of tablesResult.rows) {
    const tableName = tableRow.slug;
    
    try {
      // Get table columns that might contain file paths
      const columnsResult = await queryInTenantSchema(
        companyId,
        `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_schema = $1 AND table_name = $2 
         AND data_type IN ('text', 'varchar', 'character varying')`,
        [`company_${companyId.replace(/-/g, '_')}`, tableName]
      );

      // Search each text column for the file path
      for (const columnRow of columnsResult.rows) {
        const columnName = columnRow.column_name;
        
        const searchResult = await queryInTenantSchema(
          companyId,
          `SELECT id FROM ${tableName} WHERE ${columnName} = $1`,
          [filePath]
        );

        for (const row of searchResult.rows) {
          references.push({
            table: tableName,
            column: columnName,
            row: row.id
          });
        }
      }
    } catch (error) {
      // Skip tables that might have issues
      console.warn(`Could not search table ${tableName}:`, error);
    }
  }

  return references;
};