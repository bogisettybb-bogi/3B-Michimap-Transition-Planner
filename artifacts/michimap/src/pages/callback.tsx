import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const { refetch } = useGetMe();

  useEffect(() => {
    // Just a placeholder redirect component. The actual callback logic 
    // happens on the server which sets the cookie, then redirects here.
    // We just need to refetch the user and redirect to home.
    
    const finishLogin = async () => {
      await refetch();
      // small delay for UX so it doesn't flash aggressively
      setTimeout(() => {
        setLocation("/");
      }, 500);
    };

    finishLogin();
  }, [refetch, setLocation]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background relative overflow-hidden">
      {/* Background illustration */}
      <img 
        src={`${import.meta.env.BASE_URL}images/auth-bg.png`}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none mix-blend-multiply"
      />
      
      <div className="relative z-10 bg-card/80 backdrop-blur-md p-8 rounded-3xl shadow-2xl border border-border text-center animate-in zoom-in-95 duration-500">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">Authenticating...</h2>
        <p className="text-muted-foreground text-sm max-w-[250px]">
          Securely verifying your credentials. You will be redirected shortly.
        </p>
      </div>
    </div>
  );
}
