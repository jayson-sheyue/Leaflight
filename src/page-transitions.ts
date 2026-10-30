import './page-transitions.css';
export type TurnEffect='none'|'fade'|'slide'|'paper'|'flip'|'cube-in'|'cube-out'|'bounce'|'carousel';
type Point={x:number;y:number};
const polygon=(points:Point[])=>points.length>=3?`polygon(${points.map(p=>`${p.x}px ${p.y}px`).join(',')})`:'polygon(0 0,0 0,0 0)';
function clip(points:Point[],nx:number,ny:number,d:number,positive:boolean){const out:Point[]=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],va=nx*a.x+ny*a.y-d,vb=nx*b.x+ny*b.y-d,inside=(v:number)=>positive?v>=0:v<=0;if(inside(va))out.push(a);if(inside(va)!==inside(vb)){const t=va/(va-vb);out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}return out;}
/** Snapshot surfaces keep live text, selection, progress and chapter layout untransformed. */
export class ReaderTransition{
 readonly stage:HTMLDivElement;private old:HTMLElement;private animations:Animation[]=[];private raf=0;private cancelled=false;private width:number;private height:number;
 constructor(private effect:TurnEffect,private dir:number,source:HTMLElement){const r=source.getBoundingClientRect();this.width=source.clientWidth;this.height=source.clientHeight;this.stage=document.createElement('div');this.stage.className='page-turn-stage';this.stage.dataset.effect=effect;this.stage.setAttribute('aria-hidden','true');this.stage.inert=true;Object.assign(this.stage.style,{left:r.left+'px',top:r.top+'px',width:this.width+'px',height:this.height+'px',perspective:Math.max(1000,this.width*2.2)+'px'});const pane=source.closest('.reader-pane')!;const css=getComputedStyle(pane);for(const name of ['--reading-font','--reading-size','--reading-line','--reading-width','--page-margin'])this.stage.style.setProperty(name,css.getPropertyValue(name));document.body.append(this.stage);this.old=this.snapshot(source);}
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
 private async paper(next:HTMLElement){const w=this.width,h=this.height,direction=this.dir;next.style.zIndex='0';this.old.style.zIndex='1';const back=this.old.cloneNode(false) as HTMLElement;back.classList.remove('turn-outgoing');back.classList.add('turn-paper-back');back.style.zIndex='2';this.stage.append(back);const curl=document.createElement('div');curl.className='turn-paper-curl';this.stage.append(curl);const corners=[{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}];
  // The crease is the perpendicular bisector between the fixed lower corner and
  // its lifted position. Reflect the folded sheet across it, then shade its curved edge.
  const frame=(progress:number)=>{const t=progress*progress*(3-2*progress);const corner={x:direction>0?w:0,y:h},lift={x:corner.x-direction*w*2.24*t,y:h-h*2.16*t};if(t<.00001){back.style.clipPath=polygon([]);curl.style.opacity='0';return;}const vx=corner.x-lift.x,vy=corner.y-lift.y,length=Math.hypot(vx,vy),nx=vx/length,ny=vy/length,mx=(corner.x+lift.x)/2,my=(corner.y+lift.y)/2,k=nx*mx+ny*my;this.old.style.clipPath=polygon(clip(corners,nx,ny,k,false));back.style.clipPath=polygon(clip(corners,nx,ny,k,true));back.style.transform=`matrix(${1-2*nx*nx},${-2*nx*ny},${-2*nx*ny},${1-2*ny*ny},${2*k*nx},${2*k*ny})`;const intersections:Point[]=[];for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4],va=nx*a.x+ny*a.y-k,vb=nx*b.x+ny*b.y-k;if(va*vb<=0&&Math.abs(va-vb)>.0001){const ratio=va/(va-vb);intersections.push({x:a.x+(b.x-a.x)*ratio,y:a.y+(b.y-a.y)*ratio});}}if(intersections.length>=2){const [a,b]=intersections;const radius=Math.min(w,h)*.10*Math.sin(Math.PI*progress)+2;Object.assign(curl.style,{opacity:String(Math.min(1,t*16,(1-t)*12)),left:(a.x+b.x)/2+'px',top:(a.y+b.y)/2+'px',width:radius+'px',height:Math.hypot(a.x-b.x,a.y-b.y)+'px',transform:`translate(-50%,-50%) rotate(${Math.atan2(ny,nx)*180/Math.PI}deg)`});}else curl.style.opacity='0';};
  frame(0);const clock=this.animate(this.stage,[{opacity:1},{opacity:1}],800,'linear');const tick=()=>{if(this.cancelled)return;frame(Math.min(1,Number(clock.currentTime||0)/800));this.raf=requestAnimationFrame(tick);};tick();await clock.finished.catch(()=>{});cancelAnimationFrame(this.raf);if(!this.cancelled)frame(1);
 }
 cancel(){if(this.cancelled)return;this.cancelled=true;cancelAnimationFrame(this.raf);for(const a of this.animations)a.cancel();this.animations=[];this.stage.remove();}
}
