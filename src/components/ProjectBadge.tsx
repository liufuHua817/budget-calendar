import type { CSSProperties } from 'react'
import type { Project } from '../domain/models'
import { projectAppearance } from './projectAppearance'

export function ProjectBadge({ project }: { project?: Pick<Project, 'name' | 'icon' | 'color'> }) {
  const { Icon, color } = projectAppearance(project)
  return <span className="project-badge" style={{ '--project-color': color } as CSSProperties} aria-hidden="true">
    {Icon ? <Icon size={23} strokeWidth={1.8} /> : project?.name.slice(0, 1) ?? '·'}
  </span>
}
