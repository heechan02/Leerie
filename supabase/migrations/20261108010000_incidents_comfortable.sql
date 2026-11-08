-- The app's Comfortable button sends category 'comfortable'. Safe to run whether or not the old check exists.
alter table incidents drop constraint if exists incidents_category_check;
alter table incidents add constraint incidents_category_check
  check (category in ('comfortable', 'dark', 'followed', 'harassment', 'other'));
