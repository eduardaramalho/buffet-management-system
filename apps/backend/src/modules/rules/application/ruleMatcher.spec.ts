import { describe, expect, it } from "@jest/globals";

import { ruleMatchesEvent, toMatchedRule } from "./ruleMatcher.js";
import type { RuleEvaluationEventInput, RuleRecord } from "../domain/rule.types.js";

const makeRule = (overrides: Partial<RuleRecord> = {}): RuleRecord => ({
  id: "rule-1",
  name: "Casamento grande precisa de bar",
  description: null,
  isActive: true,
  conditionServiceTypeIn: null,
  conditionMinGuests: null,
  conditionMaxGuests: null,
  conditionRequiredServiceIds: null,
  createdById: "actor-1",
  createdAt: new Date("2026-09-28T00:00:00.000Z"),
  updatedAt: new Date("2026-09-28T00:00:00.000Z"),
  deletedAt: null,
  resourceRequirements: [{ id: "req-1", specialty: "BAR", minQuantity: 1 }],
  taskTemplates: [],
  ...overrides,
});

const makeEvent = (overrides: Partial<RuleEvaluationEventInput> = {}): RuleEvaluationEventInput => ({
  serviceType: "CASAMENTO",
  guestsCount: 100,
  contractedServiceIds: [],
  ...overrides,
});

describe("ruleMatchesEvent", () => {
  it("matches a rule with no conditions against any event", () => {
    expect(ruleMatchesEvent(makeRule(), makeEvent())).toBe(true);
  });

  it("matches when the event's service type is in the allowed list", () => {
    const rule = makeRule({ conditionServiceTypeIn: ["CASAMENTO", "FORMATURA"] });
    expect(ruleMatchesEvent(rule, makeEvent({ serviceType: "CASAMENTO" }))).toBe(true);
  });

  it("rejects when the event's service type is not in the allowed list", () => {
    const rule = makeRule({ conditionServiceTypeIn: ["FORMATURA"] });
    expect(ruleMatchesEvent(rule, makeEvent({ serviceType: "CASAMENTO" }))).toBe(false);
  });

  it("treats an empty service type list as no restriction", () => {
    const rule = makeRule({ conditionServiceTypeIn: [] });
    expect(ruleMatchesEvent(rule, makeEvent({ serviceType: "OUTRO" }))).toBe(true);
  });

  it("rejects when guests are below the configured minimum", () => {
    const rule = makeRule({ conditionMinGuests: 150 });
    expect(ruleMatchesEvent(rule, makeEvent({ guestsCount: 100 }))).toBe(false);
  });

  it("matches when guests meet the configured minimum", () => {
    const rule = makeRule({ conditionMinGuests: 100 });
    expect(ruleMatchesEvent(rule, makeEvent({ guestsCount: 100 }))).toBe(true);
  });

  it("rejects when guests exceed the configured maximum", () => {
    const rule = makeRule({ conditionMaxGuests: 50 });
    expect(ruleMatchesEvent(rule, makeEvent({ guestsCount: 100 }))).toBe(false);
  });

  it("matches when guests are within the configured range", () => {
    const rule = makeRule({ conditionMinGuests: 50, conditionMaxGuests: 150 });
    expect(ruleMatchesEvent(rule, makeEvent({ guestsCount: 100 }))).toBe(true);
  });

  it("rejects when a required service was not contracted", () => {
    const rule = makeRule({ conditionRequiredServiceIds: ["service-buffet", "service-bar"] });
    expect(ruleMatchesEvent(rule, makeEvent({ contractedServiceIds: ["service-buffet"] }))).toBe(false);
  });

  it("matches when all required services were contracted", () => {
    const rule = makeRule({ conditionRequiredServiceIds: ["service-buffet", "service-bar"] });
    expect(
      ruleMatchesEvent(rule, makeEvent({ contractedServiceIds: ["service-buffet", "service-bar", "service-decor"] })),
    ).toBe(true);
  });

  it("treats an empty required service list as no restriction", () => {
    const rule = makeRule({ conditionRequiredServiceIds: [] });
    expect(ruleMatchesEvent(rule, makeEvent({ contractedServiceIds: [] }))).toBe(true);
  });

  it("combines all conditions with AND semantics", () => {
    const rule = makeRule({
      conditionServiceTypeIn: ["CASAMENTO"],
      conditionMinGuests: 80,
      conditionMaxGuests: 200,
      conditionRequiredServiceIds: ["service-bar"],
    });

    expect(
      ruleMatchesEvent(rule, {
        serviceType: "CASAMENTO",
        guestsCount: 100,
        contractedServiceIds: ["service-bar"],
      }),
    ).toBe(true);

    expect(
      ruleMatchesEvent(rule, {
        serviceType: "CASAMENTO",
        guestsCount: 100,
        contractedServiceIds: [],
      }),
    ).toBe(false);
  });
});

describe("toMatchedRule", () => {
  it("projects a rule together with its resource requirements", () => {
    const rule = makeRule({ description: "Regra de exemplo" });

    expect(toMatchedRule(rule)).toEqual({
      rule,
      resourceRequirements: [{ id: "req-1", specialty: "BAR", minQuantity: 1 }],
    });
  });
});
