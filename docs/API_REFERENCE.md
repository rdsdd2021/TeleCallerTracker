# API & RPC Reference

This document catalogs the REST API endpoints provided by the Next.js portal and the PostgreSQL Remote Procedure Calls (RPCs) available on Supabase.

---

## 1. Web Portal API Routes

All endpoints require an active session cookie or Bearer token unless otherwise specified.

### `GET /api/reports/hourly-breakdown`
Returns hourly call distribution metrics grouped by agent and time slot.

* **Query Parameters:**
  * `start` (string, ISO 8601): Start datetime (e.g. `2026-11-01T00:00:00Z`).
  * `end` (string, ISO 8601): End datetime (e.g. `2026-11-01T23:59:59Z`).

* **Response (200 OK):**
  ```json
  [
    {
      "caller_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "caller_name": "John Doe",
      "hour_slot": "10:00 - 11:00",
      "total_calls": 24,
      "connected_calls": 18,
      "talk_time_seconds": 1840
    }
  ]
  ```

---

### `GET /api/export/[type]`
Streams a generated CSV file for reports, leads, or call logs.

* **Path Parameters:**
  * `type` (`leads` | `call_logs` | `employee_report`)

* **Query Parameters:**
  * `start` (string, optional): Filter start date (`YYYY-MM-DD`).
  * `end` (string, optional): Filter end date (`YYYY-MM-DD`).

* **Response Headers:**
  * `Content-Type: text/csv; charset=utf-8`
  * `Content-Disposition: attachment; filename="call_logs_export.csv"`

---

### `GET /api/employees`
Lists active telecallers belonging to the caller's organisation.

* **Response (200 OK):**
  ```json
  [
    {
      "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "name": "Sarah Connor",
      "phone_number": "+919876543210",
      "is_active": true,
      "created_at": "2026-05-01T09:30:00Z"
    }
  ]
  ```

---

## 2. Supabase PostgreSQL Stored Procedures (RPCs)

### `upsert_call_logs`
Synchronizes an array of call records from mobile clients into `call_logs`.

* **Signature:** `public.upsert_call_logs(p_logs jsonb)`
* **Input Schema:**
  ```json
  [
    {
      "caller_id": "uuid",
      "contact_number": "+919876543210",
      "contact_name": "Alice Smith",
      "type": "outgoing",
      "duration": 145,
      "called_at": "2026-11-10T14:32:00Z",
      "notes": "Follow up scheduled for Thursday"
    }
  ]
  ```
* **Returns:** `integer` (Number of inserted/updated rows).

---

### `get_employee_report`
Generates aggregated employee performance metrics across a date range.

* **Signature:**
  ```sql
  public.get_employee_report(
    p_org_id uuid,
    p_start timestamptz,
    p_end timestamptz
  )
  ```
* **Returns:**
  | Field | Type | Description |
  | :--- | :--- | :--- |
  | `caller_id` | `uuid` | Telecaller identifier |
  | `caller_name` | `text` | Telecaller name |
  | `total_calls` | `bigint` | All recorded calls |
  | `connected_calls`| `bigint` | Calls with duration > 0 |
  | `total_talk_time`| `bigint` | Cumulative talk time in seconds |
  | `avg_duration` | `numeric`| Average duration of connected calls |
  | `working_hours` | `numeric`| Estimated active hours |

---

### `get_call_type_distribution`
Returns a breakdown of call types for pie and doughnut chart visualisations.

* **Signature:**
  ```sql
  public.get_call_type_distribution(
    p_org_id uuid,
    p_start timestamptz,
    p_end timestamptz
  )
  ```
* **Returns:**
  ```json
  [
    { "type": "incoming", "count": 120 },
    { "type": "outgoing", "count": 480 },
    { "type": "missed",   "count": 45 },
    { "type": "rejected", "count": 15 }
  ]
  ```
