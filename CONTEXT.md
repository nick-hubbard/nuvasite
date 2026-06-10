# Nuvasite

Nuvasite is a portal for creating and managing generated websites, with separate language for people who log in to manage work and people who view published sites.

## Language

**User**:
A person with a Nuvasite login who can create or manage website-related work.
_Avoid_: Visitor, viewer

**Visitor**:
A person viewing a generated website without necessarily having a Nuvasite login.
_Avoid_: User, account

**User Account**:
The durable Nuvasite account record associated with one logged-in user.
_Avoid_: Visitor account

**Authentication**:
The completed sign-in or sign-up event that proves a person can own a Nuvasite user account.
_Avoid_: Pending signup

**Auth Method**:
A way a user proves control of a user account, such as email/password or Google OAuth.
_Avoid_: Separate account, login account

**OAuth Provider Identity**:
The stable account identifier assigned by an OAuth provider.
_Avoid_: Provider email address

**Password Credential**:
The stored password verifier for an email/password auth method.
_Avoid_: Plaintext password, OAuth credential

**User Profile**:
The optional display and personal details attached to a user account.
_Avoid_: Separate account

**User Account Status**:
The lifecycle state that determines whether a user account is usable.
_Avoid_: Role, permission

**Status Change**:
A recorded transition in a user account's lifecycle state.
_Avoid_: Current status

**Last Login**:
The most recent successful authentication that created an active Nuvasite session.
_Avoid_: Failed login attempt

## Relationships

- A **User** has exactly one **User Account**
- A **Visitor** does not need a **User Account**
- A **User Account** is created only after successful **Authentication**
- In the initial version, email/password signup counts as completed **Authentication** without a separate email verification step
- A **User Account** requires an email address, while **User Profile** details may be incomplete
- **User Profile** names are trimmed but preserve the user's chosen casing
- A **User Account** has one current **User Account Status**
- A **Status Change** records the previous and new **User Account Status**, who changed it, when it changed, and why
- The initial **User Account Status** assignment is recorded as a **Status Change**
- A **Status Change** remains meaningful if the user account that performed the change is later hard-deleted
- A **Last Login** is updated only after successful **Authentication**
- Only an **Active** user account can authenticate and create a Nuvasite session
- A **User Account** can have multiple **Auth Methods**
- A **User Account** can have at most one **Auth Method** of each type
- A **User Account** is identified by one globally unique email address, regardless of which **Auth Method** is used
- A **User Account** reserves its email address while its record exists, including when it is disabled, banned, or removed
- A **User Account** email address is stable after account creation
- A **User Account** email address is stored in normalized lowercase form
- **Auth Methods** and **Password Credentials** are dependent on their owning **User Account**
- A **Password Credential** belongs to exactly one email/password **Auth Method**
- An email/password **Auth Method** requires exactly one **Password Credential**
- A Google OAuth **Auth Method** can be linked to an existing **User Account** when Google provides the same verified email address
- Google OAuth account creation or linking requires Google to provide a verified email address
- An OAuth provider identity can be linked to at most one **User Account**
- A Google OAuth **Auth Method** uses Google's stable provider identity rather than the Google email address as its provider identifier
- An OAuth provider may fill missing **User Profile** details, but it does not overwrite Nuvasite profile details that already exist

## Example dialogue

> **Dev:** "Should every **Visitor** get a row in the account table?"
> **Domain expert:** "No — only a **User** with a Nuvasite login has a **User Account**."
>
> **Dev:** "If someone signs in with email/password once and Google OAuth later, is that a second **User Account**?"
> **Domain expert:** "No — it is the same **User Account** because the email address is the same."
>
> **Dev:** "Are Google OAuth and email/password both **Auth Methods**?"
> **Domain expert:** "Yes, but only email/password has a **Password Credential**."
>
> **Dev:** "If Google confirms the same verified email as an existing **User Account**, do we create another account?"
> **Domain expert:** "No — link Google as another **Auth Method** for the existing **User Account**."

## User account statuses

**Active**:
A user account that can authenticate and use Nuvasite.
_Avoid_: Enabled

**Disabled**:
A user account whose access has been turned off administratively or operationally.
_Avoid_: Removed, banned

**Banned**:
A user account whose access has been revoked because the user is not allowed to use Nuvasite.
_Avoid_: Disabled, removed

**Removed**:
A user account removed from normal product use while its record remains for relationships and audit.
_Avoid_: Disabled, banned, hard-deleted

**Hard Delete**:
The operation that physically removes a user account record.
_Avoid_: User account status

## Flagged ambiguities

- "user" was used to mean both logged-in people and generated-site viewers — resolved: **User** means logged-in Nuvasite person, while **Visitor** means generated-site viewer.
