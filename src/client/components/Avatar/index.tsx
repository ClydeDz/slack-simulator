import React from 'react'
import { getAvatarDataUri } from '../../lib/dicebear'

interface Props {
  seed: string
  size?: number
  alt?: string
  url?: string
}

export default function Avatar({ seed, size = 36, alt = '', url }: Props) {
  const src = url ?? getAvatarDataUri(seed, size)
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      style={{ borderRadius: 'var(--slacksim-radius-sm)', flexShrink: 0, display: 'block', objectFit: 'cover' }}
    />
  )
}
