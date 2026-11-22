import { expect, test } from '@playwright/test';
import { checkMobile, snap } from './helpers';

test('demo group → own group → expense → settle up', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.bal-bars').first()).toBeVisible();
  await page.waitForTimeout(1000);
  await snap(page, 'landing');
  await checkMobile(page, 'landing-mobile');

  await page.getByRole('link', { name: 'See balances' }).click();
  await expect(page.getByRole('heading', { name: /Balances/ })).toBeVisible();
  await snap(page, 'balances');
  await checkMobile(page);
  await page.getByRole('button', { name: 'Start my own group' }).click();
  await expect(page.getByText('No one in the group yet')).toBeVisible();

  await page.getByRole('link', { name: 'Add people' }).click();
  for (const n of ['Mia', 'Noah', 'Omar']) {
    await page.getByLabel('Name', { exact: true }).fill(n);
    await page.getByRole('button', { name: 'Add person' }).click();
  }
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Expenses' }).click();
  await page.getByLabel('Description').fill('Internet');
  await page.getByLabel('Amount (USD)').fill('10');
  await expect(page.getByText('$3.34')).toBeVisible(); // uneven split preview
  await page.getByRole('button', { name: 'Add expense' }).click();
  await expect(page.getByText(/Added “Internet”/)).toBeVisible();

  await page.reload();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Balances' }).click();
  await expect(page.getByTestId('bal-Mia')).toHaveText('+$6.66');
  await page.getByRole('button', { name: /^Mark Noah paid Mia/ }).click();
  await page.getByRole('button', { name: /^Mark Omar paid Mia/ }).click();
  await expect(page.getByText('Everyone is square.')).toBeVisible();
});
