import { v4 as uuidv4 } from 'uuid';
import { ColumnAnalysis, ImportAnalysisResult, ImportConfirmationRequest, ImportConfirmationResult, ImportFileInfo } from './types';

/**
 * Import Service - Handles file analysis and data import
 * 
 * This service manages the two-step import process:
 * 1. Analyze uploaded files and suggest column mappings
 * 2. Confirm mappings and import data to database
 */

// In-memory storage for import sessions (in production, use Redis or database)
const importSessions = new Map<string, ImportAnalysisResult>();
const importFiles = new Map<string, ImportFileInfo>();

/**
 * Generate a unique import ID
 */
export const generateImportId = (): string => {
  return uuidv4();
};

/**
 * Store import file information
 */
export const storeImportFile = (
  importId: string,
  filePath: string,
  fileName: string,
  companyId: string
): ImportFileInfo => {
  const fileInfo: ImportFileInfo = {
    importId,
    filePath,
    fileName,
    companyId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  };
  
  importFiles.set(importId, fileInfo);
  return fileInfo;
};

/**
 * Get import file information
 */
export const getImportFile = (importId: string): ImportFileInfo | null => {
  return importFiles.get(importId) || null;
};

/**
 * Store import analysis result
 */
export const storeImportAnalysis = (analysis: ImportAnalysisResult): void => {
  importSessions.set(analysis.importId, analysis);
};

/**
 * Get import analysis result
 */
export const getImportAnalysis = (importId: string): ImportAnalysisResult | null => {
  return importSessions.get(importId) || null;
};

/**
 * Clean up expired import sessions and files
 */
export const cleanupExpiredImports = (): void => {
  const now = new Date();
  const fs = require('fs');
  
  // Clean up expired sessions
  for (const [importId, session] of importSessions.entries()) {
    if (session.expiresAt < now) {
      importSessions.delete(importId);
      console.log(`🧹 Cleaned up expired import session: ${importId}`);
    }
  }
  
  // Clean up expired files
  for (const [importId, fileInfo] of importFiles.entries()) {
    if (fileInfo.expiresAt < now) {
      importFiles.delete(importId);
      
      // Delete actual file from filesystem
      try {
        if (fs.existsSync(fileInfo.filePath)) {
          fs.unlinkSync(fileInfo.filePath);
          console.log(`🗑️  Deleted expired temporary file: ${fileInfo.filePath}`);
        }
      } catch (error) {
        console.error(`❌ Failed to delete expired file ${fileInfo.filePath}:`, error);
      }
    }
  }
};

/**
 * Delete import session and file
 */
export const deleteImport = (importId: string): boolean => {
  const sessionDeleted = importSessions.delete(importId);
  const fileInfo = importFiles.get(importId);
  const fileDeleted = importFiles.delete(importId);
  
  // Delete actual file from filesystem
  if (fileInfo) {
    try {
      const fs = require('fs');
      if (fs.existsSync(fileInfo.filePath)) {
        fs.unlinkSync(fileInfo.filePath);
        console.log(`🗑️  Deleted temporary file: ${fileInfo.filePath}`);
      }
    } catch (error) {
      console.error(`❌ Failed to delete temporary file ${fileInfo.filePath}:`, error);
    }
  }
  
  return sessionDeleted || fileDeleted;
};

/**
 * Validate import ID exists and is not expired
 */
export const validateImportId = (importId: string): boolean => {
  const session = importSessions.get(importId);
  if (!session) return false;
  
  if (session.expiresAt < new Date()) {
    importSessions.delete(importId);
    return false;
  }
  
  return true;
};

// Export placeholder functions for the main import logic
// These will be implemented in the next steps

/**
 * Analyze uploaded file and suggest column mappings
 */
export const analyzeFile = async (
  importId: string,
  filePath: string,
  fileName: string,
  companyId: string
): Promise<ImportAnalysisResult> => {
  try {
    // Import file parser functions
    const { parseFile, analyzeColumns } = await import('./file_parser');
    
    // Parse the file
    const parsedData = await parseFile(filePath);
    
    // Analyze columns
    const columns = analyzeColumns(parsedData);
    
    // Get sample data (first 5 rows)
    const sampleData = parsedData.rows.slice(0, 5);
    
    // Generate warnings
    const warnings: string[] = [];
    if (parsedData.totalRows === 0) {
      warnings.push('File contains no data rows');
    }
    if (parsedData.totalRows > 10000) {
      warnings.push('Large file detected - import may take some time');
    }
    
    // Check for columns with low confidence
    const lowConfidenceColumns = columns.filter(col => col.confidence < 0.7);
    if (lowConfidenceColumns.length > 0) {
      warnings.push(`${lowConfidenceColumns.length} columns have uncertain data types - please review`);
    }
    
    const analysisResult: ImportAnalysisResult = {
      importId,
      status: 'completed',
      fileName,
      totalRows: parsedData.totalRows,
      columns,
      sampleData,
      warnings,
      errors: [],
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };
    
    // Store the analysis result
    storeImportAnalysis(analysisResult);
    
    return analysisResult;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    const errorResult: ImportAnalysisResult = {
      importId,
      status: 'error',
      fileName,
      totalRows: 0,
      columns: [],
      sampleData: [],
      warnings: [],
      errors: [errorMessage],
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };
    
    storeImportAnalysis(errorResult);
    return errorResult;
  }
};

/**
 * Confirm column mappings and import data
 */
export const confirmImport = async (
  companyId: string,
  userId: string,
  request: ImportConfirmationRequest
): Promise<ImportConfirmationResult> => {
  try {
    // Get the import analysis
    const analysis = getImportAnalysis(request.importId);
    if (!analysis) {
      throw new Error('Import analysis not found or expired');
    }
    
    if (analysis.status === 'error') {
      throw new Error(`Import failed: ${analysis.errors.join(', ')}`);
    }
    
    // Get the file info
    const fileInfo = getImportFile(request.importId);
    if (!fileInfo) {
      throw new Error('Import file not found or expired');
    }
    
    // Import the necessary services
    const { createSchema, updateSchema } = await import('../schema/schema_service');
    const { parseFile } = await import('./file_parser');
    const { withTenantTransaction } = await import('../../database/utils/database');
    
    let schemaSlug: string;
    let importedRows = 0;
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Parse the file again to get the data
    const parsedData = await parseFile(fileInfo.filePath);
    
    // Filter out skipped columns
    const activeMappings = request.columnMappings.filter(mapping => !mapping.skip);
    
    if (activeMappings.length === 0) {
      throw new Error('No columns selected for import');
    }
    
    // Create or update schema
    if (request.schemaAction.type === 'create') {
      if (!request.schemaAction.slug || !request.schemaAction.label) {
        throw new Error('Schema slug and label are required for creating new schema');
      }
      
      // Convert column mappings to column definitions
      const columnDefinitions = activeMappings.map(mapping => ({
        name: mapping.targetName,
        data_type: mapping.dataType,
        nullable: mapping.nullable,
        view_type: getViewTypeFromDataType(mapping.dataType),
        view_editor: getViewEditorFromDataType(mapping.dataType),
        data_type_options: getDataTypeOptions(mapping.dataType),
        is_relation: false // Imported columns are not relations by default
      }));
      
      const schemaData = {
        slug: request.schemaAction.slug,
        label: request.schemaAction.label,
        description: request.schemaAction.description || `Imported from ${analysis.fileName}`,
        columns: columnDefinitions
      };
      
      const newSchema = await createSchema(companyId, userId, schemaData);
      schemaSlug = newSchema.slug;
      
    } else {
      // Update existing schema
      if (!request.schemaAction.existingSlug) {
        throw new Error('Existing schema slug is required for updating schema');
      }
      
      // For now, we'll just use the existing schema
      // TODO: Implement schema update with new columns
      schemaSlug = request.schemaAction.existingSlug;
      warnings.push('Schema update not fully implemented - using existing schema structure');
    }
    
    // Import data to database
    await withTenantTransaction(companyId, async (client) => {
      // Prepare data for insertion
      const insertData = parsedData.rows.map(row => {
        const insertRow: Record<string, any> = {};
        
        activeMappings.forEach(mapping => {
          const originalValue = row[mapping.originalName];
          const convertedValue = convertValueForDataType(originalValue, mapping.dataType);
          insertRow[mapping.targetName] = convertedValue;
        });
        
        // Add system fields
        insertRow.created_by = userId;
        
        return insertRow;
      });
      
      if (insertData.length === 0) {
        warnings.push('No data rows to import');
        return;
      }
      
      // Build insert query
      const columns = ['created_by', ...activeMappings.map(m => m.targetName)];
      const placeholders = insertData.map((_, rowIndex) => 
        `(${columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`).join(', ')})`
      ).join(', ');
      
      const query = `
        INSERT INTO ${schemaSlug} (${columns.join(', ')})
        VALUES ${placeholders}
      `;
      
      const values = insertData.flatMap(row => 
        columns.map(col => row[col])
      );
      
      await client.query(query, values);
      importedRows = insertData.length;
    });
    
    // Clean up temporary files
    deleteImport(request.importId);
    
    return {
      success: true,
      schemaSlug,
      importedRows,
      errors,
      warnings
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      schemaSlug: '',
      importedRows: 0,
      errors: [errorMessage],
      warnings: []
    };
  }
};

/**
 * Helper function to get view type from data type
 */
const getViewTypeFromDataType = (dataType: string): 'text' | 'number' | 'boolean' | 'datetime' | 'file' | 'relation' | 'json' => {
  switch (dataType) {
    case 'int':
    case 'bigint':
    case 'decimal':
    case 'float':
    case 'double':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
    case 'timestamp':
    case 'timestamptz':
      return 'datetime';
    case 'jsonb':
    case 'json':
      return 'json';
    case 'uuid':
      return 'text';
    default:
      return 'text';
  }
};

/**
 * Helper function to get view editor from data type
 */
const getViewEditorFromDataType = (dataType: string): string => {
  switch (dataType) {
    case 'int':
    case 'bigint':
    case 'decimal':
    case 'float':
    case 'double':
      return 'number_input';
    case 'boolean':
      return 'checkbox';
    case 'date':
      return 'date_picker';
    case 'timestamp':
    case 'timestamptz':
      return 'datetime_picker';
    case 'jsonb':
    case 'json':
      return 'json_editor';
    case 'uuid':
      return 'text_input';
    default:
      return 'text_input';
  }
};

/**
 * Helper function to get data type options
 */
const getDataTypeOptions = (dataType: string): any => {
  switch (dataType) {
    case 'varchar':
      return { length: 255 };
    case 'decimal':
      return { precision: 10, scale: 2 };
    default:
      return {};
  }
};

/**
 * Helper function to convert values for database insertion
 */
const convertValueForDataType = (value: any, dataType: string): any => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  switch (dataType) {
    case 'int':
    case 'bigint':
      return parseInt(String(value), 10);
    case 'decimal':
    case 'float':
    case 'double':
      return parseFloat(String(value));
    case 'boolean':
      const boolValue = String(value).toLowerCase();
      return ['true', '1', 'yes', 'y'].includes(boolValue);
    case 'date':
    case 'timestamp':
    case 'timestamptz':
      return new Date(value);
    case 'jsonb':
    case 'json':
      try {
        return typeof value === 'string' ? JSON.parse(value) : value;
      } catch {
        return null;
      }
    case 'uuid':
      return String(value);
    default:
      return String(value);
  }
};
