export type Bank = typeof import('./bank')

/**
 * The question bank and schedule, fetched as a separate chunk the first time it's asked for (the browser
 * caches the module after that). Its own module so tests can watch when it's requested
 */
export const loadBank = (): Promise<Bank> => import('./bank')
