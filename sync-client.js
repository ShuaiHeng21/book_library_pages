export class SyncService{
 constructor(base,session,fetcher=globalThis.fetch){this.base=base;this.session=session;this.fetcher=fetcher;}
 async request(path,options={}){let response;try{response=await this.fetcher(this.base+path,{...options,headers:{Authorization:'Bearer '+this.session,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(45000),cache:'no-store',credentials:'omit'});}catch{throw Error('无法连接同步服务，书籍仍保存在本地。请检查网络后重试。');}let data;try{data=await response.json();}catch{throw Error('同步服务返回了异常响应，请检查后端地址。');}if(!response.ok){const error=Error(data.error||'同步失败，请稍后重试。');error.status=response.status;throw error;}return data;}
 read(){return this.request('/api/library');}
 write(books,sha){return this.request('/api/library',{method:'PUT',body:JSON.stringify({version:1,books,sha})});}
 info(){return this.request('/api/session');}
}
export function backendOrigin(value){const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('请输入后端的 HTTPS 根地址，例如 https://shu-ye-github-sync.example.workers.dev');return url.origin;}
