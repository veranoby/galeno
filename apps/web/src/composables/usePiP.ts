import { ref, type Ref, onUnmounted, watch } from 'vue';

export interface PiPOptions {
  width?: number;
  height?: number;
  fallbackToOverlay?: boolean;
}

export interface UsePiPReturn {
  isPiPActive: Ref<boolean>;
  isSupported: Ref<boolean>;
  enterPiP: (container?: HTMLElement | Ref<HTMLElement | null>) => Promise<void>;
  exitPiP: () => void;
  togglePiP: (container?: HTMLElement | Ref<HTMLElement | null>) => Promise<void>;
  pipWindow: Ref<Window | null>;
}

/**
 * Composable for managing Picture-in-Picture functionality
 * Supports both Document Picture-in-Picture API and fallback overlay
 * Works with video elements or container elements (for Jitsi iframe)
 */
export function usePiP(
  videoElement?: Ref<HTMLVideoElement | HTMLElement | undefined | null>,
  options: PiPOptions = {}
): UsePiPReturn {
  const {
    width = 480,
    height = 320,
    fallbackToOverlay = true
  } = options;

  const isPiPActive = ref(false);
  const isSupported = ref(false);
  const pipWindow = ref<Window | null>(null);
  const fallbackOverlay = ref<HTMLDivElement | null>(null);

  // Check for PiP support on initialization
  onUnmounted(() => {
    exitPiP();
  });

  // Initialize support detection
  if (typeof window !== 'undefined') {
    isSupported.value =
      'documentPictureInPicture' in window ||
      'pictureInPictureEnabled' in document;
  }

  /**
   * Enter Picture-in-Picture mode
   * Uses Document PiP API if available, falls back to overlay if enabled
   * @param container - Optional container element (overrides videoElement ref)
   */
  const enterPiP = async (container?: HTMLElement | Ref<HTMLElement | null>): Promise<void> => {
    // Get the element to use for PiP
    const element = container instanceof Ref 
      ? container.value 
      : container instanceof HTMLElement 
        ? container 
        : videoElement?.value;

    if (!element) {
      console.warn('No element provided for PiP');
      return;
    }

    try {
      // Try Document Picture-in-Picture API first (best for iframes)
      if ('documentPictureInPicture' in window) {
        const pip = (window as any).documentPictureInPicture;
        pipWindow.value = await pip.requestWindow({
          width,
          height,
        });

        // Move the element to the PiP window
        if (element.parentNode && pipWindow.value) {
          // Store original parent to restore later
          const originalParent = element.parentNode;
          const originalNextSibling = element.nextSibling;

          // Append to PiP window
          pipWindow.value.document.body.appendChild(element);

          // Listen for PiP window close
          pipWindow.value.addEventListener('pagehide', () => {
            exitPiP();
            // Restore element to original position
            if (originalParent && originalNextSibling) {
              originalParent.insertBefore(element, originalNextSibling);
            } else if (originalParent) {
              originalParent.appendChild(element);
            }
          });

          isPiPActive.value = true;
        }
      }
      // Fallback to Video PiP API for video elements
      else if (element instanceof HTMLVideoElement && document.pictureInPictureEnabled) {
        await element.requestPictureInPicture();
        isPiPActive.value = true;

        // Listen for PiP events
        element.addEventListener('leavepictureinpicture', () => {
          isPiPActive.value = false;
        });
      }
      // Fallback to overlay if enabled
      else if (fallbackToOverlay) {
        createFallbackOverlay(element);
        isPiPActive.value = true;
      } else {
        console.warn('Picture-in-Picture is not supported in this browser');
        throw new Error('PiP not supported');
      }
    } catch (error) {
      console.error('Failed to enter PiP mode:', error);

      // Try fallback overlay if primary methods failed
      if (fallbackToOverlay && !isPiPActive.value) {
        createFallbackOverlay(element);
        isPiPActive.value = true;
      } else {
        throw error;
      }
    }
  };

  /**
   * Exit Picture-in-Picture mode
   */
  const exitPiP = (): void => {
    try {
      // Close Document PiP window if active
      if (pipWindow.value && !pipWindow.value.closed) {
        pipWindow.value.close();
        pipWindow.value = null;
      }
      // Exit Video PiP if active
      else if (document.pictureInPictureElement) {
        document.exitPictureInPicture();
      }
      // Remove fallback overlay if active
      else if (fallbackOverlay.value) {
        fallbackOverlay.value.remove();
        fallbackOverlay.value = null;
      }

      isPiPActive.value = false;
    } catch (error) {
      console.error('Failed to exit PiP mode:', error);
    }
  };

  /**
   * Toggle Picture-in-Picture mode
   * @param container - Optional container element (overrides videoElement ref)
   */
  const togglePiP = async (container?: HTMLElement | Ref<HTMLElement | null>): Promise<void> => {
    if (isPiPActive.value) {
      exitPiP();
    } else {
      await enterPiP(container);
    }
  };

  /**
   * Create fallback overlay for browsers that don't support PiP
   * @param element - Element to clone/display in overlay
   */
  const createFallbackOverlay = (element: HTMLElement): void => {
    // Remove existing overlay if present
    if (fallbackOverlay.value) {
      fallbackOverlay.value.remove();
    }

    // Create overlay container
    fallbackOverlay.value = document.createElement('div');
    fallbackOverlay.value.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      width: ${width}px;
      height: ${height}px;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
      overflow: hidden;
      resize: both;
      min-width: 200px;
      min-height: 150px;
      max-width: 80vw;
      max-height: 80vh;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Clone the element or create placeholder
    if (element) {
      const clonedElement = element.cloneNode(true) as HTMLElement;
      clonedElement.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
      `;
      fallbackOverlay.value.appendChild(clonedElement);
    } else {
      // Create placeholder if no element
      const placeholder = document.createElement('div');
      placeholder.textContent = 'Video Stream';
      placeholder.style.cssText = `
        color: white;
        font-family: Arial, sans-serif;
        text-align: center;
        padding: 20px;
      `;
      fallbackOverlay.value.appendChild(placeholder);
    }

    // Add controls to the overlay
    const controls = document.createElement('div');
    controls.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      gap: 4px;
    `;

    // Close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '✕';
    closeButton.style.cssText = `
      background: rgba(0, 0, 0, 0.6);
      color: white;
      border: none;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeButton.onclick = () => {
      exitPiP();
    };
    controls.appendChild(closeButton);

    fallbackOverlay.value.appendChild(controls);

    // Add drag functionality
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    fallbackOverlay.value.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      
      isDragging = true;
      offsetX = e.clientX - fallbackOverlay.value!.getBoundingClientRect().left;
      offsetY = e.clientY - fallbackOverlay.value!.getBoundingClientRect().top;
      fallbackOverlay.value!.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging || !fallbackOverlay.value) return;
      
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const elementWidth = fallbackOverlay.value.offsetWidth;
      const elementHeight = fallbackOverlay.value.offsetHeight;
      
      let newX = e.clientX - offsetX;
      let newY = e.clientY - offsetY;
      
      // Boundary checks
      newX = Math.max(0, Math.min(newX, viewportWidth - elementWidth));
      newY = Math.max(0, Math.min(newY, viewportHeight - elementHeight));
      
      fallbackOverlay.value.style.left = `${newX}px`;
      fallbackOverlay.value.style.top = `${newY}px`;
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      if (fallbackOverlay.value) {
        fallbackOverlay.value.style.cursor = 'grab';
      }
    });

    // Add to document body
    document.body.appendChild(fallbackOverlay.value);
  };

  return {
    isPiPActive,
    isSupported,
    enterPiP,
    exitPiP,
    togglePiP,
    pipWindow
  };
}