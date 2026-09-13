# Common Tasks Guide

Quick reference for everyday tasks in the RallyHub monorepo.

## Shared Types & Models

### Add a new shared type/model

1. Create a file in `packages/shared/src/models/` (e.g., `post.ts`):

```typescript
// packages/shared/src/models/post.ts
export type Post = {
  id: string
  title: string
  content: string
  authorId: string
  createdAt: Date
}

export type CreatePostRequest = {
  title: string
  content: string
}

export type CreatePostResponse = {
  success: boolean
  data: Post
}
```

2. Re-export from `packages/shared/src/models/index.ts`:

```typescript
export * from "./post"
export * from "./user"
```

3. Use in both frontend and backend:

```typescript
// In apps/web or apps/api
import type { Post, CreatePostResponse } from "@workspace/shared"
```

**Rule:** Type-only exports (no runtime code). Both apps use the same types.

---

## Frontend Development

### Add a new UI component

If a shadcn component doesn't exist locally, check the shadcn registry first, then run:

```bash
npx shadcn@latest add <name> -c apps/web
```

Then import:

```typescript
import { Button } from "@workspace/ui/components/button"
```

### Create a new form

Use React Hook Form + Zod pattern:

1. Define validation in `apps/web/lib/validations/post.ts`:

```typescript
import { z } from "zod"

export const createPostSchema = z.object({
  title: z.string().min(1, "Title required"),
  content: z.string().min(10, "Content too short"),
})

export type CreatePostInput = z.infer<typeof createPostSchema>
```

2. Use in component:

```typescript
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createPostSchema } from "@/lib/validations/post"

export function CreatePostForm() {
  const form = useForm({
    resolver: zodResolver(createPostSchema),
  })
  // ...
}
```

### Fetch data from API

Use TanStack Query hooks in `apps/web/hooks/`:

```typescript
// apps/web/hooks/usePosts.ts
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"

export function usePosts() {
  return useQuery({
    queryKey: ["posts"],
    queryFn: () => api.get("/posts"),
  })
}
```

Use in component:

```typescript
function PostsList() {
  const { data, isPending, isError } = usePosts()

  if (isPending) return <div>Loading...</div>
  if (isError) return <div>Error loading posts</div>

  return (
    <div>
      {data?.map(post => <PostCard key={post.id} post={post} />)}
    </div>
  )
}
```

### Style a component

Use shadcn theme tokens and `cn()` utility:

```typescript
import { cn } from "@workspace/ui/lib/utils"

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        className
      )}
      {...props}
    />
  )
}
```

Prefer theme tokens (`bg-card`, `text-muted-foreground`) over arbitrary colors.

---

## Backend Development

### Create a new feature module

Structure: `apps/api/src/feature/`

```
apps/api/src/posts/
├── posts.controller.ts
├── posts.service.ts
├── posts.module.ts
└── dto/
    ├── create-post.dto.ts
    └── post.response.dto.ts
```

1. **DTO** (data transfer object):

```typescript
// apps/api/src/posts/dto/create-post.dto.ts
export class CreatePostDto {
  title: string
  content: string
  authorId: string
}
```

2. **Service** (business logic):

```typescript
// apps/api/src/posts/posts.service.ts
import { Injectable } from "@nestjs/common"
import { PrismaService } from "@/prisma/prisma.service"

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePostDto) {
    return this.prisma.post.create({
      data: dto,
    })
  }

  async findAll() {
    return this.prisma.post.findMany()
  }
}
```

3. **Controller** (HTTP endpoints):

```typescript
// apps/api/src/posts/posts.controller.ts
import { Controller, Get, Post, Body } from "@nestjs/common"
import { PostsService } from "./posts.service"
import { CreatePostDto } from "./dto/create-post.dto"

@Controller("posts")
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  async findAll() {
    return this.postsService.findAll()
  }

  @Post()
  async create(@Body() dto: CreatePostDto) {
    return this.postsService.create(dto)
  }
}
```

4. **Module** (wiring):

```typescript
// apps/api/src/posts/posts.module.ts
import { Module } from "@nestjs/common"
import { PostsService } from "./posts.service"
import { PostsController } from "./posts.controller"

@Module({
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
```

### Use Prisma

Query data with the Prisma client:

```typescript
// In a service
constructor(private prisma: PrismaService) {}

async getUserWithPosts(userId: string) {
  return this.prisma.user.findUnique({
    where: { id: userId },
    include: { posts: true },
  })
}
```

### Run tests

```bash
# Run all API tests
npm run test -w api

# Run a specific test file
npm run test -w api -- posts.service.spec.ts

# Watch mode
npm run test -w api -- --watch
```

---

## Database

### Modify a database model (schema changes)

When you change `apps/api/prisma/schema.prisma`, follow this sequence:

1. **Edit the schema** (e.g., add a field to a model):

```prisma
// apps/api/prisma/schema.prisma
model Post {
  id        String   @id @default(cuid())
  title     String
  content   String
  authorId  String
  published Boolean  @default(false)  // NEW FIELD
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

2. **Create a migration** (generates SQL file):

```bash
npx prisma migrate dev --name add_published_to_post
```

This command:
- Creates a new migration file in `apps/api/prisma/migrations/`
- Applies it to your local database
- Regenerates the Prisma client

3. **Regenerate Prisma client** (if needed):

```bash
npm run db:generate
```

This updates the TypeScript types in `apps/api/src/generated/`.

4. **Test locally** before pushing:

```bash
npm run dev -w api
```

### Remove a field

```prisma
// Remove or comment out the field in schema.prisma
model Post {
  id        String   @id @default(cuid())
  title     String
  content   String
  authorId  String
  // published Boolean removed
  createdAt DateTime @default(now())
}
```

Then create a migration:

```bash
npx prisma migrate dev --name remove_published_from_post
```

### Rename a model or field

```prisma
// Old:
model BlogPost {
  id String @id
}

// New:
model Post {
  id String @id @map("blog_post_id")  // Maps to old column name
}
```

Create a migration:

```bash
npx prisma migrate dev --name rename_blog_post_to_post
```

### Add a new model

```prisma
// apps/api/prisma/schema.prisma
model Comment {
  id        String   @id @default(cuid())
  content   String
  postId    String
  post      Post     @relation(fields: [postId], references: [id])
  createdAt DateTime @default(now())
}
```

Then:

```bash
npx prisma migrate dev --name add_comment_model
```

### Generate Prisma client

After updating `schema.prisma`:

```bash
npm run db:generate
```

### Seed the database

```bash
npm run db:seed
```

### View database in Prisma Studio

```bash
npx prisma studio
```

Opens browser UI to inspect/edit data directly.

---

## Running the App

### Start dev servers

```bash
# All workspaces (frontend + backend)
npm run dev

# Frontend only
npm run dev -w web

# Backend only
npm run dev -w api
```

### Docker (all services)

```bash
docker compose up --build
```

Then:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Postgres: localhost:5433

### Type checking

```bash
# Check web
npm run typecheck -w web

# Check api
npm run typecheck -w api

# Check everything
npm run typecheck
```

### Linting & formatting

```bash
# Lint all
npm run lint

# Format all
npm run format

# Prettier write
npm run prettier
```

---

## Importing from Packages

### @workspace/shared (types)

```typescript
import type { User, Post } from "@workspace/shared"
```

### @workspace/ui (components)

```typescript
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { useMobile } from "@workspace/ui/hooks/use-mobile"
import "@workspace/ui/globals.css"
```

### Config packages

```javascript
// eslintrc.js
import { nextJsConfig } from "@workspace/eslint-config/next-js"

// tsconfig.json
{
  "extends": "@workspace/typescript-config/base.json"
}
```

---

## Environment Variables

### Template files

- Root: `.env.example`
- Frontend: `apps/web/.env.example`
- Backend: `apps/api/.env.example`

### Local files (don't commit)

- Frontend: `apps/web/.env.local`
- Backend: `apps/api/.env`
- Root: `.env`

### Updating env vars

1. Add to `.env.example` (or app-specific `*.example`)
2. Set in local file (`.env.local` or `.env`)
3. Restart dev server

**Frontend vars must be `NEXT_PUBLIC_`-prefixed** to be exposed to the browser.

---

## Install Dependencies

```bash
# In a specific workspace
npm install <pkg> -w web
npm install <pkg> -w api
npm install <pkg> -w @workspace/ui
npm install <pkg> -w @workspace/shared

# Root-level tool (dev dependency)
npm install -D <pkg>
```

Do not run `npm install` without a workspace flag—always specify which app/package.

---

## Useful Rules

✅ **Do**
- Keep types in `@workspace/shared`
- Use TanStack Query for frontend data fetching
- Organize backend features by domain (one module per feature)
- Import from packages using subpath exports (`@workspace/ui/components/button`)
- Use theme tokens for styling

❌ **Don't**
- Duplicate types between `apps/web` and `apps/api`
- Put runtime code in `packages/shared`
- Import entire packages (e.g., `import * from "@workspace/ui"`)
- Create nested lockfiles (install from root)
- Commit `.env`, `.env.local`, or sensitive files
