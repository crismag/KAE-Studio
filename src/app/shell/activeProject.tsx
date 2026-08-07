/**
 * The chosen project, readable anywhere in the shell.
 *
 * Separate from the services context because it answers a different question.
 * `useServices().projectId` is *which project these calls are about*, and every
 * adapter needs it. This is *which project the person chose, and how to leave
 * it*, which only the chrome needs — a header showing the name, a control to
 * switch. Merging them would put a navigation concern into every mock adapter.
 */

import { createContext, useContext, type ReactNode } from 'react'

export type ActiveProject = {
  id: string
  /** Forget the choice and return to the picker. */
  onSwitch: () => void
}

const ActiveProjectContext = createContext<ActiveProject | null>(null)

export function ActiveProjectProvider({
  value,
  children,
}: {
  value: ActiveProject
  children: ReactNode
}) {
  return <ActiveProjectContext.Provider value={value}>{children}</ActiveProjectContext.Provider>
}

/**
 * Returns `null` against the mock services, where there is nothing to switch
 * between. Callers render the switcher only when it means something rather than
 * offering a control that cannot do anything.
 */
export function useActiveProject(): ActiveProject | null {
  return useContext(ActiveProjectContext)
}
