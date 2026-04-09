/**
 * Post-process generated Supabase types to restore union types for CHECK constraint columns.
 *
 * Simpler approach: find each table block, then replace `string` with unions
 * for specific column names within that block.
 *
 * Usage: node scripts/post-process-types.mjs
 * Reads /tmp/generated-types.ts, writes /tmp/processed-types.ts
 */

import { readFileSync, writeFileSync } from "fs";

const input = readFileSync("/tmp/generated-types.ts", "utf-8");
const lines = input.split("\n");
const output = [];

// Column → union type mappings (column name must be unique enough or we track table context)
// Format: { "table_name": { "column_name": "union_type" } }
const UNIONS = {
  profiles: {
    user_type: '"staff" | "new_user"',
    status: '"active" | "inactive" | "pending_induction"',
    contract_type: '"permanent" | "fixed_term" | "casual" | "secondment"',
    region: '"west" | "east" | "north" | "england" | "central" | "national"',
    gender: '"male" | "female" | "non_binary" | "prefer_not_to_say" | "other"',
  },
  resource_articles: {
    content_type: '"google_doc" | "component" | "native"',
    status: '"draft" | "published"',
    visibility: '"all" | "internal"',
  },
  resource_categories: {
    visibility: '"all" | "internal"',
  },
  working_locations: {
    location: '"home" | "glasgow_office" | "stevenage_office" | "other" | "on_leave"',
    time_slot: '"full_day" | "morning" | "afternoon"',
    source: '"manual" | "calendar" | "pattern" | "leave"',
  },
  weekly_patterns: {
    location: '"home" | "glasgow_office" | "stevenage_office" | "other"',
    time_slot: '"full_day" | "morning" | "afternoon"',
  },
  courses: {
    category: '"compliance" | "upskilling" | "soft_skills"',
    status: '"draft" | "published"',
  },
  course_enrolments: {
    status: '"enrolled" | "in_progress" | "completed" | "dropped"',
  },
  course_lessons: {
    lesson_type: '"video" | "text" | "slides" | "rich_text"',
  },
  course_assignments: {
    assign_type: '"team" | "user_type" | "is_external" | "user"',
  },
  course_feedback: {
    duration_feedback: '"too_short" | "about_right" | "too_long"',
  },
  quiz_questions: {
    question_type: '"single" | "multi"',
  },
  section_quiz_questions: {
    question_type: '"single" | "multi"',
  },
  posts: {
    status: '"draft" | "published"',
  },
  post_attachments: {
    attachment_type: '"image" | "document" | "link"',
  },
  post_reactions: {
    reaction_type: '"like" | "love" | "celebrate" | "insightful" | "curious"',
  },
  comment_reactions: {
    reaction_type: '"like" | "love" | "celebrate" | "insightful" | "curious"',
  },
  leave_requests: {
    leave_type: '"annual" | "sick" | "compassionate" | "parental" | "unpaid" | "toil" | "other"',
    status: '"pending" | "approved" | "rejected" | "cancelled"',
  },
  absence_records: {
    status: '"active" | "completed" | "cancelled"',
  },
  return_to_work_forms: {
    status: '"draft" | "submitted" | "confirmed" | "locked"',
  },
  compliance_documents: {
    status: '"valid" | "expiring_soon" | "expired" | "missing"',
  },
  staff_leaving_forms: {
    status: '"draft" | "submitted" | "in_progress" | "completed" | "cancelled"',
  },
  flexible_working_requests: {
    request_type: '"change_hours" | "change_pattern" | "change_location" | "job_share" | "compressed_hours" | "other"',
    status: '"draft" | "submitted" | "under_review" | "consultation" | "trial_period" | "approved" | "rejected" | "withdrawn" | "appealed" | "appeal_upheld" | "appeal_overturned"',
    consultation_format: '"in_person" | "video" | "phone"',
  },
  fwr_appeals: {
    outcome: '"upheld" | "overturned"',
  },
  onboarding_template_items: {
    section: '"before_start" | "day_one" | "first_week" | "first_month" | "general"',
    assignee_role: '"hr_admin" | "line_manager" | "employee" | "other"',
  },
  onboarding_checklist_items: {
    section: '"before_start" | "day_one" | "first_week" | "first_month" | "general"',
    assignee_role: '"hr_admin" | "line_manager" | "employee" | "other"',
  },
  objectives: {
    category: '"personal" | "team" | "organisational"',
  },
  key_dates: {
    event_type: '"birthday" | "work_anniversary" | "probation_end" | "contract_end" | "custom"',
  },
  audit_log: {
    action: '"INSERT" | "UPDATE" | "DELETE"',
  },
  tool_shed_entries: {
    format: '"postcard" | "three_two_one" | "takeover"',
  },
  email_notifications: {
    status: '"pending" | "processing" | "sent" | "failed"',
  },
  surveys: {
    status: '"draft" | "active" | "closed"',
  },
  survey_questions: {
    question_type: '"rating" | "text" | "single_choice" | "multi_choice"',
  },
  departments: {
    region: '"scotland" | "england" | "all"',
  },
};

// Track which table we're inside
let currentTable = null;
let replacements = 0;

for (const line of lines) {
  // Detect table entry: 6 spaces + table_name + `: {`
  const tableMatch = line.match(/^      (\w+): \{$/);
  if (tableMatch && UNIONS[tableMatch[1]]) {
    currentTable = tableMatch[1];
  }

  // Detect end of table block (back to 6-space indent level)
  if (currentTable && /^      \}$/.test(line)) {
    currentTable = null;
  }

  if (currentTable && UNIONS[currentTable]) {
    let modified = line;
    for (const [col, union] of Object.entries(UNIONS[currentTable])) {
      // Match: `          column: string` or `          column?: string` or with `| null`
      const pattern = new RegExp(`^(\\s+${col})(\\??): string(\\s*\\| null)?$`);
      const match = modified.match(pattern);
      if (match) {
        const nullable = match[3] ? " | null" : "";
        modified = `${match[1]}${match[2]}: ${union}${nullable}`;
        replacements++;
      }
    }
    output.push(modified);
  } else {
    output.push(line);
  }
}

writeFileSync("/tmp/processed-types.ts", output.join("\n"));
console.log(`Done. ${replacements} replacements made.`);
