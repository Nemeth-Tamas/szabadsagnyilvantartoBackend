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

router.get('/uzenetek/:id', async (req, res) => {
    try {
        const messages = await database.listDocuments(dbId, uzenetekId, [Query.equal("userId", req.params.id)]);
        res.send({ status: "success", messages });
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

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