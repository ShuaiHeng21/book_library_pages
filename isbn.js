// ISBN-10 is canonicalized to ISBN-13 so scans and manual entries match.
export function canonicalISBN(value){
 const text=String(value??'').replace(/^ISBN(?:-1[03])?\s*:?\s*/i,'').replace(/[\s-]/g,'').toUpperCase();
 if(/^\d{9}[\dX]$/.test(text)){
  let sum=0;for(let i=0;i<10;i++)sum+=(10-i)*(text[i]==='X'?10:Number(text[i]));
  if(sum%11!==0)return null;
  const first='978'+text.slice(0,9);let total=0;for(let i=0;i<12;i++)total+=Number(first[i])*(i%2?3:1);return first+((10-total%10)%10);
 }
 if(!/^97[89]\d{10}$/.test(text)||text.startsWith('9790'))return null;
 let sum=0;for(let i=0;i<13;i++)sum+=Number(text[i])*(i%2?3:1);return sum%10===0?text:null;
}
export function bookFromOpenLibrary(data,isbn){const item=data?.['ISBN:'+isbn];if(!item||typeof item.title!=='string'||!item.title.trim())return null;const names=(list,max=200)=>(Array.isArray(list)?list:[]).map(x=>typeof x?.name==='string'?x.name.trim():'').filter(Boolean).join('、').slice(0,max);return {isbn,title:item.title.trim().slice(0,200),author:names(item.authors),publisher:names(item.publishers)};}
export async function lookupISBN(value,{fetcher=globalThis.fetch,signal}={}){const isbn=canonicalISBN(value);if(!isbn)throw Error('ISBN 格式或校验位不正确，请检查条形码下方的数字。');const response=await fetcher('https://openlibrary.org/api/books?'+new URLSearchParams({bibkeys:'ISBN:'+isbn,format:'json',jscmd:'data'}),{signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('书籍数据库暂时不可用，请稍后重试或手动补充。');return bookFromOpenLibrary(await response.json(),isbn);}

export async function lookupSources(value,{backend,source='auto',session,fetcher=globalThis.fetch,signal}={}){const isbn=canonicalISBN(value);if(!isbn)throw Error('ISBN 格式或校验位不正确');const response=await fetcher(backend+'/api/books?'+new URLSearchParams({isbn,source}),{headers:session?{Authorization:'Bearer '+session}:{},signal,credentials:'omit',cache:'no-store'});if(!response.ok)throw Error('多来源查询暂时不可用，请重试或手动补充。');const data=await response.json();if(!Array.isArray(data.results)||!Array.isArray(data.providers))throw Error('查询返回格式异常');return data;}
