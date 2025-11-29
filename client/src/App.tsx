import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import ResetPasswordPage from "@/pages/reset-password";
import OwnerDashboard from "@/pages/owner-dashboard";
import ManagerDashboard from "@/pages/manager-dashboard";
import CustomerTryOn from "@/pages/customer-tryon";

function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-2 p-4 border-b shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: ("company_owner" | "store_manager")[];
}) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 w-full max-w-md p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-1/2" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (user.mustResetPassword && location !== "/reset-password") {
    return <Redirect to="/reset-password" />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role as "company_owner" | "store_manager")) {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
}

function DashboardRouter() {
  const { user } = useAuth();

  if (!user) return null;

  if (user.role === "company_owner") {
    return (
      <Switch>
        <Route path="/dashboard" component={OwnerDashboard} />
        <Route path="/dashboard/stores" component={OwnerDashboard} />
        <Route path="/dashboard/analytics" component={OwnerDashboard} />
        <Route>
          <Redirect to="/dashboard" />
        </Route>
      </Switch>
    );
  }

  if (user.role === "store_manager") {
    return (
      <Switch>
        <Route path="/dashboard" component={ManagerDashboard} />
        <Route path="/dashboard/inventory" component={ManagerDashboard} />
        <Route path="/dashboard/sessions" component={ManagerDashboard} />
        <Route>
          <Redirect to="/dashboard" />
        </Route>
      </Switch>
    );
  }

  return null;
}

function AppRouter() {
  const { user, customerSession, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 w-full max-w-md p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Public customer try-on route */}
      <Route path="/">
        {() => {
          // Check for session token in URL
          const params = new URLSearchParams(window.location.search);
          const sessionToken = params.get("session");
          
          // If there's a session token or customer session, show try-on
          if (sessionToken || customerSession) {
            return <CustomerTryOn />;
          }
          
          // If user is logged in, redirect to dashboard
          if (user) {
            return <Redirect to="/dashboard" />;
          }
          
          // Otherwise show login
          return <Redirect to="/login" />;
        }}
      </Route>

      <Route path="/login">
        {() => {
          if (user) {
            return <Redirect to="/dashboard" />;
          }
          return <LoginPage />;
        }}
      </Route>

      <Route path="/reset-password">
        {() => {
          if (!user) {
            return <Redirect to="/login" />;
          }
          return <ResetPasswordPage />;
        }}
      </Route>

      <Route path="/dashboard">
        <ProtectedRoute>
          <DashboardLayout>
            <DashboardRouter />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard/:rest*">
        <ProtectedRoute>
          <DashboardLayout>
            <DashboardRouter />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <AppRouter />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
