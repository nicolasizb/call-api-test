const axios = require('axios');
const VoiceResponse = require('twilio').twiml.VoiceResponse

const accountSid = process.env.ACCOUNT_SID
const authToken = process.env.AUTH_TOKEN
const twilio = require('twilio')(accountSid, authToken)

const CustomerModel = require('../models/Customer.model.js')
const { StoresModel } = require('../models/Stores.model.js')

class UserData {
    constructor({ 
        userID,
        store,
        number,
        address,
        city,
        confirmation_status,
        callSID,
        crmID, 
    }) {
        this.userID = userID || '';
        this.store = store || {};
        this.number = number || '';
        this.address = address || '';
        this.city = city || '';
        this.confirmation_status = confirmation_status || '';
        this.callSID = callSID || '';
        this.crmID = crmID || '';
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
                case 'crmID':
                    this.crmID = value
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
    crmID: ''
});

function processAddress(address) {
    return address.replace(/[^a-zA-Z0-9\s]/g, '').toUpperCase();
}

async function welcome(req, res) {
    try {
        res.status(200).json({
            message: "Welcome to Chicago Call API"
        })
    } catch (error) {
        res.status(400).json({
            message: "Welcome to Chicago Call API"
        })
    }
}

// STORE
async function addStore(req, res) {
    try {
        const { id_shopify, name_store, webhook  } = req.body

        const storeFound = await StoresModel.findOne({ id_shopify: id_shopify })

        if(!storeFound) {
            const store = new StoresModel({
                id_shopify: id_shopify,
                name_store: name_store,
                webhook: webhook,
            })

            const newStore = await store.save()

            res.status(200).json({ store: newStore })
        } else {
            res.status(400).json({ error: "The store already exists" })
        }
    } catch (error) {
        res.status(400).json({ error: error.message })
    }
}

// CALL
async function makeCall(req, res) {
    try {
        const twiml = new VoiceResponse()

        const { name_store, userID, date, budget, clientNumber, emailAddress, firstName, lastName, addressOne, addressDetails, city, crmID } = req.body
        if (!name_store || !userID || !date || !budget || !clientNumber || !emailAddress || !firstName || !lastName || !addressOne || !addressDetails || !city || !crmID) {
            throw new Error("Datos inválidos")
        } else {
            const storeFound = await StoresModel.findOne({ name_store: name_store })
            const userIDFound = await CustomerModel.findOne({ ID_shopify: userID })

            if(!userIDFound) {
                const customer = new CustomerModel({
                    store: storeFound,
                    ID_shopify: userID,
                    ID_crm: crmID,
                    date: date,
                    confirmation_status: "Pendiente",
                    budget: budget,
                    client_number: clientNumber,
                    email_address: emailAddress,
                    first_name: firstName,
                    last_name: lastName,
                    address: addressOne,
                    address_details: addressDetails,
                    city: city,
                    counter_calls: 0
                })
                await customer.save()
        
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
                    from: process.env.SUPPORT_NUMBER
                })

                userData.updateData({
                    userID: userID,
                    store: storeFound,
                    number: clientNumber,
                    address: setAddress,
                    city: city,
                    confirmation_status: "Pendiente",
                    callSID: call.sid,
                    crmID: crmID
                })        
                
                res.set('Content-Type', 'application/xml').status(200).send(twiml.toString());                
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
                userData.updateData("confirmation_status", "Confirmado")

                if(userData.store.webhook) {
                    await axios.post(`${userData.store.webhook}`, userData)
                } else {
                    res.status(404).json({ message: "Store isn't found"})
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
                        userData.updateData("confirmation_status", "Cambiar")                               
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
                        userData.updateData("confirmation_status", "Cambiar")                               
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
                userData.updateData("confirmation_status", "Confirmado")                       
                
                if(userData.store.webhook) {
                    await axios.post(`${userData.store.webhook}`, userData)
                } else {
                    res.status(404).json({ message: "Store isn't found"})
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
                        userData.updateData("confirmation_status", "Cambiar")                               
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
                        userData.updateData("confirmation_status", "Cambiar")                               
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
                userData.updateData("confirmation_status", "Confirmado")                       
                
                if(userData.store.webhook) {
                    await axios.post(`${userData.store.webhook}`, userData)
                } else {
                    res.status(404).json({ message: "Store isn't found"})
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
                        userData.updateData("confirmation_status", "Cambiar")                               
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
                        userData.updateData("confirmation_status", "Cambiar")                               
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
                userData.updateData("confirmation_status", "Confirmado")                       
                
                if(userData.store.webhook) {
                    await axios.post(`${userData.store.webhook}`, userData)
                } else {
                    res.status(404).json({ message: "Store isn't found"})
                }
        
                twiml.say({
                    language: 'es-MX',
                    voice: 'Polly.Mia-Neural',
                    rate: '82%'
                }, 'Usted confirmó que la dirección mencionada es correcta. ¡Hasta luego!');
                break;
            case '2':
                userData.updateData("confirmation_status", "Cambiar")                       
                
                if(userData.store.webhook) {
                    await axios.post(`${userData.store.webhook}`, userData)
                } else {
                    res.status(404).json({ message: "Store isn't found"})
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
                        userData.updateData("confirmation_status", "Cambiar")                               
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
    finish, 
    addStore,
    welcome
}