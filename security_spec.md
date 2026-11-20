# Security Specification — KelasBrevet Coretax Simulator

## 1. Data Invariants
1. Every document under `/users/{userId}/...` belongs strictly to `userId == request.auth.uid`. No user may read, list, create, update, or delete another user's simulation workspace, invoices, withholding slips, tax returns, billing codes, or ledger entries.
2. Every write requires an authenticated, email-verified user (`request.auth != null && request.auth.token.email_verified == true`).
3. Every sub-resource (`efaktur`, `ebupot`, `taxReturns`, `billing`, `ledger`) must reference an existing parent workspace under `/users/{userId}/workspaces/{workspaceId}` on create.
4. `ownerId`, `workspaceId`, and `createdAt` are immutable after creation. Server timestamp integrity (`request.time`) is enforced on `createdAt` (create) and `updatedAt` (create/update).
5. Terminal state locking:
   - `taxReturns` with `status == 'DILAPORKAN'` cannot be modified further.
   - `billing` with `status == 'LUNAS'` cannot be modified further.
   - `efaktur` with `status == 'CANCELED'` cannot be modified further.
   - `ledger` entries are append-only (no updates allowed).

## 2. "Dirty Dozen" Adversarial Payloads (All Must Return PERMISSION_DENIED)
1. **Cross-user read**: Authenticated User B reads `/users/userA/workspaces/ws1`.
2. **Unverified email write**: Authenticated user with `email_verified: false` creates `/users/{uid}`.
3. **Owner spoofing on create**: User A creates `/users/userA/efaktur/inv1` with `ownerId: "userB"`.
4. **Shadow field injection**: User A creates `/users/userA/workspaces/ws1` with extra key `isAdmin: true`.
5. **Path ID poisoning**: User A writes `/users/userA/efaktur/bad..id$with!spaces` (fails `isValidId`).
6. **Orphaned sub-resource**: User A creates `/users/userA/ebupot/s1` pointing to nonexistent `workspaceId: "ghost_ws"`.
7. **Immutable field tampering**: User A updates `/users/userA/taxReturns/r1` attempting to change `createdAt` or `workspaceId`.
8. **Client timestamp spoofing**: User A creates `/users/userA/billing/b1` with a past client timestamp instead of `request.time`.
9. **Terminal state override (SPT)**: User A attempts to update a `taxReturns` document whose `existing().status == 'DILAPORKAN'`.
10. **Terminal state override (Billing)**: User A attempts to mutate `amount` on a `billing` document with `existing().status == 'LUNAS'`.
11. **Ledger tampering**: User A attempts to `update` an existing `ledger` entry.
12. **Unbounded array / string overflow**: User A submits an `efaktur` invoice with `items.size() > 50` or `counterpartyName.size() > 150`.
