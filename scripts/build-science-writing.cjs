// Build factual writing exercises from the curated science reference units.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {units,domains}=require('../electron/science-units.json');const subjects=require('../electron/science-subjects.json');
const categories=[],topics=[];
for(const language of ['en','ja']){
 for(const domain of domains)categories.push({id:`${language}-science-${domain.id}`,language,title:{zh:'科学知识 · '+domain.title.zh,en:'Science concepts · '+domain.title.en,ja:'科学知識・'+domain.title.ja}});
 for(const u of units)for(const mode of ['concept','analysis']){
  const concept=mode==='concept',index=['primary','middle','high'].indexOf(u.stage),minimum=(language==='en'?[100,180,300]:[250,450,750])[index],subject=subjects[u.id];assert(subject,`Missing factual subject for ${u.id}`);
  const suffix={zh:concept?'概念解释':'证据与推理',en:concept?'Concept explanation':'Evidence and reasoning',ja:concept?'概念の説明':'根拠と推論'};
  const prefix={zh:['基础 / ','机制 / ','模型 / '][index],en:['Foundations / ','Mechanisms / ','Models / '][index],ja:['基礎 / ','仕組み / ','モデル / '][index]};
  const title=Object.fromEntries(['zh','en','ja'].map(locale=>[locale,prefix[locale]+subject[locale]+' · '+suffix[locale]]));
  let prompt,requirements,focus,planning,materials;
  if(language==='en'){
   prompt=concept?`Explain ${subject.en.toLowerCase()} to a reader learning the subject. Use the reference notes to describe the relevant concepts and how they relate, then address the common misconception.`:`Analyze a question about ${subject.en.toLowerCase()} using the reference notes. Distinguish observations or established ideas from inference; explain what evidence would help evaluate a claim and where the conclusion is limited.`;
   requirements=concept?['Explain at least two relevant reference ideas accurately.','Describe a relationship or mechanism in your own words.','Address the listed misconception without treating it as fact.','Use a clear, factual explanation suited to the reader.']:['State a question or claim about the subject.','Explain how at least two reference ideas bear on the claim.','Distinguish known facts from inference and identify a limitation.','Describe evidence that could help assess an alternative explanation.'];
   focus=concept?['Accurate scientific concepts','Mechanisms and relationships','Clear explanatory language']:['Claims and evidence','Reasoning and uncertainty','Scientific accuracy'];
   planning=concept?['Which terms does the reader need explained?','How do the relevant processes or concepts connect?','Why is the common misconception inaccurate?']:['What is the claim, and what is already known?','What evidence would distinguish possible explanations?','What cannot be concluded from the supplied notes alone?'];
   materials='Scientific reference notes:\n'+u.facts.en.map((fact,i)=>`${i+1}. ${fact}`).join('\n')+'\nCommon misconception to examine: '+u.misconception.en+'\nThese are conceptual reference notes, not measurements or a complete textbook. Do not invent sources or present imagined data as real. No experiment is required.';
  }else{
   prompt=concept?`${subject.ja}について、この分野を学ぶ読者に向けて説明してください。参考メモを使って関連する概念とその関係を述べ、よくある誤解にも触れましょう。`:`${subject.ja}に関する問いを、参考メモに基づいて分析してください。観察・確立された知識と推論を区別し、主張を検討するために必要な根拠と結論の限界を説明しましょう。`;
   requirements=concept?['参考メモの関連する考え方を二つ以上正確に説明する。','概念どうしの関係や仕組みを自分の言葉で述べる。','示された誤解を事実として扱わずに説明する。','読み手に分かるよう客観的に文章を組み立てる。']:['主題に関する問いや主張を示す。','参考メモの考え方を二つ以上使って主張を検討する。','既知の事実と推論を分け、結論の限界を示す。','別の説明を検討するために必要な根拠を述べる。'];
   focus=concept?['科学概念の正確さ','仕組みと関係','分かりやすい説明']:['主張と根拠','推論と不確実性','科学的な正確さ'];
   planning=concept?['読み手に説明が必要な用語は何か。','関連する概念や過程はどう結びつくか。','よくある誤解はなぜ正しくないか。']:['主張は何か、すでに分かっていることは何か。','異なる説明を区別するにはどのような根拠が必要か。','提示されたメモだけでは何を結論できないか。'];
   materials='科学の参考メモ：\n'+u.facts.ja.map((fact,i)=>`${i+1}. ${fact}`).join('\n')+'\n検討したい誤解：'+u.misconception.ja+'\nこれは概念を整理する参考メモであり、測定データや完全な教科書ではありません。出典や架空のデータを事実として作り上げないでください。実験は不要です。';
  }
  topics.push({id:`${language}-science-${u.id}-${mode}`,version:2,language,category:`${language}-science-${u.domain}`,title,prompt,requirements,focus,planning,length:{min:minimum,max:minimum+(language==='en'?[80,120,200]:[150,250,450])[index],unit:language==='en'?'words':'characters'},minutes:[20,30,45][index],materials,scienceUnitId:u.id});
 }
}
assert.equal(topics.length,units.length*4);assert.equal(new Set(topics.map(t=>t.id)).size,topics.length);
fs.writeFileSync(path.join(__dirname,'../electron/science-writing.json'),JSON.stringify({version:2,categories,topics},null,2)+'\n');
