import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { AppLayout } from '../components/layout/AppLayout';
import { NotFoundPage } from './NotFoundPage';
import { RequireRole } from './RequireRole';
import { HomePage } from '../features/home/HomePage';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterDonorPage } from '../features/auth/RegisterDonorPage';
import { CheckerPage } from '../features/public-checker/CheckerPage';
import { RequestDetailPage } from '../features/requests/RequestDetailPage';
import { HospitalPage } from '../features/hospital/HospitalPage';
import { HospitalDashboardPage } from '../features/hospital/HospitalDashboardPage';
import { RequestsListPage } from '../features/hospital/RequestsListPage';
import { NewRequestPage } from '../features/hospital/NewRequestPage';
import { DonorPage } from '../features/donor/DonorPage';
import { DonorHomePage } from '../features/donor/DonorHomePage';
import { DonorProfilePage } from '../features/donor/DonorProfilePage';
import { CoordinatorPage } from '../features/coordinator/CoordinatorPage';
import { AdminPage } from '../features/admin/AdminPage';
import { OverviewPanel } from '../features/admin/OverviewPanel';
import { RequestsPanel } from '../features/admin/RequestsPanel';
import { HospitalsPanel } from '../features/admin/HospitalsPanel';
import { UsersPanel } from '../features/admin/UsersPanel';
import { DonorsPanel } from '../features/admin/DonorsPanel';
import { ReportsPanel } from '../features/admin/ReportsPanel';
import { AuditPanel } from '../features/admin/AuditPanel';

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
          { index: true, element: <HospitalDashboardPage /> },
          { path: 'requests', element: <RequestsListPage /> },
          { path: 'requests/new', element: <NewRequestPage /> },
          { path: 'requests/:id', element: <RequestDetailPage basePath="/hospital/requests" /> },
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
          { index: true, element: <Navigate to="overview" replace /> },
          { path: 'overview', element: <OverviewPanel /> },
          { path: 'requests', element: <RequestsPanel /> },
          { path: 'requests/:id', element: <RequestDetailPage basePath="/admin/requests" /> },
          { path: 'hospitals', element: <HospitalsPanel /> },
          { path: 'users', element: <UsersPanel /> },
          { path: 'donors', element: <DonorsPanel /> },
          { path: 'reports', element: <ReportsPanel /> },
          { path: 'audit', element: <AuditPanel /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
