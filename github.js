import {parseBackup} from './model.js';
export const REPOSITORY='ShuaiHeng21/book_library_webpage';
export const DATA_PATH='data/library.json';
export const BRANCH='main';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// Use a common ancestor to distinguish edits from deletions on either device.
export function reconcile(base,local,remote,resolutions={}){
  const maps=[base,local,remote].map(list=>new Map(list.map(book=>[book.id,book])));
  const ids=new Set([...maps[1].keys(),...maps[2].keys(),...maps[0].keys()]);
  const books=[],conflicts=[];
  for(const id of ids){const [ancestor,left,right]=maps.map(map=>map.get(id));let result;
    if(same(left,right))result=left;
    else if(same(left,ancestor))result=right;
    else if(same(right,ancestor))result=left;
    else if(resolutions[id]==='local')result=left;
    else if(resolutions[id]==='remote')result=right;
    else {conflicts.push({id,local:left,remote:right,base:ancestor});continue;}
    if(result)books.push(result);
  }
  return {books,conflicts};
}
export function encodeContent(value){const bytes=new TextEncoder().encode(JSON.stringify(value,null,2)+'\n');let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);}
export function decodeContent(content){return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(content.replace(/\s/g,'')),c=>c.charCodeAt(0))));}
export class GitHubLibrary{
 constructor(token,fetcher=globalThis.fetch){this.token=token;this.fetcher=fetcher;}
 async request(path,options={}){let response;try{response=await this.fetcher('https://api.github.com'+path,{...options,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+this.token,'User-Agent':'ShuYe-Book-Library','X-GitHub-Api-Version':'2022-11-28',...options.headers},cache:'no-store',signal:AbortSignal.timeout(30000)});}catch{throw new Error('无法连接 GitHub，请检查网络后重试；本地书库未被替换。');}
 if(!response.ok){const error=new Error(response.status===401?'访问令牌无效或已过期，请重新连接。':response.status===403?'GitHub 拒绝访问，请检查令牌的仓库权限或 API 请求限额。':response.status===404?'找不到私有仓库或数据文件，请确认令牌已授权此仓库。':response.status===409||response.status===422?'云端数据刚被修改，请重新同步；不会强行覆盖。':`GitHub 请求失败（${response.status}），请稍后重试。`);error.status=response.status;throw error;}return options.raw?response.text():response.json();}
 async verify(){const repo=await this.request('/repos/'+REPOSITORY);if(!repo.private)throw new Error('书库仓库必须保持私有，已停止连接。');if(!repo.permissions?.push)throw new Error('此令牌没有书库写入权限，请授予 Contents: Read and write。');return repo;}
 async read(){const file=await this.request('/repos/'+REPOSITORY+'/contents/'+DATA_PATH+'?ref='+BRANCH);const value=file.encoding==='base64'&&file.content?decodeContent(file.content):JSON.parse(await this.request('/repos/'+REPOSITORY+'/contents/'+DATA_PATH+'?ref='+BRANCH,{raw:true,headers:{Accept:'application/vnd.github.raw+json'}}));return {books:parseBackup(value),sha:file.sha};}
 async write(books,sha){const payload={app:'shuye',version:1,updatedAt:new Date().toISOString(),books};const content=encodeContent(payload);if(content.length>11000000)throw new Error('书库超过同步大小上限（8 MB），请缩小封面或先导出备份。');return this.request('/repos/'+REPOSITORY+'/contents/'+DATA_PATH,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'同步书库',branch:BRANCH,sha,content})});}
}
