# Configure Matadata or another JSON API

1. Deploy to a protected Vercel project. The API connector only functions when the serverless `api/connect.js` route is available; opening `index.html` as a local file will not connect.
2. Admin Panel → Matadata / Custom API Connection. Paste your HTTPS API endpoint URL and API key.
3. Select `Authorization / Bearer` or `x-api-key / Raw` as required by the provider.
4. Expand **Advanced: JSON paths and field mapping**. For JSON `{ "data": { "locations": [...], "payroll": [...] } }`, set restaurant array path `data.locations` and payroll run array path `data.payroll`. Set each field's source name, including ID, dates, and cycle reason.
5. Click **Test & Preview API**, review counts, then **Import Verified Data**. Import replaces current local data.
6. Keys are not saved and need to be entered again on reload. Field mappings are saved locally.

API source must provide restaurant IDs and names, plus payroll records referencing those restaurant IDs and pay dates. Payroll start/end, approval, processing, and pay dates should be ISO `YYYY-MM-DD` or ISO date-time strings. Off-cycle reasons may be mapped from a provider field. If provider uses different endpoints, pagination, POST requests, or OAuth, a provider-specific backend adapter is still needed.

The connector is read-only. Admin edits do not update the provider. For a production-grade system, provide official Matadata API documentation (the provider could not be verified), and build authenticated user sessions, encrypted secret storage, an integration worker, and persistent database.
