require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const bodyParser = require('body-parser');
const cors = require('cors');
const { Client, Databases, Users, ID } = require('node-appwrite');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

const client = new Client();
client
    .setEndpoint(process.env.APPWRITE_API_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const database = new Databases(client);
const users = new Users(client);

app.get('/users/', async (req, res) => {
    try {
        let submittingUser = await users.get(req.body.submittingId);
        if (submittingUser.prefs.perms.includes("jegyzo.list_all")) {
            const usersList = await users.list();
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

app.get('/users/:id', async (req, res) => {
    try {
        let submittingUser = await users.get(req.body.submittingId);
        if (submittingUser.prefs.perms.includes("jegyzo.list_all")) {
            const user = await users.get(req.params.id);
            res.send({status: "success", user});
        } else if (submittingUser.prefs.perms.includes("irodavezeto.list_own")) {
            const user = await users.get(req.params.id);
            if (user.prefs.manager.includes(submittingUser.$id)) {
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

app.post('/users/register', async (req, res) => {
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
            ? ["felhasznalo.reqest",
                "irodavezeto.approve", "irpdavezeto.reject", 
                "irodavezeto.message_send", "jegyzo.edit_user", 
                "jegyzo.create_user", "jegyzo.delete_user", "jegyzo.list_all",
                "hr.edit_user_perms", "hr.edit_user_current_state"] 
            : req.body.perms;
        let preferences = { "perms": perms, "manager": manager, "role": req.body.role };
        const prefs = await users.updatePrefs(user.$id, preferences);
        res.send({status: "success", user, prefs});
    } catch (error) {
        res.send({status: "fail", error});
    }
});

app.delete('/users/:id', async (req, res) => {
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

app.patch('/users/:id/perms', async (req, res) => {
    try {
        const user = await users.get(req.params.id);
        let submittingId = req.body.submittingId;
        let submittingUser = await users.get(submittingId);
        if (!submittingUser.prefs.perms.includes("hr.edit_user_perms")) {
            res.send({status: "fail", error: "Permission denied"});
            return;
        }
        users.updatePrefs(req.params.id, { "perms": req.body.perms, "role": user.prefs.role, "manager": user.prefs.manager });
        res.send({status: "success", user});
    } catch (error) {
        res.send({status: "fail", error});
    }
});

app.patch('/users/:id/manager', async (req, res) => {
    try {
        const user = await users.get(req.params.id);
        let submittingId = req.body.submittingId;
        let submittingUser = await users.get(submittingId);
        if (!submittingUser.prefs.perms.includes("hr.edit_user_perms")) {
            res.send({status: "fail", error: "Permission denied"});
            return;
        }
        users.updatePrefs(req.params.id, { "perms": user.prefs.perms, "role": user.prefs.role, "manager": req.body.manager });
        res.send({status: "success", user});
    } catch (error) {
        res.send({status: "fail", error});
    }
});

app.patch('/users/:id/role', async (req, res) => {
    try {
        const user = await users.get(req.params.id);
        let submittingId = req.body.submittingId;
        let submittingUser = await users.get(submittingId);
        if (!submittingUser.prefs.perms.includes("hr.edit_user_perms")) {
            res.send({status: "fail", error: "Permission denied"});
            return;
        }
        users.updatePrefs(req.params.id, { "perms": user.prefs.perms, "role": req.body.role, "manager": user.prefs.manager });
        res.send({status: "success", user});
    } catch (error) {
        res.send({status: "fail", error});
    }
});

app.patch('/users/:id', async (req, res) => {
    try {
        const user = await users.get(req.params.id);
        let submittingId = req.body.submittingId;
        let submittingUser = await users.get(submittingId);
        if (!submittingUser.prefs.perms.includes("hr.edit_user_perms")) {
            res.send({status: "fail", error: "Permission denied"});
            return;
        }
        users.updatePrefs(req.params.id, { "perms": req.body.perms, "role": req.body.role, "manager": req.body.manager });
        res.send({status: "success", user});
    } catch (error) {
        res.send({status: "fail", error});
    }
});

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
});