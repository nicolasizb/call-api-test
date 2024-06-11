# Documentación de API

## Introducción

Este repositorio contiene la documentación para interactuar con la API de de Chicago IA para la automatización de llamadas de confirmación de pedidos.

## Cómo hacer una solicitud POST

Para realizar una solicitud POST a la API, sigue estos pasos:

1. **URL de la API**: "Probar en LOCALHOST"

2. **Ruta del Endpoint**: "/call"

3. **Cuerpo de la Solicitud (Body)**: Utiliza el siguiente JSON como cuerpo de la solicitud, teniendo en cuenta que por cada petición hay que cambiar el userID:

    ```json
    {
        "name_store": "Test",
        "userID": "1112223334444",
        "date": "2024-05-14T18:08:43-05:00",
        "budget": "5.000", 
        "clientNumber": "<Your phone number>",
        "emailAddress": "fulanito@gmail.com",
        "firstName": "Fulanito",
        "lastName": "Gomez",
        "addressOne": "Calle 127 #7a - 30", 
        "addressDetails": "Oficina 602",
        "city": "Bogotá",
        "crmID": "2024-05-14T18:08:43-05:00"
    }
    ```

4. **Ejemplo de Solicitud usando cURL**:

    ```bash
    curl -X POST -H "Content-Type: application/json" -d '{
        "data": {
            "store": {
              "id_shopify": "c5",
              "name_store": "Test",
              "webhook": "<URL_WEBHOOK_TEST>",
              "_id": "1112223334444",
              "__v": 0
            },
            "ID_shopify": "1112223334444",
            "ID_crm": "2024-05-14T18:08:43-05:00",
            "date": "2024-05-14T18:08:43-05:00",
            "confirmation_status": "Pendiente",
            "budget": "5.000",
            "client_number": "573102950378",
            "email_address": "fulanito@gmail.com",
            "first_name": "Fulanito",
            "last_name": "Gomez",
            "address": "Calle 127 #7a - 30",
            "address_details": "Oficina 602",
            "city": "Bogotá",
            "counter_calls": 0,
            "_id": "<ID_mongoDB>",
            "__v": 0
        },
        "SID": "CAa310b19d1d0e52aa9850927cf5592446"
    }'
    ```

5. **Respuesta Esperada**: Se debe realizar una llamada una vez se suministren los datos en el body de la solicitud.

