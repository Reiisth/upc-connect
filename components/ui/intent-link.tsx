"use client";
import Link from "next/link";
import { useState, type ComponentProps } from "react";
/** Navigation and table links defer route prefetch until intent, then restore Next defaults. */
export default function IntentLink({onMouseEnter, onFocus, onTouchStart, ...props}: ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false);
  return <Link {...props} prefetch={intent ? null : false}
    onMouseEnter={event => { setIntent(true); onMouseEnter?.(event); }}
    onFocus={event => { setIntent(true); onFocus?.(event); }}
    onTouchStart={event => { setIntent(true); onTouchStart?.(event); }} />;
}

