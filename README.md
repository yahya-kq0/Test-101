# Payroll Atlas — Role-only Login

Deploy this static dashboard on Vercel or GitHub Pages. Click **Log in**, select Viewer, Editor, or Admin, and enter the workspace. No password is needed.

The login roles are **demonstration UI permissions only** and are NOT secure authentication. Do not use this build for sensitive production payroll information or public writable data. Real access control requires a server-side identity provider and server-enforced authorization.

The landing illustration is a CSS-only animated payroll slip, progress indicator and payment coin.

Payroll data remains stored locally in the browser and API integration remains configurable. Consult API_SETUP.md and API_Settings_One_Page_Guide.pdf for connector setup.

On Vercel: import the repository and deploy using the included vercel.json. Test the dashboard from its hosted URL.


## API Integration (dashboard-managed)
Open **Admin Panel → API Integration** and enter the provider's **HTTPS JSON API URL** and **X-API-Key**. Select **Test Connection**, then **Connect & Import**. The key and URL are kept only in the current browser tab and sent to the server-side `/api/connect` route for each request; they are not saved in localStorage or GitHub. No `PAYROLL_PROVIDER_URL` Vercel variable is required for this workflow.

The provider must accept `x-api-key` authentication and return compatible JSON arrays such as `restaurants`, `runs`, and optionally `buddies`. Other API structures require a provider-specific mapping adapter. An API key by itself is not enough; obtain the exact API endpoint from the provider.

**Security / production restriction:** Role selection is not real authentication. Until server-side admin login/authorization and an appropriately restricted provider allowlist are implemented, this public-facing connector must not be used with production payroll credentials. The connector does not save or automatically refresh credentials or sync edits back to the provider.

## Metabase integration (updated)

In **Admin Panel → Metabase Integration**, the Metabase host is preset to `https://metabase.dev.aioapp.com`.

1. Choose **X-API-Key** and enter your key, OR choose **Email / Username + Password** and enter your Metabase login. Only one authentication method is needed.
2. Click **Test Authentication**. This verifies credentials with `GET /api/user/current` without running a dataset query.
3. Click **Find Saved Questions** to list accessible Metabase questions, then select your Restaurant and Payroll questions where available. Alternatively, enter their numeric question IDs manually.
4. Click **Load & Import Data**. By default, restaurant data uses the user-provided SQL query `SELECT * FROM restaurant` on Metabase database 4. The payroll question is optional, but a matching payroll source is required to populate payroll dates and approval deadlines.
5. If authentication succeeds but importing fails with **403**, the account does not have adequate permissions to run the source query. Request Metabase read/query access for the database or use an accessible saved question.

Credentials are sent through Vercel's `/api/connect` serverless function for each action and held only in the current browser tab's memory. Imported records are kept in the browser's local storage, not written back to Metabase. The connector does not auto-sync. Check that your saved question returns fields such as restaurant ID, payroll start and end dates, approval date, processing date, and payday.

**Production security:** This deployment uses an unprotected role selector, not server-enforced authentication. Do not enter real production API keys or account passwords in a public deployment. Protect the deployment and implement authenticated Admin access before using sensitive payroll data.
