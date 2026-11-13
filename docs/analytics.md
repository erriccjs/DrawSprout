# Anonymous usage counts

DrawSprout records a few counts so Eric can see whether people open the app,
finish lessons, and like them. The counts are not personal data.

Each event stores only:

| Field | Where | What it is |
| --- | --- | --- |
| `blob1` | event name | One of the names below |
| `blob2` | lesson id | A catalogue slug such as `cat-sitting`, or empty |
| `blob3` | language | `en` or `id` |
| `blob4` | device | `phone`, `tablet`, or `desktop` |
| `double1` | returning this week | `1` if this browser already opened the app earlier in the same UTC week, otherwise `0` |
| `index1` | event name | Same as `blob1`, used for sampling |

The client address is used only to rate-limit the endpoint, in the same Durable
Object the paid photo routes already use. It is not written to Analytics Engine.
There is no user-agent string, cookie, photo, free text, or device id.

## Why there is no device id

A random id, even one that rotates every month, would tie a child's lessons
together. A boolean computed on the device answers "did this browser already
come back this week?" without sending an identifier. The week label stays in
`localStorage` and is not uploaded. The first open of a week is `0`. Later
opens that week are `1`. A new week starts again at `0`.

That means the weekly query counts returning opens, not a list of people.

## Event names

`app_open`, `lesson_start`, `lesson_complete`, `trace_photo_start`,
`doodle_start`, `doodle_success`, `free_draw_start`, `feedback_up`,
`feedback_down`.

`lesson_start`, `lesson_complete`, `feedback_up`, and `feedback_down` require a
lesson id. The id must match `[a-z0-9-]`. Anything else is rejected. The client
drops a bad event and never throws. Offline events are dropped.

`POST /api/event` accepts at most 512 bytes. Extra fields are rejected. The
usage window is 40 events per 10 minutes per address, separate from the paid
photo window. A limited caller gets HTTP 429. The page ignores that.

## Where to look

The dataset is `drawsprout_events`. The Worker binding is `USAGE`.

In the Cloudflare dashboard: **Workers & Pages → drawsprout**, and the account
**Analytics Engine** page for the dataset `drawsprout_events`. The Workers
metrics charts are not these counts. These queries are.

The SQL API is:

```bash
curl "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/analytics_engine/sql" \
  -H "Authorization: Bearer $API_TOKEN" \
  --data "$QUERY"
```

The token needs Analytics Read. Every query sums `_sample_interval` because
Analytics Engine samples.

### Daily opens

```sql
SELECT
  toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day,
  SUM(_sample_interval) AS opens
FROM drawsprout_events
WHERE blob1 = 'app_open'
  AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY day
ORDER BY day
```

### Lessons started and completed

```sql
SELECT
  toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day,
  SUM(if(blob1 = 'lesson_start', _sample_interval, 0)) AS started,
  SUM(if(blob1 = 'lesson_complete', _sample_interval, 0)) AS completed
FROM drawsprout_events
WHERE blob1 IN ('lesson_start', 'lesson_complete')
  AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY day
ORDER BY day
```

### Completion rate per lesson

```sql
SELECT
  blob2 AS lesson,
  SUM(if(blob1 = 'lesson_start', _sample_interval, 0)) AS started,
  SUM(if(blob1 = 'lesson_complete', _sample_interval, 0)) AS completed,
  if(started = 0, 0, completed / started) AS completion_rate
FROM drawsprout_events
WHERE blob1 IN ('lesson_start', 'lesson_complete')
  AND blob2 != ''
  AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY lesson
ORDER BY started DESC
```

### Weekly returning opens

Not unique people. `double1 = 1` means the browser had already opened the app
earlier in that UTC week.

```sql
SELECT
  toStartOfWeek(timestamp) AS week,
  SUM(if(double1 = 1, _sample_interval, 0)) AS returning_opens,
  SUM(if(double1 = 0, _sample_interval, 0)) AS first_opens_this_week
FROM drawsprout_events
WHERE blob1 = 'app_open'
  AND timestamp > NOW() - INTERVAL '8' WEEK
GROUP BY week
ORDER BY week
```

### Feedback per lesson

```sql
SELECT
  blob2 AS lesson,
  SUM(if(blob1 = 'feedback_up', _sample_interval, 0)) AS up,
  SUM(if(blob1 = 'feedback_down', _sample_interval, 0)) AS down
FROM drawsprout_events
WHERE blob1 IN ('feedback_up', 'feedback_down')
  AND timestamp > NOW() - INTERVAL '30' DAY
GROUP BY lesson
ORDER BY up + down DESC
```

## Cloudflare Web Analytics

The zone can enable Web Analytics on its own. A Worker custom domain may not
inject the beacon. The app adds the beacon only when the build has
`VITE_CF_WEB_ANALYTICS_TOKEN`. That value is empty unless it is set. Do not
commit a token. The content security policy already allows
`https://static.cloudflareinsights.com` and `https://cloudflareinsights.com`.
