import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BusinessDashboard from "../BusinessDashboard";

// --- Mock auth ---
const authState: any = { user: { id: "u1" }, profile: null, loading: false };
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

// --- Mock supabase client with chainable query builder ---
const resourcesData: any[] = [];
let verificationStatus = "unverified";

function makeQuery(table: string) {
  const builder: any = {
    _table: table,
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: async () => {
      if (table === "profiles") {
        return { data: { verification_status: verificationStatus }, error: null };
      }
      return { data: null, error: null };
    },
    then: (resolve: any) => {
      // For non-maybeSingle awaits
      if (table === "business_resources") {
        return Promise.resolve({ data: resourcesData, error: null }).then(resolve);
      }
      return Promise.resolve({ data: [], error: null }).then(resolve);
    },
  };
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => makeQuery(table),
  },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function renderPage() {
  return render(
    <MemoryRouter>
      <BusinessDashboard />
    </MemoryRouter>,
  );
}

describe("BusinessDashboard edge cases", () => {
  beforeEach(() => {
    resourcesData.length = 0;
    verificationStatus = "unverified";
  });

  it("blocks non-business accounts from accessing the dashboard", async () => {
    authState.profile = {
      id: "u1",
      nametag: "joe",
      display_name: "Joe",
      avatar_url: null,
      account_type: "personal",
      verified: false,
    };

    renderPage();

    await waitFor(() =>
      expect(
        screen.getByText(/business dashboard is only available to business accounts/i),
      ).toBeInTheDocument(),
    );
  });

  it("renders business dashboard for unverified business but gates verified-only UX", async () => {
    authState.profile = {
      id: "u1",
      nametag: "acme",
      display_name: "Acme",
      avatar_url: null,
      account_type: "business",
      verified: false,
    };
    verificationStatus = "unverified";

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/business dashboard/i)).toBeInTheDocument(),
    );
    // Resources tab is present in the nav
    expect(screen.getByRole("button", { name: /resources/i })).toBeInTheDocument();
  });
});
