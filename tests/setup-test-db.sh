#!/bin/bash
set -e

service postgresql start

until pg_isready -U postgres; do
  echo "Waiting for postgres..."
  sleep 1
done

su - postgres -c "psql -c \"CREATE USER testuser WITH PASSWORD 'testpass';\""
su - postgres -c "psql -c \"CREATE DATABASE testdb OWNER testuser;\""
su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE testdb TO testuser;\""

export DATABASE_URL="postgresql://testuser:testpass@localhost:5432/testdb?schema=public"
export NODE_ENV=test
export JWT_SECRET=test-jwt-secret-for-ci-only-32chars
export JWT_EXPIRATION=7d
export RESEND_API_KEY=test-key
export RESEND_FROM_EMAIL=test@test.com
export WEBHOOK_SECRET_SALT=test-webhook-salt-32-chars-long!!
export THROTTLE_TTL=60
export THROTTLE_LIMIT=1000

npx prisma migrate deploy

npx jest --config ./tests/jest-e2e.json --forceExit --runInBand