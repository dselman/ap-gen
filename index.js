const fs = require('fs');
const path = require('path');
const jsonata = require("jsonata");

const transform = require('@accordproject/markdown-transform').transform;

function getContractTransform(variableName, textValue) {
    return `(
        $replaceContract := | **.nodes[\`$class\`='org.accordproject.templatemark.ContractDefinition'] | {"$class": "org.accordproject.commonmark.Paragraph"}, ['name', 'elementType']|;
        $replaceClause := | **.nodes[\`$class\`='org.accordproject.templatemark.ClauseDefinition'] | {"$class": "org.accordproject.ciceromark.Clause"}|;
        $ ~> $replaceContract ~> $replaceClause
    )`;
}

function getVariableTransform(variableName, textValue) {
    return `(
        $replaceVariable := | **.nodes[\`$class\`='org.accordproject.templatemark.VariableDefinition' and name='${variableName}'] | {"$class": "org.accordproject.commonmark.Text", "text" : ${textValue}}, ['identifiedBy', 'name', 'elementType']|;
        $ ~> $replaceVariable
    )`;
}

const QUERY_VARIABLES = `**.nodes[\`$class\`='org.accordproject.templatemark.VariableDefinition']`;

/**
 * Prepare the text for parsing (normalizes new lines, etc)
 * @param {string} input - the text for the clause
 * @return {string} - the normalized text for the clause
 */
function normalizeNLs(input) {
    // we replace all \r and \n with \n
    let text = input.replace(/\r/gm, '');
    return text;
}

function loadModels(dir) {
    const files = fs.readdirSync(dir);
    const ctoFiles = files.filter((file) => path.extname(file) === '.cto');
    const ctoPaths = ctoFiles.map((file) => path.join(dir, file));
    return ctoPaths;
}

async function run() {
    const acceptanceGrammarFile = path.resolve(__dirname, 'data/acceptance', 'grammar.tem.md');
    const acceptanceGrammar = normalizeNLs(fs.readFileSync(acceptanceGrammarFile, 'utf8'));
    const acceptanceModelDir = path.resolve(__dirname, 'data/acceptance');

    const models = loadModels(acceptanceModelDir);
    const parameters = { inputFileName: acceptanceGrammar, template: acceptanceGrammar, model: models, templateKind: 'contract' };

    const options = {
        verbose: false
    }
    let json = await transform(acceptanceGrammar, 'markdown_template', ['templatemark'], parameters, options);
    // console.log(JSON.stringify(json, null,2));

    const queryVariables = jsonata(QUERY_VARIABLES);
    const variables = queryVariables.evaluate(json);

    const values = {
        shipper: '"Acme Shipping"',
        receiver: '"Dan Warehouses"',
        deliverable: '"Widgets"',
        receiver: '"Dan Selman"',
        businessDays: `$formatInteger(123, 'w')`,
        attachment: '"Appendix A"'
    }

    console.log(`Contract transform...`);
    const contractTransform = jsonata(getContractTransform());
    json = contractTransform.evaluate(json);

    variables.forEach(variable => {
        const variableValue = values[variable.name];
        if(variableValue) {
            console.log(`Variable transform '${variable.name}'...`);
            const mergeVariables = jsonata(getVariableTransform(variable.name, variableValue));
            json = mergeVariables.evaluate(json);
            delete values[variable.name];
        }
    })

    // console.log(JSON.stringify(json, null,2));

    const md = await transform(json, 'ciceromark', ['markdown'], parameters, options);
    console.log(md);
}

run();
