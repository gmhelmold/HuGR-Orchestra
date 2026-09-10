# Invariant: `profile-registry` - Profile Registry

> Clauses: 7 | Unwanted: 7 | Witnesses: app-dock-profile-registry.ts, app-dock-security.test.ts:973-980

## Clauses
- Profile ID must match ^[a-z0-9][a-z0-9-]{0,31}$ *(measured: app-dock-profile-registry.ts, app-dock-security.test.ts:973-980)*
- Manifest validation rejects invalid profiles, tabs, bookmarks, history *(measured: app-dock-profile-registry.ts, app-dock-security.test.ts:973-980)*
- Registry load fails closed on corrupt data *(measured: app-dock-profile-registry.ts, app-dock-security.test.ts:973-980)*
- ensureActive creates new profile with UUID storageKey *(measured: app-dock-profile-registry.ts, app-dock-security.test.ts:973-980)*
- markDeleting transitions active→deleting, returns storageKey *(measured: app-dock-profile-registry.ts, app-dock-security.test.ts:973-980)*
- markDeleted transitions deleting→deleted, rewrites manifest and removes tabs *(measured: app-dock-profile-registry.ts, app-dock-security.test.ts:973-980)*
- replaceManifest enforces revision match and active profile set consistency *(measured: app-dock-profile-registry.ts, app-dock-security.test.ts:973-980)*

## Unwanted
- Registry accepts profile ID outside pattern *(measured: app-dock-profile-registry.ts, app-dock-security.test.ts:973-980)*
- Registry accepts manifest exceeding internal limits *(measured: app-dock-profile-registry.ts, app-dock-security.test.ts:973-980)*
- Corrupt registry loads without error *(measured: app-dock-profile-registry.ts, app-dock-security.test.ts:973-980)*
- ensureActive creates profile without storageKey *(measured: app-dock-profile-registry.ts, app-dock-security.test.ts:973-980)*
- markDeleting on deleted profile succeeds *(measured: app-dock-profile-registry.ts, app-dock-security.test.ts:973-980)*
- markDeleted on non-deleting profile succeeds *(measured: app-dock-profile-registry.ts, app-dock-security.test.ts:973-980)*
- replaceManifest accepts revision mismatch *(measured: app-dock-profile-registry.ts, app-dock-security.test.ts:973-980)*

