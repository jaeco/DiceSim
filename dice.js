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
    let count = parseInt(n.groups.count);
    let sides = parseInt(n.groups.sides);
    let operand = n.groups.operand;
    let modifier = parseInt(n.groups.modifier);

    return notation = { count, sides, operand, modifier };
}

console.log(parseNotation("3d6+2"));