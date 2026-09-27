// DEFAULTS FOR THE RESULTS PANEL'S OWN INPUTS
//
// These three values are inputs to the results panel, not to the calculation.
// They are collected *after* a calculation succeeds (PRD section 10 items 4
// and 5) and never feed back into the fee engines, so they are not part of
// `CalculatorInputs` and are not persisted with the form.
//
// Kept in their own module because both the client panel and the server action
// need them, and the action must be able to fall back to them when a value
// arrives as NaN.

/** Target profit per unit for the "Target Profit Price" card. */
export const DEFAULT_TARGET_PROFIT = 5;

/** Target ROAS for the "Max CPA" card. PRD section 10 specifies 4x. */
export const DEFAULT_TARGET_ROAS = 4;

/** Monthly units for the projection card. */
export const DEFAULT_MONTHLY_UNITS = 500;
