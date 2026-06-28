import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * The dashboard's single button primitive. CreativeOS uses a softer, rounded,
 * normal-case indigo language — distinct from the global (Blueprint) Button,
 * which is uppercase/sharp. Route all CreativeOS action buttons through this so
 * sizing, radius, focus, and brand colour stay consistent.
 */
const cosButton = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        brand: "bg-indigo-600 text-white hover:bg-indigo-700",
        soft: "bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100",
        outline: "bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50",
        ghost: "text-slate-500 hover:text-slate-700 hover:bg-slate-100",
      },
      size: {
        sm: "h-9 px-3 text-xs", // 36px — meets the touch-target floor
        md: "h-10 px-4 text-[13px]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "brand", size: "sm" },
  },
);

export interface CosButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof cosButton> {
  asChild?: boolean;
}

export const CosButton = React.forwardRef<HTMLButtonElement, CosButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    // Default native buttons to type="button"; leave slotted elements (e.g. <a>) alone.
    const typeProps = asChild ? {} : { type: type ?? "button" };
    return <Comp ref={ref} className={cn(cosButton({ variant, size, className }))} {...typeProps} {...props} />;
  },
);
CosButton.displayName = "CosButton";

export { cosButton };
