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
const plansID = process.env.APPWRITE_PLANS_COLLECTION;

router.get('/plans/:id', async (req, res) => {
    try {
        // let submittingUser = await users.get(req.get('submittingId'));
        let plan = (await database.listDocuments(dbId, plansID, [Query.equal("userId", req.params.id)])).documents[0];
        res.send({ status: "success", plan, filledOut: plan.filledOut });
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

router.post('/plans/', async (req, res) => {
    try {
        let id = req.get('submittingId');
        let plan = req.body.planDays;
        let filledOut = true;

        let submittingUser = await users.get(id);
        if (plan.length == 0) {
            res.send({ status: "fail", error: "Plan is empty" });
            return;
        }

        if (submittingUser.prefs.maxdays == 0) {
            res.send({ status: "fail", error: "HR did not set the number of days yet" });
            return;
        } else if (submittingUser.prefs.maxdays == plan.length) {
            filledOut = true;
            let docId = (await database.listDocuments(dbId, plansID, [Query.equal("userId", id)]))?.documents[0]?.$id;
            let planDoc = await database.updateDocument(dbId, plansID, docId, {
                dates: plan,
                filledOut: filledOut,
            })
            res.send({ status: "success", planDoc });
            return;
        } else if (submittingUser.prefs.maxdays > plan.length) {
            res.send({ status: "fail", error: "Did not use all days" });
            return;
        } else if (submittingUser.prefs.maxdays < plan.length) {
            res.send({ status: "fail", error: "Used too many days" });
            return;
        }
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

router.delete('/plans/:id', async (req, res) => {
    try {
        const submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("hr.edit_user_current_state")) {
            let uId = req.params.id;
            let docId = (await database.listDocuments(dbId, plansID, [Query.equal("userId", uId)]))?.documents[0]?.$id;
            let planDoc = await database.updateDocument(dbId, plansID, docId, {
                dates: [],
                filledOut: false,
            })
            res.send({ status: "success", planDoc });
        } else {
            res.send({ status: "fail", error: "Permission denied" });
        }

    } catch (error) {
        res.send({ status: "fail", error });
    }
});

// TODO: Implement get request that only hr can call to get a user's plans in excel format.
// TODO: Implement request that only hr can call to reset all users' plans. This will get called once a year.
// TODO: Implement request that only hr can call to reset ONE user's plans.

module.exports = router;