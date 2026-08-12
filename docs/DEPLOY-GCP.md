GCP deployment checklist (Database)

1) Create a Cloud SQL (Postgres) instance
   - gcloud sql instances create pluspuls-db --database-version=POSTGRES_15 --region=us-central1 --cpu=1 --memory=3840MiB
   - Note: choose region and machine type appropriate for your workload

2) Create database and user
   - gcloud sql databases create pluspuls --instance=pluspuls-db
   - gcloud sql users create appuser --instance=pluspuls-db --password="<strong_password>"

3) Get connection string
   - Use Cloud SQL Auth Proxy in compute (or set up private IP)
   - Or get connection string: postgres://appuser:<password>@<PUBLIC_IP>:5432/pluspuls
   - Prefer using Secret Manager to store credentials and set DATABASE_URL in your deployment environment

4) Run migrations
   - Locally, set DATABASE_URL, then:
     npm run db:push
   - On CI, ensure env var is set and run the same command as part of deploy

5) Seed data (optional)
   - With DATABASE_URL set, start the server and it will run seedDatabase() if DB empty
   - Or run a SQL script: psql $DATABASE_URL -f migrations/0001_init.sql

6) Permissions and maintenance
   - Enable automated backups and high availability on Cloud SQL for production
   - Rotate credentials and store in Secret Manager

7) Notes
   - .replit and any Replit-specific configs have been removed from repo. The migrations and schema are generic Postgres and ready for Cloud SQL.
   - The app will run without DATABASE_URL locally for quick dev, but DB-backed features will be disabled until a proper DATABASE_URL is provided.
