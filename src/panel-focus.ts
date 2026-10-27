import './panel-focus.css';
import {t} from './i18n';

export type FocusPanel='reader'|'editor'|'review';
const labels:Record<FocusPanel,string>={reader:'放大阅读区',editor:'放大写作区',review:'放大评审区'};
export function focusButton(panel:FocusPanel){return `<button class="secondary panel-focus-button" data-action="focus-panel" data-panel="${panel}" aria-pressed="false" title="${t('放大当前面板，其他面板自动收起')}">${t(labels[panel])}</button>`;}

/** Layout-only changes keep the original editable/reading DOM mounted. */
export class PanelFocus{
 active:FocusPanel|null=null;
 private positions=new Map<HTMLElement,{top:number;left:number}>();
 constructor(private beforeResize:()=>()=>void){}
 sync(valid:FocusPanel[]){
  if(this.active&&!valid.includes(this.active)){this.active=null;this.positions.clear();}
  if(this.active)document.body.dataset.focus=this.active;else delete document.body.dataset.focus;
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-action=focus-panel]')){
   const panel=button.dataset.panel as FocusPanel,active=this.active===panel;
   button.textContent=t(active?'恢复布局':labels[panel]);button.setAttribute('aria-pressed',String(active));
   button.title=t(active?'按 Esc 恢复布局':'放大当前面板，其他面板自动收起');
  }
  for(const nav of document.querySelectorAll<HTMLButtonElement>('.sidebar .nav')){
   const label=nav.querySelector('span:not(.nav-count)')?.textContent||nav.textContent||'';
   nav.setAttribute('aria-label',label.trim());nav.title=label.trim();
  }
  for(const el of this.positions.keys())if(!el.isConnected)this.positions.delete(el);
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
}
