# Picture-in-Picture (PiP) Implementation for Galeno

This document describes the Picture-in-Picture (PiP) functionality implemented for the Galeno telemedicine platform.

## Overview

The PiP functionality allows healthcare professionals to maintain a floating video call window while simultaneously interacting with patient records, notes, and other clinical tools. This enhances multitasking capabilities during teleconsultations.

## Architecture

### Components

1. **`usePiP` Composable** (`/src/composables/usePiP.ts`)
   - Manages Picture-in-Picture functionality
   - Supports both Document PiP API and Video PiP API
   - Provides fallback overlay for unsupported browsers
   - Handles entering/exiting PiP mode

2. **`PiPVideo` Component** (`/src/components/teleconsulta/PiPVideo.vue`)
   - Reusable video component with built-in PiP controls
   - Provides UI for toggling PiP mode
   - Handles loading states and error handling
   - Accessible with proper ARIA attributes

3. **`JitsiMeet` Component** (`/src/components/teleconsulta/JitsiMeet.vue`)
   - Integration with Jitsi Meet video conferencing
   - Exposes video element for PiP functionality
   - Provides call controls (audio/video mute, end call)
   - Secure room name generation

4. **`useJitsi` Composable** (`/src/composables/useJitsi.ts`)
   - Manages Jitsi Meet integration
   - Handles secure room name generation using crypto utilities
   - Provides call control methods

5. **`TeleconsultationWorkspace` Component** (`/src/components/teleconsulta/TeleconsultationWorkspace.vue`)
   - Main workspace combining video call and clinical tools
   - Demonstrates PiP integration with clinical workflow
   - Shows how to coordinate PiP with other UI elements

## Features

### Native PiP Support
- **Document PiP API**: For browsers supporting the newer Document Picture-in-Picture API
- **Video PiP API**: For browsers supporting the traditional video-only PiP
- **Fallback Overlay**: Custom draggable overlay for unsupported browsers

### Security
- Secure room name generation using SHA-256 hashing
- Integration with Galeno's token-based authentication
- Cross-origin protection for video streams

### Accessibility
- Proper ARIA labels for all interactive elements
- Keyboard navigation support
- Screen reader compatibility
- Focus management during PiP transitions

### User Experience
- Smooth transitions between normal and PiP modes
- Draggable PiP window with resize capabilities
- Persistent PiP state across route changes
- Visual indicators for PiP status

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Video PiP API | ✅ 68+ | ❌ | ✅ 15.4+ | ✅ 79+ |
| Document PiP API | ✅ 111+ | ❌ | ❌ | ✅ 111+ |
| Fallback Overlay | ✅ | ✅ | ✅ | ✅ |

## Usage

### Basic PiP Video Component
```vue
<template>
  <PiPVideo 
    :src="videoSrc"
    :show-pip-button="true"
    @pip-enter="onPiPEntered"
    @pip-exit="onPiPExited"
  />
</template>
```

### Jitsi Integration with PiP
```vue
<template>
  <div>
    <JitsiMeet 
      ref="jitsiRef"
      :room-name="roomName"
      :user-info="userInfo"
    />
    <button @click="togglePiP">Toggle PiP</button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { usePiP } from '@/composables/usePiP';

const jitsiRef = ref(null);

const { togglePiP } = usePiP(
  computed(() => jitsiRef.value?.videoElementRef),
  { width: 480, height: 320 }
);
</script>
```

## Implementation Details

### Secure Room Generation
Room names are generated using a SHA-256 hash of the consultation ID and a server-side salt to ensure privacy and prevent unauthorized access.

### Cross-Origin Handling
Due to browser security restrictions, accessing video elements within iframes requires special handling. The implementation gracefully degrades to fallback solutions when direct access isn't possible.

### Performance Considerations
- Efficient DOM manipulation to minimize reflows
- Cleanup of PiP windows and event listeners
- Memory leak prevention with proper lifecycle management

## Testing

The PiP functionality should be tested across different browsers and devices to ensure:
- Correct fallback behavior in unsupported browsers
- Proper cleanup of resources when components are destroyed
- Accessibility compliance
- Performance under various network conditions

## Future Enhancements

- Enhanced customization options for PiP window appearance
- Integration with additional video conferencing platforms
- Advanced positioning options for PiP windows
- Recording capabilities during PiP mode