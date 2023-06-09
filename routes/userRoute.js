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

router.get('/users/', async (req, res) => {
    try {
        let submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("jegyzo.list_all")) {
            let usersList = await users.list();
            let toReturn = [];
            for (let user of usersList.users) {
                if (user.email.endsWith(submittingUser.email.split("@")[1])) {
                    toReturn.push(user);
                }
            }
            usersList.users = toReturn;
            res.send({ status: "success", usersList });
        } else if (submittingUser.prefs.perms.includes("irodavezeto.list_own")) {
            const usersList = await users.list();
            usersList.users = usersList.users.filter(user => user.prefs.manager.includes(submittingUser.$id));
            res.send({ status: "success", usersList });
        } else {
            res.send({ status: "fail", error: "Permission denied" });
        }
    } catch (error) {
        res.send({ status: "fail", error });
    }
});

router.get('/users/report', async (req, res) => {
    try {
        let usersList;
        let submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("jegyzo.list_all")) {
            usersList = await users.list();
            let toReturn = [];
            for (let user of usersList.users) {
                if (user.email.endsWith(submittingUser.email.split("@")[1])) {
                    toReturn.push(user);
                }
            }
            usersList.users = toReturn;
        } else if (submittingUser.prefs.perms.includes("irodavezeto.list_own")) {
            usersList = await users.list();
            usersList.users = usersList.users.filter(user => user.prefs.manager.includes(submittingUser.$id));
        } else {
            res.send({ status: "fail", error: "Permission denied" });
        }

        let today = new Date();
        if (today.getMonth() < 10) {
            today.setMonth(today.getMonth());
            today = new Date(today.getTime() - 1);
        }
        if (today.getDate() < 10) {
            today.setDate(today.getDate() + 1);
            today = new Date(today.getTime() - 1);
        }

        let todayString = today.toISOString().split('T')[0];

        let szabadsagok = await database.listDocuments(dbId, szabadsagID, []);

        szabadsagok = szabadsagok.documents.filter(szabadsag => {
            if (szabadsag.dates.includes(todayString)) {
                return true;
            }
            return false;
        });

        // return a csv file with the user id user name and dates of leave. Only return the users that are on leave today
        let toReturn = [];
        usersList.users.forEach(user => {
            let userSzabadsag = szabadsagok.find(szabadsag => szabadsag.userId == user.$id);
            if (user.prefs.sick) {
                toReturn.push({
                    userId: user.$id,
                    name: user.name,
                    isSick: true
                })
            } else if (userSzabadsag) {
                let userSzabadsagDates = userSzabadsag.dates;
                toReturn.push({
                    userId: user.$id,
                    name: user.name,
                    isSick: false,
                    dates: userSzabadsagDates.join(", ")
                });
            }
        });



        res.send({ status: "success", report: toReturn });
    } catch (error) {
        res.send({ status: "fail", error });
    }






    // const usersList = await users.list();
    // const szabadsagList = await szabadsag.list();

    // const filteredUsers = usersList.users.filter(user => {
    //     if (userId && user._id !== userId) {
    //         return false;
    //     }
    //     const szabadsagUser = szabadsagList.szabadsagok.find(szabadsag => szabadsag.user_id === user._id.toString());
    //     if (!szabadsagUser) {
    //         return false;
    //     }
    //     const szabadsagDays = szabadsagUser.szabadsagok.reduce((acc, szabadsag) => {
    //         if (szabadsag.kezdes >= startDate && szabadsag.vege <= endDate) {
    //             return acc + szabadsag.napok;
    //         }
    //         return acc;
    //     }, 0);
    //     return szabadsagDays > 0;
    // });

    // const csvData = filteredUsers.map(user => {
    //     const szabadsagUser = szabadsagList.szabadsagok.find(szabadsag => szabadsag.user_id === user._id.toString());
    //     const szabadsagDays = szabadsagUser.szabadsagok.reduce((acc, szabadsag) => {
    //         if (szabadsag.kezdes >= startDate && szabadsag.vege <= endDate) {
    //             return acc + szabadsag.napok;
    //         }
    //         return acc;
    //     }, 0);
    //     return {
    //         id: user._id,
    //         name: user.name,
    //         days: szabadsagDays
    //     };
    // });

    // const csvStringifier = csv({
    //     header: true,
    //     columns: ['id', 'name', 'days']
    // });

    // res.setHeader('Content-Disposition', 'attachment; filename=report.csv');
    // res.setHeader('Content-Type', 'text/csv');
    // csvStringifier.pipe(res);
    // csvData.forEach(data => csvStringifier.write(data));
    // csvStringifier.end();
});

router.get('/users/:id', async (req, res) => {
    try {
        let submittingUser = await users.get(req.get('submittingId'));
        if (submittingUser.prefs.perms.includes("jegyzo.list_all")) {
            const user = await users.get(req.params.id);
            if (user.email.endsWith(submittingUser.email.split("@")[1])) {
                res.send({ status: "success", user });
            } else {
                res.send({ status: "fail", error: "Permission denied" });
            }
        } else if (submittingUser.prefs.perms.includes("irodavezeto.list_own")) {
            const user = await users.get(req.params.id);
            if (user.email.endsWith(submittingUser.email.split("@")[1]) && user.prefs.manager.includes(submittingUser.$id)) {
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