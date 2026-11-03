/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner uses CommonJS. */
const test=require('node:test'); const assert=require('node:assert/strict'); const {loadTypeScript}=require('./helpers/load-typescript.cjs');
function form(name){const data=new FormData();data.set('name',name);return data;}
function harness({permissions=['service_types.manage'],duplicate=false}={}){
 const db={service_types:[{key:'sunday_morning',name:'Sunday Morning',is_active:true}]}; const writes=[];
 class Query { constructor(){this.filters=[];this.op=null;this.payload=null;} insert(payload){this.op='insert';this.payload=payload;return this;} update(payload){this.op='update';this.payload=payload;return this;} eq(k,v){this.filters.push(x=>x[k]===v);return this;} select(){return this;} maybeSingle(){return Promise.resolve(this.result(true));} result(single=false){let rows=db.service_types; if(this.op==='insert'){writes.push(this.payload);if(duplicate||rows.some(x=>x.key===this.payload.key))return {data:null,error:{code:'23505'}};rows.push(this.payload);return {data:this.payload,error:null};} const found=rows.filter(x=>this.filters.every(f=>f(x)));if(this.op==='update'){writes.push(this.payload);for(const x of found)Object.assign(x,this.payload);}return {data:single?found[0]??null:found,error:null};} then(resolve,reject){return Promise.resolve(this.result()).then(resolve,reject);} }
 const action=loadTypeScript('app/portal/administration/service-types/actions.ts',{'next/cache':{revalidatePath(){}},'next/navigation':{redirect(url){throw Error(`redirect:${url}`)}},'../access':{requireAdministrationPermission:async key=>{if(!permissions.includes(key))throw Error('redirect:/access-denied');return {permissions};}},'@/lib/supabase/admin':{createAdminClient:()=>({from:()=>new Query()})}});
 return {action,db,writes};
}
test('service type writes require manage permission and create immutable normalized keys',async()=>{
 const h=harness(); await assert.rejects(h.action.createServiceType(form('  Midweek   Service ')),/redirect:\/portal\/administration\/service-types/);
 assert.equal(h.db.service_types[1].key,'midweek_service');assert.equal(h.db.service_types[1].name,'Midweek Service');
 const denied=harness({permissions:['service_types.view']});await assert.rejects(denied.action.createServiceType(form('New Service')),/access-denied/);assert.equal(denied.writes.length,0);
});
test('duplicate normalized names are rejected by the database unique constraint',async()=>{
 const h=harness({duplicate:true});await assert.rejects(h.action.createServiceType(form('Sunday Morning')),/already exists/);
});
test('rename preserves the stable key and deactivation changes only availability',async()=>{
 const h=harness();await assert.rejects(h.action.updateServiceType('sunday_morning',form('Sunday Worship')),/redirect:/);
 assert.equal(h.db.service_types[0].key,'sunday_morning');assert.equal(h.db.service_types[0].name,'Sunday Worship');
 await h.action.setServiceTypeActive('sunday_morning',false);assert.equal(h.db.service_types[0].is_active,false);assert.equal(h.db.service_types[0].key,'sunday_morning');
});
