import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/test', () => {
    return HttpResponse.json({ message: 'Hello from mocked API!' });
  }),
];
