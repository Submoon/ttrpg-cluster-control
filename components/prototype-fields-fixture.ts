import type { CustomFieldDefinition, CustomFieldValue, LocalWorkspace } from '../domain/workspace'

/** Builds an opt-in memory-only catalogue fixture from the current prototype seed. */
export function createDenseFieldsFixture(workspace: LocalWorkspace): LocalWorkspace {
  const dense = JSON.parse(JSON.stringify(workspace)) as LocalWorkspace
  const additions: CustomFieldDefinition[] = Array.from({ length: 32 }, (_, index) => {
    const number = String(index + 1).padStart(2, '0')
    const longName = index % 8 === 7 ? `Long-term operational readiness and cross-system review note ${number}` : ''
    const id = `prototype-dense-${number}`
    const name = longName || `Survey field ${number}`
    const type = (['text', 'number', 'boolean', 'single-select'] as const)[index % 4]!
    const familyTarget = () => {
      const systemIndex = Math.floor((index / 5) % dense.cluster.systems.length)
      const object = dense.cluster.systems[systemIndex]!.objects[0]!
      return { kind: 'subtype' as const, family: object.family, subtype: object.subtype }
    }
    if (type === 'single-select') return { id, name, type, options: [`Status ${number} · pending`, `Status ${number} · verified`, `Status ${number} · archived`], ...(index % 5 === 0 ? { applicability: [familyTarget()] } : {}) }
    if (index % 5 === 0) {
      return { id, name, type, applicability: [familyTarget()] }
    }
    return { id, name, type }
  })
  dense.objectFieldSettings.customFields.push(...additions)

  for (const [fieldIndex, field] of additions.entries()) {
    let objectIndex = 0
    for (const system of dense.cluster.systems) {
      for (const object of system.objects) {
        object.customFieldValues ??= {}
        let value: CustomFieldValue
        switch (field.type) {
          case 'number': value = fieldIndex + objectIndex + 1; break
          case 'boolean': value = (fieldIndex + objectIndex) % 2 === 0; break
          case 'single-select': value = field.options[(fieldIndex + objectIndex) % field.options.length]!; break
          default: value = `Sample ${field.id} · ${system.name}`
        }
        object.customFieldValues[field.id] = value
        objectIndex += 1
      }
    }
  }
  return dense
}
