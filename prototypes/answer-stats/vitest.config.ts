// THROWAWAY PROTOTYPE (issue #17). The root config excludes prototypes/**, so these tests only run with this
// config: `npm test` here, or `npx vitest run --root prototypes/answer-stats` from the repo root
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
})
