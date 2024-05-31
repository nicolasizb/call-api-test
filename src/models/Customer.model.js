const { StoresSchema } = require('./Stores.model')

const mongoose = require('mongoose')

const CustomerSchema = new mongoose.Schema({
    store: {
        type: StoresSchema,
        required: true
    },
    ID_shopify: {
        type: String,
        required: true
    },
    ID_crm: {
        type: String,
        required: true
    },
    date: {
        type: String,
        required: true
    },
    confirmation_status: {
        type: String,
        required: true
    },
    budget: {
        type: String,
        required: true
    },
    client_number: {
        type: String,
        required: true
    },
    email_address: {
        type: String,
        required: true
    },
    first_name: {
        type: String,
        required: true
    },
    last_name: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    address_details: {
        type: String,
        required: true
    },
    city: {
        type: String,
        required: true
    },
    counter_calls: {
        type: Number,
        required: true
    }
})

const CustomerModel = mongoose.model('CustomerModel', CustomerSchema)

module.exports = CustomerModel