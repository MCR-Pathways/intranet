'use client';

import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { ContentItem } from '@/types/chat-content';

export function TextAreaItem({ item }: { item: ContentItem }) {
  const [value, setValue] = useState('');
  const inputId = `preview-${item.id}`;
  const storedLabel = item.title ?? item.content ?? '';
  const labelText = storedLabel || 'Your answer';
  return (
    <div className="space-y-2">
      <Label htmlFor={inputId} className="text-base font-medium text-foreground">
        {labelText}
      </Label>
      <Textarea
        id={inputId}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        placeholder="Type your answer…"
      />
    </div>
  );
}
