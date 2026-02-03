import Link from "next/link";
import { Card, Button } from "@repo/ui";

export const metadata = {
  title: "AI | Admin | NextWiki",
  description: "Manage AI assistant configuration and usage",
};

export default function AdminAIPage() {
  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">AI Assistant</h1>
        <p className="text-text-secondary">
          Configure providers, roles, and usage settings for the AI assistant.
        </p>
      </div>

      <Card className="space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold">Configuration</h2>
          <p className="text-text-secondary text-sm">
            AI settings are managed in the admin settings panel.
          </p>
        </div>
        <div>
          <Link href="/admin/settings" passHref>
            <Button>Go to Settings</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
