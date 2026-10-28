import {test,expect,type Page} from '@playwright/test';
const analysisId='a'.repeat(43),downloadId='b'.repeat(43);
const formats=[{id:'4k',video:true,audio:false,height:2160,fps:60,vcodec:'vp9',acodec:'none'},{id:'720',video:true,audio:false,height:720,fps:30,vcodec:'h264',acodec:'none'},{id:'audio',video:false,audio:true,acodec:'opus',bitrate:160}];
async function analyzed(page:Page){
  await page.route('**/api/analyses',r=>r.fulfill({json:{id:analysisId}}));
  await page.route(`**/api/jobs/${analysisId}`,r=>r.fulfill({json:{id:analysisId,status:'ready',result:{title:'Mídia autorizada de teste',platform:'YouTube',url:'https://youtu.be/abcdefghijk',duration:60,thumbnail:null,formats},files:[]}}));
  await page.goto('/');
  await page.getByLabel('Link do vídeo',{exact:true}).fill('https://youtu.be/abcdefghijk');
  await page.getByLabel('Tenho permissão').check();
  await page.getByRole('button',{name:'Analisar link'}).click();
  await expect(page.getByRole('heading',{name:'Mídia autorizada de teste'})).toBeVisible();
}
test('URL inválida, tema e persistência',async({page})=>{
  await page.goto('/');await page.getByLabel('Link do vídeo',{exact:true}).fill('https://127.0.0.1/');
  await page.getByRole('button',{name:'Analisar link'}).click();await expect(page.locator('main').getByRole('alert')).toContainText('link HTTPS válido');
  await page.getByRole('button',{name:'Alternar tema'}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.getByRole('button',{name:'Configurações',exact:true}).click();await page.getByRole('button',{name:'Sistema',exact:true}).click();
  await expect(page.getByRole('button',{name:'Sistema',exact:true})).toHaveAttribute('aria-pressed','true');
});
for(const mode of ['Vídeo + áudio','Só vídeo','Só áudio','Separados'])test(`fluxo ${mode}`,async({page})=>{
  await analyzed(page);await page.getByRole('button',{name:mode,exact:true}).click();
  if(mode!=='Só áudio')await page.getByLabel('Qualidade do vídeo',{exact:true}).selectOption('720');
  if(mode==='Só áudio'||mode==='Separados')await page.getByLabel('Formato do áudio').selectOption('mp3');
  await page.route('**/api/downloads',async route=>{const body=route.request().postDataJSON();expect(body.mode).toBe({'Vídeo + áudio':'combined','Só vídeo':'video','Só áudio':'audio','Separados':'separate'}[mode]);await route.fulfill({json:{id:downloadId}})});
  await page.route(`**/api/jobs/${downloadId}`,r=>r.fulfill({json:{id:downloadId,status:'ready',expires_at:Date.now()/1000+3600,files:[{name:'teste.mp4',size:1024}]}}));
  await page.getByRole('button',{name:/Preparar (vídeo|áudio|arquivos)/}).click();await expect(page.getByRole('link',{name:/teste.mp4/})).toBeVisible();await expect(page.getByRole('button',{name:'Baixar novamente'})).toBeEnabled();await expect(page.getByTestId('nimbo')).toHaveAttribute('data-mood','excited');
});
test('cancelamento e erro da plataforma',async({page})=>{
  await analyzed(page);let canceled=false;
  await page.route('**/api/downloads',r=>r.fulfill({json:{id:downloadId}}));
  await page.route(`**/api/jobs/${downloadId}`,r=>r.fulfill({json:{id:downloadId,status:canceled?'canceled':'downloading',downloaded:100,stream_percent:null,files:[]}}));
  await page.route(`**/api/jobs/${downloadId}/cancel`,r=>{canceled=true;return r.fulfill({json:{cancel_requested:true}})});
  await page.getByRole('button',{name:'Preparar vídeo'}).click();await page.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(page.getByRole('heading',{name:'Tarefa cancelada'})).toBeVisible();
  await page.route('**/api/analyses',r=>r.fulfill({status:503,json:{detail:'A fonte está temporariamente indisponível.'}}));
  await page.getByRole('button',{name:'Analisar link'}).click();await expect(page.locator('main').getByRole('alert')).toContainText('temporariamente indisponível');
});
test('colar link e layout sem overflow',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{readText:async()=> 'https://youtu.be/abcdefghijk'}}));
  await page.goto('/');await page.getByRole('button',{name:'Colar',exact:true}).click();await expect(page.getByLabel('Link do vídeo',{exact:true})).toHaveValue('https://youtu.be/abcdefghijk');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
