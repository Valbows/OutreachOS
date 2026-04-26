import { createTableRelationsHelpers, getTableColumns, getTableName } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

// Mocks for @neondatabase/serverless (Neon WebSocket driver)
const neonPoolConstructorMock = vi.fn();
const wsMock = { name: "ws-mock" };
const neonConfigMock: { webSocketConstructor?: unknown } = {};
class NeonPoolMock {
  options: unknown;

  constructor(options: unknown) {
    this.options = options;
    neonPoolConstructorMock(options);
  }
}

// Mocks for pg (node-postgres TCP driver)
const pgPoolConstructorMock = vi.fn();
class PgPoolMock {
  options: unknown;

  constructor(options: unknown) {
    this.options = options;
    pgPoolConstructorMock(options);
  }
}

const drizzleNeonMock = vi.fn(
  ({ client, schema }: { client: unknown; schema: unknown }) => ({
    client,
    schema,
  }),
);

const drizzlePgMock = vi.fn(
  ({ client, schema }: { client: unknown; schema: unknown }) => ({
    client,
    schema,
  }),
);

vi.mock("@neondatabase/serverless", () => ({
  Pool: NeonPoolMock,
  neonConfig: neonConfigMock,
}));

vi.mock("drizzle-orm/neon-serverless", () => ({
  drizzle: drizzleNeonMock,
}));

vi.mock("pg", () => ({
  Pool: PgPoolMock,
}));

vi.mock("drizzle-orm/node-postgres", () => ({
  drizzle: drizzlePgMock,
}));

vi.mock("ws", () => ({
  default: wsMock,
}));

describe("@outreachos/db", () => {
  let dbModule: Awaited<typeof import("./index")>;
  let database: { client: unknown; schema: Record<string, unknown> };

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.DATABASE_URL =
      "postgres://outreachos:test@localhost:5432/outreachos";

    dbModule = await import("./index");
    database = dbModule.db as unknown as {
      client: unknown;
      schema: Record<string, unknown>;
    };
    // Trigger lazy db initialization so mocks are called before assertions
    void database.client;
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    if (ORIGINAL_DATABASE_URL === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
    }
  });

  it("creates pg Pool for localhost URLs (TCP driver)", () => {
    // localhost URL should use pg (node-postgres) driver
    expect(pgPoolConstructorMock).toHaveBeenCalledWith({
      connectionString: "postgres://outreachos:test@localhost:5432/outreachos",
    });
    expect(drizzlePgMock).toHaveBeenCalledTimes(1);
    expect(neonPoolConstructorMock).not.toHaveBeenCalled();
    expect(database.client).toBeInstanceOf(PgPoolMock);
    expect(database.schema.accounts).toBe(dbModule.accounts);
  });

  it("creates Neon Pool for non-localhost URLs (WebSocket driver)", async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Use a Neon hostname (not localhost/private IP)
    process.env.DATABASE_URL =
      "postgres://outreachos:test@ep-xyz.us-east-1.aws.neon.tech:5432/outreachos";

    const neonDbModule = await import("./index");
    const neonDatabase = neonDbModule.db as unknown as {
      client: unknown;
      schema: Record<string, unknown>;
    };
    // Trigger lazy db initialization
    void neonDatabase.client;

    expect(neonPoolConstructorMock).toHaveBeenCalledWith({
      connectionString: "postgres://outreachos:test@ep-xyz.us-east-1.aws.neon.tech:5432/outreachos",
    });
    expect(drizzleNeonMock).toHaveBeenCalledTimes(1);
    expect(pgPoolConstructorMock).not.toHaveBeenCalled();
    expect(neonConfigMock.webSocketConstructor).toBe(wsMock);
    expect(neonDatabase.client).toBeInstanceOf(NeonPoolMock);
  });

  it("exports all schema tables with correct table names", () => {
    expect(getTableName(dbModule.accounts)).toBe("accounts");
    expect(getTableName(dbModule.contacts)).toBe("contacts");
    expect(getTableName(dbModule.contactGroups)).toBe("contact_groups");
    expect(getTableName(dbModule.templates)).toBe("templates");
    expect(getTableName(dbModule.campaigns)).toBe("campaigns");
    expect(getTableName(dbModule.experiments)).toBe("experiments");
    expect(getTableName(dbModule.formTemplates)).toBe("form_templates");
    expect(getTableName(dbModule.linkedinPlaybooks)).toBe("linkedin_playbooks");
    expect(getTableName(dbModule.apiKeys)).toBe("api_keys");
    expect(getTableName(dbModule.blogPosts)).toBe("blog_posts");
  });

  it("exports all table columns", () => {
    expect(getTableColumns(dbModule.accounts).email).toBeDefined();
    expect(getTableColumns(dbModule.contacts).firstName).toBeDefined();
    expect(getTableColumns(dbModule.contactGroups).name).toBeDefined();
    expect(getTableColumns(dbModule.contactGroupMembers).contactId).toBeDefined();
    expect(getTableColumns(dbModule.templates).bodyHtml).toBeDefined();
    expect(getTableColumns(dbModule.campaigns).status).toBeDefined();
    expect(getTableColumns(dbModule.campaignSteps).stepNumber).toBeDefined();
    expect(getTableColumns(dbModule.messageInstances).status).toBeDefined();
    expect(getTableColumns(dbModule.emailEvents).eventType).toBeDefined();
    expect(getTableColumns(dbModule.replies).receivedAt).toBeDefined();
    expect(getTableColumns(dbModule.experiments).status).toBeDefined();
    expect(getTableColumns(dbModule.experimentBatches).winner).toBeDefined();
    expect(getTableColumns(dbModule.formTemplates).fields).toBeDefined();
    expect(getTableColumns(dbModule.formSubmissions).data).toBeDefined();
    expect(getTableColumns(dbModule.linkedinPlaybooks).prompt).toBeDefined();
    expect(getTableColumns(dbModule.llmUsageLog).model).toBeDefined();
    expect(getTableColumns(dbModule.apiKeys).keyHash).toBeDefined();
    expect(getTableColumns(dbModule.apiUsage).endpoint).toBeDefined();
    expect(getTableColumns(dbModule.blogPosts).slug).toBeDefined();
  });

  it("exports all relations", () => {
    expect(dbModule.contactsRelations).toBeDefined();
    expect(dbModule.contactGroupsRelations).toBeDefined();
    expect(dbModule.contactGroupMembersRelations).toBeDefined();
    expect(dbModule.campaignsRelations).toBeDefined();
    expect(dbModule.campaignStepsRelations).toBeDefined();
    expect(dbModule.messageInstancesRelations).toBeDefined();
    expect(dbModule.emailEventsRelations).toBeDefined();
    expect(dbModule.experimentsRelations).toBeDefined();
    expect(dbModule.experimentBatchesRelations).toBeDefined();
    expect(dbModule.formTemplatesRelations).toBeDefined();
    expect(dbModule.formSubmissionsRelations).toBeDefined();
    expect(dbModule.linkedinPlaybooksRelations).toBeDefined();
    expect(dbModule.llmUsageLogRelations).toBeDefined();
    expect(dbModule.apiKeysRelations).toBeDefined();
    expect(dbModule.apiUsageRelations).toBeDefined();
    expect(dbModule.blogPostsRelations).toBeDefined();
  });

  it("configures contacts relations correctly", () => {
    expect(
      Object.keys(
        dbModule.contactsRelations.config(
          createTableRelationsHelpers(dbModule.contacts),
        ),
      ),
    ).toEqual(["account", "groupMemberships"]);
    expect(
      Object.keys(
        dbModule.contactGroupsRelations.config(
          createTableRelationsHelpers(dbModule.contactGroups),
        ),
      ),
    ).toEqual(["account", "members"]);
    expect(
      Object.keys(
        dbModule.contactGroupMembersRelations.config(
          createTableRelationsHelpers(dbModule.contactGroupMembers),
        ),
      ),
    ).toEqual(["contact", "group"]);
  });

  it("configures campaigns relations correctly", () => {
    expect(
      Object.keys(
        dbModule.campaignsRelations.config(
          createTableRelationsHelpers(dbModule.campaigns),
        ),
      ),
    ).toEqual([
      "account",
      "template",
      "steps",
      "messages",
      "enrollments",
      "funnelConditions",
      "referencedInConditions",
    ]);
    expect(
      Object.keys(
        dbModule.campaignStepsRelations.config(
          createTableRelationsHelpers(dbModule.campaignSteps),
        ),
      ),
    ).toEqual(["campaign", "template"]);
    expect(
      Object.keys(
        dbModule.messageInstancesRelations.config(
          createTableRelationsHelpers(dbModule.messageInstances),
        ),
      ),
    ).toEqual(["campaign", "events"]);
    expect(
      Object.keys(
        dbModule.emailEventsRelations.config(
          createTableRelationsHelpers(dbModule.emailEvents),
        ),
      ),
    ).toEqual(["messageInstance"]);
  });

  it("configures experiments relations correctly", () => {
    expect(
      Object.keys(
        dbModule.experimentsRelations.config(
          createTableRelationsHelpers(dbModule.experiments),
        ),
      ),
    ).toEqual(["account", "campaign", "batches"]);
    expect(
      Object.keys(
        dbModule.experimentBatchesRelations.config(
          createTableRelationsHelpers(dbModule.experimentBatches),
        ),
      ),
    ).toEqual(["experiment"]);
  });

  it("configures forms relations correctly", () => {
    expect(
      Object.keys(
        dbModule.formTemplatesRelations.config(
          createTableRelationsHelpers(dbModule.formTemplates),
        ),
      ),
    ).toEqual(["account", "submissions"]);
    expect(
      Object.keys(
        dbModule.formSubmissionsRelations.config(
          createTableRelationsHelpers(dbModule.formSubmissions),
        ),
      ),
    ).toEqual(["form"]);
  });

  it("configures misc relations correctly", () => {
    expect(
      Object.keys(
        dbModule.linkedinPlaybooksRelations.config(
          createTableRelationsHelpers(dbModule.linkedinPlaybooks),
        ),
      ),
    ).toEqual(["account"]);
    expect(
      Object.keys(
        dbModule.llmUsageLogRelations.config(
          createTableRelationsHelpers(dbModule.llmUsageLog),
        ),
      ),
    ).toEqual(["account", "apiKey"]);
    expect(
      Object.keys(
        dbModule.apiKeysRelations.config(
          createTableRelationsHelpers(dbModule.apiKeys),
        ),
      ),
    ).toEqual(["account", "usage"]);
    expect(
      Object.keys(
        dbModule.apiUsageRelations.config(
          createTableRelationsHelpers(dbModule.apiUsage),
        ),
      ),
    ).toEqual(["apiKey"]);
    expect(
      Object.keys(
        dbModule.blogPostsRelations.config(
          createTableRelationsHelpers(dbModule.blogPosts),
        ),
      ),
    ).toEqual(["account"]);
  });
});
