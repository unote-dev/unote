import type { ComponentProps } from 'react'
import { GripVertical } from 'lucide-react'
import { Group, Panel, Separator } from 'react-resizable-panels'

import { cn } from '@/lib/utils'

export function ResizablePanelGroup({ className, ...props }: ComponentProps<typeof Group>) {
  return <Group className={cn('flex size-full', className)} {...props} />
}

export const ResizablePanel = Panel

export function ResizableHandle({ className, withHandle, ...props }: ComponentProps<typeof Separator> & { withHandle?: boolean }) {
  return (
    <Separator
      className={cn('relative flex w-px items-center justify-center bg-border outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 [&[data-separator=horizontal]]:h-px [&[data-separator=horizontal]]:w-full [&[data-separator=horizontal]]:after:left-0 [&[data-separator=horizontal]]:after:h-3 [&[data-separator=horizontal]]:after:w-full [&[data-separator=horizontal]]:after:translate-x-0 [&[data-separator=horizontal]]:after:-translate-y-1/2', className)}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-4 w-3 items-center justify-center rounded-xs border bg-border">
          <GripVertical className="size-2.5" />
        </div>
      )}
    </Separator>
  )
}
