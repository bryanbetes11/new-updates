# ServeSync private pilot operations

Pilot version: 2026-09-25. Owner and support contact: Bryan Ashley Lopez Betes, `babcreations11@gmail.com`. This runbook is for a free, invitation-only pilot; it is not a public-store release procedure.

## Invite one outside church

1. Confirm the first administrator's email and that the pilot team will consist of adults. Do not request passwords. The first administrator must verify that email, confirm adulthood, and accept the versioned pilot terms in ServeSync.
2. Sign in with the ServeSync platform-owner account and open **Admin Settings → Invite a church to the pilot**. Enter the first administrator's email and choose **Approve email**. Approval lasts seven days. Copy the church setup link from the same panel and share it with that person yourself; ServeSync does not send this email automatically. You can revoke an unused approval there. The server rejects unapproved email addresses even if someone reaches the registration page.
3. Give the administrator the `/create-church` link. ServeSync creates a billing-exempt workspace with 15 seats and no automatic charge. The administrator can then invite members. Each member of a pilot church must confirm adulthood and accept the pilot terms before joining. A recorded birthday indicating under 18 is rejected.
4. On the first real pilot church, verify that the administrator can invite a member, schedule an event, create a setlist, post a notice, and exchange a test message. Ask the church to remove its test content afterward. Synthetic cross-church isolation has already been rehearsed locally; do not use private data from another church as test material.

To inspect the profile forms without creating a church, open `/preview/onboarding?role=admin` on the ServeSync website or switch to **Member view** on that page. The preview works on desktop or phone; its completion button never saves data. It checks the design and form behavior, not email delivery or a real invitation acceptance.

## Support, access, and incidents

- Members contact their church administrator first for church-managed access, corrections, and removal. ServeSync is the fallback at `babcreations11@gmail.com` and handles platform/security incidents directly. Verify the requester through the existing account or a trusted administrator channel before disclosing records.
- For a suspected cross-church exposure: pause new pilot invitations, preserve logs and a protected backup, revoke affected access, inspect the precise table/Storage policy, and document people and data affected. Seek qualified privacy advice about any required notification; do not erase evidence while investigating.
- Never put member records, database passwords, service keys, or backups in chat, Git, GitHub Releases, or Vercel deployment files.

## Export, retention, and leaving the pilot

- If a church leaves, acknowledge the exit date, offer an operational-data export to its verified administrator, and schedule active-workspace removal within 30 days. Exclude private one-to-one chats and personal notes from a church-wide export. Review any individual deletion request for shared records and legal exceptions before removal.
- Export and deletion are **operator-assisted**, not self-service. The destructive process has not been automated or rehearsed end to end. Before the first actual exit, prepare a tenant-only export, verify it on the restored database, inventory all database rows and Storage objects for that church, and test full deletion and rollback in isolation. Then use a fresh protected backup and review the exact live target before the operation. Do not run broad `DELETE` commands from this document.
- The approved longer-term schedule is routine chat/attachments after 12 months and identifiable attendance/assignments after 3 years. Automated cleanup is not yet active. Review and fulfill individual requests manually during the pilot, and implement tested cleanup before the first pilot record reaches its retention deadline.
- The encrypted recovery archive and separate key were checked locally. An off-device copy has not been verified. Keep a protected copy outside this PC before depending on the archive for recovery.

## Distribution and versioning

- Website updates come from the verified main deployment. Android pilot devices install the latest GitHub prerelease APK using the in-app update flow. This debug-signed APK is for private testing only and is not a Google Play release. Do not declare physical-device installation or push delivery verified from an APK build alone.
- Chat and announcement media become private after the compatible web version and APK are published. Older installed APKs need the update to display those files. Profile photos remain optional and use shareable URLs; the Privacy Notice says so.
- Review the notice, terms, and church responsibilities with qualified Philippine privacy counsel before public or paid onboarding. The adults-only new-church pilot does not change the existing founding church's younger users or establish app-store child-safety compliance.
