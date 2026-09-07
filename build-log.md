# Build log: dice notation parser

Notes on how the regex in `dice.js` got to its current form. Kept because the path
mattered more than the destination, and because I want to be able to explain why each
piece is the way it is.

Goal: parse strings like `3d6+2`, `d20`, `10d6`, `2d8-1` into count, sides, operator,
and modifier.

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