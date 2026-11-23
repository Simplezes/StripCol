import type { CSSProperties } from 'react'

export function Skeleton({ width, height, className = '' }: { width?: number | string; height?: number | string; className?: string }) {
  const style: CSSProperties = { width, height }
  return <span className={`skel ${className}`.trim()} style={style} aria-hidden="true" />
}

export function StripSkeleton() {
  return (
    <div className="strip-skel" aria-hidden="true">
      <div className="skel-row">
        <Skeleton width={74} height={16} />
        <Skeleton width={46} height={12} />
        <Skeleton width={58} height={12} />
      </div>
      <div className="skel-row">
        <Skeleton width={96} height={12} />
        <Skeleton width={38} height={12} />
      </div>
      <div className="skel-row">
        <Skeleton width={52} height={12} />
        <Skeleton width={84} height={12} />
        <Skeleton width={30} height={12} />
      </div>
    </div>
  )
}

export function StationSkeleton() {
  return (
    <div className="stn-skel" aria-hidden="true">
      <Skeleton width={36} height={36} />
      <div className="stn-skel-text">
        <Skeleton width="55%" height={14} />
        <Skeleton width="30%" height={10} />
      </div>
      <Skeleton width={56} height={12} />
    </div>
  )
}
