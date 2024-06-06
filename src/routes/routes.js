const express = require('express')
const router = express.Router()

const { welcome, addStore, makeCall, validation, changeAddress, sendMessage, finish } = require('../controllers/controllers')

router.get('/', welcome)

// WEBHOOK CALL CHANGES STATUS
router.post('/call-status', async (req, res) => {
    const callStatus = req.body.CallStatus;
    const callSid = req.body.CallSid;

    // Crear el mensaje a enviar a Zapier
    const message = { SID: callSid, Status: callStatus }

    // URL del webhook de Zapier
    const webhookUrl = 'https://hooks.zapier.com/hooks/catch/18861658/2yjhba3/'; // Reemplaza con tu URL de Zapier

    // Enviar el mensaje a Zapier
    axios.post(webhookUrl, { message })
        .then(response => {
            console.log('Message sent to Zapier:', response.data);
        })
        .catch(error => {
            console.error('Error sending message to Zapier:', error);
        });

    res.sendStatus(200);
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
                statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
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