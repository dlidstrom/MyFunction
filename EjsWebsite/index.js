console.log('Loading function');

const fs = require('fs');
const ejs = require('ejs');

exports.handler = (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event, null, 2));
    const filename = `./content${event.path}index.ejs`;
    console.log(filename);
    fs.readFile(filename, (err, data) => {
        if (err) {
            callback('Error 404');
        } else {
            const html = ejs.render(data.toString());
            callback(null, { data: html });
        }
    });
};
