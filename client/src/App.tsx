import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { AccessibilityToolbar } from "./components/AccessibilityToolbar";
import { AccessibilityProvider } from "./contexts/AccessibilityContext";
import { LangProvider } from "@/lib/lang";
import WelcomePage from "./pages/WelcomePage";
import SetupPage from "./pages/SetupPage";
import ExercisePage from "./pages/ExercisePage";
import PreviewReorder from "./pages/PreviewReorder";

function Router() {
  return (
    <Switch>
      <Route path="/" component={WelcomePage} />
      <Route path="/setup" component={SetupPage} />
      <Route path="/exercise" component={ExercisePage} />
      {/* Esempio locale senza dati, disponibile soltanto nell'anteprima. */}
      {import.meta.env.DEV && <Route path="/anteprima-riordino" component={PreviewReorder} />}
      <Route path="/404" component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <AccessibilityProvider>
          <LangProvider>
            <div className="min-h-dvh">
              <AccessibilityToolbar />
              <Toaster richColors position="top-center" />
              <Router />
            </div>
          </LangProvider>
        </AccessibilityProvider>
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
