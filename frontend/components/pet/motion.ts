export type Mood='idle'|'curious'|'happy'|'excited'|'confused'|'sad'|'sleepy'|'surprised'|'playful'|'walking';
export type Pose={y:number;tilt:number;sx:number;sy:number;head:number;earL:number;earR:number;armL:number;armR:number;tail:number;eye:number;smile:number;brow:number;foot:number;spark:number};
export const neutral:Pose={y:0,tilt:0,sx:1,sy:1,head:0,earL:0,earR:0,armL:0,armR:0,tail:0,eye:1,smile:4,brow:0,foot:0,spark:0};
export const moods:Record<Mood,{duration:number;priority:number}>={idle:{duration:0,priority:0},walking:{duration:30000,priority:0},curious:{duration:2600,priority:1},happy:{duration:2300,priority:2},excited:{duration:3200,priority:4},confused:{duration:2500,priority:3},sad:{duration:3000,priority:3},sleepy:{duration:0,priority:0},surprised:{duration:1900,priority:2},playful:{duration:2700,priority:1}};
const sin=Math.sin;
/** Authored pose clips with anticipation, main action and recovery; radians for wave phases. */
export function poseFor(mood:Mood,elapsed:number,time:number,reduced=false):Pose {
  const p={...neutral};
  if(reduced){
    if(mood==='sleepy'){p.eye=.08;p.head=9}
    if(mood==='happy'||mood==='excited'){p.smile=10;p.eye=.65}
    if(mood==='sad'){p.smile=-5;p.head=8;p.brow=-7}
    if(mood==='confused'){p.head=-12;p.brow=9}
    if(mood==='surprised'){p.eye=1.2;p.earL=-9;p.earR=9}
    return p;
  }
  const t=elapsed/1000;
  p.sy=1+sin(time/650)*.012;p.sx=1-sin(time/650)*.006;p.tail=sin(time/1050)*6+sin(time/430)*1.4;p.head=sin(time/2400)*2;
  const twitch=Math.pow(Math.max(0,sin(time/3600)),18);p.earL=-twitch*7;p.earR=sin(time/4200)*2;
  switch(mood){
    case 'walking':{const step=sin(t*8);p.y=-Math.abs(step)*3;p.tilt=step*3;p.foot=step*18;p.armL=-step*16;p.armR=step*16;p.head=-step*3;p.tail=sin(t*8-1)*13;p.earL=sin(t*8-.4)*4;p.earR=-p.earL;break;}
    case 'curious':p.head=-10+sin(t*2)*3;p.earL=-12;p.earR=8;p.brow=4;break;
    case 'happy':p.smile=11;p.eye=.65;p.head=sin(t*5)*5;p.tail=sin(t*10)*17;p.armL=-10;p.armR=10;break;
    case 'excited':{
      // Crouch, two asymmetric hops, landing and settle.
      const jump=t<.22?0:t<1.55?Math.abs(sin((t-.22)*Math.PI/0.66))*27*(t<.88?1:.6):0;
      p.y=-jump;p.sy=t<.22?.88:t<1.55?1.06:1;p.sx=t<.22?1.09:t<1.55?.96:1;
      p.armL=-48;p.armR=48;p.head=sin(t*6)*8;p.tail=sin(t*9)*20;p.smile=11;p.eye=.75;p.foot=jump/3;p.spark=Math.max(0,sin(Math.min(t/2,1)*Math.PI));break;
    }
    case 'confused':p.head=-16+sin(t*3)*5;p.earL=-24;p.earR=14;p.brow=10;p.smile=0;p.armR=24;break;
    case 'sad':p.head=13;p.y=4;p.sy=.96;p.eye=.65;p.smile=-6;p.earL=-22;p.earR=22;p.brow=-8;p.tail=-15;break;
    case 'sleepy':p.head=17;p.y=8;p.sy=.91+sin(time/1000)*.015;p.sx=1.07;p.eye=.05;p.smile=2;p.earL=-15;p.earR=18;p.tail=-20;break;
    case 'surprised':p.y=t<.2?3:t<.55?-14:0;p.sy=t<.2?.9:t<.55?1.12:1;p.sx=t<.2?1.06:.96;p.eye=1.24;p.earL=-16;p.earR=16;p.armL=-22;p.armR=22;p.smile=-1;break;
    case 'playful':p.tilt=sin(t*5)*10;p.head=-sin(t*5)*13;p.armL=sin(t*5)*30-10;p.armR=sin(t*5+1)*30+10;p.tail=sin(t*8)*21;p.smile=10;p.foot=sin(t*5)*6;break;
  }
  return p;
}
export function blendPose(current:Pose,target:Pose,delta:number):Pose {
  const weight=1-Math.exp(-Math.min(delta,80)/85);const next={...current};
  for(const key of Object.keys(next) as (keyof Pose)[])next[key]+= (target[key]-next[key])*weight;
  return next;
}
