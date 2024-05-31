const { connection } = require('./src/database/database.js')
const { app } = require('./src/app.js')
require('dotenv').config()  

const port = process.env.PORT

connection()
    .then(
        app.listen(port, () => {
                console.log(`Server lives in port: ${ port }`)
            })
        )