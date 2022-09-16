const fs = require('fs');
const path = require('path');
const jsonata = require("jsonata");

const transform = require('@accordproject/markdown-transform').transform;

const JSONATA = `(
    $replaceVariable := | **.nodes[\`$class\`='org.accordproject.templatemark.VariableDefinition'] | {"$class": "org.accordproject.commonmark.Text", "text" : "my variable value"}, ['identifiedBy', 'name', 'elementType']|;
    $ ~> $replaceVariable
)`;

/**
 * Prepare the text for parsing (normalizes new lines, etc)
 * @param {string} input - the text for the clause
 * @return {string} - the normalized text for the clause
 */
 function normalizeNLs(input) {
    // we replace all \r and \n with \n
    let text =  input.replace(/\r/gm,'');
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
    const acceptanceModelDir =  path.resolve(__dirname, 'data/acceptance');

    const models = loadModels(acceptanceModelDir);
    const parameters = { inputFileName: acceptanceGrammar, template: acceptanceGrammar, model: models, templateKind: 'contract' };

    const options = {
        verbose: false
    }
    const json = await transform(acceptanceGrammar, 'markdown_template', ['templatemark'], parameters, options);
    console.log(JSON.stringify(json, null,2));

    const expression = jsonata(JSONATA);
    const result = expression.evaluate(json);
    console.log(JSON.stringify(result, null,2));

    const md = await transform(result, 'templatemark', ['markdown_template'], parameters, options);
    console.log(md);
}

run();
