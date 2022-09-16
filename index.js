const fs = require('fs');
const path = require('path');
const jsonata = require("jsonata");

const transform = require('@accordproject/markdown-transform').transform;

function getTransform(variableName, textValue) {
    return `(
        $replaceVariable := | **.nodes[\`$class\`='org.accordproject.templatemark.VariableDefinition' and name='${variableName}'] | {"$class": "org.accordproject.commonmark.Text", "text" : \"${textValue}\"}, ['identifiedBy', 'name', 'elementType']|;
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
        shipper: 'Acme Shipping',
        receiver: 'Dan Warehouses',
        deliverable: 'Widgets',
        receiver: 'Dan Selman',
        businessDays: '10 days',
        attachment: 'Appendix A'
    }

    variables.forEach(variable => {
        console.log(variable.name);
        const variableValue = values[variable.name];
        if(variableValue) {
            const mergeVariables = jsonata(getTransform(variable.name, variableValue));
            json = mergeVariables.evaluate(json);
            delete values[variable.name];
        }
    })

    // console.log(JSON.stringify(result, null,2));

    const md = await transform(json, 'templatemark', ['markdown_template'], parameters, options);
    console.log(md);
}

run();
