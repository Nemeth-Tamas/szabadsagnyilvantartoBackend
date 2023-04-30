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

router.get('/users/', async (req, res) => {
    try {
        let submittingUser = await users.get(req.body.submittingId);
        if (submittingUser.prefs.perms.includes("jegyzo.list_all")) {
            let usersList = await users.list();
            let toReturn = [];
            for (let user of usersList.users) {
                if (user.email.endsWith(submittingUser.email.split("@")[1])) {
                    toReturn.push(user);
                }
            }
            usersList.users = toReturn;
            res.send({status: "success", usersList});
        } else if (submittingUser.prefs.perms.includes("irodavezeto.list_own")) {
            const usersList = await users.list();
            usersList.users = usersList.users.filter(user => user.prefs.manager.includes(submittingUser.$id));
            res.send({status: "success", usersList});
        } else {
            res.send({status: "fail", error: "Permission denied"});
        }
    } catch (error) {
        res.send({status: "fail", error});
    }
});

router.get('/users/:id', async (req, res) => {
    try {
        let submittingUser = await users.get(req.body.submittingId);
        if (submittingUser.prefs.perms.includes("jegyzo.list_all")) {
            const user = await users.get(req.params.id);
            if (user.email.endsWith(submittingUser.email.split("@")[1])) {
                res.send({status: "success", user});
            } else {
                res.send({status: "fail", error: "Permission denied"});
            }
        } else if (submittingUser.prefs.perms.includes("irodavezeto.list_own")) {
            const user = await users.get(req.params.id);
            if (user.email.endsWith(submittingUser.email.split("@")[1]) && user.prefs.manager.includes(submittingUser.$id)) {
                res.send({status: "success", user});
            } else {
                res.send({status: "fail", error: "Permission denied"});
            }
        } else {
            res.send({status: "fail", error: "Permission denied"});
        }
    } catch (error) {
        res.send({status: "fail", error});
    }
});

router.post('/users/register', async (req, res) => {
    try {
        const submittingUser = await users.get(req.body.submittingId);
        console.log(submittingUser);
        if (!submittingUser.prefs.perms.includes("jegyzo.create_user")) {
            res.send({status: "fail", error: "Permission denied"});
            return;
        }
    } catch (error) {
        res.send({status: "fail", error});
        return;
    }
    try {
        const user = await users.create(ID.unique(), req.body.email, null, req.body.password, req.body.name);
        let manager = req.body.role == "admin" ? user.$id : req.body.manager;
        let perms = req.body.role == "admin" 
            ? ["felhasznalo.reqest", "felhasznalo.delete_request",
                "irodavezeto.approve", "irpdavezeto.reject", 
                "irodavezeto.message_send", "jegyzo.edit_user", 
                "jegyzo.create_user", "jegyzo.delete_user", "jegyzo.list_all",
                "hr.edit_user_perms", "hr.edit_user_current_state"] 
            : req.body.perms;
        let preferences = { "perms": perms, "manager": manager, "role": req.body.role, "maxdays": req.body.maxdays || 0, "remainigdays": req.body.remainingdays || 0 };
        const prefs = await users.updatePrefs(user.$id, preferences);
        res.send({status: "success", user, prefs});
    } catch (error) {
        res.send({status: "fail", error});
    }
});

router.delete('/users/:id', async (req, res) => {
    try {
        const submittingUser = await users.get(req.body.submittingId);
        if (!submittingUser.prefs.perms.includes("jegyzo.delete_user")) {
            res.send({status: "fail", error: "Permission denied"});
            return;
        }
        const user = await users.delete(req.params.id);
        res.send({status: "success"});
    } catch (error) {
        res.send({status: "fail", error});
    }
});

router.patch('/users/:id/perms', async (req, res) => {
    try {
        const user = await users.get(req.params.id);
        let submittingId = req.body.submittingId;
        let submittingUser = await users.get(submittingId);
        if (!submittingUser.prefs.perms.includes("hr.edit_user_perms")) {
            res.send({status: "fail", error: "Permission denied"});
            return;
        }
        users.updatePrefs(req.params.id, { "perms": req.body.perms, "role": user.prefs.role, "manager": user.prefs.manager, "maxdays": user.prefs.maxdays, "remainigdays": user.prefs.remainingdays });
        res.send({status: "success", user});
    } catch (error) {
        res.send({status: "fail", error});
    }
});

router.patch('/users/:id/manager', async (req, res) => {
    try {
        const user = await users.get(req.params.id);
        let submittingId = req.body.submittingId;
        let submittingUser = await users.get(submittingId);
        if (!submittingUser.prefs.perms.includes("hr.edit_user_perms")) {
            res.send({status: "fail", error: "Permission denied"});
            return;
        }
        users.updatePrefs(req.params.id, { "perms": user.prefs.perms, "role": user.prefs.role, "manager": req.body.manager, "maxdays": user.prefs.maxdays, "remainigdays": user.prefs.remainingdays });
        res.send({status: "success", user});
    } catch (error) {
        res.send({status: "fail", error});
    }
});

router.patch('/users/:id/role', async (req, res) => {
    try {
        const user = await users.get(req.params.id);
        let submittingId = req.body.submittingId;
        let submittingUser = await users.get(submittingId);
        if (!submittingUser.prefs.perms.includes("hr.edit_user_perms")) {
            res.send({status: "fail", error: "Permission denied"});
            return;
        }
        users.updatePrefs(req.params.id, { "perms": user.prefs.perms, "role": req.body.role, "manager": user.prefs.manager, "maxdays": user.prefs.maxdays, "remainigdays": user.prefs.remainingdays });
        res.send({status: "success", user});
    } catch (error) {
        res.send({status: "fail", error});
    }
});


router.patch('/users/:id/maxdays', async (req, res) => {
    try {
        const user = await users.get(req.params.id);
        let submittingId = req.body.submittingId;
        let submittingUser = await users.get(submittingId);
        if (!submittingUser.prefs.perms.includes("hr.edit_user_current_state")) {
            res.send({status: "fail", error: "Permission denied"});
            return;
        }
        users.updatePrefs(req.params.id, { "perms": user.prefs.perms, "role": user.prefs.role, "manager": user.prefs.manager, "maxdays": req.body.maxdays, "remainigdays": user.prefs.remainingdays });
        res.send({status: "success", user});
    } catch (error) {
        res.send({status: "fail", error});
    }
});

router.patch('/users/:id/remainingdays', async (req, res) => {
    try {
        const user = await users.get(req.params.id);
        let submittingId = req.body.submittingId;
        let submittingUser = await users.get(submittingId);
        if (!submittingUser.prefs.perms.includes("hr.edit_user_current_state")) {
            res.send({status: "fail", error: "Permission denied"});
            return;
        }
        users.updatePrefs(req.params.id, { "perms": user.prefs.perms, "role": user.prefs.role, "manager": user.prefs.manager, "maxdays": user.prefs.maxdays, "remainigdays": req.body.remainingdays });
        res.send({status: "success", user});
    } catch (error) {
        res.send({status: "fail", error});
    }
});
router.patch('/users/:id', async (req, res) => {
    try {
        const user = await users.get(req.params.id);
        let submittingId = req.body.submittingId;
        let submittingUser = await users.get(submittingId);
        if (!submittingUser.prefs.perms.includes("hr.edit_user_perms")) {
            res.send({status: "fail", error: "Permission denied"});
            return;
        }
        await users.updatePrefs(req.params.id, { "perms": req.body.perms, "role": req.body.role, "manager": req.body.manager, "maxdays": req.body.maxdays, "remainigdays": req.body.remainingdays });
        res.send({status: "success", user});
    } catch (error) {
        res.send({status: "fail", error});
    }
});

module.exports = router;