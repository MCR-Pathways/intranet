"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsFolders } from "./settings-folders";
import { SettingsCategories } from "./settings-categories";

export function ResourcesSettings() {
  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/resources"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Resources
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          Resources Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage folders and categories.
        </p>
      </div>

      <Tabs defaultValue="folders">
        <TabsList variant="line">
          <TabsTrigger value="folders">Registered Folders</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>
        <TabsContent value="folders" className="mt-4">
          <SettingsFolders />
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <SettingsCategories />
        </TabsContent>
      </Tabs>
    </div>
  );
}
