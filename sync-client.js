export class SyncService{
 constructor(base,session,fetcher=globalThis.fetch){this.base=base;this.session=session;this.fetcher=fetcher.bind(globalThis);}
 async request(path,options={}){let response;try{response=await this.fetcher(this.base+path,{...options,headers:{Authorization:'Bearer '+this.session,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(45000),cache:'no-store',credentials:'omit'});}catch(cause){const timeout=cause?.name==='TimeoutError'||cause?.name==='AbortError',offline=globalThis.navigator?.onLine===false;const error=Error(timeout?'同步服务请求超时，请点击检测连接后重试。':offline?'当前浏览器处于离线状态；本地书库和登录会话已保留。':'浏览器未能连接同步接口；登录会话已保留，请点击检测连接查看详情。');error.code=timeout?'sync_timeout':offline?'sync_offline':'sync_network_error';throw error;}let data;try{data=await response.json();}catch{throw Error('同步服务返回了异常响应，请检查后端地址。');}if(!response.ok){const error=Error(data.error||'同步失败，请稍后重试。');error.status=response.status;throw error;}return data;}
 read(){return this.request('/api/library');}
 write(books,sha){return this.request('/api/library',{method:'PUT',body:JSON.stringify({version:1,books,sha})});}
 info(){return this.request('/api/session');}
}
export function backendOrigin(value){const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('请输入后端的 HTTPS 根地址，例如 https://shu-ye-github-sync.example.workers.dev');return url.origin;}

export async function checkConnection(base,{fetcher=globalThis.fetch}={}){
 const origin=backendOrigin(base);const run=fetcher.bind(globalThis);let response;
 try{response=await run(origin+'/health',{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(12000)});}catch{throw Error('健康检查连接失败。请在当前浏览器直接打开 '+origin+'/health ，检查浏览器或代理是否允许该域名。');}
 if(!response.ok)throw Error('健康检查返回 HTTP '+response.status+'，请检查后端部署。');
 let health;try{health=await response.json();}catch{throw Error('后端地址未返回预期的健康检查 JSON，请核对地址。');}
 if(health.ok!==true||health.configured!==true)throw Error('后端尚未配置完成，请检查 Cloudflare 中的三个密钥。');
 // A fixed invalid session probes the actual authenticated CORS request shape.
 // HTTP 401 with readable JSON proves both the preflight and response succeeded.
 try{await new SyncService(origin,'shuye-connection-test',fetcher).info();}catch(error){if(error.status===401)return {origin,health:200,cors:401};if(error.code?.startsWith('sync_'))throw Error('健康检查正常，但跨域 API 请求失败。请检查 Chrome 扩展或代理是否拦截此域名的 OPTIONS / Authorization 请求。');throw error;}
 throw Error('同步接口未正确校验登录会话，请检查后端部署。');
}
