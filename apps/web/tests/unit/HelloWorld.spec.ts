import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/vue';
import HelloWorld from '../../src/components/HelloWorld.vue';

describe('HelloWorld', () => {
  it('renders a message and increments count on button click', async () => {
    const msg = 'Test Message';
    render(HelloWorld, { props: { msg } });

    // Check if the message is rendered
    expect(screen.getByText(msg)).toBeDefined();

    // Check if the button is rendered and click it
    const button = screen.getByText(/count is: \d+/i);
    expect(button).toBeDefined();

    await fireEvent.click(button);
    expect(screen.getByText(/count is: 1/i)).toBeDefined();
  });
});
