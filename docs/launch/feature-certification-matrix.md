# ServeSync launch certification matrix

This is the release gate for opening ServeSync to churches outside the founding organization. A green build alone is not a public-launch certificate.

Status meanings:

- `Automated`: protected by a repeatable test in the repository.
- `Rendered`: inspected in the running application at the named breakpoint or state.
- `Pending`: must be exercised in staging with disposable Church A and Church B accounts.
- `Blocked`: requires an external account, policy, or business decision.

## Public and onboarding journey

| Workflow | Visitor | Church admin | Invited member | Phone | Desktop | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Landing to start-trial entry | Yes | N/A | N/A | Pending | Rendered | Pending final legal links |
| Create administrator account | Yes | New | N/A | Rendered | Rendered | Automated and rendered |
| Confirm email and resume setup | Yes | New | New | Pending | Pending | Pending staging SMTP test |
| Create church workspace | No | New | No | Source checked | Source checked | Automated; live-account test pending |
| Open a valid private invite | Yes | N/A | Yes | Pending | Pending | Pending disposable invite |
| Invalid, expired, and used invite | Yes | N/A | Yes | Pending | Rendered invalid state | Pending complete state set |
| Complete member profile | No | Yes | Yes | Source checked | Source checked | Pending authenticated render |
| Trial, payment, grace, and suspension | No | Yes | Limited | Pending | Pending | Blocked on payment-provider integration |

## Core feature regression

| Area | Member path | Leadership path | Church A/B isolation | Automated coverage | Staging certification |
| --- | --- | --- | --- | --- | --- |
| Authentication and session restore | Sign in, reset, update password | Admin recovery | Required | Partial | Pending |
| People, roles, and invitations | View own profile | Invite, role, admin controls | Required | Partial | Pending |
| Events and assignments | View and respond | Create, edit, assign | Required | Strong unit contracts | Pending |
| Setlists, songs, charts, proposals | Prepare and view | Build, review, approve | Required | Strong unit contracts | Pending |
| Announcements and reactions | Read, react, seen state | Publish, pin, inspect readers | Required | Partial | Pending |
| Direct, group, and event messaging | Send, edit, react, reply | Create groups and moderate own content | Required | Tenant contract added | Pending |
| Availability, leave, and swaps | Submit and withdraw | Approve and apply policy | Required | Policy contracts present | Pending |
| Attendance and QR | Scan and view own status | Run checkpoint and resolve | Required | QR contracts present | Pending |
| Surveys and reflections | Submit assigned responses | Configure and review | Required | Partial | Pending |
| Notifications and reminders | Preferences and push receipt | Rules and required notices | Required | Partial | Pending device matrix |
| Church settings and billing | Read allowed state | Update safe fields and billing workflow | Required | Tenant contract added | Pending |
| PWA install and updates | Install, reload, resume | Same | N/A | Startup/version tests | Pending installed-device test |

## Required tenant test identities

Create these only in staging:

1. Church A administrator
2. Church A leader
3. Church A member
4. Church B administrator
5. Church B leader
6. Church B member
7. Confirmed user without a church
8. Invited but unregistered member
9. Expired-invite recipient

For every organization-scoped feature, prove the allowed Church A action and then attempt the equivalent read, mutation, RPC, Realtime subscription, and Storage path from Church B.

## Public-launch exit criteria

- No open severity-one or severity-two tenant, data-loss, authentication, billing, or privacy defects.
- All public/onboarding rows are rendered on phone and desktop.
- All core feature rows have a staging evidence link or test name.
- A database and Storage restore rehearsal has succeeded.
- Privacy, Terms, cancellation, retention, and support contacts are published.
- Payment success, duplicate webhook, failure, retry, refund, cancellation, and grace-period cases pass in sandbox.
- The beta cohort completes at least two real service-planning cycles without a release-blocking regression.
