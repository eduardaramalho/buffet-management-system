import type { MatchedRule, RuleEvaluationEventInput, RuleRecord } from "../domain/rule.types.js";

// Pure rule-matching core: given a rule's stored conditions and an event snapshot, decides if the
// rule applies. No side effects and no dependency on Events/Teams repositories — this is the
// "query engine" for Part 1; triggering actions from matches is left entirely to Part 2.
export const ruleMatchesEvent = (rule: RuleRecord, event: RuleEvaluationEventInput): boolean => {
  const { conditionServiceTypeIn, conditionMinGuests, conditionMaxGuests, conditionRequiredServiceIds } = rule;

  if (conditionServiceTypeIn && conditionServiceTypeIn.length > 0 && !conditionServiceTypeIn.includes(event.serviceType)) {
    return false;
  }
  if (conditionMinGuests != null && event.guestsCount < conditionMinGuests) {
    return false;
  }
  if (conditionMaxGuests != null && event.guestsCount > conditionMaxGuests) {
    return false;
  }
  if (
    conditionRequiredServiceIds &&
    conditionRequiredServiceIds.length > 0 &&
    !conditionRequiredServiceIds.every((serviceId) => event.contractedServiceIds.includes(serviceId))
  ) {
    return false;
  }

  return true;
};

export const toMatchedRule = (rule: RuleRecord): MatchedRule => ({
  rule,
  resourceRequirements: rule.resourceRequirements,
});
