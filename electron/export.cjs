const {zipSync,strToU8}=require('fflate');
const {normalizeBook}=require('./text.cjs');
const {normalizeReadings}=require('./difficulty.cjs');
function xml(s){return String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));}
function epub(b){
 b=normalizeBook(b);
 const language=b.preset.language==='ja'?'ja':'en';
 const chapters=b.chapters.map((c,i)=>({name:`chapter-${i+1}.xhtml`,title:c.title,text:c.text,readings:c.readings}));
 const html=(title,body)=>`<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${language}" xml:lang="${language}"><head><title>${xml(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body>${body}</body></html>`;
 const files={mimetype:[strToU8('application/epub+zip'),{level:0}], 'META-INF/container.xml':strToU8('<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')};
 files['OEBPS/nav.xhtml']=strToU8(html(b.title,`<h1>${xml(b.title)}</h1><p>${xml(b.synopsis)}</p><nav epub:type="toc"><h2>${language==='ja'?'目次':'Contents'}</h2><ol>${chapters.map(c=>`<li><a href="${c.name}">${xml(c.title)}</a></li>`).join('')}</ol></nav>`));
 files['OEBPS/style.css']=strToU8('body{font-family:serif;line-height:1.7;margin:5%;}h1{line-height:1.2;}p{margin:0 0 1em;}');
 for(const c of chapters)files[`OEBPS/${c.name}`]=strToU8(html(c.title,`<h1>${rubyXml(c.title,c.readings)}</h1>${c.text.split(/\n\s*\n/).filter(Boolean).map(p=>`<p>${rubyXml(p,c.readings)}</p>`).join('')}`));
 files['OEBPS/content.opf']=strToU8(`<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:uuid:${xml(b.id)}</dc:identifier><dc:title>${xml(b.title)}</dc:title><dc:language>${language}</dc:language><dc:creator>${b.source==='import'?'Imported to Leaflight':'Leaflight · AI generated'}</dc:creator><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z/,'Z')}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/>${chapters.map((c,i)=>`<item id="c${i}" href="${c.name}" media-type="application/xhtml+xml"/>`).join('')}</manifest><spine><itemref idref="nav"/>${chapters.map((c,i)=>`<itemref idref="c${i}"/>`).join('')}</spine></package>`);
 return Buffer.from(zipSync(files));
}
function rubyXml(text,items){const readings=normalizeReadings(items),map=new Map(readings.map(x=>[x.surface,x.reading]));if(!map.size)return xml(text);const regex=new RegExp([...map.keys()].sort((a,b)=>b.length-a.length).map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'gu');let output='',start=0;for(const match of text.matchAll(regex)){output+=xml(text.slice(start,match.index));output+=`<ruby>${xml(match[0])}<rt>${xml(map.get(match[0]))}</rt></ruby>`;start=match.index+match[0].length;}return output+xml(text.slice(start));}
module.exports={epub,xml,rubyXml};
