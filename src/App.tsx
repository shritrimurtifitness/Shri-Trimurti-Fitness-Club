import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import Index from "./pages/Index";
import BookingPage from "./pages/BookingPage";
import TournamentDetails from "./pages/TournamentDetails";
import AdminLogin from "./pages/AdminLogin";
import AdminLayout from "./components/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminBookings from "./pages/admin/AdminBookings";
import AdminCalendar from "./pages/admin/AdminCalendar";
import AdminSlots from "./pages/admin/AdminSlots";
import AdminFacilities from "./pages/admin/AdminFacilities";
import AdminSchedules from "./pages/admin/AdminSchedules";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminFinance from "./pages/admin/AdminFinance";
import AdminTables from "./pages/admin/AdminTables";
import AdminPricing from "./pages/admin/AdminPricing";
import AdminGallery from "./pages/admin/AdminGallery";
import AdminTestimonials from "./pages/admin/AdminTestimonials";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminTournaments from "./pages/admin/AdminTournaments";
import AdminClosures from "./pages/admin/AdminClosures";
import AdminAdStudio from "./pages/admin/AdminAdStudio";
import AdminAuditLogs from "./pages/admin/AdminAuditLogs";
import AdminScanner from "./pages/admin/AdminScanner";
import AdminPresence from "./pages/admin/AdminPresence";
import AdminStaff from "./pages/admin/AdminStaff";
import StaffLogin from "./pages/StaffLogin";
import ForgotPassword from "./pages/admin/ForgotPassword";
import ResetPassword from "./pages/admin/ResetPassword";
import MyBookings from "./pages/MyBookings";
import NotFound from "./pages/NotFound";
import ScrollToTop from "./components/ScrollToTop";
import { CursorGlow } from "./components/CursorGlow";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("adminToken");
  if (!token) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <CursorGlow />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/book" element={<BookingPage />} />
            <Route path="/my-bookings" element={<MyBookings />} />
            <Route path="/tournaments/:id" element={<TournamentDetails />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/staff-login" element={<StaffLogin />} />
            <Route path="/admin/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="bookings" element={<AdminBookings />} />
              <Route path="calendar" element={<AdminCalendar />} />
              <Route path="scan" element={<AdminScanner />} />
              <Route path="presence" element={<AdminPresence />} />
              <Route path="tournaments" element={<AdminTournaments />} />
              <Route path="slots" element={<AdminSlots />} />
              <Route path="facilities" element={<AdminFacilities />} />
              <Route path="schedules" element={<AdminSchedules />} />
              <Route path="tables" element={<AdminTables />} />
              <Route path="closures" element={<AdminClosures />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="finance" element={<AdminFinance />} />
              <Route path="pricing" element={<AdminPricing />} />
              <Route path="gallery" element={<AdminGallery />} />
              <Route path="gallery" element={<AdminGallery />} />
              <Route path="testimonials" element={<AdminTestimonials />} />
              <Route path="ads" element={<AdminAdStudio />} />
              <Route path="audit-logs" element={<AdminAuditLogs />} />
              <Route path="staff" element={<AdminStaff />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
