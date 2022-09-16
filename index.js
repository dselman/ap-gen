const fs = require('fs');
const path = require('path');
const jsonata = require("jsonata");

const transform = require('@accordproject/markdown-transform').transform;

function getTransform(variableName, textValue) {
    return `(
        $replaceContract := | **.nodes[\`$class\`='org.accordproject.templatemark.ContractDefinition'] | {"$class": "org.accordproject.commonmark.Paragraph"}, ['name', 'elementType']|;
        $replaceClause := | **.nodes[\`$class\`='org.accordproject.templatemark.ClauseDefinition'] | {"$class": "org.accordproject.ciceromark.Clause"}|;
        $replaceVariable := | **.nodes[\`$class\`='org.accordproject.templatemark.VariableDefinition' and name='${variableName}'] | {"$class": "org.accordproject.commonmark.Text", "text" : \"${textValue}\"}, ['identifiedBy', 'name', 'elementType']|;
        $ ~> $replaceContract ~> $replaceClause ~> $replaceVariable
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
        shipper: 'Acme Shipping',
        receiver: 'Dan Warehouses',
        deliverable: 'Widgets',
        receiver: 'Dan Selman',
        businessDays: '10 days',
        attachment: 'Appendix A'
    }

    variables.forEach(variable => {
        const variableValue = values[variable.name];
        if(variableValue) {
            console.log(`Merging ${variable.name}...`);
            const mergeVariables = jsonata(getTransform(variable.name, variableValue));
            json = mergeVariables.evaluate(json);
            delete values[variable.name];
        }
    })

    // console.log(JSON.stringify(json, null,2));

    const md = await transform(json, 'ciceromark', ['markdown'], parameters, options);
    console.log(md);
}

run();
