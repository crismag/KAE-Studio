import { useContext } from 'react'
import { ServiceContext } from '@/services/serviceContext'
import type { StudioServices } from '@/services/interfaces'

export function useServices(): StudioServices {
  const services = useContext(ServiceContext)
  if (!services) throw new Error('useServices must be used inside a ServiceProvider')
  return services
}
