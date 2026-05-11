import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import AdminGuard from "@/components/admin-guard";
import CustomerGuard from "@/components/customer-guard";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import AssistantPage from "@/pages/assistant";
import AnalyzePage from "@/pages/analyze";
import MemoryPage from "@/pages/memory";
import CustomerLoginPage from "@/pages/customer-login";
import CustomerRegisterPage from "@/pages/customer-register";
import CustomerDashboardPage from "@/pages/customer-dashboard";
import CustomerRequestPage from "@/pages/customer-request";
import AdminLoginPage from "@/pages/admin-login";
import AdminLogoutPage from "@/pages/admin-logout";
import AdminPage from "@/pages/admin/index";
import DashboardPage from "@/pages/admin/dashboard";
import KnowledgePage from "@/pages/admin/knowledge";
import QuestionsPage from "@/pages/admin/questions";
import QuestionDetailPage from "@/pages/admin/question-detail";
import AdminRequestsPage from "@/pages/admin/requests";
import AdminSettingsPage from "@/pages/admin/settings";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />

      <Route path="/customer-login" component={CustomerLoginPage} />
      <Route path="/customer-register" component={CustomerRegisterPage} />
      <Route path="/admin-login" component={AdminLoginPage} />
      <Route path="/admin-logout" component={AdminLogoutPage} />

      <Route path="/assistant">
        <CustomerGuard><AssistantPage /></CustomerGuard>
      </Route>
      <Route path="/analyze">
        <CustomerGuard><AnalyzePage /></CustomerGuard>
      </Route>
      <Route path="/memory">
        <CustomerGuard><MemoryPage /></CustomerGuard>
      </Route>
      <Route path="/customer-dashboard">
        <CustomerGuard><CustomerDashboardPage /></CustomerGuard>
      </Route>
      <Route path="/customer-request">
        <CustomerGuard><CustomerRequestPage /></CustomerGuard>
      </Route>

      <Route path="/admin">
        <AdminGuard><AdminPage /></AdminGuard>
      </Route>
      <Route path="/admin/dashboard">
        <AdminGuard><DashboardPage /></AdminGuard>
      </Route>
      <Route path="/admin/knowledge">
        <AdminGuard><KnowledgePage /></AdminGuard>
      </Route>
      <Route path="/admin/questions/:id">
        <AdminGuard><QuestionDetailPage /></AdminGuard>
      </Route>
      <Route path="/admin/questions">
        <AdminGuard><QuestionsPage /></AdminGuard>
      </Route>
      <Route path="/admin/requests">
        <AdminGuard><AdminRequestsPage /></AdminGuard>
      </Route>
      <Route path="/admin/settings">
        <AdminGuard><AdminSettingsPage /></AdminGuard>
      </Route>

      <Route path="/dashboard">
        <Redirect to="/admin/dashboard" />
      </Route>
      <Route path="/knowledge">
        <Redirect to="/admin/knowledge" />
      </Route>
      <Route path="/questions/:id">
        {(params) => <Redirect to={`/admin/questions/${params.id}`} />}
      </Route>
      <Route path="/questions">
        <Redirect to="/admin/questions" />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Router />
    </WouterRouter>
  );
}

export default App;
