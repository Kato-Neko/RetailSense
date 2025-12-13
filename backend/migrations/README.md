# Database Migrations

This directory contains database migration scripts.
To apply a migration, run the following command:

```bash
# Connect to your PostgreSQL database and run:
psql -h <host> -U <user> -d <database> -f <migration_file>.sql
```
