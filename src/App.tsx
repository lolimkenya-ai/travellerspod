import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "./components/layout/AppShell";
import { AuthProvider } from "./contexts/AuthContext";
import { SeenPostsProvider } from "./contexts/SeenPostsContext";
import { BoardsProvider } from "./contexts/BoardsContext";
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
              <Routes>
                <Route element={<AppShell />}>
                  <Route path="/" element={<Discover />} />
                  <Route path="/following" element={<Following />} />
                  <Route path="/broadcasts" element={<Broadcasts />} />
                  <Route path="/boards" element={<Boards />} />
                </Route>
                <Route path="/boards/:id" element={<BoardDetail />} />
                <Route path="/search" element={<Search />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/messages/:id" element={<MessageThread />} />
                <Route path="/profile/:nametag" element={<Profile />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </SeenPostsProvider>
          </BoardsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
