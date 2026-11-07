## What and why

<!-- What does this change, and why? Add "Fixes #<issue>" if it closes one. -->

## Checklist

- [ ] `npm test` passes
- [ ] `npm run validate` passes
- [ ] `npm run lint` and `npm run build` pass
- [ ] Screenshots attached for UI changes (before and after, ideally at phone width)

### Content PRs only

- [ ] Title is `content(<category>): …` and the PR touches one category
- [ ] Every new prompt has been reviewed by someone other than its writer, using the [reviewer checklist](https://github.com/christiantio/ulu/blob/main/docs/writing-prompts.md#reviewer-checklist)
- [ ] No scheduled prompt was deleted or renamed
- [ ] If `src/content/schedule.json` changed, it only gained days at the end (from `npm run schedule`)
