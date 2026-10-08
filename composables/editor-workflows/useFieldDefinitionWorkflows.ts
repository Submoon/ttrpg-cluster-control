import { ref, shallowRef, type Ref } from 'vue'
import {
  addCustomFieldDefinition,
  customFieldApplicabilityTargetKey,
  removeCustomFieldDefinition,
  renameCustomFieldDefinition,
  updateCustomFieldApplicability,
  updateCustomFieldOptions,
  updateNativeFieldOptions,
  type CustomFieldApplicabilityTarget,
  type LocalWorkspace,
} from '../../domain/workspace'
import type { FieldDefinitionUpdateRequest, CustomFieldCreateRequest } from './types'

interface FieldDefinitionWorkflowOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  commit: (nextWorkspace: LocalWorkspace) => Promise<void>
  confirmDiscardInspectorEdits: () => boolean
}

export function useFieldDefinitionWorkflows({
  workspace,
  commit,
  confirmDiscardInspectorEdits,
}: FieldDefinitionWorkflowOptions) {
  const fieldDefinitionDialogOpen = ref(false)
  const fieldDefinitionError = ref('')
  const fieldDefinitionSaveRevision = ref(0)
  const fieldDefinitionsDialog = shallowRef<{ open: () => void } | null>(null)

  function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  function openFieldDefinitions(): void {
    if (!workspace.value || fieldDefinitionDialogOpen.value || !confirmDiscardInspectorEdits()) return
    fieldDefinitionError.value = ''
    fieldDefinitionsDialog.value?.open()
  }

  async function createCustomField(request: CustomFieldCreateRequest): Promise<void> {
    const currentWorkspace = workspace.value
    if (!currentWorkspace) return

    try {
      const updatedWorkspace = addCustomFieldDefinition(
        currentWorkspace,
        request.name,
        request.type,
        request.options,
      )
      await commit(updatedWorkspace)
      fieldDefinitionSaveRevision.value += 1
      fieldDefinitionError.value = ''
    } catch (error) {
      fieldDefinitionError.value = errorText(error)
    }
  }

  function sameFieldOptions(first: string[], second: string[]): boolean {
    return first.length === second.length && first.every((option, index) => option === second[index])
  }

  function sameCustomFieldApplicability(
    first: CustomFieldApplicabilityTarget[] | undefined,
    second: CustomFieldApplicabilityTarget[] | undefined,
  ): boolean {
    if (first === undefined || second === undefined) return first === second
    const secondKeys = new Set(second.map(customFieldApplicabilityTargetKey))
    return first.length === second.length
      && first.every(target => secondKeys.has(customFieldApplicabilityTargetKey(target)))
  }

  function applyFieldDefinitionUpdate(
    currentWorkspace: LocalWorkspace,
    request: FieldDefinitionUpdateRequest,
  ): LocalWorkspace {
    let updatedWorkspace = currentWorkspace
    if (request.fieldId === 'native:atmosphere' || request.fieldId === 'native:port-class') {
      const nativeField = request.fieldId === 'native:atmosphere' ? 'atmosphere' : 'portClass'
      const currentOptions = nativeField === 'atmosphere'
        ? currentWorkspace.objectFieldSettings.atmosphereOptions
        : currentWorkspace.objectFieldSettings.portClassOptions
      if (!sameFieldOptions(currentOptions, request.options)) {
        updatedWorkspace = updateNativeFieldOptions(updatedWorkspace, nativeField, request.options, true)
      }
      return updatedWorkspace
    }

    const definition = currentWorkspace.objectFieldSettings.customFields.find(
      field => field.id === request.fieldId,
    )
    if (!definition) throw new Error('The selected field definition no longer exists.')
    if (request.name !== definition.name) {
      updatedWorkspace = renameCustomFieldDefinition(updatedWorkspace, definition.id, request.name)
    }
    if (
      definition.type === 'single-select'
      && !sameFieldOptions(definition.options, request.options)
    ) {
      updatedWorkspace = updateCustomFieldOptions(updatedWorkspace, definition.id, request.options, true)
    }
    if (!sameCustomFieldApplicability(definition.applicability, request.applicability)) {
      updatedWorkspace = updateCustomFieldApplicability(updatedWorkspace, definition.id, request.applicability)
    }
    return updatedWorkspace
  }

  async function saveFieldDefinitionChanges(request: FieldDefinitionUpdateRequest): Promise<void> {
    const currentWorkspace = workspace.value
    if (!currentWorkspace) return

    try {
      await commit(applyFieldDefinitionUpdate(currentWorkspace, request))
      fieldDefinitionSaveRevision.value += 1
      fieldDefinitionError.value = ''
    } catch (error) {
      fieldDefinitionError.value = errorText(error)
    }
  }

  async function removeFieldDefinition(fieldId: string): Promise<void> {
    const currentWorkspace = workspace.value
    if (!currentWorkspace) return

    try {
      await commit(removeCustomFieldDefinition(currentWorkspace, fieldId))
      fieldDefinitionSaveRevision.value += 1
      fieldDefinitionError.value = ''
    } catch (error) {
      fieldDefinitionError.value = errorText(error)
    }
  }

  return {
    fieldDefinitionDialogOpen,
    fieldDefinitionError,
    fieldDefinitionSaveRevision,
    fieldDefinitionsDialog,
    openFieldDefinitions,
    createCustomField,
    saveFieldDefinitionChanges,
    removeFieldDefinition,
  }
}
