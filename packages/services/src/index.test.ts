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

describe("@outreachos/services", () => {
  it("exports instantiable service stubs for the implemented Phase 1 surface area", () => {
    const instances = [
      new ContactService(),
      new CampaignService(),
      new EnrichmentService(),
      new TemplateService(),
      new ExperimentService(),
      new AnalyticsService(),
      new InboxService(),
      new FormService(),
      new LLMService(),
    ];

    const expectedConstructors = [
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

    expectedConstructors.forEach((Constructor, index) => {
      expect(instances[index]).toBeInstanceOf(Constructor);
    });
  });
});
