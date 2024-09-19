const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const cors = require('cors');
const { Query, Client, Databases, Users, ID } = require('node-appwrite');

router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));
router.use(cors());

const client = new Client();
client
    .setEndpoint(process.env.APPWRITE_API_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const database = new Databases(client);
const users = new Users(client);

const dbId = process.env.APPWRITE_DB_ID;
const uzenetekId = process.env.APPWRITE_UZENETEK_COLLECTION;

/**
 * @openapi
 * /uzenetek/{id}:
 *  get:
 *      summary: Retrieve a list of messages for a specific user by ID
 *      tags: [Messages]
 *      parameters:
 *          - in: path
 *            name: id
 *            schema:
 *              type: string
 *            required: true
 *            description: The ID of the user to retrieve messages for
 *      responses:
 *         200:
 *            description: Returns a status and a list of messages or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      messages:
 *                          type: array
 *                          items:
 *                              $ref: '#/components/schemas/Message'
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 */
router.get('/uzenetek/:id', async (req, res) => {
    try {
        const messages = await database.listDocuments(dbId, uzenetekId, [Query.equal("userId", req.params.id), Query.orderDesc("$createdAt")]);
        res.send({ status: "success", messages });
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

/**
 * @openapi
 * /uzenetek/create:
 *  post:
 *      summary: Create a new message for a specific user based on the permissions of the submitting user
 *      tags: [Messages]
 *      security:
 *          - ApiKeyAuth: []
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          userId:
 *                              type: string
 *                          date:
 *                              type: string
 *                          message:
 *                              type: string
 *      responses:
 *         200:
 *            description: Returns a status and a message or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      message:
 *                          $ref: '#/components/schemas/Message'
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 */
router.post('/uzenetek/create', async (req, res) => {
    try {
        const submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("irodavezeto.message_send")) {
            let msg = req.body.message;
            let userId = req.body.userId;
            let date = req.body.date;

            let data = {
                userId,
                date,
                message: msg,
                sendingName: submittingUser.name
            }

            const message = await database.createDocument(dbId, uzenetekId, ID.unique(), data);

            res.send({ status: "success", message });
        } else {
            res.send({ status: "fail", error: "Permission denied" });
        }
    } catch (error) {
        res.send({ status: "fail", error });
    }
})

module.exports = router;

/**
 * @openapi
 * components:
 *  schemas:
 *      Message:
 *          type: object
 *          properties:
 *              userId:
 *                  type: string
 *              date:
 *                  format: date
 *              message:
 *                  type: string
 *              sendingName:
 *                  type: string
 */