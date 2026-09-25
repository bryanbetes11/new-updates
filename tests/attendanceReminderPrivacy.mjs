import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

// Run the real Edge Function handler with isolated data and no network transport.
const source = (await readFile(new URL('../supabase/functions/check-leadership-member-actions/index.ts',import.meta.url),'utf8'))
  .replace(/^import .*;\r?\n/gm,'');
const code = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
async function run({ dryRun=false, existing=false, unauthorized=false, queryError=false }={}) {
  let handler;
  const inserts=[];
  const queries=[];
  const client={
    rpc: async (name,args)=>{
      assert.equal(name,'get_org_member_accountability_rollup');
      return {data:[{user_id:`${args.p_org_id}-private-member`,offense_level:1}],error:null};
    },
    from(table){
      const filters=[];
      const q={table,filters}; queries.push(q);
      return {
        select(){return this;}, eq(key,value){filters.push([key,value]);return this;}, maybeSingle(){return this;},
        insert(value){inserts.push(...value);return this;},
        then(resolve){
          let data;
          if(table==='organizations') data=[{id:'church-a',name:'Church A'},{id:'church-b',name:'Church B'}];
          else if(table==='profiles'){
            assert.ok(filters.some(([k,v])=>k==='is_org_admin' && v===true));
            data=[{id:`${filters.find(([k])=>k==='org_id')[1]}-admin`}];
          } else if(table==='notifications') data=existing?{id:'existing'}:null;
          else throw Error(`Unexpected recipient query: ${table}`);
          return Promise.resolve({data,error:queryError?{message:'fixture failure'}:null}).then(resolve);
        },
      };
    },
  };
  vm.runInNewContext(code,{
    Deno:{env:{get:key=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-service'})[key]},serve:callback=>{handler=callback;}},
    createClient:()=>client,Request,Response,URL,Date,Intl,console,
  });
  const response=await handler(new Request(`https://fixture.invalid/reminders?dry_run=${dryRun}`,{headers:{Authorization:`Bearer ${unauthorized?'wrong':'fixture-service'}`}}));
  return {status:response.status,body:await response.json(),inserts,queries};
}
let result=await run();
assert.equal(result.status,200);
assert.deepEqual(result.inserts.map(n=>[n.org_id,n.user_id]),[['church-a','church-a-admin'],['church-b','church-b-admin']]);
for(const n of result.inserts){
  assert.equal(n.body,'Member records need review. Open ServeSync to view records you can access.');
  assert.equal(n.data.member_ids,undefined);
  assert.ok(!JSON.stringify(n).includes('private-member'));
}
result=await run({dryRun:true});
assert.equal(result.inserts.length,0);assert.equal(result.body.notificationsPrepared,2);
assert.equal((await run({existing:true})).inserts.length,0);
result=await run({unauthorized:true}); assert.equal(result.status,403);assert.equal(result.queries.length,0);
result=await run({queryError:true});assert.equal(result.status,500);assert.equal(result.inserts.length,0);
console.log('PASS attendance reminder privacy: admin-only two-church recipients, generic previews, no member IDs, dry run, duplicate skip, denied request, query failure');
