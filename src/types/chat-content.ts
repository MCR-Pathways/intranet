/**
 * Content type definitions ported from the Chat project
 * (mcr-resources/src/types/content.ts) for the intranet's read of Chat content.
 *
 * The in-memory types below are kept name-identical to the source so that
 * components ported from the Chat project compile unchanged. The ChatDatabase
 * type is a minimal, self-contained Supabase generated-style shape so the
 * intranet does not depend on the Chat project's own database.types.
 */

// ---------------------------------------------------------------------------
// In-memory types (ported verbatim from mcr-resources/src/types/content.ts)
// ---------------------------------------------------------------------------

export type ContentCollectionType = 'course';
export type ContentCollectionStatus = 'draft' | 'published' | 'archived';
export type ContentAudience = 'mentor' | 'young_person' | 'staff' | 'all';

/**
 * Every content item type, as a runtime tuple so callers can iterate the full
 * set (e.g. exhaustiveness guards in blockGroups.ts). `ContentItemType` is
 * derived from it, so adding a member here is the single edit that surfaces it
 * to `tsc`-enforced consumers.
 */
export const ALL_CONTENT_ITEM_TYPES = [
  'video',
  'image',
  'text',
  'multiple_choice',
  'multi_select',
  'scale',
  'text_input',
  'text_area',
  'yes_no',
  'date',
  'section_header',
  'flashcard',
  // course-component types (2026-06 safeguarding platform):
  'card_carousel',
  'interactive_tiles',
  'accordion',
  'scenario_deck',
  'feature_list',
  'callout',
  'contact_list',
  'ordering',
  'completion',
] as const;

export type ContentItemType = (typeof ALL_CONTENT_ITEM_TYPES)[number];

/** Brand colour name used by course components (maps via courseAccent). */
export type CourseAccent =
  | 'dark-blue'
  | 'teal'
  | 'light-blue'
  | 'orange'
  | 'pink'
  | 'wine'
  | 'green'
  | 'yellow';

export interface ContentItemOption {
  id: string;
  item_id: string;
  label: string;
  value: string;
  image_url: string | null;
  sort_order: number;
}

export interface TextItemSettings {
  // Stable studio-media storage paths; signed to URLs at read time (never store
  // expiring URLs in published content). See useSignedMediaUrls.
  audioPath?: string;
  images?: Array<{ alt: string; storagePath: string }>;
  sources?: Array<{ id: string; title: string }>;
}

export interface QuizItemSettings {
  explanation?: string;
}

export interface FlashcardItemSettings {
  cards?: Array<{ front: string; back: string; hint?: string }>;
}

export interface ImageItemSettings {
  /** public course-media URL (upload only in v1) */
  url?: string;
  /** accessibility text for screen readers */
  alt?: string;
  /** optional visible caption, edited inline on the canvas */
  caption?: string;
}

export interface VideoItemSettings {
  url?: string;
  provider?: 'youtube' | 'vimeo' | 'other';
  /** drafted transcript shown via an accessible toggle */
  transcript?: string;
  /** poster image path/url; absent in v1 → placeholder */
  poster?: string;
  label?: string;
}

export interface SectionHeaderSettings {
  kicker?: string;
  lede?: string;
  accent?: CourseAccent;
  layout?: 'content' | 'quiz' | 'completion';
}

export interface CalloutSettings {
  /** brand colour name or semantic tone */
  tone?: CourseAccent | 'info' | 'warning' | 'muted';
  icon?: string; // lucide-react icon name
  title?: string;
}

export interface FeatureListItem {
  icon?: string;
  text: string;
}
export interface FeatureListSettings {
  variant?: 'plain' | 'do' | 'dont' | 'check';
  items: FeatureListItem[];
}

export interface CarouselCard {
  term: string;
  icon?: string;
  color?: CourseAccent;
  body: string;
}
export interface CardCarouselSettings {
  cards: CarouselCard[];
}

export interface InteractiveTile {
  label: string; // e.g. "Recognise"
  badge?: string; // e.g. "1"
  icon?: string;
  color?: CourseAccent;
  short?: string;
  body: string;
}
export interface InteractiveTilesSettings {
  tiles: InteractiveTile[];
}

export interface AccordionEntry {
  title: string;
  icon?: string;
  color?: CourseAccent;
  body: string;
  signs?: string[];
}
export interface AccordionSettings {
  items: AccordionEntry[];
}

export interface ScenarioResponse {
  verdict: string;
  explain: string;
}
export interface ScenarioEntry {
  name: string;
  tag?: string;
  scenario: string;
  prompt: string;
  correct: 'yes' | 'no';
  responses: { yes: ScenarioResponse; no: ScenarioResponse };
}
export interface ScenarioDeckSettings {
  accent?: CourseAccent;
  scenarios: ScenarioEntry[];
}

export interface Contact {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
}
export interface ContactListSettings {
  contacts: Contact[];
}

/** Correct order is the array order; the renderer shuffles for display. */
export interface OrderingSettings {
  items: string[];
}

export interface CompletionRecapItem {
  badge?: string;
  label: string;
  color?: CourseAccent;
}
export interface CompletionSettings {
  recap: CompletionRecapItem[];
}

export interface ScaleItemSettings {
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
}

export interface ContentItem {
  id: string;
  collection_id: string;
  parent_id: string | null;
  type: ContentItemType;
  title: string | null;
  content: string | null;
  is_required: boolean;
  correct_answer: unknown;
  settings: Record<string, unknown>;
  sort_order: number;
}

export interface ContentItemWithOptions extends ContentItem {
  options: ContentItemOption[];
}

export interface ContentCollection {
  id: string;
  type: ContentCollectionType;
  title: string;
  description: string | null;
  target_audience: ContentAudience;
  status: ContentCollectionStatus;
  /** anon (public) read opt-in; present in the DB, optional here for legacy fixtures */
  is_public?: boolean;
  settings: Record<string, unknown>;
  updated_at: string;
  published_at: string | null;
  source_conversation_id: string | null;
}

export interface LoadedContent {
  collection: ContentCollection;
  items: ContentItemWithOptions[];
}

// ---------------------------------------------------------------------------
// Minimal Supabase generated-style DB type for the Chat project's tables.
// Self-contained: does NOT import the intranet's own database.types.
// ---------------------------------------------------------------------------

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ChatDatabase = {
  public: {
    Tables: {
      content_collections: {
        Row: {
          id: string;
          type: string;
          title: string;
          description: string | null;
          target_audience: string;
          status: string;
          is_public: boolean;
          settings: Json;
          estimated_duration_minutes: number | null;
          published_at: string | null;
          updated_at: string;
          destinations: string[] | null;
          source_conversation_id: string | null;
        };
        Insert: {
          id?: string;
          type: string;
          title: string;
          description?: string | null;
          target_audience: string;
          status?: string;
          is_public?: boolean;
          settings?: Json;
          estimated_duration_minutes?: number | null;
          published_at?: string | null;
          updated_at?: string;
          destinations?: string[] | null;
          source_conversation_id?: string | null;
        };
        Update: {
          id?: string;
          type?: string;
          title?: string;
          description?: string | null;
          target_audience?: string;
          status?: string;
          is_public?: boolean;
          settings?: Json;
          estimated_duration_minutes?: number | null;
          published_at?: string | null;
          updated_at?: string;
          destinations?: string[] | null;
          source_conversation_id?: string | null;
        };
        Relationships: [];
      };
      content_items: {
        Row: {
          id: string;
          collection_id: string;
          parent_id: string | null;
          type: string;
          title: string | null;
          content: string | null;
          is_required: boolean;
          correct_answer: Json;
          settings: Json;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          collection_id: string;
          parent_id?: string | null;
          type: string;
          title?: string | null;
          content?: string | null;
          is_required?: boolean;
          correct_answer?: Json;
          settings?: Json;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          collection_id?: string;
          parent_id?: string | null;
          type?: string;
          title?: string | null;
          content?: string | null;
          is_required?: boolean;
          correct_answer?: Json;
          settings?: Json;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "content_items_collection_id_fkey";
            columns: ["collection_id"];
            isOneToOne: false;
            referencedRelation: "content_collections";
            referencedColumns: ["id"];
          },
        ];
      };
      content_item_options: {
        Row: {
          id: string;
          item_id: string;
          label: string;
          value: string;
          image_url: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          label: string;
          value: string;
          image_url?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          item_id?: string;
          label?: string;
          value?: string;
          image_url?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "content_item_options_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "content_items";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
