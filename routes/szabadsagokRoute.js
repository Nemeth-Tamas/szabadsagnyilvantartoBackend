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