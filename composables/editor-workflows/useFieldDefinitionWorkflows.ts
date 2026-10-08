/**
 * Applies confirmed definition edits through the injected commit and acknowledges only successful saves.
 */
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

/**
 * Provides field-definition commands while leaving dialog drafts and destructive-change confirmation in the UI.
 * @param options Workspace, persistence callback, and inspector-draft guard.
 * @returns Dialog state, a save acknowledgement revision, and definition commands.
 */
export function useFieldDefinitionWorkflows({
  workspace,
  commit,
  confirmDiscardInspectorEdits,
}: FieldDefinitionWorkflowOptions) {
  const fieldDefinitionDialogOpen = ref(false)
  const fieldDefinitionError = ref('')
  // The dialog uses this revision as a success acknowledgement before resetting its local drafts.
  const fieldDefinitionSaveRevision = ref(0)
  const fieldDefinitionsDialog = shallowRef<{ open: () => void } | null>(null)

  function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  /** Opens the dialog only for an existing workspace and after the inspector-draft guard passes. */
  function openFieldDefinitions(): void {
    if (!workspace.value || fieldDefinitionDialogOpen.value || !confirmDiscardInspectorEdits()) return
    fieldDefinitionError.value = ''
    fieldDefinitionsDialog.value?.open()
  }

  /**
   * Creates and commits a definition, advancing the acknowledgement only after durable commit success.
   * @param request New field values from the dialog.
   * @returns A promise that resolves after the attempt; failures are exposed in fieldDefinitionError.
   */
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

  /**
   * Applies only changed definition properties to a candidate workspace.
   * Destructive option changes reach this helper after affected assignments are confirmed for clearing.
   * @param currentWorkspace Workspace candidate to update.
   * @param request Submitted name, options, and applicability.
   * @returns Updated workspace; no persistence or draft acknowledgement occurs here.
   * @throws If the definition disappeared or any domain update is invalid.
   */
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

  /**
   * Applies and commits a confirmed field edit, preserving the draft if the write fails.
   * @param request Confirmed field-definition values.
   * @returns A promise that resolves after the attempt; failures populate fieldDefinitionError.
   */
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

  /**
   * Removes a definition and its assigned values after the dialog's confirmation step.
   * @param fieldId Definition selected for removal.
   * @returns A promise that resolves after the attempt; failures populate fieldDefinitionError.
   */
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
