/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadTypeScript}=require('./helpers/load-typescript.cjs');
const {analyticsFixture, validInsight, serverOnly, id}=require('./helpers/ai-harness.cjs');
function fixture(){
 const input=loadTypeScript('lib/ai/input.ts',serverOnly).buildDecisionSupportInput(analyticsFixture(),'all_accessible_branches');
 const validated=loadTypeScript('lib/ai/validate-response.ts',serverOnly).validateDecisionSupportResponse(JSON.stringify(validInsight()),input);
 return {ok:true,insight:validated.insight,evidence:validated.evidence.map(e=>({...e,label:e.path,format:'number'})),advisory:true,model:'fixture',promptVersion:'1',generatedAt:'2026-10-29T09:00:00Z',reportingContext:input.reportingContext,branchLabels:[{label:'branch_1',displayName:'North'},{label:'branch_2',displayName:'South'}]};
}
function harness(){
 let actor='owner',scope=[id(1),id(2)],denied=false;const rows=[],calls=[];
 class Query {
  constructor(){this.filters=[];this.start=0;this.end=Infinity;this.mode='read';}
  select(){return this;} insert(row){this.payload=row;this.mode='insert';return this;}
  eq(k,v){this.filters.push(r=>r[k]===v);return this;}
  containedBy(k,v){this.filters.push(r=>r[k].every(x=>v.includes(x)));return this;}
  order(){return this;}range(start,end){this.start=start;this.end=end;calls.push({start,end});return this;}
  single(){return this.finish(true);}maybeSingle(){return this.finish(true);}
  finish(single=false){if(this.mode==='insert'){const row={...this.payload,id:id(100+rows.length),created_at:'2026-10-29T09:00:00Z'};rows.push(row);return Promise.resolve({data:{id:row.id},error:null});}const all=rows.filter(r=>this.filters.every(f=>f(r)));return Promise.resolve({data:single?all[0]??null:all.slice(this.start,this.end+1),count:all.length,error:null});}
  then(resolve,reject){return this.finish().then(resolve,reject);}
 }
 const api=loadTypeScript('lib/ai/report-documents.ts',{'server-only':{},'@/lib/permissions-server':{requirePermission:async key=>{assert.equal(key,'reports.view');if(denied)throw Error('denied');return{user:{id:actor}};}},'@/lib/analytics/server':{getAnalyticsBranchOptions:async()=>scope.map((x,i)=>({id:x,name:i?'South':'North'}))},'@/lib/supabase/admin':{createAdminClient:()=>({from:()=>new Query()})}});
 return{api,rows,calls,setActor:v=>actor=v,setScope:v=>scope=v,deny:()=>denied=true};
}
const filters={range:{preset:'custom',from:'2026-10-01',to:'2026-10-29'},grouping:'week'};
test('saved reports require owner and every stored branch; list pages contain exactly five rows',async()=>{
 const h=harness();for(let i=0;i<7;i++)await h.api.saveReportDocument(fixture(),filters);
 const first=await h.api.listReportDocuments(1),second=await h.api.listReportDocuments(2);
 assert.equal(first.rows.length,5);assert.equal(second.rows.length,2);assert.equal(first.total,7);assert.deepEqual(h.calls,[{start:0,end:4},{start:5,end:9}]);
 const key=h.rows[0].id;assert.ok(await h.api.getReportDocument(key));
 h.setActor('other');assert.equal((await h.api.listReportDocuments(1)).total,0);assert.equal(await h.api.getReportDocument(key),null);
 h.setActor('owner');h.setScope([id(1)]);assert.equal(await h.api.getReportDocument(key),null);assert.equal((await h.api.listReportDocuments(1)).total,0);
 h.deny();await assert.rejects(h.api.getReportDocument(key),/denied/);
});
test('invalid page and mismatched generation scope cannot write or expose stored documents',async()=>{
 const h=harness();await assert.rejects(h.api.listReportDocuments(0),/Invalid/);h.setScope([id(1)]);
 await assert.rejects(h.api.saveReportDocument(fixture(),filters),/scope changed/);assert.equal(h.rows.length,0);
});
test('download document includes context/evidence/advisory and escapes model markup',()=>{
 const result=fixture();result.insight.executiveSummary='<script>alert("bad")</script>';
 const html=loadTypeScript('lib/ai/report-document-html.ts',serverOnly).renderReportDocument(result);
 for(const text of ['Executive Summary','Key Findings','Advisory Recommendations','Limitations','Print / Save as PDF','North, South','Asia/Manila','@media print'])assert.ok(html.includes(text),text);
 assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
});
test('generation saves only successful validated results and reports storage failure explicitly',async()=>{
 let saved=0;const stubs={'next/navigation':{unstable_rethrow(){}},'@/lib/ai/server':{generateDecisionSupportInsights:async()=>fixture()},'@/lib/ai/report-documents':{saveReportDocument:async()=>{saved++;return id(90);}}};
 let action=loadTypeScript('app/portal/reports/actions.ts',stubs);
 assert.equal((await action.generateReportInsights(filters)).documentId,id(90));assert.equal(saved,1);
 stubs['@/lib/ai/report-documents'].saveReportDocument=async()=>{throw Error('PRIVATE_DB_ERROR');};action=loadTypeScript('app/portal/reports/actions.ts',stubs);const result=await action.generateReportInsights(filters);assert.equal(result.ok,true);assert.ok(result.documentWarning);assert.ok(!JSON.stringify(result).includes('PRIVATE_DB_ERROR'));
 stubs['@/lib/ai/server'].generateDecisionSupportInsights=async()=>({ok:false,error:{code:'INVALID_RESPONSE',message:'Invalid'}});action=loadTypeScript('app/portal/reports/actions.ts',stubs);assert.equal((await action.generateReportInsights(filters)).ok,false);
});
