import {useEffect,useRef,type RefObject} from 'react';
import type {Mood} from './motion';
export type Point={x:number;y:number};
export const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export function useWander(station:RefObject<HTMLElement|null>,config:{ready:boolean;mode:string;x:number;y:number;roam:boolean;reduced:boolean;paused:boolean;mood:Mood},react:RefObject<(m:Mood,force?:boolean)=>void>,activity:RefObject<number>){
  const point=useRef<Point>({x:0,y:0});
  const state=useRef(config);state.current=config;
  const bounds=()=>({x:Math.max(8,innerWidth-(station.current?.offsetWidth||158)-8),y:Math.max(8,innerHeight-(station.current?.offsetHeight||224)-8)});
  function place(x:number,y:number){const b=bounds();point.current={x:clamp(x,8,b.x),y:clamp(y,8,b.y)};station.current?.style.setProperty('--pet-x',`${point.current.x}px`);station.current?.style.setProperty('--pet-y',`${point.current.y}px`)}
  function normalized(){const b=bounds();return {x:point.current.x/b.x,y:point.current.y/b.y}}
  useEffect(()=>{
    if(!config.ready||config.mode!=='full')return;
    const b=bounds();place(config.x*b.x,config.y*b.y);
    const resize=()=>{const p=state.current,b=bounds();place(p.x*b.x,p.y*b.y)};
    window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);
    return()=>{window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize)};
  },[config.ready,config.mode,config.x,config.y]);
  useEffect(()=>{
    if(!config.ready||config.mode!=='full'||config.reduced||!config.roam)return;
    let raf=0,last=0,next=performance.now()+7000,target:Point|null=null;
    const blocked=(p:Point)=>{
      const el=station.current;if(!el)return true;
      const width=el.offsetWidth,height=el.offsetHeight;
      return [...document.querySelectorAll<HTMLElement>('main button,main input,main select,main a,header button')].some(control=>{
        const r=control.getBoundingClientRect();return r.width>0&&r.height>0&&p.x<r.right+8&&p.x+width>r.left-8&&p.y<r.bottom+8&&p.y+height>r.top-8;
      });
    };
    const stop=()=>{target=null;station.current?.setAttribute('data-walking','false');if(state.current.mood==='walking')react.current('idle',true)};
    const tick=(now:number)=>{
      raf=requestAnimationFrame(tick);if(now-last<33)return;const dt=Math.min((now-last)/1000,.06);last=now;
      const s=state.current,el=station.current;
      if(!el||document.hidden||s.paused||el.matches(':hover')||el.contains(document.activeElement)||now-activity.current>35000||!['idle','walking'].includes(s.mood)){stop();next=now+4000;return;}
      if(!target&&now>=next){
        const b=bounds();
        for(let i=0;i<16;i++){const candidate={x:clamp(point.current.x+(Math.random()-.5)*480,8,b.x),y:clamp(point.current.y+(Math.random()-.5)*300,8,b.y)};if(Math.hypot(candidate.x-point.current.x,candidate.y-point.current.y)>35&&!blocked(candidate)){target=candidate;break;}}
        next=now+8000+Math.random()*7000;
        if(target){react.current('walking');el.setAttribute('data-walking','true');el.style.setProperty('--pet-facing',target.x<point.current.x?'-1':'1')}
      }
      if(target){const dx=target.x-point.current.x,dy=target.y-point.current.y,distance=Math.hypot(dx,dy);const step=Math.min(distance,42*dt);const p={x:point.current.x+dx/distance*step,y:point.current.y+dy/distance*step};if(distance<2||blocked(p)){stop();next=now+6000}else place(p.x,p.y)}
    };
    const visibility=()=>{cancelAnimationFrame(raf);stop();if(!document.hidden){last=performance.now();next=last+5000;raf=requestAnimationFrame(tick)}};
    document.addEventListener('visibilitychange',visibility);visibility();
    return()=>{cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',visibility);stop()};
  },[config.ready,config.mode,config.reduced,config.roam]);
  return {point,place,normalized};
}
