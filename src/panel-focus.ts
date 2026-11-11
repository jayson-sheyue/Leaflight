import './panel-focus.css';
import {t} from './i18n';

export type FocusPanel='reader'|'editor'|'review';
const labels:Record<FocusPanel,string>={reader:'放大阅读区',editor:'放大写作区',review:'放大评审区'};
export function focusButton(panel:FocusPanel){return `<button class="secondary panel-focus-button" data-action="focus-panel" data-panel="${panel}" aria-pressed="false" title="${t('全窗口显示当前区域，并隐藏菜单栏')}">${t(labels[panel])}</button>`;}

/** Layout-only changes keep the original editable/reading DOM mounted. */
export class PanelFocus{
 active:FocusPanel|null=null;
 private positions=new Map<HTMLElement,{top:number;left:number}>();
 private presented=false;
 private shownUntil=0;
 private chromeTimer=0;
 constructor(private beforeResize:()=>()=>void){
  document.addEventListener('click',event=>{
   if(!this.active)return;
   const sel=getSelection();
   if(sel&&!sel.isCollapsed&&sel.toString().length>0)return;
   const el=event.target as HTMLElement|null;
   if(!el||el.closest('#focus-chrome,button,a,input,textarea,select,label,summary,[contenteditable="true"],.inbox,.modal'))return;
   if(document.querySelector('#focus-chrome')?.classList.contains('shown'))this.hideChrome();else this.showChrome();
  });
 }
 sync(valid:FocusPanel[]){
  if(this.active&&!valid.includes(this.active)){this.active=null;this.positions.clear();}
  if(this.active)document.body.dataset.focus=this.active;else delete document.body.dataset.focus;
  for(const button of document.querySelectorAll<HTMLButtonElement>('.panel-focus-button')){
   const panel=button.dataset.panel as FocusPanel,active=this.active===panel;
   button.textContent=t(active?'退出全窗口':labels[panel]);button.setAttribute('aria-pressed',String(active));
   button.title=t(active?'按 Esc 退出全窗口':'全窗口显示当前区域，并隐藏菜单栏');
  }
  for(const nav of document.querySelectorAll<HTMLButtonElement>('.sidebar .nav')){
   const label=nav.querySelector('span:not(.nav-count)')?.textContent||nav.textContent||'';
   nav.setAttribute('aria-label',label.trim());nav.title=label.trim();
  }
  for(const el of this.positions.keys())if(!el.isConnected)this.positions.delete(el);
  this.mountChrome();
  this.applyChrome();
  this.present();
 }
 toggle(panel:FocusPanel){
  for(const el of document.querySelectorAll<HTMLElement>('.writing-workbench,.writing-list,.writing-editor,.writing-feedback,.toc')){
   if(el.getClientRects().length&&['auto','scroll'].includes(getComputedStyle(el).overflowY))this.positions.set(el,{top:el.scrollTop,left:el.scrollLeft});
  }
  const afterResize=this.beforeResize();
  this.active=this.active===panel?null:panel;this.sync(['reader','editor','review']);
  for(const [el,position] of this.positions)if(el.isConnected&&el.getClientRects().length){el.scrollTop=position.top;el.scrollLeft=position.left;}
  afterResize();
 }
 private mountChrome(){
  const host=document.querySelector('#app');
  const existing=document.querySelector<HTMLElement>('#focus-chrome');
  if(!this.active||!host){existing?.remove();return;}
  let bar=existing;
  if(!bar){
   bar=document.createElement('div');
   bar.id='focus-chrome';
   bar.innerHTML=`<button type="button" id="focus-inbox" data-action="inbox"></button><button type="button" id="focus-exit" data-action="focus-panel"></button>`;
  }
  host.prepend(bar);
  const exit=bar.querySelector<HTMLButtonElement>('#focus-exit')!;
  exit.dataset.panel=this.active;
  exit.textContent=t('退出');
  exit.title=t('按 Esc 退出全窗口');
  exit.setAttribute('aria-label',t('退出全窗口'));
  exit.setAttribute('aria-pressed','true');
  const inbox=bar.querySelector<HTMLButtonElement>('#focus-inbox')!;
  inbox.textContent=t('消息');
  inbox.title=t('消息盒子');
  inbox.setAttribute('aria-label',t('消息盒子'));
 }
 private showChrome(){this.shownUntil=Date.now()+2800;this.applyChrome();}
 private hideChrome(){this.shownUntil=0;window.clearTimeout(this.chromeTimer);document.querySelector('#focus-chrome')?.classList.remove('shown');}
 private applyChrome(){
  const bar=document.querySelector('#focus-chrome');
  if(!bar)return;
  const remaining=this.shownUntil-Date.now();
  bar.classList.toggle('shown',remaining>0);
  window.clearTimeout(this.chromeTimer);
  if(remaining>0)this.chromeTimer=window.setTimeout(()=>this.hideChrome(),remaining);
 }
 private present(){
  const next=!!this.active;
  if(this.presented===next)return;
  this.presented=next;
  if(next)this.showChrome();else this.hideChrome();
  void window.leaflight?.call('window-focus',{active:next}).catch(()=>{});
 }
}
