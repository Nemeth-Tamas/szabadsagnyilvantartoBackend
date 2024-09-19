const fs = require('fs');
const swaggerJsdoc = require('swagger-jsdoc');
const YAML = require('yamljs');

const options = {
    failOnErrors: true,
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Szabadságnyilvántartó API',
            version: '1.0.0',
        },
    },
    apis: ['./routes/*.js'],
};

const openapiSpecification = swaggerJsdoc(options);
// write to api.yaml file
fs.writeFileSync('./api.yaml', YAML.stringify(openapiSpecification));