
function rollDie(sides) {
    return Math.floor(Math.random() * sides) + 1;
}

function rollDice(count, sides) {
    let total = 0;
    for (let i = 0; i < count; i++) {
        total += rollDie(sides);
    }
    return total;
}

function parseNotation(notation) {
    const regex = /^\s*(?<count>\d*)\s*d\s*(?<sides>\d+)\s*(?:(?<operand>[+\-*\/])\s*(?<modifier>\d+))?$/i;
    let n = regex.exec(notation);
    if (n == null) {
        throw new SyntaxError("Invalid Notation");
    }
    let count;
    if (n.groups.count == '') {
        count = 1;
    }
    else {
        count = parseInt(n.groups.count);
    }
    let sides = parseInt(n.groups.sides);
    let operand = n.groups.operand;
    let modifier = parseInt(n.groups.modifier);

    return { count, sides, operand, modifier };
}

function roll(notation) {
    let parsedNotation = parseNotation(notation);
    let total = rollDice(parsedNotation.count, parsedNotation.sides);
    let operand = parsedNotation.operand
    let modifier = parsedNotation.modifier
    switch (operand) {
        case "+":
            return total + modifier;
        case "-":
            return total - modifier;
        case "/":
            return total / modifier;
        case "*":
            return total * modifier;
        default:
            return total;

    }
}
