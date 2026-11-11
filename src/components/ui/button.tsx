import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-[13px] font-medium transition-[background-color,border-color,color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-55 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-strong",
        solid: "bg-ink text-[#f7f4ee] hover:opacity-90",
        outline:
          "border border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-soft",
        soft: "bg-surface-soft text-ink hover:bg-sunken",
        ghost: "text-muted hover:bg-surface-soft hover:text-ink",
        danger: "bg-negative text-white hover:opacity-90",
      },
      size: {
        sm: "h-8 px-3 text-[12.5px]",
        md: "h-10 px-4",
        lg: "h-11 px-5",
        icon: "size-9",
        iconSm: "size-7 rounded-full px-0",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}

export { buttonVariants };
