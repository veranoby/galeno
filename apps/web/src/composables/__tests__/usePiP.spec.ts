/**
 * Tests para el composable usePiP
 * Pruebas unitarias para funcionalidad Picture-in-Picture
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { usePiP } from '../usePiP';

describe('usePiP', () => {
  const originalDocumentPictureInPicture = (window as any).documentPictureInPicture;
  const originalPictureInPictureEnabled = document.pictureInPictureEnabled;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock Document Picture-in-Picture API
    (window as any).documentPictureInPicture = {
      requestWindow: vi.fn()
    };

    // Mock Video Picture-in-Picture API
    Object.defineProperty(document, 'pictureInPictureEnabled', {
      value: true,
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    // Restore originals
    if (originalDocumentPictureInPicture) {
      (window as any).documentPictureInPicture = originalDocumentPictureInPicture;
    } else {
      delete (window as any).documentPictureInPicture;
    }

    Object.defineProperty(document, 'pictureInPictureEnabled', {
      value: originalPictureInPictureEnabled,
      writable: true,
      configurable: true
    });
  });

  it('should detect PiP support', () => {
    const { isSupported } = usePiP();
    expect(isSupported.value).toBe(true);
  });

  it('should initialize with PiP inactive', () => {
    const { isPiPActive } = usePiP();
    expect(isPiPActive.value).toBe(false);
  });

  it('should enter PiP mode with Document PiP API', async () => {
    const mockPipWindow = {
      document: {
        body: {
          appendChild: vi.fn()
        }
      },
      addEventListener: vi.fn(),
      close: vi.fn()
    };

    vi.mocked((window as any).documentPictureInPicture.requestWindow)
      .mockResolvedValue(mockPipWindow);

    const testElement = document.createElement('div');
    const videoElement = ref<HTMLElement>(testElement);
    const { enterPiP, isPiPActive, pipWindow } = usePiP(videoElement);

    await enterPiP();

    expect((window as any).documentPictureInPicture.requestWindow).toHaveBeenCalledWith({
      width: 480,
      height: 320
    });
    expect(isPiPActive.value).toBe(true);
    expect(pipWindow.value).toBe(mockPipWindow);
  });

  it('should enter PiP mode with container element override', async () => {
    const mockPipWindow = {
      document: {
        body: {
          appendChild: vi.fn()
        }
      },
      addEventListener: vi.fn(),
      close: vi.fn()
    };

    vi.mocked((window as any).documentPictureInPicture.requestWindow)
      .mockResolvedValue(mockPipWindow);

    const containerElement = document.createElement('div');
    const { enterPiP, isPiPActive } = usePiP();

    await enterPiP(containerElement);

    expect(isPiPActive.value).toBe(true);
    expect(mockPipWindow.document.body.appendChild).toHaveBeenCalledWith(containerElement);
  });

  it('should enter PiP mode with Ref container override', async () => {
    const mockPipWindow = {
      document: {
        body: {
          appendChild: vi.fn()
        }
      },
      addEventListener: vi.fn(),
      close: vi.fn()
    };

    vi.mocked((window as any).documentPictureInPicture.requestWindow)
      .mockResolvedValue(mockPipWindow);

    const containerElement = document.createElement('div');
    const containerRef = ref<HTMLElement | null>(containerElement);
    const { enterPiP, isPiPActive } = usePiP();

    await enterPiP(containerRef);

    expect(isPiPActive.value).toBe(true);
  });

  it('should exit PiP mode', async () => {
    const mockPipWindow = {
      document: {
        body: {
          appendChild: vi.fn()
        }
      },
      addEventListener: vi.fn(),
      close: vi.fn(),
      closed: false
    };

    vi.mocked((window as any).documentPictureInPicture.requestWindow)
      .mockResolvedValue(mockPipWindow);

    const { enterPiP, exitPiP, isPiPActive } = usePiP();

    await enterPiP();
    expect(isPiPActive.value).toBe(true);

    exitPiP();
    expect(mockPipWindow.close).toHaveBeenCalled();
    expect(isPiPActive.value).toBe(false);
  });

  it('should toggle PiP mode', async () => {
    const mockPipWindow = {
      document: {
        body: {
          appendChild: vi.fn()
        }
      },
      addEventListener: vi.fn(),
      close: vi.fn(),
      closed: false
    };

    vi.mocked((window as any).documentPictureInPicture.requestWindow)
      .mockResolvedValue(mockPipWindow);

    const { togglePiP, isPiPActive } = usePiP();

    expect(isPiPActive.value).toBe(false);

    await togglePiP();
    expect(isPiPActive.value).toBe(true);

    await togglePiP();
    expect(isPiPActive.value).toBe(false);
  });

  it('should handle Video PiP API fallback', async () => {
    // Disable Document PiP to force Video PiP fallback
    delete (window as any).documentPictureInPicture;

    const mockVideoElement = document.createElement('video');
    mockVideoElement.requestPictureInPicture = vi.fn().mockResolvedValue(undefined);
    
    const videoRef = ref<HTMLVideoElement>(mockVideoElement);
    const { enterPiP, isPiPActive } = usePiP(videoRef);

    await enterPiP();

    expect(mockVideoElement.requestPictureInPicture).toHaveBeenCalled();
    expect(isPiPActive.value).toBe(true);
  });

  it('should create fallback overlay when PiP not supported', async () => {
    // Disable both PiP APIs
    delete (window as any).documentPictureInPicture;
    Object.defineProperty(document, 'pictureInPictureEnabled', {
      value: false,
      writable: true
    });

    const testElement = document.createElement('div');
    const videoElement = ref<HTMLElement>(testElement);
    const { enterPiP, isPiPActive } = usePiP(videoElement, { fallbackToOverlay: true });

    await enterPiP();

    expect(isPiPActive.value).toBe(true);
    // Fallback overlay should be created
    expect(document.querySelector('div[style*="position: fixed"]')).toBeTruthy();
  });

  it('should throw error when PiP not supported and no fallback', async () => {
    // Disable both PiP APIs
    delete (window as any).documentPictureInPicture;
    Object.defineProperty(document, 'pictureInPictureEnabled', {
      value: false,
      writable: true
    });

    const testElement = document.createElement('div');
    const videoElement = ref<HTMLElement>(testElement);
    const { enterPiP } = usePiP(videoElement, { fallbackToOverlay: false });

    await expect(enterPiP()).rejects.toThrow('PiP not supported');
  });

  it('should warn when no element provided', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { enterPiP } = usePiP();

    await enterPiP();

    expect(consoleWarnSpy).toHaveBeenCalledWith('No element provided for PiP');
    consoleWarnSpy.mockRestore();
  });

  it('should handle custom dimensions', async () => {
    const mockPipWindow = {
      document: {
        body: {
          appendChild: vi.fn()
        }
      },
      addEventListener: vi.fn(),
      close: vi.fn()
    };

    vi.mocked((window as any).documentPictureInPicture.requestWindow)
      .mockResolvedValue(mockPipWindow);

    const testElement = document.createElement('div');
    const videoElement = ref<HTMLElement>(testElement);
    const { enterPiP } = usePiP(videoElement, { width: 640, height: 480 });

    await enterPiP();

    expect((window as any).documentPictureInPicture.requestWindow).toHaveBeenCalledWith({
      width: 640,
      height: 480
    });
  });

  it('should restore element position on PiP close', async () => {
    const mockPipWindow = {
      document: {
        body: {
          appendChild: vi.fn()
        }
      },
      addEventListener: vi.fn((event, callback) => {
        // Simulate pagehide event
        setTimeout(callback, 10);
      }),
      close: vi.fn(),
      closed: false
    };

    vi.mocked((window as any).documentPictureInPicture.requestWindow)
      .mockResolvedValue(mockPipWindow);

    const parentElement = document.createElement('div');
    const testElement = document.createElement('div');
    parentElement.appendChild(testElement);

    const videoElement = ref<HTMLElement>(testElement);
    const { enterPiP } = usePiP(videoElement);

    await enterPiP();

    // Wait for pagehide event simulation
    await new Promise(resolve => setTimeout(resolve, 20));

    // Element should be restored to original parent
    expect(parentElement.contains(testElement)).toBe(true);
  });

  it('should cleanup on unmount', async () => {
    const mockPipWindow = {
      document: {
        body: {
          appendChild: vi.fn()
        }
      },
      addEventListener: vi.fn(),
      close: vi.fn(),
      closed: false
    };

    vi.mocked((window as any).documentPictureInPicture.requestWindow)
      .mockResolvedValue(mockPipWindow);

    const { enterPiP, exitPiP, isPiPActive } = usePiP();

    await enterPiP();
    expect(isPiPActive.value).toBe(true);

    // Simulate unmount
    exitPiP();

    expect(mockPipWindow.close).toHaveBeenCalled();
    expect(isPiPActive.value).toBe(false);
  });
});
