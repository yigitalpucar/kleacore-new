#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
  ./node_modules/.bin/prisma migrate deploy || {
    echo "Prisma migrate deploy failed — starting app anyway"
  }
fi

exec node server.js