<template>
  <el-dialog
    v-model="visible"
    title="Card Template Settings"
    width="600px"
    :before-close="handleClose"
  >
    <div class="card-template-settings">
      <!-- Template Selection -->
      <div class="setting-section">
        <h4>Template</h4>
        <el-select v-model="settings.templateId" @change="handleTemplateChange">
          <el-option
            v-for="template in availableTemplates"
            :key="template.id"
            :label="template.name"
            :value="template.id"
          >
            <div class="template-option">
              <div class="template-name">{{ template.name }}</div>
              <div class="template-description">{{ template.description }}</div>
            </div>
          </el-option>
        </el-select>
      </div>

      <!-- Primary Columns -->
      <div class="setting-section">
        <h4>Primary Fields</h4>
        <el-slider
          v-model="settings.primaryColumns"
          :min="1"
          :max="6"
          :step="1"
          show-stops
          show-input
        />
        <div class="setting-description">
          Number of fields to show by default (remaining fields will be in expandable section)
        </div>
      </div>

      <!-- Layout -->
      <div class="setting-section">
        <h4>Layout Style</h4>
        <el-radio-group v-model="settings.layout">
          <el-radio label="default">Default</el-radio>
          <el-radio label="compact">Compact</el-radio>
          <el-radio label="detailed">Detailed</el-radio>
        </el-radio-group>
        <div class="setting-description">
          <div v-if="settings.layout === 'default'">Standard card layout with balanced spacing</div>
          <div v-else-if="settings.layout === 'compact'">Minimal spacing for more cards on screen</div>
          <div v-else-if="settings.layout === 'detailed'">Expanded layout with more information visible</div>
        </div>
      </div>

      <!-- Custom Fields (Advanced) -->
      <div class="setting-section">
        <h4>Custom Fields (Advanced)</h4>
        <el-button 
          type="primary" 
          size="small" 
          @click="addCustomField"
          :disabled="!settings.customFields"
        >
          Add Custom Field
        </el-button>
        
        <div v-if="settings.customFields && settings.customFields.length > 0" class="custom-fields">
          <div
            v-for="(field, index) in settings.customFields"
            :key="index"
            class="custom-field-item"
          >
            <el-input
              v-model="field.field"
              placeholder="Field name"
              size="small"
            />
            <el-input
              v-model="field.label"
              placeholder="Display label"
              size="small"
            />
            <el-select v-model="field.type" size="small">
              <el-option label="Text" value="text" />
              <el-option label="Date" value="date" />
              <el-option label="Status" value="status" />
              <el-option label="Number" value="number" />
            </el-select>
            <el-button
              type="danger"
              size="small"
              @click="removeCustomField(index)"
            >
              Remove
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">Cancel</el-button>
        <el-button type="primary" @click="handleSave">Save Settings</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { useCardTemplate, type CardTemplateSettings } from '../../composables/useCardTemplate'

const props = defineProps<{
  modelValue: boolean
  tableId: string
}>()

const emits = defineEmits<{
  'update:modelValue': [value: boolean]
  'settings-saved': [settings: CardTemplateSettings]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emits('update:modelValue', value)
})

const { getCardTemplateSettings, saveCardTemplateSettings, getAvailableTemplates } = useCardTemplate()

const availableTemplates = computed(() => getAvailableTemplates())

// Settings state
const settings = ref<CardTemplateSettings>({
  templateId: 'default',
  primaryColumns: 3,
  layout: 'default'
})

// Load settings when dialog opens
watch(visible, (newValue) => {
  if (newValue) {
    settings.value = getCardTemplateSettings(props.tableId)
  }
})

// Handle template change
function handleTemplateChange(templateId: string) {
  const template = availableTemplates.value.find(t => t.id === templateId)
  if (template) {
    settings.value.primaryColumns = template.primaryColumns
    settings.value.layout = template.layout
  }
}

// Add custom field
function addCustomField() {
  if (!settings.value.customFields) {
    settings.value.customFields = []
  }
  settings.value.customFields.push({
    field: '',
    label: '',
    type: 'text'
  })
}

// Remove custom field
function removeCustomField(index: number) {
  if (settings.value.customFields) {
    settings.value.customFields.splice(index, 1)
  }
}

// Handle save
async function handleSave() {
  try {
    await saveCardTemplateSettings(props.tableId, settings.value)
    emits('settings-saved', settings.value)
    visible.value = false
  } catch (error) {
    console.error('Error saving card template settings:', error)
  }
}

// Handle close
function handleClose() {
  visible.value = false
}
</script>

<style lang="scss" scoped>
.card-template-settings {
  .setting-section {
    margin-bottom: 24px;
    
    h4 {
      margin: 0 0 12px 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
    
    .setting-description {
      margin-top: 8px;
      font-size: 14px;
      color: var(--el-text-color-regular);
    }
  }
}

.template-option {
  .template-name {
    font-weight: 500;
  }
  
  .template-description {
    font-size: 12px;
    color: var(--el-text-color-regular);
    margin-top: 4px;
  }
}

.custom-fields {
  margin-top: 12px;
  
  .custom-field-item {
    display: grid;
    grid-template-columns: 1fr 1fr 120px auto;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
    padding: 8px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style> 
