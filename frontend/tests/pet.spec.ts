import {test,expect} from '@playwright/test';
import {moods,poseFor,blendPose,neutral,type Mood} from '../components/pet/motion';

test('poses finitas, variação anatômica e blending estável',()=>{
  for(const mood of Object.keys(moods) as Mood[]){
    for(const t of [0,100,250,550,1100,2000,3100]){
      const pose=poseFor(mood,t,t);expect(Object.values(pose).every(Number.isFinite)).toBeTruthy();expect(pose.eye).toBeGreaterThan(0);expect(pose.sy).toBeGreaterThan(.8);
      const blended=blendPose(neutral,pose,33);for(const key of Object.keys(pose) as (keyof typeof pose)[])expect(blended[key]).toBeGreaterThanOrEqual(Math.min(neutral[key],pose[key])-.00001);
    }
  }
  expect(poseFor('confused',500,500).head).not.toBe(poseFor('happy',500,500).head);
  expect(poseFor('excited',500,500,true).y).toBe(0);
});

test('reações de link, toque, tema e teclado',async({page})=>{
  await page.goto('/');const pet=page.getByTestId('nimbo');await expect(pet).toBeVisible();
  await page.getByLabel('Link do vídeo',{exact:true}).fill('inválido');await page.getByRole('button',{name:'Analisar link'}).click();await expect(pet).toHaveAttribute('data-mood','confused');
  const actor=page.getByRole('button',{name:'Brincar com Nimbo'});await actor.focus();await page.keyboard.press('Enter');await expect(pet).toHaveAttribute('data-mood',/happy|surprised|playful|excited/);
  await page.getByRole('button',{name:'Alternar tema'}).click();await expect(pet).toHaveAttribute('data-mood','surprised');
  await page.getByLabel('Link do vídeo',{exact:true}).dispatchEvent('paste');await expect(pet).toHaveAttribute('data-mood','curious');
});

test('preferências persistentes e restauração após ocultar',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Opções do Nimbo'}).click();
  await expect(page.getByLabel('Som suave ao tocar')).not.toBeChecked();await page.getByLabel('Reduzir animações',{exact:true}).check();await page.getByLabel('Pelagem',{exact:true}).selectOption('mist');
  await page.reload();await expect(page.getByTestId('nimbo')).toHaveAttribute('data-reduced','true');await expect(page.getByTestId('nimbo')).toHaveAttribute('data-coat','mist');
  await page.getByRole('button',{name:'Minimizar Nimbo'}).click();await expect(page.getByRole('button',{name:'Brincar com Nimbo'})).toHaveCount(0);
  await page.getByRole('button',{name:'Restaurar Nimbo'}).click();await page.getByRole('button',{name:'Opções do Nimbo'}).click();await page.getByRole('button',{name:'Ocultar Nimbo'}).click();await page.reload();await expect(page.getByTestId('nimbo')).toHaveCount(0);
  await page.getByRole('button',{name:'Configurações',exact:true}).click();await page.getByRole('button',{name:'Mostrar Nimbo'}).click();await expect(page.getByTestId('nimbo')).toBeVisible();
});

test('movimento reduzido não mantém loop de renderização',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');const pet=page.getByTestId('nimbo');await expect(pet).toHaveAttribute('data-reduced','true');
  const before=await pet.getAttribute('data-frames');await page.waitForTimeout(1200);expect(await pet.getAttribute('data-frames')).toBe(before);
});

test('arrasto limitado e menu visível',async({page})=>{
  await page.goto('/');const actor=page.getByRole('button',{name:'Brincar com Nimbo'});await expect(actor).toBeVisible();const box=(await actor.boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,0,{steps:12});await page.mouse.up();
  const after=(await actor.boundingBox())!;expect(after.y).toBeGreaterThanOrEqual(0);expect(after.x).toBeGreaterThanOrEqual(0);
  await page.getByRole('button',{name:'Opções do Nimbo'}).click();const menu=(await page.getByRole('region',{name:'Preferências do Nimbo'}).boundingBox())!;expect(menu.y).toBeGreaterThanOrEqual(0);
  await page.getByRole('button',{name:'Fechar opções do Nimbo'}).click();await page.getByRole('button',{name:'Analisar link'}).scrollIntoViewIfNeeded();
  // Manual placement is free; hiding the pet always restores access underneath.
  await page.getByRole('button',{name:'Esconder Nimbo',exact:true}).click();
  await expect(page.getByRole('button',{name:'Analisar link'})).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('arrasto em dois eixos, persistência e setas',async({page})=>{
  await page.addInitScript(()=>{if(!localStorage.getItem('kerski.pet.v1'))localStorage.setItem('kerski.pet.v1',JSON.stringify({x:.97,y:.85,roam:false}))});
  await page.goto('/');const actor=page.getByRole('button',{name:'Brincar com Nimbo'});await expect(actor).toBeVisible();
  const before=(await actor.boundingBox())!;
  await page.mouse.move(before.x+60,before.y+60);await page.mouse.down();await page.mouse.move(before.x-40,before.y-80,{steps:10});await page.mouse.up();
  const after=(await actor.boundingBox())!;expect(after.x).toBeLessThan(before.x-50);expect(after.y).toBeLessThan(before.y-80);
  await page.reload();await expect(actor).toBeVisible();const saved=(await actor.boundingBox())!;expect(Math.abs(saved.x-after.x)).toBeLessThan(2);expect(Math.abs(saved.y-after.y)).toBeLessThan(2);
  await actor.focus();await page.keyboard.press('ArrowLeft');expect((await actor.boundingBox())!.x).toBeLessThan(saved.x);
  expect(await page.locator('body').evaluate(el=>getComputedStyle(el).paddingRight)).toBe('0px');
});

test('passeio automático, pausa e limites após redimensionar',async({page})=>{
  await page.clock.install();await page.addInitScript(()=>{localStorage.setItem('kerski.pet.v1',JSON.stringify({x:.8,y:.8,roam:true}));Math.random=()=>.2});
  await page.goto('/');const pet=page.getByTestId('nimbo');await expect(pet).toBeVisible();
  // Empty background isolates locomotion from obstacle avoidance.
  await page.addStyleTag({content:'main,header{display:none!important}'});
  const before=(await pet.boundingBox())!;await page.clock.runFor(11000);const after=(await pet.boundingBox())!;
  expect(Math.hypot(after.x-before.x,after.y-before.y)).toBeGreaterThan(20);
  await page.getByRole('button',{name:'Opções do Nimbo'}).click();await page.getByLabel('Passear pela tela').uncheck();await page.getByRole('button',{name:'Fechar opções do Nimbo'}).click();
  const stopped=(await pet.boundingBox())!;await page.clock.runFor(10000);expect((await pet.boundingBox())!.x).toBeCloseTo(stopped.x,0);
  await page.setViewportSize({width:360,height:500});const resized=(await pet.boundingBox())!;expect(resized.x).toBeGreaterThanOrEqual(0);expect(resized.x+resized.width).toBeLessThanOrEqual(360);expect(resized.y+resized.height).toBeLessThanOrEqual(500);
});

test('idle dorme e eventos de falha e conclusão têm prioridade',async({page})=>{
  await page.clock.install();await page.goto('/');const pet=page.getByTestId('nimbo');await expect(pet).toBeVisible();
  await page.clock.fastForward(51000);await page.clock.fastForward(6000);await expect(pet).toHaveAttribute('data-mood','sleepy');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('kerski:pet',{detail:'failed'})));await expect(pet).toHaveAttribute('data-mood','sad');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('kerski:pet',{detail:'done'})));await expect(pet).toHaveAttribute('data-mood','excited');
});

test('todas as poses e pausa quando a aba fica oculta',async({page})=>{
  await page.goto('/');const pet=page.getByTestId('nimbo');await expect(pet).toBeVisible();
  for(const [event,mood] of [['link','curious'],['identified','happy'],['done','excited'],['invalid','confused'],['failed','sad'],['theme','surprised'],['cancel','idle']]){
    await page.evaluate(event=>window.dispatchEvent(new CustomEvent('kerski:pet',{detail:event})),event);await expect(pet).toHaveAttribute('data-mood',mood);
  }
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))});const frames=await pet.getAttribute('data-frames');await page.waitForTimeout(300);expect(await pet.getAttribute('data-frames')).toBe(frames);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))});await expect.poll(()=>pet.getAttribute('data-frames')).not.toBe(frames);
});
