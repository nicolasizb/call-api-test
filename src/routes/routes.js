const express = require('express')
const router = express.Router()

const { makeCall, validation, changeAddress, sendMessage, finish, addStore, welcome } = require('../controllers/controllers')

router.get('/', welcome)

// STORE
router.post('/add-store', addStore)

// CALL
router.post('/call', makeCall)
router.post('/validation', validation)
router.post('/change-address', changeAddress)
router.post('/send-message', sendMessage)
router.post('/finish', finish)

module.exports = router;