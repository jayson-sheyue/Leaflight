import './style.css';
import './atmosphere.css';
import {ReaderTransition,type TurnEffect} from './page-transitions';
import {captureAnchor,restoreAnchor,captureTextAnchor,anchorRange,placeOfRange,type TextAnchor} from './reading-anchor';
import {getScience,scienceChooser,sciencePanel,scienceTitle,scienceCatalog,type Science} from './science';
import {WritingDesk} from './writing';
import appearance from '../electron/appearance.json';
import { t, setLocale, uiLanguage, localizeError } from './i18n';
type Job={draftId?:string;bookId?:string;id:string;type:string;title:string;status:string;stage:string;revision:number;unread:boolean;updatedAt:string;error?:string;resultBookId?:string;events?:{at:string;stage:string}[]};
type Preset = {
    science?:Science;
    language?: 'en' | 'ja';
    level: string;
    genre: string;
    words: number;
    totalChapters: number;
    preferences: string;
};
type Reading={surface:string;reading:string};
type Difficulty={version:number;language:string;level:string;calibration:number;enough:boolean;units:number;sentences:number;averageSentenceLength:number;longSentenceRatio:number;kanjiRatio:number;longWordRatio:number;complexRatio:number;uncoveredKanji:number;target:{sentence:number[];longSentence:number};warnings:string[]};
type Comparison={language:string;scene:string;variants:{level:string;text:string;readings:Reading[];report:Difficulty}[]};
type Chapter = {
    readings?:Reading[];
    calibrationUsed?:number;
    id: string;
    title: string;
    text: string;
    summary: string;
};
type Position = {
    chapter: number;
    fraction: number;
    paragraph?: number;
    index?: number;
};
type Book = {
    id: string;
    title: string;
    synopsis: string;
    preset: Preset;
    chapters: Chapter[];
    sample: string;
    sampleReadings?:Reading[];
    feedback?:{chapterId:string;rating:string;date:string}[];
    progress: Position;
    bookmarks: ({
        id: string;
    } & Position)[];
    demo?: boolean;
    updatedAt: string;
};
type Reader = {
    effect?:TurnEffect;
    showReadings?:boolean;
    font: string;
    size: number;
    line: number;
    width: number;
    theme: string;
    mode: string;
};
type Settings = {
    uiLanguage: 'zh' | 'en' | 'ja';
    model: string;
    hasKey: boolean;
    encryptionAvailable: boolean;
    presets: {
        name: string;
        preset: Preset;
    }[];
    reader: Partial<Reader>;
    lastUsage?: {
        totalTokenCount?: number;
    };
};
declare global {
    interface Window {
        leaflight?: {
            onJobs?(handler:(jobs:Job[])=>void):()=>void;
            onClose?(handler: () => Promise<void>): void;
            call(command: string, payload?: unknown): Promise<{
                ok: boolean;
                value: any;
                error?: string;
            }>;
        };
    }
}
const root = document.querySelector<HTMLDivElement>('#app')!;
const KEY_MASK='••••••••••••••••';
let jobs:Job[]=[],inboxOpen=false,previewJobId='',keyDirty=false;
let books: Book[] = [], settings: Settings, reader: Reader = { effect:'none',showReadings:true,font: 'serif', size: 20, line: 1.85, width: 720, theme: 'paper', mode: 'scroll' };
let selected: string | null = null, chapter = 0, view: 'library' | 'reader' | 'writing' = 'library', modal = '', plan: any = null, search = '', filter = 'all';
let difficultyData:{report:Difficulty;feedback:string|null;adjustment:number}|null=null;
let difficultyContext:'preview'|'chapter'|'saved-preview'='chapter';
let comparison:Comparison|null=null;
let trashedBooks:(Book&{deletedAt:string})[]=[];
let pendingDelete:string|null=null;
let turning=false,turnToken=0,pageTransition:ReaderTransition|null=null;
let readerObserver:ResizeObserver|null=null;
let compareScene='', compareLevels:string[]=[];
let draftPreset: Preset | null = null;
let storyScience:Science|null=null;
let fraction = 0, progressTimer: ReturnType<typeof setTimeout> | undefined, readerTimer: ReturnType<typeof setTimeout> | undefined, toastTimer: ReturnType<typeof setTimeout> | undefined, bookmarkTimer: ReturnType<typeof setTimeout> | undefined, reanchorTimer: ReturnType<typeof setTimeout> | undefined;
let pendingAnchor: TextAnchor | null = null;
const bookmarkPlaces = new Map<string, { page: number; pages: number; fraction: number }>();
let savePending: Promise<unknown> = Promise.resolve(), restoreFrame = 0, restoring = false;
const writer=new WritingDesk(api,toast,()=>{if(view==='writing')render();});
const genreNames: Record<string, string> = { fantasy: t("奇幻"), mystery: t("悬疑"), 'science fiction': t("科幻"), adventure: t("冒险"), 'slice of life': t("日常"), romance: t("爱情") };
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const count = (s: string, language = 'en') => language === 'ja' ? Array.from(s.replace(/\s/gu, '')).length : (s.match(/\b[\w’'-]+\b/g) || []).length;
function rubyText(text:string,readings:Reading[]=[]){
 const mapping=new Map(readings.map(x=>[x.surface,x.reading]));
 const keys=[...mapping.keys()].filter(Boolean).sort((a,b)=>b.length-a.length);
 if(!keys.length)return esc(text);
 const escapeRegex=(x:string)=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const regex=new RegExp(keys.map(escapeRegex).join('|'),'gu');
 let output='',start=0;for(const match of text.matchAll(regex)){output+=esc(text.slice(start,match.index));output+=`<ruby>${esc(match[0])}<rt>${esc(mapping.get(match[0]))}</rt></ruby>`;start=match.index!+match[0].length;}return output+esc(text.slice(start));
}
function calibrationLabel(value:number){return t(value<0?'后续生成：更易读':value>0?'后续生成：更有挑战':'后续生成：基础规则');}
function difficultyBody(r:Difficulty){const warnings:Record<string,string>={'long-average':'平均句长偏长，可能增加理解负担。','short-average':'平均句长偏短，可能缺少目标等级的表达变化。','long-sentences':'长句比例偏高，请留意多层修饰和指代。','kanji-density':'汉字密度偏高，低等级阅读可能吃力。','advanced-patterns':'检测到部分较高级语法或书面表达。','literary-words':'检测到部分文学性或低频用词线索。','limited-variation':'复杂表达线索较少，高等级区分度可能不足。','missing-readings':'部分汉字没有配套注音。'};
 return `<div class="difficulty-label">${t('目标等级')} <strong>${esc(r.level)}</strong><span class="tag">${t('工程参考，非官方测级')}</span></div><div class="difficulty-metrics"><div><strong>${r.averageSentenceLength}</strong><small>${t('平均句长')} · ${unit(r.language)}</small></div><div><strong>${r.longSentenceRatio}%</strong><small>${t('长句比例')}</small></div><div><strong>${r.language==='ja'?r.kanjiRatio:r.longWordRatio}%</strong><small>${t(r.language==='ja'?'汉字占比':'长词占比（≥9字母）')}</small></div></div><p class="muted">${t('本级参考平均句长：{min}–{max} {unit}；超过 {long} {unit} 记为长句。',{min:r.target.sentence[0],max:r.target.sentence[1],unit:unit(r.language),long:r.target.longSentence})}</p><ul class="difficulty-warnings">${!r.enough?`<li>${t('文本样本较短，暂不足以判断句式分布。')}</li>`:!r.warnings.length?`<li>${t('本地检查未发现明显偏离；不代表词汇、语法与叙事难度已经达标。')}</li>`:''}${r.warnings.map(code=>`<li>${t(warnings[code]||'请结合实际阅读体验判断。')}</li>`).join('')}</ul><p class="generation-note">${t('检查仅依据句长、字形比例和有限表达线索；不覆盖完整词表，也不能认证 CEFR 或 JLPT 等级。')}</p>`;
}
function comparisonBody(){const preset=draftPreset||{language:'en',level:'B1',genre:'fantasy',words:1000,totalChapters:10,preferences:''};const language=preset.language||'en';if(!compareLevels.length)compareLevels=language==='ja'?['N5','N1']:['A2','C1'];return `<p class="modal-subtitle">${t('用相同人物、事件和结局，对比两个等级的表达。一次生成请求，可能消耗 API 额度。')}</p><form id="comparison-form"><label>${t('同一段情节')}<textarea name="scene" minlength="10" maxlength="1500" rows="3" required placeholder="${t('例如：一个人走进房间，发现自己的钥匙不见了，最后在外套口袋里找到。')}">${esc(compareScene)}</textarea></label><div class="form-grid"><label>${t('版本 A')}<select name="levelA">${levelOptions(language,compareLevels[0])}</select></label><label>${t('版本 B')}<select name="levelB">${levelOptions(language,compareLevels[1])}</select></label></div>${button('run-comparison',icon('spark')+' '+t('生成难度对照'),'primary')}</form><p class="muted">${t('最近一次对照结果保存在本机，可离线查看；需人工检查情节一致性和阅读感受。')}</p>${comparison&&comparison.language===language?`<p class="comparison-scene">${t('已生成情节')}：${esc(comparison.scene)}</p><div class="comparison-grid">${comparison.variants.map(v=>`<section class="comparison-variant"><h3>${esc(v.level)}</h3><div class="comparison-prose" lang="${language}">${v.text.split(/\n\s*\n/).map(x=>`<p>${rubyText(x,v.readings)}</p>`).join('')}</div>${difficultyBody(v.report)}</section>`).join('')}</div>`:''}`;}
function genreLabel(id: string) { return t(genreNames[id] || id); }
function unit(language?: string) { return t(language === 'ja' ? '字' : '词'); }
function lengthLabel(p: Preset) { return t('{count} {unit} / 章', { count: p.words.toLocaleString(), unit: unit(p.language) }); }
function applyTheme() { const theme = appearance.themes.find(x => x.id === reader.theme) || appearance.themes[0]; document.body.dataset.theme = theme.id; for (const key of ['bg', 'surface', 'ink', 'muted', 'border', 'accent', 'soft'] as const)
    document.body.style.setProperty('--' + key, theme[key]); }
function levelOptions(language: string, selectedLevel?: string) { return (language === 'ja' ? ['N5', 'N4', 'N3', 'N2', 'N1'] : ['A2', 'B1', 'B2', 'C1']).map(x => `<option value="${x}" ${x === (selectedLevel || (language === 'ja' ? 'N3' : 'B1')) ? 'selected' : ''}>${x}</option>`).join(''); }
function lengthOptions(language: string, selectedWords?: number) { const values = language === 'ja' ? [800, 1600, 3000, 5000] : [500, 1000, 2000]; if (selectedWords && !values.includes(selectedWords))
    values.push(selectedWords); return values.sort((a, b) => a - b).map(x => `<option value="${x}" ${x === (selectedWords || (language === 'ja' ? 1600 : 1000)) ? 'selected' : ''}>${x.toLocaleString()} ${unit(language)}</option>`).join(''); }
function refreshStoryGuide(){const summary=document.querySelector('.science-customize>summary');if(summary)summary.textContent=t('自选知识主线与进阶')+(storyScience?' · '+scienceTitle(storyScience):'');const host=document.querySelector('#story-summary');if(host){const p=formPreset();host.textContent=t('{level} · {genre} · 每章 {length} · 共 {count} 章',{level:p.level,genre:genreLabel(p.genre),length:p.words+' '+unit(p.language),count:p.totalChapters});}}
function fillPreset(p: Preset) { const f = document.querySelector<HTMLFormElement>('#story-form')!; const language = p.language || 'en'; (f.elements.namedItem('language') as HTMLSelectElement).value = language; (f.elements.namedItem('level') as HTMLSelectElement).innerHTML = levelOptions(language, p.level); (f.elements.namedItem('words') as HTMLSelectElement).innerHTML = lengthOptions(language, p.words); for (const [k, v] of Object.entries(p)) {
    const el = f.elements.namedItem(k) as HTMLInputElement;
    if (el)
        el.value = String(v);
} storyScience=p.science||null;document.querySelector('#science-form-host')!.innerHTML=scienceChooser(storyScience,language as 'en'|'ja'); refreshStoryGuide(); }
async function api<T = any>(cmd: string, p?: unknown): Promise<T> { if (!window.leaflight)
    throw Error(t("请在 Leaflight 桌面应用中打开。运行 npm run dev 启动。")); const r = await window.leaflight.call(cmd, p); if (!r.ok)
    throw Error(r.error || t("操作失败")); return r.value; }
function toast(message: string) { document.querySelector('.toast')?.remove(); const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = localizeError(message); document.body.append(t); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 5000); }
function current() { return books.find(b => b.id === selected)!; }
function updateBook(b: Book) { const i = books.findIndex(x => x.id === b.id); if (i < 0)
    books.unshift(b);
else
    books[i] = b; }
function icon(name: string) { const paths: Record<string, string> = { pen:'<path d="m4 16 12-12 4 4-12 12-5 1Z"/><path d="m13 7 4 4M4 16l4 4"/>', inbox:'<path d="M4 4h16v16H4Z"/><path d="M4 13h5l1 3h4l1-3h5M8 8h8"/>', leaf: '<path d="M19 4C8 3 3 8 5 14c2 7 12 5 14-10Z"/><path d="m5 21 9-12"/>', book: '<path d="M3 5c4-2 7-1 9 1 2-2 5-3 9-1v14c-4-2-7-1-9 1-2-2-5-3-9-1Z"/><path d="M12 6v14"/>', plus: '<path d="M12 5v14M5 12h14"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>', arrow: '<path d="m5 12 14 0m-5-5 5 5-5 5"/>', back: '<path d="M19 12H5m5-5-5 5 5 5"/>', spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>', mark: '<path d="M6 3h12v18l-6-4-6 4Z"/>', search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>', download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>' }; return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.book}</svg>`; }
function button(action: string, text: string, cls = 'secondary') { return `<button class="${cls}" data-action="${action}">${text}</button>`; }
const liveJob=(j:Job)=>['queued','running','cancelling'].includes(j.status);
function generationControls(b:Book){const active=jobs.find(j=>j.bookId===b.id&&liveJob(j));return active?`<button class="secondary full" data-action="inbox">${t('后台生成中 · 查看进度')}</button>`:b.chapters.length<b.preset.totalChapters?button('generate',icon('spark')+' '+t('生成下一章'),'primary full'):`<div class="finished">✧ ${t('这个故事，已圆满落幕。')}</div>`;}
function renderInbox(){
 document.body.classList.toggle('messages-open',inboxOpen);const toggle=document.querySelector('.sidebar [data-action=inbox]');toggle?.classList.toggle('active',inboxOpen);toggle?.setAttribute('aria-expanded',String(inboxOpen));
 const badge=document.querySelector('#job-badge');if(badge){const unread=jobs.filter(j=>j.unread).length;badge.textContent=unread?String(unread):jobs.some(liveJob)?'•':'';}
 const host=document.querySelector('#inbox-host');if(!host)return;const scroll=host.querySelector('.inbox-list')?.scrollTop||0;const expanded=new Set(Array.from(host.querySelectorAll('.job-card:has(details[open])')).map(el=>(el as HTMLElement).dataset.job));const focused=document.activeElement as HTMLElement|null;const focusedAction=focused?.closest('.inbox')?focused.dataset.action:null;const focusedJob=focused?.dataset.id;
 const statusNames:Record<string,string>={queued:'排队中',running:'生成中',cancelling:'取消中',completed:'已完成',failed:'失败',cancelled:'已取消',interrupted:'已中断'};
 host.innerHTML=inboxOpen?`<aside class="inbox" aria-label="${t('消息盒子')}"><header><div><h2>${t('消息盒子')}</h2><small>${t('生成在后台继续，结果保存在本机。')}</small></div><button class="close" data-action="close-inbox" aria-label="${t('关闭消息盒子')}">×</button></header><div class="inbox-toolbar"><span>${t('{count} 个进行中',{count:jobs.filter(liveJob).length})}</span>${button('read-jobs',t('全部标为已读'),'text-button')}</div><div class="inbox-list">${jobs.length?jobs.map(j=>`<article class="job-card ${j.unread?'unread':''}" data-job="${esc(j.id)}"><div class="job-heading"><strong>${t(j.type==='preview'?'故事试读':j.type==='chapter'?'章节生成':j.type==='review'?'写作评审':'难度对照')}</strong><span class="job-status ${esc(j.status)}">${t(statusNames[j.status]||j.status)}</span></div><h3>${esc(j.title)}</h3><p class="job-stage">${esc(localizeError(j.stage))}</p>${j.error?`<p class="job-error">${esc(localizeError(j.error))}</p>`:''}<time>${new Date(j.updatedAt).toLocaleString(uiLanguage,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time>${j.events?.length?`<details><summary>${t('状态记录')}</summary><ol class="job-events">${j.events.map(e=>`<li><time>${new Date(e.at).toLocaleTimeString(uiLanguage,{hour:'2-digit',minute:'2-digit'})}</time> ${esc(localizeError(e.stage))}</li>`).join('')}</ol></details>`:''}<div class="job-actions">${j.status==='completed'?`<button class="secondary" data-action="view-job" data-id="${esc(j.id)}">${t(j.type==='chapter'?'阅读新章':'查看结果')}</button>`:''}${['failed','cancelled','interrupted'].includes(j.status)?`<button class="secondary" data-action="retry-job" data-id="${esc(j.id)}">${t('重试')}</button>`:''}${['queued','running'].includes(j.status)?`<button class="text-button" data-action="cancel-job" data-id="${esc(j.id)}">${t('取消任务')}</button>`:''}</div></article>`).join(''):`<div class="inbox-empty">✧<p>${t('还没有生成任务。')}</p><small>${t('试读、章节、难度对照和写作评审的进度会出现在这里。')}</small></div>`}</div></aside>`:'';
 for(const card of host.querySelectorAll<HTMLElement>('.job-card'))if(expanded.has(card.dataset.job)){const details=card.querySelector('details');if(details)details.open=true;}const list=host.querySelector('.inbox-list');if(list)list.scrollTop=scroll;if(focusedAction){const next=Array.from(host.querySelectorAll<HTMLElement>('[data-action]')).find(el=>el.dataset.action===focusedAction&&el.dataset.id===focusedJob);next?.focus({preventScroll:true});}
 const controls=document.querySelector('.generation-controls');if(controls&&current())controls.innerHTML=generationControls(current());
}
async function submitted(){modal='';renderModal();jobs=await api('jobs');renderInbox();toast(t('已加入后台任务，可继续阅读。'));}
async function refreshLibrary(){
 const fresh=await api<Book[]>('library');const local=current();if(view==='reader'&&local){const b=fresh.find(b=>b.id===local.id);if(b)b.progress={...local.progress};}books=fresh;
 if(view==='library'){
  const input=document.querySelector<HTMLInputElement>('#search'),focused=document.activeElement===input,pos=input?.selectionStart||0;
  document.querySelector('.workspace')!.innerHTML=library();if(focused){const next=document.querySelector<HTMLInputElement>('#search');next?.focus();next?.setSelectionRange(pos,pos);}
 }else if(view==='reader'&&current()){
  // Refresh only navigation; keep the live prose DOM, selection and scroll position.
  const template=document.createElement('template');template.innerHTML=readerView();const toc=template.content.querySelector('.toc');if(toc)document.querySelector('.toc')?.replaceWith(toc);
 }
}
async function receiveJobs(next:Job[]){const completed=next.some(j=>j.status==='completed'&&!jobs.some(old=>old.id===j.id&&old.status==='completed'));jobs=next;renderInbox();await writer.onJobs(next);if(completed)await refreshLibrary();}

function render() { if(view!=='reader'){cancelTurn();readerObserver?.disconnect();}applyTheme(); root.innerHTML = `<aside class="sidebar"><div class="brand">${icon('leaf')}<span>Leaflight<span class="brand-sub">${t("YOUR PRIVATE STORY ROOM")}</span></span></div><div class="nav-caption">${t("我的书房")}</div><button class="nav ${view === 'library' ? 'active' : ''}" data-action="library">${icon('book')}<span>${t("故事书架")}</span><span class="nav-count">${books.length}</span></button><button class="nav" data-action="new">${icon('spark')}<span>${t("创作新故事")}</span></button><button class="nav ${view==='writing'?'active':''}" data-action="writing">${icon('pen')}<span>${t('我的写作')}</span></button><button class="nav" data-action="inbox" aria-expanded="${inboxOpen}">${icon('inbox')}<span>${t('消息盒子')}</span><span class="nav-count" id="job-badge"></span></button><div class="sidebar-note"><span class="tiny-star">✧</span><p>${t("一个属于你的世界，")}<br>${t("一页恰好的故事。")}</p><small>${t("按你的节奏，慢慢读。")}</small></div><div class="sidebar-bottom"><div class="local-state"><i></i> ${t("本地书房 · 离线可读")}</div><button class="nav" data-action="settings">${icon('settings')}<span>${t("系统设置")}</span></button></div></aside><main class="workspace">${view === 'library' ? library() : view==='writing'?writer.html():readerView()}</main><div id="inbox-host"></div><div id="modal-host"></div>`;renderInbox(); if (view === 'reader')
    mountReader(); if (modal)
    renderModal(); }
function library() { const shown = books.filter(b => (filter === 'all' || (filter === 'complete' ? b.chapters.length >= b.preset.totalChapters : b.chapters.length < b.preset.totalChapters)) && (b.title + ' ' + b.synopsis).toLowerCase().includes(search.toLowerCase())); const recent = [...books].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).find(b => b.chapters.length > 0); return `<header class="topbar"><span>${t("书房")} <span class="slash">/</span> ${t("故事书架")}</span><span class="quiet">${icon('leaf')} ${t("A little reading, every day.")}</span></header><section class="library-content"><div class="eyebrow">${t("STORIES MADE FOR YOU")}</div><div class="title-row"><div><h1>${t("让故事，适合此刻的你。")}</h1><p class="subtitle">${t("喜欢的题材，刚好的难度。下一段旅程，从这里开始。")}</p></div>${button('new', icon('plus') + ` ${t("新建故事")}`, 'primary')}</div><details class="start-guide" ${!books.length?'open':''}><summary>${t('从这里开始 · 阅读与写作指南')}</summary><div class="start-guide-grid"><article><h3>${t('先体验阅读')}</h3><p>${t('打开三章离线示例，试试字体、主题和翻页，无需 API Key。')}</p>${button('guide-demo',t('体验离线阅读'),'text-button')}</article><article><h3>${t('创作专属读物')}</h3><p>${t('选方向 → 看试读 → 加入书架 → 生成章节。首次生成前在设置中填写 Key。')}</p>${button('guide-new',t('开始创作流程'),'text-button')}</article><article><h3>${t('练习自己的表达')}</h3><p>${t('选题读材料，独立写作，再提交 AI 评审。草稿自动保存在本机。')}</p>${button('guide-writing',t('进入写作练习'),'text-button')}</article></div></details><div class="feature-row"><div class="continue-card"><div class="eyebrow">${recent ? t("PICK UP WHERE YOU LEFT OFF") : t("YOUR NEXT CHAPTER")}</div><h2>${recent ? esc(recent.title) : t("好故事，从一点好奇开始。")}</h2><p>${recent ? `${esc(recent.preset.level)} · ${esc(genreLabel(recent.preset.genre))} · ${t('已归档 {count} 章', { count: recent.chapters.length })}` : t("为自己创造一部小说，让阅读成为期待。")}</p>${recent ? `<button class="text-button" data-action="open" data-id="${esc(recent.id)}">${t("继续阅读")} ${icon('arrow')}</button>` : button('new', `${t("设定我的第一个故事")} ` + icon('arrow'), 'text-button')}<div class="orb orb-one"></div><div class="orb orb-two"></div><div class="line-art">✧</div></div><div class="daily-card"><div class="mini-icon">${icon('book')}</div><h3>${t("生成一次，随时阅读")}</h3><p>${t("故事与进度保存在这台电脑。")}<br>${t("断开网络，也能翻开下一页。")}</p><div class="pill">${t("LOCAL FIRST")}</div></div></div><div class="shelf-toolbar"><div class="tabs">${[['all', t("全部故事")], ['ongoing', t("连载中")], ['complete', t("已完结")]].map(([v, label]) => `<button class="tab ${filter === v ? 'selected' : ''}" data-action="filter" data-filter="${v}">${t(label)}</button>`).join('')}</div><div class="shelf-actions">${button('trash',t('回收站'),'text-button')}<label class="search">${icon('search')}<input id="search" aria-label="${t("搜索故事")}" placeholder="${t("搜索我的故事…")}" value="${esc(search)}"></label></div></div><div class="book-grid">${shown.map((b, i) => bookCard(b, i)).join('')}${!search && filter !== 'complete' ? `<button class="new-card" data-action="new"><div class="new-circle">${icon('plus')}</div><h3>${t("让想象，长成故事")}</h3><p>${t("选择语言水平和题材")}<br>${t("开启一段专属连载")}</p></button>` : ''}</div>${!shown.length ? `<div class="empty-note">${books.length ? t("还没有符合条件的作品。") : t("还没有故事？可以先打开免费离线示例，体验阅读。")} ${!books.length ? button('demo', t("打开三章示例"), 'text-button') : ''}</div>` : ''}<footer>${t("CRAFTED BY AI. ENJOYED AT YOUR PACE.")} <span>✧</span></footer></section>`; }
function bookCard(b: Book, i: number) { const done = b.chapters.length >= b.preset.totalChapters; return `<article class="book-card"><button class="cover cover-${i % 4}" data-action="open" data-id="${esc(b.id)}"><div class="cover-top">${t("LEAFLIGHT ORIGINAL")} <span>${esc(b.preset.level)} · ${(b.preset.language || 'en').toUpperCase()}</span></div><div class="cover-art">${['✧', '☽', '❋', '◈'][i % 4]}<div class="cover-ring"></div></div><div class="cover-title">${esc(b.title)}</div><div class="cover-bottom">${esc(b.preset.genre.toUpperCase())} / ${b.demo ? t("OFFLINE SAMPLE") : t("AI FICTION")}</div></button><div class="book-meta"><span class="genre">${esc(genreLabel(b.preset.genre))}</span><span>${done ? t("已完结") : t("连载中")} · ${t('{current}/{total} 章', { current: b.chapters.length, total: b.preset.totalChapters })}</span></div><button class="book-title" data-action="open" data-id="${esc(b.id)}">${esc(b.title)}</button><p class="book-synopsis">${esc(b.synopsis)}</p><div class="book-card-bottom"><span>${b.demo ? t("离线示例 · 非 API 生成") : lengthLabel(b.preset)}</span><div class="book-actions"><button class="delete-book" data-action="delete" data-id="${esc(b.id)}" aria-label="${esc(t('删除作品'))}">${t('删除')}</button><button class="small-link" data-action="open" data-id="${esc(b.id)}">${b.chapters.length ? t("阅读") : t("查看作品")} ${icon('arrow')}</button></div></div></article>`; }
function hasAnchor(mark:Position):mark is Position&TextAnchor{return Number.isInteger(mark.paragraph)&&Number.isInteger(mark.index);}
function bookmarkLabel(mark:Position&{id:string}){const place=bookmarkPlaces.get(mark.id);const where=reader.mode==='pages'&&place?t('第 {page} 页',{page:place.page}):`${Math.round((place?.fraction??mark.fraction)*100)}%`;return `${t('第 {number} 章',{number:mark.chapter+1})} · ${where}`;}
function isBookmarked(b:Book){const el=document.querySelector<HTMLElement>('#reader-scroll');const page=el?Math.round(el.scrollLeft/Math.max(1,el.clientWidth))+1:0;return b.bookmarks.some(mark=>mark.chapter===chapter&&(Math.round(mark.fraction*100)===Math.round(fraction*100)||(reader.mode==='pages'&&bookmarkPlaces.get(mark.id)?.page===page)));}
function chapterInner(b:Book,index:number){const c=b.chapters[index];if(!c)return '';return `<div class="chapter-kicker">${t('第 {number} 章',{number:String(index+1).padStart(2,'0')})} <span>· ${count(c.text,b.preset.language).toLocaleString()} ${unit(b.preset.language)}</span></div><h1>${rubyText(c.title.replace(/^\d+\s*[·.:-]\s*/,''),c.readings)}</h1><div class="chapter-divider">✧</div>${c.text.split(/\n\s*\n/).filter(Boolean).map(p=>`<p>${rubyText(p,c.readings)}</p>`).join('')}<div class="end-mark">${index===b.preset.totalChapters-1?t('THE END'):t('TO BE CONTINUED')} · ✧</div>`;}
function readerProse(b:Book){if(b.chapters[chapter])return chapterInner(b,chapter);return `<div class="chapter-kicker">${t('YOUR STORY IS READY TO BEGIN')}</div><h1>${esc(b.title)}</h1><p>${esc(b.synopsis)}</p><div class="chapter-divider">✧</div><div class="eyebrow">${t('OPENING PREVIEW · 试读片段')}</div>${b.sample.split(/\n\s*\n/).map(p=>`<p>${rubyText(p,b.sampleReadings)}</p>`).join('')}<p class="muted">${t('这是开篇试读，尚未生成完整章节。点击左侧「生成下一章」开始。')}</p>`;}
function refreshBookmarkList(){const host=document.querySelector('.bookmark-list');const b=view==='reader'?current():undefined;if(!host||!b)return;host.innerHTML=`<div class="eyebrow">${t('BOOKMARKS')}</div>${b.bookmarks.length?b.bookmarks.map(x=>`<button class="bookmark-item" data-action="goto-mark" data-mark="${esc(x.id)}">${icon('mark')} ${bookmarkLabel(x)}</button>`).join(''):`<p class="muted">${t('把喜欢的地方，留在这里。')}</p>`}`;}
function withChapterLayout(b:Book,index:number,run:(scroller:HTMLElement)=>void){const live=document.querySelector<HTMLElement>('#reader-scroll');const pane=live?.closest<HTMLElement>('.reader-pane');if(!live||!pane||!b.chapters[index])return;const host=document.createElement('div');host.className='reader-pane';host.dataset.mode=reader.mode;host.dataset.ruby=String(reader.showReadings!==false);host.setAttribute('aria-hidden','true');const css=getComputedStyle(pane);for(const name of ['--reading-font','--reading-size','--reading-line','--reading-width','--page-margin'])host.style.setProperty(name,css.getPropertyValue(name));Object.assign(host.style,{position:'fixed',left:'-10000px',top:'0',width:live.clientWidth+'px',height:live.clientHeight+'px',pointerEvents:'none'});const scroller=document.createElement('div');scroller.className='reader-scroll';scroller.style.height='100%';scroller.innerHTML=`<article class="prose" lang="${b.preset.language||'en'}">${chapterInner(b,index)}</article>`;host.append(scroller);document.body.append(host);try{void scroller.scrollWidth;run(scroller);}finally{host.remove();}}
function anchorAtFraction(scroller:HTMLElement,value:number):TextAnchor|null{const page=Math.max(1,scroller.clientWidth);if(reader.mode==='pages'){const extent=Math.max(0,scroller.scrollWidth-scroller.clientWidth);scroller.scrollLeft=Math.round(value*extent/page)*page;}else scroller.scrollTop=value*Math.max(0,scroller.scrollHeight-scroller.clientHeight);return captureTextAnchor(scroller);}
function queueReanchor(){clearTimeout(reanchorTimer);const id=selected;reanchorTimer=setTimeout(()=>{const book=books.find(item=>item.id===id);if(!book?.bookmarks.length)return;const marks=book.bookmarks.map(mark=>({id:mark.id,fraction:mark.fraction,...(hasAnchor(mark)?{paragraph:mark.paragraph,index:mark.index}:{})}));savePending=savePending.then(()=>api('reanchor',{id,marks})).then(updateBook).catch(e=>toast(e.message));},200);}
function relocateBookmarks(){const b=view==='reader'?current():undefined;const live=document.querySelector('#reader-scroll');if(!b?.bookmarks.length||!live)return;let changed=false;try{const groups=new Map<number,typeof b.bookmarks>();for(const mark of b.bookmarks){const list=groups.get(mark.chapter)??[];list.push(mark);groups.set(mark.chapter,list);}for(const [index,marks] of groups)withChapterLayout(b,index,scroller=>{for(const mark of marks){if(!hasAnchor(mark)){const anchor=anchorAtFraction(scroller,mark.fraction);if(!anchor)continue;mark.paragraph=anchor.paragraph;mark.index=anchor.index;changed=true;}const range=anchorRange(scroller,{paragraph:mark.paragraph!,index:mark.index!});if(!range)continue;const place=placeOfRange(scroller,range,reader.mode);bookmarkPlaces.set(mark.id,place);if(Math.abs(mark.fraction-place.fraction)>0.0001){mark.fraction=place.fraction;changed=true;}}});refreshBookmarkList();syncBookmarkButton();if(changed)queueReanchor();}catch{/* Keep the current page if a hidden measurement cannot be laid out. */}}
function snapPage(el:HTMLElement){if(reader.mode!=='pages')return;const prose=el.querySelector<HTMLElement>('.prose');if(prose){prose.style.transform='';prose.style.willChange='';}const page=Math.max(1,el.clientWidth),max=Math.max(0,el.scrollWidth-el.clientWidth);el.scrollLeft=Math.min(max,Math.round(el.scrollLeft/page)*page);}
function syncBookmarkButton(){const control=document.querySelector<HTMLButtonElement>('[data-action=bookmark]');if(!control||!current())return;const marked=isBookmarked(current()),label=t(marked?'取消书签':'添加书签');control.classList.toggle('bookmarked',marked);control.setAttribute('aria-pressed',String(marked));control.setAttribute('aria-label',label);control.title=label;}
function readerView() { const b = current(); if (!b) {
    view = 'library';
    return library();
} const marked=isBookmarked(b),markButton=t(marked?'取消书签':'添加书签'); return `<header class="topbar"><button class="text-button compact" data-action="library">${icon('back')} ${t("返回书架")}</button><span class="quiet">${esc(b.title)} <span class="tag">${esc(b.preset.level)}</span></span><div class="header-actions">${b.preset.science?button('science-notebook',t('科学笔记')):''}${button('difficulty',t('难度与反馈'))}${button('export', t("导出"))}${button('appearance', t("Aa 排版"))}</div></header><div class="reading-layout"><aside class="toc"><div class="eyebrow">${t("CONTENTS")}</div><h3>${esc(b.title)}</h3><p class="muted">${t('已归档 {current} / {total} 章', { current: b.chapters.length, total: b.preset.totalChapters })}</p><div class="toc-list">${b.chapters.map((c, i) => `<button data-action="chapter" data-chapter="${i}" class="toc-item ${i === chapter ? 'selected' : ''}"><small>${String(i + 1).padStart(2, '0')}</small><span>${esc(c.title.replace(/^\d+\s*[·.:-]\s*/, ''))}</span></button>`).join('')}</div><div class="generation-controls">${generationControls(b)}</div><div class="bookmark-list"><div class="eyebrow">${t("BOOKMARKS")}</div>${b.bookmarks.length ? b.bookmarks.map(x => `<button class="bookmark-item" data-action="goto-mark" data-mark="${esc(x.id)}">${icon('mark')} ${bookmarkLabel(x)}</button>`).join('') : `<p class="muted">${t("把喜欢的地方，留在这里。")}</p>`}</div></aside><section class="reader-pane"><div class="reader-scroll" id="reader-scroll"><article id="prose" class="prose" lang="${b.preset.language || 'en'}">${readerProse(b)}</article></div><div class="reading-bottom"><button data-action="prev" class="text-button reader-nav" ${chapter === 0 && fraction === 0 ? 'disabled' : ''}>${icon('back')} ${t("上一页")}</button><div class="reading-progress"><span id="progress-label">${b.chapters.length ? t('第 {number} 章', { number: chapter + 1 }) : t("试读")}</span><div class="progress-track"><div id="progress-bar"></div></div></div><button class="icon-button bookmark-toggle ${marked?'bookmarked':''}" data-action="bookmark" title="${markButton}" aria-label="${markButton}" aria-pressed="${marked}">${icon('mark')}</button><button data-action="next" class="text-button reader-nav">${t("下一页")} ${icon('arrow')}</button></div></section></div>`; }
function applyReader() { const pane = document.querySelector<HTMLElement>('.reader-pane'); if (!pane)
    return; pane.style.setProperty('--reading-font', appearance.fonts.find(x => x.id === reader.font)?.family || appearance.fonts[0].family); pane.style.setProperty('--reading-size', reader.size + 'px'); pane.style.setProperty('--reading-line', String(reader.line)); pane.style.setProperty('--reading-width', reader.width + 'px'); pane.style.setProperty('--page-margin', Math.max(32, (pane.clientWidth - Math.min(reader.width,pane.clientWidth-96)) / 2) + 'px'); applyTheme(); pane.dataset.mode = reader.mode;pane.dataset.ruby=String(reader.showReadings!==false); }
function metrics() { const el = document.querySelector<HTMLElement>('#reader-scroll')!; return reader.mode === 'pages' ? { el, extent: Math.max(0, el.scrollWidth - el.clientWidth), offset: el.scrollLeft } : { el, extent: Math.max(0, el.scrollHeight - el.clientHeight), offset: el.scrollTop }; }
function showProgress() { const previous=root.querySelector<HTMLButtonElement>('[data-action=prev]');if(previous)previous.disabled=chapter===0&&fraction<=0.001;const label = document.querySelector('#progress-label'); const b = current(); if (label)
    label.textContent = b?.chapters.length ? `${t('第 {number} 章', { number: chapter + 1 })} · ${Math.round(fraction * 100)}%` : t("试读"); const bar = document.querySelector<HTMLElement>('#progress-bar'); if (bar)
    bar.style.width = fraction * 100 + '%'; syncBookmarkButton(); }
function restorePosition(f: number, textAnchor?: TextAnchor | null) { fraction = f; cancelAnimationFrame(restoreFrame); restoring = true; restoreFrame = requestAnimationFrame(() => { if(view!=='reader'||!document.querySelector('#reader-scroll')){restoring=false;return;}const { el, extent } = metrics(); const range=textAnchor?anchorRange(el,textAnchor):null; if (range) restoreAnchor(el,range,reader.mode); else if (reader.mode === 'pages') {
    const page = Math.max(1, el.clientWidth);
    el.scrollLeft = Math.round(f * extent / page) * page;
}
else
    el.scrollTop = f * extent; snapPage(el); const placed=metrics(); fraction = placed.extent ? placed.offset / placed.extent : 0; showProgress(); requestAnimationFrame(() => { restoring = false; }); }); }
function mountReader() { readerObserver?.disconnect(); applyReader();const pane=document.querySelector<HTMLElement>('.reader-pane')!;let width=pane.clientWidth,height=pane.clientHeight;readerObserver=new ResizeObserver(()=>{if(width===pane.clientWidth&&height===pane.clientHeight)return;width=pane.clientWidth;height=pane.clientHeight;cancelTurn();applyReader();const el=document.querySelector<HTMLElement>('#reader-scroll');if(el){snapPage(el);const {extent,offset}=metrics();fraction=extent?offset/extent:0;showProgress();}clearTimeout(bookmarkTimer);bookmarkTimer=setTimeout(relocateBookmarks,80);});readerObserver.observe(pane); const opening=pendingAnchor;pendingAnchor=null;restorePosition(fraction,opening); const scroller=document.querySelector<HTMLElement>('#reader-scroll')!;scroller.addEventListener('scroll', () => { if (restoring||!scroller.isConnected)
    return; const { extent, offset } = metrics(); fraction = extent ? offset / extent : 0; showProgress(); queueProgress(); }, { passive: true }); scroller.addEventListener('scrollend',()=>{if(turning||!scroller.isConnected||reader.mode!=='pages')return;const page=Math.max(1,scroller.clientWidth),max=Math.max(0,scroller.scrollWidth-scroller.clientWidth),left=Math.min(max,Math.round(scroller.scrollLeft/page)*page);if(Math.abs(scroller.scrollLeft-left)>1){restoring=true;scroller.scrollLeft=left;const extent=Math.max(0,scroller.scrollWidth-scroller.clientWidth);fraction=extent?left/extent:0;showProgress();queueProgress();requestAnimationFrame(()=>{restoring=false;});}}); clearTimeout(bookmarkTimer);bookmarkTimer=setTimeout(relocateBookmarks,60); }
function queueProgress() { clearTimeout(progressTimer); if (!current()?.chapters.length)
    return; const id = selected!, progress = { chapter, fraction }; current().progress = progress; progressTimer = setTimeout(() => { savePending = savePending.then(() => api('progress', { id, progress })).catch(e => toast(e.message)); }, 200); }
async function flushProgress() { clearTimeout(progressTimer); if (view === 'reader' && current()?.chapters.length) {
    const id = selected!, progress = { chapter, fraction };
    current().progress = progress;
    await savePending;
    await api('progress', { id, progress });
} }
async function openBook(id: string) { cancelTurn(); await flushProgress(); selected = id; chapter = current().progress.chapter; fraction = current().progress.fraction; view = 'reader'; render(); }
async function changeChapter(n: number, f = 0, textAnchor?: TextAnchor | null) { const b = current(); if (n < 0 || n >= b.chapters.length)
    return; await flushProgress(); chapter = n; fraction = f; pendingAnchor = textAnchor ?? null; render(); queueProgress(); }
function cancelTurn(){turnToken++;turning=false;document.body.dataset.turning='false';pageTransition?.cancel();pageTransition=null;}
async function animateTurn(dir:number,move:()=>Promise<void>){
 if(turning)return;const effect=reader.effect||'none';
 if(reader.mode!=='pages'||effect==='none'||window.matchMedia('(prefers-reduced-motion: reduce)').matches){await move();return;}
 turning=true;document.body.dataset.turning='true';const token=++turnToken,id=selected;const transition=new ReaderTransition(effect,dir,document.querySelector<HTMLElement>('#reader-scroll')!);pageTransition=transition;
 try{await move();await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));if(token!==turnToken||view!=='reader'||selected!==id)return;await transition.play(document.querySelector<HTMLElement>('#reader-scroll')!);await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));}
 finally{const el=token===turnToken?document.querySelector<HTMLElement>('#reader-scroll'):null;if(el)snapPage(el);transition.cancel();if(pageTransition===transition)pageTransition=null;if(token===turnToken){turning=false;document.body.dataset.turning='false';}}
}
async function page(dir:number){if(turning)return;const {extent,offset}=metrics();if(dir>0&&offset>=extent-3&&chapter>=current().chapters.length-1){toast(t(current().chapters.length>=current().preset.totalChapters?'你已经读完这个故事。':'已读到最新章节，可以生成下一章。'));return;}if(dir<0&&offset<=3&&chapter===0)return;await animateTurn(dir,async()=>{const {el,extent,offset}=metrics();if(dir>0&&offset>=extent-3){await changeChapter(chapter+1);return;}if(dir<0&&offset<=3){await changeChapter(chapter-1,1);return;}if(reader.mode==='pages'){const page=Math.max(1,el.clientWidth),max=Math.max(0,el.scrollWidth-el.clientWidth);el.scrollLeft=Math.min(max,Math.max(0,Math.round(el.scrollLeft/page)*page+dir*page));snapPage(el);}else el.scrollBy({left:0,top:el.clientHeight*.86*dir,behavior:'instant'});});}
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',event=>{if(event.matches)cancelTurn();});
function modalShell(title: string, body: string, wide = false) { return `<div class="modal-overlay"><section class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><div><div class="eyebrow">${t("LEAFLIGHT STUDIO")}</div><h2>${title}</h2></div><button class="close" data-action="close" aria-label="${t("关闭")}">×</button></header>${body}</section></div>`; }
function presetForm() { const presets = settings.presets; return `<p class="modal-subtitle">${t("选一个方向，补充想法，先读试读再决定。")}</p><ol class="workflow-guide"><li>${t("选方向")}</li><li>${t("加想法")}</li><li>${t("看试读")}</li></ol><form id="story-form"><section class="creation-step"><h3>${t("1 · 选择阅读方向")}</h3><p class="step-help">${t("不确定怎么选？直接使用默认设置，或从预设开始。")}</p><label>${t("从预设开始")}<select id="preset-picker"><option value="">${t("自定义故事")}</option><optgroup label="${t('我的预设')}">${presets.map((p, i) => `<option value="${i}">${esc(t(p.name))}</option>`).join('')}</optgroup><optgroup label="${t('科学冒险预设 · 英文 / 日文')}">${(['en','ja'] as const).map(lang=>scienceCatalog.units.map(u=>`<option value="science:${lang}:${u.id}">${lang.toUpperCase()} · ${esc(u.title[uiLanguage])}</option>`).join('')).join('')}</optgroup></select></label><div class="form-grid"><label>${t("小说语言")}<select name="language"><option value="en">${t("English · 英文")}</option><option value="ja">${t("日本語 · 日文")}</option></select></label><label>${t("语言水平")}<select name="level">${levelOptions('en')}</select><small>${t("英文 CEFR / 日文 JLPT，仅作为难度目标")}</small></label></div><details class="science-customize"><summary>${t("自选知识主线与进阶")}</summary><div id="science-form-host">${scienceChooser(storyScience,'en')}</div></details></section><section class="creation-step"><h3>${t("2 · 加入你的故事想法")}</h3><label>${t("故事题材")}<select name="genre">${Object.entries(genreNames).map(([v, label]) => `<option value="${v}">${t(label)}</option>`).join('')}</select></label><label>${t("你想读怎样的故事？")}<textarea name="preferences" rows="3" maxlength="3000" placeholder="${t("例如：温暖的海边小镇、成年主角、轻悬疑。少用生僻词，不要幼稚化情节。")}"></textarea></label><p class="step-help">${t("可留空。人物、场景与情节以你的想法为主；切换预设不会清空这里。")}</p><details class="preference-rules"><summary>${t("设定冲突时如何处理？")}</summary><p>${t("语言、难度、题材和篇幅以上方选项为准。科学预设保留知识主线和真实科学；魔法可以存在，但要与现实规律区分。矛盾想法会在试读中说明如何调整。")}</p></details></section><details id="story-advanced"><summary>${t("篇幅与更多选项 · 可保持默认")}</summary><div class="form-grid"><label>${t("每章目标篇幅")}<select name="words">${lengthOptions('en')}</select></label><label>${t("故事总章数")}<input name="totalChapters" type="number" min="1" max="100" value="10" required><small>${t("1–100 章，有计划地走向结局")}</small></label></div><div class="preset-save"><input id="preset-name" maxlength="80" placeholder="${t("给这组预设起个名字（可选）")}" aria-label="${t("预设名称")}">${button('save-preset', t("保存预设"))}</div><div class="comparison-option">${button('comparison',t('同情节难度对照'))}<small>${t("拿不准语言等级？比较同一场景的两种难度。")}</small></div></details><section class="creation-step creation-finish"><h3>${t("3 · 先看试读，再加入书架")}</h3><p id="story-summary" class="story-summary" role="status"></p>${!settings.hasKey?`<p class="step-help">${t("第一次生成？先填写 Gemini Key，你的创作设定会保留。")}</p>${button('guide-settings',t('配置 Gemini'),'secondary')}`:''}<div class="generation-note">✧ ${t("先生成简介与短试读，满意后再创建作品。联网调用 Gemini，可能消耗 API 额度。")}</div><div class="modal-footer">${button('preview', icon('spark') + ` ${t("生成故事试读")}`, 'primary')}</div><p class="step-help">${t("提交后可关掉窗口继续阅读，进度和结果会留在消息盒子里。")}</p></section></form>`; }
function renderModal() { const host = document.querySelector('#modal-host')!; if (!modal) {
    host.innerHTML = '';
    return;
} let html = '';if(modal==='science-notebook'&&current()?.preset.science){const s=current().preset.science!;html=modalShell(t('科学笔记与读写联动'),`${sciencePanel(s)}<p class="generation-note">${t('用同一知识主线开始独立写作，练习将科学证据放进故事或报告。不会自动生成答案。')}</p><div class="button-row">${button('science-write-story',t('写一篇探险手记'))}${button('science-write-evidence',t('写一份证据报告'))}${scienceCatalog.units.some(u=>u.domain===s.domain&&u.order===s.order+1)?button('science-next',t('为下一知识单元创作故事')):''}</div>`);} if (modal === 'new')
    html = modalShell(t("开始一个新故事"), presetForm()); if (modal === 'plan')
    html = modalShell(t("你的故事，初见"), `<div class="preview-badge">${esc(plan.preset.level)} · ${esc(genreLabel(plan.preset.genre))} · ${t('{count} 章', { count: plan.preset.totalChapters })}</div><section class="plan-settings"><h3>${t('设定核对')}</h3><p class="step-help">${t('选项决定语言与篇幅，你的想法决定人物与情节；科学主线保留真实规律。')}</p>${Array.isArray(plan.preferenceNotes)?(plan.preferenceNotes.length?`<ul>${plan.preferenceNotes.map((note:string)=>`<li>${esc(note)}</li>`).join('')}</ul>`:`<p>${t('AI 未报告设定冲突；创建前仍请核对简介与试读。')}</p>`):`<p>${t('本次结果未提供冲突说明，请核对试读是否符合你的想法。')}</p>`}</section><h3 class="plan-title">${esc(plan.title)}</h3><p class="plan-synopsis">${esc(plan.synopsis)}</p><div class="preview-text" lang="${plan.preset.language||'en'}">${rubyText(plan.sample,plan.sampleReadings).replace(/\n/g, '<br>')}</div><p class="muted">${t(plan.sampleDifficulty?.warnings.length?'本地难度检查有提示，建议在创建前查看。':'可先查看本地难度检查，再决定是否创建作品。')}</p><details><summary>${t("查看章节大纲")}</summary><ol>${plan.outline.map((x: string) => `<li>${esc(x)}</li>`).join('')}</ol></details><div class="modal-footer">${button('preview-difficulty',t('查看难度检查'))}${button('new', t("调整设定"))}${button('create', t("创建并加入书架"), 'primary')}</div>`); if (modal === 'settings')
    html = modalShell(t("系统设置"), `<fieldset class="system-theme"><legend>${t("界面主题")}</legend><p class="step-help">${t("应用于整个书房，点击即生效并自动保存。")}</p><div class="theme-options">${appearance.themes.map(theme => `<label class="theme-swatch" style="background:${theme.bg};color:${theme.ink};border-color:${theme.border}"><input type="radio" name="theme" value="${theme.id}" ${reader.theme === theme.id ? 'checked' : ''}><span>${t(theme.name)}</span></label>`).join('')}</div></fieldset><form id="settings-form"><label>${t("界面语言")}<select name="uiLanguage">${[['zh', '简体中文'], ['ja', '日本語'], ['en', 'English']].map(([v, label]) => `<option value="${v}" ${settings.uiLanguage === v ? 'selected' : ''}>${label}</option>`).join('')}</select><small>${t("界面语言与小说语言互相独立。")}</small></label><label>${t("Gemini 模型 ID")}<input name="model" value="${esc(settings.model)}" required placeholder="gemini-2.5-flash"><small>${t("支持 generateContent 与 JSON 结构化输出的模型，可随时更换。")}</small></label><label>Gemini API Key<input name="apiKey" type="password" autocomplete="off" value="${settings.hasKey?KEY_MASK:''}" placeholder="${settings.hasKey ? t("已加密保存，输入以替换") : t("粘贴你的 Gemini API Key")}"><small>${t("使用系统安全存储加密，仅在调用 Gemini 时使用，不写入备份。")}</small></label><label class="checkbox"><input type="checkbox" name="clearKey">${t("移除已保存的 API Key")}</label>${!settings.encryptionAvailable ? `<p class="warning">${t("系统安全存储不可用，暂不能保存密钥。")}</p>` : ''}<p class="generation-note">${t("生成需要联网；阅读、翻页和进度保存可以离线使用。API 费用由你的 Google 账户承担，免费额度随模型和账户而异。没有自动批量生成或自动重试。")}</p>${settings.lastUsage?.totalTokenCount ? `<p class="muted">${t('最近一次生成总用量：{count} tokens（以服务返回为准）', { count: settings.lastUsage.totalTokenCount.toLocaleString() })}</p>` : ''}<div class="modal-footer">${button('save-settings', t("保存设置"), 'primary')}</div></form><div class="settings-divider"></div><h3>${t("备份与迁移")}</h3><p class="muted">${t("备份作品、写作草稿、评审历史、书签、进度与预设，不包含 API Key。导入时保留同 ID 的现有内容，并恢复备份预设。")}</p><div class="button-row">${button('backup', icon('download') + ` ${t("导出备份")}`)}${button('restore', t("导入备份"))}${button('demo', t("打开离线示例"))}</div>`); if (modal === 'appearance')
    html = modalShell(t("舒服地读下去"), `<form id="reader-form"><div class="form-grid"><label>${t("字体")}<select name="font">${appearance.fonts.map(font => `<option value="${font.id}" ${reader.font === font.id ? 'selected' : ''}>${t(font.name)}</option>`).join('')}</select><small>${t("使用本地字体，缺失时自动回退。")}</small></label><label>${t("阅读模式")}<select name="mode"><option value="scroll" ${reader.mode === 'scroll' ? 'selected' : ''}>${t("连续滚动")}</option><option value="pages" ${reader.mode === 'pages' ? 'selected' : ''}>${t("左右分页")}</option></select></label></div><label>${t('翻页特效')}<select name="effect">${[['none','无特效'],['cube-in','Cube (inward) · 内凹立方体'],['cube-out','Cube (outward) · 外凸立方体'],['paper','Paper · 右下角卷页'],['flip','Flip · 卡片翻转'],['bounce','Bounce · 弹跳回弹'],['fade','Fade · 淡入淡出'],['carousel','Carousel · 旋转木马'],['slide','Slide · 水平滑动']].map(([value,label])=>`<option value="${value}" ${(reader.effect||'none')===value?'selected':''}>${t(label)}</option>`).join('')}</select><small>${t('分页模式下对按钮和键盘翻页生效；系统开启减少动态效果时自动停用。')}</small></label><label>${t("字号")} <output id="size-label">${reader.size}px</output><input type="range" name="size" min="14" max="32" step="1" value="${reader.size}"></label><label>${t("行距")} <output id="line-label">${reader.line}</output><input type="range" name="line" min="1.3" max="2.4" step="0.05" value="${reader.line}"></label><label>${t("正文宽度")} <output id="width-label">${reader.width}px</output><input type="range" name="width" min="480" max="1000" step="20" value="${reader.width}"></label><label class="checkbox"><input type="checkbox" name="showReadings" ${reader.showReadings!==false?'checked':''}>${t("显示日文注音")}</label><small>${t("注音只在提供读音的新内容中显示，由模型生成，可能有误。")}</small><p class="muted">${t("设置实时生效并自动保存。← / → 或 Page Up / Page Down 翻页。")}</p></form>`); if(modal==='difficulty'&&difficultyData)html=modalShell(t('难度检查与阅读反馈'),`${difficultyBody(difficultyData.report)}${difficultyContext==='chapter'?`<div class="feedback-panel"><h3>${t('这一章读起来怎么样？')}</h3><div class="button-row">${[['hard','太难'],['right','刚好'],['easy','太简单']].map(([rating,label])=>`<button data-action="feedback" data-rating="${rating}" class="secondary ${difficultyData!.feedback===rating?'chosen':''}" aria-pressed="${difficultyData!.feedback===rating}">${t(label)}</button>`).join('')}</div><p>${calibrationLabel(difficultyData.adjustment)}</p><small>${t('仅影响本书后续生成；最近 8 章的反馈参与校准，同一章重复选择会替换原反馈。不会自动生成或改写已有章节。')}</small></div>`:difficultyContext==='preview'?button('back-plan',t('返回试读')):''}`);if(modal==='comparison')html=modalShell(t('同情节难度对照'),comparisonBody(),true);if(modal==='delete'){const book=books.find(b=>b.id===pendingDelete);if(book)html=modalShell(t('删除这部作品？'),`<h3 class="delete-title">${esc(book.title)}</h3><p class="modal-subtitle">${t('作品及其章节、书签和进度将移入回收站，可随时恢复。')}</p><div class="modal-footer">${button('close',t('取消'))}${button('confirm-delete',t('移入回收站'),'danger')}</div>`);}if(modal==='trash')html=modalShell(t('回收站'),`<p class="modal-subtitle">${t('这里的作品不会显示在书架中，恢复时会保留章节和阅读进度。')}</p>${trashedBooks.length?`<div class="trash-list">${trashedBooks.map(book=>`<div class="trash-item"><div><h3>${esc(book.title)}</h3><p class="muted">${t('{count} 章',{count:book.chapters.length})} · ${new Date(book.deletedAt).toLocaleDateString()}</p></div><button class="secondary" data-action="recover" data-id="${esc(book.id)}">${t('恢复到书架')}</button></div>`).join('')}</div>`:`<p class="empty-note">${t('回收站是空的。')}</p>`}`);if (modal === 'export')
    html = modalShell(t("带上你的故事"), `<p class="modal-subtitle">${t('导出已归档的 {count} 个章节，可在其他阅读器打开。', { count: current().chapters.length })}</p><div class="button-row">${button('export-txt', t("导出 TXT"))}${button('export-epub', t("导出 EPUB"), 'primary')}</div>`); host.innerHTML = html;if(modal==='new')refreshStoryGuide(); const first = host.querySelector<HTMLElement>('input,select,button'); first?.focus(); }
function showModal(name: string) { if(name==='new')storyScience=draftPreset?.science||null;if(name==='settings')keyDirty=false;modal = name; renderModal(); if (name === 'new' && draftPreset) {
    const f = document.querySelector<HTMLFormElement>('#story-form')!;
    fillPreset(draftPreset);
} }
function formPreset() { const f = document.querySelector<HTMLFormElement>('#story-form')!; const d = new FormData(f); return { language: String(d.get('language')) as 'en' | 'ja', level: String(d.get('level')), genre: String(d.get('genre')), words: Number(d.get('words')), totalChapters: Number(d.get('totalChapters')), preferences: String(d.get('preferences')),...(storyScience?{science:storyScience}:{}) }; }
async function action(a: string, target: HTMLElement) {
    a=({'guide-demo':'demo','guide-new':'new','guide-writing':'writing','guide-settings':'settings'} as Record<string,string>)[a]||a;
    if(modal==='new'&&document.querySelector('#story-form'))draftPreset=formPreset();
    if(await writer.action(a,target))return;
    if(view==='writing')await writer.flush();
    switch (a) {
        case 'science-source':await api('science-source',{id:target.dataset.id});break;
        case 'science-next':{const b=current(),s=b.preset.science;if(!s)break;const next=scienceCatalog.units.find(u=>u.domain===s.domain&&u.order===s.order+1);if(next){draftPreset={...b.preset,science:getScience(next.id,s.language)!};showModal('new');}break;}
        case 'science-notebook':showModal('science-notebook');break;
        case 'science-write-story':case 'science-write-evidence':{const s=current().preset.science;if(!s)break;await flushProgress();const fresh=await api('writing-new',{title:scienceTitle(s),language:s.language,text:'',goal:'',topicId:s.language+'-science-'+s.id+'-'+(a==='science-write-story'?'story':'evidence')});await writer.open(fresh.id);view='writing';modal='';render();break;}
        case 'writing':await flushProgress();await writer.open();view='writing';modal='';render();break;
        case 'new':
            showModal('new');
            break;
        case 'close':
            modal = '';
            renderModal();
            break;
        case 'library':
            cancelTurn();
            await flushProgress();
            view = 'library';
            modal = '';
            render();
            break;
        case 'filter':
            filter = target.dataset.filter!;
            render();
            break;
        case 'open':
            await openBook(target.dataset.id!);
            break;
        case 'delete':pendingDelete=target.dataset.id!;showModal('delete');break;
        case 'confirm-delete':{if(!pendingDelete)break;await savePending;const id=pendingDelete;books=await api('delete-book',{id});if(selected===id){clearTimeout(progressTimer);selected=null;chapter=0;fraction=0;}pendingDelete=null;modal='';view='library';render();toast(t('作品已移入回收站，可在那里恢复。'));break;}
        case 'trash':trashedBooks=await api('trash');showModal('trash');break;
        case 'recover':books=await api('recover-book',{id:target.dataset.id});trashedBooks=await api('trash');render();toast(t('作品已恢复到书架。'));break;
        case 'settings':
            showModal('settings');
            break;
        case 'appearance':
            cancelTurn();showModal('appearance');
            break;
        case 'preview-difficulty':difficultyContext='preview';difficultyData={report:plan.sampleDifficulty,feedback:null,adjustment:0};showModal('difficulty');break;
        case 'back-plan':showModal('plan');break;
        case 'difficulty':{const b=current(),c=b.chapters[chapter];if(!c){difficultyContext='saved-preview';difficultyData=await api('difficulty',{id:b.id,chapterId:'sample'});showModal('difficulty');break;}difficultyContext='chapter';difficultyData=await api('difficulty',{id:b.id,chapterId:c.id});showModal('difficulty');break;}
        case 'feedback':{const b=current(),c=b.chapters[chapter];updateBook(await api('feedback',{id:b.id,chapterId:c.id,rating:target.dataset.rating}));difficultyData=await api('difficulty',{id:b.id,chapterId:c.id});showModal('difficulty');toast(t('反馈已保存，下次生成将采用校准后的规则。'));break;}
        case 'comparison':{draftPreset=formPreset();compareLevels=[];comparison=await api('comparison');if(comparison?.language===(draftPreset.language||'en'))compareScene=comparison.scene;showModal('comparison');break;}
        case 'run-comparison':{const f=document.querySelector<HTMLFormElement>('#comparison-form')!;if(!f.reportValidity())break;const d=new FormData(f);compareScene=String(d.get('scene'));compareLevels=[String(d.get('levelA')),String(d.get('levelB'))];if(compareLevels[0]===compareLevels[1]){toast(t('请选择两个不同等级。'));break;}await api('compare',{preset:draftPreset,scene:compareScene,levels:compareLevels});await submitted();break;}
        case 'export':
            showModal('export');
            break;
        case 'demo': {
            const b = await api<Book>('demo');
            updateBook(b);
            modal = '';
            await openBook(b.id);
            break;
        }
        case 'chapter':
            cancelTurn();
            await changeChapter(Number(target.dataset.chapter));
            break;
        case 'prev':
            await page(-1);
            break;
        case 'next':
            await page(1);
            break;
        case 'bookmark':
            if (!current().chapters.length) {
                toast(t("生成完整章节后可添加书签。"));
                break;
            }
            await flushProgress();
            const scroller=document.querySelector<HTMLElement>('#reader-scroll');
            const anchor=scroller?captureTextAnchor(scroller):null;
            updateBook(await api('bookmark', { id: selected, progress: { chapter, fraction, ...(anchor??{}) } }));
            await refreshLibrary();
            relocateBookmarks();
            syncBookmarkButton();
            toast(t(isBookmarked(current())?"已添加书签":"已取消书签"));
            break;
        case 'goto-mark': { cancelTurn();
            const mark = current().bookmarks.find(x => x.id === target.dataset.mark)!;
            const textAnchor=hasAnchor(mark)?{paragraph:mark.paragraph,index:mark.index}:null;
            if(mark.chapter===chapter&&textAnchor){const el=document.querySelector<HTMLElement>('#reader-scroll');const range=el&&anchorRange(el,textAnchor);if(el&&range){restoring=true;restoreAnchor(el,range,reader.mode);snapPage(el);const {extent,offset}=metrics();fraction=extent?offset/extent:0;showProgress();queueProgress();requestAnimationFrame(()=>{restoring=false;});break;}}
            await changeChapter(mark.chapter, mark.fraction, textAnchor);
            break;
        }
        case 'save-preset': {
            const name = document.querySelector<HTMLInputElement>('#preset-name')!.value.trim();
            if (!name) {
                toast(t("请给预设起个名字。"));
                break;
            }
            const preset = formPreset();
            const next = [...settings.presets.filter(x => x.name !== name), { name, preset }];
            settings.presets = await api('save-presets', next);
            const picker=document.querySelector<HTMLSelectElement>('#preset-picker')!;picker.querySelector('optgroup')!.replaceChildren(...settings.presets.map((item,index)=>new Option(t(item.name),String(index))));picker.value=String(settings.presets.findIndex(item=>item.name===name));
            toast(t("预设已保存"));
            break;
        }
        case 'preview': {
            const form = document.querySelector<HTMLFormElement>('#story-form')!;
            if(!form.checkValidity())form.querySelector<HTMLDetailsElement>('#story-advanced')!.open=true;
            if (!form.reportValidity())
                break;
            const preset = formPreset();
            draftPreset = preset;
            await api('preview',preset);await submitted();
            break;
        }
        case 'create': {
            const b = await api<Book>('create',{jobId:previewJobId});
            updateBook(b);
            plan = null;
            modal = '';
            await openBook(b.id);
            toast(t("作品已创建，点击「生成下一章」开始连载。"));
            break;
        }
        case 'generate':await api('generate',{id:selected});await submitted();break;
        case 'inbox':inboxOpen=target.closest('.generation-controls')?true:!inboxOpen;renderInbox();break;
        case 'close-inbox':inboxOpen=false;renderInbox();break;
        case 'read-jobs':jobs=await api('jobs-read',{items:jobs.map(j=>({id:j.id,revision:j.revision}))});renderInbox();break;
        case 'cancel-job':jobs=await api('cancel',{id:target.dataset.id});renderInbox();break;
        case 'retry-job':await api('retry-job',{id:target.dataset.id});await submitted();break;
        case 'view-job':{
          const job=await api('job',{id:target.dataset.id});inboxOpen=false;jobs=await api('jobs-read',{items:[{id:job.id,revision:job.revision}]});renderInbox();
          if(job.type==='review'){await flushProgress();await writer.openReview(job.result.draftId,job.result.reviewId);view='writing';modal='';render();}
          else if(job.type==='preview'){previewJobId=job.id;plan={...job.result.plan,preset:job.result.preset};draftPreset=job.result.preset;showModal('plan');}
          else if(job.type==='compare'){comparison=job.result.comparison;draftPreset=job.result.preset;compareScene=comparison!.scene;compareLevels=comparison!.variants.map(v=>v.level);showModal('comparison');}
          else{await refreshLibrary();const b=books.find(b=>b.id===job.result.bookId);if(!b){toast(t('作品已在回收站，请先恢复。'));break;}await openBook(b.id);const index=b.chapters.findIndex(c=>c.id===job.result.chapterId);if(index>=0)await changeChapter(index);}
          break;
        }
        case 'save-settings': {
            const f = document.querySelector<HTMLFormElement>('#settings-form')!;
            if (!f.reportValidity())
                break;
            const d = new FormData(f);
            settings = await api('save-settings', { uiLanguage: d.get('uiLanguage'), model: d.get('model'), apiKey: keyDirty&&d.get('apiKey')!==KEY_MASK?d.get('apiKey'):'', clearKey: d.has('clearKey') });
            setLocale(settings.uiLanguage);
            modal = 'settings';
            render();
            toast(t("设置已保存"));
            break;
        }
        case 'backup':
            await flushProgress();
            if (await api('backup'))
                toast(t("备份已导出"));
            break;
        case 'restore': {
            const result = await api<Book[] | false>('restore');
            if (result) {
                books = result;
                settings = await api('settings');
                reader = { ...reader, ...settings.reader };
                setLocale(settings.uiLanguage);
                modal = '';
                view = 'library';
                render();
                toast(t("备份已导入"));
            }
            break;
        }
        case 'export-txt':
        case 'export-epub':
            await flushProgress();
            if (await api('export', { id: selected, format: a === 'export-txt' ? 'txt' : 'epub' }))
                toast(t("故事已导出"));
            break;
    }
}
root.addEventListener('click', e => { const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action]'); if (!target || target.hasAttribute('disabled'))
    return; e.preventDefault();if(!['prev','next'].includes(target.dataset.action!))cancelTurn(); action(target.dataset.action!, target).catch(e => toast(e.message)); });
root.addEventListener('submit', e => e.preventDefault());
root.addEventListener('focusin',e=>{const el=e.target as HTMLInputElement;if(el.name==='apiKey'&&el.value===KEY_MASK)el.select();});
root.addEventListener('input', e => { const el = e.target as HTMLInputElement;writer.input(el);if(el.closest('#story-form'))refreshStoryGuide();if(el.name==='apiKey')keyDirty=true; if (el.id === 'search') {
    search = el.value;
    const pos = el.selectionStart;
    render();
    const next = document.querySelector<HTMLInputElement>('#search');
    next?.focus();
    next?.setSelectionRange(pos, pos);
} if (el.closest('#reader-form'))
    changeAppearance(); });
root.addEventListener('change', e => { const el = e.target as HTMLInputElement;if(el.id==='writing-review-picker'){void writer.pickReview(el.value);return;}if(el.id.startsWith('science-')&&el.closest('#story-form')){const f=document.querySelector<HTMLFormElement>('#story-form')!,lang=(f.elements.namedItem('language') as HTMLSelectElement).value as 'en'|'ja';if(el.id==='science-track'&&el.value==='free')storyScience=null;else if(el.id==='science-unit')storyScience=getScience(el.value,lang);else{const stage=document.querySelector<HTMLSelectElement>('#science-stage')?.value||'primary',domain=document.querySelector<HTMLSelectElement>('#science-domain')?.value||'physical';const unit=scienceCatalog.units.find(u=>u.stage===stage&&u.domain===domain)!;storyScience=getScience(unit.id,lang);}document.querySelector('#science-form-host')!.innerHTML=scienceChooser(storyScience,lang);refreshStoryGuide();return;}if(el.name==='theme'&&el.closest('.system-theme')){reader={...reader,theme:el.value};applyTheme();clearTimeout(readerTimer);readerTimer=setTimeout(()=>api('save-reader',reader).catch(e=>toast(e.message)),150);return;}if(el.name==='clearKey'){const key=el.form!.elements.namedItem('apiKey') as HTMLInputElement;key.disabled=el.checked;key.value=el.checked?'':settings.hasKey?KEY_MASK:'';keyDirty=false;} if (el.closest('#reader-form'))
    changeAppearance(); if (el.name === 'language' && el.closest('#story-form')) {
    const f = el.form!;
    (f.elements.namedItem('level') as HTMLSelectElement).innerHTML = levelOptions(el.value);
    (f.elements.namedItem('words') as HTMLSelectElement).innerHTML = lengthOptions(el.value);if(storyScience)storyScience={...storyScience,language:el.value as 'en'|'ja'};document.querySelector('#science-form-host')!.innerHTML=scienceChooser(storyScience,el.value as 'en'|'ja');
} if (el.id === 'preset-picker' && el.value !== '') {
    const parts=el.value.split(':');const lang=parts[1] as 'en'|'ja';const science=parts[0]==='science'?getScience(parts[2],lang):null;const preset:Preset=science?{language:lang,level:lang==='ja'?(({primary:'N4',middle:'N3',high:'N2'} as Record<string,string>)[science.stage]||'N3'):(({primary:'A2',middle:'B1',high:'B2'} as Record<string,string>)[science.stage]||'B1'),genre:['fantasy','mystery','adventure'][(science.order-1)%3],words:lang==='ja'?1600:1000,totalChapters:6,preferences:'',science}:settings.presets[Number(el.value)].preset;
    const f = document.querySelector<HTMLFormElement>('#story-form')!;
    const typed=(f.elements.namedItem('preferences') as HTMLTextAreaElement).value;
    fillPreset({...preset,preferences:typed.trim()?typed:preset.preferences});
    if(typed.trim())toast(t('已切换预设，你的故事想法已保留。'));
} if(el.closest('#story-form'))refreshStoryGuide(); });
function changeAppearance() { const f = document.querySelector<HTMLFormElement>('#reader-form'); if (!f)
    return; const d = new FormData(f); const scroller=document.querySelector<HTMLElement>('#reader-scroll');const anchor=scroller?captureAnchor(scroller):null;const previous=fraction;if(view==='reader'&&current()?.bookmarks.some(mark=>!hasAnchor(mark)))relocateBookmarks();cancelTurn();cancelAnimationFrame(restoreFrame);reader = { effect:String(d.get('effect')) as Reader['effect'],showReadings:d.has('showReadings'),theme: reader.theme, font: String(d.get('font')), mode: String(d.get('mode')), size: Number(d.get('size')), line: Number(d.get('line')), width: Number(d.get('width')) }; applyReader();if(scroller&&anchor){restoring=false;restoreAnchor(scroller,anchor,reader.mode);snapPage(scroller);const {extent,offset}=metrics();fraction=extent?offset/extent:0;showProgress();queueProgress();}else restorePosition(previous); clearTimeout(bookmarkTimer);bookmarkTimer=setTimeout(relocateBookmarks,80); for (const k of ['size', 'line', 'width'] as const) {
    const el = document.querySelector(`#${k}-label`);
    if (el)
        el.textContent = String(reader[k]) + (k === 'line' ? '' : 'px');
} clearTimeout(readerTimer); readerTimer = setTimeout(() => api('save-reader', reader).catch(e => toast(e.message)), 150); }
window.addEventListener('keydown', e => { if(view==='writing'&&!modal&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'){e.preventDefault();void writer.flush().then(()=>toast(t('草稿已保存。'))).catch(error=>toast(error.message));return;} if (e.key === 'Escape') {
    if(modal){if(modal==='new')draftPreset=formPreset();modal = '';renderModal();}else if(inboxOpen){inboxOpen=false;renderInbox();}
    return;
} if (modal) {
    if (e.key === 'Tab') {
        const nodes = Array.from(document.querySelectorAll<HTMLElement>('.modal button,.modal input,.modal select,.modal textarea,.modal summary')).filter(x => !x.hasAttribute('disabled')&&x.getClientRects().length>0);
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            last?.focus();
            e.preventDefault();
        }
        else if (!e.shiftKey && document.activeElement === last) {
            first?.focus();
            e.preventDefault();
        }
    }
    return;
} if (view !== 'reader' || (e.target as HTMLElement).matches('input,textarea,select') || !!(e.target as HTMLElement).closest('.inbox'))
    return; if (['ArrowRight', 'PageDown', 'ArrowLeft', 'PageUp'].includes(e.key)) {
    e.preventDefault();
    page(['ArrowRight', 'PageDown'].includes(e.key) ? 1 : -1).catch(e => toast(e.message));
} });

window.addEventListener('beforeunload', () => { void writer.flush(); void flushProgress(); if (readerTimer)
    void api('save-reader', reader); });
async function init() { try {
    [books, settings,jobs] = await Promise.all([api<Book[]>('library'), api<Settings>('settings'),api<Job[]>('jobs')]);
    window.leaflight?.onJobs?.(next=>{void receiveJobs(next).catch(e=>toast(e.message));});
    reader = { ...reader, ...settings.reader };
    setLocale(settings.uiLanguage);
    writer.tasks=jobs;
    render();
}
catch (e) {
    root.innerHTML = `<div class="startup-error"><h1>Leaflight</h1><p>${esc((e as Error).message)}</p><p>${t("请在项目目录运行")} <code>npm run dev</code>。</p></div>`;
} }
window.leaflight?.onClose?.(async () => { await writer.flush();await flushProgress(); clearTimeout(readerTimer); await api('save-reader', reader); });
void init();
