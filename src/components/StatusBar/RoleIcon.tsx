const ROLE_PATHS: Record<string, string> = {
  Centre: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 3c2.2 2 3.4 5.4 3.4 9s-1.2 7-3.4 9c-2.2-2-3.4-5.4-3.4-9S9.8 5 12 3zM3 12h18',
  Approach: 'M3 5l13 8M16 13l-.5-5M16 13l-5 .5M3 20h18',
  Tower: 'M8 10h8l1.5-5h-11zM9.5 10v10M14.5 10v10M7 20h10M10 7.5h4',
  Ground: 'M4 7h16v8H4zM9 11h6M13 9l2 2-2 2M12 15v5M9 20h6',
  Delivery: 'M9 4h6v3H9zM6 6h12v15H6zM9 14l2 2 4-4',
  Apron: 'M4 4h16v16H4zM8.5 16.5L12 7l3.5 9.5M9.8 13.5h4.4',
  Information: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8v.01',
  ATIS: 'M4 10v4h3l5 4V6L7 10zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
}

const SUFFIX_ROLES: Array<[string, string]> = [
  ['_CTR', 'Centre'],
  ['_APP', 'Approach'],
  ['_DEP', 'Approach'],
  ['_TWR', 'Tower'],
  ['_GND', 'Ground'],
  ['_DEL', 'Delivery'],
  ['_APR', 'Apron'],
  ['_FSS', 'Information'],
  ['_ATIS', 'ATIS'],
]

const ATC_ROLES = ['Centre', 'Approach', 'Tower', 'Ground', 'Delivery']

export function isAtcPosition(callsign: string): boolean {
  return SUFFIX_ROLES.some(([suffix, role]) => callsign.endsWith(suffix) && ATC_ROLES.includes(role))
}

export function roleOf(callsign: string): string {
  const match = SUFFIX_ROLES.find(([suffix]) => callsign.endsWith(suffix))
  return match ? match[1] : 'Information'
}

export function RoleIcon({ role, className }: { role: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d={ROLE_PATHS[role] ?? ROLE_PATHS.Information} />
    </svg>
  )
}
