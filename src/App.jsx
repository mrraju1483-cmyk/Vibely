import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import LoadingState from './components/LoadingState.jsx'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
const VerifyOtpPage = lazy(() => import('./pages/VerifyOtpPage.jsx'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage.jsx'))
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
const HomePage = lazy(() => import('./pages/HomePage.jsx'))
const ExplorePage = lazy(() => import('./pages/ExplorePage.jsx'))
const CreatePostPage = lazy(() => import('./pages/CreatePostPage.jsx'))
const ChatPage = lazy(() => import('./pages/ChatPage.jsx'))
const CallsPage = lazy(() => import('./pages/CallsPage.jsx'))
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'))
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage.jsx'))
const PostPage = lazy(() => import('./pages/PostPage.jsx'))
const VibelyAIPage = lazy(() => import('./pages/VibelyAIPage.jsx'))
const ReelsPage = lazy(() => import('./pages/ReelsPage.jsx'))
const CreateReelPage = lazy(() => import('./pages/CreateReelPage.jsx'))
const HashtagPage = lazy(() => import('./pages/HashtagPage.jsx'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage.jsx'))
const AdminRoute = lazy(() => import('./components/admin/AdminRoute.jsx'))
const AdminShell = lazy(() => import('./components/admin/AdminShell.jsx'))
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage.jsx'))
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage.jsx'))
const AdminUserPage = lazy(() => import('./pages/admin/AdminUserPage.jsx'))
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage.jsx'))
const AdminContentPage = lazy(() => import('./pages/admin/AdminContentPage.jsx'))
const AdminAuditPage = lazy(() => import('./pages/admin/AdminAuditPage.jsx'))

export default function App() {
  return (
    <Suspense fallback={<LoadingState />}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route element={<ProtectedRoute />}>
      <Route element={<Layout />}>
        <Route path="/home" element={<HomePage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/create" element={<CreatePostPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/calls" element={<CallsPage />} />
        <Route path="/chat/:id" element={<ChatPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/post/:id" element={<PostPage />} />
        <Route path="/ai" element={<VibelyAIPage />} />
        <Route path="/reels" element={<ReelsPage />} />
        <Route path="/reels/new" element={<CreateReelPage />} />
        <Route path="/reels/:id" element={<ReelsPage />} />
        <Route path="/hashtag/:name" element={<HashtagPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/:id" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/admin" element={<AdminRoute />}>
          <Route element={<AdminShell />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="users/:id" element={<AdminUserPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="content" element={<AdminContentPage />} />
            <Route path="audit" element={<AdminAuditPage />} />
          </Route>
        </Route>
      </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}
