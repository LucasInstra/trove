import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-semibold",
  {
    variants: {
      tone: {
        neutral: "border-line bg-surface-soft text-muted",
        primary: "border-transparent bg-primary-soft text-primary-strong",
        positive: "border-transparent bg-positive/12 text-positive",
        negative: "border-transparent bg-negative/12 text-negative",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
