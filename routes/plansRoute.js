const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const cors = require('cors');
const { Client, Databases, Users, ID, Query } = require('node-appwrite');
const createExcel = require("../util/planToExcel");

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
const plansID = process.env.APPWRITE_PLANS_COLLECTION;

/**
 * @openapi
 * /plans/{id}:
 *  get:
 *      summary: Retrieve a plan by ID
 *      tags: [Plans]
 *      security:
 *          - ApiKeyAuth: []
 *      parameters:
 *          - in: path
 *            name: id
 *            schema:
 *              type: string
 *            required: true
 *            description: The ID of the plan to retrieve
 *      responses:
 *         200:
 *            description: Returns a status and a plan or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      plan:
 *                          $ref: '#/components/schemas/Plan'
 *                      filledOut:
 *                          type: boolean
 *                          description: Whether the plan is filled out or not
 */
router.get('/plans/:id', async (req, res) => {
    try {
        let submittingUser = await users.get(req.get('submittingId'));
        let plan = (await database.listDocuments(dbId, plansID, [Query.equal("userId", req.params.id)])).documents[0];
        if (plan == undefined) {
            let userFromId = await users.get(req.params.id);
            if (userFromId != undefined) {
                let planDoc = await database.createDocument(dbId, plansID, ID.unique(), {
                    userId: req.params.id,
                    managerId: userFromId.prefs.manager,
                    dates: [],
                    filledOut: false,
                });
                plan = planDoc.$id;
            } else {
                res.send({ status: "fail", error: "User does not exist" });
                return;
            }
        }
        if (submittingUser.prefs.perms.includes("hr.edit_user_current_state") || submittingUser.$id == req.params.id) {
            res.send({ status: "success", plan, filledOut: plan.filledOut });
        }
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

/**
 * @openapi
 * /plans/:
 *  post:
 *      summary: Create a new plan or update an existing one
 *      description: If the plan is not filled out but created, it will be updated, otherwise a new plan will be created
 *      tags: [Plans]
 *      security:
 *          - ApiKeyAuth: []
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          planDays:
 *                              type: array
 *                              items:
 *                                  type: string
 *                                  format: date
 *                              description: The days of the plan
 *      responses:
 *         200:
 *            description: Returns a status and a plan document or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      planDoc:
 *                          $ref: '#/components/schemas/Plan'
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 *                      errorCode:
 *                          type: string
 *                          description: The error code, if any
 */
router.post('/plans/', async (req, res) => {
    try {
        let id = req.get('submittingId');
        let plan = req.body.planDays;
        let filledOut = true;

        let submittingUser = await users.get(id);
        if (plan.length == 0) {
            res.send({ status: "fail", error: "Plan is empty", errorCode: "emptyPlan" });
            return;
        }

        if (submittingUser.prefs.maxdays == 0) {
            res.send({ status: "fail", error: "HR did not set the number of days yet", errorCode: "noDaysSet" });
            return;
        } else if (submittingUser.prefs.maxdays == plan.length) {
            filledOut = true;
            let doc = (await database.listDocuments(dbId, plansID, [Query.equal("userId", id)]))?.documents[0];
            if (doc == undefined) {
                let userFromId = await users.get(id);
                if (userFromId != undefined) {
                    let planDoc = await database.createDocument(dbId, plansID, ID.unique(), {
                        userId: id,
                        managerId: userFromId.prefs.manager,
                        dates: plan,
                        filledOut: filledOut,
                    });
                    res.send({ status: "success", planDoc });
                    return;
                } else {
                    res.send({ status: "fail", error: "User does not exist" });
                    return;
                }
            } else {
                if (doc.filledOut) {
                    res.send({ status: "fail", error: "Plan already filled out" });
                    return;
                } {
                    let docId = doc?.$id;
                    let planDoc = await database.updateDocument(dbId, plansID, docId, {
                        dates: plan,
                        filledOut: filledOut,
                    })
                    res.send({ status: "success", planDoc });
                    return;
                }
            }
        } else if (submittingUser.prefs.maxdays > plan.length) {
            res.send({ status: "fail", error: "Did not use all days", errorCode: "notAllDaysUsed" });
            return;
        } else if (submittingUser.prefs.maxdays < plan.length) {
            res.send({ status: "fail", error: "Used too many days", errorCode: "tooManyDaysUsed" });
            return;
        }
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

const resetUserPlan = async (id) => {
    let doc = (await database.listDocuments(dbId, plansID, [Query.equal("userId", id)]))?.documents[0];
    if (doc == undefined) {
        let userFromId = await users.get(id);
        if (userFromId != undefined) {
            let planDoc = await database.createDocument(dbId, plansID, ID.unique(), {
                userId: id,
                managerId: userFromId.prefs.manager,
                dates: [],
                filledOut: false,
            });
            return planDoc;
        } else {
            return undefined;
        }
    } else {
        let docId = doc?.$id;
        let planDoc = await database.updateDocument(dbId, plansID, docId, {
            dates: [],
            filledOut: false,
        })
        return planDoc;
    }

}

/**
 * @openapi
 * /plans/reset:
 *  delete:
 *      summary: Reset all user plans 
 *      description: (can only run in January for abuse prevention reasons)
 *      tags: [Plans]
 *      security:
 *          - ApiKeyAuth: []
 *      responses:
 *         200:
 *            description: Returns a status or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 */
// reset can only run in january
router.delete('/plans/reset', async (req, res) => {
    try {
        const submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("hr.edit_user_current_state") && (new Date().getMonth() == 0)) {
            let users = await database.listDocuments(dbId, plansID, [Query.limit(1000)]);
            for (const element of users.documents) {
                let uId = element.userId;
                resetUserPlan(uId);
            }
            res.send({ status: "success" });
        }
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

/**
 * @openapi
 * /plans/{id}:
 *  delete:
 *      summary: Reset a user's plan by ID
 *      tags: [Plans]
 *      security:
 *          - ApiKeyAuth: []
 *      parameters:
 *          - in: path
 *            name: id
 *            schema:
 *              type: string
 *            required: true
 *            description: The ID of the plan to reset
 *      responses:
 *         200:
 *            description: Returns a status and a plan document or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      planDoc:
 *                          $ref: '#/components/schemas/Plan'
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 */
router.delete('/plans/:id', async (req, res) => {
    try {
        const submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("hr.edit_user_current_state")) {
            let uId = req.params.id;
            resetUserPlan(uId).then((planDoc) => {
                res.send({ status: "success", planDoc });
            }).catch((error) => {
                res.send({ status: "fail", error });
            });
        } else {
            res.send({ status: "fail", error: "Permission denied" });
        }

    } catch (error) {
        res.send({ status: "fail", error });
    }
});

/**
 * @openapi
 * /plans/{id}/excel:
 *  get:
 *      summary: Generate an Excel file for a user's plan by ID
 *      tags: [Plans]
 *      security:
 *          - ApiKeyAuth: []
 *      parameters:
 *          - in: path
 *            name: id
 *            schema:
 *              type: string
 *            required: true
 *            description: The ID of the plan to generate an Excel file for
 *      responses:
 *         200:
 *            description: Returns an Excel file or an error message
 *            content:
 *             application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *                schema:
 *                  type: string
 *                  format: binary
 *                  description: The generated Excel file
 *         default:
 *            description: Unexpected error
 *            content:
 *              application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 */
router.get('/plans/:id/excel', async (req, res) => {
    console.log("excel");
    try {
        const submittingUser = await users.get(req.get('submittingId'));
        const user = await users.get(req.params.id);
        console.log(submittingUser);
        if (submittingUser.prefs.perms.includes("hr.edit_user_current_state")) {
            let uId = req.params.id;
            let doc = (await database.listDocuments(dbId, plansID, [Query.equal("userId", uId)]))?.documents[0];
            if (doc == undefined) {
                let userFromId = await users.get(req.params.id);
                if (userFromId != undefined) {
                    doc = await database.createDocument(dbId, plansID, ID.unique(), {
                        userId: req.params.id,
                        managerId: userFromId.prefs.manager,
                        dates: [],
                        filledOut: false,
                    });
                }
            }
            createExcel(doc, user?.name).then((data) => {
                console.log("excel created");
                // send back the excel file from the buffer
                // set the content type to excel
                res.contentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                res.send(data);
            }).catch((error) => {
                res.send({ status: "fail", error });
            });
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
 *      Plan:
 *          type: object
 *          properties:
 *              userId:
 *                  type: string
 *              managerId:
 *                  type: string
 *              type: 
 *                  type: string
 *              dates:
 *                  type: array
 *                  items:
 *                      format: date
 *              filledOut: 
 *                  type: boolean
 *                  default: false
 */