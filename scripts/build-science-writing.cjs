// Rebuild the offline writing tasks from the single curated science-unit source.
// No network, model calls or learner data are involved.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {units,domains}=require('../electron/science-units.json');
const categories=[],topics=[];
for(const language of ['en','ja']){
 for(const domain of domains)categories.push({id:`${language}-science-${domain.id}`,language,title:{zh:'科学冒险 · '+domain.title.zh,en:'Science adventures · '+domain.title.en,ja:'科学の冒険・'+domain.title.ja}});
 for(const u of units)for(const mode of ['story','evidence']){
  const narrative=mode==='story',index=['primary','middle','high'].indexOf(u.stage),minimum=(language==='en'?[100,180,300]:[250,450,750])[index];
  const suffix={zh:narrative?'探险手记':'证据报告',en:narrative?'Expedition journal':'Evidence report',ja:narrative?'探検の手記':'証拠の報告'};
  const prefix={zh:['基础 / ','机制 / ','模型 / '][index],en:['Foundations / ','Mechanisms / ','Models / '][index],ja:['基礎 / ','仕組み / ','モデル / '][index]};
  const title=Object.fromEntries(['zh','en','ja'].map(locale=>[locale,prefix[locale]+u.title[locale]+' · '+suffix[locale]]));
  let prompt,requirements,focus,planning,materials;
  if(language==='en'){
   prompt=u.hook.en+(narrative?' Write an original scene or field journal in which an investigator uses observation and the supplied science to make a decision. Invent characters and a problem, not new scientific laws.':' Write a reasoned report that separates what is observed, what is inferred and what remains unknown. You may propose an invented observation, but label it as fictional rather than a real measurement.');
   requirements=['Apply at least two reference ideas accurately to the situation.','Explain why a clue supports or fails to support a claim.','Label any magic, speculative technology or invented data as fictional.',narrative?'Use a clear narrative turning point and ending.':'Discuss an alternative explanation and what further evidence would help.'];
   focus=['Scientific cause and effect','Fact, inference and fiction',narrative?'Character-driven discovery':'Claims with evidence and limits'];
   planning=['What can the investigator actually observe?','Which reference idea rules out an attractive but mistaken explanation?','Where does the analogy or fictional premise stop matching real science?'];
   materials='Curated reference notes (not a claim that the fictional case is real):\n'+u.facts.en.map((fact,i)=>`${i+1}. ${fact}`).join('\n')+'\nCommon misconception to avoid: '+u.misconception.en+'\nNo real-world hazardous experiment is required; use a fictional case or supplied conceptual evidence.';
  }else{
   prompt=u.hook.ja+(narrative?' 観察と下の科学の考え方を使って判断する場面や手記を書いてください。人物や事件は創作しても、現実の科学法則は勝手に変えないでください。':' 観察、推論、まだ分からないことを分けた報告を書いてください。観測を創作する場合は、実際の測定結果ではなく架空の資料だと明示してください。');
   requirements=['参考となる考え方を二つ以上、場面に正確に当てはめる。','手がかりが主張を支えるかどうか、理由を説明する。','魔法、未確立の技術、創作データは架空だと区別する。',narrative?'判断が変わる場面と結びを描く。':'別の説明と、さらに必要な証拠を検討する。'];
   focus=['科学的な因果関係','事実・推論・創作の区別',narrative?'人物を通した発見':'根拠と限界のある主張'];
   planning=['調査する人物に実際に観察できることは何か。','魅力的でも誤った説明を、どの知識で退けられるか。','たとえや架空の設定はどこから現実と違うか。'];
   materials='参考となる科学のメモ（架空の事件が現実であるという意味ではありません）：\n'+u.facts.ja.map((fact,i)=>`${i+1}. ${fact}`).join('\n')+'\n避けたい誤解：'+u.misconception.ja+'\n危険を伴う現実の実験は不要です。架空の場面や提示した概念を使ってください。';
  }
  topics.push({id:`${language}-science-${u.id}-${mode}`,version:1,language,category:`${language}-science-${u.domain}`,title,prompt,requirements,focus,planning,length:{min:minimum,max:minimum+(language==='en'?[80,120,200]:[150,250,450])[index],unit:language==='en'?'words':'characters'},minutes:[20,30,45][index],materials,scienceUnitId:u.id});
 }
}
assert.equal(topics.length,units.length*4);assert.equal(new Set(topics.map(t=>t.id)).size,topics.length);
fs.writeFileSync(path.join(__dirname,'../electron/science-writing.json'),JSON.stringify({version:1,categories,topics},null,2)+'\n');
