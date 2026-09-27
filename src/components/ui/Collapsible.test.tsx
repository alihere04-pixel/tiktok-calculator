import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Collapsible } from './Collapsible';
import { Card, CardBody, CardHeader } from './Card';

afterEach(cleanup);

describe('Collapsible heading level', () => {
  it('defaults to h3, which is correct inside a Card whose header is an h2', () => {
    const { container } = render(<Collapsible title="Fees">body</Collapsible>);
    expect(container.querySelector('h2')).toBeNull();
    expect(container.querySelector('h3')).not.toBeNull();
  });

  it('renders an h2 when asked, for a section directly under the page h1', () => {
    const { container } = render(
      <Collapsible headingLevel="h2" title="Costs">
        body
      </Collapsible>
    );
    expect(container.querySelector('h2')).not.toBeNull();
    expect(container.querySelector('h3')).toBeNull();
  });

  it('supports h4 for deeper nesting', () => {
    const { container } = render(
      <Collapsible headingLevel="h4" title="Nested">
        body
      </Collapsible>
    );
    expect(container.querySelector('h4')).not.toBeNull();
  });

  it('nests without skipping a level when a Card wraps it', () => {
    // Card header is h2, so the collapsible title must be h3, not h2 or h4.
    const { container } = render(
      <Card>
        <CardHeader title="Results" description="d" />
        <CardBody>
          <Collapsible title="Breakdown">body</Collapsible>
        </CardBody>
      </Card>
    );
    expect(container.querySelector('h2')).not.toBeNull();
    expect(container.querySelector('h3')).not.toBeNull();
  });

  it('exposes the title as a heading to assistive technology', () => {
    render(
      <Collapsible headingLevel="h2" title="Costs">
        body
      </Collapsible>
    );
    expect(screen.getByRole('heading', { name: 'Costs', level: 2 })).toBeTruthy();
  });
});

describe('Collapsible behaviour is unchanged by the heading level', () => {
  it('keeps the title as the accessible name of the toggle button', () => {
    render(
      <Collapsible headingLevel="h2" title="Costs">
        body
      </Collapsible>
    );
    expect(screen.getByRole('button', { name: /Costs/ })).toBeTruthy();
  });

  it('still wires aria-expanded and aria-controls', () => {
    const { container } = render(
      <Collapsible headingLevel="h2" title="Costs">
        <p>body</p>
      </Collapsible>
    );
    const button = screen.getByRole('button', { name: /Costs/ });
    const controls = button.getAttribute('aria-controls')!;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector(`#${CSS.escape(controls)}`)).not.toBeNull();
  });

  it('still keeps content mounted when collapsed, so form state survives', () => {
    render(
      <Collapsible headingLevel="h2" title="Costs">
        <p>body</p>
      </Collapsible>
    );
    // Hidden rather than unmounted, which is why the text is present in the DOM.
    expect(screen.getByText('body')).toBeTruthy();
  });
});
