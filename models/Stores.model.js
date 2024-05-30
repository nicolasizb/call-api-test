const mongoose = require('mongoose')

const StoresSchema = new mongoose.Schema({
    id_shopify: {
        type: String,
        required: true
    },
    name_store: {
        type: String,
        required: true
    },
    webhook: {
        type: String,
        required: true
    },
})

const StoresModel = mongoose.model('StoresModel', StoresSchema)

module.exports = StoresModel