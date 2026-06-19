'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ContentItem, ScaleItemSettings } from '@/types/chat-content';

export function ScaleItem({ item }: { item: ContentItem }) {
  const [value, setValue] = useState<number | null>(null);
  const settings = (item.settings ?? {}) as ScaleItemSettings;
  const min = settings.min ?? 1;
  const max = settings.max ?? 5;
  const values: number[] = [];
  for (let n = min; n <= max; n++) values.push(n);

  const storedLabel = item.title ?? item.content ?? '';
  const labelText = storedLabel || 'On a scale…';

  return (
    <div className="space-y-3">
      <p className="text-base font-medium text-foreground">{labelText}</p>
      <div className="flex flex-wrap items-center gap-2">
        {settings.minLabel ? (
          <span className="text-xs text-mcr-db-400">{settings.minLabel}</span>
        ) : null}
        {values.map((n) => (
          <Button
            key={n}
            type="button"
            size="sm"
            variant={value === n ? 'default' : 'outline'}
            onClick={() => setValue(n)}
            aria-label={`Rating ${n}`}
          >
            {n}
          </Button>
        ))}
        {settings.maxLabel ? (
          <span className="text-xs text-mcr-db-400">{settings.maxLabel}</span>
        ) : null}
      </div>
    </div>
  );
}
