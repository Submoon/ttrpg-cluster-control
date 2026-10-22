/**
 * Prepares field-definition consequences before applying memory and acknowledging a session mutation.
 */
import { computed, reactive, shallowRef, watch, type Ref } from 'vue'
import {
  addCustomFieldDefinition,
  customFieldApplicabilityTargetKey,
  isCustomFieldValueCompatible,
  isLocalWorkspace,
  removeCustomFieldDefinition,
  renameCustomFieldDefinition,
  updateCustomFieldApplicability,
  updateCustomFieldType,
  updateNativeFieldOptions,
  type CustomFieldApplicabilityTarget,
  type CustomFieldDefinition,
  type CustomFieldType,
  type CustomFieldValue,
  type LocalWorkspace,
} from '../../domain/workspace'
import type {
  EntityCommand,
  FieldDefinitionDraft,
  FieldDefinitionMutationReview,
  FieldDefinitionReviewImpact,
  FieldDefinitionSnapshot,
  FieldDefinitionUpdateRequest,
  CustomFieldCreateRequest,
  FieldDefinitionsIntent,
  FieldDefinitionsSessionState,
} from './types'
import type { TransitionOptions } from './types'

interface FieldDefinitionWorkflowOptions {
  workspace: Readonly<Ref<LocalWorkspace | null>>
  applyWorkspace: (nextWorkspace: LocalWorkspace) => { durable: Promise<void> }
  resolveTransition: (options?: TransitionOptions) => Promise<boolean>
  isEntityCommandBlocked: (command: EntityCommand) => boolean
}

type FieldMutationAction =
  | { kind: 'update'; request: FieldDefinitionUpdateRequest; baseline?: FieldDefinitionSnapshot }
  | { kind: 'remove'; fieldId: string }

interface PreparedFieldMutation {
  action: FieldMutationAction
  afterApply?: FieldDefinitionsIntent
  fieldId: string
  candidate: LocalWorkspace
  review: FieldDefinitionMutationReview
  signature: string
  requiresReview: boolean
  listNeighborId: string | null
}

/**
 * Owns field-definition drafts, impact reviews, Inspector resolution, and memory-first publication.
 * @param options Workspace publication callback and Inspector-draft guard.
 * @returns Dialog state, a save acknowledgement revision, and definition commands.
 */
export function useFieldDefinitionWorkflows({
  workspace,
  applyWorkspace,
  resolveTransition,
  isEntityCommandBlocked,
}: FieldDefinitionWorkflowOptions) {
  const fieldDefinitionsSession = reactive<FieldDefinitionsSessionState>({
    open: false,
    screen: 'list',
    selectedId: null,
    draft: null,
    createDraft: null,
    pendingGuard: null,
    review: null,
    error: null,
    listPosition: { scrollTop: 0, focusedFieldId: null },
    appliedAck: 0,
  })
  const fieldDefinitionDialogOpen = computed(() => fieldDefinitionsSession.open)
  const fieldDefinitionError = computed(() => fieldDefinitionsSession.error ?? '')
  const fieldDefinitionSaveRevision = computed(() => fieldDefinitionsSession.appliedAck)
  const fieldDefinitionsDialog = shallowRef<{ open: () => void } | null>(null)
  let preparedFieldMutation: PreparedFieldMutation | null = null
  let confirmingFieldMutation = false
  let fieldMutationEpoch = 0

  function currentDefinition(fieldId: string | null): FieldDefinitionSnapshot | null {
    if (!fieldId) return null
    const currentWorkspace = workspace.value
    if (!currentWorkspace) return null
    return definitionInWorkspace(currentWorkspace, fieldId)
  }

  function definitionDraft(definition: FieldDefinitionSnapshot): FieldDefinitionDraft & { baseline: FieldDefinitionSnapshot } {
    const baseline: FieldDefinitionSnapshot = {
      ...definition,
      ...(definition.type === 'single-select' ? { options: [...definition.options] } : {}),
      ...(definition.applicability === undefined
        ? {}
        : { applicability: definition.applicability.map(target => ({ ...target })) }),
    }
    return {
      name: definition.name,
      type: definition.type,
      options: definition.type === 'single-select' ? definition.options.join('\n') : '',
      applicability: definition.applicability?.map(target => ({ ...target })),
      baseline,
    }
  }

  function emptyDefinitionDraft(): FieldDefinitionDraft {
    return { name: '', type: 'text', options: '', applicability: undefined }
  }

  function hasDefinitionChanges(): boolean {
    const draft = fieldDefinitionsSession.draft
    if (!draft) return false
    const baselineOptions = draft.baseline.type === 'single-select'
      ? draft.baseline.options.join('\n')
      : ''
    return draft.name !== draft.baseline.name
      || draft.type !== draft.baseline.type
      || draft.options !== baselineOptions
      || !sameCustomFieldApplicability(draft.applicability, draft.baseline.applicability)
  }

  function hasCreateChanges(): boolean {
    const draft = fieldDefinitionsSession.createDraft
    return !!draft && (
      draft.name !== ''
      || draft.type !== 'text'
      || draft.options !== ''
      || draft.applicability !== undefined
    )
  }

  const hasModifiedFieldDefinitionsSession = computed(() =>
    hasDefinitionChanges() || hasCreateChanges(),
  )

  function needsTransitionGuard(intent: FieldDefinitionsIntent): boolean {
    if (intent.kind === 'select-field' && intent.fieldId === fieldDefinitionsSession.draft?.baseline.id) {
      return false
    }
    if (intent.kind === 'edit-field' && intent.fieldId === fieldDefinitionsSession.draft?.baseline.id) {
      return false
    }
    if (intent.kind === 'new-field'
      && fieldDefinitionsSession.selectedId === null
      && fieldDefinitionsSession.createDraft !== null) return false
    return hasDefinitionChanges() || hasCreateChanges()
  }

  function requestNavigation(intent: FieldDefinitionsIntent): void {
    if (fieldDefinitionsSession.pendingGuard) return
    invalidatePreparedMutation()
    if (needsTransitionGuard(intent)) {
      fieldDefinitionsSession.pendingGuard = intent
      fieldDefinitionsSession.error = null
      return
    }
    completeNavigation(intent)
  }

  function discardDraftsFor(intent: FieldDefinitionsIntent): void {
    if (intent.kind === 'select-field' || intent.kind === 'edit-field') {
      if (fieldDefinitionsSession.draft?.baseline.id !== intent.fieldId) {
        fieldDefinitionsSession.draft = null
      }
      fieldDefinitionsSession.createDraft = null
      return
    }
    if (intent.kind === 'new-field') {
      fieldDefinitionsSession.draft = null
      return
    }
    fieldDefinitionsSession.draft = null
    fieldDefinitionsSession.createDraft = null
  }

  function openSession(): void {
    if (!workspace.value) return
    fieldDefinitionsSession.open = true
  }

  function beginFieldEdit(fieldId: string): void {
    const definition = currentDefinition(fieldId)
    if (!definition) return
    fieldDefinitionsSession.selectedId = fieldId
    if (fieldDefinitionsSession.draft?.baseline.id !== fieldId) {
      fieldDefinitionsSession.draft = definitionDraft(definition)
    }
    fieldDefinitionsSession.createDraft = null
    fieldDefinitionsSession.screen = 'edit'
    fieldDefinitionsSession.error = null
  }

  function completeNavigation(intent: FieldDefinitionsIntent): void {
    switch (intent.kind) {
      case 'select-field': {
        if (!currentDefinition(intent.fieldId)) return
        const resumesEdit = fieldDefinitionsSession.draft?.baseline.id === intent.fieldId
        if (!resumesEdit) {
          fieldDefinitionsSession.draft = null
        }
        fieldDefinitionsSession.selectedId = intent.fieldId
        fieldDefinitionsSession.screen = resumesEdit ? 'edit' : 'detail'
        fieldDefinitionsSession.createDraft = null
        fieldDefinitionsSession.review = null
        break
      }
      case 'edit-field':
        beginFieldEdit(intent.fieldId)
        break
      case 'new-field': {
        const startsNewDraft = fieldDefinitionsSession.createDraft === null
        if (fieldDefinitionsSession.screen !== 'new') fieldDefinitionsSession.draft = null
        fieldDefinitionsSession.selectedId = null
        fieldDefinitionsSession.screen = 'new'
        fieldDefinitionsSession.createDraft ??= emptyDefinitionDraft()
        fieldDefinitionsSession.review = null
        if (startsNewDraft) fieldDefinitionsSession.error = null
        break
      }
      case 'cancel-create':
        fieldDefinitionsSession.createDraft = null
        fieldDefinitionsSession.draft = null
        fieldDefinitionsSession.screen = 'list'
        fieldDefinitionsSession.selectedId = null
        fieldDefinitionsSession.review = null
        fieldDefinitionsSession.error = null
        break
      case 'cancel-edit':
        fieldDefinitionsSession.selectedId = fieldDefinitionsSession.draft?.baseline.id ?? fieldDefinitionsSession.selectedId
        fieldDefinitionsSession.draft = null
        fieldDefinitionsSession.screen = 'detail'
        fieldDefinitionsSession.review = null
        fieldDefinitionsSession.error = null
        break
      case 'back':
        fieldDefinitionsSession.screen = 'list'
        break
      default:
        break
    }
  }

  function handleFieldDefinitionsIntent(intent: FieldDefinitionsIntent): void {
    switch (intent.kind) {
      case 'open':
        openSession()
        return
      case 'close':
        invalidatePreparedMutation()
        fieldDefinitionsSession.open = false
        return
      case 'select-field':
      case 'edit-field':
      case 'new-field':
        requestNavigation(intent)
        return
      case 'cancel-create':
      case 'cancel-edit':
        invalidatePreparedMutation()
        completeNavigation(intent)
        return
      case 'back':
        invalidatePreparedMutation()
        completeNavigation(intent)
        return
      case 'patch-definition':
        if (fieldDefinitionsSession.draft) {
          invalidatePreparedMutation()
          Object.assign(fieldDefinitionsSession.draft, intent.patch)
          fieldDefinitionsSession.error = null
        }
        return
      case 'patch-create':
        if (fieldDefinitionsSession.createDraft) {
          invalidatePreparedMutation()
          Object.assign(fieldDefinitionsSession.createDraft, intent.patch)
          fieldDefinitionsSession.error = null
        }
        return
      case 'remember-list':
        fieldDefinitionsSession.listPosition = { ...intent.position }
        return
      case 'save-field':
        if (fieldDefinitionsSession.review || confirmingFieldMutation) return
        void saveActiveDraft()
        return
      case 'delete-field':
        if (fieldDefinitionsSession.review || confirmingFieldMutation) return
        prepareFieldDeletion(intent.fieldId)
        return
      case 'confirm-review':
        if (!confirmingFieldMutation) void confirmFieldMutationReview()
        return
      case 'resolve-transition':
        void resolvePendingGuard(intent.decision)
        return
      case 'cancel-review':
        invalidatePreparedMutation()
        fieldDefinitionsSession.error = null
        return
      default:
        return
    }
  }

  watch(workspace, () => {
    const selectedId = fieldDefinitionsSession.selectedId
    if (selectedId && !currentDefinition(selectedId)) {
      invalidatePreparedMutation()
      fieldDefinitionsSession.selectedId = null
      fieldDefinitionsSession.draft = null
      fieldDefinitionsSession.pendingGuard = null
      const validIds = workspace.value ? fieldIds(workspace.value) : []
      if (
        fieldDefinitionsSession.listPosition.focusedFieldId === selectedId
        || !validIds.includes(fieldDefinitionsSession.listPosition.focusedFieldId ?? '')
      ) {
        fieldDefinitionsSession.listPosition = {
          ...fieldDefinitionsSession.listPosition,
          focusedFieldId: validIds.find(id => id !== 'native:atmosphere') ?? null,
        }
      }
      if (fieldDefinitionsSession.screen !== 'new') fieldDefinitionsSession.screen = 'list'
    }
  }, { flush: 'sync' })

  function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  function optionsFromDraft(value: string): string[] {
    return value.split(/\r?\n/).map(option => option.trim()).filter(Boolean)
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

  function definitionInWorkspace(
    currentWorkspace: LocalWorkspace,
    fieldId: string,
  ): FieldDefinitionSnapshot | null {
    if (fieldId === 'native:atmosphere') {
      return {
        id: fieldId,
        name: 'Atmosphere',
        type: 'single-select',
        options: [...currentWorkspace.objectFieldSettings.atmosphereOptions],
      }
    }
    if (fieldId === 'native:port-class') {
      return {
        id: fieldId,
        name: 'Port class',
        type: 'single-select',
        options: [...currentWorkspace.objectFieldSettings.portClassOptions],
      }
    }
    return currentWorkspace.objectFieldSettings.customFields.find(field => field.id === fieldId) ?? null
  }

  function sameDefinitionSnapshot(first: FieldDefinitionSnapshot, second: FieldDefinitionSnapshot): boolean {
    const firstOptions = first.type === 'single-select' ? first.options : []
    const secondOptions = second.type === 'single-select' ? second.options : []
    return first.id === second.id
      && first.name === second.name
      && first.type === second.type
      && sameFieldOptions(firstOptions, secondOptions)
      && sameCustomFieldApplicability(first.applicability, second.applicability)
  }

  function invalidatePreparedMutation(): void {
    fieldMutationEpoch += 1
    preparedFieldMutation = null
    fieldDefinitionsSession.review = null
  }

  function assignedValue(object: LocalWorkspace['cluster']['systems'][number]['objects'][number], fieldId: string): CustomFieldValue | undefined {
    if (fieldId === 'native:atmosphere') return object.atmosphere
    if (fieldId === 'native:port-class') return object.portClass
    return object.customFieldValues?.[fieldId]
  }

  function mutationImpacts(
    currentWorkspace: LocalWorkspace,
    fieldId: string,
    targetType: CustomFieldType | null,
    targetOptions: string[],
    operation: 'update' | 'remove',
  ): FieldDefinitionReviewImpact[] {
    const impacts: FieldDefinitionReviewImpact[] = []
    for (const system of currentWorkspace.cluster.systems) {
      for (const object of system.objects) {
        const value = assignedValue(object, fieldId)
        if (value === undefined) continue
        const preserved = operation === 'update'
          && targetType !== null
          && isCustomFieldValueCompatible(value, targetType, targetOptions)
        impacts.push({
          systemId: system.id,
          systemName: system.name,
          objectId: object.id,
          objectName: object.name,
          value,
          ...(preserved ? { nextValue: value } : {}),
          resolution: operation === 'remove' ? 'remove' : preserved ? 'preserve' : 'clear',
        })
      }
    }
    return impacts
  }

  function fieldIds(currentWorkspace: LocalWorkspace): string[] {
    return [
      'native:atmosphere',
      'native:port-class',
      ...currentWorkspace.objectFieldSettings.customFields.map(field => field.id),
    ]
  }

  function neighborAfterRemoval(currentWorkspace: LocalWorkspace, fieldId: string): string | null {
    const currentIds = fieldIds(currentWorkspace)
    const index = currentIds.indexOf(fieldId)
    if (index < 0) return null
    const remaining = currentIds.filter(id => id !== fieldId)
    return remaining[Math.min(index, remaining.length - 1)] ?? remaining[index - 1] ?? null
  }

  function prepareFieldMutation(
    action: FieldMutationAction,
    afterApply?: FieldDefinitionsIntent,
  ): PreparedFieldMutation {
    const currentWorkspace = workspace.value
    if (!currentWorkspace) throw new Error('The workspace is no longer available.')

    let candidate = currentWorkspace
    let before: FieldDefinitionSnapshot
    let after: FieldDefinitionSnapshot | null
    let fieldId: string
    let operation: 'update' | 'remove'
    let targetType: CustomFieldType | null
    let targetOptions: string[]
    let requiresReview: boolean
    let removedOptions: string[] = []

    if (action.kind === 'remove') {
      fieldId = action.fieldId
      const definition = definitionInWorkspace(currentWorkspace, fieldId)
      if (!definition || fieldId.startsWith('native:')) {
        throw new Error('The selected custom field no longer exists.')
      }
      before = definition
      operation = 'remove'
      targetType = null
      targetOptions = []
      candidate = removeCustomFieldDefinition(currentWorkspace, fieldId)
      after = null
      requiresReview = true
    } else {
      const request = action.request
      fieldId = request.fieldId
      const definition = definitionInWorkspace(currentWorkspace, fieldId)
      if (!definition) throw new Error('The selected field definition no longer exists.')
      if (action.baseline && !sameDefinitionSnapshot(definition, action.baseline)) {
        throw new Error('This field changed while its draft was open. Reopen it before applying.')
      }
      if (request.type !== definition.type && fieldId.startsWith('native:')) {
        throw new Error('Built-in field types cannot be changed.')
      }
      if (fieldId.startsWith('native:') && request.name !== definition.name) {
        throw new Error('Built-in field names cannot be changed.')
      }

      before = definition
      operation = 'update'
      targetType = request.type
      targetOptions = request.type === 'single-select' ? request.options : []
      if (fieldId === 'native:atmosphere' || fieldId === 'native:port-class') {
        const nativeField = fieldId === 'native:atmosphere' ? 'atmosphere' : 'portClass'
        const currentOptions = nativeField === 'atmosphere'
          ? currentWorkspace.objectFieldSettings.atmosphereOptions
          : currentWorkspace.objectFieldSettings.portClassOptions
        candidate = sameFieldOptions(currentOptions, targetOptions)
          ? currentWorkspace
          : updateNativeFieldOptions(currentWorkspace, nativeField, targetOptions, true)
      } else {
        const current = currentWorkspace.objectFieldSettings.customFields.find(field => field.id === fieldId)
        if (!current) throw new Error('The selected custom field no longer exists.')
        if (request.name !== current.name) candidate = renameCustomFieldDefinition(candidate, fieldId, request.name)
        if (
          request.type !== current.type
          || (request.type === 'single-select'
            && current.type === 'single-select'
            && !sameFieldOptions(current.options, targetOptions))
        ) {
          candidate = updateCustomFieldType(candidate, fieldId, request.type, targetOptions, true)
        }
        if (!sameCustomFieldApplicability(current.applicability, request.applicability)) {
          candidate = updateCustomFieldApplicability(candidate, fieldId, request.applicability)
        }
      }
      after = definitionInWorkspace(candidate, fieldId)
      if (!after) throw new Error('The updated field definition could not be identified.')
      targetType = after.type
      targetOptions = after.type === 'single-select' ? after.options : []
      const currentOptions = definition.type === 'single-select' ? definition.options : []
      removedOptions = currentOptions.filter(option => !targetOptions.includes(option))
      requiresReview = request.type !== definition.type || removedOptions.length > 0
    }

    if (!isLocalWorkspace(candidate)) throw new Error('The proposed field change is not a valid workspace update.')
    const impacts = mutationImpacts(currentWorkspace, fieldId, targetType, targetOptions, operation)
    const review: FieldDefinitionMutationReview = {
      fieldId,
      fieldName: after?.name ?? before.name,
      operation,
      ...(after ? { fromType: before.type, toType: after.type } : {}),
      ...(removedOptions.length ? { removedOptions: [...removedOptions] } : {}),
      impacts: requiresReview ? impacts : [],
    }
    const requestSignature = action.kind === 'update'
      ? {
          ...action.request,
          options: [...action.request.options],
          applicability: action.request.applicability
            ?.map(customFieldApplicabilityTargetKey)
            .sort(),
        }
      : null
    const signature = JSON.stringify({
      action: action.kind,
      fieldId,
      request: requestSignature,
      before,
      after,
      impacts: review.impacts,
    })

    return {
      action,
      afterApply,
      fieldId,
      candidate,
      review,
      signature,
      requiresReview,
      listNeighborId: operation === 'remove' ? neighborAfterRemoval(currentWorkspace, fieldId) : null,
    }
  }

  function stagePreparedMutation(prepared: PreparedFieldMutation): void {
    preparedFieldMutation = prepared
    if (prepared.afterApply) fieldDefinitionsSession.pendingGuard = null
    fieldDefinitionsSession.review = prepared.review
    fieldDefinitionsSession.error = null
  }

  function publishPreparedMutation(prepared: PreparedFieldMutation): boolean {
    const currentWorkspace = workspace.value
    if (!currentWorkspace) return false

    let durable: Promise<void> | null = null
    if (prepared.candidate !== currentWorkspace) {
      durable = applyWorkspace(prepared.candidate).durable
      fieldDefinitionsSession.appliedAck += 1
    }

    if (prepared.action.kind === 'remove') {
      fieldDefinitionsSession.selectedId = null
      fieldDefinitionsSession.screen = 'list'
      fieldDefinitionsSession.draft = null
      fieldDefinitionsSession.createDraft = null
      fieldDefinitionsSession.pendingGuard = null
      fieldDefinitionsSession.review = null
      fieldDefinitionsSession.error = null
      fieldDefinitionsSession.listPosition = {
        ...fieldDefinitionsSession.listPosition,
        focusedFieldId: prepared.listNeighborId,
      }
    } else {
      fieldDefinitionsSession.selectedId = prepared.fieldId
      fieldDefinitionsSession.screen = 'detail'
      fieldDefinitionsSession.draft = null
      fieldDefinitionsSession.createDraft = null
      fieldDefinitionsSession.pendingGuard = null
      fieldDefinitionsSession.review = null
      fieldDefinitionsSession.error = null
    }
    preparedFieldMutation = null
    if (prepared.afterApply) completeNavigation(prepared.afterApply)
    if (durable) void durable.catch(() => undefined)
    return true
  }

  async function applyPreparedMutation(
    initial: PreparedFieldMutation,
    confirmedSignature?: string,
  ): Promise<boolean> {
    const epochAtStart = fieldMutationEpoch
    let prepared: PreparedFieldMutation
    try {
      prepared = prepareFieldMutation(initial.action, initial.afterApply)
      if (confirmedSignature && prepared.signature !== confirmedSignature) {
        stagePreparedMutation(prepared)
        return false
      }
      if (!confirmedSignature && prepared.requiresReview) {
        stagePreparedMutation(prepared)
        return false
      }

      if (isEntityCommandBlocked({ kind: 'definition-mutation', fieldId: prepared.fieldId })) {
        const accepted = await resolveTransition({ leaveChart: false, leaveRouteSession: false })
        if (!accepted) return false
        if (fieldMutationEpoch !== epochAtStart) return false
        prepared = prepareFieldMutation(initial.action, initial.afterApply)
        if (confirmedSignature && prepared.signature !== confirmedSignature) {
          stagePreparedMutation(prepared)
          return false
        }
        if (!confirmedSignature && prepared.requiresReview) {
          stagePreparedMutation(prepared)
          return false
        }
        if (isEntityCommandBlocked({ kind: 'definition-mutation', fieldId: prepared.fieldId })) {
          throw new Error('Resolve the Inspector draft before changing this field.')
        }
      }

      return publishPreparedMutation(prepared)
    } catch (error) {
      fieldDefinitionsSession.error = errorText(error)
      if (confirmedSignature) invalidatePreparedMutation()
      return false
    }
  }

  function prepareFieldDeletion(fieldId: string): void {
    if (fieldDefinitionsSession.pendingGuard) return
    invalidatePreparedMutation()
    try {
      stagePreparedMutation(prepareFieldMutation({ kind: 'remove', fieldId }))
    } catch (error) {
      fieldDefinitionsSession.error = errorText(error)
    }
  }

  async function confirmFieldMutationReview(): Promise<void> {
    const staged = preparedFieldMutation
    if (!staged || !fieldDefinitionsSession.review) return
    confirmingFieldMutation = true
    try {
      const fresh = prepareFieldMutation(staged.action, staged.afterApply)
      if (fresh.signature !== staged.signature) {
        stagePreparedMutation(fresh)
        return
      }
      await applyPreparedMutation(fresh, staged.signature)
    } catch (error) {
      fieldDefinitionsSession.error = errorText(error)
      invalidatePreparedMutation()
    } finally {
      confirmingFieldMutation = false
    }
  }

  function publishCreatedDefinition(
    request: CustomFieldCreateRequest,
    afterApply?: FieldDefinitionsIntent,
  ): boolean {
    const currentWorkspace = workspace.value
    if (!currentWorkspace) return false

    try {
      let candidate = addCustomFieldDefinition(
        currentWorkspace,
        request.name,
        request.type,
        request.options,
      )
      const oldFieldIds = new Set(currentWorkspace.objectFieldSettings.customFields.map(field => field.id))
      const createdField = candidate.objectFieldSettings.customFields.find(field => !oldFieldIds.has(field.id))
      if (!createdField) throw new Error('The new field definition could not be identified.')
      if (fieldDefinitionsSession.createDraft?.applicability !== undefined) {
        candidate = updateCustomFieldApplicability(
          candidate,
          createdField.id,
          fieldDefinitionsSession.createDraft.applicability,
        )
      }
      if (!isLocalWorkspace(candidate)) throw new Error('The proposed field is not a valid workspace update.')

      const { durable } = applyWorkspace(candidate)
      fieldDefinitionsSession.appliedAck += 1
      fieldDefinitionsSession.selectedId = createdField.id
      fieldDefinitionsSession.screen = 'detail'
      fieldDefinitionsSession.draft = null
      fieldDefinitionsSession.createDraft = null
      fieldDefinitionsSession.pendingGuard = null
      fieldDefinitionsSession.review = null
      fieldDefinitionsSession.error = null
      if (afterApply) completeNavigation(afterApply)
      void durable.catch(() => undefined)
      return true
    } catch (error) {
      fieldDefinitionsSession.error = errorText(error)
      return false
    }
  }

  /** Opens the resumable Fields session without inventing a target or resolving an object draft. */
  function openFieldDefinitions(): void {
    handleFieldDefinitionsIntent({ kind: 'open' })
  }

  function saveFieldDefinitionChanges(
    request: FieldDefinitionUpdateRequest,
    baseline?: FieldDefinitionSnapshot,
    afterApply?: FieldDefinitionsIntent,
  ): Promise<boolean> {
    let prepared: PreparedFieldMutation
    try {
      prepared = prepareFieldMutation({ kind: 'update', request, baseline }, afterApply)
      if (prepared.requiresReview) {
        stagePreparedMutation(prepared)
        if (afterApply) fieldDefinitionsSession.pendingGuard = null
        return Promise.resolve(false)
      }
    } catch (error) {
      fieldDefinitionsSession.error = errorText(error)
      return Promise.resolve(false)
    }
    return applyPreparedMutation(prepared)
  }

  async function saveActiveDraft(afterApply?: FieldDefinitionsIntent): Promise<boolean> {
    const createDraft = fieldDefinitionsSession.createDraft
    const editDraft = fieldDefinitionsSession.draft
    if (createDraft && !editDraft) {
      const request: CustomFieldCreateRequest = {
        name: createDraft.name,
        type: createDraft.type,
        options: createDraft.type === 'single-select' ? optionsFromDraft(createDraft.options) : [],
      }
      return publishCreatedDefinition(request, afterApply)
    }

    if (!editDraft) {
      fieldDefinitionsSession.error = 'Open a field for editing before applying changes.'
      return false
    }
    return saveFieldDefinitionChanges({
      fieldId: editDraft.baseline.id,
      name: editDraft.name,
      type: editDraft.type,
      options: editDraft.type === 'single-select' ? optionsFromDraft(editDraft.options) : [],
      applicability: editDraft.applicability,
    }, editDraft.baseline, afterApply)
  }

  async function resolvePendingGuard(decision: 'apply' | 'discard' | 'stay'): Promise<void> {
    const pendingIntent = fieldDefinitionsSession.pendingGuard
    if (!pendingIntent) return
    if (decision === 'stay') {
      fieldDefinitionsSession.pendingGuard = null
      return
    }
    if (decision === 'discard') {
      discardDraftsFor(pendingIntent)
      fieldDefinitionsSession.pendingGuard = null
      fieldDefinitionsSession.error = null
      completeNavigation(pendingIntent)
      return
    }

    fieldDefinitionsSession.pendingGuard = null
    if (fieldDefinitionsSession.createDraft && !fieldDefinitionsSession.draft) {
      fieldDefinitionsSession.screen = 'new'
    } else if (fieldDefinitionsSession.draft) {
      fieldDefinitionsSession.selectedId = fieldDefinitionsSession.draft.baseline.id
      fieldDefinitionsSession.screen = 'edit'
    }
    await saveActiveDraft(pendingIntent)
  }

  return {
    fieldDefinitionsSession,
    fieldDefinitionDialogOpen,
    fieldDefinitionError,
    fieldDefinitionSaveRevision,
    hasModifiedFieldDefinitionsSession,
    fieldDefinitionsDialog,
    openFieldDefinitions,
    handleFieldDefinitionsIntent,
  }
}
