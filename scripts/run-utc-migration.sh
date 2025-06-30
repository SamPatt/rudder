#!/bin/bash

# Script to run the UTC migration
# This converts time fields from TIME to TIMESTAMP WITH TIME ZONE

echo "Starting UTC migration..."

# Check if we have the required environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "Error: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables must be set"
    echo "Please set these variables and run the script again"
    exit 1
fi

echo "Running migration script..."
echo "This will convert all time fields to UTC timestamps"

# Run the migration SQL
psql "$SUPABASE_URL" -f scripts/migrate-to-utc.sql

echo "Migration completed!"
echo "Please test the application to ensure everything works correctly." 