/**
 * Twilio WhatsApp Provider Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TwilioWhatsAppProvider } from '../whatsapp.provider.js';
import { WhatsAppError } from '../whatsapp.base.js';

// Mock environment variables
const mockEnv = {
  TWILIO_ACCOUNT_SID: 'AC_test_account_sid',
  TWILIO_AUTH_TOKEN: 'test_auth_token',
  TWILIO_WHATSAPP_NUMBER: 'whatsapp:+14155238886',
};

describe('TwilioWhatsAppProvider', () => {
  let provider: TwilioWhatsAppProvider;

  beforeEach(() => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', mockEnv.TWILIO_ACCOUNT_SID);
    vi.stubEnv('TWILIO_AUTH_TOKEN', mockEnv.TWILIO_AUTH_TOKEN);
    vi.stubEnv('TWILIO_WHATSAPP_NUMBER', mockEnv.TWILIO_WHATSAPP_NUMBER);

    provider = new TwilioWhatsAppProvider();
  });

  describe('constructor', () => {
    it('should create provider with default config from env', () => {
      expect(provider).toBeDefined();
    });

    it('should create provider with custom config', () => {
      const customProvider = new TwilioWhatsAppProvider({
        accountSid: 'custom_sid',
        authToken: 'custom_token',
        fromPhoneNumber: 'whatsapp:+593999999999',
        baseUrl: 'https://custom.api.com',
      });
      expect(customProvider).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with valid config', async () => {
      await expect(provider.initialize()).resolves.not.toThrow();
    });

    it('should throw error if account SID is missing', async () => {
      vi.stubEnv('TWILIO_ACCOUNT_SID', '');
      const invalidProvider = new TwilioWhatsAppProvider();
      await expect(invalidProvider.initialize()).rejects.toThrow('TWILIO_ACCOUNT_SID');
    });

    it('should throw error if auth token is missing', async () => {
      vi.stubEnv('TWILIO_AUTH_TOKEN', '');
      const invalidProvider = new TwilioWhatsAppProvider();
      await expect(invalidProvider.initialize()).rejects.toThrow('TWILIO_AUTH_TOKEN');
    });

    it('should throw error if WhatsApp number is missing', async () => {
      vi.stubEnv('TWILIO_WHATSAPP_NUMBER', '');
      const invalidProvider = new TwilioWhatsAppProvider();
      await expect(invalidProvider.initialize()).rejects.toThrow('TWILIO_WHATSAPP_NUMBER');
    });

    it('should throw error if WhatsApp number format is invalid', async () => {
      vi.stubEnv('TWILIO_WHATSAPP_NUMBER', '+14155238886'); // Missing 'whatsapp:' prefix
      const invalidProvider = new TwilioWhatsAppProvider();
      await expect(invalidProvider.initialize()).rejects.toThrow('whatsapp:+');
    });
  });

  describe('sendMessage', () => {
    it('should send message with correct structure', async () => {
      const request = {
        to: '+593999999999',
        body: 'Hello from Galeno',
      };

      // Mock axios post
      const mockPost = vi.fn().mockResolvedValue({
        data: {
          sid: 'SM_test_message_id',
          status: 'sent',
          date_created: new Date().toISOString(),
          to: 'whatsapp:+593999999999',
        },
      });

      (provider as any).client = {
        post: mockPost,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      };

      const result = await provider.sendMessage(request);

      expect(mockPost).toHaveBeenCalledWith(
        '/Messages.json',
        expect.stringContaining('From=whatsapp%3A%2B14155238886')
      );

      expect(result).toEqual({
        messageId: 'SM_test_message_id',
        status: 'sent',
        to: 'whatsapp:+593999999999',
        timestamp: expect.any(Date),
      });
    });

    it('should format phone number with Ecuador country code', async () => {
      const request = {
        to: '0999999999', // Local format
        body: 'Test message',
      };

      const mockPost = vi.fn().mockResolvedValue({
        data: { sid: 'SM_test', status: 'sent', date_created: new Date().toISOString() },
      });

      (provider as any).client = {
        post: mockPost,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      };

      await provider.sendMessage(request);

      expect(mockPost).toHaveBeenCalledWith(
        '/Messages.json',
        expect.stringContaining('whatsapp%3A%2B593999999999')
      );
    });

    it('should handle API errors gracefully', async () => {
      const request = {
        to: '+593999999999',
        body: 'Test message',
      };

      const mockPost = vi.fn().mockRejectedValue({
        response: {
          data: { message: 'Invalid phone number', code: '21211' },
        },
      });

      (provider as any).client = {
        post: mockPost,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      };

      const result = await provider.sendMessage(request);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Invalid phone number');
      expect(result.errorCode).toBe('21211');
    });
  });

  describe('sendTemplate', () => {
    it('should send template message with variables', async () => {
      const request = {
        to: '+593999999999',
        templateName: 'appointment_reminder_24h',
        language: 'es',
        variables: ['John Doe', 'Dr. Smith', '2024-03-10 10:00 AM'],
      };

      const mockPost = vi.fn().mockResolvedValue({
        data: { sid: 'SM_test', status: 'sent', date_created: new Date().toISOString() },
      });

      (provider as any).client = {
        post: mockPost,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      };

      const result = await provider.sendTemplate(request);

      expect(mockPost).toHaveBeenCalledWith(
        '/Messages.json',
        expect.stringContaining('ContentSid=appointment_reminder_24h')
      );

      expect(result.status).toBe('sent');
    });

    it('should handle template errors gracefully', async () => {
      const request = {
        to: '+593999999999',
        templateName: 'invalid_template',
        language: 'es',
      };

      const mockPost = vi.fn().mockRejectedValue({
        response: {
          data: { message: 'Template not approved', code: '21217' },
        },
      });

      (provider as any).client = {
        post: mockPost,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      };

      const result = await provider.sendTemplate(request);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Template not approved');
    });
  });

  describe('sendAppointmentReminder24h', () => {
    it('should send 24h reminder with template', async () => {
      const data = {
        pacienteNombre: 'John Doe',
        doctorNombre: 'Dr. Smith',
        fechaHora: '2024-03-10 10:00 AM',
        tipo: 'presencial' as const,
        ubicacion: 'Main Street 123',
      };

      const mockPost = vi.fn().mockResolvedValue({
        data: { sid: 'SM_test', status: 'sent', date_created: new Date().toISOString() },
      });

      (provider as any).client = {
        post: mockPost,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      };

      const result = await provider.sendAppointmentReminder24h('+593999999999', data);

      expect(result.status).toBe('sent');
      expect(mockPost).toHaveBeenCalled();
    });

    it('should fallback to simple message if template fails', async () => {
      const data = {
        pacienteNombre: 'John Doe',
        doctorNombre: 'Dr. Smith',
        fechaHora: '2024-03-10 10:00 AM',
        tipo: 'teleconsulta' as const,
        linkVideo: 'https://meet.google.com/test',
      };

      // First call (template) fails, second call (fallback) succeeds
      const mockPost = vi
        .fn()
        .mockRejectedValueOnce({
          response: { data: { message: 'Template error' } },
        })
        .mockResolvedValueOnce({
          data: { sid: 'SM_fallback', status: 'sent', date_created: new Date().toISOString() },
        });

      (provider as any).client = {
        post: mockPost,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      };

      const result = await provider.sendAppointmentReminder24h('+593999999999', data);

      expect(mockPost).toHaveBeenCalledTimes(2); // Template + fallback
      expect(result.messageId).toBe('SM_fallback');
    });
  });

  describe('sendAppointmentReminder1h', () => {
    it('should send 1h urgent reminder', async () => {
      const data = {
        pacienteNombre: 'John Doe',
        doctorNombre: 'Dr. Smith',
        fechaHora: '10:00 AM',
        tipo: 'teleconsulta' as const,
        linkVideo: 'https://meet.google.com/test',
      };

      const mockPost = vi.fn().mockResolvedValue({
        data: { sid: 'SM_test', status: 'sent', date_created: new Date().toISOString() },
      });

      (provider as any).client = {
        post: mockPost,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      };

      const result = await provider.sendAppointmentReminder1h('+593999999999', data);

      expect(result.status).toBe('sent');
    });
  });

  describe('sendTeleconsultaLink', () => {
    it('should send teleconsulta link', async () => {
      const data = {
        pacienteNombre: 'John Doe',
        doctorNombre: 'Dr. Smith',
        fechaHora: '2024-03-10 10:00 AM',
        linkVideo: 'https://meet.google.com/test',
      };

      const mockPost = vi.fn().mockResolvedValue({
        data: { sid: 'SM_test', status: 'sent', date_created: new Date().toISOString() },
      });

      (provider as any).client = {
        post: mockPost,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      };

      const result = await provider.sendTeleconsultaLink('+593999999999', data);

      expect(result.status).toBe('sent');
    });
  });

  describe('getMessageStatus', () => {
    it('should get message status', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: {
          sid: 'SM_test',
          status: 'delivered',
          date_updated: new Date().toISOString(),
        },
      });

      (provider as any).client = {
        get: mockGet,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      };

      const result = await provider.getMessageStatus('SM_test');

      expect(mockGet).toHaveBeenCalledWith('/Messages/SM_test.json');
      expect(result.status).toBe('delivered');
    });

    it('should throw error if status check fails', async () => {
      const mockGet = vi.fn().mockRejectedValue({
        response: { data: { message: 'Message not found' } },
      });

      (provider as any).client = {
        get: mockGet,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      };

      await expect(provider.getMessageStatus('SM_invalid')).rejects.toThrow(
        'Failed to get message status'
      );
    });
  });

  describe('handleWebhook', () => {
    it('should reject webhook without signature', async () => {
      const payload = { MessageSid: 'SM_test', MessageStatus: 'delivered' };

      const result = await provider.handleWebhook(payload);

      expect(result.success).toBe(false);
      expect(result.error).toContain('signature');
    });

    it('should process valid webhook', async () => {
      const payload = {
        MessageSid: 'SM_test',
        MessageStatus: 'delivered',
        To: 'whatsapp:+593999999999',
        'X-Twilio-Signature': 'test_signature',
      };

      const result = await provider.handleWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('SM_test');
      expect(result.event).toBe('message_delivered');
    });

    it('should map Twilio status to events correctly', async () => {
      const testCases = [
        { status: 'sent', expectedEvent: 'message_sent' },
        { status: 'delivered', expectedEvent: 'message_delivered' },
        { status: 'read', expectedEvent: 'message_read' },
        { status: 'failed', expectedEvent: 'message_failed' },
        { status: 'undelivered', expectedEvent: 'message_failed' },
      ];

      for (const { status, expectedEvent } of testCases) {
        const payload = {
          MessageSid: `SM_${status}`,
          MessageStatus: status,
          'X-Twilio-Signature': 'test_signature',
        };

        const result = await provider.handleWebhook(payload);

        expect(result.event).toBe(expectedEvent);
      }
    });
  });

  describe('formatPhoneNumber', () => {
    it('should format local Ecuador number', () => {
      const formatted = (provider as any).formatPhoneNumber('0999999999');
      expect(formatted).toBe('+593999999999');
    });

    it('should format number with country code', () => {
      const formatted = (provider as any).formatPhoneNumber('593999999999');
      expect(formatted).toBe('+593999999999');
    });

    it('should format number with + prefix', () => {
      const formatted = (provider as any).formatPhoneNumber('+593999999999');
      expect(formatted).toBe('+593999999999');
    });

    it('should remove non-numeric characters', () => {
      const formatted = (provider as any).formatPhoneNumber('(099) 999-9999');
      expect(formatted).toBe('+5930999999999');
    });
  });
});
