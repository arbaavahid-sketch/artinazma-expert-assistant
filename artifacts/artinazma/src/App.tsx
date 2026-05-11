import { Switch, Route, Router as WouterRouter } from "wouter";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import AssistantPage from "@/pages/assistant";
import AnalyzePage from "@/pages/analyze";
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
import AdminRequestsPage from "@/pages/admin/requests";
import AdminSettingsPage from "@/pages/admin/settings";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/assistant" component={AssistantPage} />
      <Route path="/analyze" component={AnalyzePage} />
      <Route path="/customer-login" component={CustomerLoginPage} />
      <Route path="/customer-register" component={CustomerRegisterPage} />
      <Route path="/customer-dashboard" component={CustomerDashboardPage} />
      <Route path="/customer-request" component={CustomerRequestPage} />
      <Route path="/admin-login" component={AdminLoginPage} />
      <Route path="/admin-logout" component={AdminLogoutPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/admin/dashboard" component={DashboardPage} />
      <Route path="/admin/knowledge" component={KnowledgePage} />
      <Route path="/admin/questions" component={QuestionsPage} />
      <Route path="/admin/requests" component={AdminRequestsPage} />
      <Route path="/admin/settings" component={AdminSettingsPage} />
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
