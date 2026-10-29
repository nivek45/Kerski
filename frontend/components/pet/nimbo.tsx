'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Minus,MoreHorizontal,PawPrint,RotateCcw,X} from 'lucide-react';
import {Character} from './character';
import {blendPose,moods,neutral,poseFor,type Mood,type Pose} from './motion';
import {PET_EVENT,type PetEvent} from './events';
import {useWander} from './wander';
import './pet.css';

type Preferences={mode:'full'|'mini'|'hidden';size:'small'|'normal';reduced:boolean;sound:boolean;coat:'graphite'|'mist';x:number;y:number;roam:boolean};
const defaults:Preferences={mode:'full',size:'normal',reduced:false,sound:false,coat:'graphite',x:.97,y:.94,roam:true};
const labels:Record<Mood,string>={idle:'Observando',walking:'Passeando',curious:'Curioso',happy:'Contente',excited:'Comemorando',confused:'Intrigado',sad:'Um pouco triste',sleepy:'Cochilando',surprised:'Surpreso',playful:'Brincando'};
const reactions:Partial<Record<PetEvent,Mood>>={link:'curious',analyze:'curious',identified:'happy',download:'curious',done:'excited',invalid:'confused',failed:'sad',theme:'surprised',cancel:'idle'};
function readPreferences():Preferences{
  try{const p=JSON.parse(localStorage.getItem('kerski.pet.v1')||'{}');return {mode:['full','mini','hidden'].includes(p.mode)?p.mode:'full',size:p.size==='small'?'small':'normal',reduced:p.reduced===true,sound:p.sound===true,coat:p.coat==='mist'?'mist':'graphite',x:typeof p.x==='number'&&Number.isFinite(p.x)?Math.max(0,Math.min(1,p.x)):.97,y:typeof p.y==='number'&&Number.isFinite(p.y)?Math.max(0,Math.min(1,p.y)):(matchMedia('(max-width: 900px)').matches?.18:.94),roam:p.roam!==false}}catch{return {...defaults}}
}

export default function Nimbo(){
  const [prefs,setPrefs]=useState<Preferences>(defaults);const [ready,setReady]=useState(false);const [menu,setMenu]=useState(false);const [mood,setMood]=useState<Mood>('idle');
  const [systemReduced,setSystemReduced]=useState(false);const [dragging,setDragging]=useState(false);
  const station=useRef<HTMLElement>(null);const stage=useRef<HTMLButtonElement>(null);const prefsRef=useRef(prefs);
  const trigger=useRef<(m:Mood,force?:boolean)=>void>(()=>{});const look=useRef({x:0,y:0});const activity=useRef(0);const busy=useRef(false);
  const drag=useRef<{id:number;x:number;y:number;originX:number;originY:number;moved:boolean}|null>(null);const lastTouch=useRef(-Infinity);const petting=useRef({x:0,y:0,time:0,distance:0});const audio=useRef<AudioContext|null>(null);
  const reduced=prefs.reduced||systemReduced;
  const wander=useWander(station,{ready,mode:prefs.mode,x:prefs.x,y:prefs.y,roam:prefs.roam,reduced,paused:dragging||menu||busy.current,mood},trigger,activity);
  useEffect(()=>{setPrefs(readPreferences());setReady(true);activity.current=performance.now();const mq=matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setSystemReduced(mq.matches);change();mq.addEventListener('change',change);return()=>mq.removeEventListener('change',change)},[]);
  useEffect(()=>{prefsRef.current=prefs;if(!ready)return;try{localStorage.setItem('kerski.pet.v1',JSON.stringify(prefs))}catch{}document.body.dataset.pet=prefs.mode;return()=>{delete document.body.dataset.pet}},[prefs,ready]);
  useEffect(()=>{
    const receive=(event:Event)=>{const type=(event as CustomEvent<PetEvent>).detail;if(type==='show'){setPrefs(p=>({...p,mode:'full'}));return;}activity.current=performance.now();if(type==='analyze'||type==='download')busy.current=true;if(['done','identified','failed','cancel','invalid'].includes(type))busy.current=false;const state=reactions[type];if(state)trigger.current(state,true)};
    window.addEventListener(PET_EVENT,receive);return()=>window.removeEventListener(PET_EVENT,receive);
  },[]);
  useEffect(()=>()=>{void audio.current?.close()},[]);
  useEffect(()=>{
    if(!ready||prefs.mode!=='full'||!stage.current)return;
    const elements:Record<string,SVGElement>={};stage.current.querySelectorAll<SVGElement>('[data-joint]').forEach(el=>elements[el.dataset.joint!]=el);
    let current:Mood='idle',started=performance.now(),lastFrame=0,raf=0,frameCount=0;let pose:Pose={...neutral};let blinkAt=started+2500+Math.random()*2000;let blinkStart=-1000;let nextPlay=started+24000+Math.random()*18000;
    const rotate=(joint:string,angle:number,x:number,y:number)=>elements[joint]?.setAttribute('transform',`rotate(${angle.toFixed(2)} ${x} ${y})`);
    const draw=(now:number,immediate=false)=>{
      const target=poseFor(current,now-started,now,reduced);pose=immediate||reduced?target:blendPose(pose,target,now-lastFrame||33);
      if(!reduced&&now>=blinkAt){blinkStart=now;blinkAt=now+2700+Math.random()*4800}
      const blink=!reduced&&now-blinkStart<150?1-Math.sin((now-blinkStart)/150*Math.PI)*.96:1;
      const eye=Math.max(.04,pose.eye*blink);
      elements.body.setAttribute('transform',`translate(0 ${pose.y.toFixed(2)}) translate(109 196) rotate(${pose.tilt.toFixed(2)}) scale(${pose.sx.toFixed(3)} ${pose.sy.toFixed(3)}) translate(-109 -196)`);
      rotate('head',pose.head+(!reduced?look.current.x*2:0),109,133);rotate('earL',pose.earL,79,66);rotate('earR',pose.earR,139,68);
      rotate('armL',pose.armL,76,144);rotate('armR',pose.armR,139,144);rotate('tail',pose.tail,143,184);
      rotate('footL',pose.foot,88,197);rotate('footR',-pose.foot,130,197);rotate('browL',pose.brow,85,82);rotate('browR',-pose.brow,132,82);
      for(const [key,x] of [['eyeL',85],['eyeR',132]] as const)elements[key].setAttribute('transform',`translate(${x} 100) scale(1 ${eye.toFixed(3)}) translate(${-x} -100)`);
      for(const key of ['pupilL','pupilR'])elements[key].setAttribute('transform',`translate(${reduced?0:look.current.x*3} ${reduced?0:look.current.y*2})`);
      elements.mouth.setAttribute('d',`M97 125Q109 ${125+pose.smile} 121 125`);
      elements.spark.setAttribute('opacity',String(reduced?0:pose.spark));elements.sleep.setAttribute('opacity',current==='sleepy'?'0.7':'0');
      elements.shadow.setAttribute('rx',String(58+pose.y*.5));
      frameCount++;if(station.current)station.current.dataset.frames=String(frameCount);
    };
    const react=(next:Mood,force=false)=>{
      const now=performance.now();if(!force&&current!==next&&now-started<moods[current].duration&&moods[next].priority<moods[current].priority)return;
      current=next;started=now;setMood(next);if(!document.hidden&&reduced)draw(now,true);
    };
    trigger.current=react;
    const tick=(now:number)=>{if(document.hidden||reduced)return;raf=requestAnimationFrame(tick);if(now-lastFrame<1000/30)return;draw(now);lastFrame=now};
    const visibility=()=>{cancelAnimationFrame(raf);if(!document.hidden){lastFrame=performance.now();draw(lastFrame,true);if(!reduced)raf=requestAnimationFrame(tick)}};
    const wake=()=>{activity.current=performance.now();if(current==='sleepy')react('surprised',true)};
    const follow=(e:PointerEvent)=>{wake();if(!stage.current||reduced)return;const r=stage.current.getBoundingClientRect();look.current={x:Math.max(-1,Math.min(1,(e.clientX-r.x-r.width/2)/280)),y:Math.max(-1,Math.min(1,(e.clientY-r.y-r.height/2)/240))}};
    const behavior=setInterval(()=>{
      if(document.hidden)return;const now=performance.now();
      if(current!=='walking'&&current!=='idle'&&current!=='sleepy'&&now-started>moods[current].duration)react(busy.current?'curious':'idle',true);
      if(!busy.current&&now-activity.current>50000&&current==='idle')react('sleepy',true);
      if(!busy.current&&!reduced&&current==='idle'&&now>nextPlay){nextPlay=now+26000+Math.random()*24000;react(Math.random()<.15?'surprised':'playful')}
    },1000);
    document.addEventListener('visibilitychange',visibility);window.addEventListener('pointermove',follow,{passive:true});window.addEventListener('keydown',wake,{passive:true});window.addEventListener('scroll',wake,{passive:true});visibility();
    return()=>{cancelAnimationFrame(raf);clearInterval(behavior);trigger.current=()=>{};document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pointermove',follow);window.removeEventListener('keydown',wake);window.removeEventListener('scroll',wake)};
  },[ready,prefs.mode,reduced]);

  function update(patch:Partial<Preferences>){setPrefs(p=>({...p,...patch}))}
  function chirp(){
    if(!prefsRef.current.sound)return;
    try{const ctx=audio.current||new AudioContext();audio.current=ctx;void ctx.resume();const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type='sine';oscillator.frequency.setValueAtTime(620,ctx.currentTime);oscillator.frequency.exponentialRampToValueAtTime(930,ctx.currentTime+.08);gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.025,ctx.currentTime+.02);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.16);oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start();oscillator.stop(ctx.currentTime+.17);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect()}}catch{}
  }
  function touch(){if(performance.now()-lastTouch.current<650)return;lastTouch.current=performance.now();activity.current=performance.now();const choices:Mood[]=['happy','surprised','playful'];trigger.current(Math.random()<.08?'excited':choices[Math.floor(Math.random()*choices.length)],true);chirp()}
  function down(e:React.PointerEvent<HTMLButtonElement>){if(e.button!==0)return;drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,originX:wander.point.current.x,originY:wander.point.current.y,moved:false};e.currentTarget.setPointerCapture(e.pointerId)}
  function move(e:React.PointerEvent<HTMLButtonElement>){
    const d=drag.current;
    if(d){const delta=e.clientY-d.y;if(Math.hypot(e.clientX-d.x,delta)>6){d.moved=true;setDragging(true);wander.place(d.originX+e.clientX-d.x,d.originY+delta);trigger.current('surprised');}return;}
    if(e.pointerType!=='mouse')return;const now=performance.now(),last=petting.current;const distance=Math.hypot(e.clientX-last.x,e.clientY-last.y);const gentle=now-last.time<200&&distance>1&&distance<35;
    petting.current={x:e.clientX,y:e.clientY,time:now,distance:gentle?last.distance+distance:0};if(petting.current.distance>100){trigger.current('happy');petting.current.distance=0}
  }
  function up(e:React.PointerEvent<HTMLButtonElement>){const d=drag.current;if(!d)return;drag.current=null;setDragging(false);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(d.moved){update(wander.normalized());trigger.current('happy',true);activity.current=performance.now()}else touch()}
  if(!ready||prefs.mode==='hidden')return null;
  return <aside ref={station} className={`pet-station ${prefs.mode==='mini'?'pet-mini':''}`} data-testid="nimbo" data-mood={mood} data-reduced={reduced} data-dragging={dragging} data-size={prefs.size} data-coat={prefs.coat} aria-label="Nimbo, companheiro virtual">
    {prefs.mode==='mini'?<button className="pet-restore" onClick={()=>update({mode:'full'})} aria-label="Restaurar Nimbo"><PawPrint size={17}/><span>Nimbo</span></button>:<>
      <div className="pet-name"><strong>Nimbo</strong><span>{labels[mood]}</span></div>
      <button ref={stage} className="pet-stage" aria-label="Brincar com Nimbo" title="Clique para brincar. Arraste livremente ou use as setas do teclado." onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={e=>{drag.current=null;setDragging(false);update(wander.normalized());if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}} onKeyDown={e=>{const steps:Record<string,[number,number]>={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]};const step=steps[e.key];if(step){e.preventDefault();wander.place(wander.point.current.x+step[0],wander.point.current.y+step[1]);update(wander.normalized())}}} onClick={e=>{if(e.detail===0)touch()}} onContextMenu={e=>{e.preventDefault();setMenu(true)}}><span className="pet-facing"><Character/></span></button>
      <div className="pet-controls"><button aria-label="Esconder Nimbo" onClick={()=>{setMenu(false);update({mode:'hidden'})}}><X size={14}/></button><button aria-label="Opções do Nimbo" aria-expanded={menu} aria-controls="nimbo-options" onClick={()=>setMenu(!menu)}><MoreHorizontal size={17}/></button><button aria-label="Minimizar Nimbo" onClick={()=>{setMenu(false);update({mode:'mini'})}}><Minus size={15}/></button></div>
    </>}
    {menu&&prefs.mode==='full'?createPortal(<section id="nimbo-options" className="pet-menu" aria-label="Preferências do Nimbo" onKeyDown={e=>{if(e.key==='Escape')setMenu(false)}}><div className="pet-menu-title"><strong>Do jeito dele. Do seu jeito.</strong><button aria-label="Fechar opções do Nimbo" onClick={()=>setMenu(false)}><X size={16}/></button></div><p>Carinho com o cursor. Um toque para brincar. Arraste em qualquer direção ou use as setas com o pet selecionado.</p><label>Tamanho<select aria-label="Tamanho" value={prefs.size} onChange={e=>update({size:e.target.value as Preferences['size']})}><option value="normal">Normal</option><option value="small">Pequeno</option></select></label><label>Pelagem<select aria-label="Pelagem" value={prefs.coat} onChange={e=>update({coat:e.target.value as Preferences['coat']})}><option value="graphite">Grafite</option><option value="mist">Névoa</option></select></label><label className="pet-check"><input type="checkbox" checked={prefs.roam} onChange={e=>update({roam:e.target.checked})}/>Passear pela tela</label><label className="pet-check"><input type="checkbox" checked={prefs.reduced} onChange={e=>update({reduced:e.target.checked})}/>Reduzir animações</label>{systemReduced?<p>A preferência de movimento reduzido do sistema está ativa.</p>:null}<label className="pet-check"><input type="checkbox" checked={prefs.sound} onChange={e=>update({sound:e.target.checked})}/>Som suave ao tocar</label><button className="pet-reset" onClick={()=>{update({x:.97,y:matchMedia('(max-width: 900px)').matches?.18:.94})}}><RotateCcw size={14}/>Restaurar posição</button><button className="pet-hide" onClick={()=>{setMenu(false);update({mode:'hidden'})}}>Ocultar Nimbo</button><p>Para trazê-lo de volta, abra as configurações do Kerski.</p></section>,document.body):null}
  </aside>;
}
