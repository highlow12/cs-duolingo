import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

function worker() {
  const handlers = new Map<string,(event: Record<string,unknown>)=>void>();
  const stored = new Map<string,Map<string,Response>>();
  const normalize=(request:string|URL|Request)=>new URL(typeof request==='string'?request:request instanceof URL?request.href:request.url,'https://app.test/').href;
  let online=true, activated=false;
  const fetcher=async(request:string|URL|Request)=>{if(!online)throw new Error('offline');return new Response(normalize(request));};
  const cachesMock={
    open:async(name:string)=>{
      if(!stored.has(name))stored.set(name,new Map());const cache=stored.get(name)!;
      return {match:async(r:string|URL|Request)=>cache.get(normalize(r))?.clone(),put:async(r:string|URL|Request,value:Response)=>{cache.set(normalize(r),value);},add:async(r:string|URL|Request)=>{cache.set(normalize(r),await fetcher(r));},addAll:async(items:string[])=>{for(const item of items)cache.set(normalize(item),await fetcher(item));}};
    },
    keys:async()=>[...stored.keys()],delete:async(name:string)=>stored.delete(name)
  };
  let source=readFileSync('src/service-worker.ts','utf8').replace(/import[^;]+from "\$service-worker";/,'const build=["/_app/start.js"];const files=["/generated/manifest.json","/generated/questions/test.json"];const version="test";');
  source=ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None});
  vm.runInNewContext(source,{URL,Response,caches:cachesMock,fetch:fetcher,self:{location:{origin:'https://app.test'},registration:{scope:'https://app.test/'},skipWaiting:async()=>{activated=true;},clients:{claim:async()=>{}},addEventListener:(name:string,handler:(e:Record<string,unknown>)=>void)=>handlers.set(name,handler)}});
  async function lifecycle(name:string,data?:unknown){let promise:Promise<unknown>|undefined;handlers.get(name)?.({data,waitUntil:(p:Promise<unknown>)=>{promise=p;}});await promise;}
  async function request(path:string,mode='cors'){let response:Promise<Response>|undefined;handlers.get('fetch')?.({request:{method:'GET',url:`https://app.test${path}`,mode},respondWith:(p:Promise<Response>)=>{response=p;}});return response;}
  return {lifecycle,request,setOffline:()=>{online=false;},activated:()=>activated};
}
describe('offline installed app',()=>{
  it('preloads questions and serves unseen lesson routes offline',async()=>{
    const sw=worker();await sw.lifecycle('install');sw.setOffline();
    expect(await (await sw.request('/learn/unvisited','navigate'))?.text()).toBe('https://app.test/');
    expect(await (await sw.request('/generated/questions/test.json'))?.text()).toBe('https://app.test/generated/questions/test.json');
  });
  it('activates an update only after learner confirmation',async()=>{
    const sw=worker();await sw.lifecycle('install');expect(sw.activated()).toBe(false);await sw.lifecycle('message',{type:'ACTIVATE_UPDATE'});expect(sw.activated()).toBe(true);
  });
});
