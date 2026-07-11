import { expect, test } from '@playwright/test'

test('login identifies the data as synthetic', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('All transactions and identities are synthetic')).toBeVisible()
  await expect(page.getByRole('button', { name: /operations/i })).toBeVisible()
})

