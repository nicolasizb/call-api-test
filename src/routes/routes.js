const express = require('express')
const router = express.Router()

const axios = require('axios');
const VoiceResponse = require('twilio').twiml.VoiceResponse

const accountSid = process.env.ACCOUNT_SID
const authToken = process.env.AUTH_TOKEN
const twilio = require('twilio')(accountSid, authToken)

const { welcome, addStore, makeCall, validation, changeAddress, sendMessage, finish } = require('../controllers/controllers')

function processAddress(address) {
    return address.replace(/[^a-zA-Z0-9\s]/g, '').toUpperCase();
}

class UserData {
    constructor({ 
        userID,
        store,
        number,
        address,
        city,
        confirmation_status,
        callSID,
    }) {
        this.userID = userID || '';
        this.store = store || {};
        this.number = number || '';
        this.address = address || '';
        this.city = city || '';
        this.confirmation_status = confirmation_status || '';
        this.callSID = callSID || '';
    }

    updateData(param, value) {
        if (typeof param === 'object') {
            for (const key in param) {
                if (Object.prototype.hasOwnProperty.call(param, key)) {
                    this[key] = param[key]
                }
            }
        } else {
            switch(param) {
                case 'userID':
                    this.userID = value
                    break;
                case 'store':
                    this.store = value
                    break;
                case 'number':
                    this.number = value
                    break;
                case 'address':
                    this.address = value
                    break;
                case 'city':
                    this.city = value
                    break;
                case "confirmation_status":
                    this.confirmation_status = value
                    break;
                case 'callSID':
                    this.callSID = value
                    break;
                default:
                    console.error('Invalid parameter')
            }
        }
    }
}
const userData = new UserData({
    userID: '',
    store: {},
    number: '',
    address: '',
    city: '',
    confirmation_status: '',
    callSID: '',
});

router.get('/', welcome)

// WEBHOOK CALL CHANGES STATUS
const allowedEvents = ['queued', 'initiated', 'ringing', 'in-progress', 'completed', 'busy', 'no-answer', 'failed'];

router.post('/call-status', async (req, res) => {
    try {
        console.log('Received call status callback:', req.body);

        const callStatus = req.body.CallStatus;
        const callSid = req.body.CallSid;

        if (!allowedEvents.includes(callStatus)) {
            return res.sendStatus(200);
        }

        console.log('Received allowed call status:', callStatus);
        console.log('Call SID:', callSid);

        const message = { SID: callSid, Status: callStatus };

        const webhookUrl = 'https://hooks.zapier.com/hooks/catch/18861658/2yjhba3/'; 

        try {
            const response = await axios.post(webhookUrl, message);
            console.log('Message sent to Zapier:', response.data);
        } catch (error) {
            console.error('Error sending message to Zapier:', error);
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Error in /call-status handler:', error);
        res.sendStatus(500);
    }
});

// STORE
router.post('/add-store', addStore)

// CALL
router.post('/call', async (req, res) => {
    try {
        const twiml = new VoiceResponse()

        const { name_store, userID, date, budget, clientNumber, emailAddress, firstName, lastName, addressOne, addressDetails, city } = req.body
        
        if (!name_store || !userID || !date || !budget || !clientNumber || !emailAddress || !firstName || !lastName || !addressOne || !addressDetails || !city) {
            throw new Error("Datos inválidos")
        } else {
            const setAddress = processAddress(`${addressOne}, ${addressDetails || ''}`)
    
            twiml.pause({ length: 1 })
            
            twiml.say({ 
                language: 'es-MX',
                voice: 'Polly.Mia-Neural',
                rate: '82%'
            },`Hola ${firstName} ${lastName}! Le llamamos de la tienda ${name_store} para confirmar la dirección de envío de su pedido. ¿Es correcta la dirección: ${setAddress}, en ${city}`)
            
            const gather = twiml.gather({
                numDigits: 1,
                action: 'https://call-api-phi.vercel.app/validation',
                method: 'POST',
                timeout: 10
            })
            
            gather.say({
                language: 'es-MX',
                voice: 'Polly.Mia-Neural',
                rate: '82%'
            }, 'Marque el número 1, si está correcta la dirección. O marque el número 2 para repetirla.')
    
            for (let i = 0; i<= 2; i++) {
                twiml.say({
                    language: 'es-MX',
                    voice: 'Polly.Mia-Neural',
                    rate: '82%'
                }, `Su dirección es: ${setAddress} en ${city}?`)
    
                const repeatGather = twiml.gather({
                    numDigits: 1,
                    action: 'https://call-api-phi.vercel.app/validation',
                    method: 'POST',
                    timeout: 10
                })
            
                repeatGather.say({
                    language: 'es-MX',
                    voice: 'Polly.Mia-Neural',
                    rate: '82%'
                }, 'Marque el número 1, si está correcta. O marque el número 2 para repetir la dirección.')
    
                if(i === 2) {
                    userData.updateData( "confirmation_status", "Cambiar" )                        
                }
            }
            twiml.say({
                language: 'es-MX',
                voice: 'Polly.Mia-Neural',
                rate: '82%'
            }, 'Nos pondremos en contacto con usted por whatsapp para confirmar su dirección.')
            
            const call = await twilio.calls.create({
                twiml: twiml.toString(),
                to: clientNumber,
                from: process.env.SUPPORT_NUMBER,
                statusCallback: 'https://call-api-test.vercel.app/call-status',
                statusCallbackEvent: ['initiated', 'ringing', 'in-progress', 'completed', 'busy', 'no-answer', 'failed']
            })
            await userData.updateData({
                userID: userID,
                store: name_store,
                number: clientNumber,
                address: setAddress,
                city: city,
                confirmation_status: "Pendiente",
                callSID: call.sid,
            })        
            
            res.status(200).json({
                SID: call.sid
            });              
        }
    } catch (error) {
        res.status(400).json({ error: error.message })
    }
})
router.post('/validation', validation)
router.post('/change-address', changeAddress)
router.post('/send-message', sendMessage)
router.post('/finish', finish)

module.exports = router;