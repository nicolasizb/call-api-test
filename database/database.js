const mongoose = require('mongoose')
require('dotenv').config()  

async function connection() {
    await mongoose
        .connect(process.env.MONGO_DB)
        .catch(err => console.log(err))
}

module.exports = { connection }
