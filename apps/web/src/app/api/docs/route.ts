/**
 * OpenAPI 3.1 Documentation Endpoint
 * GET /api/docs — returns OpenAPI spec as JSON
 */

import { NextResponse } from "next/server";

const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "OutreachOS API",
    version: "1.0.0",
    description: "REST API for OutreachOS email automation platform. Mirrors all MCP tool functionality.",
    contact: {
      name: "OutreachOS Support",
      email: "support@outreachos.com",
    },
  },
  servers: [
    {
      url: "/api/v1",
      description: "Production API",
    },
  ],
  security: [
    {
      bearerAuth: [],
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "API Key",
        description: "API key obtained from the Developer dashboard. Format: osk_...",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          message: { type: "string" },
          details: { type: "object" },
        },
        required: ["error"],
      },
      Campaign: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          type: { type: "string", enum: ["one_time", "journey", "funnel", "ab_test", "newsletter"] },
          status: { type: "string", enum: ["draft", "active", "paused", "completed", "stopped"] },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Contact: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string", format: "email" },
          companyName: { type: "string" },
          linkedinUrl: { type: "string", format: "uri" },
          customFields: { type: "object" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Template: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          subject: { type: "string" },
          bodyHtml: { type: "string" },
          bodyText: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      LinkedInPlaybook: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          contactId: { type: "string", format: "uuid" },
          prompt: { type: "string" },
          generatedCopy: { type: "string" },
          status: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
    },
  },
  paths: {
    "/campaigns": {
      get: {
        summary: "List campaigns",
        tags: ["Campaigns"],
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["draft", "active", "paused", "completed", "stopped"] },
          },
        ],
        responses: {
          "200": {
            description: "List of campaigns",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    campaigns: { type: "array", items: { $ref: "#/components/schemas/Campaign" } },
                  },
                },
              },
            },
          },
          "401": { description: "Unauthorized" },
        },
      },
      post: {
        summary: "Create campaign",
        tags: ["Campaigns"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  type: { type: "string", enum: ["one_time", "journey", "funnel", "ab_test", "newsletter"] },
                  groupId: { type: "string", format: "uuid" },
                  templateId: { type: "string", format: "uuid" },
                },
                required: ["name"],
              },
            },
          },
        },
        responses: {
          "201": { description: "Campaign created" },
          "400": { description: "Invalid input" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/campaigns/{id}": {
      get: {
        summary: "Get campaign details",
        tags: ["Campaigns"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "Campaign details" },
          "404": { description: "Campaign not found" },
        },
      },
      patch: {
        summary: "Update campaign",
        tags: ["Campaigns"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  status: { type: "string", enum: ["draft", "active", "paused", "completed", "stopped"] },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Campaign updated" },
          "404": { description: "Campaign not found" },
        },
      },
      delete: {
        summary: "Delete campaign",
        tags: ["Campaigns"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "Campaign deleted" },
          "404": { description: "Campaign not found" },
        },
      },
    },
    "/contacts": {
      get: {
        summary: "List contacts",
        tags: ["Contacts"],
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 100 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "List of contacts",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    contacts: { type: "array", items: { $ref: "#/components/schemas/Contact" } },
                    total: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Create contact",
        tags: ["Contacts"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  firstName: { type: "string" },
                  lastName: { type: "string" },
                  email: { type: "string", format: "email" },
                  companyName: { type: "string" },
                  linkedinUrl: { type: "string", format: "uri" },
                  customFields: { type: "object" },
                },
                required: ["firstName", "lastName"],
              },
            },
          },
        },
        responses: {
          "201": { description: "Contact created" },
          "400": { description: "Invalid input" },
        },
      },
    },
    "/contacts/{id}": {
      get: {
        summary: "Get contact details",
        tags: ["Contacts"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "Contact details" },
          "404": { description: "Contact not found" },
        },
      },
      patch: {
        summary: "Update contact",
        tags: ["Contacts"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "Contact updated" },
          "404": { description: "Contact not found" },
        },
      },
      delete: {
        summary: "Delete contact",
        tags: ["Contacts"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "Contact deleted" },
          "404": { description: "Contact not found" },
        },
      },
    },
    "/contacts/groups": {
      get: {
        summary: "List contact groups",
        tags: ["Contacts"],
        responses: {
          "200": { description: "List of groups" },
        },
      },
      post: {
        summary: "Create contact group",
        tags: ["Contacts"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                },
                required: ["name"],
              },
            },
          },
        },
        responses: {
          "201": { description: "Group created" },
        },
      },
    },
    "/templates": {
      get: {
        summary: "List templates",
        tags: ["Templates"],
        responses: {
          "200": {
            description: "List of templates",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    templates: { type: "array", items: { $ref: "#/components/schemas/Template" } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Create template",
        tags: ["Templates"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  subject: { type: "string" },
                  bodyHtml: { type: "string" },
                  bodyText: { type: "string" },
                },
                required: ["name"],
              },
            },
          },
        },
        responses: {
          "201": { description: "Template created" },
        },
      },
    },
    "/linkedin": {
      get: {
        summary: "List LinkedIn playbook entries",
        tags: ["LinkedIn"],
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
          { name: "status", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "List of playbook entries",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    playbooks: { type: "array", items: { $ref: "#/components/schemas/LinkedInPlaybook" } },
                    total: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Generate LinkedIn copy",
        tags: ["LinkedIn"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  contactId: { type: "string", format: "uuid" },
                  groupId: { type: "string", format: "uuid" },
                  prompt: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "LinkedIn copy generated" },
          "400": { description: "Either contactId or groupId required" },
        },
      },
    },
  },
  tags: [
    { name: "Campaigns", description: "Campaign management" },
    { name: "Contacts", description: "Contact management" },
    { name: "Templates", description: "Email template management" },
    { name: "LinkedIn", description: "LinkedIn playbook management" },
  ],
};

export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
