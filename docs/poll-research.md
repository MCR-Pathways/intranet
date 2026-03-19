# Poll Feature Research — Platform Comparison

> Research date: 16 March 2026
> Purpose: Inform poll feature design for the intranet

---

## 1. Platform-by-Platform Analysis

### 1.1 Slack (via Polly)

Slack has no native poll feature. The dominant third-party app is **Polly** (also: Simple Poll, Geekbot).

**Poll creation:**
- Free-text question + multiple answer options
- Write-in capability (voters can add their own options)
- Multi-vote toggle (select multiple options)
- Scheduled polls (future date/time) and recurring polls (daily/weekly/monthly)

**Duration/expiry:**
- No preset durations — polls stay open until manually closed or a scheduled close time
- Recurring polls auto-close before the next recurrence

**Results visualisation:**
- Bar charts in the Slack message (inline, real-time updates)
- Web dashboard with trend lines for recurring polls
- Percentages and vote counts displayed

**Results visibility options:**
- Real-time (default — audience sees results as votes come in)
- After close (results hidden until poll closes)
- Hidden (only visible to creator via dashboard or `/polly results`)

**Anonymity:**
- Non-anonymous (default — usernames visible to all)
- Anonymous (no one, including creator, can see who voted)
- Confidential (only creator can see who voted)

**Export:**
- CSV (paid plans only, desktop only)
- Google Sheets direct integration
- Data included: timestamps, polly ID, user ID, usernames (if non-anonymous), votes, comments
- Anonymous exports omit all identifying info
- Bulk export by date range or entire history
- All export timestamps in UTC

**Notable:** Demographics segmentation lets you slice results by user attributes (department, role, etc.) on Business/Enterprise tiers.

---

### 1.2 Microsoft Teams (via Forms/Polls app)

Teams has a **native Polls app** powered by Microsoft Forms.

**Poll creation:**
- Question + up to 10 answer options (mobile)
- Multiple selections toggle
- Available in chats, channels, and meetings

**Duration/expiry:**
- Due date can be set (mobile)
- No preset duration options documented — polls stay open until closed or due date

**Results visualisation:**
- Real-time response updates on the poll card in Teams
- Summary view with response counts and participation statistics
- Individual response drill-down
- Charts (bar, pie) available in the Forms web interface

**Anonymity:**
- "Record names of respondents" toggle — when disabled, responses are anonymous
- When enabled, individual names and emails are visible

**Export:**
- Excel (.xlsx) via "Open results in Excel"
- Print results summary
- Share results link
- Data columns: respondent ID, start time, completion time, name, email, answer selections
- Each poll exports as a separate Excel file (no bulk export across polls)
- Anonymous polls omit name/email columns

**Notable:** Deep integration with Microsoft 365 ecosystem — results flow into Forms for advanced analysis.

---

### 1.3 Workplace by Meta (shutting down June 2026)

**Poll creation:**
- Created within any group post
- Multiple answer options with optional images
- Option shuffling (randomise order to reduce bias)

**Duration/expiry:**
- Configurable end time to auto-close the poll
- No preset durations — custom date/time picker

**Results visualisation:**
- Inline results in the post (percentages, vote counts)
- Who voted on each option visible (unless hidden)

**Anonymity:**
- Option to hide who voted on each option until voting ends
- Creator always sees aggregate results

**Export:**
- Excel spreadsheet export (desktop only)
- Advanced features (end times, images, export, shuffling) are desktop-only
- Graph API for programmatic data extraction

**Notable:** Platform enters read-only mode September 2025, full shutdown June 2026. No longer a viable reference for new implementations, but the option-shuffling and image-on-options features are worth noting.

---

### 1.4 Yammer / Viva Engage

**Poll creation:**
- Simple question + multiple answer options
- Target specific users, groups, or everyone
- Polls can be scheduled (rolling out Feb-Mar 2025 for premium licences)
- Polls cannot be edited after publication

**Duration/expiry:**
- No explicit duration/expiry settings documented
- Polls remain open until the post is deleted or community is archived

**Results visualisation:**
- Vote counts per option displayed inline
- No charts or graphs — numeric counts only
- Percentages not explicitly shown (users must calculate)

**Anonymity:**
- **Always anonymous** — neither creator nor voters can see who voted
- This is a hard limitation, not a toggle
- For named voting, Microsoft recommends using Microsoft Forms instead

**Export:**
- Network Data Export API includes poll questions and options but **not vote counts**
- No native per-poll export feature
- General tenant data export available for admins

**Notable:** The forced anonymity and lack of export make Viva Engage polls unsuitable for formal decision-making. They are positioned as lightweight engagement tools only.

---

### 1.5 LinkedIn

**Poll creation:**
- Question + up to 5 answer options (expanded from 4 in 2025)
- Single-choice only (no multi-select)
- Created as a post type in the feed

**Duration options (preset only):**
- 1 day
- 3 days
- 1 week (default)
- 2 weeks

**Results visualisation:**
- Percentages per option displayed as horizontal bar chart
- Total vote count shown
- Winning option highlighted in bold
- Results visible in real-time after voting

**Anonymity:**
- Poll author can see **who voted and how they voted**
- Page admins on company pages also have this access
- Other viewers see only aggregate percentages after the poll closes
- No anonymous option for the creator's view

**Export:**
- **No native export** — no CSV, Excel, or PDF download
- Third-party tools (e.g. TexAu) can scrape voter profiles
- API provides poll data programmatically (option labels, vote counts, status, end datetime)

**Notable:** LinkedIn prohibits polls asking for political opinions, health status, or sensitive data. The 4 preset durations with no custom option is a deliberate simplicity choice.

---

### 1.6 Twitter/X

**Poll creation:**
- Question (part of the tweet text, 280-char limit)
- 2-4 answer options, each up to 25 characters
- Single-choice only

**Duration options (custom within range):**
- Minimum: 5 minutes
- Maximum: 7 days
- Default: 1 day
- Custom: days + hours + minutes picker

**Results visualisation:**
- Percentage bars per option (horizontal, inline in tweet)
- Total vote count displayed
- Winning option in bold
- Time remaining shown during voting
- Push notification to voters when poll ends with final results

**Anonymity:**
- **Fully anonymous** — neither the creator nor anyone else can see who voted or how
- No named voting option

**Export:**
- **No native export**
- API provides poll object: options (position, label, votes), voting_status, end_datetime
- Third-party scrapers/extensions can extract to CSV/Excel/JSON
- No official way to get individual voter data (consistent with anonymity)

**Notable:** The 5-minute minimum and granular duration picker (days/hours/minutes) is unique among social platforms. Character limit on options forces concise answers.

---

### 1.7 Google Forms

Google Forms is a full survey tool, not a lightweight poll, but commonly used for polls.

**Poll creation:**
- Unlimited questions, multiple question types
- Multiple choice, checkboxes (multi-select), dropdown, linear scale, grid
- Sections, branching logic, required fields
- Image/video attachments on questions

**Duration/expiry:**
- No built-in expiry — manually toggle "accepting responses" on/off
- Third-party add-ons can schedule open/close times

**Results visualisation:**
- Auto-generated summary charts (pie charts for multiple choice, bar charts for checkboxes)
- Response counts and percentages per option
- Individual response view
- Google Sheets for custom charts (bar, pie, line, etc.)

**Anonymity:**
- Anonymous by default (no login required)
- Can require Google sign-in and collect email addresses
- "Collect email addresses" and "Limit to 1 response" (requires sign-in) are separate toggles

**Export:**
- CSV download (from Responses tab)
- Google Sheets (auto-linked, real-time sync)
- Excel (via Sheets > File > Download as .xlsx)
- No native PDF export of results
- Data columns: timestamp, email (if collected), all question responses, scores (if quiz mode)
- Multi-select responses are semicolon-delimited in CSV

**Notable:** The most flexible survey tool in this list but lacks poll-specific features (no duration presets, no real-time inline results in a feed). The auto-generated summary with appropriate chart types per question type is excellent.

---

### 1.8 Typeform

**Poll creation:**
- Visual, conversational one-question-at-a-time format
- Multiple choice, picture choice, ranking, opinion scale, rating, yes/no
- Logic jumps (branching), calculator, hidden fields
- Design customisation (fonts, colours, backgrounds)

**Duration/expiry:**
- No built-in duration or expiry
- Manually close by toggling the form off

**Results visualisation:**
- Results Summary page with auto-generated charts
- Per-question breakdown with percentages and counts
- Individual response timeline view

**Anonymity:**
- Anonymous by default (no login required)
- Hidden Fields can pass identity via URL parameters
- Network ID (hashed IP) included in exports for de-duplication

**Export:**
- CSV and XLSX formats
- Results Summary exportable as CSV (aggregate data)
- Individual responses exportable as CSV/XLSX
- File uploads downloadable as ZIP
- Data columns: start date, submit date, Network ID, all responses, hidden fields, variables, scores, ending screen shown
- All timestamps in UTC
- Selective export (choose specific responses)

**Notable:** The "Network ID" (hashed IP) is a privacy-respecting approach to preventing duplicate submissions without collecting email. The Results Summary CSV (aggregate) vs Responses export (individual) distinction is well-designed.

---

### 1.9 Mentimeter

**Poll creation:**
- Live/interactive presentation format — polls embedded in slides
- Multiple choice (single or multi-select), word cloud, open-ended, ranking, scales, Q&A, quiz
- Real-time audience participation via join code

**Duration/expiry:**
- Polls are open while the presentation is active
- Creator controls when to close each slide/question
- "Ask questions again" creates a new session for the same poll
- No time-based auto-expiry

**Results visualisation:**
- Real-time animated bar charts, word clouds, scales
- Results update live as audience votes
- Multiple display modes per question type

**Anonymity:**
- **Always anonymous** by default — voters identified only by assigned numbers
- No login or email collection
- Workspace admins can enforce "Limited spreadsheet exports" to further protect anonymity (removes timestamps, disables export if <10 participants)

**Export (paid plans only):**
- XLSX only (no CSV or PDF of raw data)
- PDF export of presentation slides (including result screenshots)
- Screenshot export of individual slides
- Three sheets in XLSX:
  1. Individual responses (voter number + answers per question)
  2. Results summary (vote counts per option per question)
  3. Session-specific results (same as sheet 2, split by session)
- Timestamps included by default (removable via admin settings)
- No voter names — only assigned numeric IDs

**Notable:** The 3-sheet XLSX structure (individual, summary, per-session) is the most thoughtful export format in this comparison. The admin-level anonymity controls (min 10 participants, timestamp removal) are excellent for GDPR compliance.

---

### 1.10 StrawPoll

**Poll creation:**
- Question + multiple answer options with optional images
- Three preset types: Anonymous Poll, Group Poll, Meeting Poll
- Customisable duplicate-vote prevention (IP, cookie, VPN blocking, reCAPTCHA)
- Comments section (toggleable)
- Public or private (private excluded from discovery)

**Duration/expiry:**
- Custom deadline (specific date picker)
- No preset durations — open until deadline or manually closed

**Results visualisation:**
- Pie chart and bar chart views (toggleable)
- Vote counts and percentages per option
- Real-time updates via server push
- Vote analytics: when and where voters participated (geographic/temporal)

**Anonymity by poll type:**
- Anonymous Poll: strict IP checking, no names collected, VPN blocked
- Group Poll: names required, lenient duplicate checking (browser session), VPN allowed
- Meeting Poll: names required, no duplicate prevention, date/time options

**Export:**
- Excel and CSV formats
- Vote analytics data included
- Available at any time during or after poll

**Notable:** The three poll types (Anonymous, Group, Meeting) with different default configurations for duplicate prevention and identity collection is a clean UX pattern. The meeting poll type (date/time voting) is a useful addition beyond opinion polls.

---

## 2. Comparison Summary

### 2.1 Duration/Expiry Options

| Platform | Preset Durations | Custom Duration | Auto-Close |
|---|---|---|---|
| Slack/Polly | None | Schedule close time | Yes |
| MS Teams | None | Due date (mobile) | Yes |
| Workplace | None | Custom end time | Yes |
| Viva Engage | None | None | No |
| LinkedIn | 1d, 3d, 1w, 2w | No | Yes |
| Twitter/X | Default 1d | 5min-7d (d/h/m picker) | Yes |
| Google Forms | None | None (manual toggle) | No |
| Typeform | None | None (manual toggle) | No |
| Mentimeter | None | Presenter-controlled | No |
| StrawPoll | None | Custom deadline date | Yes |

**Pattern:** Social platforms favour presets (LinkedIn) or bounded custom ranges (Twitter/X). Enterprise tools favour open-ended with optional close dates. Survey tools have no expiry at all.

### 2.2 Results Visualisation

| Platform | Bar Chart | Pie Chart | Percentages | Vote Count | Real-Time |
|---|---|---|---|---|---|
| Slack/Polly | Yes | No | Yes | Yes | Yes |
| MS Teams | Yes | Yes (Forms) | Yes | Yes | Yes |
| Workplace | No (inline text) | No | Yes | Yes | Yes |
| Viva Engage | No | No | No | Yes | Yes |
| LinkedIn | Yes (horizontal) | No | Yes | Yes | Yes |
| Twitter/X | Yes (horizontal) | No | Yes | Yes | Yes |
| Google Forms | Yes | Yes (auto) | Yes | Yes | Yes |
| Typeform | Yes | No | Yes | Yes | Yes |
| Mentimeter | Yes (animated) | No | Yes | Yes | Yes (live) |
| StrawPoll | Yes | Yes (toggle) | Yes | Yes | Yes |

**Pattern:** Horizontal bar charts with percentages are universal. Pie charts are less common and typically offered alongside bars. Real-time updates are standard everywhere.

### 2.3 Export Capabilities

| Platform | CSV | Excel | PDF | Google Sheets | Image |
|---|---|---|---|---|---|
| Slack/Polly | Yes (paid) | No | No | Yes (paid) | No |
| MS Teams | No | Yes | No | No | No |
| Workplace | No | Yes | No | No | No |
| Viva Engage | No | No | No | No | No |
| LinkedIn | No | No | No | No | No |
| Twitter/X | No | No | No | No | No |
| Google Forms | Yes | Yes (via Sheets) | No | Yes | No |
| Typeform | Yes | Yes (XLSX) | No | No | No |
| Mentimeter | No | Yes (XLSX) | Yes (slides) | No | Yes (screenshots) |
| StrawPoll | Yes | Yes | No | No | No |

**Pattern:** Enterprise/survey tools offer export; social platforms do not. CSV and Excel are the standard formats. PDF export is rare. No platform offers a "share as image" export of results (except Mentimeter's slide screenshots).

### 2.4 Export Data Contents

| Platform | Timestamps | Voter Names | Voter Email | Vote Choices | Percentages | Comments |
|---|---|---|---|---|---|---|
| Slack/Polly | Yes (UTC) | If non-anon | Via user ID | Yes | No (raw only) | Yes |
| MS Teams | Yes (start+end) | If recorded | If recorded | Yes | No (raw only) | N/A |
| Google Forms | Yes | N/A | If collected | Yes | No (raw only) | N/A |
| Typeform | Yes (UTC) | N/A | Via Network ID | Yes | Summary CSV has % | N/A |
| Mentimeter | Optional | Numbers only | No | Yes | Sheet 2 has counts | N/A |
| StrawPoll | Yes (analytics) | If group poll | No | Yes | Yes | Yes |

**Pattern:** Exports universally contain raw individual responses (one row per voter). Aggregate summaries (percentages, totals) are a separate export or must be calculated from raw data. Timestamps are standard. Identity depends on anonymity settings.

### 2.5 Anonymity Models

| Platform | Anonymous | Named | Confidential | Default |
|---|---|---|---|---|
| Slack/Polly | Yes | Yes | Yes (creator only) | Named |
| MS Teams | Yes | Yes | No | Named |
| Workplace | Partial (hide until close) | Yes | No | Named |
| Viva Engage | Yes (forced) | No | No | Anonymous |
| LinkedIn | No | Yes (creator sees) | No | Named (to creator) |
| Twitter/X | Yes (forced) | No | No | Anonymous |
| Google Forms | Yes | Yes (via email) | No | Anonymous |
| Typeform | Yes | Via hidden fields | No | Anonymous |
| Mentimeter | Yes (forced) | No | No | Anonymous |
| StrawPoll | Yes | Yes (group polls) | No | Depends on type |

**Pattern:** Three anonymity models emerge: (1) fully anonymous (Twitter, Mentimeter, Viva Engage — no option to change), (2) configurable (Polly, Teams, Google Forms — creator chooses), (3) creator-visible only (LinkedIn — author sees, public does not). The "confidential" model (only creator sees names) from Polly is the most sophisticated.

---

## 3. Best Practices for Poll Result Export

### 3.1 What Data to Include

Based on patterns across all platforms:

**Always include:**
- Question text and all answer options
- Vote count per option
- Percentage per option
- Total number of voters
- Poll creation date and close date
- Poll status (open/closed)

**Include when available/appropriate:**
- Individual responses (one row per voter)
- Timestamps per response
- Voter identity (name/email) — only for non-anonymous polls
- Comments/free-text responses

**Include for admin/analytics:**
- Response rate (voters / eligible audience)
- Time-series data (when votes came in)

**Two-tier export pattern (from Typeform/Mentimeter):**
1. **Summary export** — aggregate data (question, options, counts, percentages)
2. **Raw data export** — individual responses (one row per voter, with timestamp and identity if non-anonymous)

### 3.2 Export Format Recommendations

- **CSV** — universal compatibility, lightweight, works with any spreadsheet tool
- **XLSX** — multi-sheet capability (summary + raw data + metadata), better formatting
- **PDF** — for sharing results with non-technical stakeholders (charts + summary)
- **Image/PNG** — for embedding results in other content (presentations, posts)

Recommended minimum: **CSV + PDF**. The CSV covers data analysis needs; the PDF covers visual sharing needs.

---

## 4. GDPR/Privacy Considerations for Named Polls

### 4.1 Lawful Basis

- **Legitimate interest** is the most common basis for workplace polls (employee engagement, decision-making)
- **Consent** is required when collecting sensitive data (health, political opinions, ethnicity)
- **Contractual** basis may apply when poll participation is part of employment duties

### 4.2 Requirements for Named Polls

1. **Transparency** — clearly state before voting: who will see responses, how data will be used, how long it will be retained
2. **Data minimisation** — collect only what is necessary; if you do not need to know who voted, make the poll anonymous
3. **Purpose limitation** — poll data collected for engagement purposes must not be repurposed for performance evaluation without fresh consent
4. **Retention limits** — define and enforce retention periods; do not store poll data indefinitely
5. **Right to erasure** — respondents can request deletion of their individual responses
6. **Right of access** — respondents can request a copy of their individual responses

### 4.3 Implementation Recommendations

- **Default to anonymous** — require explicit action to enable named voting
- **Show privacy notice before voting** — "Your name will/will not be visible to [the poll creator / all viewers / no one]"
- **Auto-delete individual response data** after a defined retention period (e.g. 12 months), keeping only aggregate results
- **Separate aggregate from individual data** in storage — aggregates can be retained indefinitely, individual responses cannot
- **Audit log** for who accessed named poll results (accountability for confidential polls)

### 4.4 The Polly "Confidential" Model

Polly's three-tier model (Anonymous / Confidential / Named) is the gold standard:
- **Anonymous**: No one, including the creator, can see who voted. Export omits identity.
- **Confidential**: Only the creator can see who voted. Not visible in Slack. Export includes identity only for the creator.
- **Named**: Everyone can see who voted and how.

This maps well to workplace needs: anonymous for sensitive topics, confidential for manager feedback, named for team decisions.

---

## 5. Accessibility Best Practices for Poll Results

### 5.1 WCAG Requirements

- **1.1.1 Non-text Content (Level A)** — all charts must have text alternatives (alt text or adjacent data table)
- **1.3.1 Info and Relationships (Level A)** — use semantic HTML for results tables
- **1.4.1 Use of Colour (Level A)** — do not use colour alone to distinguish options; add labels, patterns, or textures
- **1.4.3 Contrast (Level AA)** — 4.5:1 minimum contrast for text on chart backgrounds
- **2.1.1 Keyboard (Level A)** — interactive results (tooltips, toggles) must be keyboard-accessible

### 5.2 Implementation Recommendations

- **Always show a data table alongside any chart** — screen readers cannot parse SVG/canvas bar charts
- **Use `aria-label` or `aria-describedby`** on chart containers with a text summary: "Option A leads with 45%, Option B has 30%, Option C has 25%"
- **Announce results updates** — use `aria-live="polite"` region for real-time vote count updates
- **Toggle between chart and table view** — let users choose their preferred format
- **Use percentage bars with text labels** — e.g. `[==========] 45% Option A (23 votes)` — the text alone conveys all information
- **Ensure keyboard focus** on interactive elements (vote buttons, result toggles)

---

## 6. Feature Patterns Worth Adopting

### 6.1 From Polly (Slack)
- Three-tier anonymity (anonymous / confidential / named)
- Demographics segmentation (slice results by department, role)
- Recurring polls with trend lines

### 6.2 From Twitter/X
- Granular custom duration (days/hours/minutes within a bounded range)
- Push notification when poll closes with final results

### 6.3 From Mentimeter
- 3-sheet XLSX export (individual responses, summary, per-session)
- Admin-enforced anonymity controls (min participant threshold for export, timestamp removal)

### 6.4 From StrawPoll
- Three poll types (Anonymous, Group, Meeting) with different default configurations
- Toggleable pie chart / bar chart view
- Vote analytics (temporal and geographic patterns)

### 6.5 From Typeform
- Summary export (aggregate) vs Raw export (individual) as separate downloads
- Network ID (hashed IP) for de-duplication without identity collection
- Start date + submit date (tracks how long voters deliberated)

### 6.6 From LinkedIn
- Simple preset durations (1d, 3d, 1w, 2w) — reduces decision fatigue
- "Who voted and how" visible only to creator — sensible default for workplace

### 6.7 From Google Forms
- Auto-selected chart type per question type (pie for single-choice, bar for multi-select)
- Real-time sync to Google Sheets for custom analysis
