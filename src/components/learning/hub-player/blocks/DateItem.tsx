'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ContentItem } from '@/types/chat-content';

export function DateItem({ item }: { item: ContentItem }) {
  const [value, setValue] = useState('');
  const inputId = `preview-${item.id}`;
  const storedLabel = item.title ?? item.content ?? '';
  const labelText = storedLabel || 'Date';
  return (
    <div className="space-y-2">
      <Label htmlFor={inputId} className="text-base font-medium text-foreground">
        {labelText}
      </Label>
      <Input
        id={inputId}
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="max-w-xs"
      />
    </div>
  );
}
