# Users Data Structure
This document is used describe the data structure and relations related to user accounts and associations with other pieces of the system and other data entities.

## Definitions
- User : The general terms used for anyone using the site. Depending on the context being used, this could refer to a person viewing a generated website, a person creating their own website, or any other person.

- User account : A user account, which could also be referred to as simply an account, describes any and all information associated with a user. This includes information like email address, name, websites created, websites to which they have editing access to, etc.

- User profile: Term used to describe basic personal information about a user such as name and email. This is a generalized term for the subset of a user account and the personal information.

## Authentication Methods
Authentication early on uses OAuth to create and log into an account. Accounts can either sign in via Google using OAuth or creating an account in Nuvasite with an email address and password.

## Database Structure

### User
**Table Name:** user

**Structure:**

user_id    | integer | unsigned | auto_increment | primary key
email      | string  | not null | index
first_name | string | default null 
last_name  | string | default null


### User Auth Provider
**Table Name:** user_auth_provider

**Structure:**

user_id | integer | unsigned | foreign key references user.user_id
auth_provider | enum(google) | not null
auth_provider_id | string | not null
