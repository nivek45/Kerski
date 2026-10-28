import {test,expect} from '@playwright/test';
import path from 'node:path';
test('capturas e ausência de erros de renderização',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.getByRole('heading',{level:1})).toBeVisible();
  await page.screenshot({path:path.resolve('../previews',`${info.project.name}-dark.png`),fullPage:true,caret:'initial'});
  await page.getByRole('button',{name:'Alternar tema'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.screenshot({path:path.resolve('../previews',`${info.project.name}-light.png`),fullPage:true,caret:'initial'});
  expect(errors).toEqual([]);
});
