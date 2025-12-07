# Sikka ONE API Integration

Sikka ONE API provides unified access to 400+ dental practice management systems (PMS) including Dentrix, Eaglesoft, Open Dental, and more.

## Authentication Model

Sikka uses a **3-step authentication flow**:

### Step 1: Get Authorized Practices
Use `App-Id` + `App-Key` headers to call `/authorized_practices`:

```
GET https://api.sikkasoft.com/v4/authorized_practices
App-Id: your-app-id
App-Key: your-app-key
```

Returns list of connected practices with `office_id` and `secret_key`.

### Step 2: Obtain Request Key
POST to `/request_key` with practice credentials:

```json
POST https://api.sikkasoft.com/v4/request_key
{
  "grant_type": "request_key",
  "office_id": "D12345",
  "secret_key": "practice-secret-key",
  "app_id": "your-app-id",
  "app_key": "your-app-key"
}
```

Returns a temporary `request_key` valid for 24 hours.

### Step 3: Access Data
Use `request-key` header for all data endpoints:

```
GET https://api.sikkasoft.com/v4/patients
request-key: your-temporary-request-key
```

## TypeScript Usage

```typescript
import { Sikka } from '@workwayco/integrations';

// Initialize with App credentials
const sikka = new Sikka({
  appId: process.env.SIKKA_APP_ID,
  appKey: process.env.SIKKA_APP_KEY,
});

// Step 1: Get authorized practices
const practices = await sikka.getAuthorizedPractices();
console.log(`Found ${practices.data.length} connected practices`);

// Step 2: Connect to a practice (obtains request_key)
await sikka.connectToPractice(practices.data[0].office_id);

// Step 3: Access data
const patients = await sikka.getPatients({
  practiceId: practices.data[0].office_id,
});
```

## Connected Practices

Your application currently has **2 connected practices**:

| Office ID | Last Sync | Status |
|-----------|-----------|--------|
| D22072 | Oct 6, 2025 | Active (9,305 patients, 37,969 appointments) |
| V15543 | Aug 1, 2017 | Older data |

## Rate Limiting

Per Sikka documentation:

- Rate limits are tracked per time window (60 seconds)
- Response headers indicate limit status:
  - `X-Rate-Limit-Limit`: Calls allowed per window
  - `X-Rate-Limit-Remaining`: Calls left in current window
  - `X-Rate-Limit-Reset`: Seconds until window resets
- HTTP 429 indicates rate limit exceeded

Best practice: Space API calls based on `Reset / Remaining` ratio.

## API Endpoints

### Core Data

| Endpoint | Description |
|----------|-------------|
| `/authorized_practices` | Get practices linked to request key |
| `/patients` | Patient records |
| `/appointments` | Appointment schedules |
| `/providers` | Dentists, hygienists, etc. |
| `/treatments` | Treatment plans and procedures |
| `/claims` | Insurance claims |
| `/transactions` | Financial transactions |

### Incremental Sync

Use `loaded_startdate` / `loaded_enddate` parameters to fetch only modified records:

```typescript
const recentPatients = await sikka.getPatients({
  practiceId: 'practice-123',
  modifiedSince: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
});
```

### Practice Events (Change Detection)

The `/practice_events` endpoint returns changed records with flags:

```typescript
// Get appointments changed in last 15 minutes
GET /practice_events?interval=15&events=appointments
```

Response includes `flag` (Deleted/Added/Updated) and `changes` array showing field-level diffs.

## WORKWAY Workflows Using Sikka

### Dental Appointment Autopilot
- **Outcome**: No-shows that prevent themselves
- **Flow**: Sikka appointments → Smart reminders → Staff alerts → Waitlist backfill

### Dental Review Booster
- **Outcome**: Reviews that write themselves
- **Flow**: Completed visits → Satisfaction check → Google/Yelp reviews OR recovery workflow

## Setup Checklist

1. [ ] Register application at https://api.sikkasoft.com/v4/portal
2. [ ] Note your Application ID and Application Key
3. [ ] Implement OAuth/connection flow for practices to authorize your app
4. [ ] Store practice-specific Request Keys securely
5. [ ] Initialize Sikka client with Request Key per practice

## Example Usage

```typescript
import { Sikka } from '@workwayco/integrations';

// Each practice has its own request key
const sikka = new Sikka({
  requestKey: process.env.SIKKA_PRACTICE_REQUEST_KEY,
});

// Get practice info
const practices = await sikka.getAuthorizedPractices();

// Get today's schedule
const appointments = await sikka.getTodaysAppointments(practices.data[0].practice_id);

// Find patients needing recall
const patients = await sikka.getPatients({
  practiceId: practices.data[0].practice_id,
  modifiedSince: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
});
```

## Support

- Sikka Support: support@sikkasoftware.com
- API Portal: https://api.sikkasoft.com/v4/portal
- Documentation: https://documenter.getpostman.com/view/8503519/SVn3quBS
