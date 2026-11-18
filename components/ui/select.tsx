"use client";
import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useFormControl } from "./form-field-context";

import { cn } from "@/lib/utils";

type Option = { value: string; label: string; disabled: boolean; group?: string };
function text(children: React.ReactNode): string {
  return React.Children.toArray(children).map(child => React.isValidElement<{children?: React.ReactNode}>(child)
    ? text(child.props.children) : String(child)).join("");
}
/** Preserve the option/optgroup API used by existing forms and server pages. */
export function selectOptions(children: React.ReactNode, group?: string, disabled = false): Option[] {
  return React.Children.toArray(children).flatMap(child => {
    if (!React.isValidElement<{value?: string | number; label?: string; disabled?: boolean; children?: React.ReactNode}>(child)) return [];
    if (child.type === "option") return [{value:String(child.props.value ?? text(child.props.children)),label:child.props.label ?? text(child.props.children),disabled:disabled || Boolean(child.props.disabled),group}];
    return selectOptions(child.props.children,child.type === "optgroup" ? child.props.label : group,disabled || Boolean(child.props.disabled));
  });
}

const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
({className,children,value,defaultValue,onChange,onInvalid,autoFocus,...props},ref) => {
  const control = useFormControl(props);
  const generatedId = React.useId();
  const id = control.id ?? generatedId;
  const native = React.useRef<HTMLSelectElement>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const resetting = React.useRef(false);
  const [portalContainer,setPortalContainer] = React.useState<HTMLElement>();
  const options = React.useMemo(() => selectOptions(children),[children]);
  const sections = React.useMemo(() => {
    const groups: {group?: string; options: Option[]}[] = [];
    for (const option of options) {
      const last=groups.at(-1);
      if (last && last.group === option.group) last.options.push(option);
      else groups.push({group:option.group,options:[option]});
    }
    return groups;
  },[options]);
  const [chosen,setChosen] = React.useState(() => String(defaultValue ?? options.find(option => !option.disabled)?.value ?? ""));
  const [validation,setValidation] = React.useState("");
  const selected = String(value ?? chosen);
  const current = options.find(option => option.value === selected) ?? options.find(option => !option.disabled);
  const describedBy = [control["aria-describedby"],validation ? `${id}-validation` : null].filter(Boolean).join(" ") || undefined;

  React.useEffect(() => {
    // A native modal dialog is in the browser top layer; its picker must stay
    // inside that dialog rather than portal into the inert page behind it.
    setPortalContainer(trigger.current?.closest("dialog") ?? undefined);
  },[]);

  React.useEffect(() => {
    const form = native.current?.form;
    const reset = (event: Event) => {
      resetting.current=true;
      queueMicrotask(() => {
        if (!event.defaultPrevented) {
          const next=String(value ?? defaultValue ?? options.find(option => !option.disabled)?.value ?? "");
          if (native.current) native.current.value=next;
          setChosen(next);setValidation("");
        }
        resetting.current=false;
      });
    };
    form?.addEventListener("reset",reset,true);
    return () => form?.removeEventListener("reset",reset,true);
  },[defaultValue,options,value]);

  if (props.multiple || (props.size ?? 0) > 1) return <select {...control} ref={ref} value={value} defaultValue={defaultValue} onChange={onChange} onInvalid={onInvalid} className={cn("h-11 w-full rounded-xl border border-slate-300 bg-white px-4 py-2",className)}>{children}</select>;

  function choose(encoded: string) {
    const element = native.current;
    if (!element || resetting.current) return;
    element.value = encoded.slice(7);
    // Real DOM change events preserve existing handlers and parent form listeners.
    element.dispatchEvent(new Event("change",{bubbles:true}));
  }

  return <>
    <select {...control} id={`${id}-native`} ref={element => {
      native.current=element;
      if (typeof ref === "function") ref(element); else if (ref) ref.current=element;
    }} value={current?.value ?? ""} tabIndex={-1} aria-hidden="true" className="sr-only"
      onFocus={() => trigger.current?.focus()}
      onChange={event => {setChosen(event.target.value);setValidation("");onChange?.(event);}}
      onInvalid={event => {onInvalid?.(event);event.preventDefault();setValidation(event.currentTarget.validationMessage);trigger.current?.focus();}}>{children}</select>
    <SelectPrimitive.Root value={current ? `option:${current.value}` : ""} disabled={control.disabled} onValueChange={choose}>
      <SelectPrimitive.Trigger id={id} ref={trigger} autoFocus={autoFocus} dir={control.dir} title={control.title}
        aria-label={control["aria-label"]} aria-labelledby={control["aria-labelledby"]} aria-describedby={describedBy}
        aria-invalid={control["aria-invalid"] || Boolean(validation) || undefined} aria-required={control.required || control["aria-required"]}
        className={cn("group inline-flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-base text-slate-900 md:text-sm shadow-sm shadow-[#203264]/[0.03] transition hover:border-[#5D94E8] hover:bg-[#F8FAFD] focus-visible:border-[#5D94E8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5D94E8]/10 focus-visible:ring-offset-0 data-[state=open]:border-[#5D94E8] data-[state=open]:ring-4 data-[state=open]:ring-[#5D94E8]/10 aria-invalid:border-red-400 aria-invalid:focus-visible:border-red-400 aria-invalid:focus-visible:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 disabled:opacity-70 disabled:hover:border-slate-300 [&>span:first-child]:truncate",className)}>
        <SelectPrimitive.Value placeholder="Choose an option">{current?.label}</SelectPrimitive.Value>
        <SelectPrimitive.Icon asChild><ChevronDown className="h-4 w-4 shrink-0 text-[#365FA6] transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal container={portalContainer}><SelectPrimitive.Content position="popper" sideOffset={6} collisionPadding={12}
        className="z-[10010] max-h-[min(22rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-[#DCE5F3] bg-white p-1.5 text-slate-900 shadow-[0_12px_40px_-8px_rgba(32,50,100,0.22)] origin-[--radix-select-content-transform-origin] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95">
        <SelectPrimitive.ScrollUpButton className="flex h-7 items-center justify-center text-[#365FA6]"><ChevronUp className="h-4 w-4" /></SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport>
          {sections.map((section,index) => <SelectPrimitive.Group key={index}>
            {section.group && <SelectPrimitive.Label className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{section.group}</SelectPrimitive.Label>}
            {section.options.map((option,itemIndex) => <SelectPrimitive.Item key={`${option.value}:${itemIndex}`} value={`option:${option.value}`} disabled={option.disabled} textValue={option.label}
              className="relative flex min-h-11 cursor-default select-none items-center break-words rounded-xl py-2 pl-3 pr-10 text-sm outline-none data-[highlighted]:bg-[#EEF3FB] data-[highlighted]:text-[#203264] data-[state=checked]:bg-[#EEF3FB] data-[state=checked]:font-semibold data-[state=checked]:text-[#203264] data-[disabled]:pointer-events-none data-[disabled]:opacity-40">
              <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              <SelectPrimitive.ItemIndicator className="absolute right-3 flex items-center text-[#365FA6]"><Check className="h-4 w-4" aria-hidden="true" /></SelectPrimitive.ItemIndicator>
            </SelectPrimitive.Item>)}
          </SelectPrimitive.Group>)}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex h-7 items-center justify-center text-[#365FA6]"><ChevronDown className="h-4 w-4" /></SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content></SelectPrimitive.Portal>
    </SelectPrimitive.Root>
    {validation && <p id={`${id}-validation`} role="alert" className="mt-1 text-sm text-red-700">{validation}</p>}
  </>;
});

Select.displayName = "Select";

export { Select };
