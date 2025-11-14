"use client";

import { PropsWithChildren } from 'react';
import { HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface GlossaryPopoverProps {
  title: string;
  description: string;
  example?: string;
}

export function GlossaryPopover({ title, description, example }: GlossaryPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/60 text-muted-foreground hover:bg-muted/40">
        <HelpCircle className="h-3 w-3" />
      </PopoverTrigger>
      <PopoverContent className="w-64 text-sm" side="top" align="start">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-2 text-muted-foreground leading-5">{description}</p>
        {example ? (
          <p className="mt-2 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            예시: {example}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}


