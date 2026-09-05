import React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from './ui/alert-dialog';
import { buttonVariants } from './ui/button';
import { cn } from '../lib/utils';

/**
 * Controlled presentational wrapper over the existing shadcn alert-dialog
 * primitives — driven purely by `open`, with no <AlertDialogTrigger>.
 * Rendered once, app-wide, by ConfirmProvider (see context/ConfirmProvider
 * + hooks/useConfirm), replacing the ~8 window.confirm(...) call sites
 * from the old App.js.
 *
 * Also used as the base for confirm-style flows on mobile — full-width,
 * comfortably-tappable action buttons (min-h-11) since this is one of the
 * mobile-first surfaces per the restructure's design priority.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel?.();
      }}
    >
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <AlertDialogCancel className="min-h-11 sm:min-h-9" onClick={onCancel}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              'min-h-11 sm:min-h-9',
              destructive && buttonVariants({ variant: 'destructive' })
            )}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
