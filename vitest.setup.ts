// vitest setup - no jest-dom needed, vitest has built-in matchers

// jsdom does not implement `scrollIntoView`, so any test that opens a component
// which scrolls an active option into view (the `Select` combobox does this on
// open) would otherwise throw. The stub is behaviourally inert: the component
// only ever calls it to keep the highlighted row visible, which has no meaning
// in a non-visual test run.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
