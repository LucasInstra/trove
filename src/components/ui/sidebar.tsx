import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * The rail, in the shadcn spirit: a plain aside with small composable pieces
 * instead of one component that owns the layout. Colours come from the theme
 * tokens, so the light and dark switch keeps working untouched.
 */
function Sidebar({
  className,
  collapsed = false,
  ...props
}: React.HTMLAttributes<HTMLElement> & { collapsed?: boolean }) {
  return (
    <aside
      data-collapsed={collapsed ? "true" : undefined}
      className={cn(
        "sidebar-rail flex h-full min-h-0 shrink-0 flex-col gap-4 border-r border-line bg-surface px-2 pt-3 pb-3",
        className,
      )}
      {...props}
    />
  );
}

function SidebarProfile({
  initials,
  name,
  detail,
  color,
  onClick,
  className,
  collapsed = false,
}: {
  initials: string;
  name: string;
  detail: string;
  color?: string | null;
  onClick: () => void;
  className?: string;
  collapsed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "sidebar-profile flex w-full items-center justify-start gap-2.5 rounded-md border-0 bg-transparent px-1 py-1 text-left transition-colors hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        className,
      )}
      title={name}
    >
      <span
        className="grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold text-white"
        style={{ background: color ?? "var(--primary)" }}
        aria-hidden="true"
      >
        {initials}
      </span>
      <span
        className={cn(
          "sidebar-profile-copy min-w-0 flex-col leading-tight",
          collapsed ? "hidden" : "flex",
        )}
      >
        <strong className="truncate text-[13px] font-semibold">{name}</strong>
        <span className="truncate text-2xs text-faint">{detail}</span>
      </span>
    </button>
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
      <span className="sidebar-group-label px-2.5 pb-1 text-2xs font-semibold tracking-[0.09em] text-faint uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

const sidebarItemVariants = cva(
  "sidebar-item flex h-9 w-full items-center justify-start gap-2.5 rounded-md border-0 bg-transparent px-2.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&_svg]:shrink-0",
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

export { Sidebar, SidebarGroup, SidebarItem, SidebarFooter, SidebarProfile };
