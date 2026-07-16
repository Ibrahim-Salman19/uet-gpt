# Testing Convex Actions

## Why `_handler` is an Anti-Pattern

Convex functions (`query`, `mutation`, `action`) wrap your implementation in an internal object. Accessing the private `_handler` property is fragile - it depends on Convex internals that could change between versions.

```ts
// ❌ ANTI-PATTERN - fragile, relies on private internals
const result = await (myAction as unknown as {
  _handler: (ctx: MockCtx, args: MyArgs) => Promise<MyResult>;
})._handler(mockCtx, args);
```

## The Proper Approach

Mock the `convex/_generated/server` module so that `query()`, `mutation()`, and `action()` unwrap the handler into a predictable shape:

```ts
// vi.mock must be at the top level, before any other imports
vi.mock("../../convex/_generated/server", () => ({
  query: (opts: { handler: Function }) => ({ handler: opts.handler }),
  mutation: (opts: { handler: Function }) => ({ handler: opts.handler }),
  action: (opts: { handler: Function }) => ({ handler: opts.handler }),
}));
```

Then call the exported function's `.handler` property directly:

```ts
import { myAction } from "../../convex/myModule";

const result = await (myAction as unknown as {
  handler: (ctx: MockCtx, args: MyArgs) => Promise<MyResult>;
}).handler(mockCtx, args);
```

## Creating Mock Contexts

For simple actions/queries that only use `runQuery`/`runAction`/`runMutation`, use the helper:

```ts
import { createMockConvexCtx } from "../helpers/convex-mock";

const ctx = createMockConvexCtx();
ctx.runQuery.mockResolvedValue(someData);
```

For mutations/queries that use `auth` and `db`, build a richer mock:

```ts
type MockMutationCtx = {
  auth: { getUserIdentity: ReturnType<typeof vi.fn> };
  db: {
    insert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
};
```

See `tests/unit/admin-stats.test.ts` for a comprehensive example with DB chain mocking.

## Integration Tests (Real Convex Backend)

For integration tests that hit a real Convex deployment, use `ConvexHttpClient`:

```ts
import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient(process.env.CONVEX_SITE_URL!);
const result = await client.query(api.myModule.myQuery, { arg: "value" });
```

See `tests/integration/` for examples.
