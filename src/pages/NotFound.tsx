import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background blueprint-grid">
      <div className="text-center animate-reveal relative">
        <span className="micro-label absolute -top-8 left-1/2 -translate-x-1/2">error / route not found</span>
        {/* Large engineered 404 */}
        <h1 className="text-[clamp(7rem,22vw,12rem)] text-primary leading-none mb-4 type-engineered">
          404
        </h1>
        <p className="type-eyebrow text-foreground mb-3">Page not found</p>
        <p className="text-xs text-muted-foreground tracking-[0.03em] uppercase mb-10 max-w-sm mx-auto leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/">
          <Button className="px-6 h-11">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Return Home
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
