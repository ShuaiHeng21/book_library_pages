export const STATUSES=['未读','在读','已读','暂停','弃读'];
export const KEY='shuye.library.v1';
const fields=['title','author','isbn','publisher','location','tags','notes'];
export function normalizeBook(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||typeof raw.title!=='string'||!raw.title.trim())throw new Error('每本书都必须有有效的书名');
  const book={};
  for(const field of fields){if(raw[field]!=null&&typeof raw[field]!=='string')throw new Error('书籍字段格式不正确');book[field]=(raw[field]||'').trim();if(book[field].length>(field==='notes'?10000:field==='tags'?300:field==='isbn'?40:200))throw new Error('书籍字段内容过长');}
  for(const field of ['source','sourceUrl','fetchedAt']){if(raw[field]!=null&&typeof raw[field]!=='string')throw new Error('书目来源字段格式不正确');if(raw[field]){if(raw[field].length>1000)throw new Error('书目来源字段过长');book[field]=raw[field];}}
  book.id=typeof raw.id==='string'&&raw.id.length<=100&&raw.id?raw.id:crypto.randomUUID();
  book.status=raw.status??'未读';if(!STATUSES.includes(book.status))throw new Error('阅读状态不正确');
  book.progress=raw.progress??0;if(typeof book.progress!=='number'||!Number.isInteger(book.progress)||book.progress<0||book.progress>100)throw new Error('阅读进度必须是 0–100 的整数');
  if(book.status==='已读')book.progress=100;
  book.cover=raw.cover||'';if(typeof book.cover!=='string'||(book.cover&&!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(book.cover))||book.cover.length>1000000)throw new Error('封面图片格式或大小不正确');
  const now=new Date().toISOString();for(const key of ['createdAt','updatedAt'])book[key]=typeof raw[key]==='string'&&Number.isFinite(Date.parse(raw[key]))?new Date(raw[key]).toISOString():now;
  return book;
}
export function parseBackup(value){const list=Array.isArray(value)?value:value?.books;if(!Array.isArray(list))throw new Error('请选择书页导出的 JSON 备份文件');if(!Array.isArray(value)&&value.version!=null&&value.version!==1)throw new Error('暂不支持此备份版本');if(list.length>20000)throw new Error('一次最多导入 20000 本书');const books=list.map(normalizeBook);if(new Set(books.map(b=>b.id)).size!==books.length)throw new Error('备份中存在重复的记录 ID');return books;}
export function mergeBooks(current,incoming){const map=new Map(current.map(b=>[b.id,b]));for(const book of incoming)map.set(book.id,book);return [...map.values()];}
export function makeCSV(books){const columns=[['title','书名'],['author','作者'],['isbn','ISBN'],['publisher','出版社'],['location','存放位置'],['status','阅读状态'],['progress','阅读进度(%)'],['tags','标签'],['notes','备注'],['createdAt','添加时间'],['updatedAt','更新时间']];const cell=value=>{let text=String(value??'');if(/^[\s]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};return '\uFEFF'+[columns.map(c=>cell(c[1])).join(','),...books.map(b=>columns.map(c=>cell(b[c[0]])).join(','))].join('\r\n');}
