/*
 * SCTCC Syllabus Builder — grading calculations and checks
 *
 * Shared by the editor (live totals and messages), the syllabus renderer
 * (tables and point ranges), and the print check. Instructor-entered values
 * are never changed here; problems are only reported.
 */
window.SCTCC = window.SCTCC || {};

(function () {
  "use strict";

  function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function roundTo(value, places) {
    const factor = 10 ** places;
    return Math.round(value * factor) / factor;
  }

  /* Category total = number of assignments × points per assignment. */
  function categoryTotal(category) {
    return toNumber(category.count) * toNumber(category.pointsEach);
  }

  function pointsTotal(categories) {
    return roundTo((categories || []).reduce((sum, category) => sum + categoryTotal(category), 0), 4);
  }

  function weightTotal(categories) {
    return roundTo((categories || []).reduce((sum, category) => sum + toNumber(category.weight), 0), 4);
  }

  function formatNumber(value) {
    const rounded = roundTo(value, 2);
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0$/, "");
  }

  /*
   * Summary of the assessment categories.
   * Returns { method, total, label, errors[], warnings[] }.
   */
  function summarizeCategories(grading) {
    const method = grading.calculationMethod === "weighted" ? "weighted" : "points";
    const categories = grading.categories || [];
    const result = { method, total: 0, label: "", errors: [], warnings: [] };

    if (!categories.length) {
      result.label = "No assessment categories yet.";
      result.warnings.push("Add at least one assessment category.");
      return result;
    }

    categories.forEach((category, index) => {
      const name = String(category.name || "").trim() || `Category ${index + 1}`;
      if (!String(category.name || "").trim()) result.warnings.push(`Category ${index + 1} has no name.`);
      if (method === "points") {
        if (toNumber(category.count) < 0 || toNumber(category.pointsEach) < 0) result.errors.push(`${name}: numbers cannot be negative.`);
        else if (categoryTotal(category) === 0) result.warnings.push(`${name} is worth 0 points.`);
      } else {
        if (toNumber(category.weight) < 0) result.errors.push(`${name}: the weight cannot be negative.`);
        else if (toNumber(category.weight) === 0) result.warnings.push(`${name} has a weight of 0%.`);
      }
    });

    if (method === "points") {
      result.total = pointsTotal(categories);
      result.label = `Course total: ${formatNumber(result.total)} points.`;
      if (result.total <= 0) result.errors.push("The course total must be more than 0 points.");
      return result;
    }

    result.total = weightTotal(categories);
    const difference = roundTo(100 - result.total, 4);
    if (difference === 0) {
      result.label = "Total weight: 100%.";
    } else if (difference > 0) {
      result.label = `Total weight: ${formatNumber(result.total)}% — ${formatNumber(difference)}% short of 100%.`;
      if (!grading.weightOverride) result.errors.push(`The weights add up to ${formatNumber(result.total)}%, not 100%.`);
    } else {
      result.label = `Total weight: ${formatNumber(result.total)}% — ${formatNumber(-difference)}% over 100%.`;
      if (!grading.weightOverride) result.errors.push(`The weights add up to ${formatNumber(result.total)}%, not 100%.`);
    }
    if (difference !== 0 && grading.weightOverride) {
      result.warnings.push(`You chose to publish with weights totaling ${formatNumber(result.total)}%. Explain why under “Additional grading information.”`);
    }
    return result;
  }

  /* Scale rows sorted from highest to lowest minimum, with their original positions. */
  function sortedScale(scale) {
    return (scale || [])
      .map((row, index) => ({ row, index }))
      .sort((a, b) => toNumber(b.row.minPercent) - toNumber(a.row.minPercent));
  }

  /*
   * Check the grading scale. Ranges are inclusive percentages, for example
   * A 90–100 and B 80–89. Neighboring rows are continuous when the lower row's
   * maximum is within 1 point below the higher row's minimum (89 → 90, or 89.99 → 90).
   * Returns { errors[], warnings[] }.
   */
  function validateScale(scale) {
    const errors = [];
    const warnings = [];
    const rows = scale || [];
    if (!rows.length) {
      errors.push("Add at least one grade to the grading scale.");
      return { errors, warnings };
    }

    const labels = new Map();
    rows.forEach((row, index) => {
      const label = String(row.label || "").trim();
      const name = label || `Grade ${index + 1}`;
      const min = toNumber(row.minPercent);
      const max = toNumber(row.maxPercent);
      if (!label) errors.push(`Grade ${index + 1} has no label.`);
      else if (labels.has(label.toUpperCase())) errors.push(`“${label}” appears more than once.`);
      else labels.set(label.toUpperCase(), true);
      if (min < 0 || max < 0) errors.push(`${name}: percentages cannot be below 0%.`);
      if (min > 100) errors.push(`${name}: the minimum cannot be above 100%.`);
      if (max > 100) warnings.push(`${name}: the maximum is above 100%. That is fine only if your course allows extra credit.`);
      if (min > max) errors.push(`${name}: the minimum (${formatNumber(min)}%) is higher than the maximum (${formatNumber(max)}%).`);
    });

    const ordered = sortedScale(rows);
    for (let i = 0; i < ordered.length - 1; i += 1) {
      const higher = ordered[i].row;
      const lower = ordered[i + 1].row;
      const higherName = String(higher.label || "").trim() || `Grade ${ordered[i].index + 1}`;
      const lowerName = String(lower.label || "").trim() || `Grade ${ordered[i + 1].index + 1}`;
      const higherMin = toNumber(higher.minPercent);
      const lowerMax = toNumber(lower.maxPercent);
      if (lowerMax >= higherMin) {
        errors.push(`${lowerName} (up to ${formatNumber(lowerMax)}%) overlaps ${higherName} (from ${formatNumber(higherMin)}%).`);
      } else if (higherMin - lowerMax > 1) {
        warnings.push(`There is a gap between ${lowerName} (up to ${formatNumber(lowerMax)}%) and ${higherName} (from ${formatNumber(higherMin)}%). Scores in between would have no grade.`);
      }
    }

    const top = ordered[0].row;
    const bottom = ordered[ordered.length - 1].row;
    if (toNumber(top.maxPercent) < 100) warnings.push(`The highest grade stops at ${formatNumber(toNumber(top.maxPercent))}%, so a score of 100% has no grade.`);
    if (toNumber(bottom.minPercent) > 0) warnings.push(`The lowest grade starts at ${formatNumber(toNumber(bottom.minPercent))}%, so lower scores have no grade.`);

    return { errors, warnings };
  }

  /*
   * Point range for each scale row (points method), keyed by original row index.
   * Minimum points = ceiling(total × minimum% ÷ 100); maximum = next-higher minimum − 1,
   * or the course total for the top grade.
   */
  function pointRanges(scale, total) {
    const ranges = new Map();
    if (!total || total <= 0) return ranges;
    const ordered = sortedScale(scale);
    let previousMin = null;
    ordered.forEach(({ row, index }, position) => {
      const min = Math.max(0, Math.ceil((total * toNumber(row.minPercent)) / 100));
      const max = position === 0
        ? Math.round((total * Math.max(100, toNumber(row.maxPercent))) / 100)
        : Math.max(min, previousMin - 1);
      ranges.set(index, { min, max });
      previousMin = min;
    });
    return ranges;
  }

  /* Everything that should stop a syllabus from being printed, plus advisories. */
  function checkGrading(grading) {
    const categories = summarizeCategories(grading);
    const scale = validateScale(grading.scale);
    return {
      summary: categories,
      errors: [...categories.errors, ...scale.errors],
      warnings: [...categories.warnings, ...scale.warnings]
    };
  }

  /* A starting point only; instructors must confirm cutoffs for their program. */
  function plusMinusSampleScale() {
    return [
      { label: "A", minPercent: 93, maxPercent: 100 },
      { label: "A-", minPercent: 90, maxPercent: 92 },
      { label: "B+", minPercent: 87, maxPercent: 89 },
      { label: "B", minPercent: 83, maxPercent: 86 },
      { label: "B-", minPercent: 80, maxPercent: 82 },
      { label: "C+", minPercent: 77, maxPercent: 79 },
      { label: "C", minPercent: 73, maxPercent: 76 },
      { label: "C-", minPercent: 70, maxPercent: 72 },
      { label: "D+", minPercent: 67, maxPercent: 69 },
      { label: "D", minPercent: 63, maxPercent: 66 },
      { label: "D-", minPercent: 60, maxPercent: 62 },
      { label: "F", minPercent: 0, maxPercent: 59 }
    ];
  }

  window.SCTCC.grading = Object.freeze({
    categoryTotal,
    pointsTotal,
    weightTotal,
    formatNumber,
    summarizeCategories,
    validateScale,
    pointRanges,
    checkGrading,
    sortedScale,
    plusMinusSampleScale
  });
})();
