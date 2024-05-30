const axios = require('axios');
const VoiceResponse = require('twilio').twiml.VoiceResponse

const accountSid = process.env.ACCOUNT_SID
const authToken = process.env.AUTH_TOKEN
const twilio = require('twilio')(accountSid, authToken)

const CustomerModel = require('../models/Customer.model.js')
const StoresModel = require('../models/Stores.model.js')

let userData = {
    userID: '',
    store: '',
    number: '',
    address: '',
    city: '',
    digit: '',  
    callSID: '',
    crmID: ''
}

function changeData(userID, store, number, address, city, digit, callSID, crmID) {
    if (userID !== undefined) userData.userID = userID
    if (store !== undefined) userData.store = store
    if (number !== undefined) userData.number = number
    if (address !== undefined) userData.address = address
    if (city !== undefined) userData.city = city
    if (digit !== undefined) userData.digit = digit
    if (callSID !== undefined) userData.callSID = callSID
    if (crmID !== undefined) userData.crmID = crmID
}

function processAddress(address) {
    return address.replace(/[^a-zA-Z0-9\s]/g, '').toUpperCase();
}

async function makeCall(req, res) {
    try {
        const twiml = new VoiceResponse()

        const { store, userID, date, budget, clientNumber, emailAddress, firstName, lastName, addressOne, addressDetails, city, crmID } = req.body
        if (!store || !userID || !date || !budget || !clientNumber || !emailAddress || !firstName || !lastName || !addressOne || !addressDetails || !city || !crmID) {
            throw new Error("Datos inválidos")
        } else {
            const userIDFound = await CustomerModel.findOne({ ID_shopify: userID })

            if(!userIDFound) {
                const customer = new CustomerModel({
                    store: store,
                    ID_shopify: userID,
                    date: date,
                    confirmation_status: undefined,
                    budget: budget,
                    client_number: clientNumber,
                    email_address: emailAddress,
                    first_name: firstName,
                    last_name: lastName,
                    address: addressOne,
                    address_details: addressDetails,
                    city: city,
                    crmID: crmID 
                })
        
                const newCustomer = customer.save()
        
                const setAddress = processAddress(`${addressOne}, ${addressDetails || ''}`)
        
                twiml.pause({ length: 1 })
                
                twiml.say({ 
                    language: 'es-MX',
                    voice: 'Polly.Mia-Neural',
                    rate: '82%'
                },`Hola ${firstName} ${lastName}! Le llamamos de la tienda ${store} para confirmar la dirección de envío de su pedido. ¿Es correcta la dirección: ${setAddress}, en ${city}`)
                
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
                        changeData(undefined, undefined, undefined, undefined, undefined, 'Cambiar', undefined, undefined)
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
                    from: process.env.SUPPORT_NUMBER
                })
        
                changeData(userID, store, clientNumber, setAddress, city, undefined, call.sid, crmID)
        
                res.status(200).json({ 
                    customer_created: newCustomer,
                    SID: call.sid 
                })
            } else {
                res.status(400).json({ error: "The customer already exists" })
            }
        }
    } catch (error) {
        res.status(400).json({ error: error.message })
    }
}

async function validation(req, res) {
    try {
        const digitPressed = req.body.Digits
        const twiml = new VoiceResponse()

        switch (digitPressed) { 
            case '1':
                changeData(undefined, undefined, undefined, undefined, undefined, 'Confirmado', undefined, undefined)      

                if(userData.store == 'Velez') {
                    await axios.post('https://hooks.zapier.com/hooks/catch/18861658/3vks138/', userData)
                } else if (userData.store == 'Will') {
                    await axios.post('https://hooks.zapier.com/hooks/catch/18861658/3vq7qsy/', userData)
                } else if(userData.store == 'Test') {
                    await axios.post('https://hooks.zapier.com/hooks/catch/18861658/2y49aol/', userData)
                } else {
                    res.status(404).json({ message: "Webhook store isn't exists" })
                }

                twiml.say({
                    language: 'es-MX',
                    voice: 'Polly.Mia-Neural',
                    rate: '82%'
                }, 'Usted confirmó que la dirección mencionada es correcta, gracias por su respuesta. ¡Hasta luego!')
                break;
            case '2':
                twiml.say({
                    language: 'es-MX',
                    voice: 'Polly.Mia-Neural',
                    rate: '82%'
                }, `Su dirección es: ${userData.address} en ${userData.city}?`)

                const gather = twiml.gather({
                    numDigits: 1,
                    action: 'https://call-api-phi.vercel.app/change-address',
                    method: 'POST',
                    timeout: 10
                })

                gather.say({
                    language: 'es-MX',
                    voice: 'Polly.Mia-Neural',
                    rate: '82%'
                }, `Marque el número 1, si está correcta. O marque el número 2 para cambiar dirección de envío.`)

                for (let i = 0; i<= 2; i++) {
                    twiml.say({
                        language: 'es-MX',
                        voice: 'Polly.Mia-Neural',
                        rate: '82%'
                    }, `Su dirección es ${userData.address} en ${userData.city}?`)

                    const repeatGather = twiml.gather({
                        numDigits: 1,
                        action: 'https://call-api-phi.vercel.app/change-address',
                        method: 'POST',
                        timeout: 10
                    });
                
                    repeatGather.say({
                        language: 'es-MX',
                        voice: 'Polly.Mia-Neural',
                        rate: '82%'
                    }, 'Marque el número 1, si está correcta. O marque el número 2 para cambiar dirección de envío.')
        
                    if(i === 2) {
                        changeData(undefined, undefined, undefined, undefined, undefined, 'Cambiar', undefined, undefined)       
                    }
                }

                twiml.say({
                    language: 'es-MX',
                    voice: 'Polly.Mia-Neural',
                    rate: '82%'
                }, 'Nos pondremos en contacto con usted por whatsapp para confirmar su dirección.')
                break;
            default:
                for (let i = 0; i<= 2; i++) {
                    const gather = twiml.gather({
                        numDigits: 1,
                        action: 'https://call-api-phi.vercel.app/validation',
                        method: 'POST',
                        timeout: 8
                    })
                
                    gather.say({
                        language: 'es-MX',
                        voice: 'Polly.Mia-Neural',
                        rate: '82%'
                    }, 'Opción no válida. Marque el número 1, si está correcta. O marque el número 2 para cambiar dirección de envío.')
                    
                    if(i === 2) {
                        changeData(undefined, undefined, undefined, undefined, undefined, 'Cambiar', undefined, undefined)       
                    }
                }
                
                twiml.say({
                    language: 'es-MX',
                    voice: 'Polly.Mia-Neural',
                    rate: '82%'
                }, 'Nos pondremos en contacto con usted por whatsapp para confirmar su dirección.')
                break;
        }        
        res.type('text/xml').send(twiml.toString())
    } catch (error) {
        console.error(error);       
        res.status(400).json({ error: error.message })
    }    
}

async function changeAddress(req, res) {
    try {
        const digitPressed = req.body.Digits
        const twiml = new VoiceResponse()
        
        switch(digitPressed) {
            case '1' :
                changeData(undefined, undefined, undefined, undefined, undefined, 'Confirmado', undefined, undefined)       
                
                if(userData.store == 'Velez') {
                    await axios.post('https://hooks.zapier.com/hooks/catch/18861658/3vks138/', userData)
                } else if (userData.store == 'Will') {
                    await axios.post('https://hooks.zapier.com/hooks/catch/18861658/3vq7qsy/', userData)
                } else if(userData.store == 'Test') {
                    await axios.post('https://hooks.zapier.com/hooks/catch/18861658/2y49aol/', userData)
                } else {
                    res.status(404).json({ message: "Webhook store isn't exists" })
                }
        
                twiml.say({
                    language: 'es-MX',
                    voice: 'Polly.Mia-Neural',
                    rate: '82%'
                }, 'Usted confirmó que la dirección mencionada es correcta. ¡Hasta luego!');
                break;
            case '2':
                const gather = twiml.gather({
                    numDigits: 1,
                    action: 'https://call-api-phi.vercel.app/send-message',
                    method: 'POST',
                    timeout: 10
                })
            
                gather.say({
                    language: 'es-MX',
                    voice: 'Polly.Mia-Neural',
                    rate: '82%'
                }, `Marque 1 para autorizar que lo contactemos al whatsapp para cambiar la dirección. O marque 2 para repetir la dirección actual.`)

                for (let i = 0; i<= 2; i++) {
                    const repeatGather = twiml.gather({
                        numDigits: 1,
                        action: 'https://call-api-phi.vercel.app/send-message',
                        method: 'POST',
                        timeout: 10
                    });
                
                    repeatGather.say({
                        language: 'es-MX',
                        voice: 'Polly.Mia-Neural',
                        rate: '82%'
                    }, 'Marque 1 para autorizar que lo contactemos al whatsapp para cambiar la dirección. O marque 2 para repetir la dirección actual.')
        
                    if(i === 2) {
                        changeData(undefined, undefined, undefined, undefined, undefined, 'Cambiar', undefined, undefined)       
                    }
                }

                twiml.say({
                    language: 'es-MX',
                    voice: 'Polly.Mia-Neural',
                    rate: '82%'
                }, 'Nos pondremos en contacto con usted por whatsapp para confirmar su dirección.')
                break;
            default:
                for (let i = 0; i<= 2; i++) {
                    const gather = twiml.gather({
                        numDigits: 1,
                        action: 'https://call-api-phi.vercel.app/change-address',
                        method: 'POST',
                        timeout: 8
                    })
                
                    gather.say({
                        language: 'es-MX',
                        voice: 'Polly.Mia-Neural',
                        rate: '82%'
                    }, 'Opción no válida. Marque 1 para autorizar que lo contactemos al whatsapp para cambiar la dirección. O marque 2 para repetir la dirección actual.')
                    
                    if(i === 2) {
                        changeData(undefined, undefined, undefined, undefined, undefined, 'Cambiar', undefined, undefined)       
                    }
                }
                
                twiml.say({
                    language: 'es-MX',
                    voice: 'Polly.Mia-Neural',
                    rate: '82%'
                }, 'Nos pondremos en contacto con usted por whatsapp para confirmar su dirección.')
            
                break;
        }
    res.type('text/xml').send(twiml.toString())
    } catch (error) {
        console.error(error);       
        res.status(400).json({ error: error.message })
    }    
}

async function sendMessage(req, res) {
    try {
        const digitPressed = req.body.Digits
        const twiml = new VoiceResponse()

        switch(digitPressed) {
            case '1':
                changeData(undefined, undefined, undefined, undefined, undefined, 'Cambiar', undefined, undefined)       
                
                if(userData.store == 'Velez') {
                    await axios.post('https://hooks.zapier.com/hooks/catch/18861658/3vks138/', userData)
                } else if (userData.store == 'Will') {
                    await axios.post('https://hooks.zapier.com/hooks/catch/18861658/3vq7qsy/', userData)
                } else if(userData.store == 'Test') {
                    await axios.post('https://hooks.zapier.com/hooks/catch/18861658/2y49aol/', userData)
                } else {
                    res.status(404).json({ message: "Webhook store isn't exists" })
                }

                twiml.say({
                    language: 'es-MX',
                    voice: 'Polly.Mia-Neural',
                    rate: '82%'
                }, 'Nos pondremos en contacto con usted pronto')
                break;
            case '2':
                twiml.say({
                    language: 'es-MX',
                    voice: 'Polly.Mia-Neural',
                    rate: '82%'
                }, `Su dirección es: ${userData.address} en ${userData.city}?`)

                const gather = twiml.gather({
                    numDigits: 1,
                    action: 'https://call-api-phi.vercel.app/finish',
                    method: 'POST',
                    timeout: 10
                })

                gather.say({
                    language: 'es-MX',
                    voice: 'Polly.Mia-Neural',
                    rate: '82%'
                }, `Marque el número 1, si está correcta. O marque el número 2 para autorizar contactarlo por Whatsapp para cambiar la dirección.`)

                for (let i = 0; i<= 2; i++) {
                    const repeatGather = twiml.gather({
                        numDigits: 1,
                        action: 'https://call-api-phi.vercel.app/finish',
                        method: 'POST',
                        timeout: 10
                    });
                
                    repeatGather.say({
                        language: 'es-MX',
                        voice: 'Polly.Mia-Neural',
                        rate: '82%'
                    }, 'Marque el número 1, si está correcta. O marque el número 2 para autorizar contactarlo por Whatsapp para cambiar la dirección.')
        
                    if(i === 2) {
                        changeData(undefined, undefined, undefined, undefined, undefined, 'Cambiar', undefined, undefined)       
                    }
                }

                twiml.say({
                    language: 'es-MX',
                    voice: 'Polly.Mia-Neural',
                    rate: '82%'
                }, 'Nos pondremos en contacto con usted por whatsapp para confirmar su dirección.')

                break;
            default:
                for (let i = 0; i<= 2; i++) {
                    const gather = twiml.gather({
                        numDigits: 1,
                        action: 'https://call-api-phi.vercel.app/send-message',
                        method: 'POST',
                        timeout: 8
                    })
                
                    gather.say({
                        language: 'es-MX',
                        voice: 'Polly.Mia-Neural',
                        rate: '82%'
                    }, 'Opción no válida. Marque el número 1, si está correcta. O marque el número 2 para autorizar contactarlo por Whatsapp para cambiar la dirección.')

                    if(i === 2) {
                        changeData(undefined, undefined, undefined, undefined, undefined, 'Cambiar', undefined, undefined)       
                    }
                }

                twiml.say({
                    language: 'es-MX',
                    voice: 'Polly.Mia-Neural',
                    rate: '82%'
                }, 'Nos pondremos en contacto con usted por whatsapp para confirmar su dirección.')
                break;
        }
    res.type('text/xml').send(twiml.toString())
    } catch (error) {
        console.error(error)      
        res.status(400).json({ error: error.message })
    } 
}

async function finish (req, res) {
    try {
        const digitPressed = req.body.Digits
        const twiml = new VoiceResponse()

        switch(digitPressed) {
            case '1':
                changeData(undefined, undefined, undefined, undefined, undefined, 'Confirmado', undefined, undefined)       
                
                if(userData.store == 'Velez') {
                    await axios.post('https://hooks.zapier.com/hooks/catch/18861658/3vks138/', userData)
                } else if (userData.store == 'Will') {
                    await axios.post('https://hooks.zapier.com/hooks/catch/18861658/3vq7qsy/', userData)
                } else if(userData.store == 'Test') {
                    await axios.post('https://hooks.zapier.com/hooks/catch/18861658/2y49aol/', userData)
                } else {
                    res.status(404).json({ message: "Webhook store isn't exists" })
                }
        
                twiml.say({
                    language: 'es-MX',
                    voice: 'Polly.Mia-Neural',
                    rate: '82%'
                }, 'Usted confirmó que la dirección mencionada es correcta. ¡Hasta luego!');
                break;
            case '2':
                changeData(undefined, undefined, undefined, undefined, undefined, 'Cambiar', undefined, undefined)       
                
                if(userData.store === 'Velez') {
                    await axios.post('https://hooks.zapier.com/hooks/catch/18861658/3vks138/', userData)
                } else if (userData.store === 'Will') {
                    await axios.post('https://hooks.zapier.com/hooks/catch/18861658/3vq7qsy/', userData)
                } else {
                    res.status(404).json({ message: "Webhook store isn't exists" })
                }

                twiml.say({
                    language: 'es-MX',
                    voice: 'Polly.Mia-Neural',
                    rate: '82%'
                }, 'Nos pondremos en contacto con usted pronto.')

                break;
            default:
                for (let i = 0; i<= 2; i++) {
                    const gather = twiml.gather({
                        numDigits: 1,
                        action: 'https://call-api-phi.vercel.app/finish',
                        method: 'POST',
                        timeout: 8
                    })
                
                    gather.say({
                        language: 'es-MX',
                        voice: 'Polly.Mia-Neural',
                        rate: '82%'
                    }, 'Opción no válida. Marque el número 1, si está correcta. O marque el número 2 para autorizar contactarlo por Whatsapp para cambiar la dirección.')

                    if(i === 2) {
                        changeData(undefined, undefined, undefined, undefined, undefined, 'Cambiar', undefined, undefined)       
                    }
                }

                twiml.say({
                    language: 'es-MX',
                    voice: 'Polly.Mia-Neural',
                    rate: '82%'
                }, 'Nos pondremos en contacto con usted pronto.')
                break;
        }
    res.type('text/xml').send(twiml.toString())
    } catch (error) {
        console.error(error)
        res.status(400).json({ error: error.message })
    } 
}

module.exports = {
    makeCall, 
    validation, 
    changeAddress, 
    sendMessage, 
    finish
}