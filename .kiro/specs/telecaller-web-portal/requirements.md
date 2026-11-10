# Requirements Document

## Introduction

The Telecaller Web Portal is a multi-tenant Next.js web application that allows managers and organisation owners to monitor, analyse, and manage their telecaller teams. The portal consumes call log data synced from Android devices via the existing React Native mobile app and Supabase backend. Each organisation's data is fully isolated. The portal provides dashboards, employee management, reporting, and settings across five primary pages.

---

## Glossary

- **Portal**: The Next.js web application described in this document.
- **Organisation (Org)**: A tenant unit representing a company or team. All data belongs to exactly one Org.
- **Owner**: The Supabase Auth user who created an Org. Has full administrative rights within that Org.
- **Admin**: An Org member with elevated rights: can manage employees, templates, and view all reports, but cannot delete the Org or change billing.
- **Member**: An Org member with read-only access to dashboards and reports. Cannot modify employees or settings.
- **Caller**: A telecaller registered on the mobile app, linked to an Org via `org_id`. Corresponds to a row in the `callers` table.
- **Invite Code**: A short alphanumeric token generated per Org, used by the mobile app to link a new Caller to the correct Org during registration.
- **Call Log**: A record of a single phone call, stored in the `call_logs` table, linked to a Caller and therefore to an Org.
- **Dashboard**: The Portal page showing aggregated call statistics for a selected time period.
- **Report**: A per-employee breakdown of call metrics for a user-selected date range.
- **RLS**: Row-Level Security — Supabase Postgres policies that enforce data isolation at the database layer.
- **JWT**: JSON Web Token issued by Supabase Auth, carrying the authenticated user's `user_id`.
- **Sync_Log**: A record in the `sync_logs` table tracking mobile app sync events.
- **Export**: A downloadable CSV file containing tabular data from the Portal.
- **Call_Type**: One of: `incoming`, `outgoing`, `missed`, `rejected`, `never_attended`, `not_pickup_by_client`.
- **Connected_Call**: A call with `duration_sec > 0`.
- **Working_Hours**: The total wall-clock time between a Caller's first and last call of the day.

---

## Requirements

---

### Requirement 1: User Authentication — Sign Up and Org Creation

**User Story:** As a new manager, I want to sign up with my email and password and automatically have an organisation created for me, so that I can immediately start using the Portal without manual provisioning.

#### Acceptance Criteria

1. THE Portal SHALL provide a sign-up page that accepts an email address, a password, and an organisation name.
2. WHEN a user submits the sign-up form with a valid email, a password of at least 8 characters, and a non-empty organisation name, THE Portal SHALL create a Supabase Auth account for the user.
3. WHEN the Supabase Auth account is successfully created, THE Portal SHALL insert a row into the `organisations` table with the provided organisation name and a generated UUID.
4. WHEN the `organisations` row is inserted, THE Portal SHALL insert a row into the `org_members` table linking the new user's `auth.uid()` to the new Org with the role `owner`.
5. WHEN sign-up completes successfully, THE Portal SHALL redirect the user to the Dashboard page.
6. IF the submitted email address is already registered, THEN THE Portal SHALL display the message "An account with this email already exists."
7. IF the submitted password is fewer than 8 characters, THEN THE Portal SHALL display the message "Password must be at least 8 characters."
8. IF the organisation name field is empty, THEN THE Portal SHALL display the message "Organisation name is required."
9. THE Portal SHALL perform sign-up steps 2–4 within a single database transaction so that a failed org insert does not leave an orphaned Auth account.

---

### Requirement 2: User Authentication — Login and Session Management

**User Story:** As a returning manager, I want to log in with my email and password, so that I can access my organisation's data securely.

#### Acceptance Criteria

1. THE Portal SHALL provide a login page that accepts an email address and a password.
2. WHEN a user submits valid credentials, THE Portal SHALL establish a Supabase Auth session and redirect the user to the Dashboard page.
3. IF submitted credentials are invalid, THEN THE Portal SHALL display the message "Invalid email or password."
4. WHEN an unauthenticated user navigates to any protected page, THE Portal SHALL redirect the user to the login page.
5. WHEN a user clicks "Log out", THE Portal SHALL invalidate the Supabase Auth session and redirect the user to the login page.
6. WHILE a valid session exists, THE Portal SHALL automatically refresh the session token before it expires without requiring the user to log in again.
7. THE Portal SHALL store the session exclusively in an HttpOnly cookie to prevent client-side JavaScript access to the session token.

---

### Requirement 3: Multi-Tenancy and Data Isolation

**User Story:** As an organisation owner, I want my organisation's data to be completely invisible to users of other organisations, so that sensitive call data is never exposed across tenants.

#### Acceptance Criteria

1. THE Database SHALL enforce RLS policies on the `organisations`, `org_members`, `callers`, `call_logs`, and `sync_logs` tables such that every SELECT, INSERT, UPDATE, and DELETE operation is restricted to rows whose `org_id` matches the authenticated user's Org.
2. THE Portal SHALL pass the authenticated user's JWT on every Supabase query so that RLS policies are evaluated against the correct `auth.uid()`.
3. WHEN a user belonging to Org A queries any table, THE Database SHALL return zero rows that belong to Org B.
4. THE Database SHALL add an `org_id` foreign key column (referencing `organisations.id`, NOT NULL) to the `callers`, `call_logs`, and `sync_logs` tables.
5. THE Portal SHALL never construct queries that bypass RLS by using the service-role key on the client side.
6. FOR ALL pairs of distinct organisations (Org_A, Org_B) and FOR ALL tables with `org_id`, a query authenticated as a member of Org_A SHALL return no rows where `org_id = Org_B.id`. (Isolation invariant — property-based test.)

---

### Requirement 4: Role-Based Access Control

**User Story:** As an organisation owner, I want to assign roles to team members so that I can control who can modify settings versus who can only view reports.

#### Acceptance Criteria

1. THE Portal SHALL support three roles within an Org: `owner`, `admin`, and `member`.
2. WHILE a user has the `owner` role, THE Portal SHALL grant access to all pages and all write operations including org settings and member management.
3. WHILE a user has the `admin` role, THE Portal SHALL grant access to all pages and write operations except deleting the organisation and changing the owner.
4. WHILE a user has the `member` role, THE Portal SHALL grant read-only access to the Dashboard and Reports pages and SHALL hide all create, edit, and delete controls.
5. WHEN a user with the `member` role attempts to access a management page via direct URL, THE Portal SHALL redirect the user to the Dashboard page and display the message "You do not have permission to access this page."
6. THE Portal SHALL derive the user's role from the `org_members` table on every page load and SHALL NOT cache the role in client-side storage beyond the current session.

---

### Requirement 5: Manager Addition

**User Story:** As an owner or admin, I want to add managers to my organisation directly, so that they can log in and access the Portal with administrative privileges without needing a separate invitation flow.

#### Acceptance Criteria

1. WHEN an owner or admin submits a valid email address and password on the add manager form, THE Portal SHALL create a Supabase Auth account directly with admin role.
2. WHEN the Auth account is successfully created, THE Portal SHALL insert a row into `org_members` linking the new user to the current user's Org with the role `admin`.
3. IF the submitted email address is already registered, THEN THE Portal SHALL display the message "An account with this email already exists."
4. WHEN an owner or admin removes a member, THE Portal SHALL delete the corresponding `org_members` row and revoke the user's access to the Org immediately.
5. THE Portal SHALL display the current list of Org members with their email addresses, roles, and join dates on the Users sub-page under Manage.

---

### Requirement 6: Mobile App — Caller Registration with Org Linking

**User Story:** As a telecaller using the mobile app, I want to register my device by entering my Employee ID and an Org Invite Code, so that my call logs are automatically attributed to the correct organisation.

#### Acceptance Criteria

1. THE Mobile_App SHALL display an "Org Invite Code" input field on the registration screen in addition to the existing Full Name and Employee ID fields.
2. WHEN a telecaller submits the registration form, THE Mobile_App SHALL look up the Org whose `invite_code` matches the submitted code in the `organisations` table.
3. IF no Org is found for the submitted invite code, THEN THE Mobile_App SHALL display the message "Invalid invite code. Please contact your manager."
4. WHEN a matching Org is found, THE Mobile_App SHALL insert or update the `callers` row with the resolved `org_id`.
5. THE Portal SHALL display the Org's invite code on the Settings page so that owners and admins can share it with telecallers.
6. WHEN an owner or admin regenerates the invite code, THE Portal SHALL replace the existing `invite_code` with a new cryptographically random 8-character alphanumeric string and SHALL invalidate the previous code immediately.
7. IF a Caller row already has an `org_id` set to a different Org, THEN THE Mobile_App SHALL display the message "This Employee ID is already registered with another organisation."
8. NOTE: Employee registration is handled exclusively through the mobile app. The portal does not provide employee registration functionality.

---

### Requirement 7: Dashboard Page

**User Story:** As a manager, I want to see a summary of my team's call activity for today, yesterday, and last week at a glance, so that I can quickly assess team performance without running a report.

#### Acceptance Criteria

1. THE Dashboard SHALL display stat cards for the following metrics for the selected time period: Total Calls, Total Call Duration, Incoming Calls, Outgoing Calls, Missed Calls, Rejected Calls, Never Attended Calls, Not Pickup by Client Calls, Unique Clients, Working Hours, and Connected Calls.
2. THE Dashboard SHALL provide three time-period selectors: "Today", "Yesterday", and "Last Week" (Monday–Sunday of the previous calendar week).
3. WHEN a time-period selector is chosen, THE Dashboard SHALL update all stat cards to reflect data for that period within 2 seconds.
4. THE Dashboard SHALL display each stat card with the metric name, the numeric value, and a comparison delta (percentage change) relative to the equivalent prior period.
5. WHEN no call data exists for the selected period, THE Dashboard SHALL display "0" for all numeric metrics and "—" for all deltas.
6. THE Dashboard SHALL aggregate metrics across all Callers belonging to the authenticated user's Org only.
7. WHEN the Dashboard page loads, THE Dashboard SHALL default to the "Today" time period.

---

### Requirement 8: Manage — Employees Sub-Page

**User Story:** As an owner or admin, I want to view, search, and export my team's employee records, so that I can monitor the employee roster.

#### Acceptance Criteria

1. THE Employees_Page SHALL display a paginated table of all Callers in the Org with columns: Name, Employee ID, Device ID, Registration Date, and Last Sync.
2. WHEN a user types in the search field, THE Employees_Page SHALL filter the table to rows where the Name or Employee ID contains the search string (case-insensitive) within 300 milliseconds.
3. THE Employees_Page SHALL NOT provide employee registration functionality - employees register exclusively through the mobile app using org invite codes.
4. WHEN an owner or admin clicks "Export", THE Employees_Page SHALL generate and download a CSV file containing all visible table rows with the columns: Name, Employee ID, Device ID, Registration Date, Last Sync.
5. THE Employees_Page SHALL display a "Never synced" label in the Last Sync column for Callers with no entries in `sync_logs`.

---

### Requirement 9: Manage — Exclude Phone Numbers Sub-Page

**User Story:** As a manager, I want to exclude specific phone numbers from call reports, so that internal or irrelevant numbers do not skew my team's metrics.

#### Acceptance Criteria

1. THE Exclude_Numbers_Page SHALL display a list of all phone numbers currently excluded for the Org.
2. WHEN an owner or admin submits a phone number in E.164 format, THE Exclude_Numbers_Page SHALL add it to the exclusion list for the Org.
3. IF a submitted phone number is not in a valid phone number format, THEN THE Exclude_Numbers_Page SHALL display the message "Please enter a valid phone number."
4. WHEN an excluded number is deleted, THE Exclude_Numbers_Page SHALL remove it from the list and SHALL include calls to or from that number in subsequent report calculations.
5. THE Portal SHALL exclude calls whose `contact_number` matches any entry in the Org's exclusion list from all Dashboard and Report metric calculations.

---

### Requirement 10: Manage — Call Note Templates Sub-Page

**User Story:** As a manager, I want to create and manage call note templates, so that telecallers have consistent prompts when logging call outcomes.

#### Acceptance Criteria

1. THE Note_Templates_Page SHALL display a list of all call note templates for the Org.
2. WHEN an owner or admin submits a template with a non-empty title and body, THE Note_Templates_Page SHALL insert the template into the database linked to the Org.
3. WHEN an owner or admin edits a template, THE Note_Templates_Page SHALL update the existing record and SHALL display the updated content immediately.
4. WHEN an owner or admin deletes a template, THE Note_Templates_Page SHALL remove the record and SHALL update the displayed list within 500 milliseconds.
5. THE Note_Templates_Page SHALL support a maximum of 50 active templates per Org.
6. IF an owner or admin attempts to create a 51st template, THEN THE Note_Templates_Page SHALL display the message "You have reached the maximum of 50 templates."

---

### Requirement 11: Manage — Message Templates Sub-Page

**User Story:** As a manager, I want to create SMS/WhatsApp message templates, so that telecallers can send consistent follow-up messages to clients.

#### Acceptance Criteria

1. THE Message_Templates_Page SHALL display a list of all message templates for the Org.
2. WHEN an owner or admin submits a template with a non-empty title and body, THE Message_Templates_Page SHALL insert the template into the database linked to the Org.
3. WHEN an owner or admin deletes a template, THE Message_Templates_Page SHALL remove the record and SHALL update the displayed list within 500 milliseconds.
4. THE Message_Templates_Page SHALL support template body text up to 1,000 characters.
5. IF a submitted template body exceeds 1,000 characters, THEN THE Message_Templates_Page SHALL display the message "Message body must not exceed 1,000 characters."

---

### Requirement 12: Manage — Call Recordings Sub-Page

**User Story:** As a manager, I want to browse and play call recordings linked to my team's call logs, so that I can review call quality.

#### Acceptance Criteria

1. THE Recordings_Page SHALL display a paginated list of call recordings for the Org, showing: Caller Name, Contact Number, Call Date, Duration, and a playback control.
2. WHEN a user clicks the playback control, THE Recordings_Page SHALL stream the audio file from Supabase Storage and begin playback within 3 seconds.
3. THE Recordings_Page SHALL provide a date range filter that limits the displayed recordings to calls within the selected range.
4. WHILE a recording is playing, THE Recordings_Page SHALL display elapsed time and total duration.
5. IF a recording file is not found in storage, THEN THE Recordings_Page SHALL display "Recording unavailable" in place of the playback control.

---

### Requirement 13: Manage — Pinned Call Logs Sub-Page

**User Story:** As a manager, I want to pin important call log entries for quick reference, so that I can revisit notable calls without searching.

#### Acceptance Criteria

1. THE Pinned_Logs_Page SHALL display all call log entries that have been pinned by any member of the Org.
2. WHEN an owner or admin pins a call log entry, THE Portal SHALL insert a record into a `pinned_call_logs` table linked to the Org and the `call_logs.id`.
3. WHEN an owner or admin unpins a call log entry, THE Portal SHALL delete the corresponding `pinned_call_logs` record and SHALL remove the entry from the Pinned_Logs_Page immediately.
4. THE Pinned_Logs_Page SHALL display for each pinned entry: Caller Name, Contact Number, Call Type, Duration, Call Date, and the name of the member who pinned it.

---

### Requirement 15: Reports Page — Portfolio Reports

**User Story:** As a manager, I want to generate a detailed call report for a custom date range, so that I can evaluate individual and team performance over any period.

#### Acceptance Criteria

1. THE Reports_Page SHALL provide a date range picker that accepts a start date and an end date.
2. WHEN a user applies a date range, THE Reports_Page SHALL display a per-employee table with the following columns for each Caller: Name, Employee ID, Total Calls, Incoming, Outgoing, Missed, Rejected, Never Attended, Not Pickup by Client, Connected Calls, Total Duration, Average Call Duration, Unique Clients, Working Hours.
3. THE Reports_Page SHALL display a pie chart showing the distribution of call types (Incoming, Outgoing, Missed, Rejected, Never Attended, Not Pickup by Client) for the selected date range across all Callers in the Org.
4. WHEN a user clicks a column header in the per-employee table, THE Reports_Page SHALL sort the table by that column in descending order on first click and ascending order on second click.
5. WHEN a user clicks "Export", THE Reports_Page SHALL generate and download a CSV file containing all rows of the per-employee table for the selected date range.
6. IF the selected start date is after the selected end date, THEN THE Reports_Page SHALL display the message "Start date must be on or before end date."
7. WHEN no call data exists for the selected date range, THE Reports_Page SHALL display an empty table with the message "No data for the selected period."
8. THE Reports_Page SHALL calculate Working Hours for each Caller as the difference between the timestamp of the Caller's last call and the timestamp of the Caller's first call on each day within the range, summed across all days.

---

### Requirement 16: Connectors Page

**User Story:** As an owner or admin, I want to configure integrations with third-party CRM and messaging tools, so that call data can flow into our existing workflows.

#### Acceptance Criteria

1. THE Connectors_Page SHALL display a list of available integrations with their connection status (Connected / Not Connected).
2. WHEN an owner or admin clicks "Connect" for an integration, THE Connectors_Page SHALL initiate the integration's OAuth or API-key configuration flow.
3. WHEN an integration is successfully configured, THE Connectors_Page SHALL display the integration's status as "Connected" and SHALL store the integration credentials encrypted in the database.
4. WHEN an owner or admin clicks "Disconnect" for a connected integration, THE Connectors_Page SHALL delete the stored credentials and SHALL update the status to "Not Connected".
5. IF an integration's stored credentials become invalid (e.g., token revoked), THEN THE Connectors_Page SHALL display the status as "Reconnection required" and SHALL prompt the owner or admin to reconnect.

---

### Requirement 17: Settings Page

**User Story:** As an organisation owner, I want to manage my organisation's settings, so that I can keep the org profile accurate and control access.

#### Acceptance Criteria

1. THE Settings_Page SHALL display the organisation's name, creation date, and current invite code.
2. WHEN an owner submits an updated organisation name, THE Settings_Page SHALL update the `organisations` row and SHALL display the new name in the header within 500 milliseconds.
3. WHEN an owner or admin clicks "Regenerate Invite Code", THE Settings_Page SHALL replace the existing invite code with a new cryptographically random 8-character alphanumeric string.
4. THE Settings_Page SHALL display the current plan/subscription tier (for future billing integration; display "Free" if not yet implemented).
5. WHEN an owner clicks "Delete Organisation", THE Settings_Page SHALL display a confirmation dialog requiring the owner to type the organisation name before proceeding.
6. WHEN the owner confirms deletion, THE Settings_Page SHALL soft-delete the organisation by setting a `deleted_at` timestamp on the `organisations` row and SHALL log the user out immediately.

---

### Requirement 18: Navigation and Layout

**User Story:** As a Portal user, I want a consistent navigation structure across all pages, so that I can move between sections without confusion.

#### Acceptance Criteria

1. THE Portal SHALL display a persistent left sidebar on all authenticated pages containing navigation links to: Dashboard, Manage (expandable), Reports, Connectors, and Settings.
2. THE Portal SHALL display the authenticated user's name and role in the sidebar footer.
3. WHEN a user navigates to a page, THE Portal SHALL highlight the corresponding sidebar link as active.
4. THE Portal SHALL be responsive and SHALL collapse the sidebar into a hamburger menu on viewports narrower than 768 pixels.
5. THE Portal SHALL display the organisation name in the top header bar on all authenticated pages.

---

### Requirement 19: Data Export — CSV Correctness

**User Story:** As a manager, I want exported CSV files to accurately reflect the data shown on screen, so that I can trust the exported data for external analysis.

#### Acceptance Criteria

1. WHEN a CSV export is triggered, THE Portal SHALL include a header row as the first row of the file.
2. THE Portal SHALL produce CSV files where the number of data rows equals the number of rows visible in the table at the time of export.
3. THE Portal SHALL produce CSV files where each data row contains the same values as the corresponding table row.
4. THE Portal SHALL encode CSV files in UTF-8 with a BOM so that Microsoft Excel opens them correctly without character encoding issues.
5. FOR ALL table rows visible at export time, the exported CSV row at the same index SHALL contain identical values for every column. (Round-trip invariant — property-based test.)

---

### Requirement 20: Call Metrics Calculation Correctness

**User Story:** As a manager, I want the call metrics shown in the Dashboard and Reports to be mathematically correct, so that I can rely on them for performance decisions.

#### Acceptance Criteria

1. THE Portal SHALL calculate Total Calls as the count of all `call_logs` rows for the Org within the selected period, excluding numbers in the Org's exclusion list.
2. THE Portal SHALL calculate Connected Calls as the count of `call_logs` rows where `duration_sec > 0` within the selected period.
3. THE Portal SHALL calculate Total Call Duration as the sum of `duration_sec` for all `call_logs` rows within the selected period.
4. THE Portal SHALL calculate Unique Clients as the count of distinct `contact_number` values across all `call_logs` rows within the selected period.
5. FOR ALL non-overlapping date ranges R1 and R2 whose union equals a larger range R, the Total Calls for R SHALL equal the sum of Total Calls for R1 and Total Calls for R2. (Additivity invariant — property-based test.)
6. FOR ALL Orgs, Connected Calls SHALL be less than or equal to Total Calls for any given period. (Monotonicity invariant — property-based test.)
7. FOR ALL Callers, the sum of Incoming + Outgoing + Missed + Rejected + Never Attended + Not Pickup by Client SHALL equal Total Calls for any given period. (Partition invariant — property-based test.)

---

### Requirement 21: Server-Side Rendering and Performance

**User Story:** As a Portal user, I want pages to load quickly and be indexable, so that the Portal feels responsive and professional.

#### Acceptance Criteria

1. THE Portal SHALL use Next.js server-side rendering (SSR) or static generation for all pages to ensure initial HTML is delivered to the browser.
2. THE Portal SHALL achieve a Largest Contentful Paint (LCP) of under 2.5 seconds on a standard broadband connection for the Dashboard page.
3. THE Portal SHALL display a loading skeleton in place of data tables and stat cards while data is being fetched.
4. WHEN a data fetch fails, THE Portal SHALL display an error message describing the failure and a "Retry" button without crashing the page.
5. THE Portal SHALL prefetch data for the Dashboard page on login redirect so that the Dashboard is populated on first render without a secondary loading state.

---

### Requirement 22: Accessibility

**User Story:** As a Portal user with accessibility needs, I want the Portal to be usable with a keyboard and screen reader, so that I am not excluded from using the product.

#### Acceptance Criteria

1. THE Portal SHALL achieve a WCAG 2.1 Level AA conformance rating for all pages.
2. THE Portal SHALL ensure all interactive elements (buttons, links, form inputs) are reachable and operable via keyboard navigation using Tab and Enter keys.
3. THE Portal SHALL provide visible focus indicators on all interactive elements.
4. THE Portal SHALL associate all form inputs with descriptive `<label>` elements.
5. THE Portal SHALL provide `aria-label` attributes on icon-only buttons.

