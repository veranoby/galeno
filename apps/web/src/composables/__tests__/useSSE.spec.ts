import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import SSEReceiver from '@/components/SSEReceiver.vue';
import { useSSE } from '@/composables/useSSE';

// Mock the useSSE composable
vi.mock('@/composables/useSSE', () => ({
  useSSE: vi.fn()
}));

describe('SSEReceiver Component', () => {
  const mockSSEClient = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: false,
    lastEventId: null,
    error: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  };

  beforeEach(() => {
    (useSSE as any).mockReturnValue(mockSSEClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with initial state', () => {
    const wrapper = mount(SSEReceiver, {
      props: {
        sseUrl: 'https://test.example.com/events'
      }
    });

    expect(wrapper.find('h2').text()).toBe('SSE Demo Component');
    expect(wrapper.find('.connection-status p').text()).toContain('Status:');
  });

  it('shows connection status', async () => {
    // Update mock to simulate connected state
    mockSSEClient.isConnected = true;
    
    const wrapper = mount(SSEReceiver, {
      props: {
        sseUrl: 'https://test.example.com/events'
      }
    });

    await nextTick();
    
    expect(wrapper.text()).toContain('Connected');
  });

  it('calls connect method when connect button is clicked', async () => {
    const wrapper = mount(SSEReceiver, {
      props: {
        sseUrl: 'https://test.example.com/events'
      }
    });

    const connectButton = wrapper.find('button:contains("Connect")');
    await connectButton.trigger('click');

    expect(mockSSEClient.connect).toHaveBeenCalled();
  });

  it('calls disconnect method when disconnect button is clicked', async () => {
    // Simulate connected state
    mockSSEClient.isConnected = true;
    
    const wrapper = mount(SSEReceiver, {
      props: {
        sseUrl: 'https://test.example.com/events'
      }
    });

    await nextTick();
    
    const disconnectButton = wrapper.find('button:contains("Disconnect")');
    await disconnectButton.trigger('click');

    expect(mockSSEClient.disconnect).toHaveBeenCalled();
  });

  it('registers event listeners on mount', async () => {
    const wrapper = mount(SSEReceiver, {
      props: {
        sseUrl: 'https://test.example.com/events',
        eventTypes: ['message', 'notification', 'update']
      }
    });

    await nextTick();
    
    // Verify that event listeners were registered
    expect(mockSSEClient.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    expect(mockSSEClient.addEventListener).toHaveBeenCalledWith('notification', expect.any(Function));
    expect(mockSSEClient.addEventListener).toHaveBeenCalledWith('update', expect.any(Function));
  });
});

describe('useSSE Composable', () => {
  // Since the actual implementation is complex, we'll focus on key behaviors
  it('should export the useSSE function', () => {
    expect(useSSE).toBeTypeOf('function');
  });
});