const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),os=require('node:os'),ts=require('typescript');
const source=path.resolve(__dirname,'../src/storage.ts'),compiled=ts.transpileModule(fs.readFileSync(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const m=new Module(source,module);m._compile(compiled,source);
const {parseImport,mergeBooks,validateSettings,defaults}=m.exports,{Store}=require('../../electron/store.cjs'),demo=require('../../electron/demo.cjs');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'leaflight-android-unit-')),s=new Store(path.join(dir,'library.sqlite'));t.after(()=>{s.close();fs.rmSync(dir,{recursive:true,force:true});});let b=s.create({language:'en',level:'B1',genre:'fantasy',words:1000,totalChapters:3,preferences:''},demo.plan);b=s.append(b.id,demo.chapters[0]);s.progress(b.id,{chapter:0,fraction:.4,paragraph:3,index:8});s.bookmark(b.id,{chapter:0,fraction:.4});return {s,b:s.get(b.id)};}
test('imports real Mac backup, keeps prose/ruby/legacy anchors, strips writings and unknown credential fields',t=>{
 const {s,b}=fixture(t);s.writing.create({title:'Private writing',language:'en',text:'A draft that is not a novel.',goal:''});
 const backup=s.backup();backup.apiKey='test-only-secret';backup.books[0].apiKey='test-only-secret';backup.books[0].progress.apiKey='test-only-secret';backup.books[0].bookmarks[0].apiKey='test-only-secret';
 const result=parseImport(JSON.stringify(backup));assert.equal(result.books[0].chapters[0].text,b.chapters[0].text);assert.deepEqual(result.books[0].progress,b.progress);assert(!JSON.stringify(result).includes('test-only-secret'));assert(!JSON.stringify(result).includes('Private writing'));
 const ja=structuredClone(backup);ja.books[0].preset.language='ja';ja.books[0].chapters[0].text='町へ行きます。\\n\\n友人に会います。';ja.books[0].chapters[0].readings=[{surface:'町',reading:'まち'}];const read=parseImport(JSON.stringify(ja)).books[0];assert(read.chapters[0].text.includes('\n\n'));assert.equal(read.chapters[0].readings[0].reading,'まち');
});
test('validates the entire import before accepting any book; rejects bad anchors and duplicate book IDs',t=>{
 const {s}=fixture(t),valid=s.backup();for(const invalid of [{...valid,books:[valid.books[0],{id:'broken'}]},{...valid,books:[valid.books[0],valid.books[0]]},{...valid,version:2},{...valid,books:[{...valid.books[0],progress:{chapter:0,fraction:1.5}}]}])assert.throws(()=>parseImport(JSON.stringify(invalid)));
 assert.throws(()=>parseImport('{"format":'));assert.throws(()=>parseImport(' '.repeat(30*1024*1024+1)),/too-large/);
});
test('reimport only appends compatible chapters and retains tablet progress/bookmarks; conflicts cannot replace prose',t=>{
 const {s,b}=fixture(t),local=parseImport(JSON.stringify(s.backup())).books[0];local.progress={chapter:0,fraction:.8,paragraph:5,index:3};local.bookmarks=[{id:'pad-only',chapter:0,fraction:.8}];
 s.append(b.id,demo.chapters[1]);const newer=parseImport(JSON.stringify(s.backup())).books[0],result=mergeBooks([local],[newer]);assert.equal(result.updated,1);assert.equal(result.books[0].chapters.length,2);assert.deepEqual(result.books[0].progress,local.progress);assert.deepEqual(result.books[0].bookmarks,local.bookmarks);
 const conflict=structuredClone(newer);conflict.chapters[0].text='Different prose';assert.deepEqual(mergeBooks([local],[conflict]).books,[local]);
 assert.equal(mergeBooks(result.books,[local]).books[0].chapters.length,2);
});
test('reader backup restores only bounded known settings; legacy duplicate bookmarks are collapsed',t=>{
 const {s}=fixture(t),backup=s.backup(),mark=backup.books[0].bookmarks[0];backup.books[0].bookmarks.push({...mark,id:'duplicate'});
 const imported=parseImport(JSON.stringify(backup));assert.equal(imported.books[0].bookmarks.length,1);
 const reader=parseImport(JSON.stringify({format:'leaflight-reader',version:1,books:imported.books,settings:{...defaults,theme:'ocean',language:'ja'}}));assert.equal(reader.settings.theme,'ocean');
 assert.deepEqual(validateSettings({size:1000,line:-1,theme:'unknown',font:'unknown',width:0,mode:'remote',effect:'invalid',apiKey:'secret'}),defaults);
});
test('continuation metadata survives Mac and reader backups with secret fields stripped; reimport can add metadata without losing later local chapters',t=>{
 const {s,b}=fixture(t),incoming=parseImport(JSON.stringify(s.backup())).books[0];assert.equal(incoming.series.outline.length,3);assert.equal(incoming.chapters[0].summary,b.chapters[0].summary);
 const legacy=structuredClone(incoming);delete legacy.series;legacy.progress.fraction=.9;legacy.bookmarks=[{id:'pad-bookmark',chapter:0,fraction:.9}];const enriched=mergeBooks([legacy],[incoming]);assert.equal(enriched.updated,1);assert.equal(enriched.books[0].series.totalChapters,3);assert.equal(enriched.books[0].progress.fraction,.9);assert.equal(enriched.books[0].bookmarks[0].id,'pad-bookmark');
 const more=structuredClone(legacy);more.chapters.push({...more.chapters[0],id:'later-local-chapter'});assert.equal(mergeBooks([more],[incoming]).books[0].chapters.length,2);
 incoming.series.apiKey='secret-only-for-test';incoming.series.sampleReadings=[{surface:'町',reading:'まち',apiKey:'secret-only-for-test'}];const roundtrip=parseImport(JSON.stringify({format:'leaflight-reader',version:1,books:[incoming]}));assert.equal(roundtrip.books[0].series.totalChapters,3);assert(!JSON.stringify(roundtrip).includes('secret-only-for-test'));
});
test('legacy readable prose remains importable if its old Mac outline no longer fits its chapters; invalid explicit series are rejected',t=>{
 const {s}=fixture(t),backup=s.backup();backup.books[0].chapters.push({...backup.books[0].chapters[0],id:'2'},{...backup.books[0].chapters[0],id:'3'},{...backup.books[0].chapters[0],id:'4'});const read=parseImport(JSON.stringify(backup));assert.equal(read.books[0].chapters.length,4);assert.equal(read.books[0].series,undefined);
 const invalid=structuredClone(read);invalid.books[0].series={version:1,totalChapters:2};assert.throws(()=>parseImport(JSON.stringify({format:'leaflight-reader',version:1,books:invalid.books})));
});
