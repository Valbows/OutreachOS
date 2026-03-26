import {
  AnalyticsService,
  CampaignService,
  ContactService,
  EnrichmentService,
  ExperimentService,
  FormService,
  InboxService,
  LLMService,
  TemplateService,
} from "./index";
import { describe, expect, it } from "vitest";

describe("@outreachos/services barrel exports", () => {
  it("exports all service classes", () => {
    const services = [
      ContactService,
      CampaignService,
      EnrichmentService,
      TemplateService,
      ExperimentService,
      AnalyticsService,
      InboxService,
      FormService,
      LLMService,
    ];

    services.forEach((Service) => {
      expect(Service).toBeDefined();
      expect(typeof Service).toBe("function");
    });
  });

  it("exports ContactService CSV utility methods", () => {
    expect(typeof ContactService.parseCSV).toBe("function");
    expect(typeof ContactService.parseCSVLine).toBe("function");
    expect(typeof ContactService.escapeCSV).toBe("function");
  });

  it("exports EnrichmentService with static methods", () => {
    expect(typeof EnrichmentService.extractDomain).toBe("function");
    expect(typeof EnrichmentService.delay).toBe("function");
  });

  it("instantiates ContactService", () => {
    expect(new ContactService()).toBeInstanceOf(ContactService);
  });
});
