import * as XLSX from 'xlsx';
import * as fs from 'fs';
import csv from 'csv-parser';
import { ColumnAnalysis } from './types';

/**
 * File Parser Service
 * Handles parsing of CSV and Excel files for import analysis
 */

export interface ParsedData {
  columns: string[];
  rows: Record<string, any>[];
  totalRows: number;
}

/**
 * Parse CSV file
 */
export const parseCSV = async (filePath: string): Promise<ParsedData> => {
  return new Promise((resolve, reject) => {
    const results: Record<string, any>[] = [];
    const columns: string[] = [];
    let isFirstRow = true;

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('headers', (headers: string[]) => {
        columns.push(...headers);
      })
      .on('data', (data: Record<string, any>) => {
        if (isFirstRow) {
          isFirstRow = false;
        }
        results.push(data);
      })
      .on('end', () => {
        resolve({
          columns,
          rows: results,
          totalRows: results.length
        });
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

/**
 * Parse Excel file
 */
export const parseExcel = async (filePath: string): Promise<ParsedData> => {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length === 0) {
      throw new Error('Excel file is empty');
    }
    
    // First row contains headers
    const headers = jsonData[0] as string[];
    const dataRows = jsonData.slice(1) as any[][];
    
    // Convert to object format
    const rows = dataRows.map(row => {
      const obj: Record<string, any> = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || null;
      });
      return obj;
    });
    
    return {
      columns: headers,
      rows,
      totalRows: rows.length
    };
  } catch (error) {
    throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Detect data type from sample values
 */
export const detectDataType = (values: any[]): { type: string; confidence: number; issues: string[] } => {
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
  
  if (nonNullValues.length === 0) {
    return { type: 'text', confidence: 0.5, issues: ['All values are empty'] };
  }
  
  const issues: string[] = [];
  let type = 'text';
  let confidence = 0.5;
  
  // Check for UUID pattern
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (nonNullValues.every(v => uuidPattern.test(String(v)))) {
    return { type: 'uuid', confidence: 0.95, issues: [] };
  }
  
  // Check for email pattern
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (nonNullValues.every(v => emailPattern.test(String(v)))) {
    return { type: 'varchar', confidence: 0.9, issues: [] };
  }
  
  // Check for boolean
  const booleanValues = ['true', 'false', '1', '0', 'yes', 'no', 'y', 'n'];
  if (nonNullValues.every(v => booleanValues.includes(String(v).toLowerCase()))) {
    return { type: 'boolean', confidence: 0.9, issues: [] };
  }
  
  // Check for numbers
  const numericValues = nonNullValues.filter(v => !isNaN(Number(v)) && v !== '');
  if (numericValues.length === nonNullValues.length) {
    // Check if all are integers
    const integerValues = numericValues.filter(v => Number.isInteger(Number(v)));
    if (integerValues.length === numericValues.length) {
      // Check if they're small integers
      const maxValue = Math.max(...numericValues.map(v => Math.abs(Number(v))));
      if (maxValue <= 2147483647) { // PostgreSQL INTEGER max
        return { type: 'int', confidence: 0.9, issues: [] };
      } else {
        return { type: 'bigint', confidence: 0.9, issues: [] };
      }
    } else {
      return { type: 'decimal', confidence: 0.9, issues: [] };
    }
  }
  
  // Check for dates
  const dateValues = nonNullValues.filter(v => {
    const date = new Date(v);
    return !isNaN(date.getTime()) && date.toString() !== 'Invalid Date';
  });
  if (dateValues.length >= nonNullValues.length * 0.8) { // 80% are valid dates
    const hasTime = dateValues.some(v => {
      const date = new Date(v);
      return date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0;
    });
    return { 
      type: hasTime ? 'timestamp' : 'date', 
      confidence: 0.8, 
      issues: dateValues.length < nonNullValues.length ? ['Some values are not valid dates'] : []
    };
  }
  
  // Check for JSON
  const jsonValues = nonNullValues.filter(v => {
    try {
      JSON.parse(String(v));
      return true;
    } catch {
      return false;
    }
  });
  if (jsonValues.length >= nonNullValues.length * 0.7) { // 70% are valid JSON
    return { 
      type: 'jsonb', 
      confidence: 0.7, 
      issues: jsonValues.length < nonNullValues.length ? ['Some values are not valid JSON'] : []
    };
  }
  
  // Check string length
  const maxLength = Math.max(...nonNullValues.map(v => String(v).length));
  if (maxLength <= 255) {
    type = 'varchar';
    confidence = 0.7;
  } else {
    type = 'text';
    confidence = 0.8;
  }
  
  // Check for special characters that might cause issues
  const specialCharPattern = /[<>:"/\\|?*]/;
  const hasSpecialChars = nonNullValues.some(v => specialCharPattern.test(String(v)));
  if (hasSpecialChars) {
    issues.push('Contains special characters');
  }
  
  return { type, confidence, issues };
};

/**
 * Generate suggested column name from original name
 */
export const generateColumnName = (originalName: string): string => {
  return originalName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/^[0-9]/, 'col_$&') // Prefix with 'col_' if starts with number
    .substring(0, 50); // Limit length
};

/**
 * Analyze columns from parsed data
 */
export const analyzeColumns = (parsedData: ParsedData): ColumnAnalysis[] => {
  const { columns, rows } = parsedData;
  
  return columns.map(columnName => {
    // Get sample values (first 10 non-null values)
    const sampleValues = rows
      .map(row => row[columnName])
      .filter(v => v !== null && v !== undefined && v !== '')
      .slice(0, 10)
      .map(v => String(v));
    
    // Detect data type
    const typeDetection = detectDataType(rows.map(row => row[columnName]));
    
    // Generate suggested name
    const suggestedName = generateColumnName(columnName);
    
    // Check if column is nullable (has null/empty values)
    const nullable = rows.some(row => 
      row[columnName] === null || 
      row[columnName] === undefined || 
      row[columnName] === ''
    );
    
    return {
      originalName: columnName,
      suggestedName,
      suggestedType: typeDetection.type,
      confidence: typeDetection.confidence,
      sampleValues,
      issues: typeDetection.issues,
      nullable
    };
  });
};

/**
 * Parse file based on extension
 */
export const parseFile = async (filePath: string): Promise<ParsedData> => {
  const extension = filePath.toLowerCase().split('.').pop();
  
  switch (extension) {
    case 'csv':
      return await parseCSV(filePath);
    case 'xlsx':
    case 'xls':
      return await parseExcel(filePath);
    default:
      throw new Error(`Unsupported file type: ${extension}`);
  }
};
