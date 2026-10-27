// A DOM text location survives font, line-height and column reflow.
export function captureAnchor(scroller:HTMLElement):Range|null {
 const viewport=scroller.getBoundingClientRect();
 const visible=(r:DOMRect)=>r.right>viewport.left+1&&r.left<viewport.right-1&&r.bottom>viewport.top+1&&r.top<viewport.bottom-1;
 const walker=document.createTreeWalker(scroller,NodeFilter.SHOW_TEXT);
 while(walker.nextNode()){
  const node=walker.currentNode as Text;
  if(!node.textContent?.trim()||node.parentElement?.closest('rt,.chapter-kicker,.chapter-divider,.end-mark'))continue;
  const range=document.createRange();range.selectNodeContents(node);
  if(!Array.from(range.getClientRects()).some(visible))continue;
  for(let i=0;i<node.length;i++){
   range.setStart(node,i);range.setEnd(node,i+1);
   if(visible(range.getBoundingClientRect()))return range;
  }
 }
 return null;
}
export function restoreAnchor(scroller:HTMLElement,anchor:Range,mode:string){
 const rect=anchor.getBoundingClientRect(),viewport=scroller.getBoundingClientRect();
 if(mode==='pages')scroller.scrollLeft=Math.floor((rect.left-viewport.left+scroller.scrollLeft+.5)/Math.max(1,scroller.clientWidth))*scroller.clientWidth;
 else scroller.scrollTop+=rect.top-viewport.top;
}
export type TextAnchor={paragraph:number;index:number};
function paragraphOf(node:Node){const el=node.nodeType===Node.ELEMENT_NODE?node as Element:node.parentElement;return el?.closest('.prose p') as HTMLElement|null;}
/** Paragraph index in the chapter body. Ruby readings are not part of the offset. */
export function captureTextAnchor(scroller:HTMLElement):TextAnchor|null{
 const range=captureAnchor(scroller);if(!range)return null;
 const paragraphs=[...scroller.querySelectorAll<HTMLElement>('.prose p')];
 const host=paragraphOf(range.startContainer);const paragraph=host?paragraphs.indexOf(host):-1;
 if(paragraph<0)return {paragraph:0,index:0};
 let index=0;const walker=document.createTreeWalker(host!,NodeFilter.SHOW_TEXT);
 while(walker.nextNode()){
  const node=walker.currentNode as Text;if(node.parentElement?.closest('rt'))continue;
  if(node===range.startContainer)return {paragraph,index:index+range.startOffset};
  index+=node.textContent?.length??0;
 }
 return {paragraph,index:0};
}
export function anchorRange(scroller:HTMLElement,anchor:TextAnchor):Range|null{
 const host=scroller.querySelectorAll<HTMLElement>('.prose p')[anchor.paragraph];if(!host)return null;
 let remaining=Math.max(0,anchor.index);const walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT);let last:Text|null=null;
 while(walker.nextNode()){
  const node=walker.currentNode as Text;if(node.parentElement?.closest('rt'))continue;last=node;
  const length=node.textContent?.length??0;
  if(remaining<=length){const range=document.createRange();const offset=Math.min(remaining,length);range.setStart(node,offset);range.setEnd(node,Math.min(length,offset+(length?1:0)));return range;}
  remaining-=length;
 }
 if(!last)return null;const range=document.createRange();range.selectNodeContents(last);range.collapse(false);return range;
}
/** Page and scroll fraction for the current column layout. */
export function placeOfRange(scroller:HTMLElement,range:Range,mode:string){
 const rect=range.getBoundingClientRect(),viewport=scroller.getBoundingClientRect();
 if(mode==='pages'){
  const page=Math.max(1,scroller.clientWidth),x=rect.left-viewport.left+scroller.scrollLeft;
  const index=Math.max(0,Math.floor((x+1)/page)),pages=Math.max(1,Math.round(scroller.scrollWidth/page));
  const extent=Math.max(0,scroller.scrollWidth-page);
  return {fraction:extent?Math.min(1,index*page/extent):0,page:Math.min(pages,index+1),pages};
 }
 const extent=Math.max(0,scroller.scrollHeight-scroller.clientHeight),y=rect.top-viewport.top+scroller.scrollTop;
 return {fraction:extent?Math.min(1,Math.max(0,y/extent)):0,page:1,pages:1};
}
