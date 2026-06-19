'use client';

import type { ContentItemWithOptions } from '@/types/chat-content';

// New course-component blocks
import { Callout } from '@/components/learning/hub-player/blocks/Callout';
import { FeatureList } from '@/components/learning/hub-player/blocks/FeatureList';
import { CardCarousel } from '@/components/learning/hub-player/blocks/CardCarousel';
import { InteractiveTiles } from '@/components/learning/hub-player/blocks/InteractiveTiles';
import { Accordion } from '@/components/learning/hub-player/blocks/Accordion';
import { ScenarioDeck } from '@/components/learning/hub-player/blocks/ScenarioDeck';
import { ContactList } from '@/components/learning/hub-player/blocks/ContactList';
import { VideoBlock } from '@/components/learning/hub-player/blocks/VideoBlock';
import { ImageBlock } from '@/components/learning/hub-player/blocks/ImageBlock';
import { Completion } from '@/components/learning/hub-player/blocks/Completion';
import { SingleQuestion } from '@/components/learning/hub-player/blocks/SingleQuestion';
import { MultiQuestion } from '@/components/learning/hub-player/blocks/MultiQuestion';
import { YesNoQuestion } from '@/components/learning/hub-player/blocks/YesNoQuestion';
import { OrderingQuestion } from '@/components/learning/hub-player/blocks/OrderingQuestion';

// Reused preview renderers for the non-interactive / form types (moved into blocks/)
import { TextItem } from '@/components/learning/hub-player/blocks/TextItem';
import { ScaleItem } from '@/components/learning/hub-player/blocks/ScaleItem';
import { TextInputItem } from '@/components/learning/hub-player/blocks/TextInputItem';
import { TextAreaItem } from '@/components/learning/hub-player/blocks/TextAreaItem';
import { DateItem } from '@/components/learning/hub-player/blocks/DateItem';
import { FlashcardItem } from '@/components/learning/hub-player/blocks/FlashcardItem';

interface Props {
  item: ContentItemWithOptions;
  /** quiz blocks report correctness so a QuizSection can tally the score */
  onAnswered?: (correct: boolean) => void;
  /** completion block restart handler */
  onRestart?: () => void;
}

/**
 * The `content_item type -> component` registry for the learner CoursePlayer.
 * Adding a new item type means adding one case here plus the component. Unknown
 * types fall through to a minimal bordered panel showing the title (graceful
 * degradation) rather than throwing, so an item type the player has not learned
 * about yet never crashes a published course.
 */
export function BlockRenderer({ item, onAnswered, onRestart }: Props) {
  switch (item.type) {
    // Section headers are rendered by the player masthead, not as a block.
    case 'section_header':
      return null;

    // Course-component blocks
    case 'callout':
      return <Callout item={item} />;
    case 'feature_list':
      return <FeatureList item={item} />;
    case 'card_carousel':
      return <CardCarousel item={item} />;
    case 'interactive_tiles':
      return <InteractiveTiles item={item} />;
    case 'accordion':
      return <Accordion item={item} />;
    case 'scenario_deck':
      return <ScenarioDeck item={item} />;
    case 'contact_list':
      return <ContactList item={item} />;
    case 'completion':
      return <Completion item={item} onRestart={onRestart} />;

    // Media + rich text
    case 'video':
      return <VideoBlock item={item} />;
    case 'image':
      return <ImageBlock item={item} />;
    case 'text':
      return <TextItem item={item} />;

    // Quiz questions (graded client-side)
    case 'multiple_choice':
      return <SingleQuestion item={item} onAnswered={onAnswered} />;
    case 'multi_select':
      return <MultiQuestion item={item} onAnswered={onAnswered} />;
    case 'yes_no':
      return <YesNoQuestion item={item} onAnswered={onAnswered} />;
    case 'ordering':
      return <OrderingQuestion item={item} onAnswered={onAnswered} />;

    // Reused form/preview renderers
    case 'flashcard':
      return <FlashcardItem item={item} />;
    case 'scale':
      return <ScaleItem item={item} />;
    case 'text_input':
      return <TextInputItem item={item} />;
    case 'text_area':
      return <TextAreaItem item={item} />;
    case 'date':
      return <DateItem item={item} />;

    default: {
      // Unknown type — render a safe fallback panel rather than throwing, so a
      // newer content_item_type than the player understands degrades gracefully.
      const fallbackTitle = item.title ?? 'Untitled block';
      return (
        <div
          className="rounded-xl border border-black/10 bg-white px-4 py-3"
          title={fallbackTitle}
        >
          <p className="text-sm font-semibold text-mcr-db-500">{fallbackTitle}</p>
          <p className="mt-1 text-xs text-mcr-db-300">
            This content cannot be displayed in this version.
          </p>
        </div>
      );
    }
  }
}
