import type { ContentItemWithOptions, ContactListSettings, Contact } from '@/types/chat-content';
import { accent } from '@/lib/course/courseAccent';
import { CourseIcon } from '@/components/learning/hub-player/CourseIcon';

/**
 * A single mail/phone action. When the target value is present it renders a
 * live `mailto:`/`tel:` anchor; when absent it stays in the layout as an inert,
 * non-actionable control (no href, `aria-disabled`) so the row keeps its shape.
 */
function ContactAction({
  icon,
  href,
  label,
  active,
}: {
  icon: string;
  href: string | null;
  label: string;
  active: boolean;
}) {
  const a = accent('light-blue');
  return (
    <a
      href={active && href ? href : undefined}
      aria-label={label}
      aria-disabled={active ? undefined : 'true'}
      className={`flex min-h-[44px] min-w-[44px] flex-none items-center justify-center rounded-full ${
        active
          ? `${a.tintBg} ${a.deepText} hover:bg-mcr-lb-100`
          : 'bg-mcr-db-50 text-mcr-db-200 cursor-default'
      }`}
    >
      <CourseIcon name={icon} size={18} />
    </a>
  );
}

/**
 * A list of safeguarding-contact cards. Each card shows a name, an optional
 * role, and mail/phone actions. Ports the `LeadsBlock` lead list from the
 * Safeguarding prototype (course-sections.jsx).
 */
export function ContactList({ item }: { item: ContentItemWithOptions }) {
  const s = (item.settings ?? {}) as unknown as ContactListSettings;
  const contacts: Contact[] = Array.isArray(s.contacts) ? s.contacts : [];

  return (
    <div className="rounded-xl border border-black/5 bg-white p-[18px] shadow-sm">
      {item.title && (
        <span className="mb-3 block text-[0.72em] font-semibold uppercase tracking-[0.08em] text-mcr-db-300">
          {item.title}
        </span>
      )}
      <ul className="flex flex-col">
        {contacts.map((c, i) => (
          // Contacts have no stable id (Contact is { name, role?, email?, phone? }),
          // so we key by index.
          <li
            key={i}
            className="flex items-center gap-3 border-b border-black/[0.06] py-2.5 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <strong className="block text-[0.94em] font-semibold tracking-[-0.01em] text-mcr-darkblue">
                {c.name}
              </strong>
              {c.role && (
                <span className="block text-[0.82em] leading-snug text-mcr-db-300">{c.role}</span>
              )}
            </div>
            <div className="flex flex-none items-center gap-1.5">
              <ContactAction
                icon="mail"
                href={c.email ? `mailto:${c.email}` : null}
                label={`Email ${c.name}`}
                active={Boolean(c.email)}
              />
              <ContactAction
                icon="phone"
                href={c.phone ? `tel:${c.phone}` : null}
                label={`Call ${c.name}`}
                active={Boolean(c.phone)}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
