import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * The rail, in the shadcn spirit: a plain aside with small composable pieces
 * instead of one component that owns the layout. Colours come from the theme
 * tokens, so the light and dark switch keeps working untouched.
 */
function Sidebar({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-52 shrink-0 flex-col gap-4 border-r border-line bg-surface px-3 pt-4 pb-3 2xl:w-60",
        className,
      )}
      {...props}
    />
  );
}

function SidebarBrand({
  mark,
  name,
  tagline,
  className,
}: {
  mark: string;
  name: string;
  tagline: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5 px-2", className)}>
      <span className="grid size-8 place-items-center rounded-[9px] bg-primary text-[15px] font-bold text-primary-foreground">
        {mark}
      </span>
      <div className="flex min-w-0 flex-col leading-tight">
        <strong className="truncate text-[13.5px] font-semibold">{name}</strong>
        <span className="truncate text-2xs text-faint">{tagline}</span>
      </div>
    </div>
  );
}

function SidebarGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="px-2.5 pb-1 text-2xs font-semibold tracking-[0.09em] text-faint uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

const sidebarItemVariants = cva(
  "sidebar-item flex h-9 w-full items-center justify-start gap-2.5 rounded-[10px] border-0 bg-transparent px-2.5 text-left text-[13px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40 [&_svg]:shrink-0",
  {
    variants: {
      active: {
        true: "sidebar-item-active relative bg-primary-soft font-semibold text-primary-strong shadow-tile before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-primary [&_svg]:text-primary-strong",
        false: "font-medium text-muted hover:bg-surface-soft hover:text-ink",
      },
    },
    defaultVariants: { active: false },
  },
);

interface SidebarItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof sidebarItemVariants> {}

function SidebarItem({ className, active, ...props }: SidebarItemProps) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      className={cn(sidebarItemVariants({ active }), className)}
      {...props}
    />
  );
}

function SidebarFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-auto flex flex-col gap-3", className)} {...props} />;
}

export { Sidebar, SidebarBrand, SidebarGroup, SidebarItem, SidebarFooter };
