-- User Account email addresses are global account identities and must stay in
-- their normalized lowercase form even when written outside the application
-- signup paths.
ALTER TABLE "user_account"
  ADD CONSTRAINT "user_account_email_lowercase_check"
  CHECK ("email" = lower("email"));
