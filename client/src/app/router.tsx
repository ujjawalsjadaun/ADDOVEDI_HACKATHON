import { createBrowserRouter, type RouteObject } from 'react-router';
import { AppLayout } from '../components/layout/AppLayout';
import { NotFoundPage } from './NotFoundPage';
import { HomePage } from '../features/home/HomePage';
import { CheckerPage } from '../features/public-checker/CheckerPage';
import { HospitalPage } from '../features/hospital/HospitalPage';
import { DonorPage } from '../features/donor/DonorPage';
import { CoordinatorPage } from '../features/coordinator/CoordinatorPage';
import { AdminPage } from '../features/admin/AdminPage';

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'check', element: <CheckerPage /> },
      { path: 'check/:code', element: <CheckerPage /> },
      { path: 'hospital/*', element: <HospitalPage /> },
      { path: 'donor/*', element: <DonorPage /> },
      { path: 'coordinator/*', element: <CoordinatorPage /> },
      { path: 'admin/*', element: <AdminPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
