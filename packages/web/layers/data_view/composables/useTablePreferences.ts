import { ref, computed, watch } from 'vue';

export interface TableColumnPreference {
  field: string;
  visible: boolean;
  width?: string | number;
  minWidth?: string | number;
  fixed?: 'left' | 'right' | null;
  order: number;
}

export interface TablePreferences {
  columns: TableColumnPreference[];
  pageSize?: number;
  sorts?: Array<{ field: string; order: 'asc' | 'desc' }>;
}

export const useTablePreferences = (tableId: string) => {
  const STORAGE_KEY = `table_preferences_${tableId}`;
  
  // Load preferences from localStorage
  const loadPreferences = (): TablePreferences | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.warn('Failed to load table preferences:', error);
      return null;
    }
  };

  // Save preferences to localStorage
  const savePreferences = (preferences: TablePreferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.warn('Failed to save table preferences:', error);
    }
  };

  // Current preferences state
  const preferences = ref<TablePreferences>(loadPreferences() || { columns: [] });

  // Save preferences whenever they change
  watch(preferences, (newPreferences) => {
    savePreferences(newPreferences);
  }, { deep: true });

  // Apply preferences to VTable columns
  const applyPreferencesToColumns = (
    originalColumns: any[],
    preferences: TablePreferences
  ): any[] => {
    if (!preferences.columns.length) {
      // No preferences saved, return original columns with default order
      return originalColumns.map((col, index) => ({
        ...col,
        visible: true,
        order: index
      }));
    }

    // Create a map of preferences by field
    const prefMap = new Map(
      preferences.columns.map(pref => [pref.field, pref])
    );

    // Apply preferences to existing columns
    const processedColumns = originalColumns.map(col => {
      const pref = prefMap.get(col.field as string);
      if (pref) {
        return {
          ...col,
          visible: pref.visible,
          width: pref.width || col.width,
          minWidth: pref.minWidth || col.minWidth,
          fixed: pref.fixed || col.fixed,
          order: pref.order
        };
      }
      return {
        ...col,
        visible: true,
        order: originalColumns.length // New columns go to the end
      };
    });

    // Sort columns by order preference
    return processedColumns
      .filter(col => col.visible !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  // Update column preferences from VTable state
  const updateColumnPreferences = (columns: any[]) => {
    const columnPrefs: TableColumnPreference[] = columns.map((col, index) => ({
      field: col.field as string,
      visible: col.visible !== false,
      width: col.width,
      minWidth: col.minWidth,
      fixed: col.fixed || null,
      order: index
    }));

    preferences.value = {
      ...preferences.value,
      columns: columnPrefs
    };
  };

  // Toggle column visibility
  const toggleColumnVisibility = (field: string, visible: boolean) => {
    const columnIndex = preferences.value.columns.findIndex(col => col.field === field);
    
    if (columnIndex >= 0) {
      preferences.value.columns[columnIndex].visible = visible;
    } else {
      // Add new column preference
      preferences.value.columns.push({
        field,
        visible,
        order: preferences.value.columns.length
      });
    }
  };

  // Update column order
  const updateColumnOrder = (newOrder: string[]) => {
    const updatedColumns = newOrder.map((field, index) => {
      const existing = preferences.value.columns.find(col => col.field === field);
      return {
        ...existing,
        field,
        visible: existing?.visible ?? true,
        order: index
      } as TableColumnPreference;
    });

    preferences.value = {
      ...preferences.value,
      columns: updatedColumns
    };
  };

  // Update column width
  const updateColumnWidth = (field: string, width: string | number) => {
    const columnIndex = preferences.value.columns.findIndex(col => col.field === field);
    
    if (columnIndex >= 0) {
      preferences.value.columns[columnIndex].width = width;
    } else {
      preferences.value.columns.push({
        field,
        visible: true,
        width,
        order: preferences.value.columns.length
      });
    }
  };

  // Reset preferences
  const resetPreferences = () => {
    preferences.value = { columns: [] };
    localStorage.removeItem(STORAGE_KEY);
  };

  // Get visible columns list
  const visibleColumns = computed(() => 
    preferences.value.columns
      .filter(col => col.visible)
      .sort((a, b) => a.order - b.order)
      .map(col => col.field)
  );

  // Get hidden columns list
  const hiddenColumns = computed(() =>
    preferences.value.columns
      .filter(col => !col.visible)
      .map(col => col.field)
  );

  return {
    preferences,
    applyPreferencesToColumns,
    updateColumnPreferences,
    toggleColumnVisibility,
    updateColumnOrder,
    updateColumnWidth,
    resetPreferences,
    visibleColumns,
    hiddenColumns,
    savePreferences,
    loadPreferences
  };
};
