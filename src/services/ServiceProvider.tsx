import type { ReactNode } from 'react'
import { ServiceContext } from './serviceContext'
import type { StudioServices } from './interfaces'

/**
 * Supplies the service implementations to the tree. Swapping the mock adapters
 * for real KAE-Memory / provider / publisher clients happens here and nowhere
 * else — no presentation component knows which implementation it is using.
 */
export function ServiceProvider({
  services,
  children,
}: {
  services: StudioServices
  children: ReactNode
}) {
  return <ServiceContext.Provider value={services}>{children}</ServiceContext.Provider>
}
