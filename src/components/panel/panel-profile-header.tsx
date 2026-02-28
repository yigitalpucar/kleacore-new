import { User } from "lucide-react";

export function PanelProfileHeader({
  userName = "Kullanıcı",
  userEmail = "",
}: {
  userName?: string;
  userEmail?: string;
}) {
  return (
    <div className="border-b bg-background">
      <div className="container py-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted border-2 border-border">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Hoş geldin,</p>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">{userName}</h2>
              <span className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
