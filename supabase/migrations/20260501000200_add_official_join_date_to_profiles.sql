/*
  # Add official join date to profiles

  Account creation date is not always the same as the date someone officially
  joined the worship team. This field stores that editable ministry date.
*/

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS official_join_date date;

