import * as React from "react";
import Link from "@/components/ui/intent-link";

import { cn } from "@/lib/utils";

type TableActionVariant =
  | "default"
  | "danger"
  | "success";

type BaseProps = {
  children: React.ReactNode;
  icon?: React.ReactNode;
  variant?: TableActionVariant;
  className?: string;
};

type ButtonProps = BaseProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: never;
  };

type LinkProps = BaseProps & {
  href: string;
  preserveContext?: boolean;
};

type TableActionButtonProps = ButtonProps | LinkProps;

const variantClasses: Record<TableActionVariant, string> = {
  default:
    "text-slate-600 hover:text-[#203264]",

  danger:
    "text-red-600 hover:text-red-700",

  success:
    "text-green-600 hover:text-green-700",
};

const baseClasses =
  "inline-flex min-h-11 md:min-h-9 items-center gap-1.5 px-1 text-sm font-medium transition " +
  "underline-offset-4 hover:underline " +
  "focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#365FA6] focus-visible:underline " +
  "active:scale-95 disabled:pointer-events-none disabled:opacity-50 " +
  "[&_svg]:h-3.5 [&_svg]:w-3.5";

function isLinkProps(
  props: TableActionButtonProps,
): props is LinkProps {
  return "href" in props && typeof props.href === "string";
}

export function TableActionButton(
  props: TableActionButtonProps,
) {
  if (isLinkProps(props)) {
    const {
      href,
      preserveContext,
      children,
      icon,
      variant = "default",
      className,
    } = props;

    return (
      <Link
        href={href}
        preserveContext={preserveContext}
        className={cn(
          baseClasses,
          variantClasses[variant],
          className,
        )}
      >
        {icon}
        {children}
      </Link>
    );
  }

  const {
    children,
    icon,
    variant = "default",
    className,
    ...buttonProps
  } = props;

  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        className,
      )}
      {...buttonProps}
    >
      {icon}
      {children}
    </button>
  );
}
