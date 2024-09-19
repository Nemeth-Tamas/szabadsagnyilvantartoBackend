const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const cors = require('cors');
const { Client, Databases, Users, ID, Query } = require('node-appwrite');
const { sendEmail } = require('../util/email');
const { isOnLeave } = require('../util/sickDayCalc');

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
const kerelmekId = process.env.APPWRITE_KERELMEK_COLLECTION;
const szabadsagID = process.env.APPWRITE_SZABADSAGOK_COLLECTION;

async function checkManagerAndSendEmail(managerId, name, dates) {
    // Check if the users manager is on leave currently
    let manager = await users.get(managerId);
    let managersLeaves = await database.listDocuments(dbId, szabadsagID, [Query.equal("userId", manager.$id)]);

    let managerOnLeaveToday = await isOnLeave(managersLeaves.documents);

    if (managerOnLeaveToday) {
        let subject = "Kérelem érkezett";
        let text = `${name} a következő időpontokra kért szabadságot: ${dates.join(", ")}.\n\nKérem, hogy a kérelmet mielőbb vizsgálja át.`;
        sendEmail(subject, text);
    }
}

/**
 * @openapi
 * /kerelmek/:
 *  get:
 *      summary: Get all kerelmek assigned to a specific manager
 *      tags: [Kerelmek]
 *      security:
 *          - ApiKeyAuth: []
 *      responses:
 *         200:
 *          description: Returns a status and a list of kerelmek or an error message
 *          content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      kerelmek:
 *                          type: array
 *                          description: The list of kerelmek
 *                          items:
 *                              $ref: '#/components/schemas/Kerelem'
 */
router.get('/kerelmek/', async (req, res) => {
    try {
        let submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("irodavezeto.approve")) {
            let offset = req.query.offset || 0;
            let kerelmek = await database.listDocuments(dbId, kerelmekId, [Query.equal("managerId", submittingUser.$id), Query.orderDesc("$createdAt"), Query.limit(25), Query.offset(offset)]);
            
            res.send({ status: "success", kerelmek });
        }
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

/**
 * @openapi
 * /kerelmek/own:
 *  get:
 *      summary: Get all kerelmek assigned to a specific user
 *      tags: [Kerelmek]
 *      security:
 *          - ApiKeyAuth: []
 *      responses:
 *         200:
 *            description: Returns a status and a list of kerelmek or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      kerelmek:
 *                          type: array
 *                          description: The list of kerelmek
 *                          items:
 *                              $ref: '#/components/schemas/Kerelem'
 */
router.get('/kerelmek/own', async (req, res) => {
    try {
        let submittingUser = await users.get(req.get('submittingId'));
        let offset = req.query.offset || 0;
        let kerelmek = await database.listDocuments(dbId, kerelmekId, [Query.equal("submittingId", submittingUser.$id), Query.orderDesc("$createdAt"), Query.limit(25), Query.offset(offset)]);
        res.send({ status: "success", kerelmek });
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

/**
 * @openapi
 * /kerelmek/all:
 *  get:
 *      summary: Get all kerelmek assigned to anyone in the same domain as the user
 *      tags: [Kerelmek]
 *      security:
 *          - ApiKeyAuth: []
 *      responses:
 *         200:
 *            description: Returns a status and a list of kerelmek or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      kerelmek:
 *                          type: array
 *                          description: The list of kerelmek
 *                          items:
 *                              $ref: '#/components/schemas/Kerelem'
 */
router.get('/kerelmek/all', async (req, res) => {
    try {
        let submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("hr.edit_user_current_state")) {
            let kerelmek = await database.listDocuments(dbId, kerelmekId, [Query.orderDesc("$createdAt")]);
            let toReturn = [];
            for (let kerelem of kerelmek.documents) {
                if (kerelem.submittingUserIdentifier == submittingUser.email.split("@")[1]) {
                    toReturn.push(kerelem);
                }
            }
            kerelmek.documents = toReturn;
            res.send({ status: "success", kerelmek });
        } else {
            res.send({ status: "fail", error: "Permission denied" });
        }
    } catch (error) {
        res.send({ status: "fail", error });
    }
});
    
/**
 * @openapi
 * /kerelmek/add:
 *  post:
 *      summary: Add a new kerelem
 *      tags: [Kerelmek]
 *      security:
 *          - ApiKeyAuth: []
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          managerId:
 *                              type: string
 *                              description: The ID of the manager
 *                          type:
 *                              type: string
 *                              description: The type of the kerelem
 *                          dates:
 *                              type: array
 *                              description: The dates for the kerelem
 *                              items:
 *                                  type: string
 *                                  format: date
 *      responses:
 *         200:
 *            description: Returns a status and a kerelem or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      kerelem:
 *                          $ref: '#/components/schemas/Kerelem'
 */
router.post('/kerelmek/add', async (req, res) => {
    try {
        let submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("felhasznalo.request")) {
            console.log(req.body);
            let managerId = req.body.managerId;
            if (managerId != submittingUser.prefs.manager) {
                console.log("Permission denied");
                res.send({ status: "fail", error: "Permission denied" });
                return;
            }
            let type = req.body.type;
            let dates = req.body.dates;
            let name = submittingUser.name;
            let kerelem = await database.createDocument(dbId, kerelmekId, ID.unique(), {
                submittingId: submittingUser.$id,
                managerId: managerId,
                type: type,
                dates: dates,
                submittingUserIdentifier: submittingUser.email.split("@")[1],
                submittingName: name,
            });

            checkManagerAndSendEmail(managerId, name, dates);

            res.send({ status: "success", kerelem });
            return;
        }
        else {
            res.send({ status: "fail", error: "Permission denied" });
            return;
        }
    } catch (error) {
        res.send({ status: "fail", error });
        return;
    }
});

/**
 * @openapi
 * /kerelmek/{id}:
 *  get:
 *      summary: Retrieve a kerelem by ID
 *      tags: [Kerelmek]
 *      security:
 *          - ApiKeyAuth: []
 *      parameters:
 *          - in: path
 *            name: id
 *            schema:
 *              type: string
 *            required: true
 *            description: The ID of the kerelem to retrieve
 *      responses:
 *         200:
 *            description: Returns a status and a kerelem or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      kerelem:
 *                          $ref: '#/components/schemas/Kerelem'
 */
router.get('/kerelmek/:id', async (req, res) => {
    try {
        let submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("felhasznalo.request")) {
            let kerelem = await database.getDocument(dbId, kerelmekId, req.params.id);
            res.send({ status: "success", kerelem });
        } else {
            res.send({ status: "fail", error: "Permission denied" });
        }
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

/**
 * @openapi
 * /kerelmek/{id}:
 *  delete:
 *      summary: Delete a kerelem by ID
 *      tags: [Kerelmek]
 *      security:
 *          - ApiKeyAuth: []
 *      parameters:
 *          - in: path
 *            name: id
 *            schema:
 *              type: string
 *            required: true
 *            description: The ID of the kerelem to delete
 *      responses:
 *         200:
 *            description: Returns a status and a kerelem or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      kerelem:
 *                          $ref: '#/components/schemas/Kerelem'
 */
router.delete('/kerelmek/:id', async (req, res) => {
    try {
        let submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("felhasznalo.delete_request")) {
            let current = await database.getDocument(dbId, kerelmekId, req.params.id);

            if (current.szabadsagId != null) {
                await database.deleteDocument(dbId, szabadsagID, current.szabadsagId);
                let user = await users.get(current.submittingId);
                let daysCount = current.dates.length;
                let newPrefs = user.prefs;
                if (current.type == "SZ") {
                    newPrefs.remainingdays += daysCount;
                }
                let newUser = await users.updatePrefs(user.$id, newPrefs);
            }
            let kerelem = await database.deleteDocument(dbId, kerelmekId, req.params.id);
            res.send({ status: "success", kerelem });
        } else {
            res.send({ status: "fail", error: "Permission denied" });
        }
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

/**
 * @openapi
 * /kerelmek/{id}/approve:
 *  put:
 *      summary: Approve a kerelem by ID
 *      tags: [Kerelmek]
 *      security:
 *          - ApiKeyAuth: []
 *      parameters:
 *          - in: path
 *            name: id
 *            schema:
 *              type: string
 *            required: true
 *            description: The ID of the kerelem to approve
 *      responses:
 *         200:
 *            description: Returns a status and a kerelem or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      kerelem:
 *                          $ref: '#/components/schemas/Kerelem'
 */
router.put('/kerelmek/:id/approve', async (req, res) => {
    try {
        let submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("irodavezeto.approve")) {
            let current = await database.getDocument(dbId, kerelmekId, req.params.id);
            let szabadsag = await database.createDocument(dbId, szabadsagID, ID.unique(), {
                userId: current.submittingId,
                dates: current.dates,
                type: current.type,
                managerId: current.managerId,
            });

            let daysCount = current.dates.length;
            let user = await users.get(current.submittingId);
            let newPrefs = user.prefs;
            if (current.type == "SZ") {
                newPrefs.remainingdays -= daysCount;
            }
            let newUser = await users.updatePrefs(user.$id, newPrefs);

            let kerelem = await database.updateDocument(dbId, kerelmekId, req.params.id, {
                approved: true,
                szabadsagId: szabadsag.$id
            });
            res.send({ status: "success", kerelem });
        } else {
            res.send({ status: "fail", error: "Permission denied" });
        }
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

/**
 * @openapi
 * /kerelmek/{id}/reject:
 *  put:
 *      summary: Reject a kerelem by ID
 *      tags: [Kerelmek]
 *      security:
 *          - ApiKeyAuth: []
 *      parameters:
 *          - in: path
 *            name: id
 *            schema:
 *              type: string
 *            required: true
 *            description: The ID of the kerelem to reject
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          rejectedMessage:
 *                              type: string
 *                              description: The reason for the rejection
 *      responses:
 *         200:
 *            description: Returns a status and a kerelem or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      kerelem:
 *                          $ref: '#/components/schemas/Kerelem'
 */
router.put('/kerelmek/:id/reject', async (req, res) => {
    try {
        let submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("irodavezeto.approve")) {
            let kerelem = await database.updateDocument(dbId, kerelmekId, req.params.id, {
                rejected: true,
                rejectedMessage: req.body.rejectedMessage,
            });
            res.send({ status: "success", kerelem });
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
 *  securitySchemes:
 *      ApiKeyAuth:
 *          type: apiKey
 *          in: header
 *          name: submittingId
 *  schemas:
 *      Kerelem:
 *          type: object
 *          properties:
 *              submittingId:
 *                  type: string
 *              managerId:
 *                  type: string
 *              type: 
 *                  type: string
 *              dates:
 *                  type: array
 *                  items:
 *                      format: date
 *              approved: 
 *                  type: boolean
 *                  default: false
 *              rejected:
 *                  type: boolean
 *                  default: false
 *              rejectedMessage: 
 *                  type: string
 *              szabadsagId:
 *                  type: string
 *              submittingUserIdentifier:
 *                  type: string
 *              submittingName:
 *                  type: string
 */