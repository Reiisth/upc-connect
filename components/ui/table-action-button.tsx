import * as React from "react";
import Link from "next/link";

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
};

type TableActionButtonProps = ButtonProps | LinkProps;

const variantClasses: Record<TableActionVariant, string> = {
  default:
    "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",

  danger:
    "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",

  success:
    "border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300",
};

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5D94E8] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

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
      children,
      icon,
      variant = "default",
      className,
    } = props;

    return (
      <Link
        href={href}
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