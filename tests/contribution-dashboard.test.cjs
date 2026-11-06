/* eslint-disable @typescript-eslint/no-require-imports -- Node regression harness. */
const test=require('node:test'),assert=require('node:assert/strict');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {loadTypeScript}=require('./helpers/load-typescript.cjs');

test('contribution comparisons use decimal integers, directional percentages and safe missing/zero baselines',()=>{
 const {contributionTicker:t}=loadTypeScript('lib/contribution-comparison.ts');
 assert.deepEqual({...t('0.30','0.10')},{direction:'up',percent:'200%',label:'vs previous period'});
 assert.equal(t('0.10','0.30').percent,'66.7%');assert.equal(t('0.10','0.30').direction,'down');
 assert.equal(t(3,2).percent,'50%');assert.equal(t(0,2).percent,'100%');assert.equal(t(0,2).direction,'down');
 assert.equal(t('9007199254740999.99','9007199254740999.99').percent,'0%');
 assert.equal(t(null,'1.00').label,'No previous comparison');assert.equal(t('1.00',null).percent,null);
 assert.equal(t('1.00','0.00').label,'Previous value was 0');assert.equal(t('0.00','0.00').percent,'0%');
});
test('custom range and its preceding equal-length comparison are queried server-side in the same authorized receiving scope',async()=>{
 const calls=[];const {loadModuleSummary}=loadTypeScript('lib/module-summary.ts',{'server-only':{},'@/lib/supabase/admin':{}});
 const admin={rpc:async(name,args)=>{calls.push({name,args});return{data:{totals:[{branchId:null,count:1,amount:'0.30',average:'0.30'}],trend:[],breakdown:[]},error:null};}};
 const data=await loadModuleSummary(admin,'contributions',['allowed'],{from:'2026-03-01',to:'2026-03-10'});
 assert.equal(calls.length,2);for(const call of calls){assert.equal(call.name,'get_module_summary');assert.deepEqual(Array.from(call.args.p_branch_ids),['allowed']);}
 assert.equal(calls[0].args.p_from,'2026-03-01');assert.equal(calls[0].args.p_to,'2026-03-10');assert.equal(calls[1].args.p_from,'2026-02-19');assert.equal(calls[1].args.p_to,'2026-02-28');assert.equal(data.comparison.totals[0].amount,'0.30');
 const before=calls.length;await assert.rejects(loadModuleSummary(admin,'contributions',['allowed'],{from:'2026-03-10',to:'2026-03-01'}),/valid reporting/);assert.equal(calls.length,before);
 await loadModuleSummary(admin,'contributions',[],{from:'2026-03-01',to:'2026-03-10'});assert.equal(calls.length,before);
 await assert.rejects(loadModuleSummary({rpc:async()=>({error:{message:'PRIVATE'}})},'contributions',['allowed']),/Unable to load module summary/);
});
test('range refresh reauthorizes Contributions view and resolves historical receiving branches before aggregation',async()=>{
 let allowed=true,checks=0,args;
 const {refreshContributionSummary}=loadTypeScript('app/portal/contributions/dashboard-actions.ts',{
  './access':{requireContributionsPermission:async permission=>{checks++;assert.equal(permission,'contributions.view');if(!allowed)throw Error('denied');return {scope:'authorized'};}},
  '@/lib/supabase/admin':{createAdminClient:()=>({})},'@/lib/historical-records':{getHistoricalRecordBranches:async access=>{assert.equal(access.scope,'authorized');return [{id:'receiving'}];}},
  '@/lib/module-summary':{loadModuleSummary:async(...values)=>{args=values;return{};}},
 });
 await refreshContributionSummary('2026-01-01','2026-01-31');assert.equal(args[1],'contributions');assert.deepEqual(Array.from(args[2]),['receiving']);assert.deepEqual({...args[3]},{from:'2026-01-01',to:'2026-01-31'});
 allowed=false;await assert.rejects(refreshContributionSummary('2026-01-01','2026-01-31'),/denied/);assert.equal(checks,2);
});
test('absolute monetary charts plot PHP coordinates while tooltips/tables retain exact strings and relative callers retain defaults',()=>{
 let chart;const capture=props=>{chart=props;return null;};const Chart=loadTypeScript('app/portal/reports/ReportChart.tsx',{'react-chartjs-2':{Bar:capture,Line:capture,Doughnut:capture}}).default;
 const props={title:'Contributions',money:true,labels:['Feb','Mar'],series:[{label:'Received',values:['1000.10','500.25']}],emptyMessage:'Empty'};
 const html=renderToStaticMarkup(React.createElement(Chart,{...props,moneyScale:'absolute'}));
 assert.deepEqual(Array.from(chart.data.datasets[0].data),[1000.1,500.25]);assert.equal(chart.options.scales.y.max,undefined);assert.equal(chart.options.scales.y.title.text,'Amount (PHP)');assert.doesNotMatch(chart.options.scales.y.ticks.callback(1000.1),/%/);assert.match(chart.options.scales.y.ticks.callback(0.3),/0\.3/);
 assert.match(chart.options.plugins.tooltip.callbacks.label({dataIndex:0,datasetIndex:0}),/1,000\.10/);assert.match(html,/1,000\.10/);assert.doesNotMatch(html,/Relative to the largest/);
 renderToStaticMarkup(React.createElement(Chart,props));assert.equal(chart.options.scales.y.max,100);assert.equal(chart.data.datasets[0].data[0],100);
});
test('cards compare total/count/average in selected branch and both charts use absolute money over actual selected months',()=>{
 const charts=[];const Dashboard=loadTypeScript('components/module-summary.tsx',{'@/app/portal/reports/ReportChart':{__esModule:true,default:props=>{charts.push(props);return null;}}}).default;
 const data={module:'contributions',from:'2026-02-20',to:'2026-03-02',totals:[{branchId:'b',amount:'200.00',count:2,average:'100.00'}],trend:[{branchId:'b',period:'2026-02-01',value:'200.00'}],breakdown:[],comparison:{from:'2026-02-09',to:'2026-02-19',totals:[{branchId:'b',amount:'100.00',count:4,average:'25.00'}]}};
 const html=renderToStaticMarkup(React.createElement(Dashboard,{data,branchId:'b',branchName:'Receiving Branch'}));
 assert.match(html,/up 100% vs previous period/);assert.match(html,/down 50% vs previous period/);assert.match(html,/up 300% vs previous period/);assert.match(html,/text-emerald-700/);assert.match(html,/text-rose-700/);assert.equal(charts.length,2);assert.ok(charts.every(c=>c.moneyScale==='absolute'));
 assert.deepEqual(Array.from(charts[0].labels),['Feb','Mar']);assert.deepEqual(Array.from(charts[0].series[0].values),['200.00','0.00']);
 const empty=renderToStaticMarkup(React.createElement(Dashboard,{data:{...data,totals:[],comparison:{...data.comparison,totals:[]}},branchId:'all',branchName:'All'}));assert.equal((empty.match(/No previous comparison<\/p>/g)||[]).length,3);
});
test('Contributions range has visible fieldset/labels/presets/apply and contributor identities have no dollar icon',()=>{
 const Table=loadTypeScript('app/portal/contributions/ContributionsTable.tsx',{'./dashboard-actions':{}}).default;
 const html=renderToStaticMarkup(React.createElement(Table,{records:[],branches:[],canUpdate:false}));
 assert.match(html,/<h2 id="contribution-range-title"[^>]*>Date range/);assert.match(html,/for="contributions-from"/);assert.match(html,/for="contributions-to"/);assert.match(html,/Apply range/);assert.match(html,/Custom range/);assert.match(html,/Recent 6 months/);assert.doesNotMatch(html,/dollar-sign/i);
});
