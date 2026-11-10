"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import type { ContributionMemberOption } from "./types";

export default function MemberAutocomplete({members,value,onChange,branchId,id="contribution-member",showContext=true,name="member_id",disabled=!branchId}:{
 members:ContributionMemberOption[];value:string;onChange:(id:string)=>void;branchId?:string;id?:string;showContext?:boolean;name?:string;disabled?:boolean;
}) {
 const selected=members.find(member=>member.id===value);
 const [query,setQuery]=useState(selected?.fullName??"");
 const [open,setOpen]=useState(false);
 const [active,setActive]=useState(0);
 const input=useRef<HTMLInputElement>(null);
 const selectedName=selected?.fullName;
 useEffect(()=>{if(selectedName){setQuery(selectedName);input.current?.setCustomValidity("");}},[selectedName]);
 const term=query.trim().toLocaleLowerCase();
 const matches=members.filter(member=>!term||member.fullName.toLocaleLowerCase().includes(term));
 const options=matches.slice(0,10);
 useEffect(()=>{if(open)document.getElementById(`${id}-option-${active}`)?.scrollIntoView({block:"nearest"});},[active,open,query,id]);
 function select(member:ContributionMemberOption){
  setQuery(member.fullName);onChange(member.id);setOpen(false);
  input.current?.setCustomValidity("");
 }
 function context(member:ContributionMemberOption){
  return `${member.homeBranchName??"Home branch unknown"}${member.churchBranchId&&member.churchBranchId!==branchId?" · Visiting Member":""}${member.isArchived?" · Archived (historical)":""}`;
 }
 return <div className="relative">
  <input type="hidden" name={name} value={value} disabled={disabled}/>
  <Input ref={input} id={id} role="combobox" aria-autocomplete="list"
   aria-expanded={open} aria-controls={`${id}-options`}
   aria-activedescendant={open&&options[active]?`${id}-option-${active}`:undefined}
   aria-describedby={selected&&showContext?`${id}-context`:undefined}
   value={query} placeholder="Search Member name..." autoComplete="off" required disabled={disabled}
   onFocus={()=>{setOpen(true);setActive(0);}}
   onBlur={()=>setOpen(false)}
   onChange={event=>{setQuery(event.target.value);onChange("");setOpen(true);setActive(0);event.target.setCustomValidity(event.target.value?"Choose a Member from the suggestions.":"");}}
   onKeyDown={event=>{
    if(event.key==="ArrowDown"||event.key==="ArrowUp"){
     event.preventDefault();setOpen(true);
     setActive(index=>!open?0:Math.max(0,Math.min(options.length-1,index+(event.key==="ArrowDown"?1:-1))));
    }else if(event.key==="Enter"&&open&&options[active]){event.preventDefault();select(options[active]);}
    else if(event.key==="Escape"){event.preventDefault();setOpen(false);}
   }}/>
  {selected&&showContext&&<p id={`${id}-context`} className="mt-1 text-xs text-slate-500">{context(selected)}</p>}
  {open&&!disabled&&<div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
   <ul id={`${id}-options`} role="listbox" aria-label="Matching Members" className="max-h-64 overflow-y-auto p-1">
    {options.map((member,index)=><li key={member.id} role="presentation"><button type="button" role="option" id={`${id}-option-${index}`} tabIndex={-1} aria-selected={active===index}
     className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[#EEF3FB] ${active===index?"bg-[#EEF3FB]":""}`}
     onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setActive(index)} onClick={()=>select(member)}>
     <span className="block font-medium text-slate-900">{member.fullName}</span>{showContext&&<span className="block text-xs text-slate-500">{context(member)}</span>}
    </button></li>)}
   </ul>
   {!options.length&&<p role="status" className="px-3 py-3 text-sm text-slate-500">No matching Members.</p>}
   {matches.length>10&&<p className="border-t px-3 py-2 text-xs text-slate-500">Type more to narrow the results.</p>}
  </div>}
 </div>;
}
