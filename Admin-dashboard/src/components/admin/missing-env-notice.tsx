import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MissingEnvNoticeProps = {
  title?: string;
};

export default function MissingEnvNotice({ title = "Configuration required" }: MissingEnvNoticeProps) {
  return (
    <div className="flex-1">
      <Card className="border-amber-300 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900">
            <AlertTriangle className="h-5 w-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-amber-900/90">
          <p>The admin dashboard cannot connect to Supabase because required environment variables are missing.</p>
          <p>Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in this app environment.</p>
        </CardContent>
      </Card>
    </div>
  );
}
