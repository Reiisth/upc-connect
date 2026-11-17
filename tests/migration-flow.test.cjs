/* eslint-disable @typescript-eslint/no-require-imports -- Pure geometry and actual UI regression harness. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {loadTypeScript}=require('./helpers/load-typescript.cjs');
const {clientHooks,findElement}=require('./helpers/client-hooks.cjs');
const {migrationFlowModel,migrationFlowSummary,layoutMigrationFlows,wrapFlowLabel}=loadTypeScript('lib/member-migrations/flow-layout.ts');

function fixture(){return {trackingStartedAt:'2026-11-16T00:00:00Z',totals:{events:16,members:4,transfers:10,incoming:10,outgoing:10,departures:3,returns:3,net:0},trend:[],branches:[
  {id:'a',name:'Batangas City',incoming:7,outgoing:3,departures:2,returns:1,net:3},
  {id:'b',name:'Bauan',incoming:3,outgoing:7,departures:1,returns:2,net:-3},
],flows:[{source:'Batangas City',destination:'Bauan',transfers:3},{source:'Bauan',destination:'Batangas City',transfers:7}]};}

test('transfer bands conserve counts, separate reciprocal routes and scale their widths by event count',()=>{
  const model=migrationFlowModel(fixture(),false),layout=layoutMigrationFlows(model);
  assert.equal(model.flows.length,2);assert.equal(model.flows.reduce((sum,flow)=>sum+flow.count,0),10);
  assert.equal(layout.left.length,2);assert.equal(layout.right.length,2);
  for(const source of layout.left)assert.ok(layout.right.some(target=>target.id===source.id&&target.x>source.x));
  const three=layout.links.find(flow=>flow.count===3),seven=layout.links.find(flow=>flow.count===7);
  assert.ok(Math.abs(seven.thickness/three.thickness-7/3)<1e-9);
  for(const link of layout.links){assert.doesNotMatch(link.path,/NaN|Infinity|undefined/);assert.ok(link.thickness>0);}
  assert.deepEqual({...migrationFlowSummary(model,'branch:Batangas City')},{incoming:7,outgoing:3,net:4});
});

test('external toggle adds exact departures and returns without confusing the church boundary with masked branches',()=>{
  const data=fixture(),model=migrationFlowModel(data,true);
  assert.equal(model.flows.reduce((sum,flow)=>sum+flow.count,0),data.totals.events);
  assert.deepEqual({...migrationFlowSummary(model,'branch:Batangas City')},{incoming:8,outgoing:5,net:3});
  assert.deepEqual({...migrationFlowSummary(model,'branch:Bauan')},{incoming:5,outgoing:8,net:-3});
  const scoped={...data,branches:[data.branches[0]],flows:[{source:'Outside accessible branches',destination:'Batangas City',transfers:7},{source:'Batangas City',destination:'Outside accessible branches',transfers:3}]};
  const restricted=migrationFlowModel(scoped,true);
  assert.ok(restricted.nodes.some(node=>node.category==='restricted'&&node.label==='Outside accessible branches'));
  assert.ok(restricted.nodes.some(node=>node.category==='church'&&node.label==='Outside the church'));
  assert.ok(!restricted.nodes.some(node=>node.label==='Bauan'));
  assert.deepEqual({...migrationFlowSummary(restricted)},{incoming:8,outgoing:5,net:3});
});

test('empty, one-sided and highly uneven flow layouts stay finite and names retain accessible full text',()=>{
  for(const data of [{...fixture(),branches:[],flows:[]},{...fixture(),flows:[{source:'Batangas City',destination:'Bauan',transfers:1000000},{source:'Bauan',destination:'Batangas City',transfers:1}]}]){
    const result=layoutMigrationFlows(migrationFlowModel(data,true));
    assert.ok(Number.isFinite(result.height));
    for(const node of [...result.left,...result.right])assert.ok(node.height>=44&&node.y>=0&&node.y+node.height<=result.height);
    for(const flow of result.links)assert.doesNotMatch(flow.path,/NaN|Infinity/);
  }
  const lines=wrapFlowLabel('A very long church branch name that needs several separate lines to display');assert.equal(lines.length,2);assert.ok(lines[1].endsWith('…'));
});

test('branch keyboard selection, toggle, route details and mobile cards share the same filtered model',()=>{
  const h=clientHooks('app/portal/reports/MigrationFlow.tsx'),props={data:fixture()};
  const render=()=>h.render(props);
  const summary=tree=>React.Children.toArray(findElement(tree,e=>e.type==='dl').props.children).map(item=>React.Children.toArray(item.props.children[1].props.children).join(''));
  let tree=render();assert.deepEqual(summary(tree),['10','10','0']);
  let prevented=false;
  findElement(tree,e=>e.type==='g'&&e.props['aria-label']?.startsWith('From Batangas City')).props.onKeyDown({key:'Enter',preventDefault(){prevented=true;}});
  tree=render();assert.ok(prevented);assert.deepEqual(summary(tree),['7','3','+4']);
  const badge=findElement(tree,e=>e.props.role==='status');assert.match(badge.props.children,/Batangas City/);
  findElement(tree,e=>String(e.props.id??'').endsWith('-external')).props.onCheckedChange(true);
  tree=render();assert.deepEqual(summary(tree),['8','5','+3']);
  const html=renderToStaticMarkup(tree);assert.match(html,/Outside the church/);assert.match(html,/Directional migration routes/);assert.match(html,/View routes and exact counts/);
  const path=findElement(tree,e=>e.type==='path'&&e.props['aria-label']?.startsWith('Batangas City → Bauan'));
  path.props.onKeyDown({key:' ',preventDefault(){}});tree=render();assert.match(findElement(tree,e=>e.props.role==='status').props.children,/Batangas City → Bauan: 3 transfers/);
  // Applying a new server scope cannot retain or reveal the removed branch.
  findElement(tree,e=>e.type==='g'&&e.props['aria-label']?.startsWith('From Bauan')).props.onKeyDown({key:'Enter',preventDefault(){}});
  props.data={...fixture(),branches:[fixture().branches[0]],flows:[{source:'Outside accessible branches',destination:'Batangas City',transfers:7}]};
  tree=render();assert.match(findElement(tree,e=>e.props.role==='status').props.children,/Select a branch/);
  assert.doesNotMatch(renderToStaticMarkup(tree),/Bauan/);
});

test('departures-only and genuinely empty selections keep controls available with honest empty states',()=>{
  const data={...fixture(),flows:[],branches:[{id:'a',name:'Batangas City',incoming:0,outgoing:0,departures:2,returns:0,net:-2}]};
  const h=clientHooks('app/portal/reports/MigrationFlow.tsx');let tree=h.render({data});
  assert.ok(findElement(tree,e=>e.props.title==='No transfers in this selection'));
  findElement(tree,e=>String(e.props.id??'').endsWith('-external')).props.onCheckedChange(true);
  tree=h.render({data});assert.ok(findElement(tree,e=>e.type==='path'&&e.props['aria-label']?.includes('2 departures')));
});
