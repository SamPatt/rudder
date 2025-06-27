# Rudder Scripts

This directory contains utility scripts for the Rudder application.

## Files

### `seed-data-template.ts`
Template file for generating seed data. Contains sample values, goals, and tasks that can be used to populate a new database.

**Usage:**
```typescript
import { generateSQL } from './seed-data-template';
const sql = generateSQL('your-user-id-here');
console.log(sql);
```

### `new-schema.sql`
The current database schema for the unified tasks model. This creates the three main tables:
- `values` - Core life principles
- `goals` - Specific objectives aligned with values  
- `tasks` - Unified task model (includes both regular tasks and scheduled time blocks)

### `generate-icons.js`
Utility script for generating PWA icons in various sizes.

### `build-test.sh`
Build and test script for the application.

## Database Schema

The current schema uses a unified approach with three main tables:

1. **values** - User's core life principles
2. **goals** - Specific objectives linked to values
3. **tasks** - Unified task model that handles both regular tasks and scheduled time blocks

This simplified approach eliminates the complexity of separate tables for time blocks, completions, and recurring tasks while maintaining all functionality.

## Migration

To set up a fresh database:

1. Run `new-schema.sql` to create the tables
2. Use `seed-data-template.ts` to generate sample data
3. Insert the generated SQL to populate with sample data 