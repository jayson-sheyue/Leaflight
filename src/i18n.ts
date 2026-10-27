import messages from '../electron/messages.json';
export type Locale='zh'|'en'|'ja';
export let uiLanguage:Locale='zh';
const catalog=messages as Record<string,{en:string;ja:string}>;
export function setLocale(locale:Locale){uiLanguage=['zh','en','ja'].includes(locale)?locale:'zh';document.documentElement.lang=uiLanguage==='zh'?'zh-CN':uiLanguage;document.title=uiLanguage==='zh'?'Leaflight · 故事书房':uiLanguage==='ja'?'Leaflight · 物語の書斎':'Leaflight · Story room';}
export function t(key:string,params:Record<string,string|number>={}){const message=uiLanguage==='zh'?key:(catalog[key]?.[uiLanguage]??key);return message.replace(/\{(\w+)\}/g,(token,name)=>String(params[name]??token));}
export function localizeError(message:string){let match=message.match(/^Gemini 服务返回错误（(.+)），请稍后重试。$/);if(match)return t('Gemini 服务返回错误（{status}），请稍后重试。',{status:match[1]});match=message.match(/^生成没有完整结束（(.+)），未保存，请重试或缩短篇幅。$/);if(match)return t('生成没有完整结束（{reason}），未保存，请重试或缩短篇幅。',{reason:t(match[1])});return t(message);}
