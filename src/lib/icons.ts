import * as LucideIcons from 'lucide-react'

export const getIcon = (name: string | undefined | null) => {
  if (!name) return LucideIcons.Folder

  // Try direct match
  if ((LucideIcons as any)[name]) {
    return (LucideIcons as any)[name]
  }

  // Try kebab-case to PascalCase (e.g., check-circle -> CheckCircle)
  const pascalName = name
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('')

  if ((LucideIcons as any)[pascalName]) {
    return (LucideIcons as any)[pascalName]
  }

  // Fallback
  return LucideIcons.Folder
}
