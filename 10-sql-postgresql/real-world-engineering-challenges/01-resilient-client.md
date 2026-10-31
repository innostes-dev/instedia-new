# Challenge 1: Resilient Client Schema Architecture

## Objective
Design a robust database schema for a multi-tenant SaaS application managing users and their profiles, ensuring strict data integrity and optimal indexing for common queries.

## Problem Statement
You are tasked with replacing a legacy flat-file system for a growing SaaS product. The system needs to track `organizations`, `users` belonging to those organizations, and `user_profiles`.

**Requirements:**
1.  **Strict Typing & Constraints:** No invalid emails, no negative ages, and proper relationships.
2.  **Concurrency Preparation:** Use UUIDs to allow client-side ID generation and prevent predictability.
3.  **Cascading Deletes:** If an organization is deleted, all its users and their profiles must be cleanly wiped out.
4.  **Performance:** Searching for a user by email must be instant.

## Architecture Diagram (Mental Model)
```text
[ Organization ] 1 --- N [ User ] 1 --- 1 [ User Profile ]
(UUID, Name)             (UUID, Org_ID,   (User_ID, Bio, Age)
                          Email)
```

## Challenge Instructions
Write the full SQL script to generate this schema.

1.  Create the `organizations` table.
2.  Create the `users` table with a foreign key to `organizations`. Ensure emails are unique globally.
3.  Create the `user_profiles` table with a foreign key directly to `users`. Ensure `age` is always >= 18.
4.  Add an index to make email lookups blisteringly fast.

<details>
<summary>Principal Engineer Solution & Walkthrough</summary>

### The Complete Solution

```sql
-- 1. Organizations Table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. User Profiles Table (1-to-1 relationship with Users)
CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    age INT CHECK (age >= 18),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Indexing for Performance
-- Note: 'email' is already indexed automatically because it is marked UNIQUE.
-- However, we frequently query users by organization, so we index the foreign key.
CREATE INDEX idx_users_organization_id ON users(organization_id);
```

### Walkthrough & Architecture Notes
-   **UUIDs over SERIAL:** By using `UUID` everywhere, a disconnected mobile client can generate an ID, create a complex nested payload of Org -> User -> Profile, and send it to the server in one go without waiting for database sequence numbers.
-   **1-to-1 Enforcement:** In `user_profiles`, notice how `user_id` is both the `PRIMARY KEY` and the `FOREIGN KEY`. This mathematically guarantees that one user can only ever have exactly one profile.
-   **ON DELETE CASCADE:** This handles our cleanup requirement. Deleting an org deletes the users, and deleting those users automatically triggers the deletion of their profiles. No orphaned rows.
-   **The Hidden Index:** A common Principal-level interview trick. The requirement asked for an index on `email`. However, declaring a column `UNIQUE` in PostgreSQL *automatically* creates a unique B-Tree index on it under the hood. The *real* performance bottleneck in multi-tenant systems is fetching all users for a specific tenant. Therefore, the Pro Move is adding `idx_users_organization_id`.
</details>

## Starter Template

```sql
-- Create your tables here
-- organizations

-- users

-- user_profiles

-- indexes

```

## Test Suite

```sql
-- Test 1: Valid Insertions
INSERT INTO organizations (name) VALUES ('Acme Corp');
-- Verify that a UUID was automatically generated.
SELECT * FROM organizations WHERE name = 'Acme Corp';

-- Test 2: Cascading Deletes
-- Create a user and profile for Acme Corp.
-- Delete Acme Corp.
-- Verify that the user and profile are also deleted.

-- Test 3: Constraint Checks
-- Attempt to create a user profile with age = 17. Ensure it throws an error.
-- Attempt to create two users with the same email. Ensure it throws an error.
```
