import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const statCardVariants = cva(
  "rounded-lg border shadow-sm hover:shadow-md transition-shadow duration-200",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        buy: "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
        sell: "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
        summary: "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800",
        neutral: "bg-slate-50/50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800"
      },
      size: {
        default: "p-6",
        compact: "p-4"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)

export interface StatCardProps 
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statCardVariants> {
  asChild?: boolean
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, variant, size, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(statCardVariants({ variant, size, className }))}
      {...props}
    />
  )
)
StatCard.displayName = "StatCard"

const StatCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 pb-3", className)}
    {...props}
  />
))
StatCardHeader.displayName = "StatCardHeader"

const StatCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-xs font-medium text-muted-foreground uppercase tracking-wide",
      className
    )}
    {...props}
  />
))
StatCardTitle.displayName = "StatCardTitle"

const StatCardValue = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-3xl font-extrabold tracking-tight", className)}
    {...props}
  />
))
StatCardValue.displayName = "StatCardValue"

const StatCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-xs text-muted-foreground/70", className)}
    {...props}
  />
))
StatCardDescription.displayName = "StatCardDescription"

const StatCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-2", className)} {...props} />
))
StatCardContent.displayName = "StatCardContent"

export { 
  StatCard, 
  StatCardHeader, 
  StatCardTitle, 
  StatCardValue,
  StatCardDescription,
  StatCardContent,
  statCardVariants
}

