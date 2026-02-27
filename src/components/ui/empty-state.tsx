interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {Icon && (
        <Icon className="h-10 w-10 text-muted-foreground/50 mb-3" />
      )}
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground/70 mt-1 max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
