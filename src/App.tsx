import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "./components/layout/AppShell";
import { AuthProvider } from "./contexts/AuthContext";
import { SeenPostsProvider } from "./contexts/SeenPostsContext";
import { BoardsProvider } from "./contexts/BoardsContext";
import { CategoryProvider } from "./contexts/CategoryContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import Discover from "./pages/Discover";
import Following from "./pages/Following";
import Broadcasts from "./pages/Broadcasts";
import Boards from "./pages/Boards";
import BoardDetail from "./pages/BoardDetail";
import Search from "./pages/Search";
import Notifications from "./pages/Notifications";
import Messages from "./pages/Messages";
import MessageThread from "./pages/MessageThread";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import EditProfile from "./pages/EditProfile";
import EditBusiness from "./pages/EditBusiness";
import Privacy from "./pages/settings/Privacy";
import NotificationSettings from "./pages/settings/Notifications";
import Blocked from "./pages/settings/Blocked";
import ChangePassword from "./pages/settings/ChangePassword";
import ChangeEmail from "./pages/settings/ChangeEmail";
import Sessions from "./pages/settings/Sessions";
import DeleteAccount from "./pages/settings/DeleteAccount";
import Access from "./pages/Access";
import AccessCompose from "./pages/AccessCompose";
import PostDetail from "./pages/PostDetail";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <BoardsProvider>
            <SeenPostsProvider>
              <CategoryProvider>
                <Routes>
                  <Route element={<AppShell />}>
                    <Route path="/" element={<Discover />} />
                    <Route path="/following" element={<Following />} />
                    <Route path="/broadcasts" element={<Broadcasts />} />
                    <Route path="/boards" element={<Boards />} />
                  </Route>
                  <Route path="/boards/:id" element={<BoardDetail />} />
                  <Route path="/search" element={<Search />} />
                  <Route
                    path="/notifications"
                    element={<ProtectedRoute><Notifications /></ProtectedRoute>}
                  />
                  <Route
                    path="/messages"
                    element={<ProtectedRoute><Messages /></ProtectedRoute>}
                  />
                  <Route
                    path="/messages/:id"
                    element={<ProtectedRoute><MessageThread /></ProtectedRoute>}
                  />
                  <Route path="/profile/:nametag" element={<Profile />} />
                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  <Route path="/settings/profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
                  <Route path="/settings/business" element={<ProtectedRoute><EditBusiness /></ProtectedRoute>} />
                  <Route path="/settings/privacy" element={<ProtectedRoute><Privacy /></ProtectedRoute>} />
                  <Route path="/settings/notifications" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
                  <Route path="/settings/blocked" element={<ProtectedRoute><Blocked /></ProtectedRoute>} />
                  <Route path="/settings/password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
                  <Route path="/settings/email" element={<ProtectedRoute><ChangeEmail /></ProtectedRoute>} />
                  <Route path="/settings/sessions" element={<ProtectedRoute><Sessions /></ProtectedRoute>} />
                  <Route path="/settings/delete" element={<ProtectedRoute><DeleteAccount /></ProtectedRoute>} />
                  <Route path="/access" element={<ProtectedRoute require="admin"><Access /></ProtectedRoute>} />
                  <Route path="/access/compose" element={<ProtectedRoute require="super_admin"><AccessCompose /></ProtectedRoute>} />
                  <Route path="/access/reports" element={<ProtectedRoute require="moderator"><Reports /></ProtectedRoute>} />
                  <Route path="/post/:id" element={<PostDetail />} />
                  <Route path="/admin" element={<Navigate to="/access" replace />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </CategoryProvider>
            </SeenPostsProvider>
          </BoardsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
