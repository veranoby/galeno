import { ref, Ref, onUnmounted, computed } from 'vue';
import { generateSecureRoomName } from '@/utils/crypto';

export interface JitsiOptions {
  domain?: string;
  roomName: string;
  jwtToken?: string;
  userInfo: {
    displayName: string;
    email?: string;
    avatar?: string;
  };
  configOverwrite?: Record<string, any>;
  interfaceConfigOverwrite?: Record<string, any>;
}

export interface UseJitsiReturn {
  isActive: Ref<boolean>;
  isAudioMuted: Ref<boolean>;
  isVideoMuted: Ref<boolean>;
  isSupported: Ref<boolean>;
  roomName: Ref<string>;
  jitsiConfig: Ref<JitsiOptions>;
  initializeJitsi: (options: JitsiOptions) => Promise<void>;
  toggleAudio: () => void;
  toggleVideo: () => void;
  endCall: () => void;
  joinRoom: (roomName: string) => void;
  leaveRoom: () => void;
}

/**
 * Composable for managing Jitsi Meet integration
 */
export function useJitsi(consultaId: string, tokenAcceso: string): UseJitsiReturn {
  const isActive = ref(false);
  const isAudioMuted = ref(false);
  const isVideoMuted = ref(false);
  const isSupported = ref(true); // Assume supported initially
  const roomName = ref('');
  const api = ref<any>(null);
  const jitsiConfig = ref<JitsiOptions>({
    domain: 'meet.jit.si',
    roomName: '',
    userInfo: {
      displayName: 'Doctor',
    },
    configOverwrite: {
      startWithAudioMuted: false,
      startWithVideoMuted: false,
      prejoinPageEnabled: false,
      disableDeepLinking: true,
    },
    interfaceConfigOverwrite: {
      SHOW_JITSI_WATERMARK: false,
      SHOW_WATERMARK_FOR_GUESTS: false,
      DEFAULT_BACKGROUND: '#f0f4f8',
      TOOLBAR_BUTTONS: [
        'microphone', 'camera', 'closedcaptions', 'desktop',
        'fullscreen', 'fodeviceselection', 'hangup',
        'profile', 'chat', 'recording', 'livestreaming',
        'etherpad', 'sharedvideo', 'settings', 'raisehand',
        'videoquality', 'filmstrip', 'invite', 'feedback',
        'stats', 'shortcuts', 'tileview', 'videobackgroundblur',
        'download', 'help', 'mute-everyone', 'security'
      ],
    },
  });

  // Generate secure room name
  const generateSecureRoomNameAsync = async (): Promise<string> => {
    if (!consultaId || !process.env.VITE_JITSI_SALT) {
      // Fallback to a random room name if we don't have the required values
      return `galeno-${Math.random().toString(36).substring(2, 10)}`;
    }
    
    return generateSecureRoomName(consultaId, process.env.VITE_JITSI_SALT);
  };

  // Initialize Jitsi
  const initializeJitsi = async (options: JitsiOptions) => {
    // Update config with provided options
    Object.assign(jitsiConfig.value, options);
    
    // Ensure we have a secure room name
    if (!jitsiConfig.value.roomName) {
      jitsiConfig.value.roomName = await generateSecureRoomNameAsync();
    }
    
    roomName.value = jitsiConfig.value.roomName;
    
    // Load Jitsi script dynamically if not already loaded
    if (!(window as any).JitsiMeetExternalAPI) {
      await loadJitsiScript(jitsiConfig.value.domain || 'meet.jit.si');
    }
    
    // Create the API instance
    try {
      // @ts-ignore - JitsiMeetExternalAPI may not be typed
      api.value = new window.JitsiMeetExternalAPI(
        jitsiConfig.value.domain,
        {
          roomName: jitsiConfig.value.roomName,
          width: '100%',
          height: '100%',
          configOverwrite: jitsiConfig.value.configOverwrite,
          interfaceConfigOverwrite: jitsiConfig.value.interfaceConfigOverwrite,
          jwt: jitsiConfig.value.jwtToken,
        }
      );

      // Set user info
      api.value.executeCommand('displayName', jitsiConfig.value.userInfo.displayName);
      if (jitsiConfig.value.userInfo.email) {
        api.value.executeCommand('email', jitsiConfig.value.userInfo.email);
      }
      if (jitsiConfig.value.userInfo.avatar) {
        api.value.executeCommand('avatarUrl', jitsiConfig.value.userInfo.avatar);
      }

      // Set up event listeners
      api.value.on('videoConferenceJoined', () => {
        isActive.value = true;
      });

      api.value.on('videoConferenceLeft', () => {
        isActive.value = false;
      });

      api.value.on('audioMuteStatusChanged', (status: { muted: boolean }) => {
        isAudioMuted.value = status.muted;
      });

      api.value.on('videoMuteStatusChanged', (status: { muted: boolean }) => {
        isVideoMuted.value = status.muted;
      });

      api.value.on('participantJoined', (participant: any) => {
        console.log('Participant joined:', participant);
      });

      api.value.on('participantLeft', (id: string) => {
        console.log('Participant left:', id);
      });
    } catch (error) {
      console.error('Failed to initialize Jitsi:', error);
      isSupported.value = false;
      throw error;
    }
  };

  // Load Jitsi script dynamically
  const loadJitsiScript = (domain: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Check if script is already loaded
      if (document.querySelector(`script[src*="${domain}/external_api.js"]`)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://${domain}/external_api.js`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Jitsi API'));
      document.head.appendChild(script);
    });
  };

  // Toggle audio
  const toggleAudio = () => {
    if (api.value) {
      api.value.executeCommand('toggleAudio');
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (api.value) {
      api.value.executeCommand('toggleVideo');
    }
  };

  // End call
  const endCall = () => {
    if (api.value) {
      api.value.executeCommand('hangup');
      isActive.value = false;
    }
  };

  // Join a specific room
  const joinRoom = (newRoomName: string) => {
    if (api.value) {
      // Note: Jitsi doesn't support changing rooms directly, so we'd need to recreate the instance
      console.warn('Joining different rooms requires recreating the Jitsi instance');
    }
  };

  // Leave room
  const leaveRoom = () => {
    endCall();
  };

  // Cleanup on unmount
  onUnmounted(() => {
    if (api.value) {
      api.value.dispose();
    }
  });

  return {
    isActive,
    isAudioMuted,
    isVideoMuted,
    isSupported,
    roomName,
    jitsiConfig,
    initializeJitsi,
    toggleAudio,
    toggleVideo,
    endCall,
    joinRoom,
    leaveRoom
  };
}