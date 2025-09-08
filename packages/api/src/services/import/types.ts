/**
 * Import Service Types
 * Defines the data structures for the two-step import process
 */

export interface ImportAnalysisRequest {
  importId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface ColumnAnalysis {
  originalName: string;
  suggestedName: string;
  suggestedType: string;
  confidence: number; // 0-1, how confident we are in the type detection
  sampleValues: string[];
  issues: string[]; // Any problems detected
  nullable: boolean;
}

export interface ImportAnalysisResult {
  importId: string;
  status: 'analyzing' | 'completed' | 'error';
  fileName: string;
  totalRows: number;
  columns: ColumnAnalysis[];
  sampleData: Record<string, any>[]; // First 5 rows as preview
  warnings: string[];
  errors: string[];
  createdAt: Date;
  expiresAt: Date;
}

export interface ImportConfirmationRequest {
  importId: string;
  columnMappings: ColumnMapping[];
  schemaAction: {
    type: 'create' | 'update';
    slug?: string; // For create
    existingSlug?: string; // For update
    label?: string; // For create
    description?: string; // For create
  };
}

export interface ColumnMapping {
  originalName: string;
  targetName: string;
  dataType: string;
  nullable: boolean;
  skip: boolean; // If true, don't import this column
}

export interface ImportConfirmationResult {
  success: boolean;
  schemaSlug: string;
  importedRows: number;
  errors: string[];
  warnings: string[];
}

export interface ImportFileInfo {
  importId: string;
  filePath: string;
  fileName: string;
  companyId: string;
  createdAt: Date;
  expiresAt: Date;
}

