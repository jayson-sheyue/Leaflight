const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {Store,validatePreset}=require('../electron/store.cjs'),demo=require('../electron/demo.cjs');
test('5000-chapter local book survives tail bookmarks, restart, trash, backup and restore without expanding generation limits',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'leaflight-long-'));let store=new Store(path.join(dir,'a.sqlite'));t.after(()=>{store.close();fs.rmSync(dir,{recursive:true,force:true});});
 const input={title:'Long local fixture',language:'en',chapters:Array.from({length:5000},(_,i)=>({title:`Chapter ${i+1}`,text:`Complete chapter ${i+1}. Last line preserved.`,readings:[]}))};
 let b=store.importStory(input);assert.equal(b.preset.totalChapters,5000);assert.equal(b.chapters[4999].text,input.chapters[4999].text);
 store.progress(b.id,{chapter:4999,fraction:.5});store.bookmark(b.id,{chapter:4999,fraction:.5});store.remove(b.id);assert.equal(store.list().length,0);store.recover(b.id);store.close();store=new Store(path.join(dir,'a.sqlite'));b=store.get(b.id);assert.equal(b.progress.chapter,4999);assert.equal(b.bookmarks[0].chapter,4999);
 const target=new Store(path.join(dir,'b.sqlite'));try{target.restore(store.backup());assert.deepEqual(target.get(b.id).chapters,b.chapters);assert.deepEqual(target.get(b.id).bookmarks,b.bookmarks);assert.equal(target.get(b.id).progress.chapter,4999);}finally{target.close();}
 const before=store.list().length;assert.throws(()=>store.importStory({...input,chapters:[...input.chapters,input.chapters[0]]}));assert.equal(store.list().length,before);
 assert.throws(()=>validatePreset({...b.preset,totalChapters:101}));assert.throws(()=>store.create({...b.preset,totalChapters:101},demo.plan));
 const spoof=store.backup();delete spoof.books[0].source;assert.throws(()=>store.restore(spoof));
});
