-- Staff roles (3.6). ADD VALUE is metadata-only; existing rows keep their role.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPPORT';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BILLING';
