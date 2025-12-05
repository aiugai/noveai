'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = ({
  ref,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> & {
  ref?: React.RefObject<React.ElementRef<typeof DialogPrimitive.Overlay> | null>
}) => {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity data-[state=closed]:opacity-0 data-[state=open]:opacity-100',
        className,
      )}
      {...props}
    />
  )
}
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = ({
  ref,
  className,
  children,
  hideCloseButton = false,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  hideCloseButton?: boolean
} & { ref?: React.RefObject<React.ElementRef<typeof DialogPrimitive.Content> | null> }) => {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        role="dialog"
        aria-modal="true"
        className={cn(
          'fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] z-50 grid w-full max-w-lg border border-border bg-card p-6 shadow-lg duration-200 transition-opacity data-[state=closed]:opacity-0 data-[state=open]:opacity-100 sm:rounded-lg',
          className,
        )}
        {...props}
      >
        {children}
        {!hideCloseButton && (
          <DialogPrimitive.Close
            type="button"
            className="absolute right-2 top-2 p-2 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}
DialogContent.displayName = DialogPrimitive.Content.displayName

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)}
      {...props}
    />
  )
}
DialogHeader.displayName = 'DialogHeader'

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
      {...props}
    />
  )
}
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = ({
  ref,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title> & {
  ref?: React.RefObject<React.ElementRef<typeof DialogPrimitive.Title> | null>
}) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight text-foreground', className)}
    {...props}
  />
)
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = ({
  ref,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description> & {
  ref?: React.RefObject<React.ElementRef<typeof DialogPrimitive.Description> | null>
}) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
)
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
