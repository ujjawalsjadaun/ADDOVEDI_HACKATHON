import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router';

export function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
