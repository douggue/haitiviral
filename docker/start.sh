#!/bin/sh
# Update the database tables to this version, then start the site.
set -e
export DATABASE_URL_UNPOOLED="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}"
node migrate/node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma
exec node server.js
