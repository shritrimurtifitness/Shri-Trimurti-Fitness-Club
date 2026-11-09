import { useState, useMemo } from "react";
import { useNavigate, Link, Outlet, useLocation } from "react-router-dom";
import logoImage from "@/assets/logo.png";
import { LayoutDashboard, Calendar, CalendarDays, Settings, LogOut, BarChart3, Menu, X, Layers, Clock, Timer, DollarSign, Image as LucideImage, MessageSquare, Sun, Moon, Trophy, Megaphone, Shield, Users, QrCode, Activity, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";
import { title } from "process";

interface SidebarLink {
  name: string;
  path: string;
  icon: any;
  adminOnly?: boolean;
}

interface SidebarGroup {
  title: string;
  links: SidebarLink[];
}

const sidebarGroups: SidebarGroup[] = [
  {
    title: "Overview",
    links: [
      { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
      { name: "Scan Entry", path: "/admin/scan", icon: QrCode },
      { name: "Live Presence", path: "/admin/presence", icon: Activity },

    ]
  },
  {
    title: "Finance",
    links: [
      { name: "Analytics", path: "/admin/analytics", icon: BarChart3 },
      { name: "Finance", path: "/admin/finance", icon: DollarSign },
    ]
  },
  {
    title: "Management",
    links: [
      { name: "Calendar", path: "/admin/calendar", icon: CalendarDays },
      { name: "Bookings", path: "/admin/bookings", icon: Calendar },
      { name: "Daily Slots", path: "/admin/slots", icon: Settings },
      { name: "Live Tables", path: "/admin/tables", icon: Timer },
      { name: "Weekly Schedule", path: "/admin/schedules", icon: Clock },
      { name: "Pricing Plans", path: "/admin/pricing", icon: DollarSign },
      { name: "Sports Events", path: "/admin/facilities", icon: Layers },
      { name: "Tournaments", path: "/admin/tournaments", icon: Trophy },
      { name: "Dynamic Closures", path: "/admin/closures", icon: Lock },
    ]
  },
  {
    title: "Marketing",
    links: [
      { name: "Gallery", path: "/admin/gallery", icon: LucideImage },
      { name: "Testimonials", path: "/admin/testimonials", icon: MessageSquare },
      { name: "Ad Studio", path: "/admin/ads", icon: Megaphone },
    ]
  },
  {
    title: "System",
    links: [
      { name: "Audit Logs", path: "/admin/audit-logs", icon: Shield },
      { name: "Staff Management", path: "/admin/staff", icon: Users, adminOnly: true },
      { name: "Settings Hub", path: "/admin/settings", icon: Settings },
    ]
  }
];

// Flat list for layout titles and permission checks
const allSidebarLinks = sidebarGroups.flatMap(g => g.links);

function parseJwt(token: string): any {
  try {
    const base64 = token.split('.')[1];
    return JSON.parse(atob(base64));
  } catch { return null; }
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const tokenData = useMemo(() => {
    const token = localStorage.getItem("adminToken");
    return token ? parseJwt(token) : null;
  }, []);

  const isAdmin = tokenData?.role === "admin";
  const allowedTabs: string[] = tokenData?.allowed_tabs || [];

  const sidebarLinks = useMemo(() => {
    if (isAdmin) return allSidebarLinks; // Admin sees everything
    // Staff: filter to allowed tabs + Dashboard (always)
    return allSidebarLinks.filter(link =>
      link.path === "/admin" || // Dashboard always
      (!link.adminOnly && allowedTabs.includes(link.path))
    );
  }, [isAdmin, allowedTabs]);


  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    navigate("/admin/login");
  };

  // Block staff from accessing non-allowed routes via URL
  const isBlocked = !isAdmin && location.pathname !== "/admin" && !allowedTabs.includes(location.pathname);

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 flex flex-col lg:translate-x-0 lg:static ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-2 px-6 h-16 border-b border-border min-w-0 overflow-hidden">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-white/5 border border-white/10 shrink-0">
            <img src={logoImage} alt="Logo" className="w-full h-full object-cover scale-110" />
          </div>
          <span className="font-heading font-bold text-foreground truncate">Shri Trimurti Sports Arena <span className="text-primary text-xs">{isAdmin ? "Admin" : "Staff"}</span></span>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden ml-auto text-muted-foreground shrink-0"><X size={20} /></button>
        </div>
        <nav className="p-4 space-y-6 flex-1 overflow-y-auto scrollbar-thin">
          {sidebarGroups.map((group) => {
            const filteredLinks = group.links.filter(link =>
              isAdmin ||
              link.path === "/admin" ||
              (!link.adminOnly && allowedTabs.includes(link.path))
            );

            if (filteredLinks.length === 0) return null;

            return (
              <div key={group.title} className="space-y-1">
                <h4 className="px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 opacity-50">
                  {group.title}
                </h4>
                {filteredLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 group ${location.pathname === link.path
                      ? "bg-primary/10 text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                      }`}
                  >
                    <link.icon className={`w-4 h-4 transition-transform duration-200 ${location.pathname === link.path ? "scale-110" : "group-hover:scale-110"
                      }`} />
                    <span>{link.name}</span>
                  </Link>
                ))}
              </div>
            )
          })}
        </nav>
        <div className="p-4 border-t border-border/50">
          <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-muted-foreground hover:text-destructive">
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-background/80 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 border-b border-border flex items-center px-4 lg:px-8 gap-4">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-muted-foreground"><Menu size={20} /></button>
          <h2 className="font-heading font-semibold text-foreground">
            {allSidebarLinks.find((l) => l.path === location.pathname)?.name || "Dashboard"}
          </h2>
          <button
            onClick={toggleTheme}
            className="ml-auto w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </header>
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {isBlocked ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Shield className="w-12 h-12 text-destructive mb-4" />
              <h3 className="font-heading text-xl font-bold text-foreground mb-2">Access Restricted</h3>
              <p className="text-muted-foreground text-sm max-w-md">You do not have permission to access this page. Contact your admin to request access.</p>
              <Button variant="outline" className="mt-4" onClick={() => navigate("/admin")}>Go to Dashboard</Button>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
