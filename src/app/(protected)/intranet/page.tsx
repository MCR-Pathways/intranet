import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Newspaper } from "lucide-react";
import Link from "next/link";

export default function IntranetPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">News Feed</h1>
          <p className="text-muted-foreground mt-1">
            Stay updated with the latest news and announcements
          </p>
        </div>
        <Button asChild>
          <Link href="/intranet/news/create">
            <Plus className="mr-2 h-4 w-4" />
            Create Post
          </Link>
        </Button>
      </div>

      {/* Empty state */}
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Newspaper className="h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle className="text-lg mb-2">No posts yet</CardTitle>
          <p className="text-muted-foreground text-center max-w-sm">
            The news feed is empty. Be the first to share something with the
            team!
          </p>
          <Button className="mt-4" asChild>
            <Link href="/intranet/news/create">
              <Plus className="mr-2 h-4 w-4" />
              Create First Post
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
