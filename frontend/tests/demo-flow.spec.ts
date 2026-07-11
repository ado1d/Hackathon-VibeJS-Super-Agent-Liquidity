import { expect, test } from '@playwright/test'

test('scenarios A-D and the sign-out/sign-in workflow remain demonstrable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Full stateful flow runs once; mobile has a focused test.')
  const health = await page.request.get('/api/v1/health')
  test.skip(!health.ok(), 'A running backend is required for the full demo flow.')

  await page.goto('/')
  await page.getByRole('button', { name: /admin/i }).click()
  await expect(page).toHaveURL(/\/admin$/)
  for (const code of ['A', 'B', 'C', 'D']) {
    await page.getByRole('button', { name: `Load Scenario ${code}` }).click()
    await expect(page.getByText('active').first()).toBeVisible()
  }

  await page.getByRole('button', { name: /sign out/i }).click()
  await page.getByRole('button', { name: /operations/i }).click()
  await expect(page).toHaveURL(/\/operations$/)
  await page.locator('.alert-row').first().click()
  await page.getByRole('button', { name: 'Claim' }).click()
  await page.getByRole('button', { name: 'Acknowledge' }).click()
  await page.getByRole('textbox', { name: /case note/i }).fill('Approved support process confirmed in the synthetic demo.')
  await page.getByRole('button', { name: /add to timeline/i }).click()
  await page.getByRole('button', { name: 'Escalate' }).click()

  await page.getByRole('button', { name: /sign out/i }).click()
  await page.getByRole('button', { name: /^risk/i }).click()
  await expect(page).toHaveURL(/\/review-queue$/)
  await page.locator('.alert-row').first().click()
  await page.getByRole('button', { name: 'Start progress' }).click()
  await page.getByRole('button', { name: 'Resolve' }).click()
  await expect(page.getByText(/status changed/i).last()).toBeVisible()
})

test('768px layout preserves keyboard-visible scenario controls', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-768')
  const health = await page.request.get('/api/v1/health')
  test.skip(!health.ok(), 'A running backend is required for authenticated mobile coverage.')
  await page.goto('/')
  await page.getByRole('button', { name: /admin/i }).focus()
  await expect(page.getByRole('button', { name: /admin/i })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole('button', { name: 'Load Scenario A' })).toBeVisible()
})
