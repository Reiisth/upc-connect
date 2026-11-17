/* eslint-disable @typescript-eslint/no-require-imports -- Actual component accessibility regressions. */
const test=require('node:test'),assert=require('node:assert/strict'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {loadTypeScript}=require('./helpers/load-typescript.cjs');
const {clientHooks,findElement}=require('./helpers/client-hooks.cjs');

test('shared field links nested controls, required state, descriptions and errors without losing existing hints',()=>{
 const context=loadTypeScript('components/ui/form-field-context.tsx');
 const stubs={'./form-field-context':context};
 const {FormField}=loadTypeScript('components/ui/form-field.tsx',stubs);
 const {Input}=loadTypeScript('components/ui/input.tsx',stubs);
 const native=renderToStaticMarkup(React.createElement(FormField,{label:'Phone',htmlFor:'phone',required:true,description:'Include country code.',error:'Invalid phone.'},React.createElement('div',null,React.createElement('input',{id:'phone','aria-describedby':'external-help'}))));
 assert.match(native,/aria-describedby="external-help phone-description phone-error"/);assert.match(native,/aria-invalid="true"/);assert.match(native,/aria-required="true"/);
 assert.match(native,/id="phone-description"/);assert.match(native,/id="phone-error"/);
 const generated=renderToStaticMarkup(React.createElement(FormField,{label:'Name',required:true,description:'Your name.'},React.createElement('div',null,React.createElement(Input,{}))));
 const id=/for="([^"]+)"/.exec(generated)[1];assert.ok(generated.includes(`id="${id}"`));
 assert.ok(generated.includes(`aria-describedby="${id}-description"`));assert.match(generated,/aria-required="true"/);
});

test('password errors identify every affected field before calling the server and keep requirements visible',async()=>{
 let calls=0;const h=clientHooks('app/portal/account/ChangePasswordForm.tsx',{'./actions':{changeOwnPassword:async()=>{calls++;return{};}}});
 let tree=h.render({});await tree.props.onSubmit({preventDefault(){}});tree=h.render({});
 const field=label=>findElement(tree,e=>e.props.label===label);
 assert.equal(field('Current Password').props.error,'Enter your current password.');
 assert.equal(field('New Password').props.error,'Enter a new password.');assert.match(field('New Password').props.description,/at least 8/);assert.equal(calls,0);
 field('Current Password').props.onChange('current-value');field('New Password').props.onChange('short');field('Confirm New Password').props.onChange('different');
 tree=h.render({});await tree.props.onSubmit({preventDefault(){}});tree=h.render({});
 assert.match(field('New Password').props.error,/8 characters/);assert.match(field('Confirm New Password').props.error,/do not match/);assert.equal(calls,0);
 field('New Password').props.onChange('new-password');field('Confirm New Password').props.onChange('new-password');
 tree=h.render({});await tree.props.onSubmit({preventDefault(){}});assert.equal(calls,1);
});

test('pending confirmations cannot dismiss by Escape, backdrop or Close, and start on the safe action',()=>{
 let closes=0;const {ConfirmActionModal}=loadTypeScript('components/ui/confirm-action-modal.tsx');
 const html=renderToStaticMarkup(React.createElement(ConfirmActionModal,{open:true,loading:true,title:'Archive?',description:'Records preserved.',onClose(){},onConfirm(){}}));
 assert.match(html,/<dialog/);assert.match(html,/aria-labelledby=/);assert.match(html,/aria-describedby=/);assert.match(html,/data-dialog-initial-focus/);
 assert.match(html,/<button[^>]*disabled=""[^>]*aria-label="Close"/);
 const h=clientHooks('components/ui/dialog.tsx',{},'Dialog');
 let tree=h.render({open:true,dismissible:false,labelledBy:'title',onClose:()=>closes++,children:'Content'});
 tree.props.onCancel({preventDefault(){}});tree.props.onClick({target:tree,currentTarget:tree});assert.equal(closes,0);
 tree=h.render({open:true,dismissible:true,labelledBy:'title',onClose:()=>closes++,children:'Content'});tree.props.onCancel({preventDefault(){}});assert.equal(closes,1);
 const panel={getBoundingClientRect:()=>({left:100,right:300,top:100,bottom:300})};
 tree.props.onClick({target:panel,currentTarget:panel,clientX:150,clientY:150});assert.equal(closes,1);
 tree.props.onClick({target:panel,currentTarget:panel,clientX:20,clientY:20});assert.equal(closes,2);
});

test('service status is visible information and no longer a terminal-action button',()=>{
 const Status=loadTypeScript('app/portal/services/ServiceStatusIcon.tsx').default;
 for(const status of ['scheduled','ongoing','completed','cancelled']){
   const html=renderToStaticMarkup(React.createElement(Status,{status}));assert.doesNotMatch(html,/<button|tabindex=|max-w-0/);assert.match(html,new RegExp(status,'i'));
 }
});

test('dialog opens modally, focuses its safe control, locks scrolling and restores the trigger on close',()=>{
 const events=[];let effect;const reference={current:null};
 class Element {constructor(){this.isConnected=true;}focus(){events.push('restore-trigger');}}
 const trigger=new Element();const document={activeElement:trigger,body:{style:{overflow:'scroll'}}};
 const {Dialog}=loadTypeScript('components/ui/dialog.tsx',{react:{...React,useRef:()=>reference,useEffect:callback=>{effect=callback;}}},{document,HTMLElement:Element});
 Dialog({open:true,labelledBy:'title',onClose(){},children:'Content'});
 reference.current={showModal:()=>events.push('showModal'),close:()=>events.push('close'),querySelector:()=>({focus:()=>events.push('focus-safe-control')})};
 const cleanup=effect();assert.equal(document.body.style.overflow,'hidden');assert.deepEqual(events,['showModal','focus-safe-control']);
 cleanup();assert.equal(document.body.style.overflow,'scroll');assert.deepEqual(events,['showModal','focus-safe-control','close','restore-trigger']);
});

test('brand action and status text colors meet normal text contrast on their backgrounds',()=>{
 function luminance(hex){const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
 for(const[foreground,background]of[['#365FA6','#FFFFFF'],['#365FA6','#EEF3FB'],['#065F46','#ECFDF5'],['#334155','#F1F5F9']]){
   const values=[luminance(foreground),luminance(background)].sort((a,b)=>a-b);assert.ok((values[1]+.05)/(values[0]+.05)>=4.5);
 }
});
