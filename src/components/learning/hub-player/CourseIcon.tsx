import {
  Shield,
  User,
  Handshake,
  Briefcase,
  Heart,
  Eye,
  MessageSquare,
  Pencil,
  Send,
  Home,
  AlertTriangle,
  Globe,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  ArrowRight,
  RefreshCw,
  Mail,
  Phone,
  Lock,
  GripVertical,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';

/**
 * Maps the prototype's inline icon names (and their lucide equivalents) to
 * lucide-react components. The seed content uses the prototype names
 * (shield, eye, messages, alert, chevR, …); both spellings resolve.
 */
const ICONS: Record<string, LucideIcon> = {
  shield: Shield,
  user: User,
  handshake: Handshake,
  briefcase: Briefcase,
  heart: Heart,
  eye: Eye,
  messages: MessageSquare,
  'message-square': MessageSquare,
  pencil: Pencil,
  send: Send,
  home: Home,
  alert: AlertTriangle,
  'alert-triangle': AlertTriangle,
  globe: Globe,
  check: Check,
  x: X,
  chevL: ChevronLeft,
  'chevron-left': ChevronLeft,
  chevR: ChevronRight,
  'chevron-right': ChevronRight,
  play: Play,
  arrowR: ArrowRight,
  'arrow-right': ArrowRight,
  refresh: RefreshCw,
  'refresh-cw': RefreshCw,
  mail: Mail,
  phone: Phone,
  lock: Lock,
  grip: GripVertical,
  book: BookOpen,
  'book-open': BookOpen,
};

interface Props {
  name?: string;
  className?: string;
  size?: number;
}

/** Renders a lucide icon by prototype/lucide name, falling back to a shield. */
export function CourseIcon({ name, className, size = 22 }: Props) {
  const Cmp = (name && Object.hasOwn(ICONS, name) ? ICONS[name] : undefined) || Shield;
  return <Cmp className={className} size={size} aria-hidden="true" />;
}
