import * as React from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-card border border-line bg-surface p-4 text-ink shadow-tile",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between gap-3", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("text-[14px] font-semibold tracking-[-0.01em]", className)} {...props} />
  );
}

function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[12px] text-muted", className)} {...props} />;
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-3", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between gap-3", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
