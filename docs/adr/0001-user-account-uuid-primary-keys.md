# User account tables use UUID primary keys

User account identifiers may appear in JWT subjects, logs, audit records, URLs, or future system integrations, so Nuvasite user-account-related tables use UUID primary keys rather than integer autoincrement IDs. This avoids exposing account creation order or making user identifiers trivially enumerable, even though UUIDs are less compact than sequential integers.
