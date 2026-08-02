import { createContext } from 'react'
import type { StudioServices } from './interfaces'

export const ServiceContext = createContext<StudioServices | null>(null)
