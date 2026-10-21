import type { ReactNode, SVGProps } from 'react'

export type IconName = 'home' | 'calendar' | 'tasks' | 'users' | 'user' | 'bolt' | 'shield' | 'eye' | 'pencil' | 'trash' | 'power' | 'plus' | 'x' | 'alert' | 'check' | 'logout' | 'chevron-left' | 'chevron-down' | 'contact' | 'chart' | 'download'

type IconProps = SVGProps<SVGSVGElement> & { name: IconName; title?: string }

const paths: Record<IconName, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
  calendar: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 9h18" /></>,
  tasks: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="m3 6 1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  bolt: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />,
  shield: <><path d="M12 3 20 6v5c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10V6l8-3Z" /><path d="m9 12 2 2 4-4" /></>,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
  pencil: <><path d="m4 16-.8 4.8L8 20l11-11-4-4L4 16Z" /><path d="m13 6 4 4" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V3h6v4" /></>,
  power: <><path d="M12 2v10" /><path d="M18.4 5.6a9 9 0 1 1-12.8 0" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  x: <><path d="m6 6 12 12M18 6 6 18" /></>,
  alert: <><path d="M10.3 3.7 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M21 19V5a2 2 0 0 0-2-2h-6" /></>,
  'chevron-left': <path d="m15 18-6-6 6-6" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  chart: <><path d="M3 3v18h18" /><path d="M7 15v3M11 10v8M15 12v6M19 6v12" /></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 19h16" /></>,
  contact: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="11" r="2.5" /><path d="M5.5 17a3.5 3.5 0 0 1 7 0M15 9h3M15 13h3" /></>,
}

export function Icon({ name, title, ...props }: IconProps) {
  return <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}><title>{title}</title>{paths[name]}</svg>
}
