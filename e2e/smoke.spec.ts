import { test, expect } from '@playwright/test'

test('connect, add liquidity, positions, two-leg backtest', async ({ page }) => {
  await page.goto('/markets')
  await expect(page.getByRole('heading', { name: 'Markets', exact: true })).toBeVisible()
  await expect(page.getByText('ETH/USDC').first()).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: 'Connect Wallet' }).click()
  await page.getByRole('button', { name: /MetaMask/ }).click()
  await expect(page.getByRole('button', { name: /0x7A3f/ })).toBeVisible()

  await page.locator('table').first().getByRole('button', { name: 'Add liquidity' }).first().click()
  await expect(page.getByRole('heading', { name: 'Add concentrated liquidity' })).toBeVisible()

  const canvas = page.locator('.range-canvas')
  await expect(canvas).toBeVisible()
  const box = await canvas.boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.35)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.28)
    await page.mouse.up()
  }

  await page.getByRole('button', { name: '15m', exact: true }).click()
  await page.getByRole('button', { name: 'Fit window' }).click()
  await page.getByRole('button', { name: /Add .*liquidity/ }).click()
  await expect(page.getByRole('heading', { name: 'Positions', exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.stat').first()).toBeVisible()

  await page.getByRole('button', { name: 'Backtest' }).click()
  await page.getByRole('button', { name: 'Run backtest' }).click()
  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('th', { hasText: 'Fees / funding' })).toBeVisible()
  const netCell = page.locator('tbody tr').filter({ hasText: /LP ·|Short ·|Long ·/ }).first().locator('td.num').last()
  await expect(netCell).toBeVisible()
})
