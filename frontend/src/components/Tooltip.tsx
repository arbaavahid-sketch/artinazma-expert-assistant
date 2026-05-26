"use client";

import { ReactNode, useState } from "react";

type TooltipProps = {
  label: string;
  children: ReactNode;
  /** Position of the tooltip relative to the trigger. Default: "top" */
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
};

/**
 * Lightweight tooltip wrapper.
 * Uses local hover state instead of CSS group-hover to avoid
 * conflicts with parent group classes.
 */
export default function Tooltip({
  label,
  children,
  position = "top",
  className = "",
}: TooltipProps) {
  const [show, setShow] = useState(false);

  const positionClasses: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowClasses: Record<string, string> = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-slate-800 border-x-transparent border-b-transparent",
    bottom:
      "bottom-full left-1/2 -translate-x-1/2 border-b-slate-800 border-x-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-l-slate-800 border-y-transparent border-r-transparent",
    right:
      "right-full top-1/2 -translate-y-1/2 border-r-slate-800 border-y-transparent border-l-transparent",
  };

  return (
    <div
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      <div
        role="tooltip"
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-xl bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-white shadow-lg transition-opacity duration-150 ${positionClasses[position]} ${show ? "opacity-100" : "opacity-0"}`}
      >
        {label}
        <span
          className={`absolute border-4 ${arrowClasses[position]}`}
          aria-hidden
        />
      </div>
    </div>
  );
}
