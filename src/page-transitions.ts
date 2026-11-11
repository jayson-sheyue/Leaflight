import './page-transitions.css';
export type TurnEffect='none'|'fade'|'slide'|'paper'|'flip'|'cube-in'|'cube-out'|'bounce'|'carousel';
type Point={x:number;y:number};
const polygon=(points:Point[])=>points.length>=3?`polygon(${points.map(p=>`${p.x}px ${p.y}px`).join(',')})`:'polygon(0 0,0 0,0 0)';
function clip(points:Point[],nx:number,ny:number,d:number,positive:boolean){const out:Point[]=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],va=nx*a.x+ny*a.y-d,vb=nx*b.x+ny*b.y-d,inside=(v:number)=>positive?v>=0:v<=0;if(inside(va))out.push(a);if(inside(va)!==inside(vb)){const t=va/(va-vb);out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}return out;}
/** Snapshot surfaces keep live text, selection, progress and chapter layout untransformed. */
export class ReaderTransition{
 readonly stage:HTMLDivElement;private old:HTMLElement;private animations:Animation[]=[];private raf=0;private cancelled=false;private width:number;private height:number;
 constructor(private effect:TurnEffect,private dir:number,source:HTMLElement){const r=source.getBoundingClientRect();this.width=source.clientWidth;this.height=source.clientHeight;this.stage=document.createElement('div');this.stage.className='page-turn-stage';this.stage.dataset.effect=effect;this.stage.setAttribute('aria-hidden','true');this.stage.inert=true;Object.assign(this.stage.style,{left:r.left+'px',top:r.top+'px',width:this.width+'px',height:this.height+'px',perspective:Math.max(1000,this.width*2.2)+'px'});const pane=source.closest('.reader-pane')!;const css=getComputedStyle(pane);for(const name of ['--reading-font','--reading-size','--reading-line','--reading-width','--page-margin'])this.stage.style.setProperty(name,css.getPropertyValue(name));const bg=css.getPropertyValue('--bg').trim(),hex=/^#([\da-f]{6})$/i.exec(bg);const rgb=hex?[parseInt(hex[1].slice(0,2),16),parseInt(hex[1].slice(2,4),16),parseInt(hex[1].slice(4,6),16)]:(css.backgroundColor||'').match(/[\d.]+/g)?.slice(0,3).map(Number)||[246,245,240];const lum=(0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2])/255;this.stage.dataset.tone=lum<.28?'dark':'light';document.body.append(this.stage);this.old=this.snapshot(source);}
 private snapshot(source:HTMLElement){
  const face=document.createElement('div');face.className='reader-pane turn-page';
  const pane=source.closest('.reader-pane') as HTMLElement;
  face.dataset.mode=pane.dataset.mode;face.dataset.ruby=pane.dataset.ruby;
  const copy=source.cloneNode(true) as HTMLElement;
  // Android hides the live scroller during the transition. Its cloned inline
  // style must not hide the incoming sheet as well.
  copy.style.visibility='visible';
  copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
  // Freeze the visible column with layout offsets, not a second composited
  // scroll position. The entire opaque sheet, including its ink, then moves.
  const prose=copy.querySelector<HTMLElement>('.prose')!;
  Object.assign(prose.style,{position:'relative',left:-source.scrollLeft+'px',top:-source.scrollTop+'px'});
  face.append(copy);this.stage.append(face);return face;
 }
 private animate(el:HTMLElement,frames:Keyframe[],duration:number,easing='cubic-bezier(.22,.66,.25,1)'){const a=el.animate(frames,{duration,easing,fill:'both'});this.animations.push(a);void a.finished.catch(()=>{});return a;}
 private shade(face:HTMLElement,frames:Keyframe[],duration:number){const shade=document.createElement('div');shade.className='turn-shade';face.append(shade);this.animate(shade,frames,duration,'ease-in-out');}
 async play(source:HTMLElement){if(this.cancelled)return;const next=this.snapshot(source),old=this.old,d=this.dir,w=this.width;next.classList.add('turn-incoming');old.classList.add('turn-outgoing');
  if(this.effect==='paper'){await this.paper(next);return;}
  if(this.effect==='cube-in'||this.effect==='cube-out'){
   const sign=this.effect==='cube-in'?-1:1,half=w/2,base=`translateZ(${-sign*half}px) scale(1)`,mid=sign>0?`translateZ(${-half}px) scale(.78)`:'translateZ(0px) scale(.66)',face=`translateZ(${sign*half}px)`;
   // Equivalent transforms on the two direct surfaces keep their hinge joined,
   // without reparenting a scrolled column into a nested compositor layer.
   this.animate(old,[{offset:0,transform:`${base} rotateY(0deg) ${face}`},{offset:.5,transform:`${mid} rotateY(${-sign*d*45}deg) ${face}`},{offset:1,transform:`${base} rotateY(${-sign*d*90}deg) ${face}`}],600,'ease-in-out');
   this.animate(next,[{offset:0,transform:`${base} rotateY(${sign*d*90}deg) ${face}`},{offset:.5,transform:`${mid} rotateY(${sign*d*45}deg) ${face}`},{offset:1,transform:`${base} rotateY(0deg) ${face}`}],600,'ease-in-out');this.shade(old,[{opacity:0},{opacity:.30}],600);this.shade(next,[{opacity:.30},{opacity:0}],600);
  }else if(this.effect==='flip'){
   this.animate(old,[{offset:0,transform:'rotateY(0deg) scale(1)',opacity:1},{offset:.5,transform:`rotateY(${-d*90}deg) scale(.94)`,opacity:1},{offset:.5001,transform:`rotateY(${-d*90}deg) scale(.94)`,opacity:0},{offset:1,transform:`rotateY(${-d*180}deg) scale(1)`,opacity:0}],600,'ease-in-out');
   this.animate(next,[{offset:0,transform:`rotateY(${d*180}deg) scale(1)`,opacity:0},{offset:.4999,transform:`rotateY(${d*90}deg) scale(.94)`,opacity:0},{offset:.5,transform:`rotateY(${d*90}deg) scale(.94)`,opacity:1},{offset:1,transform:'rotateY(0deg) scale(1)',opacity:1}],600,'ease-in-out');this.shade(old,[{opacity:0},{opacity:.22}],600);this.shade(next,[{opacity:.22},{opacity:0}],600);
  }else if(this.effect==='carousel'){
   const away=`translateX(${-d*42}%) translateZ(${-w*.48}px) rotateY(${d*48}deg) scale(.78)`,from=`translateX(${d*42}%) translateZ(${-w*.48}px) rotateY(${-d*48}deg) scale(.78)`;old.style.zIndex='1';next.style.zIndex='2';this.animate(old,[{transform:'none'},{transform:away}],620,'ease-in-out');this.animate(next,[{transform:from},{transform:'none'}],620,'ease-in-out');this.shade(old,[{opacity:0},{opacity:.2}],620);this.shade(next,[{opacity:.2},{opacity:0}],620);
  }else if(this.effect==='bounce'){
   next.style.zIndex='2';this.animate(old,[{transform:'none'},{transform:`translateX(${-d*100}%) scale(.97)`}],500);this.animate(next,[{offset:0,transform:`translateX(${d*100}%)`},{offset:.68,transform:`translateX(${-d*4}%)`},{offset:.84,transform:`translateX(${d*1.2}%)`},{offset:1,transform:'translateX(0%)'}],650,'cubic-bezier(.2,.65,.3,1)');
  }else if(this.effect==='slide'){
   this.animate(old,[{transform:'none'},{transform:`translateX(${-d*100}%)`}],440);this.animate(next,[{transform:`translateX(${d*100}%)`},{transform:'none'}],440);
  }else{
   // Fade through the paper color so two different lines never show together.
   this.animate(old,[{offset:0,opacity:1},{offset:.5,opacity:0},{offset:1,opacity:0}],360,'ease-in-out');this.animate(next,[{offset:0,opacity:0},{offset:.5,opacity:0},{offset:1,opacity:1}],360,'ease-in-out');
  }
  await Promise.all(this.animations.map(a=>a.finished.catch(()=>{})));
 }
 private async paper(next:HTMLElement){
  const w=this.width,h=this.height,forward=this.dir>0,diag=Math.hypot(w,h)*2.2,dark=this.stage.dataset.tone==='dark';
  // Forward lifts the right corner of the outgoing page over the left spine;
  // backward pulls the previous page back from the left spine onto the right.
  const under=forward?next:this.old,over=forward?this.old:next;
  under.style.zIndex='0';over.style.zIndex='2';
  const cast=document.createElement('div');cast.className='turn-paper-cast';
  const valleyWrap=document.createElement('div');valleyWrap.className='turn-paper-valley-wrap';
  const valley=document.createElement('div');valley.className='turn-paper-valley';valleyWrap.append(valley);
  const spine=document.createElement('div');spine.className='turn-paper-spine';
  const flap=document.createElement('div');flap.className='turn-paper-flap';
  const back=over.cloneNode(true) as HTMLElement;
  back.classList.remove('turn-outgoing','turn-incoming');back.classList.add('turn-paper-back');
  const roll=document.createElement('div');roll.className='turn-paper-roll';back.append(roll);flap.append(back);
  this.stage.append(cast,valleyWrap,spine,flap);
  const corners=[{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}];
  const baseLift=Math.min(w*1.12,h*1.32,(w*w/Math.max(h,w*.58))*.96);
  const clear=()=>{
   over.style.clipPath=forward?polygon([]):'';
   valleyWrap.style.clipPath=polygon([]);
   back.style.clipPath=polygon([]);
   flap.style.filter='none';
   cast.style.opacity=valley.style.opacity=spine.style.opacity='0';
  };
  const frame=(progress:number)=>{
   const u=1-progress,eased=1-u*u*(1+1.45*progress),s=forward?eased:1-eased;
   if(s<=.0002||s>=.9998){
    if(s<=.0002){over.style.clipPath='';valleyWrap.style.clipPath=polygon([]);back.style.clipPath=polygon([]);flap.style.filter='none';cast.style.opacity=valley.style.opacity=spine.style.opacity='0';}
    else clear();
    return;
   }
   const pLift=baseLift*(1.16-.36*s),dy=s*(1-s)*pLift,xc=w*(1-2*s),yc=h-dy;
   const vx=w-xc,vy=h-yc,len=Math.hypot(vx,vy),nx=vx/len,ny=vy/len;
   const mx=(w+xc)/2,my=(h+yc)/2,k=nx*mx+ny*my,deg=Math.atan2(ny,nx)*180/Math.PI;
   const arch=Math.sin(Math.PI*s),edgeFade=Math.min(1,s*14,(1-s)*14);
   const flatPoly=polygon(clip(corners,nx,ny,k,false)),liftedPoly=polygon(clip(corners,nx,ny,k,true));
   over.style.clipPath=flatPoly;valleyWrap.style.clipPath=flatPoly;back.style.clipPath=liftedPoly;
   // Reflect across the crease with gentle foreshortening for the 3D paper arch.
   const m=2-.058*arch;
   back.style.transform=`matrix(${1-m*nx*nx},${-m*nx*ny},${-m*nx*ny},${1-m*ny*ny},${m*k*nx},${m*k*ny})`;
   const rollWidth=Math.min(w,h)*(.055+.175*Math.pow(arch,.7));
   Object.assign(roll.style,{left:mx+'px',top:my+'px',width:rollWidth+'px',height:diag+'px',opacity:String(edgeFade),transform:`translateY(-50%) rotate(${deg}deg)`});
   const castWidth=12+dy*.24+rollWidth*.52;
   Object.assign(cast.style,{left:mx+'px',top:my+'px',width:castWidth+'px',height:diag+'px',opacity:String(edgeFade*(.52+.48*arch)),transform:`translateY(-50%) rotate(${deg}deg)`});
   const valleyWidth=Math.max(16,rollWidth*.5);
   Object.assign(valley.style,{left:mx+'px',top:my+'px',width:valleyWidth+'px',height:diag+'px',opacity:String(edgeFade*(.48+.52*arch)),transform:`translateY(-50%) rotate(${deg+180}deg)`});
   const spread=3+18*arch,blur=6+18*arch,alpha=(dark?.36:.15)*edgeFade*(.42+.58*arch);
   flap.style.filter=`drop-shadow(${(-nx*spread-1.5).toFixed(2)}px ${(-ny*spread+3).toFixed(2)}px ${blur.toFixed(1)}px rgba(0,0,0,${alpha.toFixed(3)}))`;
   spine.style.opacity=String(edgeFade*(.3+.7*arch));
  };
  const duration=720;
  frame(0);const clock=this.animate(this.stage,[{opacity:1},{opacity:1}],duration,'linear');const tick=()=>{if(this.cancelled)return;const p=clock.effect?.getComputedTiming().progress;frame(p==null?Math.min(1,Number(clock.currentTime||0)/duration):p);this.raf=requestAnimationFrame(tick);};tick();await clock.finished.catch(()=>{});cancelAnimationFrame(this.raf);if(!this.cancelled)frame(1);
 }
 cancel(){if(this.cancelled)return;this.cancelled=true;cancelAnimationFrame(this.raf);for(const a of this.animations)a.cancel();this.animations=[];this.stage.remove();}
}
