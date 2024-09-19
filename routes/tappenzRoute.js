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
const tappenzID = process.env.APPWRITE_TAPPENZ_COLLECTION;

/**
 * @openapi
 * /tappenz/start:
 *  post:
 *      summary: Start a new tappenz entry with only starting date filled out
 *      tags: [Tappenz]
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
 *                              description: The ID of the user starting the tappenz
 *                          start:
 *                              type: string
 *                              format: date
 *                              description: The start date of the tappenz in format YYYY-MM-DD
 *      responses:
 *         200:
 *            description: Returns a status and a tappenz document or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      tappenz:
 *                          $ref: '#/components/schemas/Tappenz'
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 */
router.post('/tappenz/start', async (req, res) => {
    // create new tappenz entry with only starting date filled out
    try {
        let submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("hr.edit_user_current_state")) {
            let userInQuestion = await users.get(req.body.userId);
            if (userInQuestion == undefined) {
                res.send({ status: "fail", error: "User does not exist" });
                return;
            }
            let tappenz = await database.createDocument(dbId, tappenzID, ID.unique(), {
                userId: req.body.userId,
                managerId: userInQuestion.prefs.manager,
                // date should be in format YYYY-MM-DD
                startDate: req.body.start,
                endDate: null,
            });
            res.send({ status: "success", tappenz });
        }
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

/**
 * @openapi
 * /tappenz/current/{id}:
 *  get:
 *      summary: Retrieve the current tappenz status of a user by ID
 *      tags: [Tappenz]
 *      security:
 *          - ApiKeyAuth: []
 *      parameters:
 *          - in: path
 *            name: id
 *            schema:
 *              type: string
 *            required: true
 *            description: The ID of the user whose current tappenz status to retrieve
 *      responses:
 *         200:
 *            description: Returns a status and a boolean indicating if the user is currently in tappenz or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      current:
 *                          type: boolean
 *                          description: Whether the user is currently in tappenz
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 */
router.get("/tappenz/current/:id", async (req, res) => {
    try {
        let submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("hr.edit_user_current_state") || submittingUser.$id == req.params.id) {
            let tappenz = (await database.listDocuments(dbId, tappenzID, [Query.equal("userId", req.params.id), Query.orderDesc("startDate")])).documents[0];
            if (tappenz == undefined) {
                res.send({ status: "success", current: false });
                return;
            }
            if (tappenz.endDate == null) {
                res.send({ status: "success", current: true });
                return;
            }
            let startDate = new Date(tappenz.startDate);
            let endDate = new Date(tappenz.endDate);
            let today = new Date(new Date().toISOString().split('T')[0]);
            if (startDate <= today && today <= endDate) {
                res.send({ status: "success", current: true });
                return;
            }

            if (endDate < today) {
                res.send({ status: "success", current: false });
                return;
            }
            res.send({ status: "success", current: false });
        }
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

/**
 * @openapi
 * /tappenz/end:
 *  post:
 *      summary: End a tappenz entry by filling out the end date
 *      tags: [Tappenz]
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
 *                              description: The ID of the user ending the tappenz
 *                          end:
 *                              type: string
 *                              format: date
 *                              description: The end date of the tappenz in format YYYY-MM-DD
 *      responses:
 *         200:
 *            description: Returns a status and a tappenz document or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      tappenzDoc:
 *                          $ref: '#/components/schemas/Tappenz'
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 */
router.post("/tappenz/end", async (req, res) => {
    try {
        let submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("hr.edit_user_current_state")) {
            let tappenz = (await database.listDocuments(dbId, tappenzID, [Query.equal("userId", req.body.userId), Query.orderDesc("startDate")])).documents[0];
            if (tappenz == undefined) {
                res.send({ status: "fail", error: "No tappenz entry found" });
                return;
            }
            if (tappenz.endDate != null) {
                res.send({ status: "fail", error: "Tappenz entry already ended" });
                return;
            }
            let docID = tappenz.$id;
            let tappenzDoc = await database.updateDocument(dbId, tappenzID, docID, {
                endDate: req.body.end,
            });
            res.send({ status: "success", tappenzDoc });
        } else {
            res.send({ status: "fail", error: "Permission denied" });
            return;
        }
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

/**
 * @openapi
 * /tappenz/{id}:
 *  delete:
 *      summary: Delete a tappenz entry by ID
 *      tags: [Tappenz]
 *      security:
 *          - ApiKeyAuth: []
 *      parameters:
 *          - in: path
 *            name: id
 *            schema:
 *              type: string
 *            required: true
 *            description: The ID of the tappenz entry to delete
 *      responses:
 *         200:
 *            description: Returns a status and a tappenz document or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      tappenzDoc:
 *                          $ref: '#/components/schemas/Tappenz'
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 */
router.delete('/tappenz/:id', async (req, res) => {
    try {
        console.log(req.params.id);
        let submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("hr.edit_user_current_state")) {
            let tappenz = (await database.listDocuments(dbId, tappenzID, [Query.equal("$id", req.params.id), Query.orderDesc("startDate")])).documents[0];
            if (tappenz == undefined) {
                res.send({ status: "fail", error: "No tappenz entry found" });
                return;
            }
            let docID = tappenz.$id;
            let tappenzDoc = await database.deleteDocument(dbId, tappenzID, docID);
            res.send({ status: "success", tappenzDoc });
        } else {
            res.send({ status: "fail", error: "Permission denied" });
            return;
        }
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

// returns last 5 tappenz entries
/**
 * @openapi
 * /tappenz/{id}:
 *  get:
 *      summary: Retrieve the last 5 tappenz entries of a user by ID
 *      tags: [Tappenz]
 *      security:
 *          - ApiKeyAuth: []
 *      parameters:
 *          - in: path
 *            name: id
 *            schema:
 *              type: string
 *            required: true
 *            description: The ID of the user whose last 5 tappenz entries to retrieve
 *      responses:
 *         200:
 *            description: Returns a status and a list of tappenz entries or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      tappenz:
 *                          type: array
 *                          items:
 *                              $ref: '#/components/schemas/Tappenz'
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 */
router.get("/tappenz/:id", async (req, res) => {
    try {
        let submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("hr.edit_user_current_state")) {
            let tappenz = (await database.listDocuments(dbId, tappenzID, [Query.equal("userId", req.params.id), Query.orderDesc("startDate"), Query.limit(5)])).documents;
            res.send({ status: "success", tappenz });
        } else {
            res.send({ status: "fail", error: "Permission denied" });
            return;
        }
    } catch (error) {
        res.send({ status: "fail", error });
    }
})

/**
 * @openapi
 * /tappenz/{id}/cumulative:
 *  get:
 *      summary: Retrieve the cumulative number of days a user has taken as sick leave by ID
 *      tags: [Tappenz]
 *      security:
 *          - ApiKeyAuth: []
 *      parameters:
 *          - in: path
 *            name: id
 *            schema:
 *              type: string
 *            required: true
 *            description: The ID of the user whose cumulative sick leave days to retrieve
 *      responses:
 *         200:
 *            description: Returns a status and the cumulative number of sick leave days or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      cumulative:
 *                          type: integer
 *                          description: The cumulative number of sick leave days
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 */
// TODO: how many days did the user take as sick leave.
router.get("/tappenz/:id/cumulative", async (req, res) => {
    try {
        let submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("hr.edit_user_current_state")) {
            let tappenz = (await database.listDocuments(dbId, tappenzID, [Query.equal("userId", req.params.id), Query.orderDesc("startDate")])).documents;
            let cumulative = 0;
            for (const element of tappenz) {
                if (element.endDate == null) {
                    continue;
                }
                let startDate = new Date(element.startDate);
                let endDate = new Date(element.endDate);
                let diff = Math.abs(endDate - startDate);
                let days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
                cumulative += days;
            }
            res.send({ status: "success", cumulative });
        } else {
            res.send({ status: "fail", error: "Permission denied" });
            return;
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
 *      Tappenz:
 *          type: object
 *          properties:
 *              startDate: 
 *                  format: date
 *              endDate:
 *                  format: date
 *              userId:
 *                  type: string
 *              managerId:
 *                  type: string
 */