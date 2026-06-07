import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-[var(--fill-tertiary)] flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-base font-medium text-[var(--text-secondary)] mb-1">
        {title}
      </h3>
      <p className="text-sm text-[var(--text-tertiary)] text-center max-w-xs">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
