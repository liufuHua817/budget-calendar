import { Apple, Bus, Coffee, Cookie, Croissant, House, ShoppingBag, Smartphone, Soup, TrainFront, Utensils, type LucideIcon } from 'lucide-react'
import type { Project } from '../domain/models'

const styles: { match: RegExp; icon: LucideIcon; color: string }[] = [
  { match: /早餐|早饭|bread|breakfast/, icon: Croissant, color: '#A57128' },
  { match: /晚餐|晚饭|soup|dinner/, icon: Soup, color: '#497358' },
  { match: /餐|饭|food|utensils/, icon: Utensils, color: '#B96B59' },
  { match: /地铁|火车|train/, icon: TrainFront, color: '#60768F' },
  { match: /公交|交通|bus/, icon: Bus, color: '#60768F' },
  { match: /咖啡|饮品|coffee/, icon: Coffee, color: '#8F6A49' },
  { match: /水果|apple|fruit/, icon: Apple, color: '#AC7843' },
  { match: /零食|cookie|snack/, icon: Cookie, color: '#8D709B' },
  { match: /房租|住房|house/, icon: House, color: '#807568' },
  { match: /话费|手机|phone/, icon: Smartphone, color: '#627C79' },
  { match: /日用|购物|shop/, icon: ShoppingBag, color: '#9E8163' },
]
const fallbackColors = ['#627C79', '#9E8163', '#8D709B', '#60768F']

export function projectAppearance(project?: Pick<Project, 'name' | 'icon' | 'color'>) {
  const known = styles.find((style) => style.match.test(`${project?.name ?? ''} ${project?.icon ?? ''}`))
  const customColor = project?.color && project.color !== '#246bfe' ? project.color : undefined
  const color = customColor ?? known?.color ?? fallbackColors[(project?.name.codePointAt(0) ?? 0) % fallbackColors.length]
  return { Icon: known?.icon, color }
}
