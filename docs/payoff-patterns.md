# Payoff Patterns

`PayoffPattern` is not a generic trope bucket and not a direct writer prompt dump.
It exists to improve chapter-level reader reward without flattening the project into cheap formula.

## Purpose

Use payoff patterns to answer:

- What does this arc give the reader?
- What does this beat cash out?
- Why does this chapter feel like progress instead of more atmosphere?

The intended flow is:

`StoryOutline -> ArcOutline.primaryPayoffPatternIds -> BeatOutline.payoffPatternIds -> ChapterPlan.payoffPatternIds`

## Design Rules

- A payoff pattern must describe a reader reward, not just a plot action.
- A payoff pattern must include setup requirements, otherwise it encourages fake impact.
- A chapter should usually carry one or two primary payoff patterns, not many.
- Arc-level payoff patterns should rotate, otherwise middle volumes flatten into repetition.
- Writer should receive the selected payoff pattern ids plus short summaries, not the full library.

## First Library

Current default patterns:

- `payoff-forced-exposure`
- `payoff-costly-rescue`
- `payoff-delayed-confession`
- `payoff-relationship-breakpoint`
- `payoff-earned-reconciliation`
- `payoff-collateral-damage`
- `payoff-mirror-warning`
- `payoff-old-setup-payoff`

## Immediate Use

Short term:

- Arc generation should assign 2 to 3 primary payoff patterns per arc.
- Beat generation should assign 1 to 2 payoff patterns per beat.
- Chapter planning should select a narrow subset from the beat and current context.

Not yet:

- Automatic payoff rotation validation
- Writer prompt injection from the full library
- Reviewer checks for payoff execution quality
