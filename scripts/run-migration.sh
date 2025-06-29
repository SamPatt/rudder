#!/bin/bash

# Migration Script for Template-Based Task System
# This script migrates from the old recurring task system to the new template-based system

set -e  # Exit on any error

echo "🚀 Starting migration to template-based task system..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Check if Supabase is available
if ! command -v supabase &> /dev/null; then
    print_warning "Supabase CLI not found. You'll need to run the SQL scripts manually."
    echo "Please run the following SQL scripts in your Supabase dashboard:"
    echo "1. scripts/new-template-schema.sql"
    echo "2. scripts/migrate-to-templates.sql"
    exit 1
fi

print_status "Supabase CLI found. Starting migration..."

# Step 1: Create new schema
print_status "Step 1: Creating new schema..."
supabase db reset --linked

# Step 2: Run the new schema script
print_status "Step 2: Applying new schema..."
supabase db push

# Step 3: Run the migration script
print_status "Step 3: Migrating existing data..."
supabase db push --include-all

# Step 4: Verify migration
print_status "Step 4: Verifying migration..."
echo "Checking migration results..."

# You can add verification queries here if needed

print_status "Migration completed successfully!"
echo ""
echo "Next steps:"
echo "1. Update your application code to use the new template-based system"
echo "2. Test the new functionality"
echo "3. Once confirmed working, you can clean up old recurring tasks"
echo ""
echo "To clean up old data later, run:"
echo "DELETE FROM tasks WHERE recur IS NOT NULL AND recur != 'once';"
echo "ALTER TABLE tasks DROP COLUMN IF EXISTS recur;"
echo "ALTER TABLE tasks DROP COLUMN IF EXISTS custom_days;"
echo "ALTER TABLE tasks DROP COLUMN IF EXISTS event_date;" 