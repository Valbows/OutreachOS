import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ id: "test-id" }),
}));

// Mock Modal component (HTML dialog not fully supported in jsdom)
vi.mock("@/components/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui")>();
  return {
    ...actual,
    Modal: ({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) => {
      if (!open) return null;
      return (
        <div role="dialog" aria-modal="true">
          {title && <h2>{title}</h2>}
          {children}
        </div>
      );
    },
  };
});

// Mock TanStack Query hooks
const mockUseContacts = vi.fn();
const mockUseContactGroups = vi.fn();
const mockUseDeleteContacts = vi.fn();
const mockUseContact = vi.fn();
const mockUseContactAnalytics = vi.fn();
const mockUseReEnrichContact = vi.fn();
const mockUseUpdateCustomField = vi.fn();
const mockUseDeleteCustomField = vi.fn();
const mockUseAddToGroup = vi.fn();
const mockUseRemoveFromGroup = vi.fn();
const mockUseCreateGroup = vi.fn();
const mockUseDeleteGroup = vi.fn();
const mockUseUpdateGroup = vi.fn();

vi.mock("@/lib/hooks/use-contacts", () => ({
  useContacts: (...args: unknown[]) => mockUseContacts(...args),
  useContactGroups: () => mockUseContactGroups(),
  useDeleteContacts: () => mockUseDeleteContacts(),
  useContact: (id: string) => mockUseContact(id),
  useContactAnalytics: () => mockUseContactAnalytics(),
  useReEnrichContact: () => mockUseReEnrichContact(),
  useUpdateCustomField: () => mockUseUpdateCustomField(),
  useDeleteCustomField: () => mockUseDeleteCustomField(),
  useAddToGroup: () => mockUseAddToGroup(),
  useRemoveFromGroup: () => mockUseRemoveFromGroup(),
  useCreateGroup: () => mockUseCreateGroup(),
  useDeleteGroup: () => mockUseDeleteGroup(),
  useUpdateGroup: () => mockUseUpdateGroup(),
  contactKeys: {
    all: ["contacts"],
    lists: () => ["contacts", "list"],
    list: (p: unknown) => ["contacts", "list", p],
    details: () => ["contacts", "detail"],
    detail: (id: string) => ["contacts", "detail", id],
    groups: () => ["contacts", "groups"],
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseContacts.mockReturnValue({ data: undefined, isLoading: false });
  mockUseContactGroups.mockReturnValue({ data: [] });
  mockUseDeleteContacts.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mockUseContact.mockReturnValue({ data: null, isLoading: false });
  mockUseContactAnalytics.mockReturnValue({ data: null, isLoading: false });
  mockUseReEnrichContact.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mockUseUpdateCustomField.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mockUseDeleteCustomField.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mockUseAddToGroup.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mockUseRemoveFromGroup.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mockUseCreateGroup.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mockUseDeleteGroup.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mockUseUpdateGroup.mockReturnValue({ mutate: vi.fn(), isPending: false });
});

describe("ContactsPage (List)", () => {
  async function renderList() {
    const mod = await import("./page");
    return render(<mod.default />);
  }

  it("renders the page header", async () => {
    await renderList();
    expect(screen.getByText("Contacts")).toBeInTheDocument();
    expect(screen.getByText("Intelligence Database Management")).toBeInTheDocument();
  });

  it("shows empty state when no contacts", async () => {
    await renderList();
    expect(screen.getByText("No contacts yet")).toBeInTheDocument();
    expect(screen.getByText("Upload Contacts")).toBeInTheDocument();
  });

  it("shows loading spinner when fetching", async () => {
    mockUseContacts.mockReturnValue({ data: undefined, isLoading: true });
    await renderList();
    expect(screen.queryByText("No contacts yet")).not.toBeInTheDocument();
    // Verify loading spinner is rendered (animate-spin class indicates loading state)
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows contact count when contacts exist", async () => {
    mockUseContacts.mockReturnValue({
      data: {
        data: [
          {
            id: "1",
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
            companyName: "Acme",
            businessWebsite: null,
            city: "New York",
            state: "NY",
            hunterScore: 90,
            hunterStatus: "valid",
            linkedinUrl: null,
            enrichedAt: "2024-01-01",
            unsubscribed: false,
            replied: false,
            createdAt: "2024-01-01",
          },
        ],
        total: 1,
      },
      isLoading: false,
    });

    await renderList();
    expect(screen.getByText("(1 total)")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("john@example.com")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("navigates to upload page when Upload button clicked", async () => {
    const user = userEvent.setup();
    await renderList();
    // Use getAllByRole since there are multiple buttons with "upload" in their name
    const uploadButtons = screen.getAllByRole("button", { name: /upload/i });
    await user.click(uploadButtons[0]);
    expect(mockPush).toHaveBeenCalledWith("/contacts/upload");
  });

  it("renders search input", async () => {
    await renderList();
    expect(screen.getByPlaceholderText("Search contacts...")).toBeInTheDocument();
  });

  it("renders groups sidebar section", async () => {
    await renderList();
    expect(screen.getByText("Groups")).toBeInTheDocument();
    expect(screen.getByText("All Contacts")).toBeInTheDocument();
  });
});

describe("UploadContactsPage", () => {
  async function renderUpload() {
    const mod = await import("./upload/page");
    return render(<mod.default />);
  }

  it("renders the upload page header", async () => {
    await renderUpload();
    expect(screen.getByText("Upload Contacts")).toBeInTheDocument();
    expect(screen.getByText(/Feed the intelligence engine/)).toBeInTheDocument();
  });

  it("renders the drag and drop zone", async () => {
    await renderUpload();
    expect(screen.getByText("Drag & drop your file here")).toBeInTheDocument();
    expect(screen.getByText(/Supports .csv, .xlsx, .xls/)).toBeInTheDocument();
  });

  it("renders required columns section", async () => {
    await renderUpload();
    expect(screen.getByText("Required Columns")).toBeInTheDocument();
    expect(screen.getByText("First Name")).toBeInTheDocument();
    expect(screen.getByText("Last Name")).toBeInTheDocument();
    expect(screen.getByText("Business Website")).toBeInTheDocument();
    expect(screen.getByText("Company Name")).toBeInTheDocument();
  });

  it("renders the feature cards", async () => {
    await renderUpload();
    expect(screen.getByText("CSV Template")).toBeInTheDocument();
    expect(screen.getByText("Zapier Connection")).toBeInTheDocument();
    expect(screen.getByText("AI Auto-Mapping")).toBeInTheDocument();
  });

  it("has accessible drop zone with role and label", async () => {
    await renderUpload();
    const dropZone = screen.getByRole("button", {
      name: /upload file drop zone/i,
    });
    expect(dropZone).toBeInTheDocument();
  });
});

describe("EnrichContactsPage", () => {
  async function renderEnrich() {
    const mod = await import("./enrich/page");
    return render(<mod.default />);
  }

  it("renders the enrichment page header", async () => {
    await renderEnrich();
    expect(screen.getByText("Find & Verify Emails")).toBeInTheDocument();
    expect(screen.getByText(/Leverage Hunter.io/)).toBeInTheDocument();
  });

  it("renders enrichment configuration", async () => {
    await renderEnrich();
    expect(screen.getByText("Enrichment Configuration")).toBeInTheDocument();
    expect(screen.getByText("Confidence Threshold")).toBeInTheDocument();
  });

  it("renders toggle switches", async () => {
    await renderEnrich();
    expect(screen.getByText("Retrieve LinkedIn URLs")).toBeInTheDocument();
    expect(screen.getByText("Use my Hunter.io key")).toBeInTheDocument();
  });

  it("renders action buttons", async () => {
    await renderEnrich();
    expect(screen.getByText("Skip Enrichment")).toBeInTheDocument();
    expect(screen.getByText("Start Enrichment")).toBeInTheDocument();
  });
});

describe("ContactDetailPage", () => {
  async function renderDetail() {
    const mod = await import("./[id]/page");
    return render(<mod.default />);
  }

  it("renders 'not found' when contact is null", async () => {
    await renderDetail();
    expect(screen.getByText("Contact not found")).toBeInTheDocument();
    expect(screen.getByText("test-id")).toBeInTheDocument();
  });

  it("shows loading spinner when fetching", async () => {
    mockUseContact.mockReturnValue({ data: null, isLoading: true });
    await renderDetail();
    expect(screen.queryByText("Contact not found")).not.toBeInTheDocument();
    // Verify loading spinner is rendered (animate-spin class indicates loading state)
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders contact details when loaded", async () => {
    mockUseContact.mockReturnValue({
      data: {
        id: "test-id",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
        companyName: "TestCorp",
        businessWebsite: "https://testcorp.com",
        city: null,
        state: null,
        linkedinUrl: "https://linkedin.com/in/janesmith",
        hunterScore: 95,
        hunterStatus: "valid",
        hunterSources: [],
        enrichedAt: "2024-06-01T00:00:00.000Z",
        unsubscribed: false,
        replied: false,
        repliedAt: null,
        customFields: null,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-06-01T00:00:00.000Z",
      },
      isLoading: false,
    });
    mockUseContactAnalytics.mockReturnValue({
      data: {
        emailsSent: 10,
        totalOpens: 5,
        uniqueOpens: 3,
        replies: 1,
        softBounces: 0,
        hardBounces: 0,
        complaints: 0,
        unsubscribes: 0,
        hourlyOpens: Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 })),
        dailyOpens: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => ({ day: d, count: 0 })),
        messages: [],
        activeJourneys: [],
        replyHistory: [],
      },
      isLoading: false,
    });

    await renderDetail();
    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("TestCorp")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByText("LinkedIn")).toBeInTheDocument();
    expect(screen.getByText("Website")).toBeInTheDocument();
    expect(screen.getByText("Hunter Intelligence")).toBeInTheDocument();
  });

  it("renders back link when contact not found", async () => {
    await renderDetail();
    expect(screen.getByText("← Back to Contacts")).toBeInTheDocument();
  });
});
