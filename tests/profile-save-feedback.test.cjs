/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {loadTypeScript}=require('./helpers/load-typescript.cjs');
function form(action){
 const updates=[];
 const redirect=new Error('NEXT_REDIRECT');
 const Form=loadTypeScript('app/portal/components/MemberProfileForm.tsx',{
  react:{...React,useState:initial=>[initial,value=>updates.push(value)],useRef:()=>({current:null}),useMemo:callback=>callback()},
  'next/navigation':{unstable_rethrow:error=>{if(error===redirect)throw error;}},
 },{FormData:class{get(){return '';}set(){}}}).default;
 const tree=Form({member:{first_name:'Test',last_name:'Member'},accountEmail:'',branches:[],departments:[],fieldDefinitions:[],customFieldValues:{},action:async()=>action(redirect)});
 return {submit:()=>tree.props.onSubmit({preventDefault(){},currentTarget:{}}),updates,redirect};
}
test('successful profile redirect is not converted into red save feedback',async()=>{
 const h=form(redirect=>{throw redirect;});
 await assert.rejects(h.submit(),error=>error===h.redirect);
 assert.ok(!h.updates.some(value=>typeof value==='string'));
 assert.equal(h.updates.at(-1),false);
});
test('profile validation feedback remains visible',async()=>{
 const h=form(()=>({error:'Enter a valid date.'}));await h.submit();
 assert.ok(h.updates.includes('Enter a valid date.'));
});
test('real request failures still show save feedback and clear pending state',async()=>{
 const h=form(()=>{throw new Error('Network failure');});await h.submit();
 assert.ok(h.updates.includes('Your profile could not be saved. Review the fields and try again.'));
 assert.equal(h.updates.at(-1),false);
});
