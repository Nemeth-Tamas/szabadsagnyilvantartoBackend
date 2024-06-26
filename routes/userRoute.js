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
    let szabadsagok = (await database.listDocuments(dbId, szabadsagID, [Query.equal("userId", user.$id)])).documents;
    user.prefs.onLeave = await isOnLeave(szabadsagok);
    return user;
}

router.get('/users/', async (req, res) => {
    try {
        let submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("jegyzo.list_all")) {
            let usersList = await users.list();
            let toReturn = [];
            for (let user of usersList.users) {
                if (user.email.endsWith(submittingUser.email.split("@")[1])) {
                    toReturn.push(await checkStatus(user));
                }
            }
            usersList.users = toReturn;
            res.send({ status: "success", usersList });
        } else if (submittingUser.prefs.perms.includes("irodavezeto.list_own")) {
            const usersList = await users.list();
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

router.delete('/users/:id', async (req, res) => {
    try {
        const submittingUser = await users.get(req.get('submittingId'));
        if (!submittingUser.prefs.perms.includes("jegyzo.delete_user")) {
            res.send({ status: "fail", error: "Permission denied" });
            return;
        }
        const user = await users.delete(req.params.id);

        // delete requests
        const requests = await database.listDocuments(dbId, kerelmekId, [Query.equal("submittingId", req.params.id)]);
        for (let request of requests.documents) {
            await database.deleteDocument(dbId, kerelmekId, request.$id);
        }

        // delete szabadsagok
        const szabadsagok = await database.listDocuments(dbId, szabadsagID, [Query.equal("userId", req.params.id)]);
        for (let szabadsag of szabadsagok.documents) {
            await database.deleteDocument(dbId, szabadsagID, szabadsag.$id);
        }

        const plans = await database.listDocuments(dbId, plansID, [Query.equal("userId", req.params.id)]);
        for (let plan of plans.documents) {
            await database.deleteDocument(dbId, plansID, plan.$id);
        }
        res.send({ status: "success", user });
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

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

// TODO: remove this route
// TODO: remote sick param from user prefs
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