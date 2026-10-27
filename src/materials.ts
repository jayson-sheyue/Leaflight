import {t} from './i18n';
const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
// Derive visuals only from the immutable material snapshot; retain raw material as a fallback.
export function materialHtml(task:{id:string;language:string;materials:string}){
 const raw=`<pre lang="${esc(task.language)}">${esc(task.materials)}</pre>`;
 const lines=task.materials.split(/\r?\n/),table=lines.filter(l=>l.includes('|')).map(l=>l.split('|').map(x=>x.trim()));
 if(table.length>=3&&table[0].length>=2&&table[0].length<=5&&table.slice(1).every(row=>row.length===table[0].length&&row.slice(1).every(x=>/^\d+(?:\.\d+)?$/.test(x)&&Number.isFinite(Number(x))))){
  const [head,...rows]=table,max=Math.max(1,...rows.flatMap(row=>row.slice(1).map(Number))),columns=head.slice(1);
  return `<figure class="task-chart" lang="${esc(task.language)}"><figcaption>${esc(lines.filter(l=>!l.includes('|')).join(' '))}</figcaption><div class="chart-legend">${columns.map((c,i)=>`<span><i class="chart-series-${i}"></i>${esc(c)}</span>`).join('')}</div><div class="chart-bars" role="img" aria-label="${esc(rows.map(r=>r[0]+': '+columns.map((c,i)=>c+' '+r[i+1]).join(', ')).join('; '))}">${rows.map(row=>`<div class="chart-group"><strong>${esc(row[0])}</strong>${row.slice(1).map((v,i)=>`<div class="chart-bar-row"><span>${esc(columns[i])}</span><div class="chart-track"><i class="chart-series-${i}" style="width:${Number(v)/max*100}%"></i></div><b>${esc(v)}</b></div>`).join('')}</div>`).join('')}</div></figure><div class="task-table-wrap"><table class="task-table" lang="${esc(task.language)}"><caption>${t('图表数据 · 与题目材料一致')}</caption><thead><tr>${head.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr><th scope="row">${esc(row[0])}</th>${row.slice(1).map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><details class="raw-materials"><summary>${t('查看原始文字材料')}</summary>${raw}</details>`;
 }
 if(task.id==='en-ielts-process'){
  const steps=lines.filter(l=>/^\d+\.\s+/.test(l)).map(l=>l.replace(/^\d+\.\s+/,''));
  if(steps.length>=3)return `<figure class="task-process" lang="${esc(task.language)}"><figcaption>${esc(lines[0])}</figcaption><ol>${steps.map(s=>`<li><span>${esc(s)}</span></li>`).join('')}</ol><p class="process-cycle">↻ ${t('循环回到第一步')}</p></figure><details class="raw-materials"><summary>${t('查看原始文字材料')}</summary>${raw}</details>`;
 }
 return raw;
}
