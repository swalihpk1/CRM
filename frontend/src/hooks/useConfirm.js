import { useConfirmContext } from '../context/ConfirmProvider';

/**
 * Returns `confirm(options) => Promise<boolean>`. See ConfirmProvider for
 * the full design rationale.
 *
 * Usage (mirrors the old window.confirm control-flow exactly):
 *   const confirm = useConfirm();
 *   const ok = await confirm({
 *     title: 'Delete contact?',
 *     description: 'This cannot be undone.',
 *     destructive: true,
 *   });
 *   if (!ok) return;
 */
export function useConfirm() {
  return useConfirmContext();
}
