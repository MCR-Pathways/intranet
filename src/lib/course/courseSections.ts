import type { ContentItemWithOptions, SectionHeaderSettings } from '@/types/chat-content';

export type SectionLayout = NonNullable<SectionHeaderSettings['layout']>;

export interface CourseSection {
  /** the section_header item (synthetic for header-less courses) */
  header: ContentItemWithOptions;
  layout: SectionLayout;
  /** child blocks of this section, in sort order, excluding section headers */
  blocks: ContentItemWithOptions[];
}

function syntheticHeader(items: ContentItemWithOptions[]): ContentItemWithOptions {
  return {
    id: '__default__',
    collection_id: items[0]?.collection_id ?? '',
    parent_id: null,
    type: 'section_header',
    title: null,
    content: null,
    is_required: false,
    correct_answer: null,
    settings: { layout: 'content' },
    sort_order: -1,
    options: [],
  };
}

/**
 * Group a flat, sort_order-ordered list of content items into section screens.
 * Each `section_header` starts a section; its children (by parent_id) become its
 * blocks. A course with no section headers gets one synthetic content section so
 * legacy/flat courses still render.
 */
export function groupIntoSections(items: ContentItemWithOptions[]): CourseSection[] {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const hasHeaders = sorted.some((i) => i.type === 'section_header');

  if (!hasHeaders) {
    return [{ header: syntheticHeader(sorted), layout: 'content', blocks: sorted }];
  }

  // Flow-group by document order: each section_header opens a section and every
  // following non-header item belongs to it. This matches parent_id grouping for
  // correctly-authored content but never silently drops an "orphan" item whose
  // parent_id is null or points elsewhere — losing published content is worse
  // than placing it in document order.
  const sections: CourseSection[] = [];
  const lead: ContentItemWithOptions[] = []; // items before the first header
  let current: CourseSection | null = null;

  for (const item of sorted) {
    if (item.type === 'section_header') {
      const layout = (item.settings as SectionHeaderSettings)?.layout ?? 'content';
      current = { header: item, layout, blocks: [] };
      sections.push(current);
    } else if (current) {
      current.blocks.push(item);
    } else {
      lead.push(item);
    }
  }

  if (lead.length && sections.length) sections[0].blocks.unshift(...lead);
  return sections;
}
