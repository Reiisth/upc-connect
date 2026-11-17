/* eslint-disable @typescript-eslint/no-require-imports -- Real component regression harness. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {loadTypeScript}=require('./helpers/load-typescript.cjs');
const {clientHooks,findElement}=require('./helpers/client-hooks.cjs');

test('mobile records retain one semantic table, all labels, filters and authorized actions',()=>{
  const h=clientHooks('app/portal/contributions/ContributionsTable.tsx',{'./dashboard-actions':{}});
  const props={records:[{id:'record-1',contributorType:'member',memberName:'Ana With A Very Long Name',memberId:'member-1',churchBranchId:'north',contributionType:'tithe',paymentMethod:'cash',amount:'123.45',contributionDate:'2026-11-03',branch:{name:'North'}}],branches:[],canUpdate:true};
  const tree=h.render(props),table=findElement(tree,e=>e.type.displayName==='Table');
  assert.equal(table.props.mobileCards,true);
  const row=findElement(tree,e=>e.type.displayName==='TableBody').props.children[0];
  assert.deepEqual(React.Children.toArray(row.props.children).map(cell=>cell.props['data-label']),['Date','Contributor','Type','Branch','Service','Payment method','Amount','Recorded by','Actions']);
  assert.ok(findElement(row,e=>e.props.children==='Edit'));
  assert.ok(findElement(tree,e=>e.props.label==='Contribution Type'));
  const tableUi=loadTypeScript('components/ui/table.tsx');
  const html=renderToStaticMarkup(React.createElement(tableUi.Table,{mobileCards:true},React.createElement(tableUi.TableHeader,null,React.createElement(tableUi.TableRow,null,React.createElement(tableUi.TableHead,null,'Member'))),React.createElement(tableUi.TableBody,null,React.createElement(tableUi.TableRow,null,React.createElement(tableUi.TableCell,{'data-label':'Member'},'Ana')))));
  assert.equal((html.match(/<table /g)||[]).length,1);
  assert.match(html,/role="table"/);assert.match(html,/scope="col"/);assert.match(html,/<td[^>]*role="cell"[^>]*data-label="Member"/);
  assert.match(renderToStaticMarkup(React.createElement(tableUi.TableHead,{scope:'row'},'January')),/role="rowheader"/);
  const readOnly=h.render({...props,canUpdate:false});assert.equal(findElement(readOnly,e=>e.props.children==='Edit'),undefined);
});

test('mobile More opens a labeled modal, marks secondary destinations and closes explicitly',()=>{
  const h=clientHooks('app/portal/MobileNavigation.tsx',{'next/navigation':{usePathname:()=>'/portal/reports/migrations'}});
  const props={primary:React.createElement('a',{href:'/portal/members'},'Members'),moreRoutes:['/portal/reports'],children:React.createElement('a',{href:'/portal/reports'},'Reports')};
  let tree=h.render(props);const trigger=findElement(tree,e=>e.props['aria-haspopup']==='dialog');
  assert.equal(trigger.props['aria-expanded'],false);assert.match(trigger.props['aria-label'],/current section/);
  trigger.props.onClick();tree=h.render(props);
  const dialog=findElement(tree,e=>e.type.name==='Dialog');assert.equal(dialog.props.open,true);
  assert.equal(dialog.props.labelledBy,findElement(tree,e=>e.type==='h2').props.id);
  assert.ok(findElement(tree,e=>e.props['aria-label']==='More navigation'));
  findElement(tree,e=>e.props['data-dialog-initial-focus']!==undefined).props.onClick();
  assert.equal(findElement(h.render(props),e=>e.type.name==='Dialog').props.open,false);
});

test('Record/Correct brings the selected attendance form into view without saving or changing permissions',()=>{
  for(const existing of [false,true]){
    let saves=0;const h=clientHooks('app/portal/attendance/AttendanceView.tsx',{'./actions':{saveAttendanceRecord:async()=>{saves++;},searchAttendanceMembers:async()=>[]}});
    const member={id:'member-1',firstName:'Ana',lastName:'Cruz',middleName:null,churchBranchId:'north',memberStatus:'active',isArchived:false};
    const row={member,isCurrentlyEligible:true,attendance:existing?{id:'attendance-1',status:'excused',checkInTime:null,method:'manual'}:null};
    const props={serviceId:'service-1',serviceBranchId:'north',rows:[row],canRecord:!existing,canCorrect:existing};
    let tree=h.render(props);const form=findElement(tree,e=>e.type==='form');const status=findElement(tree,e=>e.props.id==='attendance-status');
    const events=[];form.props.ref.current={scrollIntoView:options=>events.push(['scroll',options.block])};status.props.ref.current={focus:options=>events.push(['focus',options.preventScroll])};
    findElement(tree,e=>e.props.children===(existing?'Correct':'Record')).props.onClick();
    tree=h.render(props);assert.equal(findElement(tree,e=>e.props.id==='attendance-status').props.value,existing?'excused':'present');
    assert.equal(findElement(tree,e=>e.props.id==='attendance-member').props.value,'member-1');
    assert.deepEqual(events,[['scroll','start'],['focus',true]]);assert.equal(saves,0);
    const readOnly=h.render({...props,canRecord:false,canCorrect:false});assert.equal(findElement(readOnly,e=>e.props.children==='Record'||e.props.children==='Correct'),undefined);
  }
});

test('touch member suggestions preserve input focus until a deliberate selection',()=>{
  const calls=[];const h=clientHooks('app/portal/contributions/MemberAutocomplete.tsx');
  const props={branchId:'north',value:'',members:[{id:'member-1',fullName:'Ana Cruz',churchBranchId:'north'}],onChange:id=>calls.push(id)};
  let tree=h.render(props);findElement(tree,e=>e.props.role==='combobox').props.onFocus();
  tree=h.render(props);const option=findElement(tree,e=>e.props.role==='option');let prevented=false;
  option.props.onPointerDown({preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.deepEqual(calls,[]);
  option.props.onClick();assert.deepEqual(calls,['member-1']);assert.equal(findElement(h.render(props),e=>e.props.role==='listbox'),undefined);
});
