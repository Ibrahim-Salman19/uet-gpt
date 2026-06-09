import * as React from "react";
import { vi } from "vitest";

export interface AdminMocksConfigOptions {
  pathname?: string;
  includeRouter?: boolean;
  withOptimisticUpdate?: boolean;
  useMockConvexCtx?: boolean;
  lucideIcons?: Record<string, string> | string[];
  mockSonner?: boolean;
}

const defaultIconTestId = (name: string): string =>
  `icon-${name.toLowerCase().replace(/[^a-z0-9]/g, "")}`;

export function buildAdminMocks(options: AdminMocksConfigOptions = {}) {
  const {
    pathname = "/admin",
    includeRouter = false,
    withOptimisticUpdate = false,
    useMockConvexCtx = false,
    lucideIcons = {},
    mockSonner = false,
  } = options;

  const mockConvex = { query: vi.fn() };

  const convexReactMock = useMockConvexCtx
    ? {
        useQuery: vi.fn((query: unknown, args: unknown) => {
          const val = mockConvex.query(query, args);
          if (val && typeof val.then === "function") return undefined;
          return val;
        }),
        useMutation: vi.fn(() =>
          Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }),
        ),
        useConvex: () => mockConvex,
      }
    : {
        useQuery: vi.fn(),
        useMutation: withOptimisticUpdate
          ? vi.fn(() => Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }))
          : vi.fn(),
        useConvex: vi.fn(),
        useAction: vi.fn(),
      };

  const navigationMock: Record<string, unknown> = {
    usePathname: vi.fn(() => pathname),
  };
  if (includeRouter) {
    navigationMock.useRouter = vi.fn(() => ({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    }));
  }

  const iconEntries: Record<string, string> = Array.isArray(lucideIcons)
    ? Object.fromEntries(lucideIcons.map((n) => [n, defaultIconTestId(n)]))
    : lucideIcons;
  const iconMocks: Record<string | symbol, any> = {};
  for (const [name, testid] of Object.entries(iconEntries)) {
    iconMocks[name] = () => <svg data-testid={testid} />;
  }
  const lucideMock = new Proxy(iconMocks, {
    get(target, prop: string | symbol) {
      if (typeof prop === "string") {
        if (prop in target) return target[prop];
        if (prop.charAt(0) >= "A" && prop.charAt(0) <= "Z") {
          return () => <svg data-testid={`icon-${prop.toLowerCase()}`} />;
        }
      }
      return Reflect.get(target, prop);
    },
    has(target, prop: string | symbol) {
      if (typeof prop === "string" && prop.charAt(0) >= "A" && prop.charAt(0) <= "Z") {
        return true;
      }
      return prop in target;
    },
    getOwnPropertyDescriptor(target, prop: string | symbol) {
      if (typeof prop === "string") {
        if (prop in target) {
          return Reflect.getOwnPropertyDescriptor(target, prop);
        }
        if (prop.charAt(0) >= "A" && prop.charAt(0) <= "Z") {
          return {
            value: () => <svg data-testid={`icon-${prop.toLowerCase()}`} />,
            writable: true,
            enumerable: true,
            configurable: true,
          };
        }
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  });

  const cardMock = {
    Card: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
      <div data-testid="card" className={className}>
        {children}
      </div>
    ),
    CardContent: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="card-content">{children}</div>
    ),
    CardHeader: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="card-header">{children}</div>
    ),
    CardTitle: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="card-title">{children}</div>
    ),
  };

  const buttonMock = {
    Button: ({
      children,
      onClick,
      variant,
      size,
      className,
    }: {
      children?: React.ReactNode;
      onClick?: () => void;
      variant?: string;
      size?: string;
      className?: string;
    }) => (
      <button
        data-testid="button"
        data-variant={variant}
        data-size={size}
        className={className}
        onClick={onClick}
      >
        {children}
      </button>
    ),
  };

  const skeletonMock = {
    Skeleton: (props: Record<string, unknown>) => (
      <div data-testid="skeleton" {...props} />
    ),
  };

  const sonnerMock = {
    toast: { success: vi.fn(), error: vi.fn() },
  };

  return {
    mockConvex,
    convexReactMock,
    navigationMock,
    lucideMock,
    cardMock,
    buttonMock,
    skeletonMock,
    sonnerMock: mockSonner ? sonnerMock : null,
  };
}
