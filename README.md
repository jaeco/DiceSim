# DiceSim

A dice notation parser and roller in JavaScript. Give it a string like `3d6+2` and it
rolls the dice and returns the result.

I built this while moving from infrastructure engineering into software development. It
started as a way to practice JavaScript on a problem I actually understand, having run
tabletop games as a DM for years. `docs/build-log.md` has the full record of how it got
here, including every bug I hit and why the code is shaped the way it is.

## Usage

```bash
node dice.js
```

```javascript
roll("3d6+2");   // roll three six-sided dice, add 2
roll("d20");     // roll one twenty-sided die
roll("2d8-1");   // roll two eight-sided dice, subtract 1
roll("4d6/2");   // roll four six-sided dice, halve the result
```

## Supported notation

| Form | Meaning |
|---|---|
| `3d6` | Three six-sided dice |
| `d20` | One twenty-sided die (count defaults to 1) |
| `10d6` | Multi-digit counts and sides both work |
| `3d6+2` | Add a modifier to the total |
| `2d8-1` | Subtract a modifier |
| `3d6*2` | Multiply the total, for doubled damage |
| `4d6/2` | Divide the total, for halved damage on a save |

Whitespace is ignored, so `3 d 6 + 2` parses the same as `3d6+2`. Case is ignored, so
`D20` works as well as `d20`.

Invalid input throws a `SyntaxError` rather than returning a wrong answer quietly. This is
deliberate, and the reasoning is in the build log.

## How it works

Three pieces, each with one job:

- `parseNotation(notation)` validates the string with a regular expression and returns
  `{ count, sides, operand, modifier }` as clean numbers, or throws if the input isn't
  valid notation.
- `rollDice(count, sides)` rolls the dice and returns the total.
- `roll(notation)` ties them together and applies the modifier.

The parser uses named capture groups so the pattern documents itself, and operator
handling is an explicit `switch` rather than anything that evaluates strings as code. That
second choice is a security decision, not a style one, and the build log explains why.

## Known limitations

These are chosen rather than overlooked:

- No compound expressions like `2d6+1d4`. Supporting those means a real tokenizer rather
  than a single pattern.
- No advantage, disadvantage, keep-highest, or exploding dice.
- `3d6+` (an operator with nothing after it) is rejected as malformed. Treating it as a
  modifier of zero would also be reasonable.
- `rollDice` returns only the total, so individual die results are discarded. Any real
  virtual tabletop needs to show players what each die rolled, which would mean returning
  an array of results alongside the total.

## Notes on tooling

I used AI assistance while building this, in the way I would at work: to explain concepts
I hadn't used before, to look things up, and to run my code against test inputs so I could
see what actually happened. Every version of the parser is mine, and every bug in the
build log I found by reading test output and reasoning about why a case failed.