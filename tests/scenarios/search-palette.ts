import { expect, type Locator } from '@playwright/test'

/** Checks that keyboard exploration highlights an option while DOM focus stays on the Palette input. */
export async function expectPaletteOptionActive(query: Locator, option: Locator): Promise<void> {
  await expect(query).toBeFocused()
  const optionId = await option.getAttribute('id')
  if (!optionId) throw new Error('The active Palette option has no DOM id.')
  await expect(query).toHaveAttribute('aria-activedescendant', optionId)
}
