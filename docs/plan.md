# MCR Pathways Intranet - Remaining Development Plan

This document outlines only the features and work that still need to be completed.

---

## Priority 1: Missing Database Tables

The following tables need to be created (enums already exist):

### Courses & Learning
- [x] `courses` table - Course catalog (id, title, description, category, duration, required, created_at)
- [x] `course_enrollments` table - User progress (user_id, course_id, status, started_at, completed_at)

### Leave Management
- [ ] `leave_requests` table - Leave submissions (user_id, leave_type, start_date, end_date, status, approver_id, notes)
- [ ] `leave_balances` table - Annual allowances per user

### Content
- [ ] `news_posts` table - Intranet news (author_id, title, content, published_at, pinned)
- [ ] `guides` table - Knowledge base articles
- [ ] `policies` table - Company policy documents

### Tracking
- [ ] `sign_in_records` table - Daily location tracking (user_id, date, location, notes)
- [ ] `induction_progress` table - Track induction item completion per user
- [ ] `assets` table - Company asset tracking

---

## Priority 2: Learning Module ✅ COMPLETED

- [x] Create courses table migration
- [x] Course catalog page (`/learning/courses`) with category filtering
- [x] Course detail page with enrollment button
- [x] My courses page showing enrolled/completed courses
- [x] Progress tracking and completion status
- [x] Compliance training due date alerts
- [x] Tool Shed page (`/learning/tool-shed`)

---

## Priority 3: Leave Management

- [ ] Create leave tables migration
- [ ] Leave request form (`/hr/leave/new`)
- [ ] Leave requests list page (`/hr/leave`)
- [ ] Leave calendar view
- [ ] Manager approval workflow
- [ ] Leave balance display
- [ ] Team leave overview for managers
- [ ] Email notifications for approvals/rejections

---

## Priority 4: Sign-In System Backend

Currently frontend-only - needs database persistence:

- [ ] Create sign_in_records table migration
- [ ] API to submit sign-in record
- [ ] Sign-in history page
- [ ] Team sign-in overview for managers
- [ ] Weekly reports

---

## Priority 5: Induction System Backend

Currently hardcoded UI - needs database:

- [ ] Create induction_items table
- [ ] Create induction_progress table
- [ ] Fetch induction items from database
- [ ] Persist completion status per user
- [ ] Auto-update user status when complete

---

## Priority 6: News & Content

- [ ] Create news_posts table migration
- [ ] News post creation form (`/intranet/news/create`)
- [ ] Rich text editor for content
- [ ] Post pinning and publishing controls
- [ ] Guides section (`/intranet/guides`)
- [ ] Policies section (`/intranet/policies`)

---

## Priority 7: HR Module Pages

### Profile
- [ ] `/hr/profile` - View and edit own profile
- [ ] Profile photo upload
- [ ] Update personal details

### Org Chart
- [ ] `/hr/org-chart` - Organization visualization
- [ ] Team hierarchy display
- [ ] Search by name/team

### Team Management
- [ ] `/hr/team` - View team members (for managers)
- [ ] Team directory

### Calendar
- [ ] `/hr/calendar` - Calendar view
- [ ] Google Calendar integration (fields exist in schema)

### Assets
- [ ] `/hr/assets` - View assigned assets
- [ ] Create assets table

---

## Priority 8: Notifications

Database table exists but UI needs work:

- [ ] Fetch real notification count in header (currently hardcoded "3")
- [ ] Notification dropdown/panel UI
- [ ] Mark as read functionality
- [ ] Create notifications when events occur (leave approved, etc.)

---

## Priority 9: Settings

- [ ] `/settings` page
- [ ] Notification preferences
- [ ] Google Calendar connection toggle

---

## Priority 10: Admin Features

- [ ] User management page (view all users, edit roles)
- [ ] Induction item management
- [ ] Compliance reporting
- [ ] Content moderation

---

## Technical Debt

- [x] Remove hardcoded dashboard learning stats (now fetches real compliance course data)
- [ ] Remove hardcoded dashboard stats (5 posts, 3 events)
- [ ] Remove hardcoded notification badge count
- [ ] Remove hardcoded induction checklist items
- [ ] Add loading states to data fetches
- [ ] Add proper error handling
- [ ] Add form validation
