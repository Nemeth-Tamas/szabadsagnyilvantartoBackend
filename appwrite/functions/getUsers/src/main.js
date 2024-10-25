import { Client, Databases, Query, Users } from 'node-appwrite';

const isSick = (tappenz) => {
  if (tappenz != undefined && (tappenz.endDate == null || new Date() < new Date(tappenz.endDate)) && new Date(tappenz.startDate) < new Date()) {
    return true;
  } else {
    return false;
  }
};

const isOnLeave = async (szabadsagok) => {
  if (szabadsagok != undefined) {
      let today = new Date();
      today = today.toISOString().split('T')[0]; // get date in YYYY-MM-DD format

      return szabadsagok.some(leave => leave.dates.includes(today));
  } else {
      return false;
  }
}

async function checkStatus(user, database, dbId, tappenzID, szabadsagID) {
  let tappenz = (await database.listDocuments(
    dbId, tappenzID, [
      Query.equal("userId", user.$id),
      Query.orderDesc("startDate")
    ]
  )).documents[0];
  user.prefs.sick = isSick(tappenz);
  let szabadsagok = (await database.listDocuments(
    dbId, szabadsagID, [
      Query.equal("userId", user.$id),
      Query.limit(1000)
    ]
  )).documents;
  user.prefs.onLeave = await isOnLeave(szabadsagok);
  return user;
}

export default async ({ req, res, log, error }) => {
  const client = new Client();

  // Initialize the client and set the endpoint, project, and API key
  client
    .setEndpoint(process.env.APPWRITE_API_ENDPOINT) // Docker internal DNS to connect Appwrite
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const dbId = process.env.APPWRITE_DB_ID;
  const kerelmekId = process.env.APPWRITE_KERELMEK_COLLECTION;
  const szabadsagID = process.env.APPWRITE_SZABADSAG_COLLECTION;
  const plansID = process.env.APPWRITE_PLANS_COLLECTION;
  const tappenzID = process.env.APPWRITE_TAPPENZ_COLLECTION;

  // Validate the environment variables
  if (!dbId || !plansID || !kerelmekId || !szabadsagID || !tappenzID) {
    error("Database or collection ID is missing in environment variables.");
    return res.json({ status: "fail", error: "Server configuration error" });
  }

  const database = new Databases(client);
  const users = new Users(client);

  let submittingId;
  let submittingUser;
  try {
    const body = JSON.parse(req.body);
    
    // Check if userId exists in the request body
    if (!body || !body.submittingId) {
      throw new Error("submittingId is missing in the request body.");
    }
    submittingId = body.submittingId;

    submittingUser = await users.get(submittingId);
  } catch (parseError) {
    error(`Failed to parse request body or missing submittingId: ${parseError.message}`);
    return res.json({ status: "fail", error: "Invalid request body or missing submittingId" });
  }

  try {
    if (submittingUser.prefs.perms.includes("jegyzo.list_all")) {
      let usersList = await users.list([
        Query.limit(25),
        Query.offset(0),
      ]);

      while (usersList.users.length < usersList.total) {
        usersList.users = usersList.users.concat((await users.list([
          Query.limit(25),
          Query.offset(usersList.users.length)
        ])).users);
      }

      let toReturn = [];
      for (let user of usersList.users) {
        if (user.email.endsWith(submittingUser.email.split("@")[1])) {
          toReturn.push(await checkStatus(user, database, dbId, tappenzID, szabadsagID));
        }
      }
      usersList.users = toReturn;
      return res.json({ status: "success", usersList });
    } else if (submittingUser.prefs.perms.includes("irodavezeto.list_own")) {
      const usersList = await users.list([Query.limit(25), Query.offset(0)]);

      while (usersList.users.length < usersList.total) {
        usersList.users = usersList.users.concat((await users.list([Query.limit(25), Query.offset(usersList.users.length)])).users);
      }

      usersList.users = usersList.users.filter(user => user.prefs.manager.includes(submittingId));
      for (let user of usersList.users) {
        user = await checkStatus(user);
      }

      return res.json({ status: "success", usersList });
    } else {
      error("User does not have permission to get users.");
      return res.json({ status: "fail", error: "User does not have permission to get users." });
    }
  } catch (err) {
    error(`Failed to get users: ${err.message}`);
    return res.json({ status: "fail", error: "Failed to get users" });
  }
};
