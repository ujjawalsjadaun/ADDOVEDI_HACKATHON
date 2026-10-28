import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../test/renderApp';

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

const ready = (status: 'ready' | 'degraded', demoMode = false) => ({
  data: {
    status,
    db: status === 'ready' ? 'up' : 'down',
    demoMode,
    providers: { routing: 'simulated', weather: 'simulated', sms: 'simulated' },
  },
  meta: { requestId: 'test-req-0001' },
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('app shell', () => {
  it('renders the home page with navigation to every area', async () => {
    mockFetch(200, ready('ready'));
    renderApp('/');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/verified blood requests/i);
    const nav = screen.getAllByRole('navigation', { name: 'Primary' })[0]!;
    for (const label of ['Is this real?', 'Ask for blood', 'Sign in']) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(await screen.findByText('Server connected')).toBeInTheDocument();
  });

  it('shows degraded server status and the demo-mode label', async () => {
    mockFetch(503, ready('degraded', true));
    renderApp('/');
    expect(await screen.findByText(/database unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/simulated SMS/i)).toBeInTheDocument();
  });

  it('shows server unreachable when fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    renderApp('/');
    expect(await screen.findByText('Server unreachable')).toBeInTheDocument();
  });

  it('navigates between areas', async () => {
    mockFetch(200, ready('ready'));
    renderApp('/');
    const nav = screen.getAllByRole('navigation', { name: 'Primary' })[0]!;
    await userEvent.click(within(nav).getByRole('link', { name: 'Is this real?' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Is this request real?');
  });

  it('renders not-found for unknown paths', () => {
    mockFetch(200, ready('ready'));
    renderApp('/does-not-exist');
    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });

  it('shows the offline banner when the browser goes offline', async () => {
    mockFetch(200, ready('ready'));
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    renderApp('/');
    expect(screen.queryByText(/you are offline/i)).not.toBeInTheDocument();
    onLine.mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText(/you are offline/i)).toBeInTheDocument();
  });
});
