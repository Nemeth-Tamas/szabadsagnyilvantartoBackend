const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const cors = require('cors');
const { Client, Databases, Users, ID, Query } = require('node-appwrite');
const { isSick, isOnLeave } = require('../util/sickDayCalc');

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
const plansID = process.env.APPWRITE_PLANS_COLLECTION;
const tappenzID = process.env.APPWRITE_TAPPENZ_COLLECTION;

async function checkStatus(user) {
    // check tappenz and if on leave
    let tappenz = (await database.listDocuments(dbId, tappenzID, [Query.equal("userId", user.$id), Query.orderDesc("startDate")])).documents[0];
    user.prefs.sick = isSick(tappenz);
    let szabadsagok = (await database.listDocuments(dbId, szabadsagID, [Query.equal("userId", user.$id), Query.limit(1000)])).documents;
    user.prefs.onLeave = await isOnLeave(szabadsagok);
    return user;
}

/**
 * @openapi
 * /users/:
 *  get:
 *      summary: Retrieve a list of users based on the permissions of the submitting user
 *      tags: [Users]
 *      security:
 *          - ApiKeyAuth: []
 *      responses:
 *         200:
 *            description: Returns a status and a list of users or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      usersList:
 *                          type: array
 *                          items:
 *                              $ref: '#/components/schemas/User'
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 */
router.get('/users/', async (req, res) => {
    try {
        let submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("jegyzo.list_all")) {
            let usersList = await users.list([Query.limit(25), Query.offset(0)]);
            // while there are more users to fetch (pagination) add them to the list
            while (usersList.users.length < usersList.total) {
                usersList.users = usersList.users.concat((await users.list([Query.limit(25), Query.offset(usersList.users.length)])).users);
            }

            let toReturn = [];
            for (let user of usersList.users) {
                if (user.email.endsWith(submittingUser.email.split("@")[1])) {
                    toReturn.push(await checkStatus(user));
                }
            }
            usersList.users = toReturn;
            res.send({ status: "success", usersList });
        } else if (submittingUser.prefs.perms.includes("irodavezeto.list_own")) {
            const usersList = await users.list([Query.limit(25), Query.offset(0)]);
            // while there are more users to fetch (pagination) add them to the list
            while (usersList.users.length < usersList.total) {
                usersList.users = usersList.users.concat((await users.list([Query.limit(25), Query.offset(usersList.users.length)])).users);
            }
            
            usersList.users = usersList.users.filter(user => user.prefs.manager.includes(submittingUser.$id));
            for (let user of usersList.users) {
                user = await checkStatus(user);
            }
            res.send({ status: "success", usersList });
        } else {
            res.send({ status: "fail", error: "Permission denied" });
        }
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

/**
 * @openapi
 * /users/{id}:
 *  get:
 *      summary: Retrieve a user by ID based on the permissions of the submitting user
 *      tags: [Users]
 *      security:
 *          - ApiKeyAuth: []
 *      parameters:
 *          - in: path
 *            name: id
 *            schema:
 *              type: string
 *            required: true
 *            description: The ID of the user to retrieve
 *      responses:
 *         200:
 *            description: Returns a status and a user or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      user:
 *                          $ref: '#/components/schemas/User'
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 */
router.get('/users/:id', async (req, res) => {
    try {
        let submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("jegyzo.list_all")) {
            let user = await users.get(req.params.id);
            if (user.email.endsWith(submittingUser.email.split("@")[1])) {
                user = await checkStatus(user);
                res.send({ status: "success", user });
            } else {
                res.send({ status: "fail", error: "Permission denied" });
            }
        } else if (submittingUser.prefs.perms.includes("irodavezeto.list_own")) {
            let user = await users.get(req.params.id);
            if (user.email.endsWith(submittingUser.email.split("@")[1]) && user.prefs.manager.includes(submittingUser.$id)) {
                user = await checkStatus(user);
                res.send({ status: "success", user });
            } else {
                res.send({ status: "fail", error: "Permission denied" });
            }
        } else {
            res.send({ status: "fail", error: "Permission denied" });
        }
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

/**
 * @openapi
 * /users/register:
 *  post:
 *      summary: Register a new user
 *      tags: [Users]
 *      security:
 *          - ApiKeyAuth: []
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          email:
 *                              type: string
 *                          password:
 *                              type: string
 *                              description: The password should be bcrypt hashed already
 *                          name:
 *                              type: string
 *                          role:
 *                              type: string
 *                          manager:
 *                              type: string
 *                          perms:
 *                              type: array
 *                              items:
 *                                  type: string
 *                          maxdays:
 *                              type: integer
 *                          remainingdays:
 *                              type: integer
 *      responses:
 *         200:
 *            description: Returns a status, a user, and preferences or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      user:
 *                          $ref: '#/components/schemas/User'
 *                      prefs:
 *                          type: object
 *                          description: The preferences of the user
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 */
router.post('/users/register', async (req, res) => {
    try {
        const submittingUser = await users.get(req.get('submittingId'));
        console.log(submittingUser);
        if (!submittingUser.prefs.perms.includes("jegyzo.create_user")) {
            res.send({ status: "fail", error: "Permission denied" });
            return;
        }
    } catch (error) {
        res.send({ status: "fail", error });
        return;
    }
    try {
        const user = await users.createBcryptUser(ID.unique(), req.body.email, req.body.password, req.body.name);
        let manager = req.body.role == "admin" ? user.$id : req.body.manager;
        let perms = req.body.role == "admin"
            ? ["felhasznalo.request", "felhasznalo.delete_request",
                "irodavezeto.approve", "irpdavezeto.reject",
                "irodavezeto.message_send", "jegyzo.edit_user",
                "jegyzo.create_user", "jegyzo.delete_user", "jegyzo.list_all",
                "hr.edit_user_perms", "hr.edit_user_current_state"]
            : req.body.perms;
        let preferences = { "perms": perms, "manager": manager, "role": req.body.role, "maxdays": req.body.maxdays, "remainingdays": req.body.remainingdays, "sick": false };
        const prefs = await users.updatePrefs(user.$id, preferences);

        // Creating plan entry for user
        await database.createDocument(dbId, plansID, ID.unique(), {
            userId: user.$id,
            managerId: prefs.manager,
            filledOut: false,
        });

        res.send({ status: "success", user, prefs });
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

/**
 * @openapi
 * /users/{id}:
 *  delete:
 *      summary: Delete a user by ID based on the permissions of the submitting user
 *      tags: [Users]
 *      security:
 *          - ApiKeyAuth: []
 *      parameters:
 *          - in: path
 *            name: id
 *            schema:
 *              type: string
 *            required: true
 *            description: The ID of the user to delete
 *      responses:
 *         200:
 *            description: Returns a status and a user or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      user:
 *                          $ref: '#/components/schemas/User'
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 */
router.delete('/users/:id', async (req, res) => {
    try {
        const submittingUser = await users.get(req.get('submittingId'));
        if (!submittingUser.prefs.perms.includes("jegyzo.delete_user")) {
            res.send({ status: "fail", error: "Permission denied" });
            return;
        }
        const user = await users.delete(req.params.id);

        // delete requests
        const requests = await database.listDocuments(dbId, kerelmekId, [Query.equal("submittingId", req.params.id), Query.limit(1000)]);
        for (let request of requests.documents) {
            await database.deleteDocument(dbId, kerelmekId, request.$id);
        }

        // delete szabadsagok
        const szabadsagok = await database.listDocuments(dbId, szabadsagID, [Query.equal("userId", req.params.id), Query.limit(1000)]);
        for (let szabadsag of szabadsagok.documents) {
            await database.deleteDocument(dbId, szabadsagID, szabadsag.$id);
        }

        const plans = await database.listDocuments(dbId, plansID, [Query.equal("userId", req.params.id), Query.limit(1000)]);
        for (let plan of plans.documents) {
            await database.deleteDocument(dbId, plansID, plan.$id);
        }
        res.send({ status: "success", user });
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

/**
 * @openapi
 * /users/{id}/perms:
 *  patch:
 *      summary: Update a user's permissions by ID based on the permissions of the submitting user
 *      tags: [Users]
 *      security:
 *          - ApiKeyAuth: []
 *      parameters:
 *          - in: path
 *            name: id
 *            schema:
 *              type: string
 *            required: true
 *            description: The ID of the user whose permissions to update
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          perms:
 *                              type: array
 *                              items:
 *                                  type: string
 *      responses:
 *         200:
 *            description: Returns a status and a user or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      newUser:
 *                          $ref: '#/components/schemas/User'
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 */
router.patch('/users/:id/perms', async (req, res) => {
    try {
        const user = await users.get(req.params.id);
        let submittingId = req.get('submittingId');
        let submittingUser = await users.get(submittingId);
        if (!submittingUser.prefs.perms.includes("hr.edit_user_perms")) {
            res.send({ status: "fail", error: "Permission denied" });
            return;
        }
        await users.updatePrefs(req.params.id, { "perms": req.body.perms, "role": user.prefs.role, "manager": user.prefs.manager, "maxdays": user.prefs.maxdays, "remainingdays": user.prefs.remainingdays, "sick": user.prefs.sick });

        let newUser = await users.get(req.params.id);
        res.send({ status: "success", newUser });
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

/**
 * @openapi
 * /users/{id}/manager:
 *  patch:
 *      summary: Update a user's manager by ID based on the permissions of the submitting user
 *      tags: [Users]
 *      security:
 *          - ApiKeyAuth: []
 *      parameters:
 *          - in: path
 *            name: id
 *            schema:
 *              type: string
 *            required: true
 *            description: The ID of the user whose manager to update
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          manager:
 *                              type: string
 *      responses:
 *         200:
 *            description: Returns a status and a user or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      newUser:
 *                          $ref: '#/components/schemas/User'
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 */
router.patch('/users/:id/manager', async (req, res) => {
    try {
        const user = await users.get(req.params.id);
        let submittingId = req.get('submittingId');
        let submittingUser = await users.get(submittingId);
        if (!submittingUser.prefs.perms.includes("hr.edit_user_perms")) {
            res.send({ status: "fail", error: "Permission denied" });
            return;
        }
        await users.updatePrefs(req.params.id, { "perms": user.prefs.perms, "role": user.prefs.role, "manager": req.body.manager, "maxdays": user.prefs.maxdays, "remainingdays": user.prefs.remainingdays, "sick": user.prefs.sick });

        let newUser = await users.get(req.params.id);
        res.send({ status: "success", newUser });
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

/**
 * @openapi
 * /users/{id}/role:
 *  patch:
 *      summary: Update a user's role by ID based on the permissions of the submitting user
 *      tags: [Users]
 *      security:
 *          - ApiKeyAuth: []
 *      parameters:
 *          - in: path
 *            name: id
 *            schema:
 *              type: string
 *            required: true
 *            description: The ID of the user whose role to update
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          role:
 *                              type: string
 *      responses:
 *         200:
 *            description: Returns a status and a user or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      newUser:
 *                          $ref: '#/components/schemas/User'
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 */
router.patch('/users/:id/role', async (req, res) => {
    try {
        const user = await users.get(req.params.id);
        let submittingId = req.get('submittingId');
        let submittingUser = await users.get(submittingId);
        if (!submittingUser.prefs.perms.includes("hr.edit_user_perms")) {
            res.send({ status: "fail", error: "Permission denied" });
            return;
        }
        await users.updatePrefs(req.params.id, { "perms": user.prefs.perms, "role": req.body.role, "manager": user.prefs.manager, "maxdays": user.prefs.maxdays, "remainingdays": user.prefs.remainingdays, "sick": user.prefs.sick });

        let newUser = await users.get(req.params.id);
        res.send({ status: "success", newUser });
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

/**
 * @openapi
 * /users/{id}/maxdays:
 *  patch:
 *      summary: Update a user's maxdays by ID based on the permissions of the submitting user
 *      tags: [Users]
 *      security:
 *          - ApiKeyAuth: []
 *      parameters:
 *          - in: path
 *            name: id
 *            schema:
 *              type: string
 *            required: true
 *            description: The ID of the user whose maxdays to update
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          maxdays:
 *                              type: integer
 *      responses:
 *         200:
 *            description: Returns a status and a user or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      newUser:
 *                          $ref: '#/components/schemas/User'
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 */
router.patch('/users/:id/maxdays', async (req, res) => {
    try {
        const user = await users.get(req.params.id);
        let submittingId = req.get('submittingId');
        let submittingUser = await users.get(submittingId);
        if (!submittingUser.prefs.perms.includes("hr.edit_user_current_state")) {
            res.send({ status: "fail", error: "Permission denied" });
            return;
        }
        await users.updatePrefs(req.params.id, { "perms": user.prefs.perms, "role": user.prefs.role, "manager": user.prefs.manager, "maxdays": req.body.maxdays, "remainingdays": user.prefs.remainingdays, "sick": user.prefs.sick });

        let newUser = await users.get(req.params.id);
        res.send({ status: "success", newUser });
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

/**
 * @openapi
 * /users/{id}/remainingdays:
 *  patch:
 *      summary: Update a user's remainingdays by ID based on the permissions of the submitting user
 *      tags: [Users]
 *      security:
 *          - ApiKeyAuth: []
 *      parameters:
 *          - in: path
 *            name: id
 *            schema:
 *              type: string
 *            required: true
 *            description: The ID of the user whose remainingdays to update
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          remainingdays:
 *                              type: integer
 *      responses:
 *         200:
 *            description: Returns a status and a user or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      newUser:
 *                          $ref: '#/components/schemas/User'
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 */
router.patch('/users/:id/remainingdays', async (req, res) => {
    try {
        const user = await users.get(req.params.id);
        let submittingId = req.get('submittingId');
        let submittingUser = await users.get(submittingId);
        if (!submittingUser.prefs.perms.includes("hr.edit_user_current_state")) {
            res.send({ status: "fail", error: "Permission denied" });
            return;
        }
        await users.updatePrefs(req.params.id, { "perms": user.prefs.perms, "role": user.prefs.role, "manager": user.prefs.manager, "maxdays": user.prefs.maxdays, "remainingdays": req.body.remainingdays, "sick": user.prefs.sick });

        let newUser = await users.get(req.params.id);
        res.send({ status: "success", newUser });
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

/**
 * @openapi
 * /users/{id}:
 *  patch:
 *      summary: Update a user's preferences by ID based on the permissions of the submitting user
 *      tags: [Users]
 *      security:
 *          - ApiKeyAuth: []
 *      parameters:
 *          - in: path
 *            name: id
 *            schema:
 *              type: string
 *            required: true
 *            description: The ID of the user whose preferences to update
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          perms:
 *                              type: array
 *                              items:
 *                                  type: string
 *                          role:
 *                              type: string
 *                          manager:
 *                              type: string
 *                          maxdays:
 *                              type: integer
 *                          remainingdays:
 *                              type: integer
 *      responses:
 *         200:
 *            description: Returns a status and a user or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      newUser:
 *                          $ref: '#/components/schemas/User'
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 */
router.patch('/users/:id', async (req, res) => {
    try {
        const user = await users.get(req.params.id);
        let submittingId = req.get('submittingId');
        let submittingUser = await users.get(submittingId);
        if (!submittingUser.prefs.perms.includes("hr.edit_user_perms")) {
            res.send({ status: "fail", error: "Permission denied" });
            return;
        }
        await users.updatePrefs(req.params.id, { "perms": req.body.perms, "role": req.body.role, "manager": req.body.manager, "maxdays": req.body.maxdays, "remainingdays": req.body.remainingdays, "sick": user.prefs.sick });

        let newUser = await users.get(req.params.id);
        res.send({ status: "success", newUser });
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

/**
 * @openapi
 * /users/{id}/name:
 *  patch:
 *      summary: Update a user's name by ID based on the permissions of the submitting user
 *      tags: [Users]
 *      security:
 *          - ApiKeyAuth: []
 *      parameters:
 *          - in: path
 *            name: id
 *            schema:
 *              type: string
 *            required: true
 *            description: The ID of the user whose name to update
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          name:
 *                              type: string
 *      responses:
 *         200:
 *            description: Returns a status and a user or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      newUser:
 *                          $ref: '#/components/schemas/User'
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 */
router.patch('/users/:id/name', async (req, res) => {
    try {
        const user = await users.get(req.params.id);
        let submittingId = req.get('submittingId');
        let submittingUser = await users.get(submittingId);
        if (!submittingUser.prefs.perms.includes("hr.edit_user_perms")) {
            res.send({ status: "fail", error: "Permission denied" });
            return;
        }
        await users.updateName(req.params.id, req.body.name);

        let newUser = await users.get(req.params.id);
        res.send({ status: "success", newUser });
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

/**
 * @openapi
 * /users/{id}/password:
 *  patch:
 *      summary: Update a user's password by ID based on the permissions of the submitting user
 *      description: The password needs to be plaintext here because of appwrites limitation, so this endpoint should not be used
 *      tags: [Users]
 *      security:
 *          - ApiKeyAuth: []
 *      parameters:
 *          - in: path
 *            name: id
 *            schema:
 *              type: string
 *            required: true
 *            description: The ID of the user whose password to update
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          password:
 *                              type: string
 *      responses:
 *         200:
 *            description: Returns a status and a user or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      newUser:
 *                          $ref: '#/components/schemas/User'
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 */
router.patch('/users/:id/password', async (req, res) => {
    try {
        const user = await users.get(req.params.id);
        let submittingId = req.get('submittingId');
        let submittingUser = await users.get(submittingId);
        if (!submittingUser.prefs.perms.includes("hr.edit_user_perms")) {
            res.send({ status: "fail", error: "Permission denied" });
            return;
        }
        await users.updatePassword(req.params.id, req.body.password);

        let newUser = await users.get(req.params.id);
        res.send({ status: "success", newUser });
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

/**
 * @openapi
 * /users/{id}/email:
 *  patch:
 *      summary: Update a user's email by ID based on the permissions of the submitting user
 *      tags: [Users]
 *      security:
 *          - ApiKeyAuth: []
 *      parameters:
 *          - in: path
 *            name: id
 *            schema:
 *              type: string
 *            required: true
 *            description: The ID of the user whose email to update
 *      requestBody:
 *          required: true
 *          content:
 *              application/json:
 *                  schema:
 *                      type: object
 *                      properties:
 *                          email:
 *                              type: string
 *      responses:
 *         200:
 *            description: Returns a status and a user or an error message
 *            content:
 *             application/json:
 *                schema:
 *                  type: object
 *                  properties:
 *                      status:
 *                          type: string
 *                          description: The status of the request
 *                      newUser:
 *                          $ref: '#/components/schemas/User'
 *                      error:
 *                          type: string
 *                          description: The error message, if any
 */
router.patch('/users/:id/email', async (req, res) => {
    try {
        const user = await users.get(req.params.id);
        let submittingId = req.get('submittingId');
        let submittingUser = await users.get(submittingId);
        if (!submittingUser.prefs.perms.includes("hr.edit_user_perms")) {
            res.send({ status: "fail", error: "Permission denied" });
            return;
        }
        await users.updateEmail(req.params.id, req.body.email);

        let newUser = await users.get(req.params.id);
        res.send({ status: "success", newUser });
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

router.patch('/users/:id/sick', async (req, res) => {
    try {
        const user = await users.get(req.params.id);
        let submittingId = req.get('submittingId');
        let submittingUser = await users.get(submittingId);
        if (!submittingUser.prefs.perms.includes("hr.edit_user_current_state")) {
            res.send({ status: "fail", error: "Permission denied" });
            return;
        }
        await users.updatePrefs(req.params.id, { "perms": user.prefs.perms, "role": user.prefs.role, "manager": user.prefs.manager, "maxdays": user.prefs.maxdays, "remainingdays": user.prefs.remainingdays, "sick": req.body.sick });

        let newUser = await users.get(req.params.id);
        res.send({ status: "success", newUser });
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

module.exports = router;

/**
 * @openapi
 * components:
 *  schemas:
 *      User:
 *          type: object
 *          properties:
 *              $id: 
 *                  type: string
 *              name:
 *                  type: string
 *              password:
 *                  type: string
 *              email:
 *                  type: string
 *              prefs:
 *                  type: object
 *                  properties:
 *                      perms:
 *                          type: array
 *                          items:
 *                              type: string
 *                      role:
 *                          type: string
 *                      manager:
 *                          type: string
 *                      maxdays:
 *                          type: number
 *                      remainingdays:
 *                          type: number
 *                      sick:
 *                          type: boolean
 */