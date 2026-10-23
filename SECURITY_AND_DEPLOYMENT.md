# Access and deployment

Viewer, Editor and Admin can be selected without passwords. Roles only control the browser UI and are not secure authentication. The session role is retained within the browser tab using sessionStorage. Users can select Admin themselves. Do NOT use for confidential payroll or public production deployment with private data.

For production, add real server-side login, role checks on every read/write endpoint, a shared database, safe API credential storage, and auditing.

The configurable connector may need mapping to your actual provider API; an API key by itself does not guarantee compatibility.
