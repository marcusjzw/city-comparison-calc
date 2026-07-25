import { forward } from './forward';
import type { Bracket, CityData, TaxRule } from './types';

/**
 * Invariant checks for a `CityData` record.
 *
 * These run in the test suite today and are the same checks the ingestion
 * pipeline will gate on. They are assertions, not comments, precisely because
 * every one of them corresponds to a way upstream data has been wrong before.
 */

export interface Violation {
  city: string;
  rule?: string;
  message: string;
}

const REFERENCE_INCOMES = [60_000, 150_000, 300_000, 600_000];

function checkBrackets(brackets: Bracket[], label: string): string[] {
  const problems: string[] = [];
  if (brackets.length === 0) return [`${label}: no brackets`];

  let previous = 0;
  brackets.forEach((bracket, index) => {
    const last = index === brackets.length - 1;
    if (bracket.rate < 0 || bracket.rate > 1) {
      problems.push(`${label}: rate ${bracket.rate} outside [0, 1]`);
    }
    if (last && bracket.upTo !== null) {
      problems.push(`${label}: final bracket must have upTo: null`);
    }
    if (!last) {
      if (bracket.upTo === null) {
        problems.push(`${label}: only the final bracket may have upTo: null`);
      } else if (bracket.upTo <= previous) {
        problems.push(
          `${label}: threshold ${bracket.upTo} does not increase past ${previous}`,
        );
      } else {
        previous = bracket.upTo;
      }
    }
  });
  return problems;
}

function checkRule(rule: TaxRule, cityId: string): Violation[] {
  const wrap = (message: string): Violation => ({ city: cityId, rule: rule.id, message });

  switch (rule.kind) {
    case 'brackets': {
      const problems = checkBrackets(rule.brackets, 'default');
      for (const [status, override] of Object.entries(rule.byStatus ?? {})) {
        problems.push(...checkBrackets(override.brackets, status));
      }
      return problems.map(wrap);
    }
    case 'flat':
      return rule.rate < 0 || rule.rate > 1 ? [wrap(`rate ${rule.rate} outside [0, 1]`)] : [];
    case 'surcharge':
      return rule.rate < 0 || rule.rate > 1 ? [wrap(`rate ${rule.rate} outside [0, 1]`)] : [];
  }
}

export function validateCity(city: CityData, now = new Date()): Violation[] {
  const violations: Violation[] = [];
  const add = (message: string) => violations.push({ city: city.id, message });
  const allRules = [...city.taxRules, ...city.payroll];

  for (const rule of allRules) violations.push(...checkRule(rule, city.id));

  if (!/^[A-Z]{3}$/.test(city.currency)) add(`currency "${city.currency}" is not an ISO code`);

  const asOf = new Date(city.asOf);
  if (Number.isNaN(asOf.getTime())) add(`asOf "${city.asOf}" is not a date`);
  else if (asOf.getTime() > now.getTime()) add(`asOf "${city.asOf}" is in the future`);

  if (city.sources.length === 0) add('no sources: tax figures may never ship unattributed');

  for (const required of city.requiredRules) {
    if (!allRules.some((rule) => rule.id === required)) {
      add(`missing required rule "${required}" — an entire tax layer is absent`);
    }
  }

  // Any rule that varies by filing status obliges the city to declare the
  // statuses it supports, so the UI never renders a control the data cannot
  // answer, nor hides one that matters.
  const statusAware = allRules.some(
    (rule) => 'byStatus' in rule && rule.byStatus !== undefined,
  );
  if (statusAware && !city.filingStatuses?.length) {
    add('rules vary by filing status but filingStatuses is not declared');
  }

  const ids = allRules.map((rule) => rule.id);
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate) add(`duplicate rule id "${duplicate}"`);

  // Marginal rates are NOT asserted to increase monotonically: the UK really
  // does run 40%, then 60% through the personal allowance taper, then 45%.
  // The effective rate is non-decreasing in every real system, so assert that.
  let previousEffective = -1;
  for (const income of REFERENCE_INCOMES) {
    const { effectiveTaxRate } = forward({
      city,
      grossComp: income,
      filingStatus: 'single',
      preTaxDeductions: 0,
      livingCost: 0,
      healthCost: 0,
      fxToHome: 1,
    });
    if (effectiveTaxRate < previousEffective - 1e-9) {
      add(
        `effective tax rate falls from ${(previousEffective * 100).toFixed(2)}% to ` +
          `${(effectiveTaxRate * 100).toFixed(2)}% at ${income}`,
      );
    }
    previousEffective = effectiveTaxRate;
  }

  if (city.colBasket.length === 0) add('empty cost of living basket');

  return violations;
}
