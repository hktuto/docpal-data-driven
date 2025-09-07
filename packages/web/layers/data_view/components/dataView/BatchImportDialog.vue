<template>
  <el-dialog
    v-model="dialogVisible"
    title="Batch Import Data"
    width="800px"
    :before-close="handleClose"
    :close-on-click-modal="false"
  >
    <div class="batch-import-container">
      <!-- Step 1: File Upload -->
      <div v-if="currentStep === 1" class="import-step">
        <div class="step-header">
          <h3>Step 1: Upload File</h3>
          <p>Upload a CSV or XLSX file to import data into {{ tableName }}</p>
        </div>

        <!-- File Upload Area -->
        <div class="upload-area">
          <el-upload
            ref="uploadRef"
            class="upload-dragger"
            drag
            :auto-upload="false"
            :show-file-list="false"
            :accept="'.csv,.xlsx,.xls'"
            :on-change="handleFileChange"
            :before-upload="beforeUpload"
          >
            <div class="upload-content">
              <el-icon class="upload-icon"><UploadFilled /></el-icon>
              <div class="upload-text">
                <p>Drop file here or <em>click to upload</em></p>
                <p class="upload-hint">Support CSV, XLSX files (max 10MB)</p>
              </div>
            </div>
          </el-upload>

          <!-- Selected File Info -->
          <div v-if="selectedFile" class="file-info">
            <div class="file-details">
              <el-icon><Document /></el-icon>
              <span class="file-name">{{ selectedFile.name }}</span>
              <span class="file-size">({{ formatFileSize(selectedFile.size) }})</span>
              <el-button 
                type="danger" 
                size="small" 
                :icon="Delete" 
                circle 
                @click="removeFile"
              />
            </div>
          </div>
        </div>

        <!-- Parse Progress -->
        <div v-if="parsing" class="parsing-progress">
          <el-progress 
            :percentage="parseProgress" 
            :status="parseProgress === 100 ? 'success' : undefined"
          />
          <p>Parsing file...</p>
        </div>

        <!-- Parse Results -->
        <div v-if="parseResults" class="parse-results">
          <el-alert
            :title="`Found ${parseResults.totalRows} rows with ${parseResults.columns.length} columns`"
            type="success"
            :closable="false"
          />
          
          <!-- Preview Data -->
          <div class="preview-section">
            <h4>Data Preview (first 5 rows)</h4>
            <el-table 
              :data="parseResults.preview" 
              size="small"
              max-height="200"
              style="width: 100%"
            >
              <el-table-column
                v-for="col in parseResults.columns"
                :key="col"
                :prop="col"
                :label="col"
                min-width="120"
                show-overflow-tooltip
              />
            </el-table>
          </div>
        </div>
      </div>

      <!-- Step 2: Column Mapping -->
      <div v-if="currentStep === 2" class="import-step">
        <div class="step-header">
          <h3>Step 2: Map Columns</h3>
          <p>Map the columns from your file to the table fields</p>
        </div>

        <div class="mapping-section">
          <!-- Auto-mapping Info -->
          <div v-if="autoMappedCount > 0" class="auto-mapping-info">
            <el-alert
              :title="`${autoMappedCount} columns auto-mapped based on name similarity`"
              type="info"
              :closable="false"
            />
          </div>

          <!-- Mapping Table -->
          <div class="mapping-table">
            <div class="mapping-header">
              <div class="header-col">Import Column</div>
              <div class="header-col">Table Field</div>
              <div class="header-col">Sample Data</div>
            </div>

            <div 
              v-for="(importCol, index) in parseResults?.columns || []" 
              :key="importCol"
              class="mapping-row"
            >
              <div class="import-column">
                <el-tag>{{ importCol }}</el-tag>
              </div>
              
              <div class="table-field">
                <el-select
                  v-model="columnMappings[importCol]"
                  placeholder="Select table field"
                  clearable
                  filterable
                  style="width: 100%"
                >
                  <el-option
                    v-for="tableCol in availableTableColumns"
                    :key="tableCol.column_name"
                    :label="tableCol.display_name || tableCol.column_name"
                    :value="tableCol.column_name"
                  >
                    <div class="table-column-option">
                      <span>{{ tableCol.display_name || tableCol.column_name }}</span>
                      <el-tag size="small" :type="getColumnTypeColor(tableCol.data_type)">
                        {{ tableCol.data_type }}
                      </el-tag>
                    </div>
                  </el-option>
                </el-select>
              </div>
              
              <div class="sample-data">
                <span class="sample-text">
                  {{ getSampleData(importCol) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Mapping Summary -->
          <div class="mapping-summary">
            <div class="summary-stats">
              <el-statistic 
                title="Mapped Columns" 
                :value="mappedColumnsCount" 
                :suffix="`/ ${parseResults?.columns.length || 0}`"
              />
              <el-statistic 
                title="Rows to Import" 
                :value="parseResults?.totalRows || 0" 
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Step 3: Import Options -->
      <div v-if="currentStep === 3" class="import-step">
        <div class="step-header">
          <h3>Step 3: Import Options</h3>
          <p>Configure how the data should be imported</p>
        </div>

        <div class="import-options">
          <el-form :model="importOptions" label-width="150px">
            <el-form-item label="Import Mode">
              <el-radio-group v-model="importOptions.mode">
                <el-radio value="insert">Insert new records</el-radio>
                <el-radio value="upsert">Insert or update existing</el-radio>
              </el-radio-group>
              <div class="option-hint">
                <span v-if="importOptions.mode === 'insert'">
                  All rows will be inserted as new records
                </span>
                <span v-else>
                  Existing records will be updated based on unique fields
                </span>
              </div>
            </el-form-item>

            <el-form-item label="Skip Errors">
              <el-switch v-model="importOptions.skipErrors" />
              <div class="option-hint">
                Continue importing even if some rows have validation errors
              </div>
            </el-form-item>

            <el-form-item label="Batch Size">
              <el-input-number 
                v-model="importOptions.batchSize" 
                :min="10" 
                :max="1000" 
                :step="10"
              />
              <div class="option-hint">
                Number of records to process in each batch
              </div>
            </el-form-item>
          </el-form>
        </div>

        <!-- Final Summary -->
        <div class="final-summary">
          <el-card>
            <template #header>
              <span>Import Summary</span>
            </template>
            <div class="summary-content">
              <p><strong>File:</strong> {{ selectedFile?.name }}</p>
              <p><strong>Total Rows:</strong> {{ parseResults?.totalRows }}</p>
              <p><strong>Mapped Columns:</strong> {{ mappedColumnsCount }}</p>
              <p><strong>Import Mode:</strong> {{ importOptions.mode }}</p>
            </div>
          </el-card>
        </div>
      </div>

      <!-- Import Progress -->
      <div v-if="importing" class="import-progress">
        <div class="progress-content">
          <el-progress 
            :percentage="importProgress" 
            :status="importStatus"
            :stroke-width="8"
          />
          <p class="progress-text">{{ importStatusText }}</p>
          
          <div v-if="importResults" class="import-results">
            <div class="result-stats">
              <el-statistic 
                title="Imported" 
                :value="importResults.imported" 
                class="success-stat"
              />
              <el-statistic 
                v-if="importResults.errors > 0"
                title="Errors" 
                :value="importResults.errors" 
                class="error-stat"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <!-- Step Navigation -->
        <div class="step-navigation">
          <el-button 
            v-if="currentStep > 1 && !importing" 
            @click="previousStep"
          >
            Previous
          </el-button>
          
          <el-button 
            v-if="currentStep < 3 && !importing"
            type="primary" 
            @click="nextStep"
            :disabled="!canProceedToNextStep"
          >
            Next
          </el-button>
          
          <el-button 
            v-if="currentStep === 3 && !importing"
            type="primary" 
            @click="startImport"
            :disabled="mappedColumnsCount === 0"
          >
            Start Import
          </el-button>
        </div>

        <!-- Close Button -->
        <div class="close-actions">
          <el-button @click="handleClose" :disabled="importing">
            {{ importing ? 'Importing...' : 'Close' }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import { UploadFilled, Document, Delete } from '@element-plus/icons-vue';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { apiClient } from 'api-client';

interface Props {
  tableName: string;
  columns: any[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  imported: [count: number];
  cancelled: [];
}>();

// Dialog state
const dialogVisible = ref(false);
const currentStep = ref(1);
const uploadRef = ref();

// File handling
const selectedFile = ref<File | null>(null);
const parsing = ref(false);
const parseProgress = ref(0);
const parseResults = ref<{
  columns: string[];
  data: any[];
  preview: any[];
  totalRows: number;
} | null>(null);

// Column mapping
const columnMappings = ref<Record<string, string>>({});
const autoMappedCount = ref(0);

// Import options
const importOptions = reactive({
  mode: 'insert' as 'insert' | 'upsert',
  skipErrors: true,
  batchSize: 100
});

// Import progress
const importing = ref(false);
const importProgress = ref(0);
const importStatus = ref<'success' | 'exception' | undefined>();
const importStatusText = ref('');
const importResults = ref<{
  imported: number;
  errors: number;
} | null>(null);

// Computed properties
const availableTableColumns = computed(() => {
  return props.columns.filter(col => !col.is_system && !col.is_relation);
});

const mappedColumnsCount = computed(() => {
  return Object.values(columnMappings.value).filter(Boolean).length;
});

const canProceedToNextStep = computed(() => {
  switch (currentStep.value) {
    case 1:
      return parseResults.value !== null;
    case 2:
      return mappedColumnsCount.value > 0;
    default:
      return true;
  }
});

// Methods
const open = () => {
  dialogVisible.value = true;
  resetState();
};

const resetState = () => {
  currentStep.value = 1;
  selectedFile.value = null;
  parsing.value = false;
  parseProgress.value = 0;
  parseResults.value = null;
  columnMappings.value = {};
  autoMappedCount.value = 0;
  importing.value = false;
  importProgress.value = 0;
  importStatus.value = undefined;
  importStatusText.value = '';
  importResults.value = null;
};

const handleClose = () => {
  if (importing.value) {
    ElMessage.warning('Import in progress, please wait...');
    return;
  }
  dialogVisible.value = false;
  emit('cancelled');
};

const handleFileChange = (file: any) => {
  selectedFile.value = file.raw;
  parseFile(file.raw);
};

const beforeUpload = () => {
  return false; // Prevent auto upload
};

const removeFile = () => {
  selectedFile.value = null;
  parseResults.value = null;
  uploadRef.value?.clearFiles();
};

const parseFile = async (file: File) => {
  parsing.value = true;
  parseProgress.value = 0;

  try {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    
    if (isExcel) {
      await parseExcelFile(file);
    } else {
      await parseCSVFile(file);
    }
    
    // Auto-map columns
    autoMapColumns();
    
    parseProgress.value = 100;
  } catch (error) {
    console.error('Error parsing file:', error);
    ElMessage.error('Failed to parse file. Please check the file format.');
    parseResults.value = null;
  } finally {
    parsing.value = false;
  }
};

const parseExcelFile = async (file: File) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length === 0) {
          reject(new Error('Empty file'));
          return;
        }
        
        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1).filter(row => row.length > 0);
        
        parseResults.value = {
          columns: headers,
          data: rows.map(row => {
            const obj: any = {};
            headers.forEach((header, index) => {
              obj[header] = row[index] || '';
            });
            return obj;
          }),
          preview: rows.slice(0, 5).map(row => {
            const obj: any = {};
            headers.forEach((header, index) => {
              obj[header] = row[index] || '';
            });
            return obj;
          }),
          totalRows: rows.length
        };
        
        resolve(true);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

const parseCSVFile = async (file: File) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error('CSV parsing errors'));
          return;
        }
        
        const headers = results.meta.fields || [];
        const data = results.data as any[];
        
        parseResults.value = {
          columns: headers,
          data: data,
          preview: data.slice(0, 5),
          totalRows: data.length
        };
        
        resolve(true);
      },
      error: reject
    });
  });
};

const autoMapColumns = () => {
  if (!parseResults.value) return;
  
  let autoMapped = 0;
  const mappings: Record<string, string> = {};
  
  parseResults.value.columns.forEach(importCol => {
    // Find exact match first
    let tableCol = availableTableColumns.value.find(col => 
      col.column_name.toLowerCase() === importCol.toLowerCase() ||
      col.display_name?.toLowerCase() === importCol.toLowerCase()
    );
    
    // If no exact match, try partial match
    if (!tableCol) {
      tableCol = availableTableColumns.value.find(col => 
        col.column_name.toLowerCase().includes(importCol.toLowerCase()) ||
        importCol.toLowerCase().includes(col.column_name.toLowerCase()) ||
        (col.display_name && col.display_name.toLowerCase().includes(importCol.toLowerCase()))
      );
    }
    
    if (tableCol) {
      mappings[importCol] = tableCol.column_name;
      autoMapped++;
    }
  });
  
  columnMappings.value = mappings;
  autoMappedCount.value = autoMapped;
};

const getSampleData = (importCol: string) => {
  if (!parseResults.value?.preview.length) return '';
  const sample = parseResults.value.preview[0][importCol];
  return String(sample || '').substring(0, 50);
};

const getColumnTypeColor = (dataType: string) => {
  const typeColors: Record<string, string> = {
    'text': '',
    'number': 'warning',
    'integer': 'warning',
    'boolean': 'success',
    'date': 'info',
    'datetime': 'info'
  };
  return typeColors[dataType] || '';
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const nextStep = () => {
  if (canProceedToNextStep.value) {
    currentStep.value++;
  }
};

const previousStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--;
  }
};

const startImport = async () => {
  if (!selectedFile.value || !parseResults.value) return;
  
  importing.value = true;
  importProgress.value = 0;
  importStatusText.value = 'Preparing import...';
  
  try {
    // Prepare import data
    const importData = {
      tableName: props.tableName,
      file: selectedFile.value,
      mappings: columnMappings.value,
      options: importOptions,
      totalRows: parseResults.value.totalRows
    };
    
    // Create FormData for file upload
    const formData = new FormData();
    formData.append('file', selectedFile.value);
    formData.append('mappings', JSON.stringify(columnMappings.value));
    formData.append('options', JSON.stringify(importOptions));
    
    importStatusText.value = 'Uploading and processing...';
    importProgress.value = 25;
    
    // Call API endpoint
    const response = await fetch(`/api/companies/data/records/${props.tableName}/import`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Import failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    importProgress.value = 100;
    importStatus.value = 'success';
    importStatusText.value = 'Import completed successfully!';
    
    importResults.value = {
      imported: result.data.imported || 0,
      errors: result.data.errors || 0
    };
    
    ElMessage.success(`Successfully imported ${result.data.imported} records`);
    emit('imported', result.data.imported);
    
    // Auto close after success
    setTimeout(() => {
      dialogVisible.value = false;
    }, 2000);
    
  } catch (error) {
    console.error('Import error:', error);
    importStatus.value = 'exception';
    importStatusText.value = 'Import failed';
    ElMessage.error('Failed to import data. Please try again.');
  } finally {
    importing.value = false;
  }
};

defineExpose({
  open
});
</script>

<style scoped>
.batch-import-container {
  min-height: 400px;
}

.import-step {
  padding: 20px 0;
}

.step-header {
  margin-bottom: 24px;
  text-align: center;
}

.step-header h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  color: var(--el-text-color-primary);
}

.step-header p {
  margin: 0;
  color: var(--el-text-color-regular);
}

/* File Upload Styles */
.upload-area {
  margin-bottom: 24px;
}

.upload-dragger {
  width: 100%;
}

.upload-content {
  padding: 40px;
  text-align: center;
}

.upload-icon {
  font-size: 48px;
  color: var(--el-color-primary);
  margin-bottom: 16px;
}

.upload-text p {
  margin: 8px 0;
}

.upload-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.file-info {
  margin-top: 16px;
  padding: 12px;
  background: var(--el-bg-color-page);
  border-radius: 6px;
}

.file-details {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-name {
  font-weight: 500;
  flex: 1;
}

.file-size {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

/* Parsing Progress */
.parsing-progress {
  text-align: center;
  padding: 20px;
}

/* Parse Results */
.parse-results {
  margin-top: 24px;
}

.preview-section {
  margin-top: 16px;
}

.preview-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

/* Column Mapping Styles */
.mapping-section {
  max-height: 500px;
  overflow-y: auto;
}

.auto-mapping-info {
  margin-bottom: 16px;
}

.mapping-table {
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  overflow: hidden;
}

.mapping-header {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  background: var(--el-bg-color-page);
  border-bottom: 1px solid var(--el-border-color-light);
}

.header-col {
  padding: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  border-right: 1px solid var(--el-border-color-light);
}

.header-col:last-child {
  border-right: none;
}

.mapping-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  border-bottom: 1px solid var(--el-border-color-lighter);
  align-items: center;
}

.mapping-row:last-child {
  border-bottom: none;
}

.import-column,
.table-field,
.sample-data {
  padding: 12px;
  border-right: 1px solid var(--el-border-color-lighter);
}

.sample-data {
  border-right: none;
}

.table-column-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sample-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-family: monospace;
}

.mapping-summary {
  margin-top: 16px;
  padding: 16px;
  background: var(--el-bg-color-page);
  border-radius: 6px;
}

.summary-stats {
  display: flex;
  gap: 32px;
}

/* Import Options */
.import-options {
  margin-bottom: 24px;
}

.option-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.final-summary {
  margin-top: 24px;
}

.summary-content p {
  margin: 8px 0;
}

/* Import Progress */
.import-progress {
  text-align: center;
  padding: 40px 20px;
}

.progress-content {
  max-width: 400px;
  margin: 0 auto;
}

.progress-text {
  margin: 16px 0;
  font-weight: 500;
}

.import-results {
  margin-top: 24px;
}

.result-stats {
  display: flex;
  justify-content: center;
  gap: 32px;
}

.success-stat :deep(.el-statistic__number) {
  color: var(--el-color-success);
}

.error-stat :deep(.el-statistic__number) {
  color: var(--el-color-danger);
}

/* Dialog Footer */
.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.step-navigation {
  display: flex;
  gap: 8px;
}

/* Responsive */
@media (max-width: 768px) {
  .mapping-header,
  .mapping-row {
    grid-template-columns: 1fr;
  }
  
  .header-col,
  .import-column,
  .table-field,
  .sample-data {
    border-right: none;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }
  
  .summary-stats {
    flex-direction: column;
    gap: 16px;
  }
}
</style>
