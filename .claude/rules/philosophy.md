# Core Philosophy: Zuhandenheit (Ready-to-hand)

**The tool should recede; the outcome should remain.**

When building WORKWAY integrations and workflows:
- Users don't want "workflow automation" - they want **outcomes** (meetings that follow up on themselves, CRMs that update themselves)
- The tool should be invisible during use - it only becomes visible when it breaks (Vorhandenheit)
- Every feature should ask: "Does this help the tool recede further?"

## The Outcome Test

> "Map your next project by what disappears from your to-do list, not what gets added to your tech stack."

Two ways to describe a workflow:
- **Wrong**: "It syncs my CRM with my email via REST API."
- **Right**: "It handles my follow-ups after client calls."

The test: Can you describe the workflow's value without mentioning a single piece of technology? If yes, you've found the outcome.

## Design Principles: Weniger, aber besser (Less, but better)

From Dieter Rams' design philosophy:

1. **Good design is innovative** - Don't copy Zapier/Make. Find the essence.
2. **Good design makes a product useful** - Not features, but utility.
3. **Good design is aesthetic** - Visual design follows function.
4. **Good design makes a product understandable** - Self-documenting interfaces.
5. **Good design is unobtrusive** - The tool recedes.
6. **Good design is honest** - No fake social proof, no marketing jargon.
7. **Good design is long-lasting** - Build for durability, not trends.
8. **Good design is thorough** - Every detail matters.
9. **Good design is environmentally friendly** - Efficient code, minimal dependencies.
10. **Good design is as little design as possible** - Remove until it breaks.

## Code Review Checklist

Before committing, verify:
- [ ] Zuhandenheit: Does the tool recede?
- [ ] Weniger, aber besser: Can anything be removed?
- [ ] Uses canonical design tokens (no hardcoded values)
- [ ] TypeScript interfaces defined
- [ ] Tests written
