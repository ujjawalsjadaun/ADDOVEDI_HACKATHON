import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { AppLayout } from '../components/layout/AppLayout';
import { NotFoundPage } from './NotFoundPage';
import { RequireRole } from './RequireRole';
import { HomePage } from '../features/home/HomePage';
import { LoginPage } from '../features/auth/LoginPage';
import { CheckerPage } from '../features/public-checker/CheckerPage';
import { HospitalPage } from '../features/hospital/HospitalPage';
import { RequestsListPage } from '../features/hospital/RequestsListPage';
import { NewRequestPage } from '../features/hospital/NewRequestPage';
import { RequestDetailPage } from '../features/hospital/RequestDetailPage';
import { DonorPage } from '../features/donor/DonorPage';
import { DonorHomePage } from '../features/donor/DonorHomePage';
import { DonorProfilePage } from '../features/donor/DonorProfilePage';
import { RegisterDonorPage } from '../features/auth/RegisterDonorPage';
import { DonorsPanel } from '../features/admin/DonorsPanel';
import { CoordinatorPage } from '../features/coordinator/CoordinatorPage';
import { AdminPage } from '../features/admin/AdminPage';
import { HospitalsPanel } from '../features/admin/HospitalsPanel';
import { UsersPanel } from '../features/admin/UsersPanel';

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterDonorPage /> },
      { path: 'check', element: <CheckerPage /> },
      { path: 'check/:code', element: <CheckerPage /> },
      {
        path: 'hospital',
        element: (
          <RequireRole roles={['hospital_staff']}>
            <HospitalPage />
          </RequireRole>
        ),
        children: [
          { index: true, element: <RequestsListPage /> },
          { path: 'requests/new', element: <NewRequestPage /> },
          { path: 'requests/:id', element: <RequestDetailPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      {
        path: 'donor',
        element: (
          <RequireRole roles={['donor']}>
            <DonorPage />
          </RequireRole>
        ),
        children: [
          { index: true, element: <DonorHomePage /> },
          { path: 'profile', element: <DonorProfilePage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      {
        path: 'coordinator/*',
        element: (
          <RequireRole roles={['coordinator']}>
            <CoordinatorPage />
          </RequireRole>
        ),
      },
      {
        path: 'admin',
        element: (
          <RequireRole roles={['admin']}>
            <AdminPage />
          </RequireRole>
        ),
        children: [
          { index: true, element: <Navigate to="hospitals" replace /> },
          { path: 'hospitals', element: <HospitalsPanel /> },
          { path: 'users', element: <UsersPanel /> },
          { path: 'donors', element: <DonorsPanel /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
