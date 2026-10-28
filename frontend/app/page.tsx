'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUpRight, AudioLines, Check, ChevronDown, Clipboard, Download, Film, Layers2, Link as LinkIcon, LoaderCircle, Monitor, Moon, Settings2, ShieldCheck, Sun, Video, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import { notifyPet } from '@/components/pet/events';
const Nimbo = dynamic(() => import('@/components/pet/nimbo'), { ssr: false });

type Format = {id:string; ext:string; video:boolean; audio:boolean; height:number|null; fps:number|null; hdr:string|null; vcodec:string; acodec:string; bitrate:number|null; size:number|null};
type Media = {title:string; platform:string; url:string; duration:number; thumbnail:string|null; formats:Format[]};
type Job = {id:string; status:string; error?:string; result?:Media; percent:number|null; stream_percent?:number|null; stream?:number; stream_count?:number; downloaded:number; total?:number|null; speed:number|null; expires_at:number; files:{name:string;size:number}[]};
type Mode = 'combined'|'video'|'audio'|'separate';
const modes = [{id:'combined',label:'Vídeo + áudio',icon:Film},{id:'video',label:'Só vídeo',icon:Video},{id:'audio',label:'Só áudio',icon:AudioLines},{id:'separate',label:'Separados',icon:Layers2}] as const;
const states:Record<string,string> = {queued:'Na fila de processamento',analyzing:'Consultando os formatos na fonte',downloading:'Baixando os arquivos',processing:'Preparando seu arquivo',ready:'Pronto para salvar',failed:'Não foi possível concluir',canceled:'Tarefa cancelada',expired:'Arquivo expirado'};
const bytes = (n:number|null|undefined) => !n ? '—' : n>=1024**3 ? `${(n/1024**3).toFixed(1)} GB` : `${(n/1024**2).toFixed(1)} MB`;
const duration = (n:number) => `${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;
async function api<T>(path:string, body?:unknown):Promise<T> {
  const res = await fetch(`/api${path}`,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
  const data = await res.json().catch(()=>null);
  if (!res.ok) throw Object.assign(new Error(typeof data?.detail==='string'?data.detail:'O serviço de mídia não está disponível. Tente novamente mais tarde.'),{status:res.status});
  return data;
}
function Brand(){return <a className="brand" href="/" aria-label="Kerski, início"><svg width="30" height="32" viewBox="0 0 30 32" fill="none" aria-hidden="true"><path d="M3 3h6v12L22 3h8L15 17l15 12h-9L9 19v10H3V3Z" fill="currentColor"/></svg><span>kerski</span></a>}

export default function Home(){
  const [url,setUrl]=useState(''); const [authorized,setAuthorized]=useState(false);
  const [theme,setTheme]=useState('dark'); const [themeReady,setThemeReady]=useState(false); const [settings,setSettings]=useState(false);
  const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  const [analysis,setAnalysis]=useState<Job|null>(null); const [job,setJob]=useState<Job|null>(null);
  const [mode,setMode]=useState<Mode>('combined'); const [videoId,setVideoId]=useState(''); const [audioId,setAudioId]=useState('');
  const [audioFormat,setAudioFormat]=useState('original'); const [container,setContainer]=useState('original'); const [zip,setZip]=useState(true);
  const [canceling,setCanceling]=useState(false); const [connectionError,setConnectionError]=useState('');
  const resultRef=useRef<HTMLElement>(null);
  const media=analysis?.result; const active=job || (analysis && !media ? analysis:null);
  const running=!!active && !['ready','failed','canceled','expired'].includes(active.status);
  const platform = /(^|\.)youtube\.com|youtu\.be/.test(url)?'YouTube':/instagram\.com/.test(url)?'Instagram':/tiktok\.com/.test(url)?'TikTok':null;
  useEffect(()=>{try{setTheme(localStorage.getItem('kerski.theme.v1')||'dark')}catch{}setThemeReady(true)},[]);
  useEffect(()=>{
    if(!themeReady)return;
    const system=matchMedia('(prefers-color-scheme: dark)');
    const apply=()=>{document.documentElement.dataset.theme=theme==='system'?(system.matches?'dark':'light'):theme;};
    apply(); system.addEventListener('change',apply); return ()=>system.removeEventListener('change',apply);
  },[theme,themeReady]);
  const changeTheme=(t:string)=>{notifyPet('theme');setTheme(t);try{localStorage.setItem('kerski.theme.v1',t)}catch{}};
  useEffect(()=>{if(analysis?.status==='analyzing'||analysis?.status==='queued')notifyPet('analyze');if(analysis?.status==='ready')notifyPet('identified');if(analysis?.status==='failed')notifyPet('failed');if(analysis?.status==='canceled')notifyPet('cancel')},[analysis?.status]);
  useEffect(()=>{if(job?.status==='downloading'||job?.status==='queued'||job?.status==='processing')notifyPet('download');if(job?.status==='ready')notifyPet('done');if(job?.status==='failed')notifyPet('failed');if(job?.status==='canceled')notifyPet('cancel')},[job?.status]);
  const activeId=running?active?.id:null;
  useEffect(()=>{
    if(!activeId)return;
    let stopped=false; let timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{
      try {
        const next=await api<Job>(`/jobs/${activeId}`);
        if(stopped)return;
        setConnectionError('');
        if(job?.id===activeId)setJob(next);else setAnalysis(next);
        if(['ready','failed','canceled','expired'].includes(next.status)){setCanceling(false); return;}
      }catch(e){if(!stopped){if((e as Error & {status?:number}).status===410){const expire=(j:Job|null)=>j?{...j,status:'expired',error:(e as Error).message}:j;if(job?.id===activeId)setJob(expire);else setAnalysis(expire);return;}setConnectionError((e as Error).message);}}
      if(!stopped)timer=setTimeout(poll,1200);
    };
    poll(); return ()=>{stopped=true;clearTimeout(timer)};
  },[activeId,job?.id]);
  useEffect(()=>{if(media)resultRef.current?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'})},[media]);
  async function analyze(e:React.FormEvent){
    e.preventDefault();setError('');
    try{const parsed=new URL(url);if(parsed.protocol!=='https:'||!['youtube.com','www.youtube.com','m.youtube.com','youtu.be','instagram.com','www.instagram.com','tiktok.com','www.tiktok.com','vm.tiktok.com','vt.tiktok.com'].includes(parsed.hostname))throw Error();}catch{notifyPet('invalid');setError('Cole um link HTTPS válido de um vídeo do YouTube, TikTok ou Instagram.');return;}
    if(!authorized){notifyPet('invalid');setError('Confirme que você tem permissão para baixar este conteúdo.');return;}
    setBusy(true);setJob(null);setAnalysis(null);setConnectionError('');
    try{const data=await api<{id:string}>('/analyses',{url,authorized});setAnalysis({id:data.id,status:'queued',percent:null,downloaded:0,speed:null,expires_at:0,files:[]});setVideoId('');setAudioId('');}
    catch(e){notifyPet('failed');setError((e as Error).message)}finally{setBusy(false)}
  }
  async function start(){
    if(!analysis)return;setBusy(true);setError('');setConnectionError('');
    try{const data=await api<{id:string}>('/downloads',{analysis_id:analysis.id,mode,video_id:videoId||null,audio_id:audioId||null,audio_format:audioFormat,container,zip});setJob({id:data.id,status:'queued',percent:null,downloaded:0,speed:null,expires_at:0,files:[]});}
    catch(e){notifyPet('failed');setError((e as Error).message)}finally{setBusy(false)}
  }
  async function cancel(){if(!active)return;setCanceling(true);try{await api(`/jobs/${active.id}/cancel`,{})}catch(e){setError((e as Error).message);setCanceling(false)}}
  async function paste(){try{setUrl((await navigator.clipboard.readText()).trim());setError('');notifyPet('link')}catch{setError('O navegador não liberou a área de transferência. Cole o link no campo com Ctrl+V.')}}
  const videos=media?.formats.filter(f=>f.video).sort((a,b)=>(b.height||0)-(a.height||0))||[];
  const audios=media?.formats.filter(f=>f.audio).sort((a,b)=>Number(a.video)-Number(b.video)||(b.bitrate||0)-(a.bitrate||0))||[];
  return <>
    <a className="skip" href="#link">Ir para o campo de link</a>
    <header className="header"><Brand/><nav aria-label="Navegação principal"><a href="#como-funciona">Como funciona</a><span className="header-divider"/><Button variant="ghost" size="icon" aria-label="Alternar tema" onClick={()=>changeTheme(theme==='dark'?'light':'dark')}><Sun size={18} className="sun"/><Moon size={18} className="moon"/></Button><Button variant="ghost" size="icon" aria-label="Configurações" aria-expanded={settings} onClick={()=>setSettings(!settings)}><Settings2 size={18}/></Button></nav></header>
    {settings?<section className="settings" aria-label="Configurações de aparência"><div className="section-heading"><h2>Aparência</h2><Button variant="ghost" size="icon" aria-label="Fechar configurações" onClick={()=>setSettings(false)}><X size={18}/></Button></div><div className="theme-options">{[{id:'dark',name:'Escuro',icon:Moon},{id:'light',name:'Claro',icon:Sun},{id:'system',name:'Sistema',icon:Monitor}].map(t=><button key={t.id} onClick={()=>changeTheme(t.id)} aria-pressed={theme===t.id}><t.icon size={17}/>{t.name}</button>)}</div><button className="pet-show" onClick={()=>{notifyPet('show');setSettings(false)}}>Mostrar Nimbo</button></section>:null}
    <Nimbo/><main>
      <section className="hero" aria-labelledby="hero-title">
        <div className="intro-label"><span className="tiny-mark"/>Menos etapas. Mais possibilidades.</div>
        <h1 id="hero-title">Sua mídia,<br/>na melhor versão.</h1>
        <p className="hero-description">Do link ao arquivo. Baixe vídeos e áudios na qualidade<br className="desktop-break"/> que a fonte oferece, do seu jeito.</p>
        <form className="link-form" onSubmit={analyze}>
          <label className="sr-only" htmlFor="link">Link do vídeo</label>
          <div className="input-bar"><LinkIcon size={21} aria-hidden="true"/><input id="link" type="text" inputMode="url" autoComplete="off" spellCheck={false} value={url} onChange={e=>setUrl(e.target.value)} onPaste={()=>notifyPet('link')} placeholder="Cole o link do vídeo aqui" disabled={busy||running}/><Button type="button" variant="ghost" onClick={paste} aria-label="Colar" disabled={busy||running} className="paste"><Clipboard size={16}/><span>Colar</span></Button><Button type="submit" disabled={busy||running}>{busy||running?<LoaderCircle size={18} className="spin"/>:<ArrowDown size={18}/>}<span>Analisar link</span></Button></div>
          <div className="source-line"><span>{platform?`Link do ${platform} identificado`:'YouTube, Instagram e TikTok'}</span><span>Sem instalação</span></div>
          <label className="consent"><input type="checkbox" checked={authorized} onChange={e=>setAuthorized(e.target.checked)}/>Tenho permissão para baixar este conteúdo.</label>
        </form>
        {error?<div className="notice error" role="alert">{error}</div>:null}
        {!media&&analysis?.status==='failed'?<div role="alert" className="notice error">{analysis.error}</div>:null}
        {!media&&analysis?.status==='canceled'?<p role="status" className="notice">Análise cancelada. Você pode tentar outro link.</p>:null}
      </section>
      {media?<section className="workspace" ref={resultRef} aria-label="Opções de download">
        <div className="media-summary">{media.thumbnail?<img src={media.thumbnail} alt="Prévia do vídeo" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display='none'}}/>:<div className="thumbnail-placeholder"><Film size={32}/></div>}<div><span className="source-badge">{media.platform}<span/>{duration(media.duration)}</span><h2>{media.title}</h2><a href={media.url} target="_blank" rel="noreferrer">Abrir original<ArrowUpRight size={14}/></a></div><span className="quality-badge">{videos.length?`${Math.max(...videos.map(f=>f.height||0))}p`:'Áudio'}<small>disponível</small></span></div>
        <fieldset disabled={busy||running} className="download-fields"><legend>Como você quer salvar?</legend><div className="mode-grid">{modes.map(m=><button key={m.id} type="button" onClick={()=>setMode(m.id)} aria-pressed={mode===m.id}><m.icon size={21}/><span>{m.label}</span>{mode===m.id?<Check size={14} className="selected-check"/>:null}</button>)}</div>
        <div className="selectors">{mode!=='audio'?<><label>Qualidade do vídeo<div className="select-wrap"><select value={videoId} onChange={e=>setVideoId(e.target.value)} aria-label="Qualidade do vídeo"><option value="">Melhor qualidade disponível</option>{videos.map(f=><option key={f.id} value={f.id}>{f.height?`${f.height}p`:'Original'}{f.fps?` • ${f.fps} fps`:''} • {f.vcodec}{f.hdr&&f.hdr!=='SDR'?` • ${f.hdr}`:''}</option>)}</select><ChevronDown size={14}/></div></label><label>Contêiner do vídeo<div className="select-wrap"><select value={container} onChange={e=>setContainer(e.target.value)}><option value="original">Preservar codecs (MKV)</option><option value="mkv">MKV</option><option value="mp4">MP4, se compatível</option></select><ChevronDown size={14}/></div></label></>:null}
        {mode!=='video'?<label>Qualidade do áudio<div className="select-wrap"><select value={audioId} onChange={e=>setAudioId(e.target.value)}><option value="">Melhor áudio disponível</option>{audios.map(f=><option key={f.id} value={f.id}>{f.acodec} {f.bitrate?`• ${Math.round(f.bitrate)} kbps`:''}{f.video?' • extraído do vídeo':''}</option>)}</select><ChevronDown size={14}/></div></label>:null}
        {mode==='audio'||mode==='separate'?<label>Formato do áudio<div className="select-wrap"><select value={audioFormat} onChange={e=>setAudioFormat(e.target.value)}>{['original','m4a','mp3','opus','wav','flac'].map(f=><option key={f} value={f}>{f==='original'?'Original (MKA, sem conversão)':f.toUpperCase()+' — conversão'}</option>)}</select><ChevronDown size={14}/></div></label>:null}</div>
        {mode==='separate'?<label className="consent"><input type="checkbox" checked={zip} onChange={e=>setZip(e.target.checked)}/>Incluir também um ZIP com os dois arquivos</label>:null}
        <p className="format-note">{(mode==='audio'||mode==='separate')&&audioFormat!=='original'?'Este formato exige conversão. WAV e FLAC não recuperam detalhes ausentes na fonte.':'Os codecs originais são preservados. Nenhuma resolução é aumentada artificialmente.'}</p>
        <div className="download-action"><span><ShieldCheck size={16}/>Arquivos temporários por até 1 hora</span><Button type="button" onClick={start}><Download size={18}/>{job?.status==='ready'?'Baixar novamente':mode==='audio'?'Preparar áudio':mode==='separate'?'Preparar arquivos':'Preparar vídeo'}</Button></div></fieldset>
      </section>:null}
      {active?<section className="progress-panel" aria-live="polite"><div className="section-heading"><h2>{states[active.status]||active.status}</h2>{running?<Button variant="ghost" onClick={cancel} disabled={canceling}>{canceling?'Cancelando…':'Cancelar'}<X size={15}/></Button>:active.status==='ready'?<Check size={20}/>:null}</div>
        {running?<><progress max="100" value={active.stream_percent??undefined} aria-label="Progresso do fluxo atual"/><p>{active.status==='downloading'?`Fluxo ${active.stream||1} de ${active.stream_count||1} · ${bytes(active.downloaded)}${active.total?` de ${bytes(active.total)}`:""}${active.speed?` · ${bytes(active.speed)}/s`:''}`:'O tempo depende da fonte e do tamanho do arquivo.'}{active.stream_percent!=null?` · ${active.stream_percent.toFixed(0)}%`:''}</p></>:null}
        {connectionError?<p role="alert" className="error">{connectionError} Tentando reconectar…</p>:null}
        {active.error?<p role="alert">{active.error}</p>:null}
        {active.status==='ready'?<div className="file-list">{active.files.map((file,i)=><a key={file.name} href={`/api/jobs/${active.id}/files/${i}`} download><Download size={18}/><span>{file.name}<small>{bytes(file.size)}</small></span><ArrowDown size={17}/></a>)}<p>Disponível até {new Date(active.expires_at*1000).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}.</p></div>:null}
      </section>:null}
      <section className="possibilities" aria-labelledby="possibilities-title"><div className="section-intro"><h2 id="possibilities-title">Um link. Quatro possibilidades.</h2><p>Você escolhe o que fica.</p></div><div className="feature-grid">{[{icon:Film,title:'A experiência completa',description:'Vídeo e áudio juntos, prontos para assistir.',tag:'Vídeo + áudio'},{icon:Video,title:'Só a imagem importa',description:'O vídeo original, sem a faixa de áudio.',tag:'Somente vídeo'},{icon:AudioLines,title:'Leve apenas o som',description:'A melhor faixa de áudio que a fonte oferece.',tag:'Somente áudio'},{icon:Layers2,title:'Liberdade para criar',description:'Vídeo e áudio separados para seu próximo projeto.',tag:'Arquivos separados'}].map(f=><article key={f.title}><f.icon size={26} strokeWidth={1.4}/><h3>{f.title}</h3><p>{f.description}</p><span>{f.tag}</span></article>)}</div></section>
      <section className="how" id="como-funciona"><h2>Do link ao seu arquivo.</h2><ol><li><span>01</span><div><h3>Cole o link</h3><p>Use um vídeo público que você tenha autorização para baixar.</p></div></li><li><span>02</span><div><h3>Escolha sua versão</h3><p>Confira os formatos reais e escolha vídeo, áudio ou os dois.</p></div></li><li><span>03</span><div><h3>Salve e pronto</h3><p>Acompanhe o processamento e salve o arquivo no seu dispositivo.</p></div></li></ol></section>
      <section className="honest"><ShieldCheck size={22}/><p><strong>Qualidade real. Sem promessas impossíveis.</strong> A disponibilidade depende de cada fonte. Conteúdos privados, protegidos ou bloqueados não são contornados.</p></section>
    </main><footer><Brand/><span>Feito para simplificar o caminho.</span><a href="#link">Voltar ao início <ArrowUpRight size={14}/></a></footer>
  </>;
}
