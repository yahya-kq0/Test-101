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
