# Build log: DiceSim

Notes on how `dice.js` got to its current form. Kept because the path mattered more than
the destination, and because I want to be able to explain why each piece is the way it is.

Goal: parse strings like `3d6+2`, `d20`, `10d6`, `2d8-1` into count, sides, operator, and
modifier, then roll them.

Final pattern:

```
/^\s*(?<count>\d*)\s*d\s*(?<sides>\d+)\s*(?:(?<operand>[+\-*\/])\s*(?<modifier>\d+))?$/i
```

---

## Decision: regex over string splitting

I considered `.split()` first. Splitting on `d` gets you `["3", "6+2"]`, but then you have
to scan the second half for whichever of four operators is present, split again, and write
separate conditionals for "no count" and "no modifier." That's four or five branches I
maintain myself.

Regex handles the optional pieces declaratively, and more importantly it *validates while
it extracts*: a bad input fails immediately instead of quietly producing `NaN` three
functions downstream.

The real cost of regex is readability six months later. I dealt with that deliberately
rather than pretending it away, using named capture groups so the pattern documents
itself, and keeping a test table so a future change tells me what it broke.

---

## Bugs I found, in the order I found them

**1. Single-digit assumptions.** My first pattern used `[0-9]?` and `[0-9]`, which quietly
assumed every number was one digit. `10d6` didn't match at all.

**2. Silent truncation, which was worse.** `d100` didn't fail. It matched and returned
`d10`. That's more dangerous than a rejection: the roller would happily roll a d10 while
the user believed they asked for a d100. Taught me that a parser failing loudly beats a
parser being approximately right.

**3. The operator was matched but never captured.** I had `[+*\-\/]?` in the pattern, so
the string matched, but I never put it in a group. That meant `2d8-1` and `2d8+1` parsed
identically. Everything downstream got a number with no idea what to do with it.

**4. Operand and modifier are a package deal.** This was the real structural insight. I
had them as two independently optional pieces, which let `3d6+` through: an operator with
nothing after it. But in the actual grammar you either have both or neither. Fixing it
meant wrapping the pair in a non-capturing group `(?: ... )?` and making the *group*
optional while the pieces inside became required.

**5. Over-correcting the fix.** After grouping them, I put `+` on the operator class,
thinking "required." But a character class already matches exactly one character, and `+`
means one *or more*, so `3d6++2` and `3d6+-2` started matching.

**6. Required whitespace instead of optional.** Adding space tolerance, I used `\s`
(exactly one) instead of `\s*` (zero or more), which broke every input that had no spaces,
including the most common case.

**7. Missing a gap.** Even after fixing that, `3 d 6` failed. I had put `\s*` after the
count and after the sides, but not between the `d` and the sides. Traced it character by
character to find it.

---

## Quantifiers, which is what most of this came down to

- `?` = zero or one, so the piece is optional
- `*` = zero or more, optional and repeatable
- `+` = one or more, required
- no quantifier on a character class = exactly one

Count can be absent (`d20`), modifier can be absent (`3d6`), sides never can (`3d` is a
typo, not a roll). Most of my bugs were using the wrong one of these.

---

## A JavaScript-specific gotcha

I was testing in regex101 with `gim` flags because it lets you stack test strings on
separate lines. Those flags are right for that tool and wrong for my code:

- `g` makes the regex object stateful via `lastIndex`, so calling `.exec()` twice on the
  same pattern gives different answers the second time.
- `m` changes `^` and `$` from string anchors to line anchors, which would let
  `"3d6\ngarbage"` match.

Only `i` belongs in the file. The flags a test harness needs are not the flags production
code needs.

---

## Bugs after the regex, in the roller

**8. A function that prints isn't a function that returns.** My first `parseNotation`
logged the four values and returned nothing, so the caller got `undefined`. Printing is
debugging; returning is building.

**9. Object versus array for the return.** I chose an object so the caller doesn't need
prior knowledge of field order to use the function. The fields are heterogeneous, two of
them are optional, and I expect to add more later, all of which favor names over
positions. An array would be the right call for something homogeneous and ordered, which
is exactly what individual die results will be when I add them.

**10. Missing defaults produced `NaN` instead of failing.** `parseInt("")` is `NaN`, so
`d20` parsed to a count of `NaN`. Then `for (let i = 0; i < NaN; i++)` is false
immediately, so the loop ran zero times and the roll silently returned 0. Same family as
the `d100` truncation: a wrong answer with no error is worse than a crash.

**11. You cannot store an operator in a variable.** I tried to write `total operand
modifier`. In JavaScript `+` is syntax, not a value, so there's no way to slot a variable
into that position. I looked for something like a generic evaluator and found `eval`,
which would work in one line and which I deliberately rejected: `eval` executes arbitrary
code, and dice notation in a virtual tabletop is untrusted input typed by strangers. The
`switch` I used instead is effectively a whitelist of the four operations I permit, and
that's the property I want.

**12. Absent is not the same as invalid.** My first `switch` threw on any unrecognized
operand, which meant `3d6` and `d20` crashed. Most rolls have no modifier at all. Then,
after removing the throw, I left no `default` case, so the function fell off the end and
returned `undefined` for those same rolls. The correct behavior is to return the plain
total.

**13. `isNaN` is the wrong way to check for null.** Guarding the parser, I wrote
`isNaN(regex.exec(notation))`. `isNaN` converts its argument to a number first, and
`Number(null)` is `0`, which is not NaN, so the guard never fired. I was asking a numeric
question about a value that was never numeric.

**14. Throw at detection, catch at the boundary.** I considered wrapping the parser in
try/catch, but catching an error I could simply prevent is treating a bug like weather.
`parseNotation` can detect bad input but can't know what the caller wants to do about it,
so it throws. A UI or command handler is the right place to catch and decide what the user
sees.

I chose `SyntaxError` for the thrown error because that's what `JSON.parse` throws for a
malformed input string, and this is the same situation: a parser handed something that
isn't valid in its grammar. A custom error class extending `Error` would be the next step
if callers ever needed to catch this specific failure rather than any `SyntaxError`.

---

## Known limitations, chosen not overlooked

- `3d6+` is rejected as malformed. Treating a dangling operator as "modifier of zero"
  would also be defensible; I chose to reject.
- I support `*` and `/` beyond standard notation, for halved or doubled results.
- No support yet for compound expressions like `2d6+1d4`, or for keep-highest and
  advantage mechanics. Those are grammar changes, not pattern tweaks, and would probably
  push this toward a real tokenizer rather than one regex.

---

## How I used AI here

I used AI to explain concepts I didn't know (named capture groups, non-capturing groups,
the `lastIndex` behavior of the `g` flag) and to run my pattern against test inputs so I
could see what actually happened. I wrote every version of the pattern myself, and every
bug above I found by looking at test output and reasoning about why a case failed. The
useful workflow was: form a hypothesis, test it, read the result, fix the specific thing.
Asking "just fix it" would have gotten me a working pattern and none of this.