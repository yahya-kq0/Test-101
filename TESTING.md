# Manual functional checklist

- Overview: change start/end dates and restaurant/frequency/cycle filters; inspect KPIs and the restaurant list.
- Restaurants: open details, verify AIO Buddy, add restaurant note as Editor; verify Viewer cannot edit.
- Admin: add AIO Buddy, assign to a restaurant, edit buddy contact, delete a buddy and verify unassignment.
- Admin: add restaurant (no first-pay-date field and no automatically generated payroll records), add a complete payroll run with all five dates, edit ownership and delete test restaurant.
- Payroll Runs: open detail, set Off-Cycle without a reason (must reject), then enter a reason (must save).
- Calendar: switch months, inspect deadlines and pay dates.
- Data: export JSON/CSV, test JSON import, verify demo reset and backup.
- Notifications: grant browser permission and press test; browser must be open for ongoing checks.
- Vercel: deploy, set environment variables, verify `/api/payroll` response; map provider schema if different. Never use sensitive real payroll data without authentication.

- Overview: confirm no redundant approval-deadline KPI; cards show payroll period start/end and assigned AIO Buddy. Verify visible off-cycle notes and restaurant handoff notes.
- Demo reset: Flights Restaurant & Bar has an illustrative off-cycle reason for the October 23, 2026 payday.
