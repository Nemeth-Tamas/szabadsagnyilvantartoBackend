const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const cors = require('cors');
const { Client, Databases, Users, ID, Query } = require('node-appwrite');

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
const szabadsagID = process.env.APPWRITE_SZABADSAGOK_COLLECTION;

/**
 * @openapi
 * /szabadsagok/own:
 *  get:
 *      summary: Retrieve the szabadsagok of the authenticated user
 *      tags: [Szabadsagok]
 *      security:
 *          - ApiKeyAuth: []
 *      responses:
 *         200:
 *            description: Returns a status and a list of szabadsagok or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      szabadsagok:
 *                          type: array
 *                          items:
 *                              $ref: '#/components/schemas/Szabadsag'
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 */
router.get('/szabadsagok/own', async (req, res) => {
    try {
        let submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("felhasznalo.request")) {
            let szabadsagok = await database.listDocuments(dbId, szabadsagID, [Query.equal("userId", submittingUser.$id), Query.orderDesc("$createdAt")]);
            res.send({ status: "success", szabadsagok });
        }
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

/**
 * @openapi
 * /szabadsagok/{id}:
 *  get:
 *      summary: Retrieve the szabadsagok of a user by ID
 *      tags: [Szabadsagok]
 *      security:
 *          - ApiKeyAuth: []
 *      parameters:
 *          - in: path
 *            name: id
 *            schema:
 *              type: string
 *            required: true
 *            description: The ID of the user whose szabadsagok to retrieve
 *      responses:
 *         200:
 *            description: Returns a status and a list of szabadsagok or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      szabadsag:
 *                          type: array
 *                          items:
 *                              $ref: '#/components/schemas/Szabadsag'
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 */
router.get('/szabadsagok/:id', async (req, res) => {
    try {
        let submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("jegyzo.list_all")) {
            console.log(req.params.id);
            console.log(submittingUser.$id);
            let szabadsag = await database.listDocuments(dbId, szabadsagID, [Query.equal("userId", req.params.id), Query.orderDesc("$createdAt")]);
            res.send({ status: "success", szabadsag });
        } else if (submittingUser.prefs.perms.includes("irodavezeto.list_own")) {
            let szabadsag = await database.listDocuments(dbId, szabadsagID, [Query.equal("userId", req.params.id), Query.orderDesc("$createdAt")])
            res.send({ status: "success", szabadsag });
        } else {
            res.send({ status: "fail", error: "Permission denied" });
        }
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

module.exports = router;

/**
 * @openapi
 * components:
 *  schemas:
 *      Szabadsag:
 *          type: object
 *          properties:
 *              type: 
 *                  type: string
 *                  default: sz
 *              dates:
 *                  type: array
 *                  items:
 *                      format: date
 *              userId:
 *                  type: string
 *              managerId:
 *                  type: string
 */