const {zipSync,strToU8}=require('fflate');
function epubFixture({count=1200,doctype='<!DOCTYPE html>',text,href='c',encrypted=false}={}){
 const files={mimetype:strToU8('application/epub+zip'),'META-INF/container.xml':strToU8('<container><rootfiles><rootfile full-path="EPUB/content.opf"/></rootfiles></container>')};
 const items=[],spine=[];
 for(let i=0;i<count;i++){
  const name=`${href}${i}.xhtml`;items.push(`<item id="c${i}" href="${name}" media-type="application/xhtml+xml"/>`);spine.push(`<itemref idref="c${i}"/>`);
  files['EPUB/'+name]=strToU8(`${doctype}<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter ${i+1}</title></head><body><h2>Chapter ${i+1}</h2><p>${text||`Opening sentence ${i+1}. Keep &nbsp; spacing &amp; punctuation. <em>Emphasis stays.</em>`}</p><blockquote><p>Quoted paragraph ${i+1}.</p></blockquote><p>Final sentence ${i+1}.</p></body></html>`);
 }
 files['EPUB/content.opf']=strToU8(`<package><metadata><title>Long import fixture</title><language>en</language></metadata><manifest>${items.join('')}</manifest><spine>${spine.join('')}</spine></package>`);
 if(encrypted)files['META-INF/encryption.xml']=strToU8('<encryption/>');
 return Buffer.from(zipSync(files));
}
module.exports={epubFixture};
