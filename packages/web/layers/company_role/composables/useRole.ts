import { apiClient } from 'api-client';
import {useState} from '#imports';

const useRoleOptions = () => useState('rolesOption', () => ([]))

export const useRole = () => {
  const roleOptions = useRoleOptions()
  async function refreshRoleOptions() {
    const res = await apiClient.companies.postDataSchemaTableNameDropdown("roles",{
      label: 'name',
      value: 'id',
    })
    roleOptions.value = res.data || []
  }
  async function getAllRoles() {
    if(roleOptions.value.length > 0) {
      return roleOptions.value
    }
    await refreshRoleOptions()
    return roleOptions.value
  }

  return {
    roleOptions,
    getAllRoles
  }
}