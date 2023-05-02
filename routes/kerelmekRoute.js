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
const kerelmekId = process.env.APPWRITE_KERELMEK_COLLECTION;
const szabadsagID = process.env.APPWRITE_SZABADSAGOK_COLLECTION;

router.get('/kerelmek/', async (req, res) => {
    try {
        let submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("irodavezeto.approve")) {
            let kerelmek = await database.listDocuments(dbId, kerelmekId, [Query.equal("managerId", submittingUser.$id)]);
            res.send({ status: "success", kerelmek });
        }
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

router.get('/kerelmek/own', async (req, res) => {
    try {
        let submittingUser = await users.get(req.get('submittingId'));
        let kerelmek = await database.listDocuments(dbId, kerelmekId, [Query.equal("submittingId", submittingUser.$id)]);
        res.send({ status: "success", kerelmek });
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

router.get('/kerelmek/all', async (req, res) => {
    try {
        let submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("hr.edit_user_current_state")) {
            let kerelmek = await database.listDocuments(dbId, kerelmekId);
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
    

router.post('/kerelmek/add', async (req, res) => {
    try {
        let submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("felhasznalo.request")) {
            console.log(req.body);
            let managerId = req.body.managerId;
            if (managerId != submittingUser.prefs.manager) {
                res.send({ status: "fail", error: "Permission denied" });
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
            res.send({ status: "success", kerelem });
        }
        else {
            res.send({ status: "fail", error: "Permission denied" });
        }
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

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
                newPrefs.remainingdays += daysCount;
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

router.put('/kerelmek/:id/approve', async (req, res) => {
    try {
        let submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("irodavezeto.approve")) {
            let current = await database.getDocument(dbId, kerelmekId, req.params.id);
            let szabadsag = await database.createDocument(dbId, szabadsagID, ID.unique(), {
                userId: current.submittingId,
                dates: current.dates,
                type: current.type
            });

            let daysCount = current.dates.length;
            let user = await users.get(current.submittingId);
            let newPrefs = user.prefs;
            newPrefs.remainingdays -= daysCount;
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