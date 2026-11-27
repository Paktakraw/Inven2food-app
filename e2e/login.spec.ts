import { expect, test } from '@playwright/test'
import { loginAs } from './support/auth'
import { resetData } from './support/seed'
import { th } from '../src/lib/th'

test.beforeEach(async () => {
  await resetData()
})

test('unauthenticated visit to / redirects to /login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
})

test('login with test user lands on / and shows six Thai nav names', async ({ page }) => {
  await loginAs(page)
  const nav = page.locator('nav')
  for (const name of Object.values(th.nav)) {
    await expect(nav.getByRole('link', { name, exact: true })).toBeVisible()
  }
  await expect(page).toHaveTitle('Inven2Food')
})

test('wrong password shows a Thai error', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL!)
  await page.getByLabel('Password').fill('wrong-password')
  await page.locator('button[type="submit"]').click()
  await expect(page.locator('form [role="alert"]')).toHaveText(th.errors.INVALID_CREDENTIALS)
  await expect(page).toHaveURL(/\/login$/)
})
