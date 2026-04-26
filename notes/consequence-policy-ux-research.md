# Consequence Policy UX Research Notes

## Goal
Define a consequence policy editor that supports advanced behavior (tiered and continuous late-money outcomes) while staying understandable for parents in under 2 minutes.

## Research Summary
- Comparable apps and household tools consistently use:
  - presets first
  - progressive disclosure for advanced controls
  - scenario preview language ("If 20 minutes late, payout is $X")
- Free-form rule editors without examples produce high setup errors for boundary windows and penalty signs.

## Recommended Interaction Model
1. Basic Mode (default)
   - Preset selector:
     - Full reward always
     - Reward step-down when late
     - Reward to penalty when very late
     - No reward when late
   - Optional undone penalty toggle.
2. Advanced Mode (collapsed by default)
   - Tier rows: from/to minutes + payout value.
   - Optional continuous mode: subtract $ per minute late with min/max clamps.
3. Live Preview Panel
   - Shows sampled outputs at 0/10/20/30/60 minutes late.
   - Shows undone outcome at configured cutoff.

## Copy / Clarity Rules
- Use "payout" rather than "delta" in user-facing labels.
- Always show sign explicitly for penalties (e.g., "-$1.00").
- Label negative outcomes as "penalty" not "reward."
- Add helper text for window boundaries:
  - "15 minutes late and above uses the next row."

## Validation Checklist
- Parent can configure:
  - tiered policy in <2 minutes
  - continuous "$0.01/min late to -$2 min payout" in <2 minutes
- Parent correctly predicts payout for 3 sample scenarios without trial-and-error.
- No confusion around whether undone penalty applies once or repeatedly.

