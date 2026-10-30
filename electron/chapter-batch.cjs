const {chapterPrompt}=require('./gemini.cjs');
function batchPayload(book,p){
 const start=p.start===undefined?book.chapters.length:p.start;
 const end=p.end===undefined?start+p.count:p.end;
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||start>book.chapters.length||end<=start||end>book.preset.totalChapters||end-start>100||book.chapters.length>=end)throw Error('请选择尚未生成的章节数量。');
 return {id:book.id,start,end,count:end-start};
}
function batchState(book,p){const saved=book.chapters.slice(p.start,Math.min(book.chapters.length,p.end));return {progress:{completed:saved.length,total:p.end-p.start,from:p.start+1,to:p.end},result:saved.length?{bookId:book.id,chapterId:saved[0].id,chapterIds:saved.map(c=>c.id)}:null};}
async function runChapterBatch(store,job,signal,stage,generate){
 const p=job.payload;
 while(true){
  if(signal.aborted)throw Error('生成已取消。');
  const book=store.get(p.id),state=batchState(book,p);
  if(book.chapters.length>=p.end)return state.result;
  const number=book.chapters.length+1;
  stage(`正在生成第 ${number} 章`,state);
  const value=await generate(chapterPrompt(book),job,signal);
  if(signal.aborted)throw Error('生成已取消。');
  const current=store.get(p.id);
  if(current.chapters.length!==number-1)throw Error('章节已在别处更新，请重新打开作品后继续。');
  const saved=store.append(p.id,value,`${job.id}:${number}`);
  stage(`已保存第 ${number} 章`,batchState(saved,p));
 }
}
module.exports={batchPayload,batchState,runChapterBatch};
